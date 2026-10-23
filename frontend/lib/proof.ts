// "Quant dev in a box": query hook for POST /api/proof (docs/api-contract.md).
"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, type Portfolio, type Profile } from "@/lib/api";

export * from "@/lib/proof-schema";

export function useProof(profile: Profile | null, portfolio: Portfolio | null, simDate: string) {
  return useQuery({
    queryKey: ["proof", profile?.name ?? "", portfolio ? JSON.stringify(portfolio.positions) : "", simDate],
    queryFn: ({ signal }) => api.proof(profile as Profile, portfolio, simDate, signal),
    enabled: profile !== null,
    // The key follows the simulation date; keep showing the last proof while the new one loads instead of blanking.
    placeholderData: keepPreviousData,
  });
}
