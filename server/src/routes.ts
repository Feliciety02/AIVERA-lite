import { existsSync } from "node:fs";
import { Router } from "express";
import { z } from "zod";
import { prisma, logActivity } from "./db.ts";
import { env } from "./env.ts";
import { fail, param } from "./http.ts";
import { checkUrl, isLocal } from "./tools/common.ts";
import { runScan } from "./scanner.ts";
import { draftSummary, explainFinding, interpretScan } from "./ai/ai.ts";

export const api = Router();

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

/* --------------------------------- Dashboard --------------------------------- */

api.get("/dashboard", async (_req, res) => {
  const [targets, scans, findings, activity] = await Promise.all([
    prisma.target.count(),
    prisma.scan.count(),
    prisma.finding.findMany({ select: { id: true, title: true, severity: true, status: true, category: true, targetId: true, createdAt: true, target: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.activity.findMany({ take: 8, orderBy: { createdAt: "desc" } }),
  ]);
  const count = <K extends string>(items: { [k: string]: unknown }[], key: string, values: K[]) => Object.fromEntries(values.map((v) => [v, items.filter((i) => i[key] === v).length])) as Record<K, number>;
  const confirmed = findings.filter((f) => f.status === "confirmed");
  res.json({
    targets,
    scans,
    findings: findings.length,
    byStatus: count(findings, "status", ["unverified", "confirmed", "rejected"]),
    confirmedBySeverity: count(confirmed, "severity", ["critical", "high", "medium", "low", "info"]),
    confirmedByCategory: count(confirmed, "category", ["config_https", "auth", "session", "exposed_files", "info_disclosure", "other"]),
    toReview: findings
      .filter((f) => f.status === "unverified")
      .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
      .slice(0, 6),
    activity,
  });
});

/* ---------------------------------- Websites --------------------------------- */

const lines = (s: string) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join("\n");

api.get("/targets", async (_req, res) => {
  const targets = await prisma.target.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { scans: true } }, findings: { select: { status: true, severity: true } }, scans: { take: 1, orderBy: { startedAt: "desc" }, select: { status: true, startedAt: true } } },
  });
  res.json(targets.map(({ findings, scans, _count, ...t }) => ({ ...t, scanCount: _count.scans, lastScan: scans[0] ?? null, findingCount: findings.length, confirmed: findings.filter((f) => f.status === "confirmed").length, toReview: findings.filter((f) => f.status === "unverified").length })));
});

api.post("/targets", async (req, res) => {
  const body = z
    .object({
      url: z.string().min(1, "Paste a link"),
      name: z.string().trim().max(80).optional(),
      approval: z.string().trim().max(300).default(""),
      outOfScope: z.string().max(2000).default(""),
      confirmed: z.literal(true, { error: "Confirm that you have permission to test this website" }),
    })
    .parse(req.body);
  const url = checkUrl(body.url);
  const approval = body.approval || "Tester confirmed written permission before scanning";
  // Pasting a link that is already saved reuses that website and records the latest approval.
  const existing = await prisma.target.findFirst({ where: { url } });
  if (existing) {
    const updated = await prisma.target.update({ where: { id: existing.id }, data: { ...(body.approval ? { approval } : {}), ...(body.outOfScope.trim() ? { outOfScope: lines(body.outOfScope) } : {}) } });
    return res.json(updated);
  }
  const target = await prisma.target.create({ data: { url, name: body.name || new URL(url).host, approval, outOfScope: lines(body.outOfScope) } });
  await logActivity("Added website", `${target.name} (${url}). Approval: ${approval}`);
  res.status(201).json(target);
});

api.get("/targets/:id", async (req, res) => {
  const target = await prisma.target.findUnique({
    where: { id: param(req) },
    include: {
      scans: { orderBy: { startedAt: "desc" }, select: { id: true, status: true, startedAt: true, finishedAt: true, steps: true } },
      findings: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, severity: true, status: true, category: true, source: true, affectedUrl: true } },
      reports: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, createdAt: true } },
    },
  });
  if (!target) fail(404, "Website not found.");
  res.json({ ...target, isLocal: isLocal(target!.url), scans: target!.scans.map(({ steps, ...s }) => ({ ...s, steps: (JSON.parse(steps) as { label: string; status: string }[]).map((x) => ({ label: x.label, status: x.status })) })) });
});

api.patch("/targets/:id", async (req, res) => {
  const body = z.object({ name: z.string().trim().min(1).max(80).optional(), approval: z.string().trim().min(5).max(300).optional(), outOfScope: z.string().max(2000).optional() }).parse(req.body);
  const target = await prisma.target.update({ where: { id: param(req) }, data: { ...body, ...(body.outOfScope !== undefined ? { outOfScope: lines(body.outOfScope) } : {}) } });
  await logActivity("Edited website", target.name);
  res.json(target);
});

api.delete("/targets/:id", async (req, res) => {
  const target = await prisma.target.delete({ where: { id: param(req) } });
  await logActivity("Deleted website", `${target.name} with its scans, findings and reports`);
  res.json({ ok: true });
});

/* ----------------------------------- Scans ----------------------------------- */

api.post("/targets/:id/scans", async (req, res) => {
  const { zap } = z.object({ zap: z.boolean().default(false) }).parse(req.body ?? {});
  const target = await prisma.target.findUnique({ where: { id: param(req) } });
  if (!target) fail(404, "Website not found.");
  checkUrl(target!.url); // the approved list may have changed since the website was added
  if (await prisma.scan.findFirst({ where: { targetId: target!.id, status: "running" } })) fail(409, "A scan of this website is already running.");
  const scan = await prisma.scan.create({ data: { targetId: target!.id } });
  await logActivity("Started scan", `${target!.name}${zap ? " with ZAP" : ""}`);
  // Runs in the background; the page polls GET /scans/:id for progress.
  void runScan(scan.id, target!, { zap }).catch((e) => console.error("[scan]", e));
  res.status(202).json(scan);
});

api.get("/scans/:id", async (req, res) => {
  const scan = await prisma.scan.findUnique({ where: { id: param(req) }, include: { target: { select: { id: true, name: true, url: true } } } });
  if (!scan) fail(404, "Scan not found.");
  // Every open issue on the website, so a repeat scan still lists what was found before. "scanId" marks the new ones.
  const findings = await prisma.finding.findMany({
    where: { targetId: scan!.targetId, status: { not: "rejected" } },
    select: { id: true, title: true, severity: true, status: true, source: true, category: true, affectedUrl: true, description: true, recommendation: true, scanId: true },
  });
  findings.sort((x, y) => SEVERITY_ORDER.indexOf(x.severity) - SEVERITY_ORDER.indexOf(y.severity));
  res.json({ ...scan, steps: JSON.parse(scan!.steps), recon: JSON.parse(scan!.recon), aiSummary: scan!.aiSummary ? JSON.parse(scan!.aiSummary) : null, findings });
});

api.post("/scans/:id/ai", async (req, res) => {
  const scan = await prisma.scan.findUnique({ where: { id: param(req) }, include: { target: true, findings: true } });
  if (!scan) fail(404, "Scan not found.");
  if (scan!.status === "running") fail(409, "Wait for the scan to finish.");
  const steps = JSON.parse(scan!.steps) as { label: string; status: string; summary: string }[];
  const result = await interpretScan(scan!.target.url, steps.map((s) => ({ tool: s.label, status: s.status, summary: s.summary })), scan!.findings);
  await prisma.scan.update({ where: { id: scan!.id }, data: { aiSummary: JSON.stringify(result) } });
  await logActivity("AI interpreted scan", scan!.target.name);
  res.json(result);
});

/* ---------------------------------- Findings --------------------------------- */

api.get("/findings", async (req, res) => {
  const q = z.object({ status: z.string().optional(), severity: z.string().optional(), targetId: z.string().optional() }).parse(req.query);
  const findings = await prisma.finding.findMany({
    where: { status: q.status || undefined, severity: q.severity || undefined, targetId: q.targetId || undefined },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, severity: true, status: true, category: true, source: true, affectedUrl: true, createdAt: true, target: { select: { id: true, name: true } } },
  });
  res.json(findings);
});

api.get("/findings/:id", async (req, res) => {
  const f = await prisma.finding.findUnique({ where: { id: param(req) }, include: { target: { select: { id: true, name: true, url: true } } } });
  if (!f) fail(404, "Finding not found.");
  res.json({ ...f, aiAnalysis: f!.aiAnalysis ? JSON.parse(f!.aiAnalysis) : null });
});

api.post("/findings", async (req, res) => {
  const body = z
    .object({
      targetId: z.string(),
      title: z.string().trim().min(3).max(200),
      category: z.enum(["config_https", "auth", "session", "exposed_files", "info_disclosure", "other"]),
      severity: z.enum(["critical", "high", "medium", "low", "info"]),
      affectedUrl: z.string().trim().min(1).max(500),
      description: z.string().trim().min(5).max(5000),
      evidence: z.string().trim().min(3).max(10000),
      recommendation: z.string().trim().max(5000).default(""),
    })
    .parse(req.body);
  if (!(await prisma.target.findUnique({ where: { id: body.targetId } }))) fail(404, "Website not found.");
  const f = await prisma.finding.create({ data: { ...body, source: "manual" } }).catch(() => fail(409, "This website already has a finding with that title and URL."));
  await logActivity("Added finding by hand", body.title);
  res.status(201).json(f);
});

/** 07 Risk assessment: likelihood x impact gives the severity. */
const LEVEL = { low: 1, medium: 2, high: 3 } as const;
export function riskSeverity(likelihood: keyof typeof LEVEL, impact: keyof typeof LEVEL) {
  const score = LEVEL[likelihood] * LEVEL[impact];
  return score >= 9 ? "critical" : score >= 6 ? "high" : score >= 3 ? "medium" : score >= 2 ? "low" : "info";
}

/** 06 Findings verification: only a person can confirm or reject. */
api.post("/findings/:id/verify", async (req, res) => {
  const body = z
    .object({
      decision: z.enum(["confirmed", "rejected", "unverified"]),
      likelihood: z.enum(["low", "medium", "high"]).optional(),
      impact: z.enum(["low", "medium", "high"]).optional(),
      note: z.string().trim().max(2000).default(""),
    })
    .parse(req.body);
  if (body.decision === "confirmed" && (!body.likelihood || !body.impact)) fail(400, "Rate the likelihood and impact before confirming.");
  if (body.decision !== "unverified" && body.note.length < 5) fail(400, "Write a short note on how you checked it (at least 5 characters).");
  const f = await prisma.finding.update({
    where: { id: param(req) },
    data:
      body.decision === "unverified"
        ? { status: "unverified", likelihood: null, impact: null, verifierNote: "", verifiedAt: null }
        : {
            status: body.decision,
            likelihood: body.likelihood ?? null,
            impact: body.impact ?? null,
            ...(body.decision === "confirmed" ? { severity: riskSeverity(body.likelihood!, body.impact!) } : {}),
            verifierNote: body.note,
            verifiedAt: new Date(),
          },
  });
  await logActivity(body.decision === "unverified" ? "Reopened finding" : body.decision === "confirmed" ? "Confirmed finding" : "Rejected finding", `${f.title}${body.decision === "confirmed" ? ` (${f.severity})` : ""}`);
  res.json(f);
});

api.post("/findings/:id/ai", async (req, res) => {
  const f = await prisma.finding.findUnique({ where: { id: param(req) }, include: { target: true } });
  if (!f) fail(404, "Finding not found.");
  const result = await explainFinding(f!.target.url, f!);
  await prisma.finding.update({ where: { id: f!.id }, data: { aiAnalysis: JSON.stringify(result) } });
  await logActivity("AI explained finding", f!.title);
  res.json(result);
});

/* ---------------------------------- Reports ---------------------------------- */

api.get("/reports", async (_req, res) => {
  res.json(await prisma.report.findMany({ orderBy: { createdAt: "desc" }, include: { target: { select: { name: true, url: true } } } }));
});

api.post("/reports", async (req, res) => {
  const body = z.object({ targetId: z.string(), title: z.string().trim().min(3).max(150) }).parse(req.body);
  if (!(await prisma.target.findUnique({ where: { id: body.targetId } }))) fail(404, "Website not found.");
  const report = await prisma.report.create({ data: { ...body} });
  await logActivity("Created report", body.title);
  res.status(201).json(report);
});

api.get("/reports/:id", async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: param(req) }, include: { target: true } });
  if (!report) fail(404, "Report not found.");
  const [findings, scans] = await Promise.all([
    prisma.finding.findMany({ where: { targetId: report!.targetId } }),
    prisma.scan.findMany({ where: { targetId: report!.targetId }, orderBy: { startedAt: "asc" }, select: { startedAt: true, status: true, steps: true } }),
  ]);
  const confirmed = findings.filter((f) => f.status === "confirmed").sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)).map((f) => ({ ...f, aiAnalysis: undefined }));
  const tools = [...new Set(scans.flatMap((s) => (JSON.parse(s.steps) as { label: string; status: string }[]).filter((x) => x.status === "done").map((x) => x.label)))];
  res.json({
    ...report,
    confirmed,
    pending: findings.filter((f) => f.status === "unverified").length,
    rejected: findings.filter((f) => f.status === "rejected").length,
    scans: scans.map((s) => ({ startedAt: s.startedAt, status: s.status })),
    tools,
  });
});

api.patch("/reports/:id", async (req, res) => {
  const body = z.object({ title: z.string().trim().min(3).max(150).optional(), summary: z.string().max(8000).optional() }).parse(req.body);
  res.json(await prisma.report.update({ where: { id: param(req) }, data: body }));
});

api.post("/reports/:id/ai-summary", async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: param(req) }, include: { target: { include: { findings: true } } } });
  if (!report) fail(404, "Report not found.");
  const fs = report!.target.findings;
  const summary = await draftSummary(report!.target.name, report!.target.url, fs.filter((f) => f.status === "confirmed"), fs.filter((f) => f.status === "unverified").length, fs.filter((f) => f.status === "rejected").length);
  await logActivity("AI drafted report summary", report!.title);
  res.json({ summary });
});

api.delete("/reports/:id", async (req, res) => {
  const r = await prisma.report.delete({ where: { id: param(req) } });
  await logActivity("Deleted report", r.title);
  res.json({ ok: true });
});

/* ----------------------------- Activity and AI log ---------------------------- */

api.get("/activity", async (_req, res) => {
  const [activity, aiLogs] = await Promise.all([
    prisma.activity.findMany({ take: 200, orderBy: { createdAt: "desc" } }),
    prisma.aiLog.findMany({ take: 50, orderBy: { createdAt: "desc" } }),
  ]);
  res.json({ activity, aiLogs });
});

api.get("/settings", (_req, res) => {
  res.json({
    allowedHosts: env.allowedHosts,
    ai: { model: env.ai.model, baseUrl: env.ai.baseUrl, local: /127\.0\.0\.1|localhost/.test(env.ai.baseUrl) },
    nmap: env.nmapPath === "nmap" || existsSync(env.nmapPath),
    zap: !!env.zapPath && existsSync(env.zapPath),
  });
});
