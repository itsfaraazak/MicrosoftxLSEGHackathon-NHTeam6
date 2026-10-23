import type { Metadata } from "next";
import { HowItWorks } from "@/components/architecture/how-it-works";

export const metadata: Metadata = {
  title: "How SPARK works",
  description: "SPARK explained at three levels of detail, how your data moves, and which Microsoft and Azure services are really used.",
};

// The root layout locks the body to the viewport, so this page scrolls inside its own full-height container.
export default function HowItWorksPage() {
  return (
    <div className="atmosphere h-dvh overflow-y-auto">
      <HowItWorks />
    </div>
  );
}
