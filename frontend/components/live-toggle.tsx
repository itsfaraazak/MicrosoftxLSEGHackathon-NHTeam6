"use client";
import { Loader2, Radio, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LiveSheet } from "@/components/live-sheet";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { useGoLive } from "@/lib/live";

// "Go live" / "Back to 2022": the prominent toggle that sits beside the sim clock in the top bar.
export function LiveToggle() {
  const { live, enterLive, backTo2022 } = useAppState();
  const [sheetOpen, setSheetOpen] = useState(false);
  const goLive = useGoLive();

  function handleGoLive() {
    goLive.mutate(undefined, {
      onSuccess: (res) => {
        enterLive(res.latestDate);
        setSheetOpen(true);
        if (res.staleNotice) {
          toast.message("Showing the last good market data", { description: res.staleNotice });
        }
      },
      onError: (err) => {
        if (err instanceof ApiError && err.kind === "cancelled") return;
        toast.error("Couldn't go live", {
          description:
            err instanceof ApiError
              ? err.message
              : "Something went wrong reaching live market data. Try again in a moment.",
        });
      },
    });
  }

  function handleBackTo2022() {
    backTo2022();
    setSheetOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={live.active ? "outline" : "default"}
        className="h-9 flex-none rounded-full px-3.5 font-semibold"
        disabled={goLive.isPending}
        onClick={live.active ? handleBackTo2022 : handleGoLive}
        aria-label={live.active ? "Back to 2022: leave live market data" : "Go live: fetch today's real market data"}
      >
        {goLive.isPending ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : live.active ? (
          <Undo2 aria-hidden className="size-4" />
        ) : (
          <Radio aria-hidden className="size-4" />
        )}
        <span className="hidden sm:inline">
          {goLive.isPending ? "Checking live market…" : live.active ? "Back to 2022" : "Go live"}
        </span>
      </Button>
      {live.active && !goLive.isPending && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="glass hidden flex-none items-center rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-tile-hover sm:inline-flex"
        >
          View live market
        </button>
      )}
      <LiveSheet open={sheetOpen} onOpenChange={setSheetOpen} onBackTo2022={handleBackTo2022} />
    </>
  );
}
