"use client";
import { QueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { ApiError, api, dataSource, type Profile } from "@/lib/api";
import { DEMO_FALLBACK } from "@/lib/flags";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, err) => count < 1 && !(err instanceof ApiError && err.kind === "contract"),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Infinity,
        gcTime: Infinity,
      },
      mutations: {
        retry: (count, err) =>
          count < 1 && err instanceof ApiError && (err.kind === "offline" || err.kind === "timeout"),
      },
    },
  });
}

export const queryKeys = {
  health: ["health"] as const,
  replay: (profileId: string, from: string, to: string) => ["replay", profileId, from, to] as const,
};

export type HealthStatus = "checking" | "live" | "mock" | "offline" | "offline-demo";

export function useHealth(): { status: HealthStatus; refetch: () => void } {
  const offlineDemo = useSyncExternalStore(dataSource.subscribe, dataSource.isOfflineDemo, () => false);
  const q = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.health(),
    refetchInterval: 15_000,
    staleTime: 0,
    retry: false,
  });
  let status: HealthStatus = "checking";
  if (offlineDemo) status = "offline-demo";
  else if (q.data) status = q.data.mocks ? "mock" : "live";
  else if (q.isError) status = DEMO_FALLBACK ? "offline-demo" : "offline";
  return { status, refetch: () => void q.refetch() };
}

// The backend registers a built plan under the person's lowercased first name. A missing name uses "you",
// matching what the profile builder sets, so the key is never empty.
export function replayProfileId(profile: Profile): string {
  return (profile.name.trim().split(/\s+/)[0] ?? "").toLowerCase() || "you";
}

export function useReplay(profile: Profile | null, simDate: string, from: string, to: string) {
  const profileId = profile ? replayProfileId(profile) : null;
  return useQuery({
    queryKey: queryKeys.replay(profileId ?? "", from, to),
    queryFn: async ({ signal }) => {
      if (!profile || !profileId) throw new Error("No profile to replay");
      try {
        return await api.replay(profileId, from, to, signal, { fallbackOn404: false });
      } catch (e) {
        if (!(e instanceof ApiError && e.kind === "http" && e.detail?.status === 404)) throw e;
        // The backend forgot this person (restart, other worker): register the plan again, then retry once.
        await api.portfolio(profile, simDate, signal);
        return api.replay(profileId, from, to, signal);
      }
    },
    enabled: profileId !== null,
  });
}

export function useParseProfile() {
  return useMutation({ mutationFn: (text: string) => api.parseProfile(text) });
}

export function useBuildPortfolio() {
  return useMutation({
    mutationFn: ({ profile, simDate }: { profile: Profile; simDate: string }) => api.portfolio(profile, simDate),
  });
}
