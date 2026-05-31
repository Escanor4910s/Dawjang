import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  // Resolve the effective dark state, accounting for "system" mode
  const isDark = theme === "dark" || 
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <button 
      onClick={toggleTheme}
      className="relative w-14 h-8 rounded-full bg-black/50 border border-white/10 flex items-center px-1 transition-all outline-none"
      aria-label="Changer de thème"
    >
      <div className="absolute inset-0 flex justify-between items-center px-2 pointer-events-none opacity-40">
        <Sun className="h-3.5 w-3.5 text-white" />
        <Moon className="h-3.5 w-3.5 text-white" />
      </div>
      <motion.div 
        layout 
        className="h-6 w-6 rounded-full bg-white shadow-md z-10 flex items-center justify-center"
        animate={{ x: isDark ? 24 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        {isDark ? <Moon className="h-3 w-3 text-[#111111]" /> : <Sun className="h-3 w-3 text-[#111111]" />}
      </motion.div>
    </button>
  );
};