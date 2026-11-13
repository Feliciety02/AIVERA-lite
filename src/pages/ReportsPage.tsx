import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { FileText } from "lucide-react";
import { api, fmtDate, type ReportListItem, type Website } from "../api";
import { useApi } from "../useApi";
import { Button, Card, Empty, ErrorText, Field, Input, Loading, PageTitle, Select } from "../components/ui";

export default function ReportsPage() {
  const navigate = useNavigate();
  const { data, error } = useApi<ReportListItem[]>("/reports");
  const sites = useApi<Website[]>("/targets");
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");

  const create = async () => {
    setMsg("");
    try {
      const site = sites.data?.find((s) => s.id === targetId);
      const r = await api<{ id: string }>("/reports", { body: { targetId, title: title || `Security assessment of ${site?.name ?? "website"}` } });
      navigate(`/reports/${r.id}`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Reports" subtitle="A report lists a website's confirmed findings with evidence, risk and fixes. Print it or save it as PDF." />
      <Card title="New report">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Website">
            <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Choose a website</option>
              {sites.data?.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.confirmed} confirmed)</option>)}
            </Select>
          </Field>
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Security assessment of ..." /></Field>
          <Button onClick={create} disabled={!targetId}><FileText /> Create</Button>
        </div>
        <div className="mt-3"><ErrorText>{msg}</ErrorText></div>
      </Card>
      <Card title="All reports">
        <ErrorText>{error}</ErrorText>
        {!data ? <Loading /> : !data.length ? <Empty>No reports yet.</Empty> : (
          <ul className="divide-y divide-slate-100">
            {data.map((r) => (
              <li key={r.id}>
                <Link to={`/reports/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-3 hover:bg-slate-50">
                  <span><span className="block font-medium">{r.title}</span><span className="text-xs text-slate-500">{r.target.name} · {r.target.url}</span></span>
                  <span className="text-xs text-slate-500">{fmtDate(r.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
