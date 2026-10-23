"use client";
import { useState } from "react";
import { Callout, Legend, TONES, type Tone } from "@/components/architecture/primitives";
import { cn } from "@/lib/utils";

type Lane = "you" | "server" | "ai" | "data";
type Step = {
  lane: Lane;
  title: string;
  /** what travels, in plain words */
  data?: string;
  /** where it is stored afterwards */
  kept?: string;
  /** crossing: "out" leaves your device, "in" comes back */
  cross?: "out" | "in";
};
type Item = Step | { boundary: string };

const LANES: { id: Lane; tone: Tone; name: string; note: string }[] = [
  { id: "you", tone: "you", name: "You (browser)", note: "your device" },
  { id: "server", tone: "server", name: "SPARK server", note: "rules, caches, audit log" },
  { id: "ai", tone: "ai", name: "LLM portal", note: "words only" },
  { id: "data", tone: "data", name: "Market files", note: "public, same for everyone" },
];

const COL: Record<Lane, string> = { you: "md:col-start-1", server: "md:col-start-2", ai: "md:col-start-3", data: "md:col-start-4" };

const BOUNDARY = "YOUR DEVICE ENDS HERE";

const FLOWS: { id: string; label: string; intro: string; items: Item[] }[] = [
  {
    id: "plan",
    label: "Build my plan",
    intro: "From your free text to a plan with an explanation.",
    items: [
      { lane: "you", title: "You write or pick a story, then press “Read my answers”", data: "free text", kept: "browser memory only" },
      { boundary: BOUNDARY },
      { lane: "server", cross: "out", title: "POST /api/profile/parse", data: "your free text, nothing else", kept: "—" },
      { lane: "ai", title: "Text is fenced as untrusted data, then read by the model", data: "your text + a fixed schema + a system prompt with the simulation date", kept: "what the portal keeps is not visible in our code" },
      { lane: "server", title: "Reply is validated (pydantic), retried up to 2×, contradictions flagged in code", data: "profile JSON", kept: "audit log: the parsed profile" },
      { lane: "you", cross: "in", title: "You review and edit the profile", data: "profile JSON + contradictions", kept: "sessionStorage ddd:parsed, ddd:profile (this tab only)" },
      { boundary: BOUNDARY },
      { lane: "server", cross: "out", title: "POST /api/portfolio", data: "your profile JSON and the simulation date", kept: "profile remembered by first name in server memory; plan cached by hash" },
      { lane: "ai", title: "Exposure map: which sectors does your job depend on?", data: "job title, industry, employer only", kept: "audit log: the sector weights" },
      { lane: "server", title: "Code validates weights, then the allocation rules build positions and Facts", data: "positions + Facts (id, value, unit, source, date). No prices are read here", kept: "in the response" },
      { lane: "ai", title: "Explainer writes 4–6 sentences", data: "positions (ticker, amount, bucket) + Facts", kept: "—" },
      { lane: "server", title: "Number check: every number must match a Fact. Regenerate ≤2×, else a fixed template", data: "text vs Facts", kept: "audit log: the explanation" },
      { lane: "you", cross: "in", title: "Plan, explanation and facts arrive", data: "portfolio + explanation + facts + rigor meta", kept: "sessionStorage ddd:plan" },
    ],
  },
  {
    id: "replay",
    label: "Time machine",
    intro: "Replaying 2022 month by month.",
    items: [
      { lane: "you", title: "You open Time machine; your plan is already in this tab", data: "—", kept: "sessionStorage ddd:plan" },
      { boundary: BOUNDARY },
      { lane: "server", cross: "out", title: "GET /api/replay?profile_id=<first name>&from=…&to=…", data: "a first name and two dates, no profile body", kept: "—" },
      { lane: "server", title: "Looks you up in server memory; if the server forgot you (404) the app re-sends your profile and retries once", data: "profile", kept: "memory until the server restarts" },
      { lane: "data", title: "Closing prices read through the data clock, clipped at each month", data: "17 ETF closing prices up to the date, never later", kept: "files on the server" },
      { lane: "server", title: "Code detects drops: market-wide or specific, cost of selling", data: "drawdown %, cost, years to goal", kept: "audit log: guard_event" },
      { lane: "ai", title: "Coach message (only if REPLAY_LLM=1; otherwise a cached or template message)", data: "the event numbers + Facts, no prices", kept: "data/coach_cache.json" },
      { lane: "you", cross: "in", title: "Browser receives every month and event, but draws only up to the cursor", data: "months + events", kept: "browser memory" },
    ],
  },
  {
    id: "ask",
    label: "Ask a question",
    intro: "Guardrails run before the AI ever sees the question.",
    items: [
      { lane: "you", title: "You type a question or tap a suggestion", data: "question text", kept: "—" },
      { boundary: BOUNDARY },
      { lane: "server", cross: "out", title: "POST /api/ask", data: "question, your profile, simulation date", kept: "—" },
      { lane: "server", title: "Guardrails in code: distress, prompt injection, look-ahead. A refused question stops here", data: "question text", kept: "audit log: ask_refused" },
      { lane: "server", title: "Rebuild the Facts for your profile at the simulation date", data: "Facts", kept: "—" },
      { lane: "ai", title: "Answer in 2–4 sentences from the Facts only", data: "your job title + industry, Facts, the fenced question. Not your name, age, amounts or prices", kept: "—" },
      { lane: "server", title: "Number check, else a fixed fallback sentence", data: "text vs Facts", kept: "audit log: ask (question + answer)" },
      { lane: "you", cross: "in", title: "Answer + the facts it used", data: "answer + facts_used + rigor meta", kept: "sessionStorage ddd:ask-history" },
    ],
  },
  {
    id: "proof",
    label: "Proof",
    intro: "Tested by code only. No AI in this flow.",
    items: [
      { lane: "you", title: "You open Proof", data: "—", kept: "—" },
      { boundary: BOUNDARY },
      { lane: "server", cross: "out", title: "POST /api/proof", data: "your profile, plan, simulation date", kept: "—" },
      { lane: "data", title: "Prices up to the day before the simulation date", data: "closing prices, clipped", kept: "files on the server" },
      { lane: "server", title: "Backtest and stress windows, verdicts decided by code", data: "metrics + verdicts + real source of each function, its sha256 and a standalone script", kept: "—" },
      { lane: "you", cross: "in", title: "Claims with Supported / Not supported, plus the script to re-run", data: "proof JSON", kept: "browser memory" },
    ],
  },
  {
    id: "live",
    label: "Go live",
    intro: "The only moment the server talks to Yahoo Finance.",
    items: [
      { lane: "you", title: "You press Go live", data: "—", kept: "—" },
      { boundary: BOUNDARY },
      { lane: "server", cross: "out", title: "POST /api/live/refresh", data: "nothing about you", kept: "—" },
      { lane: "data", title: "yfinance downloads new daily closes for the 17 funds (once per minute at most)", data: "public prices", kept: "backend/data/prices.csv rewritten atomically" },
      { lane: "server", title: "Data clock reloads. Every endpoint still clips at the simulation date", data: "latest date", kept: "—" },
      { lane: "you", cross: "in", title: "The simulation clock moves to the latest date", data: "date", kept: "browser memory" },
    ],
  },
];

const YOUR_DATA: { what: string; where: string; how: string; who: string }[] = [
  { what: "Text you typed and edits before Build", where: "browser memory", how: "until you leave or Start over", who: "only you" },
  { what: "Parsed profile, plan, explanation, facts, persona, Ask history", where: "sessionStorage: ddd:parsed, ddd:profile, ddd:plan, ddd:persona, ddd:ask-history", how: "until the tab closes or Start over", who: "only you" },
  { what: "Compare cache (the three demo people, not you)", where: "sessionStorage: ddd:demo-prep", how: "until the tab closes; kept by Start over", who: "only you" },
  { what: "Your profile on the server", where: "server memory (registry by first name, plan cache)", how: "until the server restarts", who: "the server process" },
  { what: "Audit log: parsed profile, exposure, explanation, questions and answers, guard events", where: "backend/data/local_store.jsonl (Cosmos DB only if configured)", how: "no expiry or rotation in the code", who: "whoever has the file; GET /api/audit has no login" },
  { what: "What the AI model receives", where: "per request: free text; job, industry, employer; positions + Facts; or job, industry, Facts, question", how: "what the portal retains is not visible in our code", who: "the portal operator" },
  { what: "Market data", where: "prices.csv, fred.csv, layoffs.csv", how: "fixed files; prices extended by Go live", who: "public, same for everyone" },
];

export function DataFlow() {
  const [flowId, setFlowId] = useState("plan");
  const flow = FLOWS.find((f) => f.id === flowId) ?? FLOWS[0];
  // Step numbers skip the boundary markers.
  const numbered = flow.items.reduce<{ item: Item; n: number }[]>((acc, item) => {
    const prev = acc.at(-1)?.n ?? 0;
    return [...acc, { item, n: "boundary" in item ? prev : prev + 1 }];
  }, []);
  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[70ch] text-base leading-relaxed">
        Everything left of the dashed line stays on your device. Pick a flow to see what crosses it, in what form, who touches it next and where it is
        kept.
      </p>
      <Legend tones={["you", "server", "ai", "data", "example"]} />
      <div role="tablist" aria-label="Choose a flow" className="flex flex-wrap gap-2">
        {FLOWS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={f.id === flowId}
            onClick={() => setFlowId(f.id)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-[15px] font-semibold",
              f.id === flowId ? "border-primary bg-primary text-primary-foreground" : "tile hover:bg-tile-hover",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="text-[15px] text-muted-foreground">{flow.intro}</p>

      <div className="relative">
        <div className="mb-2 hidden gap-3 md:grid md:grid-cols-4" aria-hidden>
          {LANES.map((l) => (
            <div key={l.id} className="rounded-xl border-b-4 px-2 py-1.5 text-center" style={{ borderBottomColor: TONES[l.tone].color }}>
              <div className="text-[15px] font-bold">{l.name}</div>
              <div className="text-sm text-muted-foreground">{l.note}</div>
            </div>
          ))}
        </div>
        <div aria-hidden className="pointer-events-none absolute top-14 bottom-0 left-1/4 z-0 hidden -translate-x-[6px] border-l-2 border-dashed border-primary md:block" />
        <ol className="relative z-10 flex flex-col gap-2.5">
          {numbered.map(({ item: it, n }, i) => {
            if ("boundary" in it) {
              return (
                <li key={i} className="flex items-center gap-3 py-0.5" aria-label={it.boundary}>
                  <span className="h-0.5 flex-1 border-t-2 border-dashed border-primary" />
                  <span className="rounded-full border-2 border-primary bg-background px-3 py-1 text-sm font-bold tracking-wide text-primary">{it.boundary}</span>
                  <span className="h-0.5 flex-1 border-t-2 border-dashed border-primary" />
                </li>
              );
            }
            const tone = LANES.find((l) => l.id === it.lane)?.tone ?? "you";
            return (
              <li key={i} className="md:grid md:grid-cols-4 md:gap-3">
                <div
                  className={cn("tile flex gap-3 rounded-2xl border-l-4 bg-background/60 p-3", COL[it.lane])}
                  style={{ borderLeftColor: TONES[tone].color }}
                >
                  <span
                    className="mt-0.5 flex size-7 flex-none items-center justify-center rounded-full text-sm font-bold text-background"
                    style={{ background: TONES[tone].color }}
                    aria-label={`Step ${n}`}
                  >
                    {n}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-sm font-bold tracking-wide uppercase" style={{ color: TONES[tone].color }}>
                      <span className="md:hidden">{LANES.find((l) => l.id === it.lane)?.name}</span>
                      {it.cross && <span className="md:hidden"> · </span>}
                      {it.cross === "out" && <span>leaves your device</span>}
                      {it.cross === "in" && <span>comes back to you</span>}
                    </p>
                    <p className="text-[15px] leading-snug font-semibold">{it.title}</p>
                    {it.data && (
                      <p className="text-sm leading-snug text-muted-foreground">
                        <strong className="text-foreground">Data: </strong>
                        {it.data}
                      </p>
                    )}
                    {it.kept && (
                      <p className="text-sm leading-snug text-muted-foreground">
                        <strong className="text-foreground">Kept: </strong>
                        {it.kept}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <section aria-label="Your data" className="flex flex-col gap-2.5">
        <h3 className="text-lg font-bold">Your data: what is kept, where, for how long</h3>
        <div className="hidden grid-cols-[1.3fr_1.6fr_1.2fr_1fr] gap-3 px-3 text-sm font-bold tracking-wide text-muted-foreground uppercase md:grid" aria-hidden>
          <span>What</span>
          <span>Where</span>
          <span>How long</span>
          <span>Who can see it</span>
        </div>
        <ul className="flex flex-col gap-2">
          {YOUR_DATA.map((r) => (
            <li key={r.what} className="tile grid gap-1 rounded-2xl p-3 text-[15px] leading-snug md:grid-cols-[1.3fr_1.6fr_1.2fr_1fr] md:gap-3">
              <span className="font-semibold">{r.what}</span>
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground md:hidden">Where: </span>
                {r.where}
              </span>
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground md:hidden">How long: </span>
                {r.how}
              </span>
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground md:hidden">Who: </span>
                {r.who}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <Callout tone="data" title="Honest gaps">
        The audit log keeps parsed profiles and questions with no retention limit, and <code className="font-mono text-sm">/api/audit</code> has no login. That is fine for a
        paper-money demo, not for production. We also cannot see from our code what the LLM portal stores. The browser receives the whole replay series; only the drawing
        is limited to the cursor. The rules and the AI cannot see the future because of the data clock on the server.
      </Callout>
    </div>
  );
}
