"use client";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import type { ReplayMonth } from "@/lib/api";
import { longDate, monthLabel, usd, usdCompact } from "@/lib/display";

const RIGHT = 14;
const TOP = 12;
const BOTTOM = 34;

// Chart units = CSS pixels: the SVG is sized to its container, so text keeps a readable size on phones too.
function useBoxWidth(ref: React.RefObject<HTMLElement | null>): number {
  return useSyncExternalStore(
    (notify) => {
      const el = ref.current;
      if (!el) return () => {};
      const ro = new ResizeObserver(notify);
      ro.observe(el);
      return () => ro.disconnect();
    },
    () => ref.current?.clientWidth ?? 560,
    () => 560,
  );
}

const toTime = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

// The chart only ever receives visible months. `extent` is the y-range of months shown so far (it can grow, never shrink).
// `windowStart`/`windowEnd` are the dates we asked the backend for: dates, not values, so the x-axis can be fixed up front.
export function ReplayChart({
  visible,
  extent,
  windowStart,
  windowEnd,
  oursLabel,
  techLabel,
}: {
  visible: ReplayMonth[];
  extent: [number, number];
  windowStart: string;
  windowEnd: string;
  oursLabel: string;
  techLabel: string;
}) {
  const hatchId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxW = useBoxWidth(wrapRef);
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(280, Math.min(boxW, 760));
  const H = Math.round(Math.max(220, Math.min(W * 0.62, 380)));
  const L = W < 480 ? 60 : 72;

  const t0 = toTime(windowStart);
  const t1 = toTime(windowEnd);
  const x = (iso: string) => L + ((toTime(iso) - t0) / (t1 - t0)) * (W - L - RIGHT);

  const span = Math.max(extent[1] - extent[0], Math.abs(extent[1]) * 0.02);
  const lo = extent[0] - span * 0.1;
  const hi = extent[1] + span * 0.1;
  const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * (H - TOP - BOTTOM);

  // "Jan 2022" -> "Jan ’22" on phones, so neighbouring labels don't touch.
  const dateTick = (iso: string) => (W < 480 ? monthLabel(iso).replace(/ 20(\d\d)$/, " ’$1") : monthLabel(iso));
  const yTicks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3);
  // A narrow range (the start of the replay) needs full dollars, or every tick reads "$100k".
  const tickLabel = (v: number) => (hi - lo < 6000 ? usd(Math.round(v / 100) * 100) : usdCompact(v));
  const xTicks: string[] = [];
  for (let d = new Date(t0); d.getTime() <= t1; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 6, 1))) {
    xTicks.push(d.toISOString().slice(0, 10));
  }

  const last = visible.at(-1);
  const frontier = last ? x(last.date) : L;
  const path = (key: "ours" | "tech_heavy") =>
    visible.map((m, i) => `${i === 0 ? "M" : "L"}${x(m.date).toFixed(1)} ${y(m[key]).toFixed(1)}`).join(" ");

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = -1;
    let bestD = Infinity;
    visible.forEach((m, i) => {
      const d = Math.abs(x(m.date) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best === -1 ? null : best);
  }

  const hovered = hover !== null ? visible[hover] : undefined;
  const summary = last
    ? `Line chart of portfolio value from ${longDate(windowStart)}. Latest shown, ${monthLabel(last.date)}: ${oursLabel} ${usd(last.ours)}, ${techLabel} ${usd(last.tech_heavy)}. Later months are not shown yet.`
    : "Line chart with no months shown yet.";

  return (
    <div ref={wrapRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={summary}
        className="block h-auto w-full touch-pan-y"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <pattern id={hatchId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--border)" strokeWidth="2" />
          </pattern>
        </defs>

        {yTicks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - RIGHT} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="14" fill="var(--muted-foreground)" className="money">
              {tickLabel(v)}
            </text>
          </g>
        ))}
        {xTicks.map((d) => (
          <text key={d} x={x(d)} y={H - 8} textAnchor="middle" fontSize="14" fill="var(--muted-foreground)">
            {dateTick(d)}
          </text>
        ))}

        <rect x={frontier + 6} y={TOP} width={Math.max(W - RIGHT - frontier - 6, 0)} height={H - TOP - BOTTOM} fill={`url(#${hatchId})`} opacity="0.7" />
        <text x={(frontier + 6 + W - RIGHT) / 2} y={TOP + 24} textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--muted-foreground)">
          Not visible yet
        </text>

        <path d={path("tech_heavy")} fill="none" stroke="var(--compare)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={path("ours")} fill="none" stroke="var(--plan)" strokeWidth="3" strokeLinejoin="round" />
        {last && (
          <>
            <circle cx={x(last.date)} cy={y(last.tech_heavy)} r="4.5" fill="var(--compare)" />
            <circle cx={x(last.date)} cy={y(last.ours)} r="5" fill="var(--plan)" />
          </>
        )}

        {hovered && (
          <g pointerEvents="none">
            <line x1={x(hovered.date)} x2={x(hovered.date)} y1={TOP} y2={H - BOTTOM} stroke="var(--muted-foreground)" strokeDasharray="2 3" />
            <g transform={`translate(${Math.min(Math.max(x(hovered.date) - 100, L), W - RIGHT - 200)} ${TOP + 40})`}>
              <rect width="200" height="72" rx="10" fill="var(--popover)" stroke="var(--border)" />
              <text x="10" y="22" fontSize="15" fontWeight="700" fill="var(--foreground)">{monthLabel(hovered.date)}</text>
              <text x="10" y="44" fontSize="15" fill="var(--plan)" className="money">{oursLabel}: {usd(hovered.ours)}</text>
              <text x="10" y="64" fontSize="15" fill="var(--muted-foreground)" className="money">{techLabel}: {usd(hovered.tech_heavy)}</text>
            </g>
          </g>
        )}
      </svg>
      <table className="sr-only">
        <caption>Portfolio value by month, up to the simulation date</caption>
        <thead>
          <tr><th>Month</th><th>{oursLabel}</th><th>{techLabel}</th></tr>
        </thead>
        <tbody>
          {visible.map((m) => (
            <tr key={m.date}><td>{monthLabel(m.date)}</td><td>{usd(m.ours)}</td><td>{usd(m.tech_heavy)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
