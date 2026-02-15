"use client";

import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useEffect, useState } from "react";

type AppShellProps = {
  children: React.ReactNode;
  user: {
    username: string;
    email?: string;
  };
};

export function AppShell({ children, user }: AppShellProps) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

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
      <Sidebar open={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar user={user} onMenuClick={() => setSidebarOpen((prev) => !prev)} />
        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

