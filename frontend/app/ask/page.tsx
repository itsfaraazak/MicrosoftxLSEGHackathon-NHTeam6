import { AskPanel } from "@/components/ask-panel";

export default function AskPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Ask</h1>
      <AskPanel />
    </main>
  );
}
