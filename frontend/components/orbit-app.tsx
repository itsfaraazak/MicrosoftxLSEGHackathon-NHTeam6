"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { Dock } from "@/components/dock";
import { Orbit, type OrbitView } from "@/components/orbit";
import { AskView } from "@/components/views/ask-view";
import { PortfolioView } from "@/components/views/portfolio-view";
import { ProofView } from "@/components/views/proof-view";
import { ProfileView } from "@/components/views/profile-view";
import { ReplayView } from "@/components/views/replay-view";
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

export function OrbitApp() {
  const searchParams = useSearchParams();
  const active = viewIndex(searchParams.get("view"));

  // Native history updates are picked up by useSearchParams without a server round trip.
  const select = useCallback((i: number) => {
    const n = VIEWS.length;
    const next = VIEWS[((i % n) + n) % n].id;
    goToView(next);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === "ArrowRight") select(active + 1);
      else if (e.key === "ArrowLeft") select(active - 1);
      else if (/^[1-5]$/.test(e.key)) select(Number(e.key) - 1);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, select]);

  return (
    <>
      <Orbit views={ORBIT_VIEWS} active={active} onSelect={select} />
      <Dock active={active} onSelect={select} />
    </>
  );
}
