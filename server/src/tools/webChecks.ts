/**
 * Web application checks (like curl and browser developer tools, but automated).
 * Covers three assessment categories from the brief:
 *  - Security configuration and HTTPS: security headers, TLS certificate and versions
 *  - Session management: cookie flags
 *  - Information disclosure: version headers, debug error pages
 *  - Exposed files and directories: a short list of known files (only on a copy on this computer)
 * Only plain GET requests are sent. No attack payloads, nothing is changed on the site.
 */
import { connect, type SecureVersion } from "node:tls";
import { isExcluded, isLocal, safeGet, type Fetched, type NewFinding, type StepResult } from "./common.ts";

const SOURCE = "Web checks";
const OWASP_HEADERS = "https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html";

function tlsHandshake(host: string, port: number, version?: SecureVersion) {
  return new Promise<{ protocol: string | null; authorized: boolean; error?: string; validTo?: string; issuer?: string }>((resolve, reject) => {
    const socket = connect(
      { host, port, servername: /^[\d.]+$/.test(host) ? undefined : host, rejectUnauthorized: false, timeout: 15_000, minVersion: version, maxVersion: version, ciphers: version ? "DEFAULT@SECLEVEL=0" : undefined },
      () => {
        const cert = socket.getPeerCertificate();
        resolve({ protocol: socket.getProtocol(), authorized: socket.authorized, error: socket.authorizationError ? String(socket.authorizationError) : undefined, validTo: cert.valid_to, issuer: [cert.issuer?.O ?? cert.issuer?.CN].flat()[0] });
        socket.end();
      },
    );
    socket.on("timeout", () => { socket.destroy(); reject(new Error("timed out")); });
    socket.on("error", reject);
  });
}

function headerChecks(page: Fetched, https: boolean, local: boolean, add: (f: Omit<NewFinding, "source">) => void) {
  const h = page.headers;
  const url = page.url;
  if (!https && !local)
    add({ title: "Website does not use HTTPS", category: "config_https", severity: "high", affectedUrl: url, description: "The site is served over plain HTTP, so passwords and session cookies can be read or changed on the network.", evidence: `Scheme: ${new URL(url).protocol}`, recommendation: "Serve the whole site over HTTPS and redirect HTTP to HTTPS." });
  if (https && !h["strict-transport-security"])
    add({ title: "Strict-Transport-Security header missing", category: "config_https", severity: "low", affectedUrl: url, description: "Without HSTS a browser may still try plain HTTP first, which allows a downgrade on the first visit.", evidence: "Strict-Transport-Security: (not sent)", recommendation: "Send Strict-Transport-Security: max-age=31536000; includeSubDomains" });
  if (!h["content-security-policy"])
    add({ title: "Content-Security-Policy header missing", category: "config_https", severity: "medium", affectedUrl: url, description: "No Content Security Policy is sent, so the browser has no second line of defence if a script injection bug exists.", evidence: "Content-Security-Policy: (not sent)", recommendation: `Add a Content-Security-Policy that limits where scripts, styles and frames load from. See ${OWASP_HEADERS}` });
  if (!h["x-frame-options"] && !/frame-ancestors/i.test(h["content-security-policy"] ?? ""))
    add({ title: "Page can be shown inside another site (clickjacking)", category: "config_https", severity: "medium", affectedUrl: url, description: "Neither X-Frame-Options nor a CSP frame-ancestors rule is sent, so another site can load this page in a hidden frame and trick users into clicking.", evidence: "X-Frame-Options: (not sent)", recommendation: "Send X-Frame-Options: DENY or SAMEORIGIN, or CSP frame-ancestors 'self'." });
  if ((h["x-content-type-options"] ?? "").toLowerCase() !== "nosniff")
    add({ title: "X-Content-Type-Options header missing", category: "config_https", severity: "low", affectedUrl: url, description: "Without nosniff, a browser may guess a file's type and run it as script.", evidence: `X-Content-Type-Options: ${h["x-content-type-options"] ?? "(not sent)"}`, recommendation: "Send X-Content-Type-Options: nosniff" });
  for (const name of ["server", "x-powered-by"]) {
    const v = h[name];
    if (v && /\d/.test(v))
      add({ title: `${name === "server" ? "Server" : "X-Powered-By"} header shows the software version`, category: "info_disclosure", severity: "low", affectedUrl: url, description: "The response names the software and its version, which helps an attacker look up known vulnerabilities for it.", evidence: `${name}: ${v}`, recommendation: "Remove the version number from this header, or remove the header." });
  }
  for (const raw of page.setCookies) {
    const name = raw.split("=")[0]!.trim();
    const attrs = raw.toLowerCase();
    const sensitive = /session|token|auth|sid/i.test(name) && !/^(xsrf|csrf)/i.test(name);
    const missing = [https && !/;\s*secure/.test(attrs) ? "Secure" : "", sensitive && !/;\s*httponly/.test(attrs) ? "HttpOnly" : "", !/;\s*samesite=/.test(attrs) ? "SameSite" : ""].filter(Boolean);
    if (missing.length)
      add({ title: `Cookie "${name}" is missing ${missing.join(", ")}`, category: "session", severity: missing.includes("HttpOnly") || missing.includes("Secure") ? "medium" : "low", affectedUrl: url, description: "Cookie flags decide whether scripts can read a cookie, whether it is sent over plain HTTP, and whether other sites can send it.", evidence: `Set-Cookie: ${name}=[value hidden]${raw.includes(";") ? raw.slice(raw.indexOf(";")) : ""}`, recommendation: `Set ${missing.join(", ")} on the "${name}" cookie.` });
  }
}

/** A page that does not exist: a debug error page here shows framework details or stack traces. */
function errorPageChecks(page: Fetched, add: (f: Omit<NewFinding, "source">) => void) {
  const body = page.body;
  const signs: [RegExp, string][] = [
    [/Whoops|Ignition|vendor[\\/]laravel|Illuminate\\/i, "Laravel debug page"],
    [/Traceback \(most recent call last\)|Werkzeug Debugger/i, "Python debug traceback"],
    [/at [\w.$]+\([\w./\\-]+\.(?:js|ts):\d+:\d+\)/, "Node.js stack trace"],
    [/<b>(?:Fatal error|Warning|Notice)<\/b>:|Stack trace:\s*#0/i, "PHP error message"],
    [/Exception in thread|java\.lang\.\w+Exception/i, "Java exception"],
    [/SQLSTATE\[|You have an error in your SQL syntax/i, "Database error text"],
  ];
  const hit = signs.find(([re]) => re.test(body));
  if (hit) {
    const at = body.search(hit[0]);
    add({ title: "Error page shows debug details", category: "info_disclosure", severity: "medium", affectedUrl: page.url, description: `Requesting a page that does not exist returned a ${hit[1]}. Debug output can reveal file paths, framework versions, settings and sometimes secrets.`, evidence: `HTTP ${page.status}\n${body.slice(Math.max(0, at - 80), at + 220).replace(/\s+/g, " ").trim()}`, recommendation: "Turn debug mode off in production (for Laravel: APP_DEBUG=false) and show a plain error page." });
  }
}

/** Files that should never be downloadable. Checked only on a copy running on this computer. */
const EXPOSED: { path: string; looksReal: RegExp; what: string; severity: NewFinding["severity"] }[] = [
  { path: "/.env", looksReal: /^\s*[A-Z_]+=.*$/m, what: "environment file with settings and secrets", severity: "critical" },
  { path: "/.git/HEAD", looksReal: /^ref: refs\//, what: "Git repository (source code and history)", severity: "high" },
  { path: "/storage/logs/laravel.log", looksReal: /\[\d{4}-\d{2}-\d{2}/, what: "application log file", severity: "high" },
  { path: "/phpinfo.php", looksReal: /phpinfo\(\)|PHP Version/i, what: "phpinfo page with server configuration", severity: "medium" },
  { path: "/composer.json", looksReal: /"require"\s*:/, what: "dependency list with exact package names", severity: "low" },
  { path: "/package.json", looksReal: /"dependencies"\s*:/, what: "dependency list with exact package names", severity: "low" },
  { path: "/.DS_Store", looksReal: /Bud1/, what: "macOS folder listing file", severity: "low" },
  { path: "/backup.zip", looksReal: /^PK/, what: "backup archive", severity: "high" },
  { path: "/database.sql", looksReal: /CREATE TABLE|INSERT INTO/i, what: "database dump", severity: "critical" },
];

export async function webChecks(url: string, outOfScope: string): Promise<StepResult> {
  const u = new URL(url);
  const https = u.protocol === "https:";
  const local = isLocal(url);
  const findings: NewFinding[] = [];
  const add = (f: Omit<NewFinding, "source">) => findings.push({ ...f, source: SOURCE });
  const log: string[] = [];

  // 1. Home page: headers and cookies.
  const home = await safeGet(u.href);
  log.push(`GET ${u.href} -> ${home.status}`, ...Object.entries(home.headers).map(([k, v]) => `  ${k}: ${v}`), ...home.setCookies.map((c) => `  set-cookie: ${c.replace(/=[^;]*/, "=[value hidden]")}`));
  headerChecks(home, https, local, add);

  // 2. A page that does not exist: debug output?
  const missing = new URL(`/aivera-lite-check-${Date.now().toString(36)}`, u).href;
  const notFound = await safeGet(missing).catch(() => null);
  if (notFound) {
    log.push(`GET ${missing} -> ${notFound.status}`);
    errorPageChecks(notFound, add);
  }

  // 3. TLS certificate and old protocol versions.
  if (https) {
    const host = u.hostname;
    const port = Number(u.port || 443);
    try {
      const t = await tlsHandshake(host, port);
      log.push(`TLS ${t.protocol}, trusted: ${t.authorized}, issuer: ${t.issuer ?? "?"}, valid to: ${t.validTo ?? "?"}`);
      if (!t.authorized) add({ title: "TLS certificate is not trusted", category: "config_https", severity: "high", affectedUrl: u.origin, description: `Browsers will show a warning. Reason: ${t.error ?? "unknown"}.`, evidence: `Issuer: ${t.issuer ?? "?"}`, recommendation: "Install a certificate from a trusted authority that matches the host name." });
      const days = t.validTo ? Math.floor((new Date(t.validTo).getTime() - Date.now()) / 86_400_000) : undefined;
      if (days !== undefined && days < 14) add({ title: days < 0 ? "TLS certificate has expired" : "TLS certificate expires within 14 days", category: "config_https", severity: days < 0 ? "high" : "medium", affectedUrl: u.origin, description: `The certificate is valid until ${t.validTo}.`, evidence: `valid to: ${t.validTo}`, recommendation: "Renew the certificate and turn on automatic renewal." });
    } catch (e) {
      log.push(`TLS handshake failed: ${(e as Error).message}`);
    }
    for (const v of ["TLSv1", "TLSv1.1"] as SecureVersion[]) {
      const accepted = await tlsHandshake(host, port, v).then(() => true, () => false);
      log.push(`${v} accepted: ${accepted}`);
      if (accepted) add({ title: `Server accepts old protocol ${v.replace("TLSv", "TLS ")}`, category: "config_https", severity: "medium", affectedUrl: u.origin, description: "TLS 1.0 and 1.1 are retired (RFC 8996) and have known weaknesses.", evidence: `${v} handshake accepted`, recommendation: "Allow only TLS 1.2 and TLS 1.3." });
    }
  }

  // 4. Exposed files, only on a copy on this computer.
  let probed = 0;
  if (local) {
    for (const f of EXPOSED) {
      if (isExcluded(f.path, outOfScope)) continue;
      const target = new URL(f.path, u).href;
      const r = await safeGet(target, 15_000).catch(() => null);
      probed++;
      log.push(`GET ${target} -> ${r?.status ?? "no answer"}`);
      if (r && r.status === 200 && f.looksReal.test(r.body)) {
        const firstLine = r.body.split(/\r?\n/).find((l) => l.trim()) ?? "";
        // Never keep secret values: only the setting name is stored.
        const evidence = f.path === "/.env" ? r.body.split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).slice(0, 8).map((l) => `${l.split("=")[0]}=[value hidden]`).join("\n") : firstLine.slice(0, 160);
        add({ title: `Exposed file: ${f.path}`, category: "exposed_files", severity: f.severity, affectedUrl: target, description: `Anyone can download the ${f.what}.`, evidence: `HTTP 200, ${r.body.length} bytes\n${evidence}`, recommendation: "Block this path in the web server, or move the file outside the public folder." });
      }
    }
  } else log.push("Exposed file checks skipped: they only run on a copy on this computer.");

  return {
    summary: `${findings.length} issue(s) from headers, cookies, error page${https ? ", TLS" : ""}${local ? ` and ${probed} file checks` : ""}.`,
    output: log.join("\n"),
    findings,
  };
}
