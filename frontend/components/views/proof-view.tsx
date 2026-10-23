"use client";
import { AlertTriangle, Check, CircleHelp, ChevronDown, Copy, Download, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Component, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PanelBody, PanelHead } from "@/components/panel";
import { ErrorNotice, Working } from "@/components/query-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { Profile } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { longDate } from "@/lib/display";
import { useProof, type ProofClaim, type ProofMetric, type ProofRes, type ProofVerdict } from "@/lib/proof";
import { cn } from "@/lib/utils";

// Used only when the user has not built a profile yet, so the proof can still be shown. Labelled on screen.
const EXAMPLE_PROFILE: Profile = {
  name: "Priya", age: 29, job_title: "Software engineer", industry: "Fintech", employer: "London fintech (fictional)",
  location: "London", risk_tolerance: "high", experience: "some", emergency_fund_months: 4, high_interest_debt: false,
  past_behaviour: "Sold everything in March 2020", exclusions: [], contradictions: [],
  goals: [{ name: "House deposit", amount_usd: 30000, years_away: 5 }],
  holdings: [{ ticker: "QQQ", amount_usd: 15000, is_employer_stock: false }],
};

const METRIC_HELP: Record<string, string> = {
  cagr: "The average amount your money grew each year, as if growth was smooth.",
  volatility: "How bumpy the ride was. Lower means smaller day-to-day swings.",
  max_drawdown: "The biggest drop from a high point to a low point. Lower (closer to zero) hurts less.",
  sharpe: "Return earned for each unit of bumpiness. Higher means a smoother ride for the same gain.",
  tech_overlap: "How much of the mix sits in your own industry. Lower means less double exposure to your job.",
};

const VERDICT: Record<ProofVerdict, { title: string; Icon: typeof Check; tone: string; hint: string }> = {
  supported: {
    title: "Supported", Icon: Check, tone: "text-plan border-plan/40 bg-plan/10", hint: "We tested this on past prices and it held.",
  },
  not_supported: {
    title: "We tested this and it did NOT hold", Icon: X, tone: "text-warn border-warn-line bg-warn-bg",
    hint: "We show this honestly, because a result that fails is still a result.",
  },
  inconclusive: {
    title: "Inconclusive", Icon: CircleHelp, tone: "text-muted-foreground border-border bg-tile", hint: "Not enough evidence to say either way.",
  },
};

const isPct = (m: { unit: string }) => m.unit === "%";
function fmt(m: { unit: string }, v: number): string {
  return isPct(m) ? `${(v * 100).toFixed(1)}%` : v.toFixed(2);
}
const pctPoints = (v: number) => `${(v * 100).toFixed(1)}%`;

function shortHash(h: string): string {
  return h.length > 12 ? h.slice(0, 12) : h;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/x-python" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function VerdictCard({ claim, data }: { claim: ProofClaim; data: ProofRes }) {
  const v = VERDICT[claim.verdict];
  const code = data.code.find((c) => c.id === claim.code_id);
  return (
    <li className={cn("rounded-2xl border p-4", v.tone)}>
      <div className="flex items-start gap-3">
        <v.Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{claim.claim}</p>
          <p className="mt-0.5 text-[0.95rem] font-semibold">{v.title}</p>
          <p className="text-[0.95rem] text-muted-foreground">{v.hint}</p>
          {claim.evidence.length > 0 && (
            <p className="mt-1 text-[13px] text-muted-foreground">
              Based on: {claim.evidence.map((e) => data.metrics.find((m) => m.id === e)?.label ?? e.replace(/^stress:/, "")).join(", ")}
              {code ? ` · result ${code.output}` : ""}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function MetricsTable({ data }: { data: ProofRes }) {
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-[520px] text-left text-sm">
        <caption className="sr-only">Strategy compared with the tech-heavy baseline</caption>
        <thead className="bg-tile text-[13px] text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Measure</th>
            <th scope="col" className="px-3 py-2 font-semibold">{data.strategy.name}</th>
            <th scope="col" className="px-3 py-2 font-semibold">{data.baseline.name}</th>
            <th scope="col" className="px-3 py-2 font-semibold">Result</th>
          </tr>
        </thead>
        <tbody>
          {data.metrics.map((m: ProofMetric) => (
            <tr key={m.id} className="border-t">
              <th scope="row" className="px-3 py-2 font-medium">
                <span title={METRIC_HELP[m.id] ?? m.label} className="cursor-help underline decoration-dotted underline-offset-4">
                  {m.label}
                </span>
                {METRIC_HELP[m.id] && <span className="block text-[13px] font-normal text-muted-foreground">{METRIC_HELP[m.id]}</span>}
              </th>
              <td className="money px-3 py-2">{fmt(m, m.strategy)}</td>
              <td className="money px-3 py-2">{fmt(m, m.baseline)}</td>
              <td className="px-3 py-2">
                <span className={cn("inline-flex items-center gap-1 font-semibold", m.better ? "text-plan" : "text-warn")}>
                  {m.better ? <Check aria-hidden className="size-4" /> : <AlertTriangle aria-hidden className="size-4" />}
                  {m.better ? "Better" : "Worse"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StressChart({ data }: { data: ProofRes }) {
  // On phones inactive views are display:none (zero size), so only measure the chart while Proof is on screen.
  const onScreen = useSearchParams().get("view") === "proof";
  const rows = data.stress.map((s) => ({ name: s.name, [data.strategy.name]: s.strategy * 100, [data.baseline.name]: s.baseline * 100 }));
  if (rows.length === 0) return null;
  const summary = data.stress
    .map((s) => `${s.name}: ${data.strategy.name} ${pctPoints(s.strategy)}, ${data.baseline.name} ${pctPoints(s.baseline)}`)
    .join("; ");
  return (
    <figure>
      <div role="img" aria-label={`Fall during past sell-offs. ${summary}`} className="h-[260px] w-full rounded-2xl border p-2">
        {onScreen && (
        <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={160}>
          <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <Tooltip
              formatter={(v) => `${Number(v).toFixed(1)}%`}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }}
            />
            <Legend />
            <Bar dataKey={data.strategy.name} fill="var(--plan)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            <Bar dataKey={data.baseline.name} fill="var(--compare)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
      <figcaption className="mt-1.5 text-[13px] text-muted-foreground">
        How far each mix fell in a real past sell-off. A smaller bar (closer to zero) means a gentler fall.
      </figcaption>
    </figure>
  );
}

function CodeBlock({ data, claim }: { data: ProofRes; claim: ProofClaim }) {
  const code = data.code.find((c) => c.id === claim.code_id);
  const [copied, setCopied] = useState(false);
  if (!code) return null;
  async function copy() {
    try {
      await navigator.clipboard.writeText(code!.source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <details className="group rounded-2xl border bg-tile">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-base font-semibold">
        <span>Show me the code: {code.title}</span>
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <p className="text-[13px] text-muted-foreground">
          This is the exact function that produced the number. Its fingerprint (SHA-256){" "}
          <code className="font-mono" title={code.sha256}>{shortHash(code.sha256)}</code> proves the code was not changed after the fact.
        </p>
        <pre tabIndex={0} aria-label={`Source code for ${code.title}`} className="overflow-x-auto rounded-xl border bg-background p-3 font-mono text-[13px] leading-relaxed">
          <code>{code.source}</code>
        </pre>
        <div>
          <p className="text-[13px] font-semibold text-muted-foreground">It printed:</p>
          <pre className="overflow-x-auto rounded-xl border bg-background p-3 font-mono text-[13px]"><code>{code.output}</code></pre>
        </div>
        <button type="button" onClick={copy} className="glass inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold hover:bg-tile-hover">
          <Copy aria-hidden className="size-4" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </details>
  );
}

// A malformed-but-valid response must never blank the panel: show a notice and keep the rest of the app alive.
class ProofBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("Proof view failed to render", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <p role="alert" className="rounded-xl border border-warn-line bg-warn-bg px-4 py-3">
        The proof came back in a shape we couldn’t display. Switch view and back to try again.
      </p>
    );
  }
}

export function ProofView() {
  const { profile, plan, clock } = useAppState();
  const usingExample = profile === null;
  const q = useProof(profile ?? EXAMPLE_PROFILE, plan?.portfolio ?? null, clock.date);
  const data = q.data;

  return (
    <>
      <PanelHead
        title="Proof, not promises"
        subtitle="Every claim about your plan is tested on past prices by real code you can read, copy and re-run."
        actions={
          data && (
            <button
              type="button"
              onClick={() => download("reproduce_proof.py", data.script)}
              className="glass inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold hover:bg-tile-hover"
            >
              <Download aria-hidden className="size-4" />
              Download reproducible script
            </button>
          )
        }
      />
      <PanelBody className="space-y-6">
        {usingExample && (
          <p className="rounded-xl border bg-tile px-3 py-2 text-sm text-muted-foreground">
            No profile built yet, so this proof uses an example profile (Priya, software engineer).
          </p>
        )}
        {!data && !q.isError && (
          <div className="space-y-3">
            <Working label="Running the tests on past prices" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        )}
        {q.isError && <ErrorNotice error={q.error} onRetry={() => void q.refetch()} />}
        {data && (
          <ProofBoundary>
            <p className="text-[0.95rem] text-muted-foreground">
              Tested on prices from {longDate(data.window.from)} to {longDate(data.window.to)}, the day before {longDate(data.sim_date)}.
              Nothing after that date was used.
            </p>
            <section aria-labelledby="proof-claims" className="space-y-3">
              <h3 id="proof-claims" className="font-heading text-lg font-semibold">What we claim, and whether it held</h3>
              <ul className="space-y-3">
                {data.claims.map((c) => <VerdictCard key={c.id} claim={c} data={data} />)}
              </ul>
            </section>
            <section aria-labelledby="proof-metrics" className="space-y-3">
              <h3 id="proof-metrics" className="font-heading text-lg font-semibold">Your mix against a tech-heavy one</h3>
              <MetricsTable data={data} />
            </section>
            <section aria-labelledby="proof-stress" className="space-y-3">
              <h3 id="proof-stress" className="font-heading text-lg font-semibold">How each held up in real sell-offs</h3>
              <StressChart data={data} />
            </section>
            <section aria-labelledby="proof-code" className="space-y-3">
              <h3 id="proof-code" className="font-heading text-lg font-semibold">Show me the code</h3>
              {data.claims.map((c) => (
                <div key={c.id} className="space-y-1.5">
                  <p className="text-sm font-medium">{c.claim}</p>
                  <CodeBlock data={data} claim={c} />
                </div>
              ))}
            </section>
            {data.caveats.length > 0 && (
              <section aria-labelledby="proof-caveats" className="space-y-2">
                <h3 id="proof-caveats" className="font-heading text-lg font-semibold">Things to keep in mind</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {data.caveats.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </section>
            )}
          </ProofBoundary>
        )}
      </PanelBody>
    </>
  );
}
