"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true); setError("");
    try {
      const { profile } = await api.parseProfile(text);
      sessionStorage.setItem("profile", JSON.stringify(profile));
      router.push("/portfolio");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Don&apos;t Double Down</h1>
      <p className="text-muted-foreground">
        Your investments shouldn&apos;t bet on the same thing your paycheck does.
      </p>
      <Card>
        <CardHeader><CardTitle>Tell us about you</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="I'm a 29yo software engineer at a London fintech, I get share options, I have $15k in QQQ..." />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={submit} disabled={busy || !text.trim()}>
            {busy ? "Reading your profile..." : "Build my portfolio"}
          </Button>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Educational hackathon project. Not financial advice. Historical data and paper money only.
      </p>
    </main>
  );
}
