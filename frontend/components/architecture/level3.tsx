import { Callout, Chain, Legend, Node } from "@/components/architecture/primitives";

const ENDPOINTS: { m: string; path: string; what: string; llm: "yes" | "no" | "optional" }[] = [
  { m: "POST", path: "/api/profile/parse", what: "ai/functions.parse_profile: fenced text, JSON mode, pydantic validation, up to 2 retries, code adds contradiction flags", llm: "yes" },
  { m: "POST", path: "/api/portfolio", what: "map_exposure + engine/portfolio.build + explain; registers the profile; cached by sha256(profile + date)", llm: "yes" },
  { m: "POST", path: "/api/compare", what: "same build for each profile, cached", llm: "yes" },
  { m: "GET", path: "/api/replay", what: "engine/guard.replay through the data clock; coach text via LLM only if REPLAY_LLM=1, else cache or template", llm: "optional" },
  { m: "POST", path: "/api/ask", what: "guardrails.pre_filter first, then facts, LLM, number check, audit", llm: "yes" },
  { m: "POST", path: "/api/proof  ·  GET /api/proof/script", what: "quant/backtest + metrics + proof: code only, ships source, sha256 and a standalone script", llm: "no" },
  { m: "GET", path: "/api/rigor/summary  ·  /api/audit", what: "reads the audit store (no authentication)", llm: "no" },
  { m: "GET/POST", path: "/api/live/status · /quotes · /refresh · /api/data/sources", what: "yfinance download, atomic write of prices.csv, 60 s cooldown", llm: "no" },
  { m: "GET", path: "/api/health", what: "{ ok, mocks }; USE_MOCKS=1 serves backend/mocks/*.json", llm: "no" },
];

const LLM_LABEL = { yes: "uses the LLM", no: "no LLM", optional: "LLM optional" } as const;

function Card({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="tile rounded-2xl p-4">
      <h4 className="mb-2 text-base font-bold">{title}</h4>
      <ul className="flex flex-col gap-1.5 text-[15px] text-muted-foreground">
        {items.map((i) => (
          <li key={i} className="leading-snug">
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Level 3: the real file names, endpoints, ports and fallbacks.
export function Level3() {
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-[70ch] text-base leading-relaxed">
        One request, end to end: the browser calls a relative <code className="font-mono text-sm">/api/*</code> URL, Vercel’s middleware forwards it to an ngrok tunnel,
        which reaches gunicorn on the team laptop.
      </p>
      <Legend tones={["you", "server", "ai", "data", "azure"]} />
      <Chain
        items={[
          { node: <Node tone="you" title="Browser">Next.js 16, React 19, TypeScript (strict), TanStack Query, zod, sessionStorage <code className="font-mono text-sm">ddd:*</code></Node>, arrow: "/api/*" },
          { node: <Node tone="example" title="Vercel">Pages <code className="font-mono text-sm">/</code> and <code className="font-mono text-sm">/how-it-works</code>; <code className="font-mono text-sm">middleware.ts</code> proxies /api/* and adds ngrok-skip-browser-warning</Node>, arrow: "https" },
          { node: <Node tone="example" title="ngrok tunnel">Stable https domain to the laptop</Node>, arrow: "to :5070" },
          { node: <Node tone="server" title="gunicorn + Flask">-w 1 --threads 8, <code className="font-mono text-sm">app.py</code>: CORS, 60 req/min limit on LLM routes, 6 blueprints</Node> },
        ]}
      />
      <Chain
        items={[
          { node: <Node tone="server" title="ai/">llm.py, functions.py, guardrails.py, number_check.py, rigor.py, exposure_fallback.py</Node> },
          { node: <Node tone="server" title="engine/">portfolio.py, exposure.py, data_clock.py, guard.py, agent.py, personas.py</Node> },
          { node: <Node tone="server" title="quant/ · db/ · routes/">backtest, metrics, proof · store.py (JSONL or Cosmos) · *_routes.py</Node> },
        ]}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <Node tone="ai" title="LLM client">OpenAI Python client, one call at a time, 12 s per call, 18 s per request, no retries inside the client. Azure “deployments” route when LLM_API_VERSION is set.</Node>
        <Node tone="data" title="Data files">backend/data/prices.csv (17 ETFs, Close), fred.csv, layoffs.csv, coach_cache.json. Read through engine/data_clock only.</Node>
        <Node tone="server" title="State">In memory: profile REGISTRY by first name, plan cache. On disk: local_store.jsonl audit log (Cosmos if COSMOS_* is set).</Node>
      </div>

      <section aria-label="Endpoints">
        <h3 className="mb-2 text-lg font-bold">Endpoints</h3>
        <ul className="flex flex-col gap-2">
          {ENDPOINTS.map((e) => (
            <li key={e.path} className="tile grid gap-1 rounded-2xl p-3 md:grid-cols-[minmax(0,19rem)_1fr_8rem] md:items-center md:gap-4">
              <span className="font-mono text-sm break-words">
                <strong className="mr-1.5 text-primary">{e.m}</strong>
                {e.path}
              </span>
              <span className="text-[15px] leading-snug text-muted-foreground">{e.what}</span>
              <span className={`w-fit rounded-full border px-2.5 py-0.5 text-sm font-bold ${e.llm === "no" ? "text-plan" : "text-foreground"}`}>{LLM_LABEL[e.llm]}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <Card
          title="Environment variables (names only)"
          items={[
            "USE_MOCKS, FLASK_PORT, RATE_LIMIT_PER_MIN, REPLAY_LLM",
            "LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, LLM_FAST_MODEL, LLM_API_VERSION, LLM_AUTH_HEADER, LLM_TIMEOUT_S, LLM_DEADLINE_S (or AZURE_OPENAI_*)",
            "COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DATABASE",
            "NEXT_PUBLIC_API_URL, NEXT_PUBLIC_DEMO_FALLBACK",
          ]}
        />
        <Card
          title="Ports"
          items={["Backend 5070 (never 5060/5061: Chrome blocks them)", "Frontend dev 3000; CORS also allows 3001 and 3055", "macOS AirPlay owns 5000"]}
        />
        <Card
          title="Fallbacks"
          items={[
            "LLM down: HTTP 502/504 with fallback:true",
            "Exposure: keyword map. Explanation: fixed template",
            "Server unreachable: public/demo/*.json, labelled",
            "USE_MOCKS=1: backend/mocks/*.json",
          ]}
        />
      </div>
      <Callout tone="server" title="Trust controls in the code">
        <code className="font-mono text-sm">guardrails.pre_filter</code> (distress, injection, future) · <code className="font-mono text-sm">guardrails.fence</code> (untrusted text) ·{" "}
        <code className="font-mono text-sm">data_clock.get_prices</code> (asserts no future rows) · <code className="font-mono text-sm">number_check.check</code> (reject + regenerate) ·{" "}
        <code className="font-mono text-sm">db/store.log</code> (audit).
      </Callout>
    </div>
  );
}
