"use client";
// Hooks for the live-market feature (Go live / Back to 2022, the live quotes sheet, the data-sources chip).
// Kept out of lib/queries.ts per docs/frontend-plan.md's file layout; everything still goes through lib/api.ts's call().
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api";

export const liveKeys = {
  status: ["live", "status"] as const,
  quotes: ["live", "quotes"] as const,
  sources: ["data", "sources"] as const,
};

// Lazy: only fetched once the live sheet (or sources chip) is actually open.
export function useLiveQuotes(enabled: boolean) {
  return useQuery({ queryKey: liveKeys.quotes, queryFn: ({ signal }) => api.liveQuotes(signal), enabled });
}

export function useDataSources(enabled: boolean) {
  return useQuery({ queryKey: liveKeys.sources, queryFn: ({ signal }) => api.dataSources(signal), enabled });
}

export type GoLiveResult = {
  latestDate: string;
  refreshed: boolean;
  // Set when the refresh step itself failed (429/502/offline/etc). Status could still be read, so
  // Go Live still succeeds — just showing the last-good data instead of a fresh pull.
  staleNotice?: string;
};

function staleNoticeFor(err: unknown): string | null {
  if (err instanceof ApiError && err.kind === "cancelled") return null;
  const status = err instanceof ApiError ? err.detail?.status : undefined;
  if (status === 429) return "Live refresh is rate-limited right now, so we're showing the last good market data.";
  if (status === 502) return "The live price provider is unavailable right now, so we're showing the last good market data.";
  return "Couldn't refresh live prices just now, so we're showing the last good market data.";
}

// POST /api/live/refresh, then GET /api/live/status for the date to drive the sim clock. A failed
// refresh degrades to "keep last-good data" instead of failing Go Live outright.
export function useGoLive() {
  return useMutation({
    mutationFn: async (): Promise<GoLiveResult> => {
      let refreshed = true;
      let staleNotice: string | undefined;
      try {
        await api.liveRefresh();
      } catch (err) {
        if (err instanceof ApiError && err.kind === "cancelled") throw err;
        refreshed = false;
        staleNotice = staleNoticeFor(err) ?? undefined;
      }
      const status = await api.liveStatus();
      return { latestDate: status.latest_date, refreshed, staleNotice };
    },
  });
}
