"use client";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealth, type HealthStatus } from "@/lib/queries";

export const HEALTH_LOOK: Record<HealthStatus, { label: string; dot: string; box: string; title: string }> = {
  checking: {
    label: "Checking backend",
    dot: "bg-muted-foreground",
    box: "glass text-muted-foreground",
    title: "Contacting the backend",
  },
  live: {
    // "Backend connected" avoids confusion with the live-market "Go live" feature: this pill only
    // means the Flask backend is reachable, not that market data is live.
    label: "Backend connected",
    dot: "bg-plan",
    box: "glass text-foreground",
    title: "Connected to the live backend",
  },
  mock: {
    label: "Mock data",
    dot: "bg-primary",
    box: "glass text-foreground",
    title: "The backend is serving its mock responses (USE_MOCKS=1)",
  },
  offline: {
    label: "Backend offline",
    dot: "bg-destructive",
    box: "glass border-destructive/50 text-foreground",
    title: "The backend isn't responding on port 5000",
  },
  "offline-demo": {
    label: "Offline demo data",
    dot: "bg-warn",
    box: "border border-warn-line bg-warn-bg text-foreground backdrop-blur-md",
    title: "Backend unreachable: showing saved demo responses",
  },
};

export function HealthBadge({ className }: { className?: string }) {
  const { status, refetch } = useHealth();
  const look = HEALTH_LOOK[status];
  return (
    <div
      role="status"
      aria-live="polite"
      title={look.title}
      className={cn("inline-flex items-center gap-2 rounded-full py-1.5 pr-1.5 pl-3 text-sm font-semibold whitespace-nowrap", look.box, className)}
    >
      <span aria-hidden className={cn("size-2 rounded-full", look.dot)} />
      <span>{look.label}</span>
      {status === "offline" ? (
        <button
          type="button"
          onClick={refetch}
          className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:bg-tile-hover hover:text-foreground"
        >
          <RotateCw aria-hidden className="size-3" />
          Retry
        </button>
      ) : (
        <span className="w-1.5" />
      )}
    </div>
  );
}
