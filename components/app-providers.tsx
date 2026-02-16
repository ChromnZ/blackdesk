"use client";

import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SWRConfig } from "swr";
import { Toaster } from "react-hot-toast";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateIfStale: true,
        keepPreviousData: true,
        dedupingInterval: 10_000,
      }}
    >
      <ThemeProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            className:
              "rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl",
            duration: 4500,
          }}
        />
      </ThemeProvider>
    </SWRConfig>
  );
}
