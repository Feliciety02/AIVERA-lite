import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowRight,
  Bot,
  ChevronDown,
  CircleCheck,
  ClipboardCheck,
  FileText,
  Fingerprint,
  Globe,
  KeyRound,
  LayoutDashboard,
  Radar as RadarIcon,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Siren,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api";
import { useApi } from "../useApi";
import { Button, ErrorText, Field, Input, Logo, Textarea } from "../components/ui";

/* ---------------------------------------------------------------------------
 * The landing page, in the same design as the full AIVERA landing page.
 * The hero holds the scan box: paste a link and press Scan.
 * Every claim on this page is something AIVERA Lite really does.
 * ------------------------------------------------------------------------- */

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Four small corner brackets, like a targeting frame, around a card. */
function Brackets({ className }: { className?: string }) {
  const base = "absolute size-3 border-landing-accent";
  return (
    <span className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
      <span className={cn(base, "top-0 left-0 rounded-tl-md border-t-2 border-l-2")} />
      <span className={cn(base, "top-0 right-0 rounded-tr-md border-t-2 border-r-2")} />
      <span className={cn(base, "bottom-0 left-0 rounded-bl-md border-b-2 border-l-2")} />
      <span className={cn(base, "right-0 bottom-0 rounded-br-md border-r-2 border-b-2")} />
    </span>
  );
}

/* --------------------------------- Radar ---------------------------------- */

const SWEEP_SECONDS = 5;
// Typical pages a scan looks at. Angle is clockwise from 12 o'clock.
const BLIPS: { label: string; angle: number; r: number; tone: "ok" | "warn" }[] = [
  { label: "/login", angle: 38, r: 0.55, tone: "ok" },
  { label: "/robots.txt", angle: 108, r: 0.78, tone: "ok" },
  { label: "/.env", angle: 165, r: 0.45, tone: "warn" },
  { label: "/sitemap.xml", angle: 232, r: 0.72, tone: "ok" },
  { label: "/", angle: 305, r: 0.5, tone: "ok" },
];
const BLIP_TONE = { ok: "bg-landing-accent", warn: "bg-warning" } as const;

function Radar() {
  const reduced = useReducedMotion();
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]" role="img" aria-label="Animated radar showing the pages of a website inside the approved scope">
      <div className="landing-radar-face absolute inset-0 rounded-full border border-landing-accent/30" />
      <svg viewBox="0 0 400 400" className="absolute inset-0 size-full text-landing-accent" aria-hidden>
        {[45, 90, 135, 180].map((r) => (
          <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="currentColor" strokeOpacity={r === 180 ? 0.4 : 0.2} strokeDasharray={r === 180 ? undefined : "3 5"} />
        ))}
        <line x1="20" y1="200" x2="380" y2="200" stroke="currentColor" strokeOpacity="0.2" />
        <line x1="200" y1="20" x2="200" y2="380" stroke="currentColor" strokeOpacity="0.2" />
        <line x1="73" y1="73" x2="327" y2="327" stroke="currentColor" strokeOpacity="0.08" />
        <line x1="327" y1="73" x2="73" y2="327" stroke="currentColor" strokeOpacity="0.08" />
        {ticks.map((deg) => {
          const long = deg % 30 === 0;
          const a = ((deg - 90) * Math.PI) / 180;
          const r2 = long ? 170 : 175;
          return <line key={deg} x1={200 + 180 * Math.cos(a)} y1={200 + 180 * Math.sin(a)} x2={200 + r2 * Math.cos(a)} y2={200 + r2 * Math.sin(a)} stroke="currentColor" strokeOpacity={long ? 0.55 : 0.25} />;
        })}
        {[0, 90, 180, 270].map((deg) => {
          const a = ((deg - 90) * Math.PI) / 180;
          return (
            <text key={deg} x={200 + 158 * Math.cos(a)} y={200 + 158 * Math.sin(a) + 3} textAnchor="middle" className="fill-slate-500 font-mono" fontSize="9">
              {String(deg).padStart(3, "0")}
            </text>
          );
        })}
      </svg>

      <div className={cn("absolute inset-[5%] rounded-full", !reduced && "landing-radar-sweep")} style={{ animationDuration: `${SWEEP_SECONDS}s` }} aria-hidden>
        <div className="landing-radar-wedge absolute inset-0 rounded-full" />
        <div className="absolute top-0 left-1/2 h-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-landing-accent to-transparent" />
      </div>

      {BLIPS.map((b) => {
        const a = ((b.angle - 90) * Math.PI) / 180;
        const anim = { animationDuration: `${SWEEP_SECONDS}s`, animationDelay: `${(b.angle / 360) * SWEEP_SECONDS - SWEEP_SECONDS}s` };
        return (
          <div key={b.label} className="absolute" style={{ left: `${50 + 45 * b.r * Math.cos(a)}%`, top: `${50 + 45 * b.r * Math.sin(a)}%` }}>
            <span className={cn("absolute -top-1 -left-1 size-2 rounded-full", BLIP_TONE[b.tone], !reduced && "landing-blip")} style={anim} />
            {!reduced && <span className={cn("absolute -top-1 -left-1 size-2 rounded-full", BLIP_TONE[b.tone], "landing-blip-ring")} style={anim} />}
            <span className={cn("absolute top-1.5 left-2 rounded border border-slate-200 bg-white/90 px-1.5 py-px font-mono text-[10px] whitespace-nowrap text-slate-700 backdrop-blur", !reduced && "landing-blip-label")} style={anim}>
              {b.label}
            </span>
          </div>
        );
      })}

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className={cn("block size-3 rounded-full bg-landing-accent", !reduced && "landing-pulse")} />
      </div>
      <span className="absolute bottom-[13%] left-1/2 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500">your-website.com</span>
    </div>
  );
}

function FloatingCard({ icon: Icon, title, value, className, delay = "0s" }: { icon: LucideIcon; title: string; value: string; className?: string; delay?: string }) {
  return (
    <div className={cn("landing-float absolute z-10 hidden items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-lg shadow-black/5 backdrop-blur sm:flex", className)} style={{ animationDelay: delay }}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-landing-accent/12 text-landing-accent">
        <Icon className="size-4" aria-hidden />
      </span>
      <span>
        <span className="block text-[11px] text-slate-500">{title}</span>
        <span className="block font-mono text-xs font-medium">{value}</span>
      </span>
    </div>
  );
}

/* -------------------------------- Terminal -------------------------------- */

type Line = { t: "cmd" | "ok" | "info" | "warn" | "ai" | "hold"; text: string };

// An illustrative run, in the same order AIVERA Lite really works.
const SESSION: Line[] = [
  { t: "cmd", text: "scan http://127.0.0.1:8000" },
  { t: "ok", text: "host is on the allowed list · permission ticked" },
  { t: "cmd", text: "dns lookup" },
  { t: "info", text: "127.0.0.1 is an IP address · nothing to look up" },
  { t: "cmd", text: "endpoint discovery" },
  { t: "info", text: "GET /robots.txt · GET /sitemap.xml · 2 pages found" },
  { t: "cmd", text: "web checks" },
  { t: "warn", text: "4 possible issues · status: NEEDS REVIEW" },
  { t: "cmd", text: "nmap --top-ports 100" },
  { t: "info", text: "3 open ports · local copy only" },
  { t: "cmd", text: "ai interpret" },
  { t: "ai", text: "secrets removed first · advice, not a verdict" },
  { t: "hold", text: "waiting for a person to verify ▸ tester" },
];
const LINE_STYLE: Record<Line["t"], string> = { cmd: "text-slate-100", ok: "text-emerald-400", info: "text-slate-400", warn: "text-amber-300", ai: "text-cyan-300", hold: "text-sky-300" };
const LINE_PREFIX: Record<Line["t"], string> = { cmd: "$", ok: "✓", info: "·", warn: "!", ai: "◆", hold: "⏸" };

function TerminalDemo() {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? SESSION.length : 0);
  useEffect(() => {
    if (reduced) return setShown(SESSION.length);
    const delay = shown >= SESSION.length ? 4200 : SESSION[shown]?.t === "cmd" ? 900 : 420;
    const t = setTimeout(() => setShown((n) => (n >= SESSION.length ? 0 : n + 1)), delay);
    return () => clearTimeout(t);
  }, [shown, reduced]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-[#0a1020] shadow-2xl shadow-landing-accent/15">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-rose-400/80" />
        <span className="size-2.5 rounded-full bg-amber-300/80" />
        <span className="size-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-3 font-mono text-[11px] text-slate-400">aivera lite · scan</span>
        <span className="ml-auto rounded border border-white/10 px-1.5 py-px font-mono text-[10px] tracking-wider text-slate-500 uppercase">example</span>
      </div>
      <div className="relative h-[330px] overflow-hidden px-4 py-3 font-mono text-[12.5px] leading-6 sm:text-[13px]" aria-label="Example AIVERA Lite scan" role="img">
        {SESSION.slice(0, shown).map((l, i) => (
          <div key={i} className={cn("flex gap-2 whitespace-pre-wrap", LINE_STYLE[l.t], !reduced && "landing-line-in")}>
            <span className="w-3 shrink-0 text-slate-600 select-none">{LINE_PREFIX[l.t]}</span>
            <span className="min-w-0 break-words">{l.text}</span>
          </div>
        ))}
        {!reduced && <span className="landing-cursor ml-5 inline-block h-4 w-2 translate-y-0.5 bg-cyan-400" aria-hidden />}
        {!reduced && <div className="landing-scanline pointer-events-none absolute inset-0" aria-hidden />}
      </div>
    </div>
  );
}

/* -------------------------------- Scan box -------------------------------- */

interface Settings { allowedHosts: string[]; zap: boolean }

function ScanForm({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const navigate = useNavigate();
  const settings = useApi<Settings>("/settings");
  const [url, setUrl] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [more, setMore] = useState(false);
  const [approval, setApproval] = useState("");
  const [outOfScope, setOutOfScope] = useState("");
  const [zap, setZap] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const site = await api<{ id: string }>("/targets", { body: { url, approval, outOfScope, confirmed: confirmed || undefined } });
      const scan = await api<{ id: string }>(`/targets/${site.id}/scans`, { body: { zap } });
      navigate(`/scans/${scan.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const hosts = settings.data?.allowedHosts;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white p-1.5 pl-5 shadow-lg shadow-landing-accent/10 focus-within:border-landing-accent focus-within:ring-4 focus-within:ring-landing-accent/15">
        <Globe className="size-5 shrink-0 text-slate-400" aria-hidden />
        <input
          ref={inputRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-website.com"
          aria-label="Website link"
          required
          className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none"
        />
        <Button type="submit" busy={busy} className="landing-shine px-5 py-2.5">Scan <ArrowRight /></Button>
      </div>

      <label className="flex items-start gap-2 pl-1 text-sm text-slate-700">
        <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} required />
        <span>I own this website or have written permission to test it.</span>
      </label>

      <ErrorText>{error}</ErrorText>

      <button type="button" onClick={() => setMore(!more)} className="inline-flex items-center gap-1 pl-1 text-sm text-primary">
        Options <ChevronDown className={cn("size-4 transition", more && "rotate-180")} />
      </button>
      {more && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <Field label="Who approved the test (optional)" hint="Saved in the report. Example: Prof. Santos, email of 2026-09-02.">
            <Input value={approval} onChange={(e) => setApproval(e.target.value)} />
          </Field>
          <Field label="Paths to skip (one per line)" hint="These paths are never requested. Example: /logout">
            <Textarea rows={2} value={outOfScope} onChange={(e) => setOutOfScope(e.target.value)} />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={zap} onChange={(e) => setZap(e.target.checked)} disabled={settings.data?.zap === false} />
            <span>
              Also run an OWASP ZAP passive scan (takes about 3 minutes)
              {settings.data?.zap === false && <span className="block text-xs text-slate-500">ZAP is not installed on this server.</span>}
            </span>
          </label>
        </div>
      )}
      {hosts && <p className="pl-1 text-xs text-slate-500">Allowed websites: {hosts.length ? hosts.join(", ") : "any"}</p>}
    </form>
  );
}

/* --------------------------------- Content -------------------------------- */

const WORKFLOW: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Globe, title: "Paste the link", body: "Only websites on the allowed list can be scanned, and you confirm you have permission first. Paths to skip are never requested." },
  { icon: RadarIcon, title: "Recon", body: "Look up DNS records, read the home page, robots.txt and sitemap.xml, and list the pages found." },
  { icon: ScanSearch, title: "Scan", body: "Check login forms, headers, cookies, HTTPS and error pages. On a copy on your computer, Nmap and file checks run too. OWASP ZAP is optional." },
  { icon: Bot, title: "AI analysis", body: "AI explains the results, ranks what to check first and suggests fixes, after secrets are removed." },
  { icon: UserCheck, title: "Verify and rate", body: "A person checks the evidence, confirms or rejects each finding, and rates likelihood and impact." },
  { icon: FileText, title: "Report", body: "Print or save a report with the scope, method, verified findings, evidence and fixes." },
];

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: ClipboardCheck, title: "Five test areas", body: "Security configuration and HTTPS, login security, session cookies, information disclosure, and exposed files and directories." },
  { icon: Fingerprint, title: "Evidence first", body: "Every finding keeps the URL, the response details and the raw tool output that support it." },
  { icon: Bot, title: "AI that shows its work", body: "The Activity page shows exactly what was sent to the AI and what came back." },
  { icon: Siren, title: "Risk you can rank", body: "Likelihood times impact on a three by three matrix gives the severity, from info to critical." },
  { icon: LayoutDashboard, title: "Dashboard", body: "Findings by severity and category, what still needs review, and every website scanned." },
  { icon: FileText, title: "Reports from verified data", body: "Only confirmed findings go in the report. AI can draft the summary, and you edit it." },
];

const GUARDS = [
  "Only hosts on the allowed list can be scanned",
  "You confirm written permission before every new website",
  "Online websites get safe, passive checks only",
  "Port scans and file checks only run on a copy on your computer",
  "Passwords, tokens, cookies and emails are removed before AI sees anything",
  "Nothing counts as confirmed until a person checks it",
];

function SectionHeading({ title, body, align = "center" }: { title: string; body?: string; align?: "center" | "left" }) {
  return (
    <div className={cn("sr-rise max-w-2xl", align === "center" && "mx-auto text-center")}>
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-base leading-relaxed text-slate-600">{body}</p>}
    </div>
  );
}

export default function ScanHomePage() {
  const reduced = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const toScan = () => {
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    setTimeout(() => inputRef.current?.focus(), reduced ? 0 : 400);
  };

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#f8fafd] text-slate-900">
      <div className="landing-grid pointer-events-none fixed inset-0" aria-hidden />
      <div className="pointer-events-none fixed -top-48 left-1/2 h-[480px] w-[880px] -translate-x-1/2 rounded-full bg-landing-accent/10 blur-[120px]" aria-hidden />

      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#f8fafd]/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6" aria-label="Landing">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="text-lg font-medium tracking-wide">AIVERA <span className="font-normal text-slate-500">Lite</span></span>
          </Link>
          <div className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <a href="#workflow" className="landing-navlink hover:text-slate-900">How it works</a>
            <a href="#features" className="landing-navlink hover:text-slate-900">Features</a>
            <a href="#safety" className="landing-navlink hover:text-slate-900">Safety</a>
          </div>
          <div className="ml-auto">
            <Link to="/dashboard"><Button variant="outline">Dashboard <ArrowRight /></Button></Link>
          </div>
        </nav>
        <div className="sr-progress absolute inset-x-0 -bottom-px h-0.5 bg-landing-accent" aria-hidden />
      </header>

      <main className="relative">
        {/* Hero with the scan box */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div className="min-w-0">
            <h1 className="text-4xl leading-[1.12] font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Find the weak spots in <span className="landing-gradient-text">your website</span>{" "}
              <span className="relative inline-block whitespace-nowrap">
                before anyone
                <svg className="absolute -bottom-2 left-0 h-3 w-full text-landing-accent" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden>
                  <path d="M3 9 C 60 3, 120 3, 170 6 S 260 10, 297 4" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" className={cn(!reduced && "landing-draw")} />
                </svg>
              </span>{" "}
              else does.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-600">
              Paste the link of a website you are allowed to test. AIVERA Lite scans it, AI explains what it found, and you decide which issues are real.
            </p>
            <div className="mt-8 max-w-xl">
              <ScanForm inputRef={inputRef} />
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 border-t border-slate-200 pt-6">
              {[
                ["5", "test areas"],
                ["0", "findings confirmed automatically"],
                ["3", "AI features"],
              ].map(([v, l], i) => (
                <div key={l} className={cn("pr-4", i > 0 && "border-l border-slate-200 pl-4")}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="font-mono text-2xl">{v}</dd>
                  <dd className="mt-1 text-xs leading-snug text-slate-500">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="sr-parallax relative">
            <FloatingCard icon={ShieldCheck} title="Permission" value="Confirmed" className="top-6 -left-2 lg:-left-10" />
            <FloatingCard icon={KeyRound} title="Allowed list" value="Host approved" className="right-0 bottom-16 lg:-right-6" delay="1.5s" />
            <Radar />
            <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
              <span className={cn("size-1.5 rounded-full bg-success", !reduced && "landing-pulse-success")} /> Scanning only websites you are allowed to test
            </p>
          </div>
        </section>

        {/* Example run */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
          <div className="sr-tilt min-w-0">
            <TerminalDemo />
          </div>
          <div>
            <SectionHeading align="left" title="Every scan follows the same rules" body="Permission first, safe checks only, and every result waits for a person to review it. This is what a scan of a local test copy looks like." />
            <ul className="mt-6 space-y-3 text-sm">
              {["The link must be on the allowed list", "Online websites only get normal page requests", "AI suggestions are advice, never a verdict"].map((t, i) => (
                <li key={t} className="sr-slide flex items-start gap-3" style={{ "--sr-i": i } as CSSProperties}>
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="scroll-mt-20 border-t border-slate-200 bg-slate-100/40 py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title="From a link to a report in six steps" body="Each step hands off to the next, and nothing counts until a person has checked it." />
            <div className="relative mt-12 h-px bg-slate-200" aria-hidden>
              <div className="sr-line absolute inset-0 bg-gradient-to-r from-landing-accent to-landing-deep" />
            </div>
            <ol className="relative mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {WORKFLOW.map((s, i) => (
                <li key={s.title} style={{ "--sr-i": i % 3 } as CSSProperties} className="sr-rise group relative rounded-xl border border-slate-200 bg-white p-6 pt-8 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-landing-accent/50 hover:shadow-xl hover:shadow-landing-accent/10">
                  <Brackets className="opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="absolute -top-4 left-6 flex size-8 items-center justify-center rounded-full border-2 border-[#f8fafd] bg-landing-accent font-mono text-xs font-semibold text-white shadow-md">{i + 1}</span>
                  <span className="flex size-10 items-center justify-center rounded-lg bg-landing-accent/10 text-landing-accent transition-colors group-hover:bg-landing-accent group-hover:text-white">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-lg font-medium">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t border-slate-200 py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title="Built for a careful tester" body="The parts of AIVERA Lite that turn raw tool output into decisions you can defend." />
            <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <div key={f.title} style={{ "--sr-i": i % 3 } as CSSProperties} className="sr-blur group relative bg-white p-7 transition-colors hover:bg-primary-soft/40">
                  <f.icon className="size-6 text-landing-accent transition-transform group-hover:scale-110" aria-hidden />
                  <h3 className="mt-4 text-base font-medium">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Safety */}
        <section id="safety" className="scroll-mt-20 border-y border-slate-200 bg-slate-100/40">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
            <div>
              <span className="flex size-14 items-center justify-center rounded-2xl bg-landing-accent/12 text-landing-accent">
                <ShieldAlert className="size-7" aria-hidden />
              </span>
              <div className="mt-6">
                <SectionHeading align="left" title="It only tests what you're allowed to test" body="Testing a website without the owner's written permission is not allowed, and AIVERA Lite is built to stop it." />
              </div>
            </div>
            <ul className="space-y-3">
              {GUARDS.map((g, i) => (
                <li key={g} style={{ "--sr-i": i } as CSSProperties} className="sr-slide flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-colors hover:border-landing-accent/40">
                  <span className="font-mono text-xs text-slate-500 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Call to action */}
        <section className="px-4 py-24 sm:px-6">
          <div className="sr-zoom relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-landing-accent/25 bg-gradient-to-br from-landing-accent/15 via-white to-landing-deep/10 px-6 py-16 sm:px-12">
            <div className="landing-grid pointer-events-none absolute inset-0" aria-hidden />
            <img src="/aivera-logo.webp" alt="" className="pointer-events-none absolute -right-10 -bottom-12 size-72 opacity-15 sm:size-96" />
            <div className="relative max-w-xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ready to scan a website?</h2>
              <p className="mt-4 text-slate-600">Paste the link, tick the permission box, and let AIVERA Lite do the heavy lifting. You make the final call.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button onClick={toScan} className="landing-shine px-6 py-3 text-base">Scan a website <ArrowRight /></Button>
                <Link to="/dashboard"><Button variant="outline" className="px-6 py-3 text-base">Open dashboard</Button></Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-slate-200 bg-white/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo size={32} />
              <span className="text-lg font-medium tracking-wide">AIVERA <span className="font-normal text-slate-500">Lite</span></span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-slate-600">AI-assisted security assessment for websites you are allowed to test.</p>
          </div>
          <div>
            <p className="text-sm font-medium">Explore</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><a href="#workflow" className="hover:text-slate-900">How it works</a></li>
              <li><a href="#features" className="hover:text-slate-900">Features</a></li>
              <li><a href="#safety" className="hover:text-slate-900">Safety</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">Results</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link to="/dashboard" className="hover:text-slate-900">Dashboard</Link></li>
              <li><Link to="/findings" className="hover:text-slate-900">Findings</Link></li>
              <li><Link to="/reports" className="hover:text-slate-900">Reports</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-200">
          <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate-500 sm:px-6">Only test systems you are authorized to test.</p>
        </div>
      </footer>
    </div>
  );
}
