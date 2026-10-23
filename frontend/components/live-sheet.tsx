"use client";
import { AlertTriangle, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { ErrorNotice, Working } from "@/components/query-state";
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

function usd2(n: number) {
  return `$${n.toFixed(2)}`;
}

export function LiveSheet({
  open,
  onOpenChange,
  onBackTo2022,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBackTo2022: () => void;
}) {
  const { live } = useAppState();
  const quotes = useLiveQuotes(open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-heading text-lg">Live market</SheetTitle>
          <SheetDescription>Real closing prices, pulled on demand. Educational hackathon project.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          <div role="note" className="flex items-start gap-2.5 rounded-xl border border-warn-line bg-warn-bg p-3.5 text-sm">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 flex-none text-warn" />
            <p>
              <strong>Live mode:</strong> real market data up to{" "}
              {live.latestDate ? longDate(live.latestDate) : "today"}. Not financial advice. The 2022 time machine is
              still available —{" "}
              <button type="button" onClick={onBackTo2022} className="font-semibold underline underline-offset-2">
                press Back to 2022
              </button>
              .
            </p>
          </div>

          {quotes.isPending && <Working label="Loading live quotes" />}
          {quotes.isError && <ErrorNotice error={quotes.error} onRetry={() => void quotes.refetch()} />}

          {quotes.data && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="tile rounded-2xl p-3.5">
                  <div className="text-sm font-semibold text-muted-foreground">3-month Treasury</div>
                  <div className="money font-heading text-[clamp(18px,1.8vw,24px)] font-semibold">
                    {quotes.data.rates.tb3ms}%
                  </div>
                </div>
                <div className="tile rounded-2xl p-3.5">
                  <div className="text-sm font-semibold text-muted-foreground">CPI, year over year</div>
                  <div className="money font-heading text-[clamp(18px,1.8vw,24px)] font-semibold">
                    {quotes.data.rates.cpi_yoy}%
                  </div>
                </div>
              </div>

              <div className="tile overflow-x-auto rounded-2xl">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3.5 py-2">
                        Ticker
                      </th>
                      <th scope="col" className="px-3.5 py-2">
                        Name
                      </th>
                      <th scope="col" className="px-3.5 py-2 text-right">
                        Close
                      </th>
                      <th scope="col" className="px-3.5 py-2 text-right">
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.data.quotes.map((q) => (
                      <tr key={q.ticker} className="border-t border-border/60">
                        <td className="px-3.5 py-2 font-bold">{q.ticker}</td>
                        <td className="max-w-[160px] truncate px-3.5 py-2 text-muted-foreground">{q.name}</td>
                        <td className="money px-3.5 py-2 text-right font-semibold">{usd2(q.close)}</td>
                        <td className={cn("px-3.5 py-2 text-right font-semibold", changeTone(q.change_pct))}>
                          <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                            {q.change_pct > 0 ? (
                              <ArrowUpRight aria-hidden className="size-3.5" />
                            ) : q.change_pct < 0 ? (
                              <ArrowDownRight aria-hidden className="size-3.5" />
                            ) : null}
                            {q.change_pct.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-muted-foreground">
                As of {longDate(quotes.data.as_of)} · source: {quotes.data.source}, fetched{" "}
                {new Date(quotes.data.fetched_at).toLocaleString()}
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
