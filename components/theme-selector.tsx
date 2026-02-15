"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme =
    mounted && (theme === "light" || theme === "dark")
      ? theme
      : resolvedTheme === "light"
        ? "light"
        : "dark";

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
        value={activeTheme}
        onChange={(event) => setTheme(event.target.value as "light" | "dark")}
        className="w-full rounded-md border border-border bg-panelSoft px-2.5 py-2 text-sm text-textMain"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
