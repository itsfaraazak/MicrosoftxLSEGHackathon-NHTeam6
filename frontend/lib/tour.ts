// Guided-tour step definitions. Pure data + small helpers — no React here, no network calls.
// The tour is a thin layer over the existing 5 views (lib/views.ts): most tour steps map 1:1 to a
// view, except step 3 ("Why") which stays on the Portfolio view but asks the user to open a holding.
import type { ViewId } from "@/lib/views";

export type TourStepId = "you" | "mix" | "why" | "time" | "proof" | "ask";

export type TourStep = {
  index: number; // 0-based
  id: TourStepId;
  label: string; // short stepper label, e.g. "1 You"
  view: ViewId;
  banner: string; // plain-English "what to do here"
  judgeNote: string; // "what judges should notice"
};

export const TOUR_STEPS: TourStep[] = [
  {
    index: 0,
    id: "you",
    label: "1 You",
    view: "profile",
    banner: "Pick a persona below (or write your own answers), then press “Read my answers” and “Build my $100,000 plan”.",
    judgeNote: "Notice: the questionnaire asks about the job, not just risk appetite — that's the novelty.",
  },
  {
    index: 1,
    id: "mix",
    label: "2 Your mix",
    view: "portfolio",
    banner: "This is the $100,000 plan the rules engine built. Check the buckets and the donut.",
    judgeNote: "Notice: the mix avoids the client's own industry — code decided this, not a guess.",
  },
  {
    index: 2,
    id: "why",
    label: "3 Why",
    view: "portfolio",
    banner: "Tap any holding in the list (or the donut) to see the sourced facts behind it, then open “How this was decided”.",
    judgeNote: "Notice: every number traces to a dated source — nothing is invented.",
  },
  {
    index: 3,
    id: "time",
    label: "4 Time machine",
    view: "replay",
    banner: "Press Play from 3 Jan 2022 and watch for the coach card at the mid-2022 drop.",
    judgeNote: "Notice: the coach explains the drop and the cost of selling instead of just reacting to it.",
  },
  {
    index: 4,
    id: "proof",
    label: "5 Proof",
    view: "proof",
    banner: "These claims are tested on real past prices by code you can read and re-run — scroll to “Show me the code”.",
    judgeNote: "Notice: a claim that fails the test is shown as failed, not hidden.",
  },
  {
    index: 5,
    id: "ask",
    label: "6 Ask",
    view: "ask",
    banner: "Ask a question, including a leak test like “What happens to tech stocks in 2022?” — the answer should not use future data.",
    judgeNote: "Notice: the data clock and the honest 2023 lag — the tool doesn't pretend to beat the market.",
  },
];

export function tourStep(index: number): TourStep {
  const n = TOUR_STEPS.length;
  return TOUR_STEPS[((index % n) + n) % n];
}

export function tourStepIndexForView(view: ViewId): number {
  const i = TOUR_STEPS.findIndex((s) => s.view === view);
  return i === -1 ? 0 : i;
}

export const TOUR_SESSION_KEY = "tour"; // sessionStorage (via lib/session-store) value: "0" | "1"
export const TOUR_LOCAL_KEY = "ddd:tour-pref"; // localStorage, remembers the choice across sessions
