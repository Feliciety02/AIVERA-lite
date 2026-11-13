/**
 * Scanning with OWASP ZAP in passive mode: ZAP crawls the site for one minute and reports what
 * it sees in the responses. It does not send attack payloads, so it is safe for hosted sites.
 * Runs the locally installed ZAP with a plan file: java -jar zap-<version>.jar -cmd -autorun plan.yaml
 */
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "../env.ts";
import { runProgram, type Category, type NewFinding, type Severity, type StepResult } from "./common.ts";

const RISK: Record<string, Severity> = { "0": "info", "1": "low", "2": "medium", "3": "high" };
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function plan(url: string, outOfScope: string, reportDir: string): string {
  const origin = new URL(url).origin;
  const excludes = outOfScope.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((p) => `^${escapeRegex(origin)}${escapeRegex(p.replace(/\*$/, ""))}.*$`);
  const q = (s: string) => JSON.stringify(s);
  return `env:
  contexts:
    - name: target
      urls:
        - ${q(url)}
      includePaths:
        - ${q(`^${escapeRegex(origin)}/.*$`)}
      excludePaths:${excludes.length ? `\n${excludes.map((e) => `        - ${q(e)}`).join("\n")}` : " []"}
  parameters:
    failOnError: true
    failOnWarning: false
jobs:
  - type: spider
    parameters:
      context: target
      maxDuration: 1
      maxDepth: 5
      maxChildren: 20
      threadCount: 1
  - type: passiveScan-wait
  - type: report
    parameters:
      template: traditional-json
      reportDir: ${q(reportDir)}
      reportFile: report.json
`;
}

function category(name: string, cwe: string): Category {
  if (/cookie|session/i.test(name)) return "session";
  if (/disclosure|version|debug|comment|error|timestamp|private ip/i.test(name) || cwe === "200" || cwe === "497") return "info_disclosure";
  if (/header|csp|https|hsts|ssl|tls|frame|content-type|cors|cache/i.test(name)) return "config_https";
  if (/backup|directory|hidden file|\.git|\.env/i.test(name)) return "exposed_files";
  return "other";
}

interface ZapAlert { name?: string; alert?: string; riskcode?: string; cweid?: string; desc?: string; solution?: string; instances?: { uri?: string; method?: string; param?: string; evidence?: string }[] }

/** ZAP rules that check the same thing as the web checks step, so they would only add duplicates. */
const COVERED_BY_WEB_CHECKS = new Set(["10038", "10020", "10021", "10035", "10036", "10037"]);

export function zapFindings(json: string): NewFinding[] {
  const sites = (JSON.parse(json) as { site?: { alerts?: (ZapAlert & { pluginid?: string })[] }[] }).site ?? [];
  return sites.flatMap((s) =>
    (s.alerts ?? []).filter((a) => !COVERED_BY_WEB_CHECKS.has(String(a.pluginid))).map((a) => {
      const name = (a.name ?? a.alert ?? "ZAP alert").replace(/ - /g, ": ");
      const first = a.instances?.[0];
      const more = (a.instances?.length ?? 0) - 1;
      return {
        title: name,
        category: category(name, String(a.cweid ?? "")),
        severity: RISK[String(a.riskcode)] ?? "info",
        source: "OWASP ZAP",
        affectedUrl: first?.uri ?? "",
        description: stripHtml(a.desc ?? ""),
        evidence: [first ? `${first.method ?? "GET"} ${first.uri}${first.param ? ` (parameter ${first.param})` : ""}` : "", first?.evidence ? `Evidence: ${first.evidence}` : "", more > 0 ? `Also seen on ${more} other URL(s).` : ""].filter(Boolean).join("\n"),
        recommendation: stripHtml(a.solution ?? ""),
      };
    }),
  );
}

export async function zapScan(url: string, outOfScope: string): Promise<StepResult> {
  if (!env.zapPath) throw new Error("ZAP is not set up. Put the ZAP install folder in ZAP_PATH in server/.env.");
  const jar = (await readdir(env.zapPath)).find((f) => /^zap-[\d.]+\.jar$/i.test(f));
  if (!jar) throw new Error(`No zap-<version>.jar in ${env.zapPath}.`);
  const bundled = join(env.zapPath, "jre", "bin", process.platform === "win32" ? "java.exe" : "java");
  const java = env.javaPath || (existsSync(bundled) ? bundled : "java");
  const dir = await mkdtemp(join(tmpdir(), "aivera-lite-zap-"));
  try {
    await writeFile(join(dir, "plan.yaml"), plan(url, outOfScope, dir.replace(/\\/g, "/")), "utf8");
    await runProgram(java, ["-Xmx1g", "-jar", join(env.zapPath, jar), "-cmd", "-dir", join(dir, "home"), "-autorun", join(dir, "plan.yaml")], 10 * 60_000, [0, 1, 2], env.zapPath);
    const report = await readFile(join(dir, "report.json"), "utf8");
    const findings = zapFindings(report);
    const total = ((JSON.parse(report) as { site?: { alerts?: unknown[] }[] }).site ?? []).reduce((n, s) => n + (s.alerts?.length ?? 0), 0);
    return { summary: `ZAP passive scan raised ${total} alert type(s)${total > findings.length ? `, ${total - findings.length} already covered by the web checks` : ""}.`, output: report, findings };
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 }).catch(() => undefined);
  }
}
