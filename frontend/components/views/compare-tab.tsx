"use client";
import { AllocationDonut } from "@/components/allocation-donut";
import { ENGINE_SOURCE, ProvenanceChip } from "@/components/provenance-chip";
import { ErrorNotice, InlineContractNotice, Working } from "@/components/query-state";
import { useAppState } from "@/lib/app-state";
import { OverlapScoreSchema, readEnhancement, type Portfolio } from "@/lib/api";
import { startDemoPrep, useDemoPrep } from "@/lib/demo-prep";
import { fractionPct, tickerName, usd } from "@/lib/display";
import { PERSONAS, type Persona } from "@/lib/personas";

function PersonCard({ person, portfolio }: { person: Persona; portfolio: Portfolio }) {
  const overlap = readEnhancement(OverlapScoreSchema, portfolio.overlap_score, `${person.name}.overlap_score`);
  const top = [...portfolio.positions].sort((a, b) => b.amount_usd - a.amount_usd).slice(0, 3);
  return (
    <article className="tile flex flex-col gap-3 rounded-2xl p-4" aria-label={`${person.name}’s plan`}>
      <header>
        <h3 className="font-heading text-lg font-semibold">{person.name}</h3>
        <p className="text-sm text-muted-foreground">{person.job}</p>
        <p className="text-xs text-muted-foreground">Your input, not data from the backend</p>
      </header>
      <AllocationDonut positions={portfolio.positions} selected={null} onSelect={() => {}} className="max-w-[130px]" compact />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="font-semibold text-muted-foreground">Safe</div>
          <div className="money font-bold">{usd(portfolio.safe_bucket_usd)}</div>
        </div>
        <div>
          <div className="font-semibold text-muted-foreground">Growth</div>
          <div className="money font-bold">{usd(portfolio.growth_bucket_usd)}</div>
        </div>
      </div>
      <ul className="flex flex-col gap-1 text-[0.95rem]">
        {top.map((p) => (
          <li key={p.ticker} className="flex justify-between gap-2">
            <span className="truncate">
              <strong>{p.ticker}</strong> <span className="text-muted-foreground">{tickerName(p.ticker)}</span>
            </span>
            <span className="money font-bold">{usd(p.amount_usd)}</span>
          </li>
        ))}
      </ul>
      {overlap.status === "ok" && (
        <p className="text-sm">
          Overlap with job’s sector: <strong className="money">{fractionPct(overlap.value)}</strong>
        </p>
      )}
      {overlap.status === "mismatch" && <InlineContractNotice message={overlap.message} />}
      <ProvenanceChip source={ENGINE_SOURCE} asOf={portfolio.sim_date} className="self-start" />
    </article>
  );
}

export function CompareTab() {
  const { plan } = useAppState();
  const { prep, status } = useDemoPrep();
  const simDate = plan?.portfolio.sim_date;

  if (status.state === "error") {
    return <ErrorNotice error={status.error} onRetry={simDate ? () => startDemoPrep(simDate) : undefined} />;
  }
  if (!prep.compare) {
    return (
      <div className="tile flex min-h-40 items-center justify-center rounded-2xl p-6">
        <Working label="Preparing comparison" />
      </div>
    );
  }
  const { portfolios } = prep.compare;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Same $100,000, three different lives, three different plans.</p>
      {portfolios.length !== PERSONAS.length && (
        <InlineContractNotice message={`expected ${PERSONAS.length} portfolios, got ${portfolios.length}`} />
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {PERSONAS.slice(0, portfolios.length).map((person, i) => (
          <PersonCard key={person.id} person={person} portfolio={portfolios[i]} />
        ))}
      </div>
    </div>
  );
}
