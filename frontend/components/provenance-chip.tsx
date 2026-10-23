import { longDate, sourceLabel } from "@/lib/display";
import { cn } from "@/lib/utils";

// Source and as-of date, shown beside every number so each one can be traced.
export function ProvenanceChip({ source, asOf, className }: { source: string; asOf: string; className?: string }) {
  return (
    <span
      className={cn(
        "tile inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-primary" />
      {sourceLabel(source)} · as of {longDate(asOf)}
    </span>
  );
}

export const ENGINE_SOURCE = "Portfolio engine";
