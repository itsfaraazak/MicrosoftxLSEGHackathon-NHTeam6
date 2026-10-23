import { cn } from "@/lib/utils";

export function PanelHead({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b px-5 pt-5 pb-4 md:px-8 md:pt-6 md:pb-5">
      <div className="min-w-0">
        <h2 className="font-heading text-[clamp(20px,2.3vw,30px)] leading-tight font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1.5 max-w-[60ch] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}

export function PanelBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-6 md:px-8 md:pt-6 md:pb-8", className)}>{children}</div>;
}
