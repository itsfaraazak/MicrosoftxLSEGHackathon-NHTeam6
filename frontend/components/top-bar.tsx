"use client";
import { MoonStar, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { DataSourcesChip } from "@/components/data-sources-chip";
import { HealthBadge } from "@/components/health-badge";
import { LiveToggle } from "@/components/live-toggle";
import { SimClock } from "@/components/sim-clock";

function BrandMark() {
  return (
    <svg viewBox="0 0 30 30" className="size-[30px] flex-none" aria-hidden>
      <circle cx="11" cy="15" r="8" fill="none" stroke="var(--primary)" strokeWidth="2" />
      <circle cx="19" cy="15" r="8" fill="none" stroke="var(--plan)" strokeWidth="2" />
    </svg>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      className="glass inline-flex size-9 items-center justify-center rounded-full text-foreground hover:bg-tile-hover"
      aria-label="Switch between light and dark theme"
    >
      <Sun aria-hidden className="hidden size-4 dark:block" />
      <MoonStar aria-hidden className="size-4 dark:hidden" />
    </button>
  );
}

export function TopBar() {
  return (
    <header className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 pt-3.5 pb-1 md:grid-cols-[1fr_auto_1fr] md:gap-4 md:px-7 md:pt-4.5 md:pb-1.5">
      <div className="flex items-center gap-3 font-heading text-base font-semibold tracking-tight">
        <BrandMark />
        <span className="hidden sm:inline">Don’t Double Down</span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <SimClock />
        <LiveToggle />
      </div>
      <div className="col-span-2 flex items-center justify-center gap-2 md:col-span-1 md:justify-end">
        <DataSourcesChip className="hidden sm:inline-flex" />
        <HealthBadge />
        <ThemeToggle />
      </div>
    </header>
  );
}
