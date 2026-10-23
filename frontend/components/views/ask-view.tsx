"use client";
import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ProvenanceChip } from "@/components/provenance-chip";
import { PanelBody, PanelHead } from "@/components/panel";
import { ErrorNotice, Working } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppState } from "@/lib/app-state";
import { ApiError, FactSchema, api, type Fact } from "@/lib/api";
import { factLabel, factValue, longDate } from "@/lib/display";
import { useSessionValue, writeSession } from "@/lib/session-store";
import { cn } from "@/lib/utils";
import { goToView } from "@/lib/views";

const LEAK_QUESTION = "What happens to tech stocks in 2022?";
const SUGGESTED = [
  "Why so little in my job’s sector?",
  "What if markets fall 30%?",
  "Should I sell?",
  "Do you have recent data?",
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

const MAX_FACTS = 4;

// The backend can send many near-identical facts (one overlap fact per sector fund). Show each kind of fact once.
function compactFacts(facts: Fact[]): Fact[] {
  const seen = new Set<string>();
  return facts.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
}

// "last_close_qqq" -> "QQQ last close"; everything else uses the shared labels.
function askFactLabel(f: Fact): string {
  const m = /^(last_close|week_change)_([a-z]+)$/.exec(f.id);
  if (!m) return factLabel(f.id);
  return `${m[2].toUpperCase()} ${m[1] === "last_close" ? "last close" : "change over 1 week"}`;
}

function FactsList({ facts }: { facts: Fact[] }) {
  const [all, setAll] = useState(false);
  const unique = useMemo(() => compactFacts(facts), [facts]);
  if (unique.length === 0) return null;
  const shown = all ? unique : unique.slice(0, MAX_FACTS);
  return (
    <div className="mt-2.5">
      <ul className="flex flex-col gap-2">
        {shown.map((f) => (
          <li key={`${f.id}-${f.as_of}`} className="flex flex-wrap items-center gap-2 text-[0.95rem]">
            <span>{askFactLabel(f)}:</span>
            <strong className="money">{factValue(f)}</strong>
            <ProvenanceChip source={f.source} asOf={f.as_of} />
          </li>
        ))}
      </ul>
      {unique.length > MAX_FACTS && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-2 min-h-9 text-sm font-semibold text-primary underline underline-offset-4"
        >
          {all ? "Show fewer facts" : `Show ${unique.length - MAX_FACTS} more facts`}
        </button>
      )}
    </div>
  );
}

function ExchangeView({ item }: { item: Exchange }) {
  const leak = item.question === LEAK_QUESTION;
  return (
    <li className="flex flex-col gap-2.5">
      <p className="max-w-[92%] self-end rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground">{item.question}</p>
      <div
        className={cn(
          "max-w-[94%] self-start rounded-2xl rounded-bl-md border px-4 py-3",
          leak ? "border-primary bg-ion-soft" : "tile",
        )}
      >
        {leak && (
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
            <ShieldCheck aria-hidden className="size-4" /> Leak test
          </p>
        )}
        <p className="leading-relaxed whitespace-pre-wrap">{item.answer}</p>
        <FactsList facts={item.facts} />
        <p className="mt-2 text-[0.95rem] font-semibold text-muted-foreground">Answer uses data up to {longDate(item.simDate)}</p>
        {leak && (
          <p className="mt-1 text-[0.95rem] text-muted-foreground">
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
  const busy = useRef(false); // synchronous guard: state updates are too late to stop a fast double-tap
  const latestHistory = useRef<Exchange[]>(history);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    latestHistory.current = history;
  }, [history]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [history.length, pending, error]);

  // Leaving the view (or a Reset demo remount) must not leave a request running against a gone component.
  useEffect(() => () => controller.current?.abort(), []);

  async function ask(rawQuestion: string) {
    const question = stripHtml(rawQuestion);
    if (!question || !profile || busy.current) return;
    busy.current = true;
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
      writeSession(HISTORY_KEY, JSON.stringify([...latestHistory.current, item]));
    } catch (e) {
      if (!(e instanceof ApiError && e.kind === "cancelled")) setError({ error: e, question });
    } finally {
      busy.current = false;
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
      <PanelBody className="flex flex-col gap-3 overflow-hidden!">
        {!profile || !plan ? (
          <div className="tile flex flex-col items-start gap-3 rounded-2xl p-6">
            <p>Build your plan first, then ask questions about it.</p>
            <Button className="min-h-11 px-4 text-base font-semibold" onClick={() => goToView("profile")}>
              Go to your profile
            </Button>
          </div>
        ) : (
          <>
            <div role="log" aria-live="polite" aria-label="Conversation" className="mx-auto flex min-h-[9rem] w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto">
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
                  <p className="max-w-[92%] self-end rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground">{pending}</p>
                  <div className="tile flex items-center gap-4 self-start rounded-2xl rounded-bl-md px-4 py-3">
                    <Working label="Checking every number against its source" />
                    <Button variant="outline" className="min-h-11 px-4 text-base font-semibold" onClick={() => controller.current?.abort()}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {error && <ErrorNotice error={error.error} onRetry={() => void ask(error.question)} />}
              <div ref={endRef} />
            </div>

            <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5">
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:justify-center md:overflow-visible">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={!!pending}
                    onClick={() => void ask(q)}
                    className={cn(
                      "min-h-11 shrink-0 rounded-full border px-4 py-2 text-[0.95rem] font-semibold whitespace-nowrap hover:border-primary disabled:opacity-50 md:whitespace-normal",
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
                  enterKeyHint="send"
                  // On a phone the keyboard covers the bottom of the screen: bring the field back into view.
                  onFocus={(e) => {
                    const el = e.currentTarget;
                    setTimeout(() => el.scrollIntoView({ block: "nearest" }), 250);
                  }}
                  className="h-12 flex-1 bg-panel-solid text-base md:text-base"
                />
                <Button type="submit" className="h-12 px-5 text-base font-bold" disabled={!!pending || !draft.trim()}>
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
