"use client";
import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type GuardEvent } from "@/lib/api";

type Month = { date: string; ours: number; tech_heavy: number };

export default function ReplayPage() {
  const [months, setMonths] = useState<Month[]>([]);
  const [events, setEvents] = useState<GuardEvent[]>([]);
  const [cursor, setCursor] = useState(1);

  useEffect(() => {
    api.replay("priya", "2022-01-03", "2023-12-29").then((r) => { setMonths(r.months); setEvents(r.events); });
  }, []);

  const visible = months.slice(0, cursor);
  const now = visible.at(-1)?.date;
  const event = events.find((e) => now && e.sim_date.slice(0, 7) === now.slice(0, 7));

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Time machine · {now ?? "..."}</h1>
      <Card><CardContent className="h-80 pt-6">
        <ResponsiveContainer>
          <LineChart data={visible}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis domain={["auto", "auto"]} />
            <Tooltip /><Legend />
            <Line dataKey="ours" name="Diversified" stroke="#2563eb" dot={false} />
            <Line dataKey="tech_heavy" name="Tech-heavy (QQQ)" stroke="#dc2626" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent></Card>
      <Button onClick={() => setCursor((c) => Math.min(c + 1, months.length))} disabled={cursor >= months.length}>
        Next month
      </Button>
      {event && (
        <Card><CardHeader><CardTitle>Coach · {event.suggested_action}</CardTitle></CardHeader>
          <CardContent>{event.coach_message}</CardContent></Card>
      )}
    </main>
  );
}
