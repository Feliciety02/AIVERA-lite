/**
 * Removes secrets and personal data from text before it is sent to an AI service.
 * The brief forbids exposing credentials or confidential information to public AI services.
 * It prefers hiding a harmless value over leaking a real one.
 */
const RULES: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]"],
  [/((?:authorization|cookie|set-cookie|x-api-key|x-auth-token)\s*:\s*)[^\r\n]+/gi, "$1[REDACTED]"],
  [/\b(bearer\s+)[a-z0-9._~+/=-]{8,}/gi, "$1[REDACTED]"],
  [/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}\b/g, "[REDACTED JWT]"],
  [/\b(?:sk-[\w-]{16,}|gsk_[\w]{20,}|AIza[\w-]{30,}|AKIA[0-9A-Z]{16}|gh[pousr]_\w{30,})\b/g, "[REDACTED KEY]"],
  [/((?:["']?\$?[a-z_]*(?:pass(?:word|wd)?|secret|token|api[_-]?key|app_key|session[_-]?id)[a-z_]*["']?)\s*[:=]\s*)(?!\[REDACTED|\[value hidden)("[^"]*"|'[^']*'|[^\s&,;}]+)/gi, "$1[REDACTED]"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED EMAIL]"],
];

export function redact(input: string): { text: string; count: number } {
  let count = 0;
  let text = input;
  for (const [re, replacement] of RULES)
    text = text.replace(re, (...m: string[]) => {
      count++;
      return replacement.replace(/\$(\d)/g, (_s, i: string) => m[Number(i)] ?? "");
    });
  return { text, count };
}

export const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max)}\n[... ${s.length - max} more characters not sent]`);
