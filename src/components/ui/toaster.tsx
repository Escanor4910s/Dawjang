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
            // Largeur 440px, Padding 24px (p-6), Arrondi 20px, Gap 20px (gap-5)
            className="group relative w-[440px] p-6 rounded-[20px] flex items-start gap-5 bg-[rgba(255,255,255,0.85)] dark:bg-[rgba(18,18,18,0.85)] backdrop-blur-[24px] border border-black/5 dark:border-white/[0.08] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full"
            style={{
              boxShadow: "0 1px 2px rgba(0,0,0,0.02), 0 8px 16px -4px rgba(0,0,0,0.04), 0 24px 32px -8px rgba(0,0,0,0.06)"
            }}
          >
            {/* L'icône carrée élargie (w-11 h-11) */}
            <div className="w-11 h-11 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 flex items-center justify-center shrink-0">
                <Info className="w-6 h-6 text-[#3B82F6] dark:text-[#60A5FA] stroke-[2.5px]" />
            </div>
            
            {/* Espacement du texte */}
            <div className="grid gap-2 flex-1 pt-0.5">
              {title && <ToastTitle className="text-[15px] font-semibold text-[#111111] dark:text-[#EEEEEE] tracking-tight leading-none">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="text-[14px] font-medium text-[#666666] dark:text-[#A0A0A0] leading-snug">{description}</ToastDescription>
              )}
            </div>
            
            {action}
            
            {/* Bouton de fermeture repositionné */}
            <ToastClose className="absolute right-5 top-5 rounded-md p-1.5 text-[#111111]/30 dark:text-white/30 opacity-0 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-all focus:outline-none" />
          </Toast>
        )
      })}
      
      {/* Positionnement Viewport élargi */}
      <ToastViewport className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-4 p-8 w-full max-w-[480px] m-0 list-none outline-none pointer-events-none [&>li]:pointer-events-auto" />
    </ToastProvider>
  )
}
