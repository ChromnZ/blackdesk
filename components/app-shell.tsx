"use client";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

type AppShellProps = {
  children: React.ReactNode;
  user: {
    firstName: string;
    lastName: string;
    email?: string;
    image?: string | null;
  };
};

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const activeNavKey = useMemo(() => {
    if (pathname === "/app") {
      return "home";
    }
    if (pathname === "/app/agent" || pathname.startsWith("/app/agent/")) {
      return "agent-builder";
    }
    if (pathname === "/app/calendar" || pathname.startsWith("/app/calendar/")) {
      return "calendar";
    }
    if (pathname === "/app/tasks" || pathname.startsWith("/app/tasks/")) {
      return "tasks";
    }
    if (pathname === "/app/news" || pathname.startsWith("/app/news/")) {
      return "news";
    }
    if (pathname === "/app/inbox" || pathname.startsWith("/app/inbox/")) {
      return "inbox";
    }
    if (pathname === "/app/settings" || pathname.startsWith("/app/settings/")) {
      return "settings";
    }
    return "home";
  }, [pathname]);

  return (
    <ConsoleShell activeNavKey={activeNavKey} user={user}>
      {children}
    </ConsoleShell>
  );
}

