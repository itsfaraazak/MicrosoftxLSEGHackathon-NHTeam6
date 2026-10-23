"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DemoPrep } from "@/components/demo-prep";
import { Dock } from "@/components/dock";
import { GuidedTourBar } from "@/components/guided-tour";
import { Orbit, type OrbitView } from "@/components/orbit";
import { AskView } from "@/components/views/ask-view";
import { PortfolioView } from "@/components/views/portfolio-view";
import { ProofView } from "@/components/views/proof-view";
import { ProfileView } from "@/components/views/profile-view";
import { ReplayView } from "@/components/views/replay-view";
import { useAppState } from "@/lib/app-state";
import { isPersonaId } from "@/lib/personas";
import { useSessionValue, writeSession } from "@/lib/session-store";
import { isTypingTarget } from "@/lib/shortcuts";
import { TOUR_STEPS } from "@/lib/tour";
import { useSwipe } from "@/lib/use-swipe";
import { goToView, VIEWS, viewIndex, type ViewId } from "@/lib/views";

const CONTENT: Record<ViewId, React.ReactNode> = {
  profile: <ProfileView />,
  portfolio: <PortfolioView />,
  replay: <ReplayView />,
  ask: <AskView />,
  proof: <ProofView />,
};

const ORBIT_VIEWS: OrbitView[] = VIEWS.map((v) => ({ id: v.id, title: v.title, content: CONTENT[v.id] }));

// Guided tour is the default landing experience; `?tour=0` disables it and the choice is
// remembered for the session. Free-explore mode (existing dock + views) is unchanged either way.
function readInitialTourStep(stepParam: string | null): number {
  const n = stepParam ? Number(stepParam) - 1 : NaN;
  return Number.isFinite(n) && n >= 0 && n < TOUR_STEPS.length ? n : 0;
}

export function OrbitApp() {
  const searchParams = useSearchParams();
  const active = viewIndex(searchParams.get("view"));
  const tourParam = searchParams.get("tour");
  const stepParam = searchParams.get("step");
  const personaParam = searchParams.get("persona");
  const storedTourPref = useSessionValue("tour");
  const tourEnabled = tourParam === "0" ? false : tourParam === "1" ? true : storedTourPref !== "0";
  const [tourStepIndex, setTourStepIndex] = useState(() => readInitialTourStep(stepParam));
  const mountedRef = useRef(false);
  const { setPersona, resetDemo, epoch } = useAppState();

  // Native history updates are picked up by useSearchParams without a server round trip.
  const select = useCallback((i: number) => {
    const n = VIEWS.length;
    const next = VIEWS[((i % n) + n) % n].id;
    goToView(next);
  }, []);

  const advanceStep = useCallback(
    (dir: 1 | -1) => {
      if (tourEnabled) {
        setTourStepIndex((prev) => {
          const n = TOUR_STEPS.length;
          const next = ((prev + dir) % n + n) % n;
          select(viewIndex(TOUR_STEPS[next].view));
          return next;
        });
      } else {
        select(active + dir);
      }
    },
    [tourEnabled, active, select],
  );

  // Remember an explicit ?tour= choice for the rest of the session.
  useEffect(() => {
    if (tourParam === "0" || tourParam === "1") writeSession("tour", tourParam);
  }, [tourParam]);

  // ?persona=priya|tom|fiona lets a headless screenshot (or a shared link) land pre-selected.
  useEffect(() => {
    if (personaParam && isPersonaId(personaParam)) setPersona(personaParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per persona param, not on every setPersona identity change
  }, [personaParam]);

  // On mount, push the view to match the (possibly ?step=-specified) initial tour step. After
  // that, keep the tour step in sync whenever the active view changes for some other reason
  // (dock click, "Build my plan", etc.) — but only when the view actually left the current
  // step's view, so opening a holding/drawer inside the same view never resets the step.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      select(viewIndex(TOUR_STEPS[tourStepIndex].view));
      return;
    }
    setTourStepIndex((prev) => {
      const curView = TOUR_STEPS[prev].view;
      const newViewId = VIEWS[active].id;
      return newViewId === curView ? prev : TOUR_STEPS.findIndex((s) => s.view === newViewId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only re-runs on active
  }, [active]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === "R" && e.shiftKey) {
        resetDemo();
        goToView("profile");
      } else if (e.key === "ArrowRight") advanceStep(1);
      else if (e.key === "ArrowLeft") advanceStep(-1);
      else if (/^[1-5]$/.test(e.key)) select(Number(e.key) - 1);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select, advanceStep, resetDemo]);

  // Swipe left = next, swipe right = previous — same step/view navigation as the arrow keys.
  useSwipe({ onSwipeLeft: () => advanceStep(1), onSwipeRight: () => advanceStep(-1) });

  const toggleTour = useCallback(() => writeSession("tour", tourEnabled ? "0" : "1"), [tourEnabled]);

  return (
    <>
      <DemoPrep />
      {tourEnabled && (
        <div className="px-2 pt-2 md:px-4">
          <GuidedTourBar
            stepIndex={Math.min(tourStepIndex, TOUR_STEPS.length - 1)}
            onStepChange={(i) => {
              setTourStepIndex(i);
              select(viewIndex(TOUR_STEPS[i].view));
            }}
            onExploreFree={toggleTour}
          />
        </div>
      )}
      <Orbit key={epoch} views={ORBIT_VIEWS} active={active} onSelect={select} />
      <Dock active={active} onSelect={select} tourEnabled={tourEnabled} onToggleTour={toggleTour} />
    </>
  );
}
