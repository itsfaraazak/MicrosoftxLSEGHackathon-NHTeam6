"use client";
// Self-contained "Rigor" pill + sheet: drop <RigorButton stepId="..." /> anywhere and it renders its own
// trigger and drawer content. Everything inside degrades to short honest fallback copy on a bad/missing
// fetch — this is the whole point of the lenient schemas in lib/rigor-schema.ts.
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MetaSummaryChip } from "@/components/rigor-chip";
import { useAppState } from "@/lib/app-state";
import { longDate } from "@/lib/display";
import { useAudit, useRigorSummary } from "@/lib/rigor";
import type { AuditEvent, Meta } from "@/lib/rigor-schema";
import { cn } from "@/lib/utils";

export type RigorStepId = "profile" | "portfolio" | "replay" | "ask" | "proof";

type Stage = { label: string; kind: "code" | "ai" | "you" };

const PIPELINES: Record<RigorStepId, Stage[]> = {
  profile: [
    { label: "Text input", kind: "you" },
    { label: "Guardrail filter", kind: "code" },
    { label: "LLM parses profile", kind: "ai" },
    { label: "Contradiction check", kind: "code" },
    { label: "Audit log", kind: "code" },
  ],
  portfolio: [
    { label: "Profile", kind: "code" },
    { label: "Exposure mapper (job→sectors)", kind: "ai" },
    { label: "Allocation rules", kind: "code" },
    { label: "Explainer", kind: "ai" },
    { label: "Number check against Facts", kind: "code" },
    { label: "Audit log", kind: "code" },
  ],
  replay: [
    { label: "Historical prices", kind: "code" },
    { label: "Drawdown detector", kind: "code" },
    { label: "Coach message", kind: "ai" },
    { label: "Number check", kind: "code" },
  ],
  ask: [
    { label: "Question", kind: "you" },
    { label: "Guardrail filter", kind: "code" },
    { label: "AI answer", kind: "ai" },
    { label: "Number check", kind: "code" },
    { label: "Audit log", kind: "code" },
  ],
  proof: [
    { label: "Historical prices", kind: "code" },
    { label: "Backtest script", kind: "code" },
    { label: "Verdict", kind: "code" },
    { label: "Audit log", kind: "code" },
  ],
};

function StageBadge({ kind }: { kind: Stage["kind"] }) {
  if (kind === "you") return <Badge variant="outline">YOU</Badge>;
  if (kind === "code") return <Badge variant="secondary">CODE</Badge>;
  return (
    <Badge variant="default" className="bg-violet-600 text-white">
      AI
    </Badge>
  );
}

function Pipeline({ stepId }: { stepId: RigorStepId }) {
  const stages = PIPELINES[stepId];
  return (
    <div className="flex flex-col gap-2">
      {stages.map((s, i) => (
        <div key={`${s.label}-${i}`} className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
            <StageBadge kind={s.kind} />
            <span className="truncate text-sm">{s.label}</span>
          </div>
          {i < stages.length - 1 && (
            <span aria-hidden className="shrink-0 text-muted-foreground">
              ↓
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function fmtTs(ts: string): string {
  if (!ts) return "unknown time";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
}

function AuditRow({ event }: { event: AuditEvent }) {
  const hasPayload = event.payload !== undefined && event.payload !== null && Object.keys(event.payload as object).length > 0;
  return (
    <li className="flex flex-col gap-1 rounded-md border border-border/60 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline">{event.kind || "event"}</Badge>
        <span className="text-xs text-muted-foreground">{fmtTs(event.ts)}</span>
      </div>
      <p className="text-sm">{event.summary || "(no summary)"}</p>
      {hasPayload && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Payload</summary>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(event.payload, null, 2)}</pre>
        </details>
      )}
    </li>
  );
}

function LiveTrace() {
  const { data, isLoading } = useAudit(20);
  const events = data?.events ?? [];
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading audit trail…</p>;
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No audit events yet.</p>;
  return <ul className="flex flex-col gap-2">{events.map((e, i) => <AuditRow key={e.id || i} event={e} />)}</ul>;
}

function RigorSummarySection() {
  const { data, isLoading } = useRigorSummary();
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading rigor summary…</p>;
  const principles = data?.principles ?? [];
  const tests = data?.tests ?? { backend: 0, redteam_cases: 0 };
  return (
    <div className="flex flex-col gap-3">
      {principles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No principles listed.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {principles.map((p, i) => (
            <li key={p.id || i} className="text-sm">
              <span className="font-semibold">{p.title || "(untitled principle)"}</span>
              {p.detail && <span className="text-muted-foreground"> — {p.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {tests.backend} backend tests · {tests.redteam_cases} red-team cases
      </p>
    </div>
  );
}

export function RigorButton({ stepId, meta, className }: { stepId: RigorStepId; meta?: Meta; className?: string }) {
  const [open, setOpen] = useState(false);
  const { clock } = useAppState();
  return (
    <>
      <Button
        variant="outline"
        className={cn("tile min-h-11 rounded-full px-4 text-sm font-semibold", className)}
        onClick={() => setOpen(true)}
      >
        <ShieldCheck aria-hidden className="size-4" />
        Rigor
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] w-full overflow-y-auto sm:max-w-full">
          <SheetHeader>
            <SheetTitle className="font-heading text-lg">How this was checked</SheetTitle>
            <SheetDescription>The pipeline behind this step, plus the live audit trail and rigor principles.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-6 px-4 pb-6">
            {meta && <MetaSummaryChip meta={meta} />}

            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Pipeline for this step</h3>
              <Pipeline stepId={stepId} />
            </section>

            <section className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold text-muted-foreground">Data clock</h3>
              <p className="text-sm">Nothing after {longDate(clock.date)} is visible.</p>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none">Data sources</summary>
                <p className="mt-1">
                  Prices: yfinance (ETF closes) · Inflation/rates: FRED · Layoffs: Kaggle. Loaded through {longDate(clock.date)}.
                </p>
              </details>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Live trace</h3>
              <LiveTrace />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Rigor summary</h3>
              <RigorSummarySection />
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
