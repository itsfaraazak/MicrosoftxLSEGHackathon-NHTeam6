import { Callout, Connector, Group, Legend, Node } from "@/components/architecture/primitives";

// Level 2: product components. Each box is a real module; the line under it says what it does in plain words.
export function Level2() {
  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[70ch] text-base leading-relaxed">
        The five screens in your browser each talk to one part of the SPARK server. The server does the deciding; the AI model and the market files
        sit outside it.
      </p>
      <Legend tones={["you", "server", "ai", "data", "example"]} />
      <div className="flex flex-col md:flex-row md:items-stretch">
        <Group tone="you" title="In your browser" subtitle="Nothing here leaves your device until you press a button">
          <Node tone="you" title="Five views">Profile, Plan (+ Compare), Time machine, Ask, Proof. Plus the Data sources and Rigor drawers.</Node>
          <Node tone="you" title="Your session">Your profile, plan and answers are kept in this tab only (sessionStorage).</Node>
          <Node tone="example" title="Saved demo data">Sample answers shown only if the server can’t be reached. Labelled “Offline demo data”.</Node>
        </Group>
        <Connector top label="text, profile, questions" />
        <Group tone="server" title="SPARK server" subtitle="Flask. Rules and checks live in code">
          <Node tone="server" title="Profile parser">Turns your words into a structured profile (the AI reads, code validates).</Node>
          <Node tone="server" title="Exposure mapper">Which sectors your job already depends on (the AI suggests, code checks the weights).</Node>
          <Node tone="server" title="Allocation rules">Safe bucket for goals within 5 years, no fund over 25%, warnings. Pure code.</Node>
          <Node tone="server" title="Explainer + number check">Plain-words explanation. Any number not backed by a fact is rejected.</Node>
          <Node tone="server" title="Time machine (Guard)">Spots drops while replaying 2022 and writes the coach message.</Node>
          <Node tone="server" title="Proof">Tests each claim on past prices. Code only, no AI.</Node>
          <Node tone="server" title="Ask + guardrails">Refuses future, injection and distress questions before the AI sees them.</Node>
          <Node tone="server" title="Data clock">The only door to prices. Cannot return anything after the simulation date.</Node>
          <Node tone="server" title="Audit log + rigor">Records what happened and how long each step took.</Node>
          <Node tone="server" title="Live refresh">“Go live” fetches the latest prices.</Node>
        </Group>
        <Connector top label="small facts, never raw prices" />
        <Group tone="data" title="Outside SPARK">
          <Node tone="ai" title="LLM portal">The organisers’ Azure-hosted, OpenAI-style service. Writes words only.</Node>
          <Node tone="data" title="Market files">prices.csv, fred.csv, layoffs.csv: real public data, downloaded in advance.</Node>
          <Node tone="data" title="Yahoo Finance">Contacted only when you press Go live.</Node>
        </Group>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Callout title="Guardrails">Look-ahead, prompt-injection and distress questions are refused in code, before the AI.</Callout>
        <Callout tone="data" title="Data clock">One function returns prices and cannot go past the simulation date.</Callout>
        <Callout tone="ai" title="Number check">Reject and regenerate; if it keeps failing, use a fixed template.</Callout>
        <Callout tone="server" title="Audit trail">Inputs and outputs are logged so any answer can be traced.</Callout>
      </div>
    </div>
  );
}
