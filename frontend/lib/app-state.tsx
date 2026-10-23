"use client";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ParseResSchema, PortfolioResSchema, ProfileSchema, type ParseRes, type PortfolioRes, type Profile } from "@/lib/api";
import { DEMO_PREP_KEY, resetDemoPrepStatus } from "@/lib/demo-prep";
import { DEFAULT_PERSONA, isPersonaId, type PersonaId } from "@/lib/personas";
import { clearSession, useSessionValue, writeSession } from "@/lib/session-store";

export const SIM_START = "2022-01-03";
export const SIM_END = "2023-12-29";

export type SimClock = {
  date: string;
  cursor: number;
  // 0..1, how far through the replay window the cursor is. Drives the dial only.
  progress: number;
  // Furthest cursor shown since the cursor last sat at the start. The chart's y-range grows to it and never shrinks.
  reached: number;
};

export const INITIAL_CLOCK: SimClock = { date: SIM_START, cursor: 0, progress: 0, reached: 0 };

// Live market mode (Go live / Back to 2022). Not persisted: a reload goes back to the 2022 time machine.
export type LiveState = { active: boolean; latestDate: string | null };
export const INITIAL_LIVE: LiveState = { active: false, latestDate: null };

type AppState = {
  persona: PersonaId;
  setPersona: (id: PersonaId) => void;
  parsed: ParseRes | null;
  setParsed: (r: ParseRes | null) => void;
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  plan: PortfolioRes | null;
  setPlan: (r: PortfolioRes | null) => void;
  clock: SimClock;
  setClock: (c: SimClock) => void;
  live: LiveState;
  // Sets the sim clock to the latest live date so profile/portfolio/ask/proof use today's market.
  enterLive: (latestDate: string) => void;
  // Leaves live mode and restores the 2022 time machine's start date.
  backTo2022: () => void;
  resetDemo: () => void;
  clearAllCaches: () => void;
  // Bumped on every reset so views remount and drop their local state.
  epoch: number;
};

const Ctx = createContext<AppState | null>(null);

function useStoredJson<T>(key: string, parse: (raw: unknown) => T | null): T | null {
  const raw = useSessionValue(key);
  return useMemo(() => {
    if (raw === null) return null;
    try {
      return parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }, [raw, parse]);
}

const parseProfile = (raw: unknown) => ProfileSchema.safeParse(raw).data ?? null;
const parseParsed = (raw: unknown) => ParseResSchema.safeParse(raw).data ?? null;
const parsePlan = (raw: unknown) => PortfolioResSchema.safeParse(raw).data ?? null;

const store = (key: string) => (value: unknown) =>
  writeSession(key, value === null ? null : JSON.stringify(value));

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const storedPersona = useSessionValue("persona");
  const persona = isPersonaId(storedPersona) ? storedPersona : DEFAULT_PERSONA;
  const profile = useStoredJson("profile", parseProfile);
  const parsed = useStoredJson("parsed", parseParsed);
  const plan = useStoredJson("plan", parsePlan);
  const [clock, setClock] = useState<SimClock>(INITIAL_CLOCK);
  const [live, setLive] = useState<LiveState>(INITIAL_LIVE);

  const enterLive = useCallback(
    (latestDate: string) => {
      setLive({ active: true, latestDate });
      setClock({ ...clock, date: latestDate });
    },
    [clock],
  );

  const backTo2022 = useCallback(() => {
    setLive(INITIAL_LIVE);
    setClock(INITIAL_CLOCK);
  }, []);
  const [epoch, setEpoch] = useState(0);

  // Reset demo: current session only. The demo-prep cache stays so Compare is instant after a reset.
  const resetDemo = useCallback(() => {
    clearSession([DEMO_PREP_KEY]);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "demo-prep" && q.queryKey[0] !== "health" });
    queryClient.getMutationCache().clear();
    setClock(INITIAL_CLOCK);
    setLive(INITIAL_LIVE);
    setEpoch((n) => n + 1);
  }, [queryClient]);

  const clearAllCaches = useCallback(() => {
    clearSession();
    resetDemoPrepStatus();
    queryClient.clear();
    setClock(INITIAL_CLOCK);
    setLive(INITIAL_LIVE);
    setEpoch((n) => n + 1);
  }, [queryClient]);

  const value = useMemo<AppState>(
    () => ({
      persona,
      setPersona: (id) => writeSession("persona", id),
      parsed,
      setParsed: store("parsed"),
      profile,
      setProfile: store("profile"),
      plan,
      setPlan: store("plan"),
      clock,
      setClock,
      live,
      enterLive,
      backTo2022,
      resetDemo,
      clearAllCaches,
      epoch,
    }),
    [persona, parsed, profile, plan, clock, live, enterLive, backTo2022, resetDemo, clearAllCaches, epoch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState must be used inside AppStateProvider");
  return v;
}
