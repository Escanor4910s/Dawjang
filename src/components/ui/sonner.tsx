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
      duration={4800}
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
            "group toast !flex !items-start !justify-start !gap-3 !w-full !rounded-2xl !border !border-[#121316]/12 dark:!border-white/12 !bg-white/95 dark:!bg-[#16171B]/95 !backdrop-blur-2xl !p-3.5 !text-foreground !shadow-[0_18px_44px_-10px_rgba(18,19,22,0.16)] dark:!shadow-[0_22px_52px_-12px_rgba(0,0,0,0.72)]",
          icon: "!m-0 !mt-0.5 !flex !h-9 !w-9 !shrink-0 !items-center !justify-center !rounded-xl !border !border-primary/25 !bg-primary/10 !text-primary",
          content: "!flex !flex-col !gap-1 !flex-1 !min-w-0",
          title: "!text-[13px] !font-semibold !tracking-[-0.01em] !text-foreground !leading-snug",
          description: "!text-[12px] !text-muted-foreground !leading-relaxed !line-clamp-3",
          actionButton:
            "!rounded-lg !bg-foreground !text-background !text-[11.5px] !font-semibold !px-2.5 !py-1",
          cancelButton:
            "!rounded-lg !bg-secondary !text-muted-foreground !text-[11.5px] !font-medium !px-2.5 !py-1",
          closeButton:
            "!border-border !bg-card !text-muted-foreground hover:!text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
