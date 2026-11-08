import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[96px] w-full rounded-xl border border-border/90 bg-card px-4 py-3 text-[14px] leading-relaxed text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "placeholder:text-muted-foreground/65 hover:placeholder:text-muted-foreground/90",
          "hover:border-foreground/25 hover:bg-secondary/20",
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
Textarea.displayName = "Textarea";

export { Textarea };
