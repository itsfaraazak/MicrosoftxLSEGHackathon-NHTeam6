"use client";
import { useAppState } from "@/lib/app-state";
import { longDate } from "@/lib/display";

const R = 11;
const CIRC = 2 * Math.PI * R;

export function SimClock() {
  const { clock } = useAppState();
  const filled = Math.max(0, Math.min(1, clock.progress)) * CIRC;
  return (
    <div className="glass flex items-center gap-3 rounded-full py-2 pr-4 pl-2.5">
      <svg viewBox="0 0 26 26" className="size-[26px] flex-none" aria-hidden>
        <circle cx="13" cy="13" r={R} fill="none" stroke="var(--border)" strokeWidth="2" />
        <circle
          cx="13"
          cy="13"
          r={R}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRC}`}
          transform="rotate(-90 13 13)"
          className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
        />
        <circle cx="13" cy="13" r="2.5" fill="var(--primary)" />
      </svg>
      <div className="flex flex-col leading-tight" role="status" aria-live="polite">
        <span className="money text-sm font-bold">Simulation date: {longDate(clock.date)}</span>
        <span className="text-xs text-muted-foreground">Nothing after this date is visible</span>
      </div>
    </div>
  );
}
