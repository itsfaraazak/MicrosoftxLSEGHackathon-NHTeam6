"use client";
import { motion } from "motion/react";
import { fractionPct } from "@/lib/display";

const R = 74;
const CY = 80;
const MID = 230;
const SPRING = { type: "spring", stiffness: 60, damping: 16 } as const;

// Purely visual: more overlap pulls the circles together. Tangent at 0, coincident at 1. No finance maths.
function separation(overlap: number): number {
  return 2 * R * (1 - overlap);
}

export function OverlapRings({
  overlap,
  baseline,
  industry,
}: {
  overlap: number;
  baseline?: number;
  industry: string;
}) {
  const to = separation(overlap);
  // Only animate from a baseline if the backend sent one. Never invent a starting point.
  const from = baseline === undefined ? to : separation(baseline);
  const alt = `Two circles, your paycheck in ${industry} and your savings. They overlap by ${fractionPct(overlap)}.`;
  return (
    <div>
      <svg viewBox="0 0 460 160" role="img" aria-label={alt} className="h-auto w-full">
        <motion.circle
          r={R}
          cy={CY}
          fill="var(--primary)"
          fillOpacity={0.2}
          stroke="var(--primary)"
          strokeWidth={2}
          initial={{ cx: MID - from / 2, opacity: 0 }}
          animate={{ cx: MID - to / 2, opacity: 1 }}
          transition={SPRING}
        />
        <motion.circle
          r={R}
          cy={CY}
          fill="var(--plan)"
          fillOpacity={0.2}
          stroke="var(--plan)"
          strokeWidth={2}
          initial={{ cx: MID + from / 2, opacity: 0 }}
          animate={{ cx: MID + to / 2, opacity: 1 }}
          transition={SPRING}
        />
        <text x={MID} y={CY + 10} fontSize={30} fill="var(--foreground)" fontWeight={700} textAnchor="middle" className="money" fontFamily="var(--font-heading)">
          {fractionPct(overlap)}
        </text>
      </svg>
      <div className="mt-1 flex justify-between gap-4 text-base font-bold">
        <span className="text-primary">
          Your paycheck <span className="block text-sm font-semibold text-muted-foreground">{industry}</span>
        </span>
        <span className="text-right text-plan">Your savings</span>
      </div>
    </div>
  );
}
