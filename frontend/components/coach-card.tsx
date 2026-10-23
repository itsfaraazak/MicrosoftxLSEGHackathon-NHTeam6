"use client";
import { motion } from "motion/react";
import { useState } from "react";
import { ProvenanceChip } from "@/components/provenance-chip";
import { InlineContractNotice } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { TextEnhancementSchema, readEnhancement, type GuardEvent } from "@/lib/api";
import { usd } from "@/lib/display";

const GUARD_SOURCE = "Guard engine";

type Act = "hold" | "rebalance" | "sell" | "human";

const SUGGESTION: Record<GuardEvent["suggested_action"], string> = {
  hold: "Hold",
  rebalance: "Rebalance",
  move_to_safe: "Move some money to the safe bucket",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="money font-bold">{value}</dd>
    </div>
  );
}

// The Guard coach. Buttons only acknowledge: nothing is traded or computed here.
export function CoachCard({ event }: { event: GuardEvent }) {
  const [ack, setAck] = useState<Act | null>(null);
  const message = readEnhancement(TextEnhancementSchema, event.coach_message, "event.coach_message");
  const reply: Record<Act, string> = {
    hold: "Noted: you’re holding. Nothing was changed.",
    rebalance: "Noted: you chose to rebalance. In the full version you’d confirm the trades on the next screen.",
    sell: `Understood. Selling now would lock in ${usd(event.cost_of_selling_usd)}. In the full version you’d confirm this on the next screen.`,
    human: "In a real launch, this connects you to an FCA-authorised adviser.",
  };
  const suggested = event.suggested_action;

  return (
    <motion.section
      aria-label="Coach"
      initial={{ opacity: 0, rotateY: -28, x: 24 }}
      animate={{ opacity: 1, rotateY: 0, x: 0 }}
      transition={{ type: "spring", stiffness: 110, damping: 16 }}
      style={{ transformPerspective: 800, transformOrigin: "100% 50%" }}
      className="rounded-2xl border border-warn-line bg-warn-bg p-3.5"
    >
      <h3 className="mb-1.5 font-heading text-base font-semibold">Your coach has something to say</h3>
      {message.status === "ok" && <p className="mb-2.5 leading-snug">{message.value}</p>}
      {message.status === "mismatch" && <div className="mb-3"><InlineContractNotice message={message.message} /></div>}

      <dl className="mb-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
        <Stat label="Fall from the peak" value={`${Math.abs(event.drawdown_pct)}%`} />
        <Stat label="Years to your goal" value={String(event.goal_years_away)} />
        <Stat label="Loss locked in by selling" value={usd(event.cost_of_selling_usd)} />
        <Stat label="Where the fall is" value={event.market_wide ? "Market-wide" : "Your holdings only"} />
      </dl>
      <ProvenanceChip source={GUARD_SOURCE} asOf={event.sim_date} className="mb-2.5" />

      <p className="mb-2 text-sm">
        Suggested: <strong>{SUGGESTION[suggested]}</strong>. The decision is yours.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={suggested === "hold" ? "default" : "outline"}
          className="h-9 px-3.5 font-semibold"
          onClick={() => setAck("hold")}
        >
          Hold
        </Button>
        <Button
          variant={suggested === "rebalance" ? "default" : "outline"}
          className="h-9 px-3.5 font-semibold"
          onClick={() => setAck("rebalance")}
        >
          Rebalance
        </Button>
        <Button variant="outline" className="h-9 px-3.5 font-semibold" onClick={() => setAck("sell")}>
          I still want to sell
        </Button>
      </div>
      <button
        type="button"
        onClick={() => setAck("human")}
        className="mt-2.5 text-sm font-semibold text-primary underline underline-offset-4"
      >
        Talk to a human adviser
      </button>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-muted-foreground">
        {ack ? reply[ack] : ""}
      </p>
    </motion.section>
  );
}
