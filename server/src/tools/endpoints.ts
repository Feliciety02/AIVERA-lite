/**
 * Reconnaissance: finds the website's pages and endpoints without crawling.
 * Reads the home page links, robots.txt and sitemap.xml (three GET requests).
 */
import { isExcluded, isLocal, safeGet, type NewFinding, type StepResult } from "./common.ts";

const COMMON: { path: string; debug?: RegExp }[] = [
  { path: "/login" }, { path: "/register" }, { path: "/admin" }, { path: "/dashboard" }, { path: "/api" }, { path: "/api/user" },
  { path: "/graphql" }, { path: "/swagger" }, { path: "/api/documentation" }, { path: "/server-status", debug: /Apache Server Status/i },
  { path: "/telescope", debug: /telescope/i }, { path: "/horizon", debug: /horizon/i }, { path: "/_debugbar/open", debug: /^\s*[[{]/ },
  { path: "/_profiler", debug: /profiler/i }, { path: "/actuator/env", debug: /propertySources/i },
];

export async function discoverEndpoints(url: string, outOfScope: string): Promise<StepResult> {
  const base = new URL(url);
  const found = new Set<string>();
  const notes: string[] = [];
  const findings: NewFinding[] = [];
  const add = (href: string) => {
    try {
      const u = new URL(href, base);
      // Pages and API paths only: images, styles, scripts and fonts are not endpoints.
      const asset = /\.(?:js|mjs|css|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot)$/i.test(u.pathname);
      if (u.origin === base.origin && !asset && !isExcluded(u.pathname, outOfScope)) found.add(u.pathname + u.search);
    } catch { /* not a link */ }
  };

  const home = await safeGet(base.href);
  notes.push(`GET ${base.href} -> ${home.status}`);
  for (const m of home.body.matchAll(/(?:href|src|action)\s*=\s*["']([^"'#]+)["']/gi)) add(m[1]!);
  const forms = [...home.body.matchAll(/<form\b[^>]*>/gi)].length;

  const robotsUrl = new URL("/robots.txt", base).href;
  const robots = await safeGet(robotsUrl).catch(() => null);
  const disallowed: string[] = [];
  if (robots && robots.status === 200 && !/<html/i.test(robots.body)) {
    notes.push(`GET ${robotsUrl} -> 200`);
    for (const m of robots.body.matchAll(/^\s*(dis)?allow:\s*(\S+)/gim)) {
      add(m[2]!);
      if (m[1]) disallowed.push(m[2]!);
    }
    for (const m of robots.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)) add(m[1]!);
  } else notes.push(`GET ${robotsUrl} -> ${robots?.status ?? "no answer"}`);

  const sitemapUrl = new URL("/sitemap.xml", base).href;
  const sitemap = await safeGet(sitemapUrl).catch(() => null);
  if (sitemap && sitemap.status === 200 && /<urlset|<sitemapindex/i.test(sitemap.body)) {
    notes.push(`GET ${sitemapUrl} -> 200`);
    for (const m of [...sitemap.body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].slice(0, 200)) add(m[1]!);
  } else notes.push(`GET ${sitemapUrl} -> ${sitemap?.status ?? "no answer"}`);

  // Single-page apps have almost no links in their HTML, so on a copy on this computer a short
  // list of common paths is also tried. Debug tools that answer without sign-in are reported.
  if (isLocal(url)) {
    // Many apps answer every unknown path with the same page. A made-up path shows what "not found" looks like.
    const baseline = await safeGet(new URL(`/aivera-lite-none-${Date.now().toString(36)}`, base).href, 15_000).catch(() => null);
    const sameAsMissing = (r: { status: number; body: string }) => !!baseline && r.status === baseline.status && Math.abs(r.body.length - baseline.body.length) < 100;
    for (const p of COMMON) {
      if (isExcluded(p.path, outOfScope)) continue;
      const r = await safeGet(new URL(p.path, base).href, 15_000).catch(() => null);
      if (!r) continue;
      notes.push(`GET ${p.path} -> ${r.status}`);
      if (sameAsMissing(r) || r.status === 404) continue;
      if ([200, 401, 403, 405].includes(r.status) || (r.status >= 300 && r.status < 400)) found.add(p.path);
      if (p.debug && r.status === 200 && p.debug.test(r.body))
        findings.push({ title: `Debug tool reachable without sign-in: ${p.path}`, category: "info_disclosure", severity: "medium", source: "Endpoint discovery", affectedUrl: new URL(p.path, base).href, description: "A developer debugging tool answers without sign-in. These tools show requests, queries, settings and sometimes user data.", evidence: `HTTP 200\n${r.body.slice(0, 200).replace(/\s+/g, " ")}`, recommendation: "Turn the tool off outside development, or protect it with sign-in." });
    }
  }

  const interesting = disallowed.filter((p) => /admin|backup|config|private|internal|api|debug|test|dev/i.test(p));
  if (interesting.length)
    findings.push({
      title: "robots.txt points to sensitive-looking paths",
      category: "info_disclosure",
      severity: "info",
      source: "Endpoint discovery",
      affectedUrl: robotsUrl,
      description: "robots.txt is public. Paths listed there are hidden from search engines but tell anyone where admin or internal areas may be.",
      evidence: interesting.map((p) => `Disallow: ${p}`).join("\n"),
      recommendation: "Do not rely on robots.txt to hide areas. Protect them with sign-in and access control, and remove entries that are not needed.",
    });

  const endpoints = [...found].sort().slice(0, 300);
  return {
    summary: `Found ${endpoints.length} same-site paths and ${forms} form(s) on the home page.`,
    output: [...notes, "", ...endpoints].join("\n"),
    findings,
    recon: { endpoints, forms },
  };
}
