"use client";

import { cn } from "@/lib/utils";
import {
  Bot,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Newspaper,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

type SidebarItem = {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
};

type SidebarSection = {
  label: string;
  items: SidebarItem[];
};

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    label: "Workspace",
    items: [
      {
        key: "home",
        label: "Dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
        href: "/app",
      },
      {
        key: "agent-builder",
        label: "AI Agent",
        icon: <Bot className="h-4 w-4" />,
        href: "/app/agent",
      },
    ],
  },
  {
    label: "Execution",
    items: [
      {
        key: "calendar",
        label: "Calendar",
        icon: <CalendarDays className="h-4 w-4" />,
        href: "/app/calendar",
      },
      {
        key: "tasks",
        label: "Tasks",
        icon: <CheckSquare className="h-4 w-4" />,
        href: "/app/tasks",
      },
      {
        key: "news",
        label: "News",
        icon: <Newspaper className="h-4 w-4" />,
        href: "/app/news",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        key: "settings",
        label: "Settings",
        icon: <Settings className="h-4 w-4" />,
        href: "/app/settings",
      },
    ],
  },
];

type ConsoleSidebarProps = {
  activeNavKey: string;
  mobileOpen: boolean;
  collapsed: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
};

function SidebarItemButton({
  item,
  active,
  collapsed,
  onPress,
}: {
  item: SidebarItem;
  active: boolean;
  collapsed: boolean;
  onPress?: () => void;
}) {
  const classes = cn(
    "group flex h-9 items-center rounded-md border px-2 text-sm transition",
    collapsed ? "justify-center" : "gap-2.5",
    active
      ? "border-zinc-700 bg-zinc-800/85 text-zinc-100"
      : "border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900/75 hover:text-zinc-200",
  );

  const content = (
    <>
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/80 text-zinc-300 group-hover:text-zinc-100">
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={classes}
        onClick={onPress}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      title={collapsed ? item.label : undefined}
      className={classes}
      onClick={onPress}
      aria-label={item.label}
    >
      {content}
    </button>
  );
}

export function ConsoleSidebar({
  activeNavKey,
  mobileOpen,
  collapsed,
  onCloseMobile,
  onToggleCollapse,
}: ConsoleSidebarProps) {
  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onCloseMobile}
        className={cn(
          "fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-x-hidden border-r border-zinc-900/80 bg-[#070708] transition-transform md:static md:z-0 md:translate-x-0 md:transition-[width] md:duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-20" : "md:w-72",
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="min-h-[44px] min-w-0">
            <p
              className={cn(
                "text-[11px] uppercase tracking-[0.24em] text-zinc-500 transition-opacity duration-200",
                collapsed ? "opacity-0" : "opacity-100",
              )}
            >
              Console
            </p>
            <p className="truncate text-lg font-semibold text-zinc-100">
              {collapsed ? "BD" : "BlackDesk Console"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-400 md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.label} className="mb-4">
              <p
                className={cn(
                  "px-2 pb-2 text-[11px] uppercase tracking-[0.24em] text-zinc-500 transition-opacity duration-150",
                  collapsed ? "invisible" : "visible",
                )}
              >
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <SidebarItemButton
                    key={item.key}
                    item={item}
                    active={activeNavKey === item.key}
                    collapsed={collapsed}
                    onPress={onCloseMobile}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-zinc-900/80 p-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-400 transition hover:text-zinc-200 md:inline-flex"
            aria-label={collapsed ? "Expand panel" : "Collapse panel"}
            title={collapsed ? "Expand panel" : "Collapse panel"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
