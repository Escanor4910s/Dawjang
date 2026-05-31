import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"
import { Check, X, AlertTriangle, Info, Loader2 } from "lucide-react"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        /* ─── NETTOYAGE ABSOLU ─── */
        [data-sonner-toast] {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          width: auto !important;
        }
        
        /* ─── LE RECTANGLE MASSIF (Échelle Supérieure) ─── */
        .perfect-rectangle-toast {
          position: relative;
          width: 440px !important; /* Largeur augmentée et majestueuse */
          padding: 24px !important; /* Padding respirant */
          border-radius: 20px !important; /* Courbure adaptée au grand format */
          display: flex !important;
          align-items: flex-start !important;
          gap: 20px !important; /* Gouttière élargie */
          
          /* Verre industriel clair */
          background: rgba(255, 255, 255, 0.85) !important;
          backdrop-filter: blur(24px) saturate(150%);
          -webkit-backdrop-filter: blur(24px) saturate(150%);
          border: 1px solid rgba(0, 0, 0, 0.06) !important;
          
          /* Ombrage physique multi-couches */
          box-shadow: 
            0 1px 2px rgba(0,0,0,0.02),
            0 8px 16px -4px rgba(0,0,0,0.04),
            0 24px 32px -8px rgba(0,0,0,0.06) !important;
            
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s ease !important;
        }

        /* Variante Mode Sombre */
        .dark .perfect-rectangle-toast {
          background: rgba(18, 18, 18, 0.85) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          box-shadow: 
            0 1px 2px rgba(0,0,0,0.1),
            0 10px 20px -5px rgba(0,0,0,0.2),
            0 30px 60px -10px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(255,255,255,0.03) !important;
        }

        /* Inertie physique au survol */
        .perfect-rectangle-toast:hover {
          transform: translateY(-2px) !important;
          box-shadow: 
            0 1px 2px rgba(0,0,0,0.02),
            0 12px 20px -4px rgba(0,0,0,0.05),
            0 32px 48px -8px rgba(0,0,0,0.08) !important;
        }
        .dark .perfect-rectangle-toast:hover {
          box-shadow: 
            0 1px 2px rgba(0,0,0,0.1),
            0 15px 30px -5px rgba(0,0,0,0.3),
            0 40px 80px -10px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.04) !important;
        }

        /* Conteneur de texte */
        .rect-content {
          display: flex;
          flex-direction: column;
          gap: 8px; /* Espacement vertical augmenté */
          flex: 1;
        }
      `}} />
      
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        position="top-center" 
        expand={true}         
        gap={16}
        offset={32}
        toastOptions={{
          classNames: {
            toast: "perfect-rectangle-toast group",
            content: "rect-content",
            // Typographie mise à l'échelle
            title: "text-[15px] font-semibold text-[#111111] dark:text-[#EEEEEE] tracking-tight leading-none",
            description: "text-[14px] font-medium text-[#666666] dark:text-[#A0A0A0] leading-snug",
            actionButton: "bg-[#111111] dark:bg-white text-white dark:text-[#111111] font-bold text-[12px] rounded-lg px-5 py-2.5 mt-3 self-start transition-opacity hover:opacity-80 shadow-sm",
            cancelButton: "bg-black/5 dark:bg-white/5 text-[#111111] dark:text-white font-bold text-[12px] rounded-lg px-5 py-2.5 mt-3 self-start hover:bg-black/10 dark:hover:bg-white/10 transition-colors",
          },
        }}
        // ─── ICÔNES ARCHITECTURALES AGRANDIES (w-11 h-11) ───
        icons={{
          success: (
            <div className="w-11 h-11 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 flex items-center justify-center shrink-0">
              <Check className="w-6 h-6 text-[#10B981] stroke-[2.5px]" />
            </div>
          ),
          error: (
            <div className="w-11 h-11 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 flex items-center justify-center shrink-0">
              <X className="w-6 h-6 text-[#E11D48] stroke-[2.5px]" />
            </div>
          ),
          info: (
            <div className="w-11 h-11 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 flex items-center justify-center shrink-0">
              <Info className="w-6 h-6 text-[#3B82F6] stroke-[2.5px]" />
            </div>
          ),
          warning: (
            <div className="w-11 h-11 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-[#F59E0B] stroke-[2.5px]" />
            </div>
          ),
          loading: (
            <div className="w-11 h-11 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 flex items-center justify-center shrink-0">
              <Loader2 className="w-6 h-6 text-[#6B7280] dark:text-[#9CA3AF] animate-spin stroke-[2.5px]" />
            </div>
          ),
        }}
        {...props}
      />
    </>
  )
}

export { Toaster, toast }
