// Lenient schemas for the "rigor" surface (audit log + rigor summary + per-call meta).
// Everything here is optional-with-defaults: a missing or malformed field degrades to an empty/unknown
// value instead of throwing, mirroring the readEnhancement/degrade-per-section philosophy in lib/schemas.ts.
// This file never imports from lib/schemas.ts or lib/api.ts to avoid coupling with the core contract.
import { z } from "zod";

export const AuditEventSchema = z.object({
  id: z.string().optional().default(""),
  kind: z.string().optional().default(""),
  ts: z.string().optional().default(""),
  summary: z.string().optional().default(""),
  payload: z.unknown().optional().default({}),
});

export const AuditResSchema = z.object({
  events: z.array(AuditEventSchema).optional().default([]),
});

export const RigorPrincipleSchema = z.object({
  id: z.string().optional().default(""),
  title: z.string().optional().default(""),
  detail: z.string().optional().default(""),
});

export const RigorTestsSchema = z.object({
  backend: z.number().optional().default(0),
  redteam_cases: z.number().optional().default(0),
});

export const RigorSummarySchema = z.object({
  principles: z.array(RigorPrincipleSchema).optional().default([]),
  tests: RigorTestsSchema.optional().default({ backend: 0, redteam_cases: 0 }),
});

export const NumberCheckSchema = z.object({
  numbers_checked: z.number().optional().default(0),
  rejected: z.array(z.string()).optional().default([]),
  retries: z.number().optional().default(0),
  fallback_used: z.boolean().optional().default(false),
});

export const MetaStepSchema = z.object({
  name: z.string().optional().default(""),
  kind: z
    .union([z.literal("code"), z.literal("llm"), z.string()])
    .optional()
    .default("code"),
  ms: z.number().optional().default(0),
  result: z.string().optional(),
});

export const MetaSchema = z.object({
  model: z.string().optional(),
  latency_ms: z.number().optional().default(0),
  llm_calls: z.number().optional().default(0),
  guardrail: z.string().optional(),
  number_check: NumberCheckSchema.optional().default({ numbers_checked: 0, rejected: [], retries: 0, fallback_used: false }),
  data_as_of: z.string().optional(),
  steps: z.array(MetaStepSchema).optional().default([]),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type AuditRes = z.infer<typeof AuditResSchema>;
export type RigorPrinciple = z.infer<typeof RigorPrincipleSchema>;
export type RigorTests = z.infer<typeof RigorTestsSchema>;
export type RigorSummary = z.infer<typeof RigorSummarySchema>;
export type NumberCheck = z.infer<typeof NumberCheckSchema>;
export type MetaStep = z.infer<typeof MetaStepSchema>;
export type Meta = z.infer<typeof MetaSchema>;
