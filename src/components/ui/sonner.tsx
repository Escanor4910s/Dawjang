import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"
import { CheckCircle2, XCircle, AlertCircle, Info, Loader2 } from "lucide-react"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      offset={32}
      toastOptions={{
        classNames: {
          /* 
            Le Rectangle Parfait :
            Largeur fixe de 356px, Padding équilibré, Rayon de 16px.
            Ombre naturelle et Verre dépoli natif. Zéro artifice.
          */
          toast: "group flex w-[356px] items-start gap-3.5 p-4 bg-white/85 dark:bg-[#111111]/85 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 rounded-[16px] shadow-[0_12px_24px_-6px_rgba(0,0,0,0.08),0_4px_8px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)] transition-all duration-300",
          title: "text-[14px] font-semibold text-slate-900 dark:text-slate-100 leading-none tracking-tight",
          description: "text-[13px] text-slate-500 dark:text-slate-400 leading-snug mt-1",
          icon: "mt-0.5 shrink-0",
          actionButton: "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium text-xs rounded-lg px-3.5 py-1.5 transition-opacity hover:opacity-80 ml-auto",
          cancelButton: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-xs rounded-lg px-3.5 py-1.5 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 ml-2",
        },
      }}
      /* 
        Icônes nues et chirurgicales. 
        Aucun fond, aucune ombre artificielle. Juste le trait parfait.
      */
      icons={{
        success: <CheckCircle2 className="w-5 h-5 text-emerald-500 stroke-[2px]" />,
        error: <XCircle className="w-5 h-5 text-rose-500 stroke-[2px]" />,
        info: <Info className="w-5 h-5 text-blue-500 stroke-[2px]" />,
        warning: <AlertCircle className="w-5 h-5 text-amber-500 stroke-[2px]" />,
        loading: <Loader2 className="w-5 h-5 text-slate-500 dark:text-slate-400 animate-spin stroke-[2px]" />,
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
