"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { DemoPrep } from "@/components/demo-prep";
import { Dock } from "@/components/dock";
import { Orbit, type OrbitView } from "@/components/orbit";
import { TopBar } from "@/components/top-bar";
import { AskView } from "@/components/views/ask-view";
import { PortfolioView } from "@/components/views/portfolio-view";
import { ProofView } from "@/components/views/proof-view";
import { ProfileView } from "@/components/views/profile-view";
import { ReplayView } from "@/components/views/replay-view";
import { useAppState } from "@/lib/app-state";
import { isPersonaId } from "@/lib/personas";
import { isTypingTarget } from "@/lib/shortcuts";
import { goToView, VIEWS, viewIndex, type ViewId } from "@/lib/views";

const CONTENT: Record<ViewId, React.ReactNode> = {
  profile: <ProfileView />,
  portfolio: <PortfolioView />,
  replay: <ReplayView />,
  ask: <AskView />,
  proof: <ProofView />,
};

const ORBIT_VIEWS: OrbitView[] = VIEWS.map((v) => ({ id: v.id, title: v.title, content: CONTENT[v.id] }));

// The whole app shell: top bar, the views, and the dock. Lives here (not in app/page.tsx) because it needs the active view.
export function OrbitApp() {
  const searchParams = useSearchParams();
  const active = viewIndex(searchParams.get("view"));
  const personaParam = searchParams.get("persona");
  const { setPersona, resetDemo, epoch } = useAppState();

  // Native history updates are picked up by useSearchParams without a server round trip.
  const select = useCallback((i: number) => {
    const n = VIEWS.length;
    goToView(VIEWS[((i % n) + n) % n].id);
  }, []);

  // ?persona=priya|tom|fiona|custom lets a headless screenshot (or a shared link) land pre-selected.
  useEffect(() => {
    if (personaParam && isPersonaId(personaParam)) setPersona(personaParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per persona param, not on every setPersona identity change
  }, [personaParam]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === "R" && e.shiftKey) {
        resetDemo();
        goToView("profile");
      } else if (e.key === "ArrowRight") select(active + 1);
      else if (e.key === "ArrowLeft") select(active - 1);
      else if (/^[1-5]$/.test(e.key)) select(Number(e.key) - 1);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select, active, resetDemo]);

  return (
    <>
      <DemoPrep />
      <TopBar stepId={VIEWS[active].id} />
      <main className="relative flex min-h-0 flex-1 flex-col">
        <Orbit key={epoch} views={ORBIT_VIEWS} active={active} onSelect={select} />
      </main>
      <Dock active={active} onSelect={select} />
    </>
  );
}
