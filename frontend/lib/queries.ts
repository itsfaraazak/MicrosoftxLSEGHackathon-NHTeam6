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
  // Everything under "demo-prep" survives Reset demo; only "Clear all caches" drops it.
  demoPrep: ["demo-prep"] as const,
  compare: (names: string[], simDate: string) => ["demo-prep", "compare", ...names, simDate] as const,
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
  if (q.data) status = q.data.mocks ? "mock" : "live";
  else if (q.isError) status = DEMO_FALLBACK || offlineDemo ? "offline-demo" : "offline";
  return { status, refetch: () => void q.refetch() };
}

export function useReplay(profileId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.replay(profileId ?? "", from, to),
    queryFn: ({ signal }) => api.replay(profileId ?? "", from, to, signal),
    enabled: profileId !== null,
  });
}

export function useCompare(profiles: Profile[] | null, simDate: string) {
  return useQuery({
    queryKey: queryKeys.compare(profiles?.map((p) => p.name) ?? [], simDate),
    queryFn: ({ signal }) => api.compare(profiles ?? [], simDate, signal),
    enabled: profiles !== null && profiles.length > 0,
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
