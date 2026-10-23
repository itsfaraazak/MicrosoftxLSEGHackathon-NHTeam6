"use client";
import { useAppState } from "@/lib/app-state";
import { longDate } from "@/lib/display";

const R = 11;
const CIRC = 2 * Math.PI * R;

// The simulation date and the promise that nothing after it is visible. Short copy on phones.
export function SimClock() {
  const { clock } = useAppState();
  const filled = Math.max(0, Math.min(1, clock.progress)) * CIRC;
  return (
    <div className="glass flex min-w-0 items-center gap-2 rounded-full py-1.5 pr-3 pl-2 md:gap-3 md:py-2 md:pr-4 md:pl-2.5">
      <svg viewBox="0 0 26 26" className="size-6 flex-none md:size-[26px]" aria-hidden>
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
      <div className="flex min-w-0 flex-col leading-tight" role="status" aria-live="polite">
        <span className="money truncate text-[15px] font-bold md:text-sm">
          <span className="sr-only md:not-sr-only">Simulation date: </span>
          {longDate(clock.date)}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          <span className="md:hidden">Future hidden</span>
          <span className="hidden md:inline">Nothing after this date is visible</span>
        </span>
      </div>
    </div>
  );
}
