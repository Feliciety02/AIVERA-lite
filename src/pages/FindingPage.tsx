import { useState } from "react";
import { Link, useParams } from "react-router";
import { Check, RotateCcw, Sparkles, X } from "lucide-react";
import { api, CATEGORY, fmtDate, type Finding, type FindingAi, type Level } from "../api";
import { useApi } from "../useApi";
import { Button, Card, Empty, ErrorText, Field, Loading, Note, PageTitle, Pre, Select, SeverityBadge, StatusBadge, Textarea } from "../components/ui";

const LEVELS: Level[] = ["low", "medium", "high"];
const SCORE = { low: 1, medium: 2, high: 3 };
const riskOf = (l: Level, i: Level) => {
  const s = SCORE[l] * SCORE[i];
  return s >= 9 ? "critical" : s >= 6 ? "high" : s >= 3 ? "medium" : s >= 2 ? "low" : "info";
};

export default function FindingPage() {
  const { id } = useParams();
  const { data: f, error, reload, setData } = useApi<Finding>(`/findings/${id}`);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!f) return <Loading />;

  const explain = async () => {
    setAiBusy(true);
    setAiError("");
    try {
      setData({ ...f, aiAnalysis: await api<FindingAi>(`/findings/${f.id}/ai`, { method: "POST" }) });
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };
  const ai = f.aiAnalysis;

  return (
    <div className="space-y-6">
      <PageTitle
        title={f.title}
        subtitle={<span className="flex flex-wrap items-center gap-2"><SeverityBadge severity={f.severity} /><StatusBadge status={f.status} /> <Link to={`/websites/${f.target.id}`} className="text-primary hover:underline">{f.target.name}</Link> · {CATEGORY[f.category] ?? f.category} · {f.source}</span>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title="What the tool found">
            <dl className="space-y-4 text-sm">
              <div><dt className="mb-1 font-medium">Affected</dt><dd className="font-mono text-xs break-all">{f.affectedUrl}</dd></div>
              <div><dt className="mb-1 font-medium">Description</dt><dd className="text-slate-700">{f.description}</dd></div>
              <div><dt className="mb-1 font-medium">Evidence</dt><dd><Pre>{f.evidence}</Pre></dd></div>
              <div><dt className="mb-1 font-medium">Recommendation</dt><dd className="text-slate-700">{f.recommendation || "None given"}</dd></div>
            </dl>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-violet-600" /> AI explanation</span>}
            actions={<Button variant="outline" busy={aiBusy} onClick={explain}>{ai ? "Ask again" : "Explain with AI"}</Button>}
          >
            <ErrorText>{aiError}</ErrorText>
            {aiBusy && <p className="text-sm text-slate-500">The AI is reading the evidence. A local model can take a minute.</p>}
            {ai ? (
              <div className="space-y-4 text-sm">
                <p>{ai.explanation}</p>
                {ai.impact && <p><span className="font-medium">If it is real: </span>{ai.impact}</p>}
                {ai.suggestedSeverity && <p><span className="font-medium">Suggested severity: </span><SeverityBadge severity={ai.suggestedSeverity as Finding["severity"]} /> {ai.severityReason}</p>}
                {!!ai.verifySteps.length && <div><h3 className="mb-1 font-medium">How to check it yourself</h3><ol className="list-decimal space-y-1 pl-5">{ai.verifySteps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>}
                {!!ai.fixSteps.length && <div><h3 className="mb-1 font-medium">How to fix it</h3><ol className="list-decimal space-y-1 pl-5">{ai.fixSteps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>}
                <Note tone="ai">Written by AI ({ai.model}, confidence {ai.confidence}) on {fmtDate(ai.generatedAt)}. It is advice only and can be wrong.</Note>
              </div>
            ) : !aiBusy && <Empty>Ask the AI to explain this finding, how to check it and how to fix it.</Empty>}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Verify finding={f} onSaved={reload} />
        </div>
      </div>
    </div>
  );
}

/** 06 Findings verification and 07 Risk assessment. */
function Verify({ finding: f, onSaved }: { finding: Finding; onSaved: () => void }) {
  const [likelihood, setLikelihood] = useState<Level>(f.likelihood ?? "medium");
  const [impact, setImpact] = useState<Level>(f.impact ?? "medium");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const decide = async (decision: "confirmed" | "rejected" | "unverified") => {
    setBusy(true);
    setError("");
    try {
      await api(`/findings/${f.id}/verify`, { body: { decision, likelihood, impact, note } });
      setNote("");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (f.status !== "unverified")
    return (
      <Card title="Verification">
        <div className="space-y-3 text-sm">
          <p><StatusBadge status={f.status} /> on {fmtDate(f.verifiedAt)}</p>
          {f.status === "confirmed" && f.likelihood && f.impact && (
            <p>Likelihood <b className="capitalize">{f.likelihood}</b> × impact <b className="capitalize">{f.impact}</b> = risk <SeverityBadge severity={f.severity} /></p>
          )}
          <p className="rounded-lg bg-slate-50 p-3">{f.verifierNote}</p>
          <ErrorText>{error}</ErrorText>
          <Button variant="outline" busy={busy} onClick={() => decide("unverified")}><RotateCcw /> Reopen</Button>
        </div>
      </Card>
    );

  return (
    <Card title="Verify this finding">
      <div className="space-y-4">
        <Note>The tools and the AI only point at possible problems. Check the evidence yourself (for example in browser developer tools or with curl), then confirm or reject it.</Note>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Likelihood"><Select value={likelihood} onChange={(e) => setLikelihood(e.target.value as Level)}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</Select></Field>
          <Field label="Impact"><Select value={impact} onChange={(e) => setImpact(e.target.value as Level)}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</Select></Field>
        </div>
        <p className="text-sm">Risk if confirmed: <SeverityBadge severity={riskOf(likelihood, impact)} /></p>
        <Field label="How did you check it?"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Example: Opened the page in DevTools, Network tab, response has no Content-Security-Policy header." /></Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex flex-wrap gap-2">
          <Button busy={busy} onClick={() => decide("confirmed")}><Check /> Confirm</Button>
          <Button variant="outline" disabled={busy} onClick={() => decide("rejected")}><X /> False alarm</Button>
        </div>
      </div>
    </Card>
  );
}
