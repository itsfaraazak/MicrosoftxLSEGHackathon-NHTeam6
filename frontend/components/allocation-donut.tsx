"use client";
import type { Position } from "@/lib/api";
import { cn } from "@/lib/utils";
import { tickerName, usd } from "@/lib/display";

const R = 44;
const C = 2 * Math.PI * R;
const SLICE_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)",
  "var(--chart-6)", "var(--chart-7)", "var(--chart-8)", "var(--chart-9)",
];
export const sliceColor = (i: number) => SLICE_COLORS[i % SLICE_COLORS.length];

// Slice length = amount / total, a purely visual ratio.
export function AllocationDonut({
  positions,
  selected,
  onSelect,
  className,
  compact = false,
}: {
  positions: Position[];
  selected: number | null;
  onSelect: (i: number | null) => void;
  className?: string;
  compact?: boolean;
}) {
  const total = positions.reduce((sum, p) => sum + p.amount_usd, 0);
  let offset = 0;
  const label = `Allocation: ${positions.map((p) => `${tickerName(p.ticker)} ${usd(p.amount_usd)}`).join(", ")}`;
  return (
    <div className={cn("relative mx-auto aspect-square w-full max-w-[220px]", className)}>
      <svg viewBox="0 0 120 120" role="img" aria-label={label} className="size-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--border)" strokeWidth="16" />
        {total > 0 &&
          positions.map((p, i) => {
            const len = (p.amount_usd / total) * C;
            const el = (
              <circle
                key={`${p.ticker}-${i}`}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={sliceColor(i)}
                strokeWidth={selected === i ? 20 : 16}
                strokeDasharray={`${Math.max(len - 1, 0)} ${C - Math.max(len - 1, 0)}`}
                strokeDashoffset={-offset}
                opacity={selected === null || selected === i ? 1 : 0.35}
                className="cursor-pointer transition-[stroke-width,opacity] duration-200"
                onMouseEnter={() => onSelect(i)}
                onMouseLeave={() => onSelect(null)}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      {!compact && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-sm font-semibold text-muted-foreground">Your plan</div>
          <div className="text-sm font-bold">{positions.length} holdings</div>
        </div>
      </div>}
    </div>
  );
}
