import React from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface XPBarProps {
  xp?: number;
  level?: number;
  nextLevelXp?: number;
  compact?: boolean;
  className?: string;
}

export function XPBar({
  xp = 1450,
  level = 4,
  nextLevelXp = 2000,
  compact = false,
  className,
}: XPBarProps) {
  const percentage = Math.min(100, Math.round((xp / nextLevelXp) * 100));

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1 text-primary font-medium text-xs font-mono">
          <Zap className="h-3 w-3" />
          <span>Niv. {level}</span>
        </div>
        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden min-w-[60px] max-w-[80px]">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("group space-y-1.5", className)}>
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-200">
          Niveau d'ancrage {level}
        </span>
        <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground group-hover:text-primary transition-colors duration-200">
          {xp} / {nextLevelXp} pts
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default XPBar;
