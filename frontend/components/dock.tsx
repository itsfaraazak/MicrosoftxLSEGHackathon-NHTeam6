"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { VIEWS, panelId, tabId } from "@/lib/views";

export function Dock({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  const arrow =
    "glass hidden size-[42px] items-center justify-center rounded-full text-foreground hover:bg-tile-hover md:inline-flex";
  return (
    <nav aria-label="Views" className="flex items-center justify-center gap-2.5 px-2 pt-1 pb-3 md:px-4 md:pb-4">
      <button type="button" className={arrow} aria-label="Previous view" onClick={() => onSelect(active - 1)}>
        <ChevronLeft aria-hidden className="size-[18px]" />
      </button>
      <div role="tablist" aria-label="Views" className="glass flex gap-1 rounded-full p-[5px]">
        {VIEWS.map((v, i) => {
          const selected = i === active;
          return (
            <button
              key={v.id}
              id={tabId(v.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(v.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(i)}
              className={cn(
                "rounded-full px-2.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors md:px-[18px] md:py-[9px] md:text-[15px]",
                selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-tile-hover hover:text-foreground",
              )}
            >
              {v.title}
            </button>
          );
        })}
      </div>
      <button type="button" className={arrow} aria-label="Next view" onClick={() => onSelect(active + 1)}>
        <ChevronRight aria-hidden className="size-[18px]" />
      </button>
    </nav>
  );
}
