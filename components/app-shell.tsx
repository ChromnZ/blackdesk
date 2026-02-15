"use client";

import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useEffect, useState } from "react";

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
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const closeOnResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", closeOnResize);
    return () => window.removeEventListener("resize", closeOnResize);
  }, []);

  return (
    <div className="min-h-screen bg-bg text-textMain md:flex">
      <Sidebar
        open={isSidebarOpen}
        collapsed={isSidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
      />

      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar
          user={user}
          onMenuClick={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

