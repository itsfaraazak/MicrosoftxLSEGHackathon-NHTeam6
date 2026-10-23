"use client";
import { Info } from "lucide-react";
import { useState } from "react";
import { ErrorNotice, Working } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { longDate } from "@/lib/display";
import { useDataSources } from "@/lib/live";
import type { DataSourceRow } from "@/lib/live-schema";

const KIND_LABEL: Record<DataSourceRow["kind"], string> = { real: "Real data", curated: "Curated", mock: "Mock" };
const KIND_VARIANT: Record<DataSourceRow["kind"], "default" | "secondary" | "outline"> = {
  real: "default",
  curated: "secondary",
  mock: "outline",
};

// Small provenance chip (same visual language as components/provenance-chip.tsx) that opens a sheet
// listing every data source behind the app's numbers.
export function DataSourcesChip({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const sources = useDataSources(open);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Where does this data come from?"
        aria-label="Where does this data come from? Open the list of data sources"
        className={`tile inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-tile-hover ${className ?? ""}`}
      >
        <Info aria-hidden className="size-3" />
        <span>Data sources</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-heading text-lg">Where this data comes from</SheetTitle>
            <SheetDescription>Every number in this app traces back to one of these sources.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-6">
            {sources.isPending && <Working label="Loading data sources" />}
            {sources.isError && <ErrorNotice error={sources.error} onRetry={() => void sources.refetch()} />}
            {sources.data?.map((row) => (
              <div key={row.id} className="tile flex flex-col gap-1.5 rounded-2xl p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[0.95rem]">{row.label}</strong>
                  <Badge variant={KIND_VARIANT[row.kind]}>{KIND_LABEL[row.kind]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {row.provider} · <code className="text-xs">{row.file}</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.rows.toLocaleString()} rows
                  {row.from && row.to ? (
                    <>
                      {" "}
                      · {longDate(row.from)}–{longDate(row.to)}
                    </>
                  ) : null}{" "}
                  · fetched {new Date(row.fetched_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
