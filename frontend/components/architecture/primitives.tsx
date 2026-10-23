import { ArrowDown, ArrowRight } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

// Colour = whose data / who acts. The same key is used on every diagram so it never needs re-learning.
export type Tone = "you" | "server" | "ai" | "data" | "example" | "azure";

export const TONES: Record<Tone, { color: string; label: string }> = {
  you: { color: "var(--primary)", label: "You and your device" },
  server: { color: "var(--plan)", label: "SPARK server (rules in code)" },
  ai: { color: "var(--chart-4)", label: "The AI model" },
  data: { color: "var(--chart-3)", label: "Public market data" },
  example: { color: "var(--compare)", label: "Example / demo data" },
  azure: { color: "var(--chart-5)", label: "Microsoft / Azure" },
};

export function Legend({ tones }: { tones: Tone[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Colour key">
      {tones.map((t) => (
        <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
          <span aria-hidden className="size-3 rounded-sm" style={{ background: TONES[t].color }} />
          {TONES[t].label}
        </li>
      ))}
    </ul>
  );
}

export function Node({
  tone,
  title,
  children,
  className,
  tag,
}: {
  tone: Tone;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  tag?: string;
}) {
  return (
    <div className={cn("tile flex flex-col gap-1 rounded-2xl border-l-4 p-3.5", className)} style={{ borderLeftColor: TONES[tone].color }}>
      {tag && (
        <span className="text-sm font-bold tracking-wide uppercase" style={{ color: TONES[tone].color }}>
          {tag}
        </span>
      )}
      <h4 className="text-base leading-snug font-bold">{title}</h4>
      {children && <div className="text-[15px] leading-snug text-muted-foreground">{children}</div>}
    </div>
  );
}

// An arrow that points down on phones and right on desktop, with an optional label on what travels.
export function Connector({ label, top }: { label?: string; top?: boolean }) {
  return (
    <div className={cn("flex flex-none flex-row items-center justify-center gap-2 py-0.5 text-muted-foreground md:flex-col md:px-1", top && "md:justify-start md:pt-28")} aria-hidden>
      <ArrowDown className="size-5 md:hidden" />
      <ArrowRight className="hidden size-5 md:block" />
      {label && <span className="max-w-[9rem] text-center text-sm leading-tight">{label}</span>}
    </div>
  );
}

export function Chain({ items }: { items: { node: React.ReactNode; arrow?: string }[] }) {
  return (
    <div className="flex flex-col md:flex-row md:items-stretch">
      {items.map((it, i) => (
        <Fragment key={i}>
          <div className="flex-1">{it.node}</div>
          {i < items.length - 1 && <Connector label={it.arrow} />}
        </Fragment>
      ))}
    </div>
  );
}

export function Group({ tone, title, subtitle, children }: { tone: Tone; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-1 flex-col gap-2.5 rounded-3xl border-2 border-dashed p-3" style={{ borderColor: TONES[tone].color }}>
      <header>
        <h3 className="text-lg font-bold" style={{ color: TONES[tone].color }}>
          {title}
        </h3>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

export function Callout({ tone = "you", title, children }: { tone?: Tone; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: TONES[tone].color, background: "var(--tile)" }}>
      <h4 className="mb-1 text-base font-bold">{title}</h4>
      <div className="text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}
