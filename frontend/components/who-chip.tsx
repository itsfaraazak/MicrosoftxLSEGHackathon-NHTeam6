"use client";
import { UserRound } from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { possessive } from "@/lib/display";
import { personaById } from "@/lib/personas";

// Says whose plan the current view is about. Demo personas are fictional; "You" is whatever the user typed.
export function WhoChip() {
  const { persona, profile } = useAppState();
  const isCustom = persona === "custom";
  const name = profile?.name?.trim() || (isCustom ? null : personaById(persona).name);
  const label = !profile ? "No plan yet" : isCustom ? "Your own profile" : `${possessive(name)} plan`;
  const tag = profile && !isCustom ? " · demo persona" : "";
  return (
    <span
      className="tile inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
      title={
        isCustom
          ? "This is the profile you wrote yourself."
          : "Priya, Tom and Fiona are fictional people we made up so you can see how SPARK adapts to different lives."
      }
    >
      <UserRound aria-hidden className="size-3.5 text-primary" />
      <span className="hidden sm:inline">Viewing: </span>
      {label}
      {tag}
    </span>
  );
}
