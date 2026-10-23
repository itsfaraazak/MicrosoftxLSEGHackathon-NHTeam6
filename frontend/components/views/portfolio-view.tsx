"use client";
import { PanelBody, PanelHead } from "@/components/panel";

export function PortfolioView() {
  return (
    <>
      <PanelHead title="Your $100,000 plan" subtitle="Built around your job, your goals and what you already hold." />
      <PanelBody>
        <p className="text-muted-foreground">Portfolio view arrives in step 4.</p>
      </PanelBody>
    </>
  );
}
