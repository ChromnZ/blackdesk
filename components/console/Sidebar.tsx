"use client";

import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bot,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Gauge,
  HardDrive,
  Headphones,
  ImageIcon,
  KeyRound,
  Layers3,
  ListChecks,
  Logs,
  MessageSquare,
  Settings2,
  Sparkles,
  Wand2,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
    label: "Create",
    items: [
      { key: "chat", label: "Chat", icon: <MessageSquare className="h-4 w-4" />, href: "/app/agent" },
      {
        key: "agent-builder",
        label: "Agent Builder",
        icon: <Bot className="h-4 w-4" />,
        href: "/app/agent",
      },
      { key: "audio", label: "Audio", icon: <Headphones className="h-4 w-4" /> },
      { key: "images", label: "Images", icon: <ImageIcon className="h-4 w-4" /> },
      { key: "videos", label: "Videos", icon: <Video className="h-4 w-4" /> },
    ],
  },
  {
    label: "Manage",
    items: [
      { key: "usage", label: "Usage", icon: <BarChart3 className="h-4 w-4" />, href: "/app" },
      {
        key: "api-keys",
        label: "API Keys",
        icon: <KeyRound className="h-4 w-4" />,
        href: "/app/settings#integrations",
      },
      { key: "apps", label: "Apps", icon: <FolderKanban className="h-4 w-4" />, href: "/app" },
      { key: "logs", label: "Logs", icon: <Logs className="h-4 w-4" />, href: "/app/news" },
      {
        key: "storage",
        label: "Storage",
        icon: <HardDrive className="h-4 w-4" />,
        href: "/app/inbox",
      },
    ],
  },
  {
    label: "Optimize",
    items: [
      {
        key: "evaluation",
        label: "Evaluation",
        icon: <Gauge className="h-4 w-4" />,
        href: "/app/tasks",
      },
      {
        key: "fine-tuning",
        label: "Fine-tuning",
        icon: <Sparkles className="h-4 w-4" />,
        href: "/app/calendar",
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
  const pathname = usePathname();
  const isPathActive = item.href
    ? pathname === item.href || pathname.startsWith(`${item.href}/`)
    : false;

  const isActive = active || isPathActive;
  const classes = cn(
    "group flex h-9 items-center rounded-md border px-2 text-sm transition",
    collapsed ? "justify-center" : "gap-2.5",
    isActive
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
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-zinc-900/80 bg-[#070708] transition-transform md:static md:z-0 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-20" : "md:w-72",
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-900/80 px-4 py-4">
          <div className={cn("min-w-0", collapsed && "md:hidden")}>
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Console</p>
            <p className="truncate text-lg font-semibold text-zinc-100">BlackDesk Console</p>
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

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.label} className="mb-4">
              {!collapsed && (
                <p className="px-2 pb-2 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                  {section.label}
                </p>
              )}
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
          <div
            className={cn(
              "rounded-xl border border-zinc-800 bg-zinc-950/70",
              collapsed ? "p-2" : "p-3",
            )}
          >
            <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "")}> 
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-200">
                <Wand2 className="h-4 w-4" />
              </div>
              {!collapsed && (
                <div>
                  <p className="text-sm font-medium text-zinc-100">Add credits</p>
                  <p className="text-xs text-zinc-500">Scale up agent runs and storage.</p>
                </div>
              )}
            </div>
            {!collapsed && (
              <Link
                href="/app/settings#integrations"
                className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-white"
              >
                Go to billing
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="mt-3 hidden h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-400 transition hover:text-zinc-200 md:inline-flex"
            aria-label={collapsed ? "Expand panel" : "Collapse panel"}
            title={collapsed ? "Expand panel" : "Collapse panel"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          {collapsed && (
            <Link
              href="/app/settings#integrations"
              className="mt-2 hidden h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-400 transition hover:text-zinc-200 md:inline-flex"
              aria-label="API settings"
              title="API settings"
            >
              <Settings2 className="h-4 w-4" />
            </Link>
          )}

          {collapsed && (
            <Link
              href="/app/agent"
              className="mt-2 hidden h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-400 transition hover:text-zinc-200 md:inline-flex"
              aria-label="Agent builder"
              title="Agent builder"
            >
              <ListChecks className="h-4 w-4" />
            </Link>
          )}

          {collapsed && (
            <Link
              href="/app"
              className="mt-2 hidden h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-400 transition hover:text-zinc-200 md:inline-flex"
              aria-label="Workspace"
              title="Workspace"
            >
              <Layers3 className="h-4 w-4" />
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
