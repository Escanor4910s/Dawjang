import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "./ThemeProvider";
import { UserPreferencesContext } from "@/hooks/useUserPreferences";
import { useContext } from "react";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  // Use context directly (not the hook that throws) so it works on pages
  // where UserPreferencesProvider may not be in scope (e.g. landing page)
  const prefsContext = useContext(UserPreferencesContext);

  const applyTheme = (newTheme: "light" | "dark" | "system") => {
    // 1. Write to localStorage immediately — ThemeProvider reads this on mount.
    //    This makes the switch instantaneous and persistent across page reloads.
    setTheme(newTheme);

    // 2. Also persist to Supabase DB in background (non-blocking) so the preference
    //    survives on other devices / after clearing localStorage.
    if (prefsContext) {
      prefsContext.updatePreferences({ theme: newTheme }).catch(() => {
        // Silent fail — localStorage already has the correct value
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 px-0">
          <Sun className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover border-border">
        <DropdownMenuItem onClick={() => applyTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Clair</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => applyTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Sombre</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => applyTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          <span>Système</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}