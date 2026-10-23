import { Callout } from "@/components/architecture/primitives";
import { cn } from "@/lib/utils";

type Status = "used" | "optional" | "unwired" | "none" | "dev";

const STATUS: Record<Status, { label: string; className: string }> = {
  used: { label: "Wired and used", className: "border-plan text-plan" },
  optional: { label: "Optional, off by default", className: "border-warn-line text-warn" },
  unwired: { label: "In dependencies, not wired", className: "border-destructive/60 text-destructive" },
  none: { label: "Not used", className: "border-border text-muted-foreground" },
  dev: { label: "Dev tooling", className: "border-primary text-primary" },
};

const ROWS: { name: string; status: Status; does: string; evidence: string }[] = [
  {
    name: "LLM on the organisers’ Azure-hosted OpenAI-style portal",
    status: "used",
    does: "Parses your story, maps your job to sectors, explains the plan, answers Ask, writes coach messages. Never picks holdings, never sees prices.",
    evidence: "backend/ai/llm.py · docs/pitch/SLIDE-ANSWERS.md:15 · the base URL and model name come from env vars and were not verified here",
  },
  { name: "Azure OpenAI / AI Foundry (our own deployment)", status: "none", does: "Nothing today. The client can use AZURE_OPENAI_* names as a fallback.", evidence: "backend/ai/llm.py _settings()" },
  {
    name: "Azure Cosmos DB",
    status: "optional",
    does: "Would hold the audit log. Without COSMOS_ENDPOINT + COSMOS_KEY it is a local file.",
    evidence: "backend/db/store.py:13-31 · local_store.jsonl exists with real events",
  },
  {
    name: "Application Insights / Azure Monitor",
    status: "unwired",
    does: "Nothing. Our own “rigor” metadata and audit log stand in.",
    evidence: "azure-monitor-opentelemetry (requirements.txt), @microsoft/applicationinsights-web (package.json), no import",
  },
  { name: "Azure Identity", status: "unwired", does: "Nothing.", evidence: "azure-identity (requirements.txt), no import" },
  { name: "Entra ID / MSAL", status: "unwired", does: "Nothing. There is no sign-in.", evidence: "@azure/msal-browser, @azure/msal-react (package.json), no import" },
  { name: "GitHub (Microsoft-owned)", status: "dev", does: "Repo, branches and pull requests.", evidence: "git remote origin" },
  { name: "TypeScript (Microsoft-created)", status: "used", does: "The entire frontend is strict TypeScript.", evidence: "frontend/tsconfig.json" },
  { name: "VS Code", status: "dev", does: "The editor the team built it in. Not part of the product.", evidence: "n/a" },
];

export function AzureTable() {
  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[70ch] text-base leading-relaxed">
        What is really used, audited from the code, not from the slides. Vercel, ngrok, Next.js, Flask, Yahoo Finance and FRED are <strong>not</strong> Microsoft.
      </p>
      <ul className="flex flex-col gap-2.5">
        {ROWS.map((r) => (
          <li key={r.name} className="tile grid gap-1.5 rounded-2xl p-3.5 md:grid-cols-[1.2fr_auto_1.6fr_1.3fr] md:items-start md:gap-4">
            <h4 className="text-base font-bold">{r.name}</h4>
            <span className={cn("w-fit rounded-full border px-2.5 py-0.5 text-sm font-bold", STATUS[r.status].className)}>{STATUS[r.status].label}</span>
            <p className="text-[15px] leading-snug text-muted-foreground">{r.does}</p>
            <p className="text-sm leading-snug break-words text-muted-foreground">{r.evidence}</p>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 md:grid-cols-2">
        <Callout tone="server" title="What we can honestly say on stage">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>The AI parts run on the organisers’ Azure-hosted OpenAI portal.</li>
            <li>The AI never chooses investments: code does, and every number it writes is checked against facts.</li>
            <li>It’s a Next.js and TypeScript frontend and a Flask backend, built on GitHub.</li>
            <li>Every AI action is logged; the store has a Cosmos DB client built in but today writes to a local file.</li>
            <li>Moving to Azure services is the next step. We haven’t done it yet.</li>
          </ol>
        </Callout>
        <Callout tone="ai" title="Do not claim">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Cosmos DB as live, unless COSMOS_* is set on the demo machine and you have seen items in the portal.</li>
            <li>Application Insights, Entra sign-in, Azure Identity, Key Vault or Content Safety. None is wired.</li>
            <li>“Deployed on Azure” or “our Azure OpenAI resource”: the frontend is on Vercel, the backend on a laptop behind ngrok.</li>
          </ul>
        </Callout>
      </div>
      <Callout tone="azure" title="What Azure would add next (future, not built)">
        Azure App Service or Container Apps for the backend and Static Web Apps for the frontend · Cosmos DB audit store (client already written) and Key Vault for the LLM key ·
        Application Insights via azure-monitor-opentelemetry (already a dependency) · Entra ID sign-in · Azure AI Content Safety / Prompt Shields behind our own guardrails · our own
        Azure OpenAI deployment.
      </Callout>
    </div>
  );
}
