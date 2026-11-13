import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Printer, Sparkles, Trash2 } from "lucide-react";
import { api, CATEGORY, fmtDate, SEVERITIES, type ReportFull } from "../api";
import { useApi } from "../useApi";
import { Button, ErrorText, Loading, Logo, Note, SeverityBadge, Textarea } from "../components/ui";

/** 08 Report generation: a printable security assessment report. */
export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: r, error, setData } = useApi<ReportFull>(`/reports/${id}`);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState<"" | "ai" | "save">("");
  const [msg, setMsg] = useState("");

  useEffect(() => { if (r) setSummary(r.summary); }, [r?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!r) return <Loading />;

  const draft = async () => {
    setBusy("ai");
    setMsg("");
    try {
      setSummary((await api<{ summary: string }>(`/reports/${r.id}/ai-summary`, { method: "POST" })).summary);
      setMsg("AI draft added. Read it, edit it, then save.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const save = async () => {
    setBusy("save");
    try {
      await api(`/reports/${r.id}`, { method: "PATCH", body: { summary } });
      setData({ ...r, summary });
      setMsg("Saved.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const remove = async () => {
    if (!confirm("Delete this report? The findings stay.")) return;
    await api(`/reports/${r.id}`, { method: "DELETE" });
    navigate("/reports");
  };

  const count = Object.fromEntries(SEVERITIES.map((s) => [s, r.confirmed.filter((f) => f.severity === s).length]));
  const unsaved = summary !== r.summary;

  return (
    <div className="space-y-6">
      <div className="no-print space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.print()} disabled={unsaved}><Printer /> Print or save as PDF</Button>
          <Button variant="outline" busy={busy === "ai"} onClick={draft}><Sparkles /> Draft summary with AI</Button>
          <Button variant="outline" busy={busy === "save"} onClick={save} disabled={!unsaved}>Save summary</Button>
          <Button variant="danger" onClick={remove}><Trash2 /> Delete</Button>
        </div>
        {msg && <Note>{msg}</Note>}
        <Textarea rows={6} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Executive summary. Write it yourself or let the AI draft it, then edit." aria-label="Executive summary" />
        {r.pending > 0 && <Note tone="warn">{r.pending} finding(s) on this website still need review and are not in the report.</Note>}
      </div>

      <article className="mx-auto max-w-4xl min-w-0 space-y-8 [overflow-wrap:anywhere] rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs tracking-widest text-slate-500 uppercase">Security assessment report</p>
            <h1 className="mt-1 text-2xl font-normal">{r.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{r.target.name} · {r.target.url}</p>
            <p className="text-sm text-slate-600">Prepared {fmtDate(r.updatedAt)}</p>
          </div>
          <div className="flex items-center gap-2"><Logo size={36} /><span className="font-medium">AIVERA</span></div>
        </header>

        <section className="print-break">
          <h2 className="mb-2 text-lg font-medium">1. Executive summary</h2>
          <p className="text-sm whitespace-pre-line text-slate-800">{r.summary || "No summary written yet."}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
            {SEVERITIES.map((s) => (
              <div key={s} className="rounded-lg border border-slate-200 p-2">
                <p className="text-xl">{count[s]}</p>
                <SeverityBadge severity={s} />
              </div>
            ))}
          </div>
        </section>

        <section className="print-break">
          <h2 className="mb-2 text-lg font-medium">2. Scope and authorization</h2>
          <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
            <tr><td className="w-28 py-1.5 pr-2 align-top text-slate-500 sm:w-40">Website</td><td>{r.target.url}</td></tr>
            <tr><td className="py-1.5 text-slate-500">Approval</td><td>{r.target.approval}</td></tr>
            <tr><td className="py-1.5 text-slate-500">Out of scope</td><td className="whitespace-pre-line">{r.target.outOfScope || "None"}</td></tr>
            <tr><td className="py-1.5 text-slate-500">Scans</td><td>{r.scans.length} scan(s), {r.scans.length ? `${fmtDate(r.scans[0]!.startedAt)} to ${fmtDate(r.scans.at(-1)!.startedAt)}` : "none"}</td></tr>
            <tr><td className="py-1.5 text-slate-500">Tools</td><td>{r.tools.join(", ") || "None"}</td></tr>
          </tbody></table>
        </section>

        <section className="print-break">
          <h2 className="mb-2 text-lg font-medium">3. Methodology</h2>
          <div className="space-y-2 text-sm text-slate-800">
            <p>The assessment followed the four phases of NIST SP 800-115 (planning, discovery, attack, reporting), limited to non-destructive testing. Test areas follow the OWASP Web Security Testing Guide (WSTG) and the OWASP Top 10 (2021).</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li><b>Scope:</b> the website and written approval were recorded before any test. Out-of-scope paths were never requested.</li>
              <li><b>Reconnaissance:</b> DNS lookup, endpoint discovery (home page links, robots.txt, sitemap.xml) and, on a local copy only, an Nmap TCP scan of the top 100 ports.</li>
              <li><b>Scanning and assessment:</b> automated web checks (security headers, cookie flags, TLS, error pages, exposed files on a local copy only) and an optional OWASP ZAP passive scan.</li>
              <li><b>AI analysis:</b> an AI model interpreted scan results and explained findings. Secrets and personal data were removed before anything was sent. AI output was advice only.</li>
              <li><b>Verification:</b> an assessor checked each finding's evidence by hand and confirmed or rejected it. Only confirmed findings are in this report.</li>
              <li><b>Risk rating:</b> likelihood × impact, each rated low (1), medium (2) or high (3). Score 9 = critical, 6 = high, 3 to 4 = medium, 2 = low, 1 = informational.</li>
            </ol>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium">4. Findings ({r.confirmed.length} confirmed)</h2>
          {!r.confirmed.length && <p className="text-sm text-slate-600">No findings have been confirmed yet.</p>}
          <div className="space-y-6">
            {r.confirmed.map((f, i) => (
              <div key={f.id} className="print-break rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-500">4.{i + 1}</span>
                  <h3 className="font-medium">{f.title}</h3>
                  <SeverityBadge severity={f.severity} />
                </div>
                <table className="mb-3 w-full text-sm"><tbody>
                  <tr><td className="w-24 py-0.5 pr-2 align-top text-slate-500 sm:w-32">Category</td><td>{CATEGORY[f.category] ?? f.category}</td></tr>
                  <tr><td className="py-0.5 text-slate-500">Affected</td><td className="break-all">{f.affectedUrl}</td></tr>
                  <tr><td className="py-0.5 text-slate-500">Risk</td><td className="capitalize">Likelihood {f.likelihood} × impact {f.impact}</td></tr>
                  <tr><td className="py-0.5 text-slate-500">Found by</td><td>{f.source}</td></tr>
                  <tr><td className="py-0.5 text-slate-500">Verified</td><td>{fmtDate(f.verifiedAt)}</td></tr>
                </tbody></table>
                <p className="mb-2 text-sm"><b className="font-medium">Description. </b>{f.description}</p>
                <p className="mb-1 text-sm font-medium">Evidence</p>
                <pre className="mb-2 overflow-hidden rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-wrap break-all">{f.evidence}</pre>
                <p className="mb-2 text-sm"><b className="font-medium">How it was verified. </b>{f.verifierNote}</p>
                <p className="text-sm"><b className="font-medium">Recommendation. </b>{f.recommendation}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="print-break">
          <h2 className="mb-2 text-lg font-medium">5. Other results</h2>
          <p className="text-sm text-slate-800">{r.rejected} tool result(s) were checked and rejected as false alarms. {r.pending} result(s) were still waiting for review when this report was printed and are not counted as vulnerabilities.</p>
        </section>

        <section className="print-break">
          <h2 className="mb-2 text-lg font-medium">6. References</h2>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-800">
            <li>NIST SP 800-115, Technical Guide to Information Security Testing and Assessment</li>
            <li>OWASP Web Security Testing Guide (WSTG) v4.2</li>
            <li>OWASP Top 10 (2021)</li>
            <li>OWASP Cheat Sheet Series: HTTP Headers, Session Management, Transport Layer Security</li>
          </ul>
        </section>
      </article>
    </div>
  );
}
