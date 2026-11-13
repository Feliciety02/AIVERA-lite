/**
 * Authentication and login security: finds login forms and reads how they are built.
 * Passive only. It loads the pages with GET and never submits a form or tries a password.
 * Things that need a real sign-in attempt (lockout, error messages) become a manual test checklist.
 */
import { isExcluded, isLocal, safeGet, type NewFinding, type StepResult } from "./common.ts";

const LOGIN_PATH = /log-?in|sign-?in|auth|account|admin/i;
const TOKEN_NAME = /csrf|xsrf|_token|authenticity_token|__requestverificationtoken|nonce/i;

interface Form { html: string; action: string; method: string; inputs: { type: string; name: string; autocomplete: string }[] }

function parseForms(body: string): Form[] {
  return [...body.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].map((m) => {
    const attr = (s: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(s)?.[1] ?? "";
    const inputs = [...m[2]!.matchAll(/<input\b([^>]*)>/gi)].map((i) => ({ type: (attr(i[1]!, "type") || "text").toLowerCase(), name: attr(i[1]!, "name"), autocomplete: attr(i[1]!, "autocomplete").toLowerCase() }));
    return { html: m[0].slice(0, 600), action: attr(m[1]!, "action"), method: (attr(m[1]!, "method") || "get").toLowerCase(), inputs };
  });
}

export async function loginChecks(url: string, outOfScope: string, recon: Record<string, unknown>): Promise<StepResult> {
  const base = new URL(url);
  const endpoints = (recon.endpoints as string[] | undefined) ?? [];
  // The home page plus up to five pages that look like sign-in pages.
  const pages = ["/", ...endpoints.filter((p) => LOGIN_PATH.test(p) && !isExcluded(p, outOfScope))].filter((p, i, a) => a.indexOf(p) === i).slice(0, 6);
  const notes: string[] = [];
  const findings: NewFinding[] = [];
  let loginForms = 0;
  let signInPage: string | null = null; // a page like /login that answered, in case its form is built by JavaScript

  for (const path of pages) {
    const pageUrl = new URL(path, base).href;
    const res = await safeGet(pageUrl, 15_000).catch(() => null);
    notes.push(`GET ${pageUrl} -> ${res?.status ?? "no answer"}`);
    if (!res || res.status !== 200) continue;
    if (path !== "/" && /log-?in|sign-?in/i.test(path)) signInPage ??= pageUrl;

    for (const form of parseForms(res.body)) {
      const password = form.inputs.find((i) => i.type === "password");
      if (!password) continue;
      loginForms++;
      const target = form.action ? new URL(form.action, pageUrl) : new URL(pageUrl);
      const fields = form.inputs.filter((i) => i.type !== "hidden").map((i) => `${i.name || "(no name)"} [${i.type}]`).join(", ");
      const evidence = `Page: ${pageUrl}\nForm: method=${form.method.toUpperCase()} action=${target.href}\nFields: ${fields}\n\n${form.html}`;
      notes.push(`  login form: ${form.method.toUpperCase()} ${target.href} (${fields})`);

      if (form.method === "get")
        findings.push({ title: "Login form sends the password in the URL (GET)", category: "auth", severity: "high", source: "Login form checks", affectedUrl: pageUrl, description: "The sign-in form uses method GET, so the password becomes part of the address. It ends up in browser history, server logs and proxy logs.", evidence, recommendation: "Use method POST for every form that sends a password." });

      if (target.protocol === "http:" && !isLocal(target.href))
        findings.push({ title: "Login form is not protected by HTTPS", category: "auth", severity: "high", source: "Login form checks", affectedUrl: pageUrl, description: "The password is sent without encryption, so anyone on the same network can read it.", evidence, recommendation: "Serve the sign-in page and its form target over HTTPS only, and redirect HTTP to HTTPS." });

      if (form.method === "post" && !form.inputs.some((i) => i.type === "hidden" && TOKEN_NAME.test(i.name)))
        findings.push({ title: "No anti-CSRF token seen in the login form", category: "auth", severity: "low", source: "Login form checks", affectedUrl: pageUrl, description: "The form has no hidden token that proves the request came from this site. Some apps send the token in a header instead, so check the request in the browser developer tools before confirming.", evidence, recommendation: "Add a per-session CSRF token to every form that changes state, including sign-in." });

      findings.push(manualTests(pageUrl, evidence));
    }
  }

  if (!loginForms && signInPage)
    findings.push(manualTests(signInPage, `GET ${signInPage} -> 200\nNo <form> in the HTML: the page builds its sign-in form with JavaScript, so its fields could not be read automatically.`));

  return {
    summary: loginForms
      ? `Found ${loginForms} login form(s) on ${pages.length} page(s) checked.`
      : signInPage
        ? `${signInPage} answers but builds its form with JavaScript. Added a manual test checklist for it.`
        : `No login form found on ${pages.length} page(s) checked.`,
    output: notes.join("\n"),
    findings,
  };
}

/** The sign-in tests that need a real attempt are left to a person, with test accounts only. */
function manualTests(pageUrl: string, evidence: string): NewFinding {
  return {
    title: "Login form found: manual sign-in tests needed",
    category: "auth",
    severity: "info",
    source: "Login form checks",
    affectedUrl: pageUrl,
    description: "AIVERA Lite does not submit forms or try passwords. Test these by hand with a test account, then confirm or reject this finding and write what you saw in the note.",
    evidence,
    recommendation: [
      "1. Wrong password for a test account vs. an unknown email: are the error messages the same? (user enumeration)",
      "2. Ten wrong passwords in a row: is the account locked, slowed down or shown a CAPTCHA? (brute force)",
      "3. Can a weak password like 12345678 be set on sign-up or reset? (password policy)",
      "4. After signing out, do the Back button or an old session cookie still open private pages? (session ending)",
      "5. Does the session cookie change after sign-in? (session fixation)",
    ].join("\n"),
  };
}
