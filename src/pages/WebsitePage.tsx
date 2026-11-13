import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { FileText, Pencil, Plus, Radar, Trash2 } from "lucide-react";
import { api, CATEGORY, fmtDate, SEVERITIES, type WebsiteDetail } from "../api";
import { useApi } from "../useApi";
import { Button, Card, Empty, ErrorText, Field, Input, Loading, Note, PageTitle, Select, SeverityBadge, StatusBadge, Textarea } from "../components/ui";

export default function WebsitePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: site, error, reload } = useApi<WebsiteDetail>(`/targets/${id}`);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!site) return <Loading />;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const scan = () => run(async () => navigate(`/scans/${(await api<{ id: string }>(`/targets/${site.id}/scans`, { body: { zap: false } })).id}`));
  const report = () => run(async () => navigate(`/reports/${(await api<{ id: string }>("/reports", { body: { targetId: site.id, title: `Security assessment of ${site.name}` } })).id}`));
  const remove = () => {
    if (!confirm(`Delete ${site.name} with all its scans, findings and reports? This cannot be undone.`)) return;
    void run(async () => { await api(`/targets/${site.id}`, { method: "DELETE" }); navigate("/"); });
  };

  const counts = { unverified: 0, confirmed: 0, rejected: 0 };
  site.findings.forEach((f) => counts[f.status]++);

  return (
    <div className="space-y-6">
      <PageTitle
        title={site.name}
        subtitle={<a href={site.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{site.url}</a>}
        actions={
          <>
            <Button variant="outline" onClick={report} disabled={busy}><FileText /> New report</Button>
            <Button onClick={scan} busy={busy}><Radar /> Scan again</Button>
          </>
        }
      />
      <ErrorText>{msg}</ErrorText>

      <Card title="Scope" actions={<Button variant="ghost" onClick={() => setEditing(!editing)}><Pencil /> Edit</Button>}>
        {editing ? (
          <ScopeForm site={site} onDone={() => { setEditing(false); void reload(); }} />
        ) : (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-slate-500">Approval</dt><dd>{site.approval}</dd></div>
            <div><dt className="text-slate-500">Not tested</dt><dd className="font-mono text-xs whitespace-pre-line">{site.outOfScope || "Nothing excluded"}</dd></div>
            <div><dt className="text-slate-500">Where it runs</dt><dd>{site.isLocal ? "Copy on this computer: all checks, including Nmap and file checks" : "Hosted online: safe passive checks only"}</dd></div>
          </dl>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title={`Findings (${site.findings.length})`} className="lg:col-span-2" actions={<Button variant="outline" onClick={() => setAdding(!adding)}><Plus /> Add by hand</Button>}>
          {adding && <ManualFinding targetId={site.id} onDone={() => { setAdding(false); void reload(); }} />}
          <p className="mb-3 text-sm text-slate-600">{counts.unverified} to review · {counts.confirmed} confirmed · {counts.rejected} false alarms</p>
          {site.findings.length ? (
            <ul className="divide-y divide-slate-100">
              {site.findings.map((f) => (
                <li key={f.id}>
                  <Link to={`/findings/${f.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50">
                    <SeverityBadge severity={f.severity} />
                    <span className="min-w-0 flex-1 truncate text-sm">{f.title}</span>
                    <StatusBadge status={f.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty>No findings yet.</Empty>}
        </Card>

        <div className="space-y-6">
          <Card title="Scans">
            {site.scans.length ? (
              <ul className="space-y-2">
                {site.scans.map((s) => (
                  <li key={s.id}>
                    <Link to={`/scans/${s.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                      {fmtDate(s.startedAt)} <StatusBadge status={s.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty>Not scanned yet.</Empty>}
          </Card>
          <Card title="Reports">
            {site.reports.length ? (
              <ul className="space-y-2">
                {site.reports.map((r) => (
                  <li key={r.id}><Link to={`/reports/${r.id}`} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">{r.title}<span className="block text-xs text-slate-500">{fmtDate(r.createdAt)}</span></Link></li>
                ))}
              </ul>
            ) : <Empty>No reports yet.</Empty>}
          </Card>
          <Button variant="danger" onClick={remove} disabled={busy} className="w-full"><Trash2 /> Delete website</Button>
        </div>
      </div>
    </div>
  );
}

function ScopeForm({ site, onDone }: { site: WebsiteDetail; onDone: () => void }) {
  const [name, setName] = useState(site.name);
  const [approval, setApproval] = useState(site.approval);
  const [outOfScope, setOutOfScope] = useState(site.outOfScope);
  const [error, setError] = useState("");
  const save = async () => {
    try {
      await api(`/targets/${site.id}`, { method: "PATCH", body: { name, approval, outOfScope } });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="space-y-3">
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Who approved testing"><Input value={approval} onChange={(e) => setApproval(e.target.value)} /></Field>
      <Field label="Paths that must not be tested (one per line)"><Textarea rows={3} value={outOfScope} onChange={(e) => setOutOfScope(e.target.value)} /></Field>
      <ErrorText>{error}</ErrorText>
      <Button onClick={save}>Save</Button>
    </div>
  );
}

function ManualFinding({ targetId, onDone }: { targetId: string; onDone: () => void }) {
  const [f, setF] = useState({ title: "", category: "other", severity: "medium", affectedUrl: "", description: "", evidence: "", recommendation: "" });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    try {
      await api("/findings", { body: { ...f, targetId } });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="mb-5 space-y-3 rounded-xl bg-slate-50 p-4">
      <Note>Use this for something you found yourself, for example with browser developer tools or curl. It still needs to be confirmed.</Note>
      <Field label="Title"><Input value={f.title} onChange={set("title")} /></Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Category"><Select value={f.category} onChange={set("category")}>{Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Severity"><Select value={f.severity} onChange={set("severity")}>{SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
      </div>
      <Field label="Affected URL"><Input value={f.affectedUrl} onChange={set("affectedUrl")} /></Field>
      <Field label="Description"><Textarea rows={2} value={f.description} onChange={set("description")} /></Field>
      <Field label="Evidence" hint="The request and response, or the steps you took. Do not paste passwords or real personal data."><Textarea rows={3} value={f.evidence} onChange={set("evidence")} /></Field>
      <Field label="Recommendation"><Textarea rows={2} value={f.recommendation} onChange={set("recommendation")} /></Field>
      <ErrorText>{error}</ErrorText>
      <Button onClick={save}>Add finding</Button>
    </div>
  );
}
