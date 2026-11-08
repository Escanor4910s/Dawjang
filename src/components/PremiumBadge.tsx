import React from "react";
import { Sparkles, Crown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PremiumBadgeProps {
  label?: string;
  type?: "premium" | "pro";
  className?: string;
  size?: "sm" | "md";
}

export function PremiumBadge({
  label,
  type,
  className,
  size = "sm",
}: PremiumBadgeProps) {
  const displayLabel = label || (type === "pro" ? "Pro" : type === "premium" ? "Premium" : "Pro");
  const isPro = type === "pro" || displayLabel.toLowerCase().includes("pro") || displayLabel.toLowerCase().includes("excellence");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 font-mono font-medium uppercase tracking-wider text-primary select-none transition-colors hover:bg-primary/15",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        className
      )}
    >
      {isPro ? (
        <Crown className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      ) : (
        <Zap className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}

export interface LockedFeatureProps {
  type?: "premium" | "pro";
  children: React.ReactNode;
  hasAccess?: boolean;
  onClick?: () => void;
}

export const LockedFeature = ({ children }: LockedFeatureProps) => {
  return <>{children}</>;
};

export default PremiumBadge;
