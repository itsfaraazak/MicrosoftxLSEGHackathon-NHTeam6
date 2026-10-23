"use client";
import { Database, Menu, MoonStar, Network, RotateCcw, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useState } from "react";
import { DATA_SOURCES_MENU_CLASS, DataSourcesChip, DataSourcesSheet } from "@/components/data-sources-chip";
import { HEALTH_LOOK, HealthBadge } from "@/components/health-badge";
import { LiveToggle } from "@/components/live-toggle";
import { RigorButton, type RigorStepId } from "@/components/rigor-drawer";
import { SimClock } from "@/components/sim-clock";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAppState } from "@/lib/app-state";
import { BRAND } from "@/lib/brand";
import { useHealth } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { goToView } from "@/lib/views";

function BrandMark() {
  return (
    <svg viewBox="0 0 30 30" className="size-[30px] flex-none" aria-hidden>
      <circle cx="11" cy="15" r="8" fill="none" stroke="var(--primary)" strokeWidth="2" />
      <circle cx="19" cy="15" r="8" fill="none" stroke="var(--plan)" strokeWidth="2" />
    </svg>
  );
}

function ThemeToggle({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      className={cn("glass inline-flex items-center justify-center gap-3 rounded-full text-foreground hover:bg-tile-hover", className)}
      aria-label="Switch between light and dark theme"
    >
      <Sun aria-hidden className="hidden size-5 dark:block" />
      <MoonStar aria-hidden className="size-5 dark:hidden" />
      {withLabel && <span className="text-base font-semibold">Switch light / dark</span>}
    </button>
  );
}

function PhoneMenu({ stepId }: { stepId: RigorStepId }) {
  const [open, setOpen] = useState(false);
  // The data-sources sheet lives outside the menu sheet, so closing the menu doesn't unmount it.
  const [dataOpen, setDataOpen] = useState(false);
  const { status } = useHealth();
  const { resetDemo } = useAppState();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Menu. Status: ${HEALTH_LOOK[status].label}`}
        className="glass relative inline-flex size-11 flex-none items-center justify-center rounded-full"
      >
        <Menu aria-hidden className="size-5" />
        <span aria-hidden className={cn("absolute top-2 right-2 size-2.5 rounded-full ring-2 ring-background", HEALTH_LOOK[status].dot)} />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="font-heading text-xl">{BRAND.name} menu</SheetTitle>
            <SheetDescription>{BRAND.full}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-6">
            <HealthBadge className="self-start" />
            <button
              type="button"
              className={DATA_SOURCES_MENU_CLASS}
              onClick={() => {
                setOpen(false);
                setDataOpen(true);
              }}
            >
              <Database aria-hidden className="size-5 text-primary" /> Where the numbers come from
            </button>
            <Link href="/how-it-works" className={DATA_SOURCES_MENU_CLASS} onClick={() => setOpen(false)}>
              <Network aria-hidden className="size-5 text-primary" /> How SPARK works
            </Link>
            <RigorButton stepId={stepId} className="min-h-12 w-full justify-start gap-3 rounded-2xl px-4 text-base" />
            <ThemeToggle withLabel className="tile min-h-12 w-full justify-start rounded-2xl px-4" />
            <button
              type="button"
              onClick={() => {
                resetDemo();
                goToView("profile");
                setOpen(false);
              }}
              className="tile flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-base font-semibold hover:bg-tile-hover"
            >
              <RotateCcw aria-hidden className="size-5" /> Start over
            </button>
          </div>
        </SheetContent>
      </Sheet>
      <DataSourcesSheet open={dataOpen} onOpenChange={setDataOpen} />
    </>
  );
}

export function TopBar({ stepId }: { stepId: RigorStepId }) {
  return (
    <>
      {/* Phone: one slim row. Everything secondary lives in the menu. */}
      <header className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1.5 md:hidden">
        <BrandMark />
        <span className="font-heading text-base font-semibold tracking-tight">{BRAND.name}</span>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <SimClock />
          <LiveToggle />
          <PhoneMenu stepId={stepId} />
        </div>
      </header>

      {/* Desktop */}
      <header className="hidden grid-cols-[1fr_auto_1fr] items-center gap-4 px-7 pt-4 pb-1.5 md:grid">
        <div className="flex items-center gap-3 font-heading text-base font-semibold tracking-tight">
          <BrandMark />
          <span className="flex flex-col leading-tight">
            <span>{BRAND.name}</span>
            <span className="hidden text-[11px] font-medium text-muted-foreground xl:block">{BRAND.full}</span>
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <SimClock />
          <LiveToggle />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/how-it-works"
            aria-label="How SPARK works"
            title="How SPARK works"
            className="tile inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap text-muted-foreground hover:bg-tile-hover"
          >
            <Network aria-hidden className="size-3.5" />
            <span className="hidden xl:inline">How it works</span>
          </Link>
          <DataSourcesChip />
          <RigorButton stepId={stepId} className="h-9 min-h-9" />
          <HealthBadge />
          <ThemeToggle className="size-9" />
        </div>
      </header>
    </>
  );
}
