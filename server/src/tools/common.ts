/** Shared pieces for the scanning tools: the finding shape, scope rules and a safe HTTP request. */
import { spawn } from "node:child_process";
import { env } from "../env.ts";
import { fail } from "../http.ts";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Category = "config_https" | "auth" | "session" | "exposed_files" | "info_disclosure" | "other";

export interface NewFinding {
  title: string;
  category: Category;
  severity: Severity;
  source: string;
  affectedUrl: string;
  description: string;
  evidence: string;
  recommendation: string;
}

export interface StepResult {
  summary: string;
  output: string; // raw tool output, kept as evidence
  findings: NewFinding[];
  recon?: Record<string, unknown>;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** A copy running on this computer. Port scans and file probes are only allowed here. */
export const isLocal = (url: string) => LOOPBACK.has(new URL(url).hostname.toLowerCase());

/** Checks a pasted link before it is saved or scanned. Returns the cleaned URL. */
export function checkUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return fail(400, "That is not a valid link. Include http:// or https://");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") fail(400, "Only http:// and https:// links can be scanned.");
  if (u.username || u.password) fail(400, "Remove the user name and password from the link.");
  const host = u.hostname.toLowerCase();
  if (env.allowedHosts.length && !env.allowedHosts.includes(host))
    fail(403, `${host} is not on the list of approved websites. An administrator adds approved sites to ALLOWED_HOSTS in server/.env.`);
  u.hash = "";
  return u.href;
}

/** True when a path matches one of the out-of-scope lines (exact path, or a prefix ending in *). */
export function isExcluded(path: string, outOfScope: string): boolean {
  return outOfScope
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .some((rule) => (rule.endsWith("*") ? path.startsWith(rule.slice(0, -1)) : path === rule || path.startsWith(`${rule.replace(/\/$/, "")}/`)));
}

export interface Fetched { url: string; status: number; headers: Record<string, string>; setCookies: string[]; body: string }

/** One GET request that does not follow redirects and reads at most 300 KB of the body. */
export async function safeGet(url: string, timeoutMs = 60_000): Promise<Fetched> {
  const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": "AIVERA-Lite/1.0 (authorized security assessment)" }, signal: AbortSignal.timeout(timeoutMs) });
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => { if (k !== "set-cookie") headers[k] = v; });
  let body = "";
  if (res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (body.length < 300_000) {
      const { done, value } = await reader.read();
      if (done) break;
      body += decoder.decode(value, { stream: true });
    }
    await reader.cancel().catch(() => undefined);
  }
  return { url, status: res.status, headers, setCookies: res.headers.getSetCookie(), body };
}

/** Runs a program without a shell, with a time limit and an output limit. */
export function runProgram(command: string, args: string[], timeoutMs: number, okCodes = [0], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], cwd });
    let out = "";
    let err = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${command} took too long and was stopped.`)); }, timeoutMs);
    child.stdout.on("data", (b: Buffer) => { out += b.toString("utf8"); if (out.length > 5_000_000) child.kill(); });
    child.stderr.on("data", (b: Buffer) => { err = (err + b.toString("utf8")).slice(-2000); });
    child.on("error", (e) => { clearTimeout(timer); reject(new Error(`${command} could not start: ${e.message}`)); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (okCodes.includes(code ?? -1)) resolve(out);
      else reject(new Error(`${command} stopped with code ${code}. ${err.slice(-400)}`));
    });
  });
}
