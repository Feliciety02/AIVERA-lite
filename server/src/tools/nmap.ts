/**
 * Reconnaissance: open ports and services with Nmap (TCP connect scan, top 100 ports).
 * Only runs against a copy on this computer: port scanning a hosted site is not allowed.
 */
import { XMLParser } from "fast-xml-parser";
import { env } from "../env.ts";
import { runProgram, type NewFinding, type StepResult } from "./common.ts";

type Node = Record<string, unknown>;
const list = (v: unknown): Node[] => (Array.isArray(v) ? (v as Node[]) : v ? [v as Node] : []);
const attr = (n: unknown, k: string) => ((n as Node | undefined)?.[`@_${k}`] as string | undefined) ?? "";

export interface Port { port: number; state: string; service: string; version: string }

export function parseNmapXml(xml: string): Port[] {
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: false }).parse(xml) as Node;
  const host = list((doc.nmaprun as Node | undefined)?.host)[0];
  return list((host?.ports as Node | undefined)?.port).map((p) => {
    const svc = p.service as Node | undefined;
    return { port: Number(attr(p, "portid")), state: attr(p.state, "state"), service: attr(svc, "name") || "unknown", version: [attr(svc, "product"), attr(svc, "version")].filter(Boolean).join(" ") };
  });
}

/** Services that should normally not be reachable on a web server. */
const RISKY: Record<number, string> = { 21: "FTP", 23: "Telnet", 3306: "MySQL", 5432: "PostgreSQL", 6379: "Redis", 27017: "MongoDB", 11211: "Memcached", 9200: "Elasticsearch" };

export async function nmapScan(url: string): Promise<StepResult> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  const xml = await runProgram(env.nmapPath, ["-sT", "-sV", "--version-light", "-Pn", "--top-ports", "100", "--max-retries", "1", "--host-timeout", "5m", "-oX", "-", "--", host], 6 * 60_000);
  const ports = parseNmapXml(xml).filter((p) => p.state === "open");
  const findings: NewFinding[] = ports
    .filter((p) => RISKY[p.port])
    .map((p) => ({
      title: `${RISKY[p.port]} port ${p.port} is open`,
      category: "config_https" as const,
      severity: "medium" as const,
      source: "Nmap",
      affectedUrl: `${host}:${p.port}`,
      description: `${RISKY[p.port]} is reachable on ${host}. Database and admin services should only listen on the internal network, not where users can reach them.`,
      evidence: `${p.port}/tcp open ${p.service} ${p.version}`.trim(),
      recommendation: "Bind the service to an internal address, or block the port with a firewall.",
    }));
  return {
    summary: ports.length ? `${ports.length} open port(s): ${ports.map((p) => `${p.port} (${p.service})`).join(", ")}.` : "No open ports among the top 100.",
    output: xml,
    findings,
    recon: { ports },
  };
}
