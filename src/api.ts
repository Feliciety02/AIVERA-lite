/** Small wrapper around fetch for the /api server, plus the shapes it returns. */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Status = "unverified" | "confirmed" | "rejected";
export type Level = "low" | "medium" | "high";

export interface Website {
  id: string;
  name: string;
  url: string;
  approval: string;
  outOfScope: string;
  createdAt: string;
  scanCount: number;
  findingCount: number;
  confirmed: number;
  toReview: number;
  lastScan: { status: string; startedAt: string } | null;
}

export interface FindingRow { id: string; title: string; severity: Severity; status: Status; category: string; source: string; affectedUrl: string; createdAt?: string; target?: { id: string; name: string } }

export interface WebsiteDetail extends Omit<Website, "scanCount" | "findingCount" | "confirmed" | "toReview" | "lastScan"> {
  isLocal: boolean;
  scans: { id: string; status: string; startedAt: string; finishedAt: string | null; steps: { label: string; status: string }[] }[];
  findings: FindingRow[];
  reports: { id: string; title: string; createdAt: string }[];
}

export interface Step { tool: string; label: string; status: "waiting" | "running" | "done" | "failed" | "skipped"; summary: string; output: string }

export interface ScanInterpretation { overview: string; priorities: { title: string; why: string }[]; falsePositives: string[]; nextSteps: string[]; model: string; generatedAt: string }

export interface Scan {
  id: string;
  status: "running" | "done" | "failed";
  startedAt: string;
  finishedAt: string | null;
  steps: Step[];
  recon: { dns?: { host: string; addresses: string[]; cname: string[]; mx: string[]; ns: string[]; txt: string[] }; ports?: { port: number; service: string; version: string }[]; endpoints?: string[]; forms?: number };
  aiSummary: ScanInterpretation | null;
  target: { id: string; name: string; url: string };
  findings: (FindingRow & { description: string; recommendation: string; scanId: string | null })[];
}

export interface FindingAi { explanation: string; impact: string; suggestedSeverity: string; severityReason: string; verifySteps: string[]; fixSteps: string[]; confidence: string; model: string; generatedAt: string }

export interface Finding extends FindingRow {
  description: string;
  evidence: string;
  recommendation: string;
  likelihood: Level | null;
  impact: Level | null;
  verifierNote: string;
  verifiedAt: string | null;
  aiAnalysis: FindingAi | null;
  target: { id: string; name: string; url: string };
}

export interface ReportListItem { id: string; title: string; createdAt: string; target: { name: string; url: string } }

export interface ReportFull {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  target: { id: string; name: string; url: string; approval: string; outOfScope: string };
  confirmed: (Finding & { verifiedAt: string })[];
  pending: number;
  rejected: number;
  scans: { startedAt: string; status: string }[];
  tools: string[];
}

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

export const CATEGORY: Record<string, string> = {
  config_https: "Security configuration and HTTPS",
  auth: "Authentication and login security",
  session: "Session management",
  exposed_files: "Exposed files and directories",
  info_disclosure: "Information disclosure",
  other: "Other",
};

export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");
