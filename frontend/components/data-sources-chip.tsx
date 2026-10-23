"use client";
import { Info } from "lucide-react";
import { useState } from "react";
import { ErrorNotice, Working } from "@/components/query-state";
import { ORIGIN_KINDS, OriginTag, originHelp } from "@/components/origin-tag";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { longDate } from "@/lib/display";
import { useDataSources } from "@/lib/live";
import type { DataSourceRow } from "@/lib/live-schema";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<DataSourceRow["kind"], string> = { real: "Real data", curated: "Curated", mock: "Mock" };
const KIND_VARIANT: Record<DataSourceRow["kind"], "default" | "secondary" | "outline"> = {
  real: "default",
  curated: "secondary",
  mock: "outline",
};

// Plain-language "whose data is this" guide. Kept in the UI (not fetched) because it describes the app, not a data feed.
const GUIDE: { title: string; body: string }[] = [
  {
    title: "About you",
    body: "What you type on My profile. Priya, Tom and Fiona are fictional people we invented: picking one just fills the box with their story. “Write your own” starts empty, and then everything on screen is about you.",
  },
  {
    title: "Real market history",
    body: "Daily closing prices of 17 ETFs (Yahoo Finance), US inflation and interest rates (FRED) and tech layoff counts (layoffs.fyi), downloaded once. A simulation clock hides everything after the simulation date, so a plan built on 3 Jan 2022 never sees the future.",
  },
  {
    title: "Rules, not guesses",
    body: "Plain code, not AI, chooses the holdings and amounts. The share of tech inside each fund is an approximate end-2021 figure.",
  },
  {
    title: "AI wording",
    body: "The AI only explains the result in words. Every number in its text is checked against the facts first; an answer that fails the check is thrown away.",
  },
  {
    title: "Examples, not you",
    body: "The Compare tab shows three demo people next to each other. A Proof claim may be tested on an example portfolio when you haven’t built a plan yet. Both are labelled.",
  },
];

const STATUS: { label: string; body: string }[] = [
  { label: "Backend connected", body: "Live calculations from the SPARK server." },
  { label: "Mock data", body: "Saved sample answers: the screens work but nothing is calculated for you." },
  { label: "Offline demo data", body: "The server was unreachable, so saved sample answers are shown." },
];

export function DataSourcesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const sources = useDataSources(open);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">Where the numbers come from</SheetTitle>
          <SheetDescription>Whose data is whose, and what is real.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-8">
          <section aria-label="How to read SPARK" className="flex flex-col gap-3">
            {GUIDE.map((g) => (
              <div key={g.title}>
                <h3 className="text-base font-bold">{g.title}</h3>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{g.body}</p>
              </div>
            ))}
          </section>
          <section aria-label="Labels" className="tile rounded-2xl p-3.5">
            <h3 className="mb-2 text-base font-bold">The small labels you will see</h3>
            <ul className="flex flex-col gap-2.5">
              {ORIGIN_KINDS.map((k) => (
                <li key={k} className="flex flex-col items-start gap-1">
                  <OriginTag kind={k} />
                  <span className="text-[15px] text-muted-foreground">{originHelp(k)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="Status badge" className="tile rounded-2xl p-3.5">
            <h3 className="mb-1.5 text-base font-bold">What the status badge means</h3>
            <ul className="flex flex-col gap-1.5 text-[15px]">
              {STATUS.map((s) => (
                <li key={s.label}>
                  <strong>{s.label}.</strong> <span className="text-muted-foreground">{s.body}</span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="Data files" className="flex flex-col gap-3">
            <h3 className="text-base font-bold">Data files on the server</h3>
            {sources.isPending && <Working label="Loading data sources" />}
            {sources.isError && <ErrorNotice error={sources.error} onRetry={() => void sources.refetch()} />}
            {sources.data?.map((row) => (
              <div key={row.id} className="tile flex flex-col gap-1.5 rounded-2xl p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[0.95rem]">{row.label}</strong>
                  <Badge variant={KIND_VARIANT[row.kind]}>{KIND_LABEL[row.kind]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{row.provider}</p>
                <p className="text-sm text-muted-foreground">
                  {row.rows.toLocaleString()} rows
                  {row.from && row.to ? (
                    <>
                      {" "}
                      · {longDate(row.from)} to {longDate(row.to)}
                    </>
                  ) : null}
                </p>
              </div>
            ))}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type Variant = "chip" | "link";

export const DATA_SOURCES_MENU_CLASS =
  "tile flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-base font-semibold hover:bg-tile-hover";

const STYLES: Record<Variant, string> = {
  chip: "tile inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap text-muted-foreground hover:bg-tile-hover",
  link: "inline-flex min-h-7 items-center gap-1 rounded-full px-1.5 text-[13px] font-semibold text-primary underline underline-offset-4",
};

// One trigger, three looks; each opens the same explainer sheet.
export function DataSourcesTrigger({ variant = "chip", className }: { variant?: Variant; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        aria-label="Where does this data come from? Open the explanation"
        className={cn(STYLES[variant], className)}
      >
        <Info aria-hidden className="size-3.5" />
        Data sources
      </button>
      <DataSourcesSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

export const DataSourcesChip = ({ className }: { className?: string }) => <DataSourcesTrigger variant="chip" className={className} />;
export const DataSourcesLink = () => <DataSourcesTrigger variant="link" />;
