import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Basculer le thème"
      title="Basculer le thème (Clair / Sombre)"
      className={cn(
        "group relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent hover:border-[#D5C9B3]/80 bg-transparent hover:bg-[#D5C9B3] dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 hover:text-[#D96B43] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        className
      )}
    >
      <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all duration-200 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all duration-200 dark:rotate-0 dark:scale-100" />
    </button>
  );
}

export default ThemeToggle;
