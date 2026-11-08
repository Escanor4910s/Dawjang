import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11.5px] font-medium tracking-[-0.01em] transition-colors duration-200 focus:outline-none tabular-nums",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary/12 text-primary hover:bg-primary/20",
        secondary:
          "border-border/80 bg-secondary text-secondary-foreground hover:bg-secondary/70 hover:text-foreground",
        destructive:
          "border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15",
        outline:
          "border-border bg-card/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
