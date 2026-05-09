import { Crown, Zap, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PremiumBadgeProps {
  type: "premium" | "pro";
  size?: "sm" | "md";
  className?: string;
}

export const PremiumBadge = ({ type, size = "sm", className }: PremiumBadgeProps) => {
  const isPro = type === "pro";
  
  return (
    <Badge
      className={cn(
        "font-medium gap-1",
        isPro 
          ? "bg-violet-600 hover:bg-violet-700 text-white border-violet-500" 
          : "bg-amber-500 hover:bg-amber-600 text-white border-amber-400",
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
        className
      )}
    >
      {isPro ? (
        <Crown className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />
      ) : (
        <Zap className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />
      )}
      {isPro ? "Pro" : "Premium"}
    </Badge>
  );
};

interface LockedFeatureProps {
  type: "premium" | "pro";
  children: React.ReactNode;
  hasAccess: boolean;
  onClick?: () => void;
}

export const LockedFeature = ({ type, children, hasAccess, onClick }: LockedFeatureProps) => {
  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div 
      className="relative cursor-pointer group"
      onClick={onClick}
    >
      <div className="absolute inset-0 backdrop-blur-[2px] bg-background/30 rounded-lg z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 bg-background/90 px-3 py-2 rounded-lg shadow-lg">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Réservé aux abonnés {type === "pro" ? "Pro" : "Premium"}
          </span>
        </div>
      </div>
      {children}
      <div className="absolute top-2 right-2 z-5">
        <PremiumBadge type={type} />
      </div>
    </div>
  );
};
