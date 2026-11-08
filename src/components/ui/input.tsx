import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-xl border border-border/90 bg-card pl-3.5 pr-3.5 py-2 text-[13.5px] text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground/65 hover:placeholder:text-muted-foreground/90",
          "hover:border-foreground/25 hover:bg-secondary/30",
          "focus-visible:outline-none focus-visible:border-primary/70 focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-primary/12",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
