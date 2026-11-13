import { Link } from "react-router";
import { CATEGORY, fmtDate, SEVERITIES, type FindingRow, type Severity, type Website } from "../api";
import { useApi } from "../useApi";
import { Card, Empty, ErrorText, Loading, PageTitle, SEV_BAR, SeverityBadge, StatusBadge } from "../components/ui";

interface Dashboard {
  targets: number;
  scans: number;
  findings: number;
  byStatus: Record<"unverified" | "confirmed" | "rejected", number>;
  confirmedBySeverity: Record<Severity, number>;
  confirmedByCategory: Record<string, number>;
  toReview: (FindingRow & { target: { name: string } })[];
  activity: { id: string; action: string; detail: string; createdAt: string }[];
}

function Stat({ label, value, to }: { label: string; value: number; to?: string }) {
  const body = (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-primary/40">
      <p className="text-3xl font-normal">{value}</p>
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function Bars({ data, label, color }: { data: [string, number][]; label: (k: string) => string; color: (k: string) => string }) {
  const max = Math.max(1, ...data.map(([, v]) => v));
  return (
    <ul className="space-y-2">
      {data.map(([k, v]) => (
        <li key={k} className="grid grid-cols-[minmax(0,15rem)_1fr_2rem] items-center gap-3 text-sm">
          <span className="truncate text-slate-700" title={label(k)}>{label(k)}</span>
          <span className="h-3 rounded-full bg-slate-100"><span className={`block h-3 rounded-full ${color(k)}`} style={{ width: `${(v / max) * 100}%` }} /></span>
          <span className="text-right tabular-nums">{v}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { data: d, error } = useApi<Dashboard>("/dashboard");
  const sites = useApi<Website[]>("/targets");
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!d) return <Loading />;

  return (
    <div className="space-y-6">
      <PageTitle title="Dashboard" subtitle="Assessment results across all websites. Severity charts count confirmed findings only." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Websites" value={d.targets} />
        <Stat label="Scans run" value={d.scans} />
        <Stat label="Need review" value={d.byStatus.unverified} to="/findings?status=unverified" />
        <Stat label="Confirmed" value={d.byStatus.confirmed} to="/findings?status=confirmed" />
        <Stat label="False alarms" value={d.byStatus.rejected} to="/findings?status=rejected" />
      </div>

      <Card title="Websites scanned">
        {sites.data && !sites.data.length && <Empty>No websites yet. <Link to="/" className="text-primary">Scan one</Link>.</Empty>}
        {!!sites.data?.length && (
          <ul className="divide-y divide-slate-100">
            {sites.data.map((s) => (
              <li key={s.id}>
                <Link to={`/websites/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-2 py-3 hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block truncate text-xs text-slate-500">{s.url}</span>
                  </span>
                  <span className="text-xs text-slate-600">{s.scanCount} scan(s) · {s.confirmed} confirmed · {s.toReview} to review</span>
                  {s.lastScan && <span className="flex items-center gap-2 text-xs text-slate-500"><StatusBadge status={s.lastScan.status} /> {fmtDate(s.lastScan.startedAt)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Confirmed findings by severity">
          <Bars data={SEVERITIES.map((s) => [s, d.confirmedBySeverity[s]])} label={(k) => k[0]!.toUpperCase() + k.slice(1)} color={(k) => SEV_BAR[k as Severity]} />
        </Card>
        <Card title="Confirmed findings by category">
          <Bars data={Object.entries(d.confirmedByCategory)} label={(k) => CATEGORY[k] ?? k} color={() => "bg-primary"} />
        </Card>
        <Card title="Waiting for review" actions={<Link to="/findings?status=unverified" className="text-sm text-primary">See all</Link>}>
          {d.toReview.length ? (
            <ul className="divide-y divide-slate-100">
              {d.toReview.map((f) => (
                <li key={f.id}>
                  <Link to={`/findings/${f.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                    <SeverityBadge severity={f.severity} />
                    <span className="min-w-0 flex-1 truncate text-sm">{f.title}</span>
                    <span className="hidden truncate text-xs text-slate-500 sm:inline">{f.target.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty>Nothing to review.</Empty>}
        </Card>
        <Card title="Recent activity" actions={<Link to="/activity" className="text-sm text-primary">See all</Link>}>
          {d.activity.length ? (
            <ul className="space-y-2 text-sm">
              {d.activity.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="w-28 shrink-0 text-xs text-slate-500">{fmtDate(a.createdAt)}</span>
                  <span className="min-w-0"><b className="font-medium">{a.action}</b>: <span className="text-slate-600">{a.detail}</span></span>
                </li>
              ))}
            </ul>
          ) : <Empty>No activity yet.</Empty>}
        </Card>
      </div>
    </div>
  );
}
