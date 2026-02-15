"use client";

import { ThemeProvider } from "@/components/theme-provider";
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
