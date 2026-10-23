// Fetchers + hooks for the "rigor" surface: audit log, rigor summary, and the optional per-call `meta`
// block that may ride on /api/ask or /api/profile/parse responses. Everything here is defensive: the
// real backend endpoints may not exist yet, so every path falls back to /public/demo/*.json and, failing
// that, to the schema's own empty default. Nothing here ever throws.
"use client";
import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api";
import { DEMO_FALLBACK } from "@/lib/flags";
import {
  AuditResSchema,
  MetaSchema,
  RigorSummarySchema,
  type AuditRes,
  type Meta,
  type RigorSummary,
} from "@/lib/rigor-schema";

async function fromDemoFile<T>(file: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): Promise<T | undefined> {
  try {
    const res = await fetch(`/demo/${file}.json`);
    if (!res.ok) return undefined;
    const json = await res.json();
    const result = schema.safeParse(json);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export async function fetchAudit(limit = 20, signal?: AbortSignal): Promise<AuditRes> {
  // When the app is pinned to demo data, skip the round trip and go straight to the local fixture.
  if (!DEMO_FALLBACK) {
    try {
      const res = await fetch(`${API_BASE}/api/audit?limit=${limit}`, { signal });
      if (res.ok) {
        const json = await res.json();
        const parsed = AuditResSchema.safeParse(json);
        if (parsed.success) return parsed.data;
      }
    } catch {
      // network error, abort, timeout — fall through to demo data below
    }
  }
  // Demo file is the fallback either way: an audit log is harmless to show offline, and a
  // missing/incomplete backend endpoint shouldn't leave the rigor drawer empty.
  const demo = await fromDemoFile<AuditRes>("audit", AuditResSchema);
  if (demo) return demo;
  return AuditResSchema.parse({});
}

export async function fetchRigorSummary(signal?: AbortSignal): Promise<RigorSummary> {
  if (!DEMO_FALLBACK) {
    try {
      const res = await fetch(`${API_BASE}/api/rigor/summary`, { signal });
      if (res.ok) {
        const json = await res.json();
        const parsed = RigorSummarySchema.safeParse(json);
        if (parsed.success) return parsed.data;
      }
    } catch {
      // fall through to demo data below
    }
  }
  const demo = await fromDemoFile<RigorSummary>("rigor_summary", RigorSummarySchema);
  if (demo) return demo;
  return RigorSummarySchema.parse({});
}

export function useAudit(limit = 20) {
  return useQuery({
    queryKey: ["rigor-audit", limit],
    queryFn: ({ signal }) => fetchAudit(limit, signal),
  });
}

export function useRigorSummary() {
  return useQuery({
    queryKey: ["rigor-summary"],
    queryFn: ({ signal }) => fetchRigorSummary(signal),
  });
}

// Pulls an optional `meta` key off an already-parsed API response (AskRes/ParseRes don't declare it in
// lib/schemas.ts yet). Never throws; returns undefined if absent or malformed.
export function parseMeta(raw: unknown): Meta | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const meta = (raw as Record<string, unknown>).meta;
  if (meta === undefined || meta === null) return undefined;
  const result = MetaSchema.safeParse(meta);
  return result.success ? result.data : undefined;
}
