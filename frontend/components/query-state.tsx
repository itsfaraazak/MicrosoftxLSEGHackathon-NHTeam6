"use client";
import { AlertTriangle, RotateCw, ServerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE, ApiError } from "@/lib/api";

export function Working({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2.5 font-semibold text-muted-foreground">
      <span aria-hidden className="size-[18px] animate-spin rounded-full border-2 border-border border-t-primary" />
      {label}
    </div>
  );
}

function Notice({
  icon,
  title,
  children,
  onRetry,
  tone = "error",
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  onRetry?: () => void;
  tone?: "error" | "warn";
}) {
  const box = tone === "warn" ? "border-warn-line bg-warn-bg" : "border-destructive/40 bg-destructive/10";
  return (
    <div role="alert" className={`flex items-start gap-3.5 rounded-2xl border p-4 ${box}`}>
      <span aria-hidden className="mt-0.5 flex-none text-warn">{icon}</span>
      <div className="min-w-0 flex-1">
        <strong className="block">{title}</strong>
        <div className="text-[0.95rem] text-muted-foreground">{children}</div>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            <RotateCw aria-hidden className="size-3.5" /> Try again
          </Button>
        )}
      </div>
    </div>
  );
}

// Whole-request failure: says what happened and what to do next.
export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof ApiError) {
    if (error.kind === "cancelled") return null;
    if (error.kind === "contract") {
      return (
        <Notice icon={<AlertTriangle className="size-5" />} title="Contract mismatch" tone="warn" onRetry={onRetry}>
          The backend sent <code>{error.endpoint}</code> in a shape we don’t recognise
          {error.detail?.path ? <> at <code>{error.detail.path}</code></> : null}. Details are in the console. Tell the
          backend owner, then try again.
        </Notice>
      );
    }
    if (error.kind === "offline") {
      return (
        <Notice icon={<ServerOff className="size-5" />} title="The backend isn’t responding" onRetry={onRetry}>
          Check it’s running at <code>{API_BASE}</code>, or switch to offline demo data (set{" "}
          <code>NEXT_PUBLIC_DEMO_FALLBACK=1</code>).
        </Notice>
      );
    }
    if (error.kind === "timeout") {
      return (
        <Notice icon={<ServerOff className="size-5" />} title="That took too long" onRetry={onRetry}>
          The backend didn’t answer in time ({error.message.toLowerCase()}). Try again.
        </Notice>
      );
    }
    return (
      <Notice icon={<ServerOff className="size-5" />} title="The backend returned an error" onRetry={onRetry}>
        {error.message} for <code>{error.endpoint}</code>. Try again, or ask the backend owner to check its logs.
      </Notice>
    );
  }
  return (
    <Notice icon={<AlertTriangle className="size-5" />} title="Something went wrong" onRetry={onRetry}>
      {error instanceof Error ? error.message : "Unknown error"}
    </Notice>
  );
}

// An optional field failed validation: hide only that element and say so, in place.
export function InlineContractNotice({ message }: { message: string }) {
  return (
    <p role="note" className="inline-flex items-center gap-1.5 rounded-full border border-warn-line bg-warn-bg px-3 py-1 text-xs font-semibold text-foreground">
      <AlertTriangle aria-hidden className="size-3.5 text-warn" />
      Contract mismatch: {message}
    </p>
  );
}
