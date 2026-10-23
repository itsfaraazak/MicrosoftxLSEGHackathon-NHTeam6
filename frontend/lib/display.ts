// Display-only labels and formatters. This is labelling, not data: unknown ids fall back to the raw id.
import type { Fact } from "@/lib/api";

type TickerInfo = { name: string; sector: string };

const TICKERS: Record<string, TickerInfo> = {
  BIL: { name: "US Treasury bills", sector: "Safe" },
  SHY: { name: "Short-term US Treasuries", sector: "Safe" },
  BND: { name: "Total US bonds", sector: "Bonds" },
  TIP: { name: "Inflation-protected Treasuries", sector: "Bonds" },
  VTI: { name: "Total US stock market", sector: "Broad market" },
  VXUS: { name: "International shares", sector: "International" },
  VT: { name: "Total world stock market", sector: "Broad market" },
  XLK: { name: "US technology", sector: "Technology" },
  XLC: { name: "US communication services", sector: "Communication" },
  XLV: { name: "US healthcare", sector: "Healthcare" },
  XLP: { name: "US consumer staples", sector: "Consumer staples" },
  XLU: { name: "US utilities", sector: "Utilities" },
  XLE: { name: "US energy", sector: "Energy" },
  XLF: { name: "US financials", sector: "Financials" },
  XLI: { name: "US industrials", sector: "Industrials" },
  XLRE: { name: "US real estate", sector: "Real estate" },
  QQQ: { name: "Nasdaq-100 (tech-heavy)", sector: "Technology" },
};

const FACT_LABELS: Record<string, string> = {
  goal_years: "Years until your goal",
  tech_overlap: "Tech share of a broad US fund",
  intl_weight: "International share of growth",
  job_overlap: "Overlap with your job’s sector",
  bond_share: "Bonds in the growth bucket",
  emergency_months: "Months of emergency savings",
  drawdown_pct: "Fall from the peak",
  cost_of_selling_usd: "Loss locked in by selling now",
};

const SOURCE_LABELS: Record<string, string> = {
  profile: "Your profile",
  yfinance: "Yahoo Finance prices",
  fred: "FRED (US Federal Reserve)",
  rules: "Allocation rules",
};

export function tickerName(ticker: string): string {
  return TICKERS[ticker]?.name ?? ticker;
}

export function tickerSector(ticker: string): string | null {
  return TICKERS[ticker]?.sector ?? null;
}

export function factLabel(id: string): string {
  return FACT_LABELS[id] ?? id;
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source.toLowerCase()] ?? source;
}

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function usd(n: number): string {
  return usdFmt.format(n);
}

// Axis labels: $98k.
export function usdCompact(n: number): string {
  return `$${Math.round(n / 1000)}k`;
}

export function pct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

// overlap_score arrives as a fraction (0.31); show it as a percentage.
export function fractionPct(f: number): string {
  return `${Math.round(f * 100)}%`;
}

export function factValue(f: Fact): string {
  const u = f.unit.trim();
  if (u === "$" || u.toLowerCase() === "usd") return usd(f.value);
  if (u === "%") return `${f.value}%`;
  if (u === "y") return `${f.value} ${f.value === 1 ? "year" : "years"}`;
  if (u === "m") return `${f.value} ${f.value === 1 ? "month" : "months"}`;
  return u ? `${f.value} ${u}` : String(f.value);
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

function toDate(iso: string): Date | null {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "2022-01-03" → "3 Jan 2022". Unparseable input is shown as-is.
export function longDate(iso: string): string {
  const d = toDate(iso);
  return d ? dateFmt.format(d) : iso;
}

export function monthLabel(iso: string): string {
  const d = toDate(iso);
  return d ? monthFmt.format(d) : iso;
}

// "Priya" -> "Priya’s"; the nameless custom profile is called "You" -> "Your".
export function possessive(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  return n === "" || n.toLowerCase() === "you" ? "Your" : `${n}’s`;
}
