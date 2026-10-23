import { ArrowUp } from "lucide-react";
import { Callout, Chain, Legend, Node } from "@/components/architecture/primitives";

// Level 1: no jargon. A grandparent should be able to follow it.
export function Level1() {
  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[70ch] text-base leading-relaxed">
        You tell SPARK about your life. SPARK’s own rules decide how to split $100,000 so your savings don’t lean on the same industry as your
        paycheck. An AI only explains the answer in plain words. Real past market prices let you replay 2022 and see how the plan would have coped.
      </p>
      <Legend tones={["you", "server", "ai", "data"]} />
      <Chain
        items={[
          { node: <Node tone="you" tag="Step 1" title="You">Describe your job, your goals and what you already own.</Node>, arrow: "your words" },
          { node: <Node tone="you" tag="Step 2" title="The SPARK app">On your phone or laptop. It shows the plan and keeps your answers on your device.</Node>, arrow: "sent securely" },
          {
            node: (
              <Node tone="server" tag="Step 3" title="SPARK’s brain">
                Fixed, readable rules choose the split. Real market history lets it test the plan.
              </Node>
            ),
            arrow: "facts only",
          },
          {
            node: (
              <Node tone="ai" tag="Step 4" title="An AI helper">
                Turns the result into plain English. It cannot pick investments, and every number it writes is checked.
              </Node>
            ),
          },
        ]}
      />
      <div className="flex items-start gap-3">
        <ArrowUp aria-hidden className="mt-3 size-5 flex-none text-muted-foreground" />
        <Node tone="data" tag="Where the real data comes from" className="flex-1" title="Public market history, downloaded in advance">
          Prices for 17 funds (Yahoo Finance), inflation and interest rates (FRED) and tech layoffs (layoffs.fyi). It feeds the brain only. The AI never
          sees prices.
        </Node>
      </div>
      <p className="text-[15px] text-muted-foreground">The answer then travels back the same way: brain, app, you.</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Callout title="Code decides, AI explains">Rules in plain code choose every holding and amount. The AI never does.</Callout>
        <Callout tone="ai" title="Every number is checked">If the AI writes a number that our code didn’t produce, the sentence is thrown away.</Callout>
        <Callout tone="data" title="No peeking at the future">When we replay 2022, nothing after the simulation date is visible to the rules or the AI.</Callout>
      </div>
    </div>
  );
}
