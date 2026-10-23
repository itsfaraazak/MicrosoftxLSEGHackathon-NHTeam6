"use client";
import { PanelBody, PanelHead } from "@/components/panel";

export function ProfileView() {
  return (
    <>
      <PanelHead
        title="Tell us about your life"
        subtitle="Your job matters as much as your risk appetite. We use it to keep your savings from betting on the same thing as your paycheck."
      />
      <PanelBody>
        <p className="text-muted-foreground">Profile builder arrives in step 3.</p>
      </PanelBody>
    </>
  );
}
