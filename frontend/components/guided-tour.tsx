"use client";
import { Check, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { RigorButton } from "@/components/rigor-drawer";
import { INITIAL_CLOCK, SIM_START, useAppState } from "@/lib/app-state";
import { personaById, PERSONAS, type PersonaId } from "@/lib/personas";
import { useBuildPortfolio, useParseProfile } from "@/lib/queries";
import { TOUR_STEPS, tourStep } from "@/lib/tour";
import { cn } from "@/lib/utils";

// Central guided-tour stepper. Sits above the existing Orbit/Dock shell; never replaces it.
// Advancing a tour step just calls `onStepChange`, which the shell maps to the matching view
// via lib/tour's `view` field — the teammate's views are untouched and still work standalone.

function StarterButton({
  label,
  sub,
  onClick,
  pending,
}: {
  label: string;
  sub: string;
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="tile flex min-h-11 flex-col items-start gap-0.5 rounded-xl px-3.5 py-2.5 text-left hover:bg-tile-hover disabled:opacity-60"
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </button>
  );
}

function PersonaStarters({ onStarted }: { onStarted: () => void }) {
  const { setPersona, setParsed, setProfile, setPlan, setClock } = useAppState();
  const parse = useParseProfile();
  const build = useBuildPortfolio();
  const [startedId, setStartedId] = useState<PersonaId | "custom" | null>(null);
  const pending = parse.isPending || build.isPending;

  function startPersona(id: PersonaId) {
    setStartedId(id);
    setPersona(id);
    setParsed(null);
    const text = personaById(id).text;
    parse.mutate(text, {
      onSuccess: (res) => {
        setParsed(res);
        build.mutate(
          { profile: res.profile, simDate: SIM_START },
          {
            onSuccess: (planRes) => {
              setProfile(res.profile);
              setPlan(planRes);
              setClock(INITIAL_CLOCK);
              onStarted();
            },
          },
        );
      },
    });
  }

  function startCustom() {
    setStartedId("custom");
    setPersona("priya");
    setParsed(null);
    setProfile(null);
    setPlan(null);
    onStarted();
  }

  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {PERSONAS.map((p) => (
        <StarterButton
          key={p.id}
          label={`Try ${p.name} (${p.job.toLowerCase()})`}
          sub={startedId === p.id && pending ? "Reading answers and building the plan…" : "One tap: fills the answers and builds the $100,000 plan."}
          onClick={() => startPersona(p.id)}
          pending={pending}
        />
      ))}
      <StarterButton
        label="Write your own"
        sub="Clears the demo text so you can type your own answers below."
        onClick={startCustom}
        pending={pending}
      />
    </div>
  );
}

function CompletionCard({ onRestart, onExploreFree }: { onRestart: () => void; onExploreFree: () => void }) {
  return (
    <div className="tile mt-3 flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden className="size-5 text-primary" />
        <h3 className="font-heading text-base font-semibold">What you just saw</h3>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        <li className="flex items-start gap-2">
          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-plan" />
          <span><strong>Code decided</strong> the allocation — fixed rules, not a guess, and your employer&rsquo;s own sector is never over-weighted.</span>
        </li>
        <li className="flex items-start gap-2">
          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-plan" />
          <span><strong>AI explained</strong> the choice in plain English and mapped your job to the sectors it overlaps with.</span>
        </li>
        <li className="flex items-start gap-2">
          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-plan" />
          <span><strong>Everything was checked</strong> — every number traces to a dated source, nothing after the simulation date is visible, and claims are tested on real past prices.</span>
        </li>
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onRestart}
          className="glass min-h-11 rounded-full px-4 text-sm font-semibold hover:bg-tile-hover"
        >
          Restart tour
        </button>
        <button
          type="button"
          onClick={onExploreFree}
          className="min-h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Keep exploring freely
        </button>
      </div>
    </div>
  );
}

export function GuidedTourBar({
  stepIndex,
  onStepChange,
  onExploreFree,
}: {
  stepIndex: number;
  onStepChange: (index: number) => void;
  onExploreFree: () => void;
}) {
  const [completed, setCompleted] = useState(false);
  const step = tourStep(stepIndex);
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  function goNext() {
    if (isLast) {
      setCompleted(true);
      return;
    }
    setCompleted(false);
    onStepChange(stepIndex + 1);
  }
  function goBack() {
    setCompleted(false);
    onStepChange(Math.max(0, stepIndex - 1));
  }
  function jump(i: number) {
    setCompleted(false);
    onStepChange(i);
  }
  function restart() {
    setCompleted(false);
    onStepChange(0);
  }

  return (
    <div className="glass mx-auto flex w-full max-w-[920px] flex-col gap-2 rounded-2xl px-3 py-2.5 md:px-5 md:py-3" data-tour-bar>
      <div className="flex items-center justify-between gap-2">
        <ol className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Guided tour steps">
          {TOUR_STEPS.map((s, i) => (
            <li key={s.id} className="flex items-center">
              <button
                type="button"
                onClick={() => jump(i)}
                aria-current={i === stepIndex ? "step" : undefined}
                className="flex min-h-11 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap text-muted-foreground hover:text-foreground md:text-sm"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2 rounded-full",
                    i === stepIndex ? "bg-primary" : i < stepIndex ? "bg-plan" : "bg-border",
                  )}
                />
                {s.label}
              </button>
              {i < TOUR_STEPS.length - 1 && <span aria-hidden className="mx-0.5 text-border">{"•"}</span>}
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onExploreFree}
          className="hidden min-h-11 shrink-0 rounded-full border px-3 text-xs font-semibold text-muted-foreground hover:bg-tile-hover md:inline-flex md:items-center"
        >
          Explore freely
        </button>
      </div>

      {!completed ? (
        <>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[0.95rem] font-medium">{step.banner}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{"👁 "}For judges: {step.judgeNote}</p>
            </div>
            <RigorButton stepId={step.view} className="shrink-0 self-start" />
          </div>
          {stepIndex === 0 && <PersonaStarters onStarted={goNext} />}
          <div className="mt-1 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className="glass inline-flex min-h-11 items-center gap-1 rounded-full px-3.5 text-sm font-semibold disabled:opacity-40"
            >
              <ChevronLeft aria-hidden className="size-4" /> Back
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              {isLast ? "Finish" : "Next"} <ChevronRight aria-hidden className="size-4" />
            </button>
          </div>
        </>
      ) : (
        <CompletionCard onRestart={restart} onExploreFree={onExploreFree} />
      )}
    </div>
  );
}
