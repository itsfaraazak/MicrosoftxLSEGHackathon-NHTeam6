"use client";
import { ChevronLeft, ChevronRight, Clock, MessageCircle, PieChart, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { VIEWS, panelId, tabId, type ViewId } from "@/lib/views";

const ICONS: Record<ViewId, typeof UserRound> = {
  profile: UserRound,
  portfolio: PieChart,
  replay: Clock,
  ask: MessageCircle,
  proof: ShieldCheck,
};

export function Dock({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  const arrow = "glass inline-flex size-[42px] items-center justify-center rounded-full text-foreground hover:bg-tile-hover";
  return (
    <>
      {/* Phone: a bottom tab bar, big tap targets, short labels. */}
      <nav
        aria-label="Views"
        className="grid grid-cols-5 border-t bg-panel-solid pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div role="tablist" aria-label="Views" className="col-span-5 grid grid-cols-5">
          {VIEWS.map((v, i) => {
            const selected = i === active;
            const Icon = ICONS[v.id];
            return (
              <button
                key={v.id}
                id={tabId(v.id)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(v.id)}
                onClick={() => onSelect(i)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold",
                  selected ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon aria-hidden className={cn("size-5", selected && "stroke-[2.5]")} />
                {v.short}
              </button>
            );
          })}
        </div>
      </nav>

      <nav aria-label="Views" className="hidden items-center justify-center gap-2.5 px-4 pt-1 pb-2 md:flex">
        <button type="button" className={arrow} aria-label="Previous view" onClick={() => onSelect(active - 1)}>
          <ChevronLeft aria-hidden className="size-[18px]" />
        </button>
        <div role="tablist" aria-label="Views" className="glass flex gap-1 rounded-full p-[5px]">
          {VIEWS.map((v, i) => {
            const selected = i === active;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(v.id)}
                tabIndex={selected ? 0 : -1}
                onClick={() => onSelect(i)}
                className={cn(
                  "rounded-full px-[18px] py-[9px] text-[15px] font-semibold whitespace-nowrap transition-colors",
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
    </>
  );
}
