"use client";
import { Loader2, Radio } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LiveSheet } from "@/components/live-sheet";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { useGoLive } from "@/lib/live";

// The top-bar live button. It never fetches on a bare tap: it opens a sheet that says what Go live will change first.
export function LiveToggle() {
  const { live, enterLive, backTo2022 } = useAppState();
  const [sheetOpen, setSheetOpen] = useState(false);
  const goLive = useGoLive();

  function handleGoLive() {
    goLive.mutate(undefined, {
      onSuccess: (res) => {
        enterLive(res.latestDate);
        if (res.staleNotice) {
          toast.message("Showing the last good market data", { description: res.staleNotice });
        } else {
          toast.success(`Live: prices up to ${res.latestDate}`, { description: "Plans you build now, Ask and Proof use this date." });
        }
      },
      onError: (err) => {
        if (err instanceof ApiError && err.kind === "cancelled") return;
        toast.error("Couldn't go live", {
          description: err instanceof ApiError ? err.message : "Something went wrong reaching live market data. Try again in a moment.",
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
        className="h-11 min-w-11 flex-none rounded-full px-3 font-semibold md:h-9 md:px-3.5"
        onClick={() => setSheetOpen(true)}
        aria-label={live.active ? "Live prices are on. Open details or go back to 2022" : "Go live: use today's prices. Opens an explanation first"}
        title={live.active ? "Live prices are on" : "Use today's real prices instead of the 2022 simulation"}
      >
        {goLive.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Radio aria-hidden className="size-4" />}
        <span className="hidden sm:inline">{goLive.isPending ? "Fetching prices…" : live.active ? "Live · details" : "Go live: today's prices"}</span>
      </Button>
      <LiveSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onGoLive={handleGoLive}
        goLivePending={goLive.isPending}
        onBackTo2022={handleBackTo2022}
      />
    </>
  );
}
