import React from "react";
import { motion } from "framer-motion";
import { BookOpen, Sparkles, PenTool, Play } from "lucide-react";

export type QcmTabId = "mes_qcm" | "generateur_ia" | "constructeur_manuel" | "session_active";

interface QcmHeaderProps {
  activeTab: QcmTabId;
  onSelectTab: (tab: QcmTabId) => void;
  qcmCount: number;
  hasActiveSession?: boolean;
}

export const QcmStudioHeader: React.FC<QcmHeaderProps> = ({
  activeTab,
  onSelectTab,
  qcmCount,
  hasActiveSession = false,
}) => {
  const tabs: Array<{
    id: QcmTabId;
    label: string;
    icon: React.ElementType;
    badge?: number;
    isLive?: boolean;
  }> = [
    {
      id: "mes_qcm",
      label: "Mes QCM",
      icon: BookOpen,
      badge: qcmCount,
    },
    {
      id: "generateur_ia",
      label: "Générateur IA",
      icon: Sparkles,
    },
    {
      id: "constructeur_manuel",
      label: "Manuel", // Nom court et percutant : élimine définitivement le retour à la ligne
      icon: PenTool,
    },
    ...(hasActiveSession
      ? [
          {
            id: "session_active" as QcmTabId,
            label: "Examen",
            icon: Play,
            isLive: true,
          },
        ]
      : []),
  ];

  return (
    <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-border/80">
      {/* BLOC GAUCHE : SOUS-TITRE ET TITRE SUR UNE SEULE LIGNE PROPRE */}
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          <span className="truncate">
            Studio docimologique • Classique, Censure, Groupage, Jumelage & Association
          </span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground whitespace-nowrap">
          Constructeur & Banque de QCM
        </h1>
      </div>

      {/* BLOC DROITE : SÉLECTEUR SEGMENTÉ STRICTEMENT SUR 1 SEULE LIGNE (w-fit + flex-nowrap) */}
      <nav
        aria-label="Navigation du Studio QCM"
        className="inline-flex flex-nowrap items-center gap-1 p-1.5 rounded-2xl bg-muted/80 border border-border/70 w-fit shrink-0 self-start lg:self-center"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`relative px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-2 shrink-0 ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {/* Pilule blanche animée au thème */}
              {isActive && (
                <motion.div
                  layoutId="qcmHeaderSingleLinePill"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-card shadow-sm border border-border/60"
                />
              )}

              <Icon
                className={`w-3.5 h-3.5 relative z-10 shrink-0 ${
                  isActive ? "text-primary" : ""
                }`}
              />

              <span className="relative z-10">{tab.label}</span>

              {/* Compteur élégant en badge pour "Mes QCM" */}
              {typeof tab.badge === "number" && (
                <span
                  className={`relative z-10 px-1.5 py-0.5 rounded-md text-[11px] font-bold leading-none ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "bg-background/80 text-muted-foreground"
                  }`}
                >
                  {tab.badge}
                </span>
              )}

              {/* Point lumineux si une session d'examen est en cours */}
              {tab.isLive && (
                <span className="relative z-10 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};

export default QcmStudioHeader;
