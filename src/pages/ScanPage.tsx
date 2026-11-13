import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { CheckCircle2, ChevronDown, CircleDashed, FileText, Loader2, MinusCircle, RotateCcw, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { api, CATEGORY, fmtDate, SEVERITIES, type Scan, type ScanInterpretation, type Step } from "../api";
import { useApi } from "../useApi";
import { Button, Card, Empty, ErrorText, Loading, Logo, Note, Pre, SeverityBadge, StatusBadge } from "../components/ui";

const ICON: Record<Step["status"], ReactNode> = {
  waiting: <CircleDashed className="size-5 text-slate-400" />,
  running: <Loader2 className="size-5 animate-spin text-primary" />,
  done: <CheckCircle2 className="size-5 text-green-600" />,
  failed: <XCircle className="size-5 text-red-600" />,
  skipped: <MinusCircle className="size-5 text-slate-400" />,
};

export default function ScanPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: scan, error, reload, setData } = useApi<Scan>(`/scans/${id}`);

  // While the scan runs, refresh every 2 seconds.
  useEffect(() => {
    if (scan?.status !== "running") return;
    const t = setInterval(reload, 2000);
    return () => clearInterval(t);
  }, [scan?.status, reload]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!scan) return <Loading />;

  const host = new URL(scan.target.url).host;
  const scanAnother = <Button onClick={() => navigate("/")}><RotateCcw /> Scan another website</Button>;

  if (scan.status === "running") {
    const finished = scan.steps.filter((s) => s.status !== "waiting" && s.status !== "running").length;
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <Logo size={56} />
        <h1 className="mt-4 text-2xl font-normal">Scanning {host}</h1>
        <p className="mt-1 text-sm text-slate-600">This usually takes under a minute. Keep this page open.</p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(5, (finished / scan.steps.length) * 100)}%` }} />
        </div>
        <ol className="mt-6 space-y-2 text-left">
          {scan.steps.map((s) => (
            <li key={s.tool} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
              {ICON[s.status]}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.label}</p>
                {s.summary && <p className="text-sm text-slate-600">{s.summary}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const counts = SEVERITIES.map((s) => [s, scan.findings.filter((f) => f.severity === s).length] as const).filter(([, n]) => n);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">Results for</p>
          <h1 className="text-2xl font-normal [overflow-wrap:anywhere]">{host}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">Scanned {fmtDate(scan.finishedAt ?? scan.startedAt)} <StatusBadge status={scan.status} /></p>
        </div>
        {scanAnother}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-3xl font-normal">{scan.findings.length}</p>
          <p className="text-sm text-slate-600">{scan.findings.length === 1 ? "vulnerability found" : "vulnerabilities found"}</p>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {counts.map(([s, n]) => <span key={s} className="flex items-center gap-1 text-sm"><SeverityBadge severity={s} /> {n}</span>)}
          </div>
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Vulnerabilities</h2>
        {scan.findings.length ? (
          scan.findings.map((f) => (
            <details key={f.id} className="group min-w-0 rounded-2xl border border-slate-200 bg-white [overflow-wrap:anywhere]">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{f.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={f.severity} />
                    <StatusBadge status={f.status} />
                    {f.scanId !== scan.id && <span className="text-xs text-slate-500">found in an earlier scan</span>}
                  </div>
                </div>
                <ChevronDown className="size-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t border-slate-100 p-4 text-sm">
                <p className="text-slate-500">{CATEGORY[f.category] ?? f.category} · <span className="font-mono text-xs">{f.affectedUrl}</span></p>
                <p>{f.description}</p>
                {f.recommendation && <p><span className="font-medium">How to fix: </span>{f.recommendation}</p>}
                <Link to={`/findings/${f.id}`} className="inline-block text-primary hover:underline">Evidence, AI explanation and verify</Link>
              </div>
            </details>
          ))
        ) : (
          <Card><div className="flex flex-col items-center gap-2 py-6 text-center"><ShieldCheck className="size-10 text-green-600" /><p className="font-medium">No vulnerabilities found</p><p className="text-sm text-slate-600">The checks that ran did not find any issues.</p></div></Card>
        )}
      </section>

      <AiCard scan={scan} onDone={(aiSummary) => setData({ ...scan, aiSummary })} />

      <ScanDetails scan={scan} />

      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <ReportButton targetId={scan.target.id} name={scan.target.name} />
        {scanAnother}
      </div>
    </div>
  );
}

function ReportButton({ targetId, name }: { targetId: string; name: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const make = async () => {
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/reports", { body: { targetId, title: `Security assessment of ${name}` } });
      navigate(`/reports/${r.id}`);
    } finally {
      setBusy(false);
    }
  };
  return <Button variant="outline" busy={busy} onClick={make}><FileText /> Create report</Button>;
}

function AiCard({ scan, onDone }: { scan: Scan; onDone: (s: ScanInterpretation) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ai = scan.aiSummary;
  const ask = async () => {
    setBusy(true);
    setError("");
    try {
      onDone(await api<ScanInterpretation>(`/scans/${scan.id}/ai`, { method: "POST" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card
      title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-violet-600" /> AI interpretation</span>}
      actions={<Button variant="outline" busy={busy} onClick={ask}>{ai ? "Ask again" : "Explain these results"}</Button>}
    >
      <ErrorText>{error}</ErrorText>
      {busy && <p className="text-sm text-slate-500">The AI is reading the results. A local model can take a minute.</p>}
      {ai ? (
        <div className="space-y-4 text-sm">
          <p>{ai.overview}</p>
          {!!ai.priorities.length && (
            <div>
              <h3 className="mb-1 font-medium">Check these first</h3>
              <ol className="list-decimal space-y-1 pl-5">{ai.priorities.map((p, i) => <li key={i}><span className="font-medium">{p.title}</span>: {p.why}</li>)}</ol>
            </div>
          )}
          {!!ai.falsePositives.length && (
            <div>
              <h3 className="mb-1 font-medium">Possible false alarms</h3>
              <ul className="list-disc space-y-1 pl-5">{ai.falsePositives.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}
          {!!ai.nextSteps.length && (
            <div>
              <h3 className="mb-1 font-medium">Suggested manual checks</h3>
              <ul className="list-disc space-y-1 pl-5">{ai.nextSteps.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}
          <Note tone="ai">Written by AI ({ai.model}) on {fmtDate(ai.generatedAt)}. It can be wrong. A finding is only confirmed after a person checks the evidence.</Note>
        </div>
      ) : !busy && <p className="text-sm text-slate-500">Ask the AI which issues matter most and which might be false alarms.</p>}
    </Card>
  );
}

function ScanDetails({ scan }: { scan: Scan }) {
  const [open, setOpen] = useState<string | null>(null);
  const { dns, ports, endpoints } = scan.recon;
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-medium">
        Scan details: steps, DNS, ports and pages found
        <ChevronDown className="size-4 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-5 border-t border-slate-100 p-4">
        <ol className="space-y-2">
          {scan.steps.map((s) => (
            <li key={s.tool} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-start gap-3">
                {ICON[s.status]}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.label}</p>
                  {s.summary && <p className={`text-sm ${s.status === "failed" ? "text-red-700" : "text-slate-600"}`}>{s.summary}</p>}
                </div>
                {s.output && <button className="text-xs text-primary" onClick={() => setOpen(open === s.tool ? null : s.tool)}>{open === s.tool ? "Hide output" : "Raw output"}</button>}
              </div>
              {open === s.tool && <div className="mt-3"><Pre>{s.output}</Pre></div>}
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-1 gap-5 text-sm md:grid-cols-3">
          <div className="min-w-0">
            <h3 className="mb-1 font-medium">DNS</h3>
            {dns ? (
              <dl className="space-y-1">
                <div><dt className="inline text-slate-500">Host: </dt><dd className="inline">{dns.host}</dd></div>
                <div><dt className="inline text-slate-500">Addresses: </dt><dd className="inline break-all">{dns.addresses?.join(", ") || "none"}</dd></div>
                {!!dns.cname?.length && <div><dt className="inline text-slate-500">Alias of: </dt><dd className="inline break-all">{dns.cname.join(", ")}</dd></div>}
                {!!dns.ns?.length && <div><dt className="inline text-slate-500">Name servers: </dt><dd className="inline break-all">{dns.ns.join(", ")}</dd></div>}
              </dl>
            ) : <Empty>Not run</Empty>}
          </div>
          <div className="min-w-0">
            <h3 className="mb-1 font-medium">Open ports</h3>
            {ports ? (
              ports.length ? <ul className="space-y-1">{ports.map((p) => <li key={p.port}><span className="font-mono">{p.port}/tcp</span> {p.service} <span className="text-slate-500">{p.version}</span></li>)}</ul> : <p className="text-slate-500">None found</p>
            ) : <p className="text-slate-500">Only scanned on a copy on this computer</p>}
          </div>
          <div className="min-w-0">
            <h3 className="mb-1 font-medium">Pages found{endpoints ? ` (${endpoints.length})` : ""}</h3>
            {endpoints?.length ? <ul className="max-h-48 space-y-0.5 overflow-auto font-mono text-xs">{endpoints.map((e) => <li key={e} className="truncate">{e}</li>)}</ul> : <p className="text-slate-500">None found</p>}
          </div>
        </div>
      </div>
    </details>
  );
}
