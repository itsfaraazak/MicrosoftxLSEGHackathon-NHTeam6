import { DataSourcesLink } from "@/components/data-sources-chip";
import { DataModeChip } from "@/components/live-badge";
import { WhoChip } from "@/components/who-chip";
import { cn } from "@/lib/utils";

export function PanelHead({
  title,
  subtitle,
  actions,
  who = true,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  // Every view says whose plan it is showing, so demo personas are never mistaken for the user.
  who?: boolean;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b px-4 pt-4 pb-3 md:gap-4 md:px-8 md:pt-6 md:pb-5">
      <div className="min-w-0">
        <h2 className="font-heading text-[24px] leading-tight font-semibold tracking-tight md:text-[clamp(22px,2.3vw,30px)]">{title}</h2>
        {subtitle && <p className="mt-1 line-clamp-2 max-w-[60ch] text-[15px] leading-snug text-muted-foreground md:mt-1.5 md:line-clamp-none md:text-base">{subtitle}</p>}
        {who && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <WhoChip />
            <DataModeChip />
            <DataSourcesLink />
          </div>
        )}
      </div>
      {actions}
    </header>
  );
}

export function PanelBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-4 pb-5 md:px-8 md:pt-6 md:pb-8", className)}>
      {children}
    </div>
  );
}
