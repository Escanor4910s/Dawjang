// src/components/gamification/GamificationProvider.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  useGamification,
  grantDawJangXP,
  DAWJANG_XP_REWARDS,
  XpGainEventDetail,
} from "@/hooks/useGamification";
import { Sparkles, Trophy } from "lucide-react";

const GamificationContext = createContext<ReturnType<typeof useGamification> | null>(
  null
);

let storagePatchInstalled = false;

/**
 * Installe un capteur automatique sur localStorage.setItem pour détecter
 * toute sauvegarde de résumé, de cours, de QCM, de flashcard ou de duel
 */
function installAutomaticStorageXpWatcher() {
  if (storagePatchInstalled || typeof window === "undefined") return;
  storagePatchInstalled = true;

  const originalSetItem = window.localStorage.setItem.bind(window.localStorage);

  window.localStorage.setItem = function (key: string, value: string) {
    const prevValue = window.localStorage.getItem(key);
    originalSetItem(key, value);

    if (prevValue === value) return;

    try {
      // 1. Enregistrement d'une fiche de résumé dans Le Rédacteur
      if (key.startsWith("hippocampus_clean_summaries")) {
        grantDawJangXP(
          DAWJANG_XP_REWARDS.SUMMARY_SAVED,
          "Fiche de résumé enregistrée",
          "summary"
        );
      }
      // 2. Importation d'un cours dans la Bibliothèque
      else if (key.startsWith("hippocampus_courses_library")) {
        const prevLen = prevValue ? JSON.parse(prevValue).length : 0;
        const nextLen = JSON.parse(value).length;
        if (nextLen > prevLen) {
          const addedCount = Math.max(1, nextLen - prevLen);
          grantDawJangXP(
            addedCount * DAWJANG_XP_REWARDS.COURSE_UPLOADED,
            `${addedCount} cours importé(s)`,
            "course"
          );
        }
      }
      // 3. Création ou génération d'une banque de QCM
      else if (key.startsWith("hippocampus_saved_quizzes")) {
        const prevLen = prevValue ? JSON.parse(prevValue).length : 0;
        const nextLen = JSON.parse(value).length;
        if (nextLen > prevLen) {
          grantDawJangXP(
            DAWJANG_XP_REWARDS.QCM_CREATED,
            "Nouvelle banque de QCM créée",
            "qcm"
          );
        }
      }
      // 4. Création, révision ou ancrage d'une Flashcard
      else if (
        key.includes("flashcard") &&
        !key.includes("custom_nodes")
      ) {
        grantDawJangXP(
          DAWJANG_XP_REWARDS.FLASHCARD_REVIEWED,
          "Progression Flashcards",
          "flashcard"
        );
      }
      // 5. Fin d'un Duel en ligne
      else if (key === "hippocampus_real_duel_stats_v1") {
        grantDawJangXP(
          DAWJANG_XP_REWARDS.DUEL_VICTORY,
          "Duel en arène accompli",
          "duel"
        );
      }
    } catch {
      // Ignorer les erreurs de parsing JSON
    }
  };
}

export function GamificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const gamification = useGamification();
  const [floatingChip, setFloatingChip] = useState<XpGainEventDetail | null>(
    null
  );

  // Installation des capteurs automatiques d'actions (Clics sur boutons clés, Toasts & Storage)
  useEffect(() => {
    installAutomaticStorageXpWatcher();

    // Capteur sur les clics de validation d'étude (Flashcards, QCM, Examens, Résumés, Duels)
    const handleGlobalStudyClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest("button");
      if (!btn || (btn as HTMLButtonElement).disabled) return;

      const text = (btn.innerText || btn.getAttribute("title") || "")
        .trim()
        .toLowerCase();

      // Évaluation d'une Flashcard (À revoir / Moyen / Bien / Facile / Ancré / Maîtrisé)
      if (
        /^(à revoir|difficile|moyen|bien|facile|ancré|maîtrisé|suivante|carte suivante)$/i.test(
          text
        ) ||
        text.includes("ancrer") ||
        text.includes("mémoriser en flashcard")
      ) {
        grantDawJangXP(
          DAWJANG_XP_REWARDS.FLASHCARD_REVIEWED,
          "Flashcard révisée",
          "flashcard"
        );
      }
      // Génération d'un résumé ou passage au Rédacteur
      else if (
        text.includes("générer le résumé") ||
        text.includes("passer à l'étape suivante")
      ) {
        grantDawJangXP(
          DAWJANG_XP_REWARDS.SUMMARY_GENERATED,
          "Synthèse IA générée",
          "summary"
        );
      }
      // Validation d'une question QCM ou Mode Infini
      else if (
        text.includes("valider ma réponse") ||
        text.includes("valider & suivant") ||
        text.includes("vérifier la réponse")
      ) {
        grantDawJangXP(
          DAWJANG_XP_REWARDS.QCM_QUESTION_ANSWERED,
          "Question QCM traitée",
          "qcm"
        );
      }
      // Fin d'une épreuve en Mode Examen
      else if (
        text.includes("remettre ma copie") ||
        text.includes("terminer et corriger l'épreuve") ||
        text.includes("terminer l'examen")
      ) {
        grantDawJangXP(
          DAWJANG_XP_REWARDS.EXAM_COMPLETED,
          "Épreuve blanche terminée",
          "exam"
        );
      }
      // Manche ou Podium en Duel
      else if (
        text.includes("manche suivante") ||
        text.includes("round suivant") ||
        text.includes("afficher le verdict") ||
        text.includes("afficher le podium")
      ) {
        grantDawJangXP(
          DAWJANG_XP_REWARDS.DUEL_ROUND_HIT,
          "Manche de Duel validée",
          "duel"
        );
      }
    };

    window.addEventListener("click", handleGlobalStudyClick, true);
    return () =>
      window.removeEventListener("click", handleGlobalStudyClick, true);
  }, []);

  // Affichage de la pilule flottante "+XX XP" à chaque gain d'expérience
  useEffect(() => {
    const handleXpEarned = (e: Event) => {
      const custom = e as CustomEvent<XpGainEventDetail>;
      if (custom.detail) {
        setFloatingChip(custom.detail);
      }
    };

    window.addEventListener("dawjang-xp-earned", handleXpEarned);
    return () =>
      window.removeEventListener("dawjang-xp-earned", handleXpEarned);
  }, []);

  useEffect(() => {
    if (!floatingChip) return;
    const timer = setTimeout(() => setFloatingChip(null), 3200);
    return () => clearTimeout(timer);
  }, [floatingChip]);

  return (
    <GamificationContext.Provider value={gamification}>
      {children}

      {/* PILULE LUMINEUSE FLOTTANTE D'ATTRIBUTION D'XP EN TEMPS RÉEL */}
      {floatingChip && (
        <div className="pointer-events-none fixed top-5 right-5 z-[110] flex items-center gap-3 rounded-2xl border border-primary/45 bg-card/95 backdrop-blur-xl px-4 py-2.5 shadow-[0_14px_34px_-8px_rgba(201,100,66,0.32)] animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            {floatingChip.leveledUp ? (
              <Trophy className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] font-bold text-primary">
                +{floatingChip.amount} XP
              </span>
              <span className="rounded-md bg-secondary px-1.5 py-[1px] font-mono text-[10px] font-bold text-foreground">
                LV.{floatingChip.newStats.level}
              </span>
            </div>
            <p className="text-[11.5px] font-medium text-muted-foreground leading-tight">
              {floatingChip.reason} ({floatingChip.newStats.xp} /{" "}
              {floatingChip.newStats.nextLevelXp} XP)
            </p>
          </div>
        </div>
      )}
    </GamificationContext.Provider>
  );
}

export function useGamificationContext() {
  const ctx = useContext(GamificationContext);
  const fallback = useGamification();
  return ctx || fallback;
}

export default GamificationProvider;
