// src/components/TelegramWidget.tsx
import React from "react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const WHATSAPP_CHANNEL_URL =
  "https://whatsapp.com/channel/0029Vb9DSDxAYlUE4HhmiN3b";

/**
 * Vrai logo officiel de WhatsApp (Bulle + Combiné téléphonique officiel)
 */
export function OfficialWhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M12.031 2C6.508 2 2.023 6.485 2.023 12.007c0 1.766.461 3.49 1.337 5.01L2 22l5.122-1.343a9.972 9.972 0 0 0 4.906 1.288h.004c5.522 0 10.007-4.485 10.007-10.007C22.039 6.485 17.554 2 12.031 2Zm5.823 14.128c-.246.694-1.432 1.327-1.996 1.411-.513.077-1.163.109-1.878-.118-.434-.138-.99-.322-1.703-.63-2.997-1.294-4.954-4.312-5.104-4.512-.149-.2-1.218-1.621-1.218-3.092 0-1.471.771-2.194 1.045-2.494.274-.3.597-.375.796-.375.199 0 .398.002.572.01.184.009.43-.07.672.513.249.599.846 2.069.92 2.219.075.15.125.324.025.524-.1.2-.15.324-.299.499-.149.175-.314.391-.448.524-.149.149-.304.311-.131.61.174.3.773 1.275 1.66 2.066 1.141 1.017 2.103 1.332 2.402 1.482.299.15.473.125.647-.075.175-.2.747-.872.946-1.172.199-.3.398-.249.672-.149.274.1 1.742.822 2.041.972.299.15.498.224.572.349.075.125.075.723-.171 1.417Z" />
    </svg>
  );
}

export interface WhatsAppWidgetProps {
  url?: string;
  variant?: "banner" | "card" | "compact";
  className?: string;
}

export function WhatsAppWidget({
  url = WHATSAPP_CHANNEL_URL,
  variant = "card",
  className,
}: WhatsAppWidgetProps) {
  if (variant === "compact") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "group inline-flex items-center gap-2.5 rounded-full border border-[#25D366]/35 bg-[#25D366]/12 hover:bg-[#128C7E] backdrop-blur-md px-4 py-2 text-[13px] font-semibold text-[#075E54] dark:text-[#25D366] hover:text-white transition-all duration-200 shadow-[0_2px_12px_-2px_rgba(37,211,102,0.18)]",
          className
        )}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#25D366] group-hover:bg-white" />
        </span>
        <OfficialWhatsAppLogo className="h-4 w-4 shrink-0" />
        <span>Rejoindre la Chaîne WhatsApp</span>
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group relative overflow-hidden block rounded-2xl border border-[#25D366]/30 bg-card/90 hover:border-[#25D366]/65 p-6 space-y-4 backdrop-blur-md shadow-[0_4px_24px_-6px_rgba(18,140,126,0.10)] hover:shadow-[0_12px_32px_-8px_rgba(37,211,102,0.22)] transition-all duration-300",
        className
      )}
    >
      {/* Touches de verre vertes (Glassmorphism WhatsApp) */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#25D366]/15 blur-2xl transition-all duration-300 group-hover:bg-[#25D366]/25" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-[#128C7E]/10 blur-xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15 border border-[#25D366]/35 text-[#128C7E] dark:text-[#25D366] group-hover:bg-[#25D366] group-hover:text-white shadow-sm transition-all duration-300">
            <OfficialWhatsAppLogo className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-[15px] font-semibold text-foreground group-hover:text-[#128C7E] dark:group-hover:text-[#25D366] transition-colors">
                Canal WhatsApp Officiel
              </h3>
              <CheckCircle2 className="h-3.5 w-3.5 text-[#25D366]" />
            </div>
            <span className="text-[11.5px] text-muted-foreground block">
              Diffusion directe • Relais mobile
            </span>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#25D366]/35 bg-[#25D366]/12 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#075E54] dark:text-[#25D366]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#25D366] animate-pulse" />
          En direct
        </span>
      </div>

      <p className="relative text-[13px] text-muted-foreground leading-relaxed">
        Pour être alerté immédiatement sur votre téléphone lorsqu'une mise à jour est déployée, qu'une maintenance ferme temporairement l'accès ou qu'un nouveau dossier QCM est publié, intégrez notre chaîne WhatsApp.
      </p>

      {/* Bouton effet verre vert WhatsApp */}
      <div className="relative pt-1">
        <div className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/12 group-hover:bg-[#128C7E] group-hover:border-[#128C7E] py-2.5 px-4 text-[13px] font-semibold text-[#075E54] dark:text-[#25D366] group-hover:text-white transition-all duration-200 shadow-sm">
          <OfficialWhatsAppLogo className="h-4 w-4" />
          <span>Rejoindre la Chaîne WhatsApp</span>
          <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </a>
  );
}

export const TelegramWidget = WhatsAppWidget;
export default WhatsAppWidget;
