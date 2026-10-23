import { Suspense } from "react";
import { OrbitApp } from "@/components/orbit-app";
import { TopBar } from "@/components/top-bar";

// The orbit reads ?view= with useSearchParams, so it renders on the client under Suspense;
// the shell (atmosphere, top bar, disclaimer) is prerendered.
function OrbitFallback() {
  return (
    <div className="relative min-h-0 flex-1">
      <div className="glass-panel absolute top-2.5 bottom-4 left-1/2 w-[min(1000px,92vw)] -translate-x-1/2 rounded-[28px]" />
    </div>
  );
}

export default function Home() {
  return (
    <div className="atmosphere relative isolate flex h-full flex-col overflow-clip">
      <div aria-hidden className="floor-grid pointer-events-none absolute -right-1/2 -bottom-[10%] -left-1/2 -z-10 h-3/5" />
      <TopBar />
      <main className="relative flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<OrbitFallback />}>
          <OrbitApp />
        </Suspense>
      </main>
      <footer className="px-4 pb-3 text-center text-xs text-muted-foreground">
        Educational hackathon project. Not financial advice. Paper money only.
      </footer>
    </div>
  );
}
