/**
 * AI features (any OpenAI-compatible chat API: Ollama on this computer, or Groq).
 *  1. Interpret scan results and prioritize what to check first
 *  2. Explain a finding, suggest how to verify it, and suggest the fix
 *  3. Draft the executive summary for the report
 * Every request is redacted first and logged (AiLog) with exactly what was sent.
 * AI output is advice only: it never confirms or rejects a finding.
 */
import { prisma } from "../db.ts";
import { env } from "../env.ts";
import { HttpError } from "../http.ts";
import { clip, redact } from "./redact.ts";

const SYSTEM = `You help a human security assessor review an AUTHORIZED web application assessment.
Rules:
- Use only the facts given. If evidence is missing, say so. Do not invent versions, CVEs or URLs.
- You never confirm a vulnerability. Tool results are leads until the assessor verifies them.
- Suggest only safe, non-destructive checks. No denial of service, no brute forcing, no changing data.
- [REDACTED] values were removed on purpose.
- Write short, plain sentences for students and developers.
Reply with ONE JSON object only, no markdown.`;

async function ask(task: string, instructions: string, context: string): Promise<{ data: Record<string, unknown>; model: string }> {
  const { text, count } = redact(context);
  let reply: string | undefined;
  try {
    const res = await fetch(`${env.ai.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(env.ai.apiKey ? { Authorization: `Bearer ${env.ai.apiKey}` } : {}) },
      body: JSON.stringify({
        model: env.ai.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `${instructions}\n\n${text}` },
        ],
      }),
      // A local model can need a minute to load on its first request.
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    reply = ((await res.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content;
  } catch (e) {
    throw new HttpError(502, `The AI service did not answer (${env.ai.model} at ${env.ai.baseUrl}). ${(e as Error).message}`);
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse((reply ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, ""));
  } catch {
    throw new HttpError(502, "The AI answered in an unexpected format. Try again.");
  }
  await prisma.aiLog.create({ data: { task, model: env.ai.model, sentText: text, output: JSON.stringify(data), redactions: count } });
  return { data, model: env.ai.model };
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : JSON.stringify(v));
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : typeof v === "string" && v ? [v] : []);
const SEVERITIES = ["critical", "high", "medium", "low", "info"];
const CATEGORY: Record<string, string> = { config_https: "Security configuration and HTTPS", auth: "Authentication and login security", session: "Session management", exposed_files: "Exposed files and directories", info_disclosure: "Information disclosure", other: "Other" };
const cat = (c: string) => CATEGORY[c] ?? c;

interface FindingLike { title: string; severity: string; category: string; source: string; affectedUrl: string; description: string; evidence: string; recommendation: string; status: string }

/** AI feature 1: interpret a scan and prioritize its results. */
export async function interpretScan(url: string, steps: { tool: string; status: string; summary: string }[], findings: FindingLike[]) {
  const context = [
    `WEBSITE: ${url}`,
    "",
    "TOOLS RUN:",
    ...steps.map((s) => `- ${s.tool} (${s.status}): ${s.summary}`),
    "",
    `TOOL FINDINGS (${findings.length}, none verified yet):`,
    ...findings.slice(0, 40).map((f, i) => `${i + 1}. [${f.severity}] ${f.title} (${f.source}) at ${f.affectedUrl}\n   Evidence: ${clip(f.evidence, 300)}`),
  ].join("\n");
  const { data, model } = await ask(
    "interpret_scan",
    `Interpret these scan results. Keys: "overview" (2-4 sentences: what the results say about this site), "priorities" (array of up to 5 objects {"title": finding title, "why": one sentence}, most important first), "falsePositives" (array of strings: results that may be false alarms and why), "nextSteps" (array of up to 5 safe manual checks).`,
    context,
  );
  return {
    overview: str(data.overview),
    priorities: (Array.isArray(data.priorities) ? data.priorities : []).map((p) => ({ title: str((p as Record<string, unknown>)?.title), why: str((p as Record<string, unknown>)?.why) })).filter((p) => p.title),
    falsePositives: strs(data.falsePositives),
    nextSteps: strs(data.nextSteps),
    model,
    generatedAt: new Date().toISOString(),
  };
}

/** AI feature 2: explain one finding, how to verify it, and how to fix it. */
export async function explainFinding(url: string, f: FindingLike) {
  const context = [
    `WEBSITE: ${url}`,
    `FINDING: ${f.title}`,
    `Reported severity: ${f.severity}; Category: ${cat(f.category)}; Tool: ${f.source}; Status: ${f.status}`,
    `Affected: ${f.affectedUrl}`,
    `Description: ${clip(f.description, 1500)}`,
    `Evidence: ${clip(f.evidence, 2000)}`,
    `Tool recommendation: ${clip(f.recommendation, 800)}`,
  ].join("\n");
  const { data, model } = await ask(
    "explain_finding",
    `Explain this finding. Keys: "explanation" (plain language, 2-4 sentences), "impact" (what could happen if it is real), "suggestedSeverity" (one of critical, high, medium, low, info), "severityReason" (one sentence), "verifySteps" (array of up to 4 safe manual checks to confirm it, for example with browser developer tools or curl), "fixSteps" (array of up to 5 concrete fixes for the developer), "confidence" (low, medium or high).`,
    context,
  );
  const sev = str(data.suggestedSeverity).toLowerCase();
  return {
    explanation: str(data.explanation),
    impact: str(data.impact),
    suggestedSeverity: SEVERITIES.includes(sev) ? sev : "",
    severityReason: str(data.severityReason),
    verifySteps: strs(data.verifySteps),
    fixSteps: strs(data.fixSteps),
    confidence: str(data.confidence).toLowerCase() || "low",
    model,
    generatedAt: new Date().toISOString(),
  };
}

/** AI feature 3: draft the executive summary for the report from confirmed findings only. */
export async function draftSummary(name: string, url: string, confirmed: FindingLike[], pending: number, rejected: number) {
  const context = [
    `WEBSITE: ${name} (${url})`,
    `CONFIRMED FINDINGS (${confirmed.length}):`,
    ...confirmed.slice(0, 40).map((f) => `- [${f.severity}] ${f.title} (${cat(f.category)})`),
    `NOT YET VERIFIED: ${pending}. REJECTED AS FALSE ALARMS: ${rejected}.`,
  ].join("\n");
  const { data } = await ask(
    "report_summary",
    `Write the executive summary for a security assessment report. Treat only CONFIRMED findings as vulnerabilities. Keys: "summary" (one paragraph of 4-6 sentences: overall security posture, the most serious issues, and what to fix first).`,
    context,
  );
  return str(data.summary);
}
