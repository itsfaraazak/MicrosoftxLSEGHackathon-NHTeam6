// Runtime mirrors of the live-market endpoints (GET /api/live/status, GET /api/live/quotes,
// POST /api/live/refresh, GET /api/data/sources). Same conventions as lib/schemas.ts: core fields
// parse strictly, numeric strings are coerced, nothing is invented.
import { z } from "zod";

const num = z.coerce.number<unknown>().refine(Number.isFinite, { message: "Expected a finite number" });
const str = z.string();

export const LiveStatusResSchema = z.object({
  latest_date: str,
  first_date: str,
  rows: num,
  tickers: num,
  source: str,
  stale_days: num,
  live_enabled: z.boolean(),
});

export const LiveQuoteSchema = z.object({
  ticker: str,
  name: str,
  close: num,
  prev_close: num,
  change_pct: num,
});

export const LiveRatesSchema = z.object({
  tb3ms: num,
  cpi_yoy: num,
});

export const LiveQuotesResSchema = z.object({
  as_of: str,
  fetched_at: str,
  source: str,
  quotes: z.array(LiveQuoteSchema),
  rates: LiveRatesSchema,
});

export const LiveRefreshResSchema = z.object({
  ok: z.boolean(),
  as_of: str,
  rows_added: num,
  previous_latest: str,
});

export const DataSourceRowSchema = z.object({
  id: str,
  label: str,
  provider: str,
  file: str,
  rows: num,
  from: str.nullable(),
  to: str.nullable(),
  fetched_at: str,
  kind: z.enum(["real", "curated", "mock"]),
});

export const DataSourcesResSchema = z.array(DataSourceRowSchema);

export type LiveStatusRes = z.infer<typeof LiveStatusResSchema>;
export type LiveQuote = z.infer<typeof LiveQuoteSchema>;
export type LiveRates = z.infer<typeof LiveRatesSchema>;
export type LiveQuotesRes = z.infer<typeof LiveQuotesResSchema>;
export type LiveRefreshRes = z.infer<typeof LiveRefreshResSchema>;
export type DataSourceRow = z.infer<typeof DataSourceRowSchema>;
