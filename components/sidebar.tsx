"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const PRIMARY_NAV_ITEMS: NavItem[] = [
  {
    href: "/app",
    label: "Home",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m3 11.25 9-8.25 9 8.25v9.75a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-6v6H4.5A1.5 1.5 0 0 1 3 21Z" />
      </svg>
    ),
  },
  {
    href: "/app/agent",
    label: "AI Agent",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3M12 18v3M4.22 6.22l2.12 2.12M17.66 17.66l2.12 2.12M3 12h3M18 12h3M4.22 17.78l2.12-2.12M17.66 6.34l2.12-2.12" />
        <circle cx="12" cy="12" r="4.5" />
      </svg>
    ),
  },
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
  {
    href: "/app/calendar",
    label: "Calendar",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3v3M7.5 3v3M3.75 9.75h16.5M5.25 5.25h13.5A1.5 1.5 0 0 1 20.25 6.75v12A1.5 1.5 0 0 1 18.75 20.25H5.25a1.5 1.5 0 0 1-1.5-1.5v-12a1.5 1.5 0 0 1 1.5-1.5Z" />
      </svg>
    ),
  },
  {
    href: "/app/tasks",
    label: "Tasks",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5h11.25M8.25 12h11.25M8.25 16.5h11.25M3.75 7.5h.008v.008H3.75Zm0 4.5h.008v.008H3.75Zm0 4.5h.008v.008H3.75Z" />
      </svg>
    ),
  },
  {
    href: "/app/news",
    label: "News",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5h15v15h-15ZM8.25 8.25h7.5M8.25 12h7.5M8.25 15.75h4.5" />
      </svg>
    ),
  },
];

type SidebarProps = {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  open,
  collapsed,
  onClose,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();

  function renderNavItem(item: NavItem) {
    const isActive = isActivePath(pathname, item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        onClick={onClose}
        className={cn(
          "group flex items-center rounded-md border text-sm transition",
          collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2.5",
          isActive
            ? "border-accent/20 bg-accent/10 text-textMain"
            : "border-transparent text-textMuted hover:border-border hover:bg-panelSoft hover:text-textMain",
        )}
      >
        <span
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center",
            isActive ? "text-textMain" : "text-textMuted group-hover:text-textMain",
          )}
        >
          {item.icon}
        </span>
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/70 transition md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r border-border bg-panel/95 px-3 pb-3 pt-5 backdrop-blur transition-transform duration-200 md:sticky md:top-0 md:z-0 md:h-screen md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-[76px] md:px-2" : "md:w-64 md:px-3",
        )}
      >
        <div className={cn("mb-6 px-1", collapsed ? "text-center" : "")}>
          <p className={cn("font-display text-xs uppercase tracking-[0.25em] text-textMuted", collapsed ? "hidden" : "block")}>
            Workspace
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">{collapsed ? "B" : "BlackDesk"}</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {PRIMARY_NAV_ITEMS.map((item) => renderNavItem(item))}

          <div className="my-2 h-px bg-border" />

          {SECONDARY_NAV_ITEMS.map((item) => renderNavItem(item))}
        </nav>

        <div className="mt-auto pt-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "hidden items-center rounded-md border border-border bg-panelSoft text-xs text-textMuted transition hover:bg-panel hover:text-textMain md:flex",
              collapsed ? "justify-center px-2 py-2.5" : "gap-2 px-2.5 py-2",
            )}
            aria-label={collapsed ? "Expand panel" : "Hide panel"}
            title={collapsed ? "Expand panel" : "Hide panel"}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25 9 12l6.75 6.75" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 5.25 15 12l-6.75 6.75" />
              )}
            </svg>
            {!collapsed && <span>Hide panel</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
