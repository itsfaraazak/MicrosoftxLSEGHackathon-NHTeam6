"use client";
import { useEffect } from "react";
import { useAppState } from "@/lib/app-state";
import { startDemoPrep } from "@/lib/demo-prep";

// Starts the Compare prep once, after the first portfolio exists. Renders nothing.
export function DemoPrep() {
  const { plan } = useAppState();
  const simDate = plan?.portfolio.sim_date;
  useEffect(() => {
    if (simDate) startDemoPrep(simDate);
  }, [simDate]);
  return null;
}
