import { useState } from "react";
import { fmtDate } from "../api";
import { useApi } from "../useApi";
import { Card, Empty, ErrorText, Loading, PageTitle, Pre } from "../components/ui";

interface Data {
  activity: { id: string; action: string; detail: string; createdAt: string }[];
  aiLogs: { id: string; task: string; model: string; sentText: string; output: string; redactions: number; createdAt: string }[];
}

const TASK: Record<string, string> = { interpret_scan: "Interpret scan", explain_finding: "Explain finding", report_summary: "Report summary" };

export default function ActivityPage() {
  const { data, error } = useApi<Data>("/activity");
  const [open, setOpen] = useState<string | null>(null);
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return <Loading />;

  return (
    <div className="space-y-6">
      <PageTitle title="Activity" subtitle="A record of testing activity and of everything sent to the AI, kept as evidence." />
      <Card title="AI requests">
        {data.aiLogs.length ? (
          <ul className="divide-y divide-slate-100">
            {data.aiLogs.map((l) => (
              <li key={l.id} className="py-2.5">
                <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-sm" onClick={() => setOpen(open === l.id ? null : l.id)}>
                  <span><b className="font-medium">{TASK[l.task] ?? l.task}</b> · {l.model} · {l.redactions} value(s) hidden before sending</span>
                  <span className="text-xs text-slate-500">{fmtDate(l.createdAt)}</span>
                </button>
                {open === l.id && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div><p className="mb-1 text-xs font-medium text-slate-500">Sent to the AI</p><Pre>{l.sentText}</Pre></div>
                    <div><p className="mb-1 text-xs font-medium text-slate-500">AI answer</p><Pre>{JSON.stringify(JSON.parse(l.output), null, 2)}</Pre></div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <Empty>No AI requests yet.</Empty>}
      </Card>
      <Card title="Testing activity">
        {data.activity.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500"><tr><th className="py-2 pr-3 font-medium">When</th><th className="py-2 pr-3 font-medium">Action</th><th className="py-2 font-medium">Details</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.activity.map((a) => (
                  <tr key={a.id}><td className="py-2 pr-3 whitespace-nowrap text-slate-500">{fmtDate(a.createdAt)}</td><td className="py-2 pr-3 whitespace-nowrap">{a.action}</td><td className="py-2 text-slate-600">{a.detail}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No activity yet.</Empty>}
      </Card>
    </div>
  );
}
