"use client";
import { useState } from "react";
import { AllocationDonut, sliceColor } from "@/components/allocation-donut";
import { FactChip } from "@/components/fact-chip";
import { FactDrawer } from "@/components/fact-drawer";
import { OverlapRings } from "@/components/overlap-rings";
import { PanelBody, PanelHead } from "@/components/panel";
import { ENGINE_SOURCE, ProvenanceChip } from "@/components/provenance-chip";
import { InlineContractNotice } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompareTab } from "@/components/views/compare-tab";
import { useAppState } from "@/lib/app-state";
import { OverlapScoreSchema, TextEnhancementSchema, readEnhancement, type Fact, type Position } from "@/lib/api";
import { fractionPct, possessive, tickerName, usd } from "@/lib/display";
import { cn } from "@/lib/utils";
import { goToView } from "@/lib/views";

function BucketTile({ label, amount, asOf }: { label: string; amount: number; asOf: string }) {
  return (
    <div className="tile flex flex-col gap-1.5 rounded-2xl p-4">
      <div className="text-sm font-semibold text-muted-foreground">{label}</div>
      <div className="money font-heading text-[clamp(20px,2.2vw,28px)] leading-tight font-semibold">{usd(amount)}</div>
      <ProvenanceChip source={ENGINE_SOURCE} asOf={asOf} className="self-start" />
    </div>
  );
}

function Holding({
  position,
  index,
  open,
  onToggle,
  onHover,
}: {
  position: Position;
  index: number;
  open: boolean;
  onToggle: () => void;
  onHover: (i: number | null) => void;
}) {
  const name = readEnhancement(TextEnhancementSchema, position.display_name, `${position.ticker}.display_name`);
  const reason = readEnhancement(TextEnhancementSchema, position.reason, `${position.ticker}.reason`);
  const detailId = `why-${position.ticker}-${index}`;
  return (
    <li onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(null)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={onToggle}
        className={cn(
          "grid w-full grid-cols-[12px_64px_1fr_auto] items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left",
          open ? "tile" : "border-transparent hover:bg-tile-hover",
        )}
      >
        <span aria-hidden className="size-3 rounded" style={{ background: sliceColor(index) }} />
        <span className="font-bold">{position.ticker}</span>
        <span className="truncate text-[0.95rem] text-muted-foreground">
          {name.status === "ok" ? name.value : tickerName(position.ticker)}
        </span>
        <span className="money font-bold">{usd(position.amount_usd)}</span>
      </button>
      {open && (
        <div id={detailId} className="mt-0.5 mb-2 ml-6 flex flex-col gap-2.5 rounded-r-xl border-l-2 border-primary bg-tile p-3.5">
          {reason.status === "ok" && <p>{reason.value}</p>}
          {reason.status === "mismatch" && <InlineContractNotice message={reason.message} />}
          {position.reason_facts.length === 0 ? (
            <p className="text-sm text-muted-foreground">The backend didn’t list any facts for this holding.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {position.reason_facts.map((f) => (
                <FactChip key={`${f.id}-${f.as_of}`} fact={f} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function mergeFacts(facts: Fact[], positions: Position[]): Fact[] {
  const seen = new Set<string>();
  return [...facts, ...positions.flatMap((p) => p.reason_facts)].filter((f) => {
    const key = `${f.id}|${f.source}|${f.as_of}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function PlanTab() {
  const { plan, profile } = useAppState();
  const [open, setOpen] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (!plan) return null;
  const { portfolio, explanation, facts } = plan;
  const industry = profile?.industry ?? "your job";
  const overlap = readEnhancement(OverlapScoreSchema, portfolio.overlap_score, "portfolio.overlap_score");
  const baseline = readEnhancement(OverlapScoreSchema, portfolio.baseline_overlap_score, "portfolio.baseline_overlap_score");

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="flex flex-col gap-4">
        <section aria-labelledby="overlap-title" className="tile flex flex-col gap-2 rounded-2xl p-4">
          <h3 id="overlap-title" className="text-sm font-semibold text-muted-foreground">
            How much your savings and your paycheck lean on the same things
          </h3>
          {overlap.status === "ok" && (
            <>
              <OverlapRings
                overlap={overlap.value}
                baseline={baseline.status === "ok" ? baseline.value : undefined}
                industry={industry}
              />
              <p className="text-[0.95rem]">
                Overlap between your savings and your job’s sector:{" "}
                <strong className="money">{fractionPct(overlap.value)}</strong>.
              </p>
              <ProvenanceChip source={ENGINE_SOURCE} asOf={portfolio.sim_date} className="self-start" />
            </>
          )}
          {overlap.status === "mismatch" && <InlineContractNotice message={overlap.message} />}
          {overlap.status === "absent" && (
            <p className="text-sm text-muted-foreground">The backend didn’t send an overlap score for this plan.</p>
          )}
        </section>
        <section aria-labelledby="why-title" className="tile flex flex-col gap-3 rounded-2xl p-4">
          <h3 id="why-title" className="text-sm font-semibold text-muted-foreground">Why this plan</h3>
          <p className="leading-relaxed">{explanation}</p>
          <FactDrawer facts={mergeFacts(facts, portfolio.positions)} />
        </section>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <BucketTile label="Safe bucket" amount={portfolio.safe_bucket_usd} asOf={portfolio.sim_date} />
          <BucketTile label="Growth bucket" amount={portfolio.growth_bucket_usd} asOf={portfolio.sim_date} />
        </div>
        <div className="grid items-center gap-4 sm:grid-cols-[170px_1fr]">
          <AllocationDonut positions={portfolio.positions} selected={hover ?? open} onSelect={setHover} />
          <div>
            <div className="mb-1.5 text-sm font-semibold text-muted-foreground">Select a holding to see why it’s there</div>
            <ul className="flex flex-col gap-0.5">
              {portfolio.positions.map((p, i) => (
                <Holding
                  key={`${p.ticker}-${i}`}
                  position={p}
                  index={i}
                  open={open === i}
                  onToggle={() => setOpen(open === i ? null : i)}
                  onHover={setHover}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PortfolioView() {
  const { plan, profile, persona } = useAppState();
  // A custom user is always "You", whatever name the parser guessed.
  const title = profile && persona !== "custom" ? `${possessive(profile.name)} ${usd(100000)} plan` : `Your ${usd(100000)} plan`;
  return (
    <>
      <PanelHead
        title={title}
        subtitle={
          profile
            ? `Built around a job in ${profile.industry.toLowerCase()} and what you told us about your goals.`
            : "Built around your job, your goals and what you already hold."
        }
      />
      <PanelBody>
        {!plan ? (
          <div className="tile flex flex-col items-start gap-3 rounded-2xl p-6">
            <p>Your plan appears here once we’ve read your profile.</p>
            <Button className="h-10 px-4 font-semibold" onClick={() => goToView("profile")}>
              Go to your profile
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="plan" className="gap-4">
            <TabsList className="h-10 self-start">
              <TabsTrigger value="plan" className="px-4 text-sm">Plan</TabsTrigger>
              <TabsTrigger value="compare" className="px-4 text-sm">Compare people</TabsTrigger>
            </TabsList>
            <TabsContent value="plan">
              <PlanTab />
            </TabsContent>
            <TabsContent value="compare">
              <CompareTab />
            </TabsContent>
          </Tabs>
        )}
      </PanelBody>
    </>
  );
}
