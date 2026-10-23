"use client";
import { Pause, Play } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CoachCard } from "@/components/coach-card";
import { OriginTag } from "@/components/origin-tag";
import { PanelBody, PanelHead } from "@/components/panel";
import { ProvenanceChip } from "@/components/provenance-chip";
import { ErrorNotice, Working } from "@/components/query-state";
import { ReplayChart } from "@/components/replay-chart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SIM_END, SIM_START, useAppState } from "@/lib/app-state";
import type { GuardEvent, ReplayMonth } from "@/lib/api";
import { longDate, monthLabel, usd } from "@/lib/display";
import { useReplay } from "@/lib/queries";
import { isTypingTarget } from "@/lib/shortcuts";
import { goToView } from "@/lib/views";

const REPLAY_SOURCE = "Replay engine";
const PLAY_MS = 1200;
const OURS = "Your plan";
const TECH = "Typical tech-heavy portfolio";
const NO_MONTHS: ReplayMonth[] = [];

const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);

function Calm({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="tile rounded-2xl p-4">
      <h3 className="mb-1.5 font-heading text-base font-semibold">{title}</h3>
      <p className="text-[0.95rem] text-muted-foreground">{children}</p>
    </div>
  );
}

export function ReplayView() {
  const { profile, plan, persona, clock, setClock, live, backTo2022 } = useAppState();
  const isActiveView = useSearchParams().get("view") === "replay";
  const [playing, setPlaying] = useState(false);

  const planOwner = !profile || persona === "custom" || profile.name.trim().toLowerCase() === "you" ? "Your" : `${profile.name}’s`;
  const replay = useReplay(plan && profile ? profile : null, plan?.portfolio.sim_date ?? SIM_START, SIM_START, SIM_END);
  const months = replay.data?.months ?? NO_MONTHS;
  const events = replay.data?.events;
  const last = months.length - 1;
  const cursor = Math.min(clock.cursor, Math.max(last, 0));

  const eventAt = useCallback(
    (i: number): GuardEvent | undefined => {
      const m = months[i];
      return m ? events?.find((e) => sameMonth(e.sim_date, m.date)) : undefined;
    },
    [months, events],
  );

  const moveTo = useCallback(
    (i: number) => {
      if (months.length === 0) return;
      const idx = Math.max(0, Math.min(i, months.length - 1));
      setClock({
        date: idx === 0 ? SIM_START : months[idx].date,
        cursor: idx,
        progress: months.length > 1 ? idx / (months.length - 1) : 0,
        reached: idx === 0 ? 0 : Math.max(clock.reached, idx),
      });
    },
    [months, clock.reached, setClock],
  );

  // Autoplay: one month per tick; pauses on a Guard event and at the end.
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      const next = cursor + 1;
      if (next > last) {
        setPlaying(false);
        return;
      }
      moveTo(next);
      if (next >= last || eventAt(next)) setPlaying(false);
    }, PLAY_MS);
    return () => clearTimeout(timer);
  }, [playing, cursor, last, moveTo, eventAt]);

  useEffect(() => {
    if (!isActiveView) return;
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || isTypingTarget(e.target)) return;
      if (e.key === "n") moveTo(cursor + 1);
      else if (e.key === "b") moveTo(cursor - 1);
      else if (e.key === "r") moveTo(0);
      else return;
      setPlaying(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActiveView, cursor, moveTo]);

  const visible = useMemo(() => months.slice(0, cursor + 1), [months, cursor]);
  // y-range from months shown so far: grows as the cursor advances, resets when it returns to the start.
  const extent = useMemo<[number, number]>(() => {
    const shown = months.slice(0, Math.max(clock.reached, cursor) + 1).flatMap((m) => [m.ours, m.tech_heavy]);
    return shown.length ? [Math.min(...shown), Math.max(...shown)] : [0, 1];
  }, [months, clock.reached, cursor]);

  const now = visible.at(-1);
  const event = eventAt(cursor);
  const techAhead = !!now && now.date.startsWith("2023") && now.tech_heavy > now.ours;

  let body: React.ReactNode;
  if (live.active) {
    body = (
      <div className="tile flex flex-col items-start gap-3 rounded-2xl p-6">
        <p>
          The time machine replays 2022–2023 against your plan, so it’s paused while you’re viewing live market
          data{live.latestDate ? ` (up to ${longDate(live.latestDate)})` : ""}.
        </p>
        <Button className="h-10 px-4 font-semibold" onClick={backTo2022}>
          Back to {longDate(SIM_START)}
        </Button>
      </div>
    );
  } else if (!profile || !plan) {
    body = (
      <div className="tile flex flex-col items-start gap-3 rounded-2xl p-6">
        <p>Build your plan first, then replay how it would have held up.</p>
        <Button className="h-10 px-4 font-semibold" onClick={() => goToView("profile")}>
          Go to your profile
        </Button>
      </div>
    );
  } else if (replay.isLoading || replay.isPending) {
    body = (
      <div className="flex flex-col gap-4">
        <Working label="Loading the time machine" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  } else if (replay.isError) {
    body = <ErrorNotice error={replay.error} onRetry={() => void replay.refetch()} />;
  } else if (months.length === 0 || !now) {
    body = <p className="text-muted-foreground">The backend returned no months to replay.</p>;
  } else {
    body = (
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="tile self-start rounded-2xl p-4 pb-3">
          <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">
            <span className="inline-flex items-center gap-2">
              <i aria-hidden className="inline-block h-[3px] w-[18px] rounded bg-plan" />
              {planOwner} plan
            </span>
            <span className="inline-flex items-center gap-2">
              <i aria-hidden className="inline-block h-[3px] w-[18px] rounded bg-compare" />
              {TECH}
            </span>
            <OriginTag kind="market" className="ml-auto" />
          </div>
          <ReplayChart visible={visible} extent={extent} windowStart={SIM_START} windowEnd={SIM_END} oursLabel={OURS} techLabel="Tech-heavy" />
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Button variant="outline" className="h-10 px-4 font-semibold" disabled={cursor === 0} onClick={() => { setPlaying(false); moveTo(cursor - 1); }}>
              Previous month
            </Button>
            <Button className="h-10 px-4 font-semibold" disabled={cursor >= last} onClick={() => { setPlaying(false); moveTo(cursor + 1); }}>
              Next month
            </Button>
            <Button variant="outline" className="h-10 px-4 font-semibold" disabled={cursor >= last} onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
              {playing ? "Pause" : "Play"}
            </Button>
            <Button variant="outline" className="h-10 px-4 font-semibold" disabled={cursor === 0} onClick={() => { setPlaying(false); moveTo(0); }}>
              Back to {longDate(SIM_START)}
            </Button>
            <span className="font-heading text-base font-semibold">{cursor === 0 ? longDate(SIM_START) : monthLabel(now.date)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="tile rounded-2xl p-3.5">
              <div className="text-sm font-semibold text-muted-foreground">{planOwner} plan</div>
              <div className="money font-heading text-[clamp(18px,1.8vw,24px)] font-semibold">{usd(now.ours)}</div>
            </div>
            <div className="tile rounded-2xl p-3.5">
              <div className="text-sm font-semibold text-muted-foreground">Tech-heavy</div>
              <div className="money font-heading text-[clamp(18px,1.8vw,24px)] font-semibold">{usd(now.tech_heavy)}</div>
            </div>
            <ProvenanceChip source={REPLAY_SOURCE} asOf={now.date} className="col-span-2 self-start" />
          </div>
          <div aria-live="polite">
            {event ? (
              <CoachCard key={event.sim_date} event={event} />
            ) : techAhead ? (
              <Calm title="Tech is now ahead of your plan">
                In 2023 tech recovered and your plan lagged. That’s expected: diversification isn’t about winning every year. It’s about not
                losing your job and your savings at the same time.
              </Calm>
            ) : cursor === 0 ? (
              <Calm title="Ready to replay">
                Press “Next month” to move the simulation forward. The coach steps in if markets fall sharply.
              </Calm>
            ) : (
              <Calm title="Nothing to flag this month">The coach only speaks up when something needs your attention.</Calm>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PanelHead
        title="Replaying 2022, one month at a time"
        subtitle="The chart only shows data up to the simulation date. The future stays hidden, for you and for the AI."
      />
      <PanelBody>{body}</PanelBody>
    </>
  );
}
