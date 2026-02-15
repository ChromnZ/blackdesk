"use client";

import { ConsoleSidebar } from "@/components/console/Sidebar";
import { Topbar } from "@/components/nav/Topbar";
import { useEffect, useState, type ReactNode } from "react";

type ConsoleShellProps = {
  activeNavKey: string;
  user: {
    firstName: string;
    lastName: string;
    email?: string;
    image?: string | null;
  };
  children: ReactNode;
};

export function ConsoleShell({ activeNavKey, user, children }: ConsoleShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    function closeOnResize() {
      if (window.innerWidth >= 768) {
        setMobileSidebarOpen(false);
      }
    }

    window.addEventListener("resize", closeOnResize);
    return () => window.removeEventListener("resize", closeOnResize);
  }, []);

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#070708] text-zinc-100">
      <ConsoleSidebar
        activeNavKey={activeNavKey}
        mobileOpen={mobileSidebarOpen}
        collapsed={collapsed}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onToggleCollapse={() => setCollapsed((value) => !value)}
      />

      <div className="min-h-screen min-w-0 flex-1 overflow-x-hidden">
        <Topbar
          onMenuClick={() => setMobileSidebarOpen(true)}
          user={user}
        />
        <main className="min-h-[calc(100vh-56px)] overflow-x-hidden bg-[#070708] p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
