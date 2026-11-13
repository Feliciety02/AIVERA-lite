/**
 * Runs one scan: reconnaissance first, then scanning, step by step.
 * Each step's result is saved as soon as it finishes, so the page can show progress.
 */
import { prisma } from "./db.ts";
import { isLocal, type NewFinding, type StepResult } from "./tools/common.ts";
import { dnsLookup } from "./tools/dns.ts";
import { discoverEndpoints } from "./tools/endpoints.ts";
import { webChecks } from "./tools/webChecks.ts";
import { loginChecks } from "./tools/loginChecks.ts";
import { nmapScan } from "./tools/nmap.ts";
import { zapScan } from "./tools/zap.ts";

export interface Step { tool: string; label: string; status: "waiting" | "running" | "done" | "failed" | "skipped"; summary: string; output: string }

const TOOLS: { tool: string; label: string; run: (url: string, outOfScope: string, recon: Record<string, unknown>) => Promise<StepResult>; when?: (url: string, opts: ScanOptions) => string | null }[] = [
  { tool: "dns", label: "DNS lookup", run: (url) => dnsLookup(url) },
  { tool: "endpoints", label: "Endpoint discovery", run: discoverEndpoints },
  { tool: "login", label: "Login form checks", run: loginChecks },
  { tool: "web_checks", label: "Web checks (headers, cookies, TLS, errors, files)", run: webChecks },
  { tool: "nmap", label: "Nmap port scan", run: (url) => nmapScan(url), when: (url) => (isLocal(url) ? null : "Skipped: port scans only run on a copy on this computer, not on a hosted site.") },
  { tool: "zap", label: "OWASP ZAP passive scan", run: zapScan, when: (_url, o) => (o.zap ? null : "Skipped: not selected for this scan.") },
];

export interface ScanOptions { zap: boolean }

/** Saves new findings. A finding already recorded for this website (same title and URL) is kept as it is. */
async function saveFindings(targetId: string, scanId: string, found: NewFinding[]) {
  let added = 0;
  for (const f of found) {
    const exists = await prisma.finding.findUnique({ where: { targetId_title_affectedUrl: { targetId, title: f.title, affectedUrl: f.affectedUrl } } });
    if (exists) continue;
    await prisma.finding.create({ data: { ...f, targetId, scanId } });
    added++;
  }
  return added;
}

export async function runScan(scanId: string, target: { id: string; url: string; outOfScope: string }, opts: ScanOptions) {
  const steps: Step[] = TOOLS.map((t) => ({ tool: t.tool, label: t.label, status: "waiting", summary: "", output: "" }));
  const recon: Record<string, unknown> = {};
  const save = (extra: Record<string, unknown> = {}) => prisma.scan.update({ where: { id: scanId }, data: { steps: JSON.stringify(steps), recon: JSON.stringify(recon), ...extra } });
  let failures = 0;

  for (const [i, t] of TOOLS.entries()) {
    const step = steps[i]!;
    const skip = t.when?.(target.url, opts);
    if (skip) {
      step.status = "skipped";
      step.summary = skip;
      await save();
      continue;
    }
    step.status = "running";
    await save();
    try {
      const r = await t.run(target.url, target.outOfScope, recon);
      const added = await saveFindings(target.id, scanId, r.findings);
      Object.assign(recon, r.recon ?? {});
      step.status = "done";
      step.summary = r.findings.length ? `${r.summary} ${added} new finding(s) added.` : r.summary;
      step.output = r.output.slice(0, 400_000);
    } catch (e) {
      failures++;
      step.status = "failed";
      step.summary = (e as Error).message.slice(0, 500);
    }
    await save();
  }
  const ran = steps.filter((s) => s.status === "done" || s.status === "failed").length;
  await save({ status: failures === ran ? "failed" : "done", finishedAt: new Date() });
}

/** A scan that was running when the server stopped can never finish: mark it failed. */
export const failInterruptedScans = () => prisma.scan.updateMany({ where: { status: "running" }, data: { status: "failed", finishedAt: new Date() } });
