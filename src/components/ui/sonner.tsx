// src/components/ui/sonner.tsx
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Loader2,
} from "lucide-react";
import React from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      expand={false}
      closeButton
      duration={4000}
      className="toaster group"
      icons={{
        success: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
        info: <Info className="h-4 w-4 text-primary" />,
        warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        error: <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />,
        loading: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast !flex !items-start !justify-start !gap-3.5 !w-full !rounded-2xl !border !border-border/90 !bg-card/95 !backdrop-blur-xl !p-4 !text-foreground !shadow-[0_16px_40px_-10px_rgba(20,20,19,0.14)] dark:!shadow-[0_20px_48px_-12px_rgba(0,0,0,0.65)]",
          icon: "!m-0 !mt-0.5 !flex !h-9 !w-9 !shrink-0 !items-center !justify-center !rounded-xl !border !border-primary/25 !bg-primary/10 !text-primary",
          content: "!flex !flex-col !gap-0.5 !flex-1 !min-w-0",
          title: "!text-[13.5px] !font-semibold !tracking-[-0.01em] !text-foreground !leading-tight",
          description: "!text-[12.5px] !text-muted-foreground !leading-relaxed",
          actionButton:
            "!rounded-xl !bg-foreground !text-background !text-[12px] !font-semibold !px-3 !py-1.5",
          cancelButton:
            "!rounded-xl !bg-secondary !text-muted-foreground !text-[12px] !font-medium !px-3 !py-1.5",
          closeButton:
            "!border-border !bg-card !text-muted-foreground hover:!text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
