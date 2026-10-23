"use client";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Fact, Profile } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const TIMEOUT_MS = 20_000;
const SUGGESTIONS = [
  "Why do I have so little in tech?",
  "Why is my deposit in Treasuries?",
  "What is diversification?",
];

type AskResponse = { answer: string; facts_used: Fact[] };
type Turn = { question: string; answer?: string; facts?: Fact[]; error?: string };

async function askBackend(
  question: string,
  profile: Profile | null,
  simDate: string,
  signal: AbortSignal,
): Promise<AskResponse> {
  const res = await fetch(`${BASE}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, profile, sim_date: simDate }),
    signal,
  });
  if (!res.ok) throw new Error(`ask failed: ${res.status}`);
  return (await res.json()) as AskResponse;
}

function readProfile(): Profile | null {
  try {
    const raw = sessionStorage.getItem("profile");
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function Sources({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) return null;
  return (
    <details className="mt-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none font-medium">
        Sources ({facts.length})
      </summary>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {facts.map((f) => (
          <li key={`${f.id}-${f.as_of}`}>
            {f.id}: {f.value} {f.unit} ({f.source}, {f.as_of})
          </li>
        ))}
      </ul>
    </details>
  );
}

export function AskPanel({ simDate = "2022-01-03" }: { simDate?: string }) {
  const [hasProfile, setHasProfile] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setHasProfile(readProfile() !== null), 0);
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns, loading]);

  async function run(question: string, index: number | null) {
    const q = question.trim();
    if (!q || loading) return;
    setTurns((t) =>
      index === null
        ? [...t, { question: q }]
        : t.map((x, i) => (i === index ? { question: q } : x)),
    );
    const at = index ?? turns.length;
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await askBackend(q, readProfile(), simDate, ctrl.signal);
      setTurns((t) =>
        t.map((x, i) => (i === at ? { question: q, answer: r.answer, facts: r.facts_used } : x)),
      );
    } catch (e) {
      const timedOut = e instanceof DOMException && e.name === "AbortError";
      setTurns((t) =>
        t.map((x, i) =>
          i === at
            ? {
                question: q,
                error: timedOut
                  ? "That took too long. Please try again."
                  : "Sorry, I could not get an answer just now. Please try again.",
              }
            : x,
        ),
      );
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = input;
    setInput("");
    void run(q, null);
  }

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Ask about your portfolio</CardTitle>
        {!hasProfile && (
          <p className="text-sm text-muted-foreground">
            No profile found yet. Answers will be general until you build one on the home page.
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={loading}
              onClick={() => void run(s, null)}
              className="rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <Badge variant="outline" className="h-auto cursor-pointer whitespace-normal py-1 text-left">
                {s}
              </Badge>
            </button>
          ))}
        </div>
        <Separator />
        <div
          className="flex max-h-[60vh] min-h-24 flex-col gap-3 overflow-y-auto"
          role="log"
          aria-live="polite"
          aria-label="Conversation"
        >
          {turns.length === 0 && (
            <p className="text-sm text-muted-foreground">Pick a question or type your own.</p>
          )}
          {turns.map((t, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                {t.question}
              </div>
              {t.answer !== undefined && (
                <div className="mr-auto max-w-[90%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm">
                  <p>{t.answer}</p>
                  <Sources facts={t.facts ?? []} />
                </div>
              )}
              {t.error && (
                <div
                  role="alert"
                  className="mr-auto flex max-w-[90%] flex-col items-start gap-2 rounded-2xl rounded-bl-sm bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  <p>{t.error}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() => void run(t.question, i)}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="mr-auto flex w-3/4 flex-col gap-2" role="status" aria-label="Loading answer">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}
          <div ref={endRef} />
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="ask-input" className="sr-only">
            Your question
          </label>
          <Input
            id="ask-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question"
            autoComplete="off"
            maxLength={500}
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            Ask
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
