"use client";
import { AlertTriangle, Check } from "lucide-react";
import { useState } from "react";
import { PanelBody, PanelHead } from "@/components/panel";
import { ErrorNotice, Working } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INITIAL_CLOCK, SIM_START, useAppState } from "@/lib/app-state";
import type { Profile, Risk } from "@/lib/api";
import { usd } from "@/lib/display";
import { seedPersonaParse } from "@/lib/demo-prep";
import { PERSONAS, personaById, type PersonaId } from "@/lib/personas";
import { useBuildPortfolio, useParseProfile } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { goToView } from "@/lib/views";

const RISKS: Risk[] = ["low", "medium", "high"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls = "h-10 bg-panel-solid text-base";

function NumberInput({ id, value, onChange, min = 0 }: { id: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <Input
      id={id}
      type="number"
      min={min}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => {
        const n = e.target.valueAsNumber;
        if (Number.isFinite(n)) onChange(n);
      }}
      className={cn(inputCls, "money")}
    />
  );
}

function ReviewCard({
  draft,
  contradictions,
  onChange,
}: {
  draft: Profile;
  contradictions: string[];
  onChange: (p: Profile) => void;
}) {
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => onChange({ ...draft, [key]: value });
  const goal = draft.goals[0];
  const setGoal = (patch: Partial<Profile["goals"][number]>) =>
    onChange({ ...draft, goals: draft.goals.map((g, i) => (i === 0 ? { ...g, ...patch } : g)) });

  return (
    <section aria-labelledby="review-title" className="tile flex flex-col gap-4 rounded-2xl p-5">
      <div>
        <h3 id="review-title" className="font-heading text-lg font-semibold">Here’s what we understood</h3>
        <p className="text-sm text-muted-foreground">Check it over. Anything wrong? Fix it before we build your plan.</p>
      </div>

      {contradictions.length > 0 && (
        <div role="note" className="flex items-start gap-3.5 rounded-2xl border border-warn-line bg-warn-bg p-4">
          <AlertTriangle aria-hidden className="mt-0.5 size-[22px] flex-none text-warn" />
          <div>
            <strong className="block">Your answers don’t quite match</strong>
            <ul className="text-[0.95rem]">
              {contradictions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Age" htmlFor="p-age">
          <NumberInput id="p-age" value={draft.age} onChange={(n) => set("age", n)} min={18} />
        </Field>
        <Field label="Industry" htmlFor="p-industry">
          <Input id="p-industry" value={draft.industry} onChange={(e) => set("industry", e.target.value)} className={inputCls} />
        </Field>
        <div className="col-span-2">
          <Field label="Job title" htmlFor="p-job">
            <Input id="p-job" value={draft.job_title} onChange={(e) => set("job_title", e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="col-span-2">
          <span id="risk-label" className="text-sm font-semibold text-muted-foreground">Risk you’re comfortable with</span>
          <div role="group" aria-labelledby="risk-label" className="mt-1.5 flex gap-1.5">
            {RISKS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={draft.risk_tolerance === r}
                onClick={() => set("risk_tolerance", r)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold",
                  draft.risk_tolerance === r
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-panel-solid hover:bg-tile-hover",
                )}
              >
                {cap(r)}
              </button>
            ))}
          </div>
        </div>
        <Field label="Emergency savings (months)" htmlFor="p-emergency">
          <NumberInput id="p-emergency" value={draft.emergency_fund_months} onChange={(n) => set("emergency_fund_months", n)} />
        </Field>
        <Field label="Past behaviour" htmlFor="p-past">
          <Input id="p-past" value={draft.past_behaviour} onChange={(e) => set("past_behaviour", e.target.value)} className={inputCls} />
        </Field>
        {goal && (
          <>
            <div className="col-span-2">
              <Field label="Main goal" htmlFor="p-goal">
                <Input id="p-goal" value={goal.name} onChange={(e) => setGoal({ name: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <Field label="Goal amount ($)" htmlFor="p-goal-amt">
              <NumberInput id="p-goal-amt" value={goal.amount_usd} onChange={(n) => setGoal({ amount_usd: n })} />
            </Field>
            <Field label="Years away" htmlFor="p-goal-yrs">
              <NumberInput id="p-goal-yrs" value={goal.years_away} onChange={(n) => setGoal({ years_away: n })} />
            </Field>
          </>
        )}
      </div>

      <div>
        <span className="text-sm font-semibold text-muted-foreground">What you already hold</span>
        {draft.holdings.length === 0 ? (
          <p className="mt-1 text-[0.95rem]">Nothing yet.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1.5">
            {draft.holdings.map((h, i) => (
              <li key={`${h.ticker}-${i}`} className="flex items-center justify-between gap-3 text-[0.95rem]">
                <span>
                  <strong>{h.ticker}</strong>
                  {h.is_employer_stock && <span className="ml-2 text-xs text-muted-foreground">your employer’s shares</span>}
                </span>
                <span className="w-32">
                  <label className="sr-only" htmlFor={`p-hold-${i}`}>{h.ticker} amount in dollars</label>
                  <NumberInput
                    id={`p-hold-${i}`}
                    value={h.amount_usd}
                    onChange={(n) =>
                      onChange({ ...draft, holdings: draft.holdings.map((x, j) => (j === i ? { ...x, amount_usd: n } : x)) })
                    }
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function ProfileView() {
  const { persona, setPersona, parsed, setParsed, setProfile, setPlan, setClock } = useAppState();
  const [custom, setCustom] = useState<{ persona: PersonaId; text: string } | null>(null);
  const [edits, setEdits] = useState<Profile | null>(null);
  const parse = useParseProfile();
  const build = useBuildPortfolio();

  const text = custom?.persona === persona ? custom.text : personaById(persona).text;
  const draft = edits ?? parsed?.profile ?? null;
  const contradictions = parsed ? (parsed.contradictions.length ? parsed.contradictions : parsed.profile.contradictions) : [];

  function pickPersona(id: PersonaId) {
    setPersona(id);
    setCustom(null);
    setEdits(null);
    setParsed(null);
    parse.reset();
    build.reset();
  }

  function read() {
    setEdits(null);
    build.reset();
    const untouchedPreset = custom?.persona !== persona;
    parse.mutate(text, {
      onSuccess: (res) => {
        setParsed(res);
        if (untouchedPreset) seedPersonaParse(persona, res);
      },
    });
  }

  function buildPlan() {
    if (!draft) return;
    build.mutate(
      { profile: draft, simDate: SIM_START },
      {
        onSuccess: (res) => {
          setProfile(draft);
          setPlan(res);
          setClock(INITIAL_CLOCK);
          goToView("portfolio");
        },
      },
    );
  }

  return (
    <>
      <PanelHead
        title="Tell us about your life"
        subtitle="Your job matters as much as your risk appetite. We use it to keep your savings from betting on the same thing as your paycheck."
      />
      <PanelBody>
        <div role="group" aria-label="Demo people" className="mb-4 flex flex-wrap gap-2">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={persona === p.id}
              onClick={() => pickPersona(p.id)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold",
                persona === p.id ? "border-primary bg-ion-soft" : "tile hover:bg-tile-hover",
              )}
            >
              {p.chip}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col gap-3">
            <Field label="Describe yourself in your own words" htmlFor="about">
              <Textarea
                id="about"
                rows={9}
                value={text}
                onChange={(e) => setCustom({ persona, text: e.target.value })}
                className="bg-panel-solid text-base leading-relaxed"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                variant={draft ? "outline" : "default"}
                className="h-11 px-5 text-base font-bold"
                onClick={read}
                disabled={parse.isPending || !text.trim()}
              >
                {draft ? "Read it again" : "Read my answers"}
              </Button>
              {parse.isPending && <Working label="Reading your answers" />}
              {draft && !parse.isPending && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-plan">
                  <Check aria-hidden className="size-4" /> Understood
                </span>
              )}
            </div>
            {parse.isError && <ErrorNotice error={parse.error} onRetry={read} />}
            {draft && (
              <div className="mt-2 flex flex-col gap-3 border-t pt-4">
                <Button size="lg" className="h-12 self-start px-6 text-base font-bold" onClick={buildPlan} disabled={build.isPending}>
                  Build my {usd(100000)} plan
                </Button>
                {build.isPending && <Working label="Mapping your job’s exposure, then checking every number against its source" />}
                {build.isError && <ErrorNotice error={build.error} onRetry={buildPlan} />}
              </div>
            )}
          </div>

          {draft ? (
            <ReviewCard
              draft={draft}
              contradictions={contradictions}
              onChange={setEdits}
            />
          ) : (
            <div className="tile flex items-center justify-center rounded-2xl p-8 text-center text-muted-foreground">
              We’ll show what we understood here, so you can correct anything before we build your plan.
            </div>
          )}
        </div>
      </PanelBody>
    </>
  );
}
