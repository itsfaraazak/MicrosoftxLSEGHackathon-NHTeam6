"use client";
import { ArrowDownRight, ArrowUpRight, Check, Loader2, Minus, Radio } from "lucide-react";
import { useSyncExternalStore } from "react";
import { ErrorNotice, Working } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAppState } from "@/lib/app-state";
import { longDate } from "@/lib/display";
import { useLiveQuotes } from "@/lib/live";
import { cn } from "@/lib/utils";

function changeTone(pct: number) {
  if (pct > 0) return "text-plan";
  if (pct < 0) return "text-destructive";
  return "text-muted-foreground";
}

const usd2 = (n: number) => `$${n.toFixed(2)}`;

// Phones get a bottom sheet; wide screens a side sheet.
function useIsPhone(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia("(max-width: 859px)");
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia("(max-width: 859px)").matches,
    () => false,
  );
}

// Accurate per-tab effects of Go live, from the audit in docs/LIVE-DATA.md.
const TABS: { tab: string; effect: "changes" | "same" | "paused"; text: string }[] = [
  { tab: "Ask", effect: "changes", text: "Answers about recent prices and “do you have recent data?” use the live date." },
  { tab: "Proof", effect: "changes", text: "The back-test now runs up to the day before the live date, so its verdicts can change." },
  { tab: "Plan", effect: "same", text: "Same rules, same funds and amounts. The plan is just stamped with the new date. Rebuild it after going live." },
  { tab: "Compare", effect: "same", text: "Cached example people. Not rebuilt." },
  { tab: "Time machine", effect: "paused", text: "Always replays 2022–23, so it pauses while you are live." },
];

const NOT_LIVE = [
  "News, headlines, earnings or analyst views: SPARK has none.",
  "Intraday or second-by-second prices: only end-of-day closes.",
  "Individual company shares: only the 17 ETFs.",
  "How much tech etc. sits inside each fund: fixed estimates from the end of 2021.",
  "Tech layoffs: a copy that stops in March 2023.",
];

function EffectTag({ effect }: { effect: "changes" | "same" | "paused" }) {
  const label = effect === "changes" ? "Changes" : effect === "paused" ? "Paused" : "Same";
  const Icon = effect === "changes" ? Check : Minus;
  return (
    <span
      className={cn(
        "inline-flex w-[88px] flex-none items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-bold",
        effect === "changes" ? "border-plan/60 bg-plan/15" : "tile text-muted-foreground",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}

function TabEffects() {
  return (
    <section aria-label="What changes in each tab">
      <h3 className="mb-2 text-base font-bold">What changes in each tab</h3>
      <ul className="flex flex-col gap-2.5">
        {TABS.map((t) => (
          <li key={t.tab} className="flex items-start gap-3 text-[15px] leading-snug">
            <EffectTag effect={t.effect} />
            <span>
              <strong>{t.tab}.</strong> <span className="text-muted-foreground">{t.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NotLive() {
  return (
    <section aria-label="What is not live">
      <h3 className="mb-2 text-base font-bold">What is never live</h3>
      <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-snug text-muted-foreground">
        {NOT_LIVE.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}

function Intro({ onGoLive, pending, simDate }: { onGoLive: () => void; pending: boolean; simDate: string }) {
  return (
    <>
      <p className="text-base leading-relaxed">
        Right now SPARK is a <strong>2022 simulation</strong>: it can only see prices up to {longDate(simDate)}, on purpose. Go live
        switches it to today’s real closing prices.
      </p>
      <section aria-label="What Go live changes">
        <h3 className="mb-2 text-base font-bold">What it does</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-snug">
          <li>Downloads the newest daily closing prices for the 17 ETFs from Yahoo Finance.</li>
          <li>Moves the date at the top of the screen to the latest trading day.</li>
          <li>Plans you build next, Ask and Proof use that date. “Back to 2022” undoes it.</li>
        </ul>
        <p className="mt-2 text-[15px] leading-snug text-muted-foreground">
          What stays the same: the rules that choose the funds, the same 17 ETFs, and the AI only explains in words.
        </p>
      </section>
      <TabEffects />
      <NotLive />
      <Button size="lg" className="h-12 w-full text-base font-bold" onClick={onGoLive} disabled={pending}>
        {pending ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Radio aria-hidden className="size-5" />}
        {pending ? "Fetching today’s prices…" : "Go live now"}
      </Button>
    </>
  );
}

function LiveBody({ onBackTo2022, open }: { onBackTo2022: () => void; open: boolean }) {
  const { live } = useAppState();
  const quotes = useLiveQuotes(open);
  return (
    <>
      <div role="status" className="rounded-2xl border border-plan/60 bg-plan/15 p-3.5 text-base">
        <strong>Live is on.</strong> SPARK is using real closing prices up to{" "}
        <strong>{live.latestDate ? longDate(live.latestDate) : "today"}</strong>.
        <Button variant="outline" className="mt-3 h-11 w-full text-base font-semibold" onClick={onBackTo2022}>
          Back to 2022
        </Button>
      </div>
      <TabEffects />
      <NotLive />

      <section aria-label="Live prices" className="flex flex-col gap-3">
        <h3 className="text-base font-bold">Latest closing prices</h3>
        {quotes.isPending && <Working label="Loading live quotes" />}
        {quotes.isError && <ErrorNotice error={quotes.error} onRetry={() => void quotes.refetch()} />}
        {quotes.data && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="tile rounded-2xl p-3.5">
                <div className="text-sm font-semibold text-muted-foreground">3-month Treasury</div>
                <div className="money font-heading text-xl font-semibold">{quotes.data.rates.tb3ms ?? "n/a"}%</div>
              </div>
              <div className="tile rounded-2xl p-3.5">
                <div className="text-sm font-semibold text-muted-foreground">CPI, year over year</div>
                <div className="money font-heading text-xl font-semibold">{quotes.data.rates.cpi_yoy ?? "n/a"}%</div>
              </div>
            </div>
            <div className="tile overflow-x-auto rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="text-xs font-semibold text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3.5 py-2">Ticker</th>
                    <th scope="col" className="hidden px-3.5 py-2 sm:table-cell">Name</th>
                    <th scope="col" className="px-3.5 py-2 text-right">Close</th>
                    <th scope="col" className="px-3.5 py-2 text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.data.quotes.map((q) => (
                    <tr key={q.ticker} className="border-t border-border/60">
                      <td className="px-3.5 py-2.5 font-bold">{q.ticker}</td>
                      <td className="hidden max-w-[160px] truncate px-3.5 py-2.5 text-muted-foreground sm:table-cell">{q.name}</td>
                      <td className="money px-3.5 py-2.5 text-right font-semibold">{usd2(q.close)}</td>
                      <td className={cn("px-3.5 py-2.5 text-right font-semibold", changeTone(q.change_pct))}>
                        <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                          {q.change_pct > 0 ? <ArrowUpRight aria-hidden className="size-3.5" /> : q.change_pct < 0 ? <ArrowDownRight aria-hidden className="size-3.5" /> : null}
                          {q.change_pct.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">
              As of {longDate(quotes.data.as_of)} · source: {quotes.data.source}, fetched {new Date(quotes.data.fetched_at).toLocaleString()}
            </p>
          </>
        )}
      </section>
    </>
  );
}

export function LiveSheet({
  open,
  onOpenChange,
  onGoLive,
  goLivePending,
  onBackTo2022,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGoLive: () => void;
  goLivePending: boolean;
  onBackTo2022: () => void;
}) {
  const { live, clock } = useAppState();
  const phone = useIsPhone();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={phone ? "bottom" : "right"}
        className={cn("overflow-y-auto", phone ? "max-h-[88dvh] rounded-t-3xl" : "w-full sm:max-w-xl")}
      >
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">{live.active ? "Live prices are on" : "Go live: use today’s prices"}</SheetTitle>
          <SheetDescription>
            {live.active ? "Real end-of-day prices for 17 ETFs." : "See exactly what changes before you switch."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-8">
          {live.active ? (
            <LiveBody onBackTo2022={onBackTo2022} open={open} />
          ) : (
            <Intro onGoLive={onGoLive} pending={goLivePending} simDate={clock.date} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
