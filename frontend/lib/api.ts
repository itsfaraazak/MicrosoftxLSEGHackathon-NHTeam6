// All backend calls go through here. Shapes mirror docs/api-contract.md.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export type Goal = { name: string; amount_usd: number; years_away: number };
export type Holding = { ticker: string; amount_usd: number; is_employer_stock: boolean };
export type Profile = {
  name: string; age: number; job_title: string; industry: string; employer: string;
  location: string; risk_tolerance: "low" | "medium" | "high";
  experience: "none" | "some" | "experienced"; emergency_fund_months: number;
  high_interest_debt: boolean; past_behaviour: string; exclusions: string[];
  contradictions: string[]; goals: Goal[]; holdings: Holding[];
};
export type Fact = { id: string; value: number; unit: string; source: string; as_of: string };
export type Position = {
  ticker: string; amount_usd: number; bucket: "safe" | "growth"; reason_facts: Fact[];
};
export type Portfolio = {
  sim_date: string; positions: Position[]; safe_bucket_usd: number;
  growth_bucket_usd: number; overlap_score: number;
};
export type GuardEvent = {
  sim_date: string; drawdown_pct: number; market_wide: boolean;
  cost_of_selling_usd: number; goal_years_away: number;
  suggested_action: "hold" | "rebalance" | "move_to_safe"; coach_message?: string;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
const post = <T,>(path: string, body: unknown) =>
  call<T>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  parseProfile: (text: string) =>
    post<{ profile: Profile; contradictions: string[] }>("/api/profile/parse", { text }),
  portfolio: (profile: Profile, sim_date: string) =>
    post<{ portfolio: Portfolio; explanation: string; facts: Fact[] }>("/api/portfolio", { profile, sim_date }),
  compare: (profiles: Profile[], sim_date: string) =>
    post<{ portfolios: Portfolio[] }>("/api/compare", { profiles, sim_date }),
  replay: (profile_id: string, from: string, to: string) =>
    call<{ months: { date: string; ours: number; tech_heavy: number }[]; events: GuardEvent[] }>(
      `/api/replay?profile_id=${profile_id}&from=${from}&to=${to}`),
  ask: (question: string, profile: Profile, sim_date: string) =>
    post<{ answer: string; facts_used: Fact[] }>("/api/ask", { question, profile, sim_date }),
};
