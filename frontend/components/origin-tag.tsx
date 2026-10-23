import { cn } from "@/lib/utils";

// "Where does this come from?" in one word, so you can always tell your own input from market data, rules, AI wording and examples.
export type Origin = "you" | "market" | "rules" | "ai" | "example";

const LOOK: Record<Origin, { label: string; dot: string; title: string }> = {
  you: { label: "From you", dot: "bg-primary", title: "Typed by you on My profile. Nothing else on this card is about you." },
  market: { label: "Real market data", dot: "bg-plan", title: "Historical prices and economic data from public sources, clipped at the simulation date." },
  rules: { label: "Code rules", dot: "bg-warn", title: "Calculated by fixed rules in our code. The AI does not pick holdings or amounts." },
  ai: { label: "AI wording", dot: "bg-violet-500", title: "Written by the AI from a small list of checked facts. Every number in it is verified first." },
  example: { label: "Example, not you", dot: "bg-muted-foreground", title: "A fictional person shown for comparison. This is not your data." },
};

export function OriginTag({ kind, className }: { kind: Origin; className?: string }) {
  const look = LOOK[kind];
  return (
    <span
      title={look.title}
      className={cn(
        "tile inline-flex min-h-6 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden className={cn("size-2 rounded-full", look.dot)} />
      {look.label}
    </span>
  );
}

export const ORIGIN_KINDS: Origin[] = ["you", "market", "rules", "ai", "example"];
export const originHelp = (kind: Origin) => LOOK[kind].title;
