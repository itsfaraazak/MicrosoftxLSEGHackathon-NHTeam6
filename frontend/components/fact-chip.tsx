import { ProvenanceChip } from "@/components/provenance-chip";
import type { Fact } from "@/lib/api";
import { factLabel, factValue } from "@/lib/display";

// A Fact in readable form: label, value with unit, then where it came from.
export function FactChip({ fact }: { fact: Fact }) {
  return (
    <li className="flex flex-wrap items-center gap-2 text-[0.95rem]">
      <span>{factLabel(fact.id)}:</span>
      <strong className="money">{factValue(fact)}</strong>
      <ProvenanceChip source={fact.source} asOf={fact.as_of} />
    </li>
  );
}
