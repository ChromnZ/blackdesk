"use client";

import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SWRConfig } from "swr";

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
      <ThemeProvider>{children}</ThemeProvider>
    </SWRConfig>
  );
}
