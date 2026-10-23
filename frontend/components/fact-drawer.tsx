"use client";
import { ListChecks } from "lucide-react";
import { useState } from "react";
import { FactChip } from "@/components/fact-chip";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Fact } from "@/lib/api";
import { sourceLabel } from "@/lib/display";

function groupBySource(facts: Fact[]): [string, Fact[]][] {
  const groups = new Map<string, Fact[]>();
  for (const f of facts) groups.set(f.source, [...(groups.get(f.source) ?? []), f]);
  return [...groups.entries()];
}

export function FactDrawer({ facts }: { facts: Fact[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="h-10 px-4 text-sm font-semibold" onClick={() => setOpen(true)}>
        <ListChecks aria-hidden className="size-4" />
        How this was decided
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-heading text-lg">How this was decided</SheetTitle>
            <SheetDescription>Every number in the explanation was checked against these facts.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4 pb-6">
            {facts.length === 0 && <p className="text-muted-foreground">The backend didn’t list any facts for this plan.</p>}
            {groupBySource(facts).map(([source, group]) => (
              <section key={source} aria-label={sourceLabel(source)}>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{sourceLabel(source)}</h3>
                <ul className="flex flex-col gap-2.5">
                  {group.map((f) => (
                    <FactChip key={`${f.id}-${f.as_of}`} fact={f} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
