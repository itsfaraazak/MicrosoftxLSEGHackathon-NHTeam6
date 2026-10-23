"use client";
import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { FactChip } from "@/components/fact-chip";
import { PanelBody, PanelHead } from "@/components/panel";
import { ErrorNotice, Working } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppState } from "@/lib/app-state";
import { ApiError, FactSchema, api } from "@/lib/api";
import { longDate } from "@/lib/display";
import { useSessionValue, writeSession } from "@/lib/session-store";
import { cn } from "@/lib/utils";
import { goToView } from "@/lib/views";

const LEAK_QUESTION = "What happens to tech stocks in 2022?";
const SUGGESTED = [
  "Why so little in my job’s sector?",
  "What if markets fall 30%?",
  "Should I sell?",
  LEAK_QUESTION,
];

const ExchangeSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  facts: z.array(FactSchema),
  simDate: z.string(),
});
type Exchange = z.infer<typeof ExchangeSchema>;
const HistorySchema = z.array(ExchangeSchema);
const HISTORY_KEY = "ask-history";

// Questions are sent as plain text: tags are stripped before they leave the browser.
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").trim();

function ExchangeView({ item }: { item: Exchange }) {
  const leak = item.question === LEAK_QUESTION;
  return (
    <li className="flex flex-col gap-2.5">
      <p className="max-w-[82%] self-end rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground">{item.question}</p>
      <div
        className={cn(
          "max-w-[88%] self-start rounded-2xl rounded-bl-md border px-4 py-3",
          leak ? "border-primary bg-ion-soft" : "tile",
        )}
      >
        {leak && (
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
            <ShieldCheck aria-hidden className="size-4" /> Leak test
          </p>
        )}
        <p className="leading-relaxed whitespace-pre-wrap">{item.answer}</p>
        {item.facts.length > 0 && (
          <ul className="mt-2.5 flex flex-col gap-2">
            {item.facts.map((f) => (
              <FactChip key={`${f.id}-${f.as_of}`} fact={f} />
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm font-semibold text-muted-foreground">Answer uses data up to {longDate(item.simDate)}</p>
        {leak && (
          <p className="mt-1 text-sm text-muted-foreground">
            We asked about the future on purpose: the assistant only sees data up to the simulation date.
          </p>
        )}
      </div>
    </li>
  );
}

export function AskView() {
  const { profile, plan, clock } = useAppState();
  const raw = useSessionValue(HISTORY_KEY);
  const history = useMemo<Exchange[]>(() => {
    if (raw === null) return [];
    try {
      const parsed = HistorySchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }, [raw]);

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<{ error: unknown; question: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [history.length, pending]);

  async function ask(rawQuestion: string) {
    const question = stripHtml(rawQuestion);
    if (!question || !profile || pending) return;
    const ctl = new AbortController();
    controller.current = ctl;
    setPending(question);
    setError(null);
    setDraft("");
    try {
      const res = await api.ask(question, profile, clock.date, ctl.signal);
      const item: Exchange = {
        id: `${Date.now()}`,
        question,
        answer: res.answer,
        facts: res.facts_used,
        simDate: clock.date,
      };
      writeSession(HISTORY_KEY, JSON.stringify([...history, item]));
    } catch (e) {
      if (!(e instanceof ApiError && e.kind === "cancelled")) setError({ error: e, question });
    } finally {
      setPending(null);
      controller.current = null;
    }
  }

  return (
    <>
      <PanelHead
        title="Ask about your plan"
        subtitle="Every answer uses only the facts in your plan up to the simulation date, and shows where each number came from."
      />
      <PanelBody className="flex flex-col gap-3">
        {!profile || !plan ? (
          <div className="tile flex flex-col items-start gap-3 rounded-2xl p-6">
            <p>Build your plan first, then ask questions about it.</p>
            <Button className="h-10 px-4 font-semibold" onClick={() => goToView("profile")}>
              Go to your profile
            </Button>
          </div>
        ) : (
          <>
            <div role="log" aria-live="polite" aria-label="Conversation" className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto">
              {history.length === 0 && !pending && (
                <p className="text-center text-muted-foreground">Pick a question below, or type your own.</p>
              )}
              <ul className="flex flex-col gap-5">
                {history.map((h) => (
                  <ExchangeView key={h.id} item={h} />
                ))}
              </ul>
              {pending && (
                <div className="flex flex-col gap-2.5">
                  <p className="max-w-[82%] self-end rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground">{pending}</p>
                  <div className="tile flex items-center gap-4 self-start rounded-2xl rounded-bl-md px-4 py-3">
                    <Working label="Checking every number against its source" />
                    <Button variant="outline" size="sm" onClick={() => controller.current?.abort()}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {error && <ErrorNotice error={error.error} onRetry={() => void ask(error.question)} />}
              <div ref={endRef} />
            </div>

            <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5">
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={!!pending}
                    onClick={() => void ask(q)}
                    className={cn(
                      "rounded-full border px-3.5 py-2 text-sm font-semibold hover:border-primary disabled:opacity-50",
                      q === LEAK_QUESTION ? "border-primary bg-ion-soft" : "bg-panel-solid",
                    )}
                  >
                    {q === LEAK_QUESTION && <span className="mr-1.5 text-primary">Leak test:</span>}
                    {q}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask(draft);
                }}
              >
                <label htmlFor="ask-input" className="sr-only">Your question</label>
                <Input
                  id="ask-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask anything about your plan"
                  autoComplete="off"
                  className="h-11 flex-1 bg-panel-solid text-base"
                />
                <Button type="submit" className="h-11 px-5 text-base font-bold" disabled={!!pending || !draft.trim()}>
                  Ask
                </Button>
              </form>
            </div>
          </>
        )}
      </PanelBody>
    </>
  );
}
