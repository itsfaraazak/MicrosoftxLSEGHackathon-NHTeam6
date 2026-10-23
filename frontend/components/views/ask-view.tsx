"use client";
import { PanelBody, PanelHead } from "@/components/panel";

export function AskView() {
  return (
    <>
      <PanelHead
        title="Ask about your plan"
        subtitle="Every answer uses only the facts in your plan up to the simulation date, and shows where each number came from."
      />
      <PanelBody>
        <p className="text-muted-foreground">Ask arrives in step 7.</p>
      </PanelBody>
    </>
  );
}
