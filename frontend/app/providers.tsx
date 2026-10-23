"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AppStateProvider } from "@/lib/app-state";
import { makeQueryClient } from "@/lib/queries";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <MotionConfig reducedMotion="user">
          <AppStateProvider>{children}</AppStateProvider>
          <Toaster position="bottom-right" />
        </MotionConfig>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
