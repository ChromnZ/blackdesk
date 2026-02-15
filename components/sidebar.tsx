"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/app/calendar", label: "Calendar" },
  { href: "/app/tasks", label: "Tasks" },
  { href: "/app/inbox", label: "Inbox" },
  { href: "/app/settings", label: "Settings" },
];

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

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
          "fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r border-border bg-panel px-4 py-6 transition-transform md:static md:z-0 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-8 px-2">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-textMuted">Workspace</p>
          <p className="mt-2 font-display text-2xl font-semibold">BlackDesk</p>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "block rounded-md border px-3 py-2 text-sm transition",
                  isActive
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-transparent text-textMuted hover:border-border hover:bg-panelSoft hover:text-textMain",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

