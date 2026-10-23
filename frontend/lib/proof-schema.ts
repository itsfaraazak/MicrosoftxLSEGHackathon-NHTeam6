// Zod schema for POST /api/proof; mirrors backend/mocks/proof.json. Kept separate from the hook so api.ts can import it without a cycle.
import { z } from "zod";
import { FactSchema } from "./schemas";

const str = z.string();
const num = z.coerce.number<unknown>().refine(Number.isFinite, { message: "Expected a finite number" });

export const ProofVerdictSchema = z.enum(["supported", "not_supported", "inconclusive"]);

export const ProofResSchema = z.object({
  sim_date: str,
  window: z.object({ from: str, to: str }),
  strategy: z.object({ name: str, weights: z.record(str, num) }),
  baseline: z.object({ name: str, weights: z.record(str, num) }),
  metrics: z.array(
    z.object({ id: str, label: str, strategy: num, baseline: num, unit: str, better: z.boolean(), fact_id: str.optional() }),
  ),
  stress: z.array(z.object({ name: str, from: str, to: str, strategy: num, baseline: num })),
  claims: z.array(
    z.object({ id: str, claim: str, verdict: ProofVerdictSchema, evidence: z.array(str).default([]), code_id: str }),
  ),
  code: z.array(z.object({ id: str, title: str, source: str, sha256: str, output: str })),
  facts: z.array(FactSchema).default([]),
  caveats: z.array(str).default([]),
  script: str,
});

export type ProofRes = z.infer<typeof ProofResSchema>;
export type ProofMetric = ProofRes["metrics"][number];
export type ProofClaim = ProofRes["claims"][number];
export type ProofVerdict = z.infer<typeof ProofVerdictSchema>;
