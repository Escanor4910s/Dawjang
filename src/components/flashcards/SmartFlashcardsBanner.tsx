import React from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowUpRight, Shield } from "lucide-react";
import { DawJangLogo } from "@/components/DawJangLogo";

interface SmartFlashcardsBannerProps {
  totalDecksCount?: number;
}

export const SmartFlashcardsBanner: React.FC<SmartFlashcardsBannerProps> = ({
  totalDecksCount = 8,
}) => {
  const navigate = useNavigate();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate("/smart-flashcards")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate("/smart-flashcards");
        }
      }}
      className="group relative w-full rounded-2xl bg-gradient-to-r from-[#FBF9F5] via-[#F6EFE6] to-[#F0E5D8] dark:from-[#161412] dark:via-[#1C1916] dark:to-[#221D18] border border-[#E6DCD0] dark:border-[#2E2924] px-5 py-4 sm:px-6 sm:py-5 shadow-[0_2px_14px_rgba(24,24,27,0.04)] hover:shadow-[0_10px_28px_rgba(217,107,67,0.12)] hover:border-[#D96B43]/50 transition-all duration-300 cursor-pointer overflow-hidden select-none my-3"
    >
      {/* Halo lumineux correctement positionné en absolute (ne crée aucun espace vide) */}
      <div className="pointer-events-none absolute -right-10 -top-10 w-36 h-36 rounded-full bg-[#D96B43]/10 blur-2xl group-hover:bg-[#D96B43]/20 transition-all duration-500" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Partie Gauche : Vrai Logo DawJang + Texte */}
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <div className="relative shrink-0 flex items-center justify-center">
            <DawJangLogo className="w-11 h-11 sm:w-12 sm:h-12 text-[#18181B] dark:text-stone-100 group-hover:scale-105 transition-transform duration-300" />
            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-[#D96B43] text-white text-[9px] font-mono font-bold uppercase tracking-wider shadow-sm">
              IA
            </span>
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-[#D96B43]/15 text-[#C85A32] dark:text-[#E8845C]">
                ENTRAÎNEMENT ADAPTATIF • {totalDecksCount} MODALITÉS ACTIVES
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-stone-500 dark:text-stone-400">
                <Shield className="w-3 h-3 text-[#D96B43]" />
                Gestion des coups & Répétition FSRS
              </span>
            </div>

            <h3 className="font-serif text-lg sm:text-xl font-bold text-[#18181B] dark:text-stone-100 tracking-tight flex items-center gap-2">
              <span>Smart Flashcards Studio</span>
              <Sparkles className="w-4 h-4 text-[#D96B43] shrink-0 group-hover:rotate-12 transition-transform" />
            </h3>

            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-2xl">
              Transformez n'importe quel cours en cycle interactif : QCM, Classer par catégories (Glisser-Déposer), Cases à remplir, Vrai/Faux et Explications approfondies.
            </p>
          </div>
        </div>

        {/* Partie Droite : Pastilles des modalités + Bouton d'action */}
        <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-2.5 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-[#E6DCD0]/70 dark:border-stone-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            {["Classer A/B", "Choix en blanc", "QCM", "Vrai/Faux"].map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 rounded-md bg-white/90 dark:bg-stone-900/90 border border-[#E5DEC9] dark:border-stone-700 text-[11px] font-medium text-stone-700 dark:text-stone-300"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#18181B] dark:bg-stone-100 text-white dark:text-[#18181B] text-xs font-semibold group-hover:bg-[#D96B43] dark:group-hover:bg-[#D96B43] dark:group-hover:text-white transition-colors shadow-sm">
            <span>Ouvrir le Studio Smart</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartFlashcardsBanner;
