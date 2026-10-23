"use client";
import { Radio, History } from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { longDate } from "@/lib/display";
import { cn } from "@/lib/utils";

// Always answers "which data am I looking at?": the 2022 simulation or today's real closing prices.
export function DataModeChip({ className }: { className?: string }) {
  const { live, clock } = useAppState();
  const isLive = live.active;
  const date = isLive ? (live.latestDate ?? clock.date) : clock.date;
  const Icon = isLive ? Radio : History;
  return (
    <span
      title={
        isLive
          ? "Live mode: prices for the 17 ETFs are real closing prices up to this date. Press the live button in the top bar to go back to 2022."
          : "2022 simulation: SPARK can only see prices up to this date, on purpose. Press Go live to use today's real closing prices."
      }
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-semibold",
        isLive ? "border-plan/60 bg-plan/15 text-foreground" : "tile text-foreground",
        className,
      )}
    >
      <Icon aria-hidden className={cn("size-3.5", isLive ? "text-plan" : "text-muted-foreground")} />
      {isLive ? `Live prices to ${longDate(date)}` : `2022 simulation · to ${longDate(date)}`}
    </span>
  );
}
