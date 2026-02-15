"use client";

import { LogoutButton } from "@/components/logout-button";

type TopbarProps = {
  user: {
    username: string;
    email?: string;
  };
  onMenuClick: () => void;
};

export function Topbar({ user, onMenuClick }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-black/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Toggle sidebar"
            onClick={onMenuClick}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-panel text-textMain transition hover:bg-panelSoft md:hidden"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-display text-lg font-semibold tracking-tight">BlackDesk</span>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-panel px-3 py-2 shadow-glow">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-textMain">{user.username}</p>
            <p className="text-[11px] text-textMuted">{user.email ?? "No email"}</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

