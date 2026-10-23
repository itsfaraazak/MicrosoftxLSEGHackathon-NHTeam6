"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Portfolio, type Profile } from "@/lib/api";

const SIM_START = "2022-01-03";

export default function PortfolioPage() {
  const [data, setData] = useState<{ portfolio: Portfolio; explanation: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("profile");
    if (!raw) { setError("No profile yet. Start on the home page."); return; }
    api.portfolio(JSON.parse(raw) as Profile, SIM_START).then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <main className="p-6">{error}</main>;
  if (!data) return <main className="p-6"><Skeleton className="h-64 w-full" /></main>;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Your portfolio · {data.portfolio.sim_date}</h1>
      <p>{data.explanation}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.portfolio.positions.map((p) => (
          <Card key={p.ticker}>
            <CardHeader><CardTitle className="flex justify-between">
              {p.ticker}<Badge variant={p.bucket === "safe" ? "secondary" : "default"}>{p.bucket}</Badge>
            </CardTitle></CardHeader>
            <CardContent>
              <div className="text-xl">${p.amount_usd.toLocaleString()}</div>
              <ul className="mt-2 text-xs text-muted-foreground">
                {p.reason_facts.map((f) => <li key={f.id}>{f.id}: {f.value}{f.unit} ({f.source}, {f.as_of})</li>)}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      <Link className="underline" href="/replay">Open the time machine →</Link>
    </main>
  );
}
