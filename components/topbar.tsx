"use client";

import { ProfileMenu } from "@/components/profile-menu";

type TopbarProps = {
  onMenuClick: () => void;
  user: {
    firstName: string;
    lastName: string;
    email?: string;
    image?: string | null;
  };
};

export function Topbar({ onMenuClick, user }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-panel/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full items-center px-4 sm:px-6">
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

        <div className="ml-auto">
          <ProfileMenu user={user} />
        </div>
      </div>
    </header>
  );
}

