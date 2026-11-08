import React from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakCounterProps {
  streak?: number;
  currentStreak?: number;
  longestStreak?: number;
  compact?: boolean;
  className?: string;
}

export function StreakCounter({
  streak: propStreak,
  currentStreak: propCurrent,
  longestStreak,
  compact = false,
  className,
}: StreakCounterProps = {}) {
  const streak = propStreak ?? propCurrent ?? 7;

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs transition-colors border-border/80 bg-background text-muted-foreground",
          className
        )}
      >
        <Flame className="h-3.5 w-3.5 text-primary" />
        <span className="font-mono text-[12px] font-semibold tabular-nums text-foreground">
          {streak} j
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center justify-between text-[12px] cursor-default select-none",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
          <Flame className="h-3.5 w-3.5" />
        </div>
        <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-200">
          Cadence d'étude
        </span>
      </div>
      <span className="font-mono text-[12px] font-semibold tabular-nums text-foreground group-hover:text-primary transition-colors duration-200">
        {streak} j
      </span>
    </div>
  );
}

export default StreakCounter;
