"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={compact ? "w-full" : "max-w-xs"}>
      <label
        htmlFor={compact ? "theme-select-compact" : "theme-select"}
        className="mb-1 block text-xs uppercase tracking-[0.12em] text-textMuted"
      >
        Theme
      </label>
      <select
        id={compact ? "theme-select-compact" : "theme-select"}
        value={mounted ? theme : "system"}
        onChange={(event) =>
          setTheme(event.target.value as "light" | "dark" | "system")
        }
        className="w-full rounded-md border border-border bg-panelSoft px-2.5 py-2 text-sm text-textMain"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
