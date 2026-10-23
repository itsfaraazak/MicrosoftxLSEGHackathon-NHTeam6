// Small inline pills for the "rigor" surface, styled to match ProvenanceChip. Presentational only —
// no data fetching here, everything comes in via props so these can render anywhere safely.
import { longDate } from "@/lib/display";
import type { Meta } from "@/lib/rigor-schema";
import { cn } from "@/lib/utils";

function Chip({ dotClassName, children, className }: { dotClassName: string; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "tile inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", dotClassName)} />
      {children}
    </span>
  );
}

export function CodeDecidedChip({ className }: { className?: string }) {
  return (
    <Chip dotClassName="bg-primary" className={className}>
      Code decided
    </Chip>
  );
}

export function AiExplainedChip({ className }: { className?: string }) {
  return (
    <Chip dotClassName="bg-violet-500" className={className}>
      AI explained
    </Chip>
  );
}

export function NumbersVerifiedChip({ count, className }: { count?: number; className?: string }) {
  return (
    <Chip dotClassName="bg-emerald-500" className={className}>
      {typeof count === "number" ? `${count} number${count === 1 ? "" : "s"} verified` : "Numbers verified"}
    </Chip>
  );
}

export function DataAsOfChip({ date, className }: { date: string; className?: string }) {
  return (
    <Chip dotClassName="bg-amber-500" className={className}>
      Data as of {longDate(date)}
    </Chip>
  );
}

export function MetaSummaryChip({ meta, className }: { meta?: Meta; className?: string }) {
  if (!meta) {
    return (
      <Chip dotClassName="bg-muted-foreground" className={className}>
        No rigor metadata for this answer
      </Chip>
    );
  }
  const checked = meta.number_check?.numbers_checked ?? 0;
  const rejected = meta.number_check?.rejected?.length ?? 0;
  const seconds = (meta.latency_ms / 1000).toFixed(1);
  const model = meta.model ?? "unknown model";
  return (
    <Chip dotClassName="bg-primary" className={className}>
      {`This answer: checked ${checked} number${checked === 1 ? "" : "s"}, ${rejected} rejected, ${seconds}s, model ${model}`}
    </Chip>
  );
}
