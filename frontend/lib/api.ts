// All backend calls go through here. Shapes mirror docs/api-contract.md and are checked at runtime by lib/schemas.ts.
import type { z } from "zod";
import { DEMO_FALLBACK } from "@/lib/flags";
import {
  AgentStepResSchema,
  AskResSchema,
  CompareResSchema,
  HealthResSchema,
  ParseResSchema,
  PortfolioResSchema,
  ReplayResSchema,
  type Portfolio,
  type Profile,
} from "@/lib/schemas";
import { ProofResSchema } from "@/lib/proof-schema";
import {
  DataSourcesResSchema,
  LiveQuotesResSchema,
  LiveRefreshResSchema,
  LiveStatusResSchema,
} from "@/lib/live-schema";

export * from "@/lib/schemas";
export * from "@/lib/live-schema";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
export const API_BASE = BASE;

// Everything except health may call the LLM, including number-check regeneration.
export const LLM_TIMEOUT_MS = 30_000;
const HEALTH_TIMEOUT_MS = 5_000;
const ENGINE_TIMEOUT_MS = 12_000;

export type ApiErrorKind = "offline" | "timeout" | "http" | "not-json" | "contract" | "cancelled";

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly endpoint: string,
    message: string,
    readonly detail?: { status?: number; path?: string; issues?: z.core.$ZodIssue[] },
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((out, key) => {
    if (typeof key === "number") return `${out}[${key}]`;
    return out ? `${out}.${String(key)}` : String(key);
  }, "");
}

// Offline demo data: the app switches to /public/demo/*.json when the backend can't be reached and the flag is on.
type SourceListener = () => void;
let offlineDemoActive = false;
const sourceListeners = new Set<SourceListener>();

export const dataSource = {
  isOfflineDemo: () => offlineDemoActive,
  subscribe(fn: SourceListener) {
    sourceListeners.add(fn);
    return () => sourceListeners.delete(fn);
  },
  set(active: boolean) {
    if (offlineDemoActive === active) return;
    offlineDemoActive = active;
    sourceListeners.forEach((fn) => fn());
  },
};

type CallOptions<S extends z.ZodType> = {
  method?: "GET" | "POST";
  path: string;
  body?: unknown;
  schema: S;
  timeoutMs: number;
  demoFile?: string;
  // HTTP statuses that must reach the caller instead of silently loading demo data (e.g. replay 404 -> re-register, retry).
  noFallbackStatuses?: number[];
  signal?: AbortSignal;
};

function parseOrThrow<S extends z.ZodType>(endpoint: string, schema: S, json: unknown): z.output<S> {
  const result = schema.safeParse(json);
  if (result.success) return result.data;
  const first = result.error.issues[0];
  const path = first ? formatIssuePath(first.path) : "";
  console.error(`Contract mismatch on ${endpoint}`, result.error);
  throw new ApiError("contract", endpoint, `Contract mismatch at ${path || "(root)"}: ${first?.message ?? "unknown"}`, {
    path,
    issues: result.error.issues,
  });
}

async function fromDemo<S extends z.ZodType>(endpoint: string, file: string, schema: S): Promise<z.output<S>> {
  const res = await fetch(`/demo/${file}.json`);
  if (!res.ok) throw new ApiError("offline", endpoint, `Offline demo file ${file}.json is missing. Run npm run sync-mocks.`);
  const data = parseOrThrow(endpoint, schema, await res.json());
  dataSource.set(true);
  return data;
}

async function call<S extends z.ZodType>(opts: CallOptions<S>): Promise<z.output<S>> {
  const method = opts.method ?? "GET";
  const endpoint = `${method} ${opts.path.split("?")[0]}`;
  const timeout = AbortSignal.timeout(opts.timeoutMs);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(`${BASE}${opts.path}`, {
      method,
      headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) throw new ApiError("cancelled", endpoint, "Cancelled");
    const timedOut = timeout.aborted;
    if (DEMO_FALLBACK && opts.demoFile) return fromDemo(endpoint, opts.demoFile, opts.schema);
    throw new ApiError(
      timedOut ? "timeout" : "offline",
      endpoint,
      timedOut ? `No reply after ${Math.round(opts.timeoutMs / 1000)} seconds` : String(err),
    );
  }

  const text = await res.text();
  let json: unknown;
  let notJson = false;
  try {
    json = JSON.parse(text);
  } catch {
    notJson = true;
  }
  if (!res.ok || notJson) {
    // A half-built backend (HTML 500s, NotImplementedError) falls back to demo data too, clearly labelled.
    if (DEMO_FALLBACK && opts.demoFile && !opts.noFallbackStatuses?.includes(res.status)) {
      return fromDemo(endpoint, opts.demoFile, opts.schema);
    }
    // Backend error bodies look like {"error": "...", "fallback": true}: surface the reason, not just the status.
    const serverMsg =
      !notJson && json && typeof json === "object" && typeof (json as { error?: unknown }).error === "string"
        ? (json as { error: string }).error.slice(0, 160)
        : null;
    throw new ApiError(
      res.ok ? "not-json" : "http",
      endpoint,
      res.ok
        ? "The backend replied with something that isn't JSON"
        : serverMsg ?? `The backend returned ${res.status}`,
      { status: res.status },
    );
  }
  dataSource.set(false);
  return parseOrThrow(endpoint, opts.schema, json);
}

export const api = {
  health: () => call({ path: "/api/health", schema: HealthResSchema, timeoutMs: HEALTH_TIMEOUT_MS }),
  parseProfile: (text: string, signal?: AbortSignal) =>
    call({
      method: "POST", path: "/api/profile/parse", body: { text }, schema: ParseResSchema,
      timeoutMs: LLM_TIMEOUT_MS, demoFile: "profile_parse", signal,
    }),
  portfolio: (profile: Profile, sim_date: string, signal?: AbortSignal) =>
    call({
      method: "POST", path: "/api/portfolio", body: { profile, sim_date }, schema: PortfolioResSchema,
      timeoutMs: LLM_TIMEOUT_MS, demoFile: "portfolio", signal,
    }),
  compare: (profiles: Profile[], sim_date: string, signal?: AbortSignal) =>
    call({
      method: "POST", path: "/api/compare", body: { profiles, sim_date }, schema: CompareResSchema,
      timeoutMs: LLM_TIMEOUT_MS, demoFile: "compare", signal,
    }),
  replay: (profile_id: string, from: string, to: string, signal?: AbortSignal, opts?: { fallbackOn404?: boolean }) =>
    call({
      path: `/api/replay?${new URLSearchParams({ profile_id, from, to })}`, schema: ReplayResSchema,
      timeoutMs: LLM_TIMEOUT_MS, demoFile: "replay", signal,
      noFallbackStatuses: opts?.fallbackOn404 === false ? [404] : undefined,
    }),
  ask: (question: string, profile: Profile, sim_date: string, signal?: AbortSignal) =>
    call({
      method: "POST", path: "/api/ask", body: { question, profile, sim_date }, schema: AskResSchema,
      timeoutMs: LLM_TIMEOUT_MS, demoFile: "ask", signal,
    }),
  proof: (profile: Profile, portfolio: Portfolio | null, sim_date: string, signal?: AbortSignal) =>
    call({
      method: "POST", path: "/api/proof", body: { profile, ...(portfolio ? { portfolio } : {}), sim_date },
      schema: ProofResSchema, timeoutMs: ENGINE_TIMEOUT_MS, demoFile: "proof", signal,
    }),
  agentStep: (portfolio: Portfolio, sim_date: string, signal?: AbortSignal) =>
    call({
      method: "POST", path: "/api/agent/step", body: { portfolio, sim_date }, schema: AgentStepResSchema,
      timeoutMs: ENGINE_TIMEOUT_MS, demoFile: "agent_step", signal,
    }),
  // Live market data (Go live / Back to 2022). No demoFile on liveRefresh: there's nothing to "refresh"
  // offline, and a 429/502 is handled by the caller (lib/live.ts) rather than falling back here.
  liveStatus: (signal?: AbortSignal) =>
    call({ path: "/api/live/status", schema: LiveStatusResSchema, timeoutMs: ENGINE_TIMEOUT_MS, demoFile: "live_status", signal }),
  liveQuotes: (signal?: AbortSignal) =>
    call({ path: "/api/live/quotes", schema: LiveQuotesResSchema, timeoutMs: ENGINE_TIMEOUT_MS, demoFile: "live_quotes", signal }),
  liveRefresh: (signal?: AbortSignal) =>
    call({ method: "POST", path: "/api/live/refresh", schema: LiveRefreshResSchema, timeoutMs: ENGINE_TIMEOUT_MS, signal }),
  dataSources: (signal?: AbortSignal) =>
    call({ path: "/api/data/sources", schema: DataSourcesResSchema, timeoutMs: ENGINE_TIMEOUT_MS, demoFile: "data_sources", signal }),
};
