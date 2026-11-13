/** Reconnaissance: DNS records for the website's host name (Node's built-in DNS resolver). */
import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import type { StepResult } from "./common.ts";

export async function dnsLookup(url: string): Promise<StepResult> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return { summary: `${host} is an IP address, so there are no DNS records to look up.`, output: "", findings: [], recon: { dns: { host, addresses: [host] } } };

  const safe = async <T>(p: Promise<T>): Promise<T | []> => p.catch(() => [] as []);
  const [addresses, cname, mx, txt, ns] = await Promise.all([
    safe(dns.lookup(host, { all: true }).then((r) => r.map((a) => a.address))),
    safe(dns.resolveCname(host)),
    safe(dns.resolveMx(host).then((r) => r.map((m) => `${m.exchange} (priority ${m.priority})`))),
    safe(dns.resolveTxt(host).then((r) => r.map((t) => t.join("")))),
    safe(dns.resolveNs(host)),
  ]);
  const records = { host, addresses, cname, mx, txt, ns };
  const output = Object.entries(records).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") || "none" : v}`).join("\n");
  return { summary: `${host} resolves to ${addresses.length ? addresses.join(", ") : "no address"}${cname.length ? ` (alias of ${cname.join(", ")})` : ""}.`, output, findings: [], recon: { dns: records } };
}
