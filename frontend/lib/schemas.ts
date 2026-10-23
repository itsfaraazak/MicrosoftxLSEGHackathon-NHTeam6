// Runtime mirrors of docs/api-contract.md. Types are derived from these, so there is one source of truth.
// Core fields parse strictly. Enhancement fields are accepted as unknown here and checked per element with
// readEnhancement(), so one bad optional field hides one element instead of the whole view.
import { z } from "zod";

// Numbers sent as strings ("31") are accepted; anything that isn't a finite number is a contract mismatch.
const num = z.coerce.number<unknown>().refine(Number.isFinite, { message: "Expected a finite number" });
const str = z.string();
const enhancement = z.unknown().optional();

export const FactSchema = z.object({
  id: str,
  value: num,
  unit: str,
  source: str,
  as_of: str,
});

export const GoalSchema = z.object({ name: str, amount_usd: num, years_away: num });

export const HoldingSchema = z.object({ ticker: str, amount_usd: num, is_employer_stock: z.boolean() });

export const RiskSchema = z.enum(["low", "medium", "high"]);
export const ExperienceSchema = z.enum(["none", "some", "experienced"]);

export const ProfileSchema = z.object({
  name: str,
  age: num,
  job_title: str,
  industry: str,
  employer: str,
  location: str,
  risk_tolerance: RiskSchema,
  experience: ExperienceSchema,
  emergency_fund_months: num,
  high_interest_debt: z.boolean(),
  past_behaviour: str,
  exclusions: z.array(str).default([]),
  contradictions: z.array(str).default([]),
  goals: z.array(GoalSchema),
  holdings: z.array(HoldingSchema),
});

export const PositionSchema = z.object({
  ticker: str,
  amount_usd: num,
  bucket: z.enum(["safe", "growth"]),
  reason_facts: z.array(FactSchema).default([]),
  display_name: enhancement,
  reason: enhancement,
});

export const PortfolioSchema = z.object({
  sim_date: str,
  positions: z.array(PositionSchema),
  safe_bucket_usd: num,
  growth_bucket_usd: num,
  overlap_score: enhancement,
  baseline_overlap_score: enhancement,
});

export const GuardEventSchema = z.object({
  sim_date: str,
  drawdown_pct: num,
  market_wide: z.boolean(),
  cost_of_selling_usd: num,
  goal_years_away: num,
  suggested_action: z.enum(["hold", "rebalance", "move_to_safe"]),
  coach_message: enhancement,
});

export const ReplayMonthSchema = z.object({ date: str, ours: num, tech_heavy: num });

export const AgentTradeSchema = z.object({ ticker: str, trade_usd: num });

export const HealthResSchema = z.object({ ok: z.boolean(), mocks: z.boolean() });
export const ParseResSchema = z.object({ profile: ProfileSchema, contradictions: z.array(str).default([]) });
export const PortfolioResSchema = z.object({ portfolio: PortfolioSchema, explanation: str, facts: z.array(FactSchema) });
export const CompareResSchema = z.object({ portfolios: z.array(PortfolioSchema) });
export const ReplayResSchema = z.object({ months: z.array(ReplayMonthSchema), events: z.array(GuardEventSchema) });
export const AskResSchema = z.object({ answer: str, facts_used: z.array(FactSchema).default([]) });
export const AgentStepResSchema = z.object({ trades: z.array(AgentTradeSchema), rule_triggered: str });

// Enhancement field schemas, checked where each element renders.
export const OverlapScoreSchema = num.pipe(z.number().min(0).max(1));
export const TextEnhancementSchema = z.string().trim().min(1);

export type Enhancement<T> =
  | { status: "ok"; value: T }
  | { status: "absent" }
  | { status: "mismatch"; message: string };

export function readEnhancement<S extends z.ZodType>(
  schema: S,
  raw: unknown,
  where: string,
): Enhancement<z.output<S>> {
  if (raw === undefined || raw === null) return { status: "absent" };
  const result = schema.safeParse(raw);
  if (result.success) return { status: "ok", value: result.data };
  console.error(`Contract mismatch at ${where}`, result.error);
  return { status: "mismatch", message: `${where}: ${result.error.issues[0]?.message ?? "invalid"}` };
}

export type Fact = z.infer<typeof FactSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type Holding = z.infer<typeof HoldingSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Portfolio = z.infer<typeof PortfolioSchema>;
export type GuardEvent = z.infer<typeof GuardEventSchema>;
export type ReplayMonth = z.infer<typeof ReplayMonthSchema>;
export type AgentTrade = z.infer<typeof AgentTradeSchema>;
export type HealthRes = z.infer<typeof HealthResSchema>;
export type ParseRes = z.infer<typeof ParseResSchema>;
export type PortfolioRes = z.infer<typeof PortfolioResSchema>;
export type CompareRes = z.infer<typeof CompareResSchema>;
export type ReplayRes = z.infer<typeof ReplayResSchema>;
export type AskRes = z.infer<typeof AskResSchema>;
export type AgentStepRes = z.infer<typeof AgentStepResSchema>;
