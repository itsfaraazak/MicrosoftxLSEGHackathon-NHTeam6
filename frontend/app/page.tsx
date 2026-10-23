import { Suspense } from "react";
import { OrbitApp } from "@/components/orbit-app";
import { BRAND } from "@/lib/brand";

// The shell reads ?view= with useSearchParams, so it renders on the client under Suspense;
// only the atmosphere and a loading placeholder are prerendered.
function ShellFallback() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center text-muted-foreground">
      <span className="font-heading text-lg font-semibold">{BRAND.name}</span>
    </div>
  );
}

export default function Home() {
  return (
    <div className="atmosphere relative isolate flex h-dvh flex-col overflow-clip">
      <div aria-hidden className="floor-grid pointer-events-none absolute -right-1/2 -bottom-[10%] -left-1/2 -z-10 h-3/5" />
      <Suspense fallback={<ShellFallback />}>
        <OrbitApp />
      </Suspense>
    </div>
  );
}
