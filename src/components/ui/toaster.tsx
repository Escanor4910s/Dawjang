import { useToast } from "@/hooks/use-toast"
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast"
import { Info } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast 
            key={id} 
            {...props} 
            className="group relative flex w-[356px] items-start gap-3.5 p-4 bg-white/85 dark:bg-[#111111]/85 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 rounded-[16px] shadow-[0_12px_24px_-6px_rgba(0,0,0,0.08),0_4px_8px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)] transition-all duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full"
          >
            <Info className="w-5 h-5 mt-0.5 shrink-0 text-blue-500 stroke-[2px]" />
            
            <div className="grid gap-1 flex-1">
              {title && <ToastTitle className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 leading-none tracking-tight">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="text-[13px] text-slate-500 dark:text-slate-400 leading-snug">{description}</ToastDescription>
              )}
            </div>
            
            {action}
            
            <ToastClose className="absolute right-3 top-3 rounded-md p-1.5 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-all focus:outline-none" />
          </Toast>
        )
      })}
      
      {/* Positionnement parfait : Descente depuis le Top-Center */}
      <ToastViewport className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 p-8 w-full max-w-[400px] m-0 list-none outline-none pointer-events-none [&>li]:pointer-events-auto" />
    </ToastProvider>
  )
}
