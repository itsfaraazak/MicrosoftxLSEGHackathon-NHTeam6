// Run: npx tsx scripts/check-proof-schema.ts  (parses backend/mocks/proof.json with the frontend zod schema)
import { readFileSync } from "node:fs";
import { ProofResSchema } from "../lib/proof-schema";

const raw = JSON.parse(readFileSync(new URL("../../backend/mocks/proof.json", import.meta.url), "utf8"));
const r = ProofResSchema.safeParse(raw);
if (!r.success) {
  console.error("FAIL", JSON.stringify(r.error.issues, null, 2));
  process.exit(1);
}
console.log(`OK: ${r.data.metrics.length} metrics, ${r.data.stress.length} stress, ${r.data.claims.length} claims, ${r.data.code.length} code blocks`);
