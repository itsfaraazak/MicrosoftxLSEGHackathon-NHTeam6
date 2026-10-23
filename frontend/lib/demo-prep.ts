"use client";
// Background prep for the Compare tab: parse the three persona presets, then ask for a comparison.
// Results live in sessionStorage under "demo-prep", separate from the current session, so Reset demo keeps them
// and a refresh doesn't redo the LLM calls.
import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { CompareResSchema, ParseResSchema, api, type CompareRes, type ParseRes } from "@/lib/api";
import { PERSONAS, type PersonaId } from "@/lib/personas";
import { useSessionValue, writeSession } from "@/lib/session-store";

export const DEMO_PREP_KEY = "demo-prep";

const PrepSchema = z.object({
  parses: z.record(z.string(), ParseResSchema).default({}),
  compare: CompareResSchema.optional(),
});
export type Prep = { parses: Partial<Record<PersonaId, ParseRes>>; compare?: CompareRes };

function readPrep(): Prep {
  try {
    const raw = sessionStorage.getItem(`ddd:${DEMO_PREP_KEY}`);
    const parsed = raw ? PrepSchema.safeParse(JSON.parse(raw)) : null;
    return parsed?.success ? (parsed.data as Prep) : { parses: {} };
  } catch {
    return { parses: {} };
  }
}

function mergePrep(patch: Partial<Prep>) {
  const prev = readPrep();
  writeSession(DEMO_PREP_KEY, JSON.stringify({ ...prev, ...patch, parses: { ...prev.parses, ...patch.parses } }));
}

// A successful parse of an untouched preset also seeds the cache, so it isn't parsed twice.
export function seedPersonaParse(id: PersonaId, res: ParseRes) {
  mergePrep({ parses: { [id]: res } });
}

type Status = { state: "idle" | "running" | "error"; error?: unknown };
let status: Status = { state: "idle" };
const listeners = new Set<() => void>();
const setStatus = (s: Status) => {
  status = s;
  listeners.forEach((fn) => fn());
};

async function run(simDate: string) {
  const missing = PERSONAS.filter((p) => !readPrep().parses[p.id]);
  await Promise.all(
    missing.map(async (p) => {
      mergePrep({ parses: { [p.id]: await api.parseProfile(p.text) } });
    }),
  );
  const prep = readPrep();
  // Mapped by index: the compare response carries no persona names.
  const profiles = PERSONAS.map((p) => prep.parses[p.id]?.profile);
  if (profiles.some((p) => !p)) throw new Error("A persona could not be read");
  mergePrep({ compare: await api.compare(profiles as NonNullable<(typeof profiles)[number]>[], simDate) });
}

// Idempotent: does nothing while running or once a comparison is cached.
export function startDemoPrep(simDate: string) {
  if (status.state === "running" || readPrep().compare) return;
  setStatus({ state: "running" });
  run(simDate).then(
    () => setStatus({ state: "idle" }),
    (error: unknown) => setStatus({ state: "error", error }),
  );
}

export function resetDemoPrepStatus() {
  setStatus({ state: "idle" });
}

export function useDemoPrep(): { prep: Prep; status: Status } {
  const raw = useSessionValue(DEMO_PREP_KEY);
  const s = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => status,
    () => status,
  );
  const prep = useMemo<Prep>(() => {
    if (raw === null) return { parses: {} };
    const parsed = PrepSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as Prep) : { parses: {} };
  }, [raw]);
  return { prep, status: s };
}
