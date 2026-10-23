"use client";
import { PanelBody, PanelHead } from "@/components/panel";

export function ReplayView() {
  return (
    <>
      <PanelHead
        title="Replaying 2022, one month at a time"
        subtitle="The chart only shows data up to the simulation date. The future stays hidden, for you and for the AI."
      />
      <PanelBody>
        <p className="text-muted-foreground">Time machine arrives in step 5.</p>
      </PanelBody>
    </>
  );
}
