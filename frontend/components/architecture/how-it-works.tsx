"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AzureTable } from "@/components/architecture/azure-table";
import { DataFlow } from "@/components/architecture/data-flow";
import { Level1 } from "@/components/architecture/level1";
import { Level2 } from "@/components/architecture/level2";
import { Level3 } from "@/components/architecture/level3";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "minute", label: "In one minute", sub: "Level 1 · for everyone", el: <Level1 /> },
  { id: "parts", label: "The parts", sub: "Level 2 · product", el: <Level2 /> },
  { id: "hood", label: "Under the hood", sub: "Level 3 · technical", el: <Level3 /> },
  { id: "data", label: "Your data", sub: "Data flow + where you end", el: <DataFlow /> },
  { id: "azure", label: "Microsoft & Azure", sub: "What is really used", el: <AzureTable /> },
] as const;

export function HowItWorks() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("minute");
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 md:px-8 md:py-8">
      <header className="flex flex-col gap-2">
        <Link href="/" className="inline-flex min-h-11 w-fit items-center gap-2 text-[15px] font-semibold text-primary underline-offset-4 hover:underline">
          <ArrowLeft aria-hidden className="size-4" /> Back to {BRAND.name}
        </Link>
        <h1 className="font-heading text-[28px] leading-tight font-semibold tracking-tight md:text-4xl">How {BRAND.name} works</h1>
        <p className="max-w-[70ch] text-base text-muted-foreground">
          {BRAND.full}. The same app explained at three levels of detail, plus how your data moves and which Microsoft services are really used.
        </p>
      </header>

      <div role="tablist" aria-label="Sections" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={t.id === tab}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex min-h-12 flex-col items-start justify-center rounded-2xl border px-4 py-1.5 text-left",
              t.id === tab ? "border-primary bg-primary text-primary-foreground" : "tile hover:bg-tile-hover",
            )}
          >
            <span className="text-[15px] leading-tight font-bold">{t.label}</span>
            <span className={cn("text-sm leading-tight", t.id === tab ? "text-primary-foreground/80" : "text-muted-foreground")}>{t.sub}</span>
          </button>
        ))}
      </div>

      <section id={`panel-${current.id}`} role="tabpanel" aria-labelledby={`tab-${current.id}`} className="glass rounded-3xl p-4 md:p-6">
        {current.el}
      </section>
    </div>
  );
}
