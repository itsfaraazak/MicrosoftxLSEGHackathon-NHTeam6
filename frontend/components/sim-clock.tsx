"use client";
import { useAppState } from "@/lib/app-state";
import { longDate } from "@/lib/display";

const R = 11;
const CIRC = 2 * Math.PI * R;

export function SimClock() {
  const { clock } = useAppState();
  const filled = Math.max(0, Math.min(1, clock.progress)) * CIRC;
  return (
    <div className="glass flex min-w-0 items-center gap-3 rounded-full py-2 pr-4 pl-2.5">
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
      {/* Capping width + truncating here matters beyond cosmetics: without it this span's
          full unwrapped text is the max-content contribution that CSS Grid's "auto" header
          column grows toward, which pushed the whole top bar past the viewport on phones. */}
      <div className="flex min-w-0 flex-col leading-tight" role="status" aria-live="polite">
        <span className="money max-w-[42vw] truncate text-sm font-bold sm:max-w-none">
          Simulation date: {longDate(clock.date)}
        </span>
        <span className="max-w-[42vw] truncate text-xs text-muted-foreground sm:max-w-none">
          Nothing after this date is visible
        </span>
      </div>
    </div>
  );
}
