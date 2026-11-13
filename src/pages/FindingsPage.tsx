import { Link, useSearchParams } from "react-router";
import { CATEGORY, fmtDate, SEVERITIES, type FindingRow, type Website } from "../api";
import { useApi } from "../useApi";
import { Card, Empty, ErrorText, Loading, PageTitle, Select, SeverityBadge, StatusBadge } from "../components/ui";

export default function FindingsPage() {
  const [params, setParams] = useSearchParams();
  const sites = useApi<Website[]>("/targets");
  const { data, error } = useApi<FindingRow[]>(`/findings?${params.toString()}`);
  const set = (key: string) => (e: { target: { value: string } }) => {
    const next = new URLSearchParams(params);
    if (e.target.value) next.set(key, e.target.value);
    else next.delete(key);
    setParams(next);
  };

  return (
    <div>
      <PageTitle title="Findings" subtitle="Everything the tools reported. A finding only counts once an assessor confirms it." />
      <Card>
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          <Select value={params.get("status") ?? ""} onChange={set("status")} aria-label="Status">
            <option value="">All statuses</option>
            <option value="unverified">Needs review</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">False alarm</option>
          </Select>
          <Select value={params.get("severity") ?? ""} onChange={set("severity")} aria-label="Severity">
            <option value="">All severities</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select value={params.get("targetId") ?? ""} onChange={set("targetId")} aria-label="Website">
            <option value="">All websites</option>
            {sites.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <ErrorText>{error}</ErrorText>
        {!data ? <Loading /> : !data.length ? <Empty>No findings match.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr><th className="py-2 pr-3 font-medium">Severity</th><th className="py-2 pr-3 font-medium">Finding</th><th className="hidden py-2 pr-3 font-medium md:table-cell">Category</th><th className="hidden py-2 pr-3 font-medium sm:table-cell">Tool</th><th className="py-2 font-medium">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-3"><SeverityBadge severity={f.severity} /></td>
                    <td className="max-w-0 py-2.5 pr-3 sm:max-w-none">
                      <Link to={`/findings/${f.id}`} className="block truncate font-medium text-primary hover:underline">{f.title}</Link>
                      <span className="block truncate text-xs text-slate-500">{f.target?.name} · {fmtDate(f.createdAt)}</span>
                    </td>
                    <td className="hidden py-2.5 pr-3 text-slate-600 md:table-cell">{CATEGORY[f.category] ?? f.category}</td>
                    <td className="hidden py-2.5 pr-3 text-slate-600 sm:table-cell">{f.source}</td>
                    <td className="py-2.5"><StatusBadge status={f.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
