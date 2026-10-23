"use client";
import { motion, type TargetAndTransition } from "motion/react";
import { useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { panelId, type ViewId } from "@/lib/views";

export type OrbitView = { id: ViewId; title: string; content: React.ReactNode };

const SPRING = { type: "spring", stiffness: 90, damping: 20, mass: 1 } as const;
const FADE = { duration: 0.25 } as const;

// Hydration-safe: the server snapshot is "no preference", then the client value applies after hydration.
function useReducedMotionPref(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

// Phones get a plain full-height panel: no 3D, springs or blur, which is what made them lag.
function useIsNarrow(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia("(max-width: 859px)");
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia("(max-width: 859px)").matches,
    () => false,
  );
}

function useStageWidth(ref: React.RefObject<HTMLElement | null>): number {
  return useSyncExternalStore(
    (notify) => {
      const el = ref.current;
      if (!el) return () => {};
      const ro = new ResizeObserver(notify);
      ro.observe(el);
      return () => ro.disconnect();
    },
    () => ref.current?.clientWidth ?? 1440,
    () => 1440,
  );
}

function ringOffset(i: number, active: number, n: number): number {
  let off = (((i - active) % n) + n) % n;
  if (off > n / 2) off -= n;
  return off;
}

function pose(off: number, side: number, reduced: boolean): TargetAndTransition {
  if (reduced) return { x: 0, z: 0, rotateY: 0, scale: 1, opacity: off === 0 ? 1 : 0 };
  if (off === 0) return { x: 0, z: 0, rotateY: 0, scale: 1, opacity: 1 };
  if (off === 1) return { x: side, z: -560, rotateY: -46, scale: 1, opacity: 0.55 };
  if (off === -1) return { x: -side, z: -560, rotateY: 46, scale: 1, opacity: 0.55 };
  return { x: 0, z: -1300, rotateY: 0, scale: 0.8, opacity: 0 };
}

export function Orbit({
  views,
  active,
  onSelect,
}: {
  views: OrbitView[];
  active: number;
  onSelect: (i: number) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const width = useStageWidth(stageRef);
  const reduced = useReducedMotionPref();
  const narrow = useIsNarrow();

  const panelW = Math.min(1000, width * 0.84);
  const side = Math.min(width * 0.66, 760);
  const n = views.length;

  if (narrow) {
    // Every view stays mounted (so typed text and results survive tab changes) but only the active one is displayed.
    return (
      <div ref={stageRef} className="relative flex min-h-0 flex-1 flex-col px-2 pb-2">
        {views.map((v, i) => {
          const isActive = i === active;
          return (
            <section
              key={v.id}
              id={panelId(v.id)}
              role="tabpanel"
              aria-label={v.title}
              hidden={!isActive}
              className={cn(
                "min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-panel-solid",
                isActive ? "flex motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150" : "hidden",
              )}
            >
              {v.content}
            </section>
          );
        })}
      </div>
    );
  }

  // Swipe navigation is handled centrally by `useSwipe` (window pointer listeners) in
  // orbit-app.tsx. This stage used to also bind its own touchstart/touchend handlers that
  // called `onSelect` directly — on real touch devices that fired a *second*, racing
  // navigation (history.replaceState) for the same gesture alongside the one from
  // `useSwipe`, which could hang Safari's history stack and make the page look frozen.
  // Only one source of truth for swipe now; this surface still allows native vertical
  // scrolling (touch-action: pan-y) so the swipe gesture keeps working.
  return (
    <div
      ref={stageRef}
      className="relative min-h-0 flex-1 touch-pan-y overflow-clip [perspective-origin:50%_40%] [perspective:2200px]"
    >
      <div className="absolute inset-0 [transform-style:preserve-3d]">
        {views.map((v, i) => {
          const off = ringOffset(i, active, n);
          const isActive = off === 0;
          const isSide = !reduced && Math.abs(off) === 1;
          return (
            <motion.section
              key={v.id}
              id={panelId(v.id)}
              role="tabpanel"
              aria-label={v.title}
              aria-hidden={!isActive}
              initial={false}
              animate={pose(off, side, reduced)}
              transition={reduced ? FADE : SPRING}
              style={{ width: panelW, marginLeft: -panelW / 2, zIndex: isActive ? 3 : isSide ? 2 : 0 }}
              className={cn(
                "glass-panel absolute top-2.5 bottom-4 left-1/2 flex flex-col overflow-hidden rounded-[28px] will-change-transform",
                isSide && "cursor-pointer saturate-[0.7] hover:saturate-100",
                !isActive && !isSide && "pointer-events-none",
              )}
            >
              <div inert={!isActive} className="flex min-h-0 flex-1 flex-col">
                {v.content}
              </div>
              {isSide && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  onClick={() => onSelect(i)}
                  className="absolute inset-0 z-10 cursor-pointer bg-transparent"
                  title={`Go to ${v.title}`}
                />
              )}
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}
