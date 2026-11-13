/** The few UI building blocks the site uses. */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import type { Severity, Status } from "../api";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Logo({ size = 28 }: { size?: number }) {
  return <img src="/aivera-logo-128.webp" srcSet="/aivera-logo-128.webp 128w, /aivera-logo.webp 512w" sizes="64px" width={size} height={size} alt="" className="shrink-0 select-none object-contain" draggable={false} />;
}

type Variant = "primary" | "outline" | "ghost" | "danger";
export function Button({ variant = "primary", busy, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4",
        variant === "primary" && "bg-primary text-white hover:bg-primary-hover",
        variant === "outline" && "border border-slate-300 bg-white text-primary hover:bg-primary-soft",
        variant === "ghost" && "text-slate-700 hover:bg-slate-100",
        variant === "danger" && "border border-red-300 bg-white text-red-700 hover:bg-red-50",
        className,
      )}
    >
      {busy && <Loader2 className="animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("min-w-0 rounded-2xl border border-slate-200 bg-white p-5 [overflow-wrap:anywhere]", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-medium">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-normal text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(field, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(field, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(field, p.className)} />;

const SEV_STYLE: Record<Severity, string> = {
  critical: "bg-red-700 text-white",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-sky-100 text-sky-800",
  info: "bg-slate-100 text-slate-700",
};
export const SEV_BAR: Record<Severity, string> = { critical: "bg-red-700", high: "bg-orange-500", medium: "bg-amber-400", low: "bg-sky-400", info: "bg-slate-400" };

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={cx("inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize", SEV_STYLE[severity])}>{severity}</span>;
}

const STATUS_STYLE: Record<string, string> = {
  unverified: "bg-slate-100 text-slate-700",
  confirmed: "bg-green-100 text-green-800",
  rejected: "bg-zinc-200 text-zinc-600 line-through",
  running: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-slate-100 text-slate-500",
  waiting: "bg-slate-100 text-slate-500",
};
const STATUS_LABEL: Record<string, string> = { unverified: "Needs review", rejected: "False alarm" };

export function StatusBadge({ status }: { status: Status | string }) {
  return <span className={cx("inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[status] ?? STATUS_STYLE.waiting)}>{STATUS_LABEL[status] ?? status}</span>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{children}</p>;
}

export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "ai" }) {
  const style = tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : tone === "ai" ? "border-violet-200 bg-violet-50 text-violet-950" : "border-blue-200 bg-primary-soft text-slate-800";
  return <div className={cx("rounded-xl border px-4 py-3 text-sm", style)}>{children}</div>;
}

export function Loading() {
  return (
    <div className="flex items-center gap-2 py-16 text-sm text-slate-500 justify-center">
      <Loader2 className="size-4 animate-spin" /> Loading
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-slate-500">{children}</p>;
}

export function Pre({ children }: { children: ReactNode }) {
  return <pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed whitespace-pre-wrap break-all text-slate-100">{children}</pre>;
}
