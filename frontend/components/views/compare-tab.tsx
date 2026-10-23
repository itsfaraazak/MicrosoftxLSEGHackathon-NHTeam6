"use client";
import { AllocationDonut } from "@/components/allocation-donut";
import { ENGINE_SOURCE, ProvenanceChip } from "@/components/provenance-chip";
import { ErrorNotice, InlineContractNotice, Working } from "@/components/query-state";
import { useAppState } from "@/lib/app-state";
import { OverlapScoreSchema, readEnhancement, type Portfolio } from "@/lib/api";
import { startDemoPrep, useDemoPrep } from "@/lib/demo-prep";
import { fractionPct, possessive, tickerName, usd } from "@/lib/display";
import { PERSONAS, type Persona } from "@/lib/personas";
import type { Portfolio as PortfolioT } from "@/lib/api";

function PersonCard({
  person,
  portfolio,
  isYou,
  yours,
}: {
  person: Persona;
  portfolio: Portfolio;
  isYou: boolean;
  yours?: boolean;
}) {
  const overlap = readEnhancement(OverlapScoreSchema, portfolio.overlap_score, `${person.name}.overlap_score`);
  const top = [...portfolio.positions].sort((a, b) => b.amount_usd - a.amount_usd).slice(0, 3);
  return (
    <article
      className={`tile flex flex-col gap-3 rounded-2xl p-4 ${isYou ? "border-primary ring-2 ring-primary/40" : ""}`}
      aria-label={`${possessive(person.name)} plan`}
    >
      <header>
        <p className="mb-1 text-[13px] font-bold text-primary">
          {yours ? "You" : isYou ? "You are viewing this one" : "Example person, not you"}
        </p>
        <h3 className="font-heading text-lg font-semibold">{yours ? "Your plan" : person.name}</h3>
        <p className="text-sm text-muted-foreground">{person.job}</p>
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
  const { plan, persona, profile } = useAppState();
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
  // A custom user is not one of the three examples, so their own plan goes first.
  const mine: PortfolioT | undefined = persona === "custom" ? plan?.portfolio : undefined;
  const mineAs: Persona = { id: "custom", name: "You", chip: "You", job: profile?.job_title || "Your own profile", text: "" };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] text-muted-foreground">
        The same $100,000 for different lives. The three people below are <strong>fictional examples</strong>, shown so you can see how
        SPARK changes the plan for a different job and goal.
        {mine ? " The highlighted card is yours." : " The highlighted card is the person you are viewing."}
      </p>
      {portfolios.length !== PERSONAS.length && (
        <InlineContractNotice message={`expected ${PERSONAS.length} portfolios, got ${portfolios.length}`} />
      )}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {mine && <PersonCard person={mineAs} portfolio={mine} isYou yours />}
        {PERSONAS.slice(0, portfolios.length).map((person, i) => (
          <PersonCard key={person.id} person={person} portfolio={portfolios[i]} isYou={persona === person.id} />
        ))}
      </div>
    </div>
  );
}
