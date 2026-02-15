"use client";

import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PRIMARY_NAV_ITEMS = [
  { href: "/app", label: "Home" },
  { href: "/app/agent", label: "AI Agent" },
];

const SECONDARY_NAV_ITEMS = [
  { href: "/app/calendar", label: "Calendar" },
  { href: "/app/tasks", label: "Tasks" },
  { href: "/app/news", label: "News" },
];

type SidebarProps = {
  user: {
    username: string;
    email?: string;
    image?: string | null;
  };
  open: boolean;
  onClose: () => void;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ user, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const isSettingsActive = isActivePath(pathname, "/app/settings");

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
          "fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r border-border bg-panel px-4 pb-0 pt-6 transition-transform md:sticky md:top-0 md:z-0 md:h-screen md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-8 px-2">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-textMuted">Workspace</p>
          <p className="mt-2 font-display text-2xl font-semibold">BlackDesk</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto pb-4">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = isActivePath(pathname, item.href);

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

          <div className="my-3 h-px bg-border" />

          {SECONDARY_NAV_ITEMS.map((item) => {
            const isActive = isActivePath(pathname, item.href);

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

        <div className="mt-auto border-t border-border py-4">
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-black/40 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-panelSoft text-xs font-semibold text-textMain">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt={`${user.username} profile picture`}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  user.username.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-textMain">
                  {user.username}
                </p>
                <p className="truncate text-[11px] text-textMuted">{user.email ?? "No email"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LogoutButton
                label="Logout"
                className="rounded-md border border-white/20 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-black transition hover:bg-white/90"
              />
              <Link
                href="/app/settings"
                aria-label="Open settings"
                onClick={onClose}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-md border transition",
                  isSettingsActive
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-border bg-panel text-textMuted hover:bg-panelSoft hover:text-textMain",
                )}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.325 4.317a1.724 1.724 0 0 1 3.35 0 1.724 1.724 0 0 0 2.573 1.066 1.724 1.724 0 0 1 2.494 2.494 1.724 1.724 0 0 0 1.066 2.573 1.724 1.724 0 0 1 0 3.35 1.724 1.724 0 0 0-1.066 2.573 1.724 1.724 0 0 1-2.494 2.494 1.724 1.724 0 0 0-2.573 1.066 1.724 1.724 0 0 1-3.35 0 1.724 1.724 0 0 0-2.573-1.066 1.724 1.724 0 0 1-2.494-2.494 1.724 1.724 0 0 0-1.066-2.573 1.724 1.724 0 0 1 0-3.35 1.724 1.724 0 0 0 1.066-2.573 1.724 1.724 0 0 1 2.494-2.494 1.724 1.724 0 0 0 2.573-1.066Z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

