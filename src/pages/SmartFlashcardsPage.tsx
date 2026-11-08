import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  X,
  Settings,
  Flag,
  Check,
  AlertCircle,
  XCircle,
  Sparkles,
  Flame,
  Plus,
  Minus,
  ChevronRight,
  ChevronDown,
  Repeat,
  Keyboard,
  Send,
  FolderOpen,
  RotateCcw,
  Frown,
  Meh,
  Smile,
  Laugh,
  Shield,
  Upload,
  Sliders,
  Trophy,
  LayoutDashboard,
  Layers,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  RefreshCw,
  Library,
  Trash2,
  Play,
} from "lucide-react";
import { useFileReader } from "@/hooks/useFileReader";
import { useToast } from "@/hooks/use-toast";
import { DawJangLogo } from "@/components/DawJangLogo";
import { generateSmartFlashcards } from "@/lib/flashcards/smartAiGenerator";
import { getSavedCourses, type StoredCourse } from "@/pages/Library";
import {
  SmartFlashcard,
  SmartFlashcardConfig,
  SmartQuestionModality,
  SmartEvalState,
  SmartDeckLibraryEntry,
  SmartLibraryManager,
  DEFAULT_SMART_CONFIG,
  MODALITY_METADATA,
  ENZYMOPATHIES_SMART_DECK,
  normalizeSmartDeck,
} from "@/types/smartFlashcards";

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function seededShuffle<T>(items: T[], seedStr: string): T[] {
  const arr = [...items];
  let seed = hashSeed(seedStr) || 1234567;
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Dérangement mathématique strict : garantit qu'aucun élément de la colonne de droite
 * ne se trouve en face de son homologue de la colonne de gauche (jamais A-1, B-2, C-3).
 */
function derangeRightColumn<T extends { id: string }>(
  leftItems: T[],
  seedStr: string
): T[] {
  if (leftItems.length <= 1) return [...leftItems];
  const n = leftItems.length;
  const shift = (hashSeed(seedStr) % (n - 1)) + 1; // 1 .. n-1
  return leftItems.map((_, idx) => leftItems[(idx + shift) % n]);
}

// ============================================================================
// SYNTHÉTISEUR AUDIO WEB
// ============================================================================
const triggerSound = (
  type: "correct" | "partial" | "lose_move" | "incorrect" | "click",
  enabled: boolean
) => {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === "correct") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.22);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.start(now);
      osc.stop(now + 0.32);
    } else if (type === "lose_move" || type === "partial") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.setValueAtTime(310, now + 0.14);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.start(now);
      osc.stop(now + 0.26);
    } else if (type === "incorrect") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.linearRampToValueAtTime(150, now + 0.26);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(580, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch {
    // Ignore audio lock
  }
};

// ============================================================================
// EMBLÈME FLOTTANT DAWJANG + JAUGE DE COUPS & NIVEAU COGNITIF
// ============================================================================
const FloatingDawJangEmblem: React.FC<{
  status: SmartEvalState;
  movesLeft: number;
  maxMoves: number;
  activeTier: 1 | 2 | 3;
}> = ({ status, movesLeft, maxMoves, activeTier }) => {
  const ringStyle = {
    idle: "border-[#E6DCD0] dark:border-stone-700 shadow-[0_10px_28px_rgba(24,24,27,0.08)]",
    correct: "border-emerald-500 shadow-[0_10px_30px_rgba(16,185,129,0.28)] scale-105",
    partial: "border-amber-500 shadow-[0_10px_30px_rgba(245,158,11,0.28)]",
    incorrect: "border-rose-500 shadow-[0_10px_30px_rgba(244,63,94,0.28)]",
  }[status];

  const badgeDotColor = {
    idle: "bg-[#D96B43]",
    correct: "bg-emerald-500",
    partial: "bg-amber-500",
    incorrect: "bg-rose-500",
  }[status];

  const tierLabel = {
    1: "Niv. 1 • Mécanismes",
    2: "Niv. 2 • Clinique & Analyse",
    3: "Niv. 3 • Expert & Pièges",
  }[activeTier];

  return (
    <div className="flex flex-col items-center justify-center mb-5 select-none">
      <div className="relative flex items-center justify-center">
        <div
          className={`w-16 h-16 rounded-2xl bg-white dark:bg-[#1C1917] border-2 ${ringStyle} p-2.5 flex items-center justify-center text-[#18181B] dark:text-stone-100 transition-all duration-500 animate-bounce`}
          style={{ animationDuration: "3.4s" }}
        >
          <DawJangLogo className="w-full h-full text-[#D96B43]" />
          <span
            className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-stone-900 ${badgeDotColor}`}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap justify-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-[#1C1917] border border-[#E6DCD0] dark:border-stone-800 text-[11px] font-mono font-semibold text-stone-700 dark:text-stone-300 shadow-sm">
          <Shield className="w-3 h-3 text-[#D96B43]" />
          <span>
            Coups :{" "}
            <strong className="text-[#18181B] dark:text-white">
              {movesLeft}/{maxMoves}
            </strong>
          </span>
        </div>

        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#D96B43]/15 text-[#C85A32] dark:text-[#E8845C] text-[10px] font-mono font-bold">
          <TrendingUp className="w-3 h-3" />
          <span>{tierLabel}</span>
        </div>
      </div>
    </div>
  );
};

interface SessionResultLog {
  cardId: string;
  courseSection: string;
  prompt: string;
  modality: SmartQuestionModality;
  status: "correct" | "partial" | "incorrect";
  movesUsed: number;
}

// ============================================================================
// COMPOSANT PRINCIPAL : SMART FLASHCARDS PAGE
// ============================================================================
export const SmartFlashcardsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId: routeCourseId } = useParams<{ courseId?: string }>();
  const { toast } = useToast();
  const { readFile, isReading } = useFileReader();

  const returnPath = (location.state as any)?.from || "/flashcards";

  // 4 Vues : "builder" par défaut à l'ouverture, ou "arena" si un cours précis est lancé
  const [viewMode, setViewMode] = useState<"arena" | "summary" | "library" | "builder">(() =>
    routeCourseId ? "arena" : "builder"
  );

  // Bibliothèque Smart Flashcards persistée + Cours de la Bibliothèque générale
  const [libraryDecks, setLibraryDecks] = useState<SmartDeckLibraryEntry[]>(() =>
    SmartLibraryManager.getAllDecks()
  );
  const [activeDeckEntry, setActiveDeckEntry] = useState<SmartDeckLibraryEntry>(() =>
    SmartLibraryManager.getAllDecks()[0]
  );
  const [savedLibraryCourses, setSavedLibraryCourses] = useState<StoredCourse[]>(() =>
    getSavedCourses()
  );

  const [courseText, setCourseText] = useState<string>("");
  const [newCourseTitle, setNewCourseTitle] = useState<string>("");
  const [detectedObjectives, setDetectedObjectives] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Configuration et Modales
  const [config, setConfig] = useState<SmartFlashcardConfig>(DEFAULT_SMART_CONFIG);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isModalitiesExpanded, setIsModalitiesExpanded] = useState<boolean>(true);
  const [showSwapTooltip, setShowSwapTooltip] = useState<boolean>(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>("");

  const [isExitModalOpen, setIsExitModalOpen] = useState<boolean>(false);
  const [dontShowExitAgain, setDontShowExitAgain] = useState<boolean>(() => {
    return localStorage.getItem("dawjang_skip_smart_exit_modal") === "true";
  });

  // États de la session active et du Bilan
  const [sessionVersion, setSessionVersion] = useState<number>(0);
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [sessionLogs, setSessionLogs] = useState<SessionResultLog[]>([]);
  const [movesLeft, setMovesLeft] = useState<number>(DEFAULT_SMART_CONFIG.maxMovesPerCard);
  const [movesUsed, setMovesUsed] = useState<number>(0);
  const [evalState, setEvalState] = useState<SmartEvalState>("idle");
  const [attemptFeedback, setAttemptFeedback] = useState<string | null>(null);
  const [showDeepDive, setShowDeepDive] = useState<boolean>(false);
  const [streakDays, setStreakDays] = useState<number>(1);

  // États des 8 modalités (avec support multi-sélection et multi-blanks)
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [pickedMcqIds, setPickedMcqIds] = useState<string[]>([]);
  const [pickedTF, setPickedTF] = useState<boolean | null>(null);
  const [pickedWordBank, setPickedWordBank] = useState<string | null>(null);
  const [pickedSecondWordBank, setPickedSecondWordBank] = useState<string | null>(null);
  const [wrongWordBankTries, setWrongWordBankTries] = useState<string[]>([]);
  const [fillBlankText, setFillBlankText] = useState<string>("");
  const [fillSecondBlankText, setFillSecondBlankText] = useState<string>("");
  const [openAnswerText, setOpenAnswerText] = useState<string>("");

  // États pour Classer (Glisser-Déposer + Croix ×) & Correspondance
  const [selectedCatItemId, setSelectedCatItemId] = useState<string | null>(null);
  const [draggedCatItemId, setDraggedCatItemId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<"A" | "B" | "tray" | null>(null);
  const [catPlacements, setCatPlacements] = useState<Record<string, "A" | "B">>({});
  const [selectedLeftPairId, setSelectedLeftPairId] = useState<string | null>(null);
  const [matchedMap, setMatchedMap] = useState<Record<string, string>>({});

  // Chat de suivi & Tags
  const [followUpInput, setFollowUpInput] = useState<string>("");
  const [followUpThread, setFollowUpThread] = useState<{ sender: "user" | "ai"; text: string }[]>([]);
  const [isAddingTag, setIsAddingTag] = useState<boolean>(false);
  const [tagDraft, setTagDraft] = useState<string>("");

  // File de questions avec Rotation Polymorphe des formes et Escalade de niveau
  const activeQueue = useMemo(() => {
    return SmartLibraryManager.buildRotatedQueue(activeDeckEntry, config);
  }, [activeDeckEntry, config, sessionVersion]);

  const currentStep = activeQueue[stepIdx] || activeQueue[0];
  const currentCard = currentStep.card;
  const currentModality = currentStep.modality;
  const activeTier = currentStep.activeTier;
  const effectivePrompt = currentStep.effectivePrompt;

  const stepSeed = `${currentCard.id}-step-${stepIdx}-v-${sessionVersion}-s-${activeDeckEntry.sessionsCompleted}`;

  // 1. CLASSER (CATEGORIZE) : Mélange aléatoire Fisher-Yates des 4 items pour briser toute monotonie
  const shuffledCategorizeItems = useMemo(() => {
    return seededShuffle(currentCard.categorize.items, `cat-${stepSeed}`);
  }, [currentCard, stepSeed]);

  // 2. CORRESPONDANCE (MATCHING) : Colonne gauche mélangée + Colonne droite en DÉRANGEMENT STRICT (jamais A-1, B-2, C-3)
  const derangedMatching = useMemo(() => {
    const leftPairs = seededShuffle(currentCard.matching.pairs, `match-left-${stepSeed}`);
    const rightPairs = derangeRightColumn(leftPairs, `match-right-${stepSeed}`);
    return { leftPairs, rightPairs };
  }, [currentCard, stepSeed]);

  // 3. CHOIX MULTIPLE & CENSURE MULTI-PROPOSITIONS (1, 2 ou 3 bonnes réponses + alternance EXACTE(S) / FAUSSE(S))
  const activeMcqChallenge = useMemo(() => {
    const seedVal = hashSeed(`mcq-${stepSeed}`);
    const isCensure = seedVal % 3 === 1; // ~1/3 en mode Censure (cocher les fausses), ~2/3 en mode Exactes
    const desiredTrueCount = (seedVal % 3) + 1; // 1, 2 ou 3 propositions vraies parmi 4

    const baseOpts = currentCard.mcq.options;
    const truePool: string[] = baseOpts.filter((o) => o.isCorrect).map((o) => o.text);
    const falsePool: string[] = baseOpts.filter((o) => !o.isCorrect).map((o) => o.text);

    // Enrichit le réservoir de propositions vraies/fausses depuis la carte et le paquet pour varier le nombre de réponses justes (1, 2 ou 3)
    if (currentCard.deepDive?.expectedSummary) {
      truePool.push(currentCard.deepDive.expectedSummary);
    }
    if (currentCard.trueFalse?.statement) {
      if (currentCard.trueFalse.isTrue) {
        truePool.push(currentCard.trueFalse.statement);
      } else {
        falsePool.push(currentCard.trueFalse.statement);
      }
    }
    for (const pair of currentCard.matching.pairs) {
      truePool.push(`${pair.left} : ${pair.right}.`);
    }

    const uniqTrue = Array.from(new Set(truePool)).filter((t) => t.trim().length > 10);
    const uniqFalse = Array.from(new Set(falsePool)).filter((t) => t.trim().length > 10);

    const targetTrue = Math.min(desiredTrueCount, uniqTrue.length, Math.max(1, 4 - Math.min(1, uniqFalse.length)));
    const pickedTrues = seededShuffle(uniqTrue, `mcq-t-${stepSeed}`).slice(0, targetTrue);
    const pickedFalses = seededShuffle(uniqFalse, `mcq-f-${stepSeed}`).slice(0, 4 - pickedTrues.length);

    const combined = seededShuffle(
      [
        ...pickedTrues.map((text) => ({ text, isStatementTrue: true })),
        ...pickedFalses.map((text) => ({ text, isStatementTrue: false })),
      ],
      `mcq-comb-${stepSeed}`
    ).slice(0, 4);

    const letters: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
    const options = combined.map((item, idx) => ({
      id: letters[idx],
      text: item.text,
      isStatementTrue: item.isStatementTrue,
      // En mode Censure, l'étudiant doit cocher les propositions FAUSSES ; sinon les propositions EXACTES
      shouldBeChecked: isCensure ? !item.isStatementTrue : item.isStatementTrue,
    }));

    // Garantie d'au moins 1 case à cocher
    if (!options.some((o) => o.shouldBeChecked) && options.length > 0) {
      options[0].shouldBeChecked = true;
    }

    const targetIds = options.filter((o) => o.shouldBeChecked).map((o) => o.id);

    return {
      isCensure,
      instructionBadge: isCensure
        ? "CENSURE • Cochez la ou les proposition(s) FAUSSE(S)"
        : "CHOIX MULTIPLE • Cochez la ou les proposition(s) EXACTE(S)",
      questionText: activeTier > 1 ? effectivePrompt : currentCard.mcq.question,
      options,
      targetIds,
    };
  }, [currentCard, stepSeed, activeTier, effectivePrompt]);

  // 4. CHOIX EN BLANC & REMPLIR LE VIDE : Mélange des choix + Alternance 1 case vs 2 cases à remplir
  const activeClozeChallenge = useMemo(() => {
    const secondKeyword = (currentCard.keywords || []).find(
      (kw) =>
        kw.trim().length >= 3 &&
        kw.trim().toLowerCase() !== (currentCard.cloze.missingTerm || "").trim().toLowerCase() &&
        (currentCard.cloze.sentenceAfter || "").toLowerCase().includes(kw.trim().toLowerCase())
    );

    const useDualBlank = Boolean(secondKeyword) && hashSeed(`cloze-dual-${stepSeed}`) % 2 === 0;
    let sentenceAfterFirst = currentCard.cloze.sentenceAfter;
    let sentenceAfterSecond = "";
    let secondMissingTerm: string | null = null;

    if (useDualBlank && secondKeyword) {
      const sAfter = String(sentenceAfterFirst || "");
      const sKeyword = String(secondKeyword || "");
      const idx = sAfter.toLowerCase().indexOf(sKeyword.toLowerCase());
      if (idx >= 0) {
        secondMissingTerm = sAfter.slice(idx, idx + sKeyword.length);
        sentenceAfterSecond = sAfter.slice(idx + sKeyword.length);
        sentenceAfterFirst = sAfter.slice(0, idx);
      }
    }

    const rawPool = [
      currentCard.cloze.missingTerm,
      ...(secondMissingTerm ? [secondMissingTerm] : []),
      ...currentCard.cloze.distractors.slice(0, 3),
    ];
    const choices = seededShuffle(Array.from(new Set(rawPool)), `wb-${stepSeed}`);

    return {
      hasSecondBlank: Boolean(secondMissingTerm),
      firstMissingTerm: currentCard.cloze.missingTerm,
      secondMissingTerm,
      sentenceBefore: currentCard.cloze.sentenceBefore,
      sentenceMiddle: sentenceAfterFirst,
      sentenceAfter: sentenceAfterSecond,
      choices,
    };
  }, [currentCard, stepSeed]);

  const wordBankChoices = activeClozeChallenge.choices;

  // 5. VRAI OU FAUX : Alternance de polarité et de formulation entre les sessions
  const activeTrueFalseChallenge = useMemo(() => {
    const flipPolarity = (stepIdx + sessionVersion + activeDeckEntry.sessionsCompleted) % 2 === 1;
    if (!flipPolarity) {
      return currentCard.trueFalse;
    }
    // Variante alternative issue du résumé exact de la carte pour éviter de répéter le même énoncé
    if (currentCard.deepDive?.expectedSummary && currentCard.deepDive.expectedSummary.length > 20) {
      return {
        statement: currentCard.deepDive.expectedSummary,
        isTrue: true,
      };
    }
    return currentCard.trueFalse;
  }, [currentCard, stepIdx, sessionVersion, activeDeckEntry.sessionsCompleted]);

  const resetCardInteraction = useCallback(() => {
    setMovesLeft(config.maxMovesPerCard);
    setMovesUsed(0);
    setEvalState("idle");
    setAttemptFeedback(null);
    setShowDeepDive(false);
    setIsFlipped(false);
    setPickedMcqIds([]);
    setPickedTF(null);
    setPickedWordBank(null);
    setPickedSecondWordBank(null);
    setWrongWordBankTries([]);
    setFillBlankText("");
    setFillSecondBlankText("");
    setOpenAnswerText("");
    setSelectedCatItemId(null);
    setDraggedCatItemId(null);
    setDragOverZone(null);
    setCatPlacements({});
    setSelectedLeftPairId(null);
    setMatchedMap({});
    setFollowUpThread([]);
    setFollowUpInput("");
  }, [config.maxMovesPerCard]);

  // Enregistre l'historique de la carte dans la Bibliothèque Smart (forme posée + nouveau palier de difficulté)
  const recordCardMemoryAndLog = useCallback(
    (finalStatus: "correct" | "partial" | "incorrect", movesTaken: number) => {
      // 1. Journal de la session courante pour l'écran de Bilan
      setSessionLogs((prev) => {
        const filtered = prev.filter((l) => l.cardId !== currentCard.id);
        return [
          ...filtered,
          {
            cardId: currentCard.id,
            courseSection: currentCard.courseSection,
            prompt: effectivePrompt,
            modality: currentModality,
            status: finalStatus,
            movesUsed: movesTaken,
          },
        ];
      });

      // 2. Mise à jour de la mémoire adaptative du paquet dans la Bibliothèque
      const existingMem = activeDeckEntry.memory[currentCard.id] || {
        cardId: currentCard.id,
        usedModalities: [],
        currentDifficultyTier: currentCard.difficulty,
        timesCorrect: 0,
        timesFailed: 0,
        lastAnsweredAt: Date.now(),
      };

      const nextModalities = existingMem.usedModalities.includes(currentModality)
        ? existingMem.usedModalities
        : [...existingMem.usedModalities, currentModality];

      const nextTier: 1 | 2 | 3 =
        finalStatus === "correct"
          ? (Math.min(3, existingMem.currentDifficultyTier + 1) as 1 | 2 | 3)
          : existingMem.currentDifficultyTier;

      const updatedDeck: SmartDeckLibraryEntry = {
        ...activeDeckEntry,
        lastStudiedAt: Date.now(),
        memory: {
          ...activeDeckEntry.memory,
          [currentCard.id]: {
            ...existingMem,
            usedModalities: nextModalities,
            currentDifficultyTier: nextTier,
            timesCorrect:
              existingMem.timesCorrect + (finalStatus === "correct" ? 1 : 0),
            timesFailed:
              existingMem.timesFailed + (finalStatus === "incorrect" ? 1 : 0),
            lastAnsweredAt: Date.now(),
          },
        },
      };

      setActiveDeckEntry(updatedDeck);
      SmartLibraryManager.saveDeck(updatedDeck);
      setLibraryDecks(SmartLibraryManager.getAllDecks());
    },
    [activeDeckEntry, currentCard, currentModality, effectivePrompt]
  );

  // Passage à la carte suivante OU ouverture de l'écran de BILAN DE FIN DE SESSION
  const handleContinue = useCallback(() => {
    triggerSound("click", config.soundEffects);
    if (stepIdx + 1 < activeQueue.length) {
      setStepIdx((i) => i + 1);
      resetCardInteraction();
    } else {
      // Fin de la session -> Sauvegarder le compteur de sessions et ouvrir le BILAN
      const totalCards = activeQueue.length;
      const correctCards = sessionLogs.filter((l) => l.status === "correct").length;
      const masteryScore =
        totalCards > 0 ? Math.round((correctCards / totalCards) * 100) : 85;

      const completedDeck: SmartDeckLibraryEntry = {
        ...activeDeckEntry,
        lastStudiedAt: Date.now(),
        sessionsCompleted: activeDeckEntry.sessionsCompleted + 1,
        averageMastery: masteryScore,
      };
      setActiveDeckEntry(completedDeck);
      SmartLibraryManager.saveDeck(completedDeck);
      setLibraryDecks(SmartLibraryManager.getAllDecks());
      setStreakDays((d) => d + 1);

      // Basculer sur l'écran de Bilan de fin de session
      setViewMode("summary");
    }
  }, [
    stepIdx,
    activeQueue.length,
    resetCardInteraction,
    config.soundEffects,
    sessionLogs,
    activeDeckEntry,
  ]);

  // Relancer une nouvelle session évolutive (Formes permutées + Difficulté +1)
  const handleStartEvolvedSession = (deckToRun = activeDeckEntry) => {
    setActiveDeckEntry(deckToRun);
    setSessionVersion((v) => v + 1);
    setStepIdx(0);
    setSessionLogs([]);
    resetCardInteraction();
    setViewMode("arena");
    toast({
      title: `Session #${deckToRun.sessionsCompleted + 1} lancée`,
      description:
        "Les questions ont changé de forme et le niveau de difficulté a été augmenté.",
    });
  };

  // Sortie réelle de la page
  const handleConfirmExitPage = useCallback(() => {
    if (dontShowExitAgain) {
      localStorage.setItem("dawjang_skip_smart_exit_modal", "true");
    }
    setIsExitModalOpen(false);
    navigate(returnPath);
  }, [dontShowExitAgain, navigate, returnPath]);

  // ============================================================================
  // GESTION DES COUPS (ESSAIS) PAR CARTE
  // ============================================================================
  const registerWrongMove = (hint: string) => {
    const nextMoves = movesLeft - 1;
    const usedNow = movesUsed + 1;
    setMovesLeft(nextMoves);
    setMovesUsed(usedNow);

    if (nextMoves > 0) {
      triggerSound("lose_move", config.soundEffects);
      setAttemptFeedback(
        `Coup manqué — Il te reste ${nextMoves} coup${nextMoves > 1 ? "s" : ""} (${hint}).`
      );
    } else {
      triggerSound("incorrect", config.soundEffects);
      setAttemptFeedback(null);
      setEvalState("incorrect");
      recordCardMemoryAndLog("incorrect", usedNow);
    }
  };

  const registerSuccessMove = (isPartial = false) => {
    const usedNow = movesUsed + 1;
    setMovesUsed(usedNow);
    setAttemptFeedback(null);
    const st: SmartEvalState = isPartial || movesUsed > 0 ? "partial" : "correct";
    setEvalState(st);
    triggerSound(st, config.soundEffects);
    recordCardMemoryAndLog(st, usedNow);
  };

  // ============================================================================
  // INTERACTIONS DES 8 MODALITÉS
  // ============================================================================
  const handlePlaceItemInCategory = (itemId: string, cat: "A" | "B") => {
    if (evalState !== "idle") return;
    triggerSound("click", config.soundEffects);

    const updated = { ...catPlacements, [itemId]: cat };
    setCatPlacements(updated);
    setSelectedCatItemId(null);
    setDraggedCatItemId(null);
    setDragOverZone(null);

    const items = currentCard.categorize.items;
    if (Object.keys(updated).length === items.length) {
      const rightCount = items.filter((it) => updated[it.id] === it.target).length;
      if (rightCount === items.length) {
        registerSuccessMove(movesUsed > 0);
      } else {
        const remaining = movesLeft - 1;
        const usedNow = movesUsed + 1;
        setMovesLeft(remaining);
        setMovesUsed(usedNow);

        if (remaining > 0) {
          triggerSound("lose_move", config.soundEffects);
          setAttemptFeedback(
            `${rightCount}/${items.length} éléments bien classés. Il te reste ${remaining} coup : retire l'élément erroné avec la croix (×) pour corriger !`
          );
        } else {
          const finalSt: "partial" | "incorrect" =
            rightCount >= Math.ceil(items.length / 2) ? "partial" : "incorrect";
          setEvalState(finalSt);
          setAttemptFeedback(null);
          triggerSound(finalSt, config.soundEffects);
          recordCardMemoryAndLog(finalSt, usedNow);
        }
      }
    }
  };

  const handleRemoveItemFromCategory = (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (evalState !== "idle") return;
    triggerSound("click", config.soundEffects);
    setCatPlacements((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  const handleMcqToggle = (optId: "A" | "B" | "C" | "D") => {
    if (evalState !== "idle") return;
    triggerSound("click", config.soundEffects);
    setPickedMcqIds((prev) =>
      prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
    );
  };

  const handleValidateMcqSelection = useCallback(() => {
    if (evalState !== "idle" || pickedMcqIds.length === 0) return;
    const expected = [...activeMcqChallenge.targetIds].sort();
    const chosen = [...pickedMcqIds].sort();
    const isExactMatch =
      expected.length === chosen.length && expected.every((id, i) => id === chosen[i]);

    if (isExactMatch) {
      registerSuccessMove(movesUsed > 0);
    } else {
      const correctPicked = chosen.filter((id) => expected.includes(id as any)).length;
      registerWrongMove(
        `${correctPicked}/${expected.length} proposition(s) attendue(s) cochée(s)`
      );
    }
  }, [evalState, pickedMcqIds, activeMcqChallenge, movesUsed]);

  const handleTFClick = (choice: boolean) => {
    if (evalState !== "idle") return;
    setPickedTF(choice);
    if (choice === activeTrueFalseChallenge.isTrue) {
      registerSuccessMove(false);
    } else {
      setMovesLeft(0);
      setEvalState("incorrect");
      triggerSound("incorrect", config.soundEffects);
      recordCardMemoryAndLog("incorrect", 1);
    }
  };

  const handleWordBankClick = (word: string) => {
    if (evalState !== "idle" || wrongWordBankTries.includes(word)) return;

    if (!pickedWordBank) {
      const isFirstRight =
        word.trim().toLowerCase() ===
        (activeClozeChallenge.firstMissingTerm || "").trim().toLowerCase();
      if (isFirstRight) {
        setPickedWordBank(word);
        if (!activeClozeChallenge.hasSecondBlank) {
          registerSuccessMove(wrongWordBankTries.length > 0);
        } else {
          triggerSound("click", config.soundEffects);
        }
      } else {
        setWrongWordBankTries((prev) => [...prev, word]);
        registerWrongMove(`« ${word} » ne correspond pas au 1er emplacement`);
      }
      return;
    }

    if (activeClozeChallenge.hasSecondBlank && !pickedSecondWordBank) {
      const isSecondRight =
        word.trim().toLowerCase() ===
        (activeClozeChallenge.secondMissingTerm || "").trim().toLowerCase();
      if (isSecondRight) {
        setPickedSecondWordBank(word);
        registerSuccessMove(wrongWordBankTries.length > 0);
      } else {
        setWrongWordBankTries((prev) => [...prev, word]);
        registerWrongMove(`« ${word} » ne correspond pas au 2e emplacement`);
      }
    }
  };

  const handleVerifyFillBlank = () => {
    if (evalState !== "idle" || !fillBlankText.trim() || !activeClozeChallenge) return;
    const firstTarget = String(activeClozeChallenge.firstMissingTerm || "").trim().toLowerCase();
    const secondTarget = String(activeClozeChallenge.secondMissingTerm || "").trim().toLowerCase();
    const isFirstRight =
      fillBlankText.trim().toLowerCase() === firstTarget;
    const isSecondRight = !activeClozeChallenge.hasSecondBlank
      ? true
      : fillSecondBlankText.trim().toLowerCase() === secondTarget;

    if (isFirstRight && isSecondRight) {
      registerSuccessMove(movesUsed > 0);
    } else {
      registerWrongMove(
        `Indice : 1er terme « ${activeClozeChallenge.firstMissingTerm.slice(0, 2)}... »${
          activeClozeChallenge.hasSecondBlank && activeClozeChallenge.secondMissingTerm
            ? ` • 2e terme « ${activeClozeChallenge.secondMissingTerm.slice(0, 2)}... »`
            : ""
        }`
      );
    }
  };

  const handleVerifyOpenQuestion = () => {
    if (evalState !== "idle" || !openAnswerText.trim()) return;
    const lower = String(openAnswerText || "").toLowerCase();
    const hits = (currentCard.keywords || []).filter((k) => lower.includes(String(k || "").toLowerCase()));
    if (hits.length >= Math.min(2, currentCard.keywords.length)) {
      registerSuccessMove(false);
    } else if (hits.length === 1) {
      registerSuccessMove(true);
    } else {
      registerWrongMove(
        `Notions attendues : ${currentCard.keywords.slice(0, 2).join(", ")}`
      );
    }
  };

  // ============================================================================
  // ÉCOUTEUR DE RACCOURCIS CLAVIER (1-4, A-B, Enter, Escape)
  // ============================================================================
  useEffect(() => {
    if (viewMode !== "arena" || isSettingsOpen || isReportModalOpen || isExitModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ne pas intercepter si le focus est dans un champ de saisie
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }

      // Touche ENTER : poursuivre vers la carte suivante quand l'évaluation est faite, ou valider le QCM
      if (e.key === "Enter") {
        if (evalState !== "idle") {
          e.preventDefault();
          handleContinue();
          return;
        }
        if (currentModality === "multiple_choice" && pickedMcqIds.length > 0) {
          e.preventDefault();
          handleValidateMcqSelection();
          return;
        }
      }

      // Touches pour CLASSER DANS LES CATÉGORIES (1-4 puis A ou B)
      if (currentModality === "categorize" && evalState === "idle") {
        const items = shuffledCategorizeItems;
        if (["1", "2", "3", "4"].includes(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          if (items[idx]) {
            e.preventDefault();
            setSelectedCatItemId((prev) => (prev === items[idx].id ? null : items[idx].id));
            triggerSound("click", config.soundEffects);
          }
        } else if ((e.key === "a" || e.key === "A" || e.key === "b" || e.key === "B") && selectedCatItemId) {
          e.preventDefault();
          const targetCat: "A" | "B" = e.key.toUpperCase() as "A" | "B";
          handlePlaceItemInCategory(selectedCatItemId, targetCat);
        } else if (e.key === "Escape") {
          setSelectedCatItemId(null);
        }
      }

      // Touches pour VRAI / FAUX (A/1 = Vrai, B/2 = Faux)
      if (currentModality === "true_false" && evalState === "idle") {
        if (e.key === "a" || e.key === "A" || e.key === "1") {
          e.preventDefault();
          handleTFClick(true);
        } else if (e.key === "b" || e.key === "B" || e.key === "2") {
          e.preventDefault();
          handleTFClick(false);
        }
      }

      // Touches pour CHOIX MULTIPLE (1 à 4 pour cocher/décocher)
      if (currentModality === "multiple_choice" && evalState === "idle") {
        if (["1", "2", "3", "4"].includes(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          const opt = activeMcqChallenge.options[idx];
          if (opt) {
            e.preventDefault();
            handleMcqToggle(opt.id);
          }
        }
      }

      // Touches pour CHOIX EN BLANC (1 à 4)
      if (currentModality === "word_bank" && evalState === "idle") {
        if (["1", "2", "3", "4", "5"].includes(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          const choice = wordBankChoices[idx];
          if (choice) {
            e.preventDefault();
            handleWordBankClick(choice);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    viewMode,
    isSettingsOpen,
    isReportModalOpen,
    isExitModalOpen,
    currentModality,
    evalState,
    selectedCatItemId,
    currentCard,
    shuffledCategorizeItems,
    activeMcqChallenge,
    pickedMcqIds,
    handleValidateMcqSelection,
    wordBankChoices,
    config.soundEffects,
    handleContinue,
  ]);

  // Passerelle automatique vers un cours transmis via location.state (depuis SummaryView)
  useEffect(() => {
    const state = location.state as any;
    if (state?.courseContent && state?.autoGenerate) {
      const title = state.courseTitle || "Cours";
      const existing = libraryDecks.find(
        (d) => (d.title || "").toLowerCase() === (title || "").toLowerCase()
      );
      if (existing) {
        setActiveDeckEntry(existing);
        setViewMode("arena");
      }
    }
  }, [location.state, libraryDecks]);

  // ============================================================================
  // IMPORT ET GÉNÉRATION IA COUVRANT 100 % D'UN COURS
  // ============================================================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await readFile(file);
      setNewCourseTitle(file.name.replace(/\.[^/.]+$/, ""));
      const text = result.content || "";
      setCourseText(text);

      const matched = text.match(
        /(?:Objectif[s]?\s*(?:pédagogique[s]?)?\s*[:\-\d]|\bOP\s*\d|\b[1-5]\.\s+)(.+)/gi
      );
      if (matched && matched.length > 0) {
        setDetectedObjectives(matched.slice(0, 5));
      }

      toast({
        title: "Cours intégralement lu",
        description: `Fichier analysé de la 1re à la dernière ligne (${text.length} caractères).`,
      });
    } catch (err: any) {
      toast({
        title: "Erreur d'import",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleGenerateSmartDeck = async () => {
    if (!courseText.trim()) {
      toast({
        title: "Texte requis",
        description: "Importe un fichier ou colle ton cours.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const previousQuestions = activeDeckEntry.cards.map((c) => c.prompt);
      const normalizedCards = await generateSmartFlashcards({
        content: courseText,
        title: newCourseTitle || "Cours Universitaire",
        count: Math.max(8, config.cardsPerCycle),
        objectives: detectedObjectives,
        previousQuestions,
        targetDifficulty: 2,
      });

      const newEntry: SmartDeckLibraryEntry = {
        id: `deck-${Date.now()}`,
        title: newCourseTitle || "Nouveau Cours Smart",
        subjectTag: normalizedCards[0]?.subjectTag || "ACADÉMIQUE",
        createdAt: Date.now(),
        lastStudiedAt: Date.now(),
        sessionsCompleted: 0,
        averageMastery: 0,
        cards: normalizedCards,
        memory: {},
      };

      SmartLibraryManager.saveDeck(newEntry);
      setLibraryDecks(SmartLibraryManager.getAllDecks());
      handleStartEvolvedSession(newEntry);
    } catch (err: any) {
      toast({
        title: "Erreur de génération",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const formatBold = (text: string) => {
    return text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-bold text-[#18181B] dark:text-white">
          {part.slice(2, -2)}
        </strong>
      ) : (
        part
      )
    );
  };

  // Statistiques calculées pour l'écran de Bilan de fin de session
  const sessionStats = useMemo(() => {
    const total = activeQueue.length;
    const correct = sessionLogs.filter((l) => l.status === "correct").length;
    const partial = sessionLogs.filter((l) => l.status === "partial").length;
    const incorrect = sessionLogs.filter((l) => l.status === "incorrect").length;
    const scorePct =
      total > 0 ? Math.round(((correct + partial * 0.5) / total) * 100) : 100;
    const sectionsCovered = Array.from(
      new Set(activeQueue.map((q) => q.card.courseSection))
    );
    return { total, correct, partial, incorrect, scorePct, sectionsCovered };
  }, [activeQueue, sessionLogs]);

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#FAF8F5] dark:bg-[#121110] text-[#18181B] dark:text-stone-100 relative overflow-x-hidden">
      {/* ====================================================================
          1. BARRE SUPÉRIEURE DAWJANG STUDIO ACADÉMIQUE
      ==================================================================== */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (dontShowExitAgain || viewMode !== "arena") {
                  navigate(returnPath);
                } else {
                  setIsExitModalOpen(true);
                }
              }}
              className="w-9 h-9 rounded-xl bg-white dark:bg-stone-900 hover:bg-stone-100 border border-[#E6DCD0] dark:border-stone-800 flex items-center justify-center text-stone-700 dark:text-stone-200 transition-all shadow-sm shrink-0"
              title="Retour à l'espace Flashcards"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#D96B43]">
                  STUDIO SMART FLASHCARDS • 8 MODALITÉS DYNAMIQUES
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#F3ECE2] dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                  Session #{activeDeckEntry.sessionsCompleted + 1}
                </span>
              </div>
              <h1 className="font-serif text-base sm:text-xl font-bold text-[#18181B] dark:text-white truncate">
                {activeDeckEntry.title}
              </h1>
            </div>
          </div>

          {/* Navigation entre Constructeur, Bibliothèque Smart, Session Active et Paramètres (sans badge '8') */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("builder")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shadow-sm ${
                viewMode === "builder"
                  ? "bg-[#18181B] text-white border-[#18181B]"
                  : "bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 border-[#E6DCD0] dark:border-stone-800 hover:border-[#D96B43]"
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-[#D96B43]" />
              <span className="hidden sm:inline">Constructeur</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("library")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shadow-sm ${
                viewMode === "library"
                  ? "bg-[#18181B] text-white border-[#18181B]"
                  : "bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 border-[#E6DCD0] dark:border-stone-800 hover:border-[#D96B43]"
              }`}
            >
              <Library className="w-3.5 h-3.5 text-[#D96B43]" />
              <span className="hidden sm:inline">
                Bibliothèque Smart ({libraryDecks.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("arena")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shadow-sm ${
                viewMode === "arena"
                  ? "bg-[#D96B43] text-white border-[#D96B43]"
                  : "bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 border-[#E6DCD0] dark:border-stone-800 hover:border-[#D96B43]"
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Session Active</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="w-10 h-10 rounded-xl bg-white dark:bg-stone-900 border border-[#E6DCD0] dark:border-stone-800 hover:border-[#D96B43] flex items-center justify-center text-stone-700 dark:text-stone-200 shadow-sm transition-colors"
              title="Paramètres de session"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barre de progression segmentée (affichée en mode Arène) */}
        {viewMode === "arena" && (
          <div className="mt-4 grid grid-flow-col auto-cols-fr gap-1.5">
            {activeQueue.map((_, idx) => {
              const isCurrent = idx === stepIdx;
              const isDone = idx < stepIdx;
              return (
                <div
                  key={idx}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    isCurrent
                      ? "bg-white dark:bg-stone-900 border-2 border-[#18181B] dark:border-[#D96B43]"
                      : isDone
                      ? "bg-[#D96B43]"
                      : "bg-[#E8E2D9] dark:bg-stone-800"
                  }`}
                />
              );
            })}
          </div>
        )}
      </header>

      {/* ====================================================================
          2A. VUE BILAN DE FIN DE SESSION (AVEC RETOUR DASHBOARD & ESPACE DE TRAVAIL)
      ==================================================================== */}
      {viewMode === "summary" && (
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 py-8 animate-in fade-in">
          <div className="rounded-2xl bg-white dark:bg-[#1C1917] border border-[#E6DCD0] dark:border-stone-800 p-6 sm:p-8 shadow-md space-y-7">
            {/* En-tête du Bilan */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EFEAE2] dark:border-stone-800 pb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#FAF8F5] dark:bg-stone-900 border-2 border-[#D96B43] p-2.5 flex items-center justify-center text-[#18181B] dark:text-white shadow-sm">
                  <DawJangLogo className="w-full h-full" />
                </div>
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#D96B43]">
                    BILAN DE FIN DE SESSION • SESSION #{activeDeckEntry.sessionsCompleted}
                  </span>
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#18181B] dark:text-white">
                    Leçon parcourue de bout en bout
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                    Les formes de questions utilisées ont été mémorisées dans ta Bibliothèque Smart pour ne plus jamais se répéter à l'identique.
                  </p>
                </div>
              </div>

              <div className="px-5 py-3 rounded-2xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] text-center shrink-0">
                <span className="text-3xl font-serif font-extrabold text-[#D96B43]">
                  {sessionStats.scorePct}%
                </span>
                <p className="text-[11px] font-mono uppercase text-stone-500">
                  Score de Maîtrise
                </p>
              </div>
            </div>

            {/* 4 Cartes de statistiques de la session */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] dark:border-stone-800">
                <p className="text-[11px] font-mono text-stone-500 uppercase">
                  Réussite 1er coup
                </p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {sessionStats.correct} / {sessionStats.total}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] dark:border-stone-800">
                <p className="text-[11px] font-mono text-stone-500 uppercase">
                  Réussite partielle
                </p>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {sessionStats.partial}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] dark:border-stone-800">
                <p className="text-[11px] font-mono text-stone-500 uppercase">
                  À renforcer
                </p>
                <p className="text-2xl font-bold text-rose-600 mt-1">
                  {sessionStats.incorrect}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] dark:border-stone-800">
                <p className="text-[11px] font-mono text-stone-500 uppercase">
                  Chapitres balayés
                </p>
                <p className="text-2xl font-bold text-[#18181B] dark:text-white mt-1">
                  100% ({sessionStats.sectionsCovered.length})
                </p>
              </div>
            </div>

            {/* Détail de la couverture par section du cours */}
            <div className="space-y-3">
              <h3 className="font-serif text-base font-bold text-[#18181B] dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#D96B43]" />
                Récapitulatif chronologique des sections du cours étudiées
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {sessionLogs.map((log, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] dark:border-stone-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#D96B43]">
                          {log.courseSection}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white dark:bg-stone-800 border border-[#E6DCD0] text-[10px] font-medium">
                          Posée en :{" "}
                          {MODALITY_METADATA.find((m) => m.id === log.modality)?.label}
                        </span>
                      </div>
                      <p className="text-stone-700 dark:text-stone-300 truncate">
                        {log.prompt}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full font-bold text-[11px] shrink-0 ${
                        log.status === "correct"
                          ? "bg-emerald-100 text-emerald-800"
                          : log.status === "partial"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {log.status === "correct"
                        ? "Maîtrisé"
                        : log.status === "partial"
                        ? `${log.movesUsed} coups`
                        : "À revoir"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* BOUTONS D'ACTION DE FIN DE SESSION (RETOUR DASHBOARD / ESPACE DE TRAVAIL / SESSION N+1) */}
            <div className="pt-4 border-t border-[#EFEAE2] dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#E6DCD0] dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-100 text-xs font-bold text-[#18181B] dark:text-white transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4 text-[#D96B43]" />
                  Tableau de bord
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/flashcards")}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#E6DCD0] dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-100 text-xs font-bold text-[#18181B] dark:text-white transition-colors"
                >
                  <Layers className="w-4 h-4 text-[#D96B43]" />
                  Espace Flashcards
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("library")}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#E6DCD0] dark:border-stone-700 bg-[#FAF8F5] dark:bg-stone-800 text-xs font-bold text-stone-700 dark:text-stone-200"
                >
                  <Library className="w-4 h-4 text-[#D96B43]" />
                  Bibliothèque Smart
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleStartEvolvedSession(activeDeckEntry)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#18181B] hover:bg-[#D96B43] text-white text-xs sm:text-sm font-bold transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Session Suivante (Formes Permutées & Niveau +1)
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ====================================================================
          2B. VUE BIBLIOTHÈQUE SMART FLASHCARDS (HISTORIQUE & ROTATION DE FORMES)
      ==================================================================== */}
      {viewMode === "library" && (
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-6 animate-in fade-in">
          <div className="rounded-2xl bg-white dark:bg-[#1C1917] border border-[#E6DCD0] dark:border-stone-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EFEAE2] dark:border-stone-800 pb-5">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#D96B43] font-bold">
                  MÉMOIRE ADAPTATIVE ANTI-RÉPÉTITION
                </span>
                <h2 className="font-serif text-2xl font-bold text-[#18181B] dark:text-white mt-0.5">
                  Bibliothèque Smart Flashcards
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 mt-1">
                  Chaque cours enregistré garde en mémoire les formes de questions déjà posées pour les permuter automatiquement (ex: Question ouverte → Vrai/Faux → Classer) et hausser la difficulté.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewMode("builder")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#18181B] hover:bg-[#D96B43] text-white text-xs font-bold shrink-0 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ajouter un cours à la bibliothèque
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {libraryDecks.map((entry) => {
                const learnedCardsCount = Object.keys(entry.memory || {}).length;
                const nextDifficultyTier = Math.min(3, 1 + entry.sessionsCompleted);

                return (
                  <div
                    key={entry.id}
                    className="p-5 rounded-2xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] dark:border-stone-800 flex flex-col justify-between gap-4 hover:border-[#D96B43] transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-[#D96B43]/15 text-[#C85A32] font-mono text-[10px] font-bold uppercase">
                          {entry.subjectTag}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-stone-500">
                            {entry.sessionsCompleted} session(s) • Prochain palier : Niv.{" "}
                            {nextDifficultyTier}/3
                          </span>
                          {libraryDecks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const remaining = libraryDecks.filter((d) => d.id !== entry.id);
                                localStorage.setItem(
                                  "dawjang_smart_flashcards_library_v4",
                                  JSON.stringify(remaining)
                                );
                                setLibraryDecks(remaining);
                                if (activeDeckEntry.id === entry.id && remaining[0]) {
                                  setActiveDeckEntry(remaining[0]);
                                }
                              }}
                              className="p-1 rounded-md text-stone-400 hover:text-rose-600 transition-colors"
                              title="Supprimer ce paquet"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <h3 className="font-serif text-lg font-bold text-[#18181B] dark:text-white">
                        {entry.title}
                      </h3>

                      <p className="text-xs text-stone-600 dark:text-stone-400">
                        {entry.cards.length} concepts couvrant toute la leçon •{" "}
                        {learnedCardsCount} forme(s) déjà permutée(s) en mémoire.
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#E6DCD0]/60 dark:border-stone-800">
                      <span className="text-xs font-mono font-bold text-stone-700 dark:text-stone-300">
                        Maîtrise : {entry.averageMastery}%
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStartEvolvedSession(entry)}
                        className="px-4 py-2 rounded-xl bg-[#18181B] hover:bg-[#D96B43] text-white text-xs font-bold transition-colors"
                      >
                        Lancer Session Évolutive →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      )}

      {/* ====================================================================
          2C. VUE CONSTRUCTEUR (IMPORT OU CHOIX DEPUIS LA BIBLIOTHÈQUE)
      ==================================================================== */}
      {viewMode === "builder" && (
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-6">
          {/* Accès rapide aux paquets déjà prêts dans la Bibliothèque Smart */}
          {libraryDecks.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-[#1C1917] border border-[#E6DCD0] dark:border-stone-800 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10.5px] font-mono uppercase tracking-widest text-[#D96B43] font-bold">
                  PRÊT À L'ENTRAÎNEMENT • {libraryDecks.length} PAQUET(S) ENREGISTRÉ(S)
                </span>
                <h3 className="font-serif text-lg font-bold text-[#18181B] dark:text-white">
                  Reprendre « {activeDeckEntry.title} »
                </h3>
                <p className="text-xs text-stone-500">
                  {activeDeckEntry.cards.length} concepts • 8 modes polymorphes (QCM multi-choix, Censure, Classer mélangé, Correspondance dérangée, Cloze).
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("library")}
                  className="px-3.5 py-2.5 rounded-xl border border-[#E6DCD0] dark:border-stone-700 bg-[#FAF8F5] dark:bg-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:border-[#D96B43]"
                >
                  Changer de paquet ({libraryDecks.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleStartEvolvedSession(activeDeckEntry)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#18181B] hover:bg-[#D96B43] text-white text-xs font-bold transition-colors shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Lancer l'Arène Smart →</span>
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white dark:bg-[#1C1917] border border-[#E6DCD0] dark:border-stone-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3.5 border-b border-[#EFEAE2] dark:border-stone-800 pb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] p-2 flex items-center justify-center text-[#18181B] dark:text-white">
                <DawJangLogo className="w-full h-full" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#D96B43] font-bold">
                  CONSTRUCTEUR DE SESSION ADAPTATIVE (8 MODES)
                </span>
                <h2 className="font-serif text-2xl font-bold text-[#18181B] dark:text-white">
                  Créer un nouveau paquet Smart Flashcards
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                  1. Intitulé du cours ou sélection depuis votre Bibliothèque
                </label>
                <input
                  type="text"
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  placeholder="Ex: Anémies par déficits enzymatiques / Cardiologie..."
                  className="w-full h-11 px-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] text-sm focus:outline-none focus:border-[#D96B43]"
                />

                {savedLibraryCourses.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium text-stone-500">
                      Ou charger en 1 clic un cours enregistré dans votre Bibliothèque ({savedLibraryCourses.length}) :
                    </span>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const found = savedLibraryCourses.find((c) => c.id === e.target.value);
                        if (found) {
                          setNewCourseTitle(found.title);
                          setCourseText(found.content);
                          toast({
                            title: "Cours chargé depuis la Bibliothèque",
                            description: `« ${found.title} » est prêt à être transformé en Smart Flashcards.`,
                          });
                        }
                      }}
                      className="w-full h-10 px-3 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] text-xs font-medium text-[#18181B] dark:text-stone-200 focus:outline-none focus:border-[#D96B43]"
                    >
                      <option value="">-- Sélectionner un cours de ma Bibliothèque --</option>
                      {savedLibraryCourses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.subject} • {c.wordCount.toLocaleString("fr-FR")} mots)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <label className="group flex flex-col items-center justify-center border-2 border-dashed border-[#D96B43]/40 hover:border-[#D96B43] rounded-2xl p-6 cursor-pointer bg-[#FAF8F5] dark:bg-stone-900/50 transition-all">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Upload className="w-7 h-7 text-[#D96B43] mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-[#18181B] dark:text-white">
                    Importer un PDF ou Word (.docx)
                  </span>
                  <span className="text-xs text-stone-500 mt-1">
                    {isReading
                      ? "Lecture géométrique en cours..."
                      : "Analyse de 100 % des pages, tableaux et conclusions"}
                  </span>
                </label>
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                  2. Contenu intégral du cours
                </label>
                <textarea
                  rows={8}
                  value={courseText}
                  onChange={(e) => setCourseText(e.target.value)}
                  placeholder="Collez ici le texte de votre cours, choisissez un cours de votre bibliothèque ou importez un fichier à gauche..."
                  className="w-full p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] text-xs sm:text-sm font-mono focus:outline-none focus:border-[#D96B43]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-[#EFEAE2]">
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerateSmartDeck}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#18181B] hover:bg-[#D96B43] text-white font-bold text-sm transition-colors shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                {isGenerating
                  ? "Découpage des 5 zones du cours & Génération..."
                  : "Générer & Lancer la Session Smart"}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ====================================================================
          2D. VUE ARÈNE D'APPRENTISSAGE ADAPTATIF
      ==================================================================== */}
      {viewMode === "arena" && (
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 w-full max-w-4xl mx-auto">
          {currentModality !== "read_understand" && (
            <FloatingDawJangEmblem
              status={evalState}
              movesLeft={movesLeft}
              maxMoves={config.maxMovesPerCard}
              activeTier={activeTier}
            />
          )}

          {attemptFeedback && evalState === "idle" && (
            <div className="w-full mb-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{attemptFeedback}</span>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-200/70 text-amber-900 shrink-0">
                Nouvel essai
              </span>
            </div>
          )}

          {/* CARTE PRINCIPALE DAWJANG */}
          <div className="w-full rounded-2xl bg-white dark:bg-[#1C1917] border border-[#E6DCD0] dark:border-stone-800 shadow-[0_10px_35px_rgba(24,24,27,0.05)] p-5 sm:p-8 transition-all">
            {/* En-tête interne : Matière + Tags + Section chronologique du cours */}
            <div className="flex items-center justify-between gap-2 mb-6 flex-wrap border-b border-[#EFEAE2] dark:border-stone-800 pb-3.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-[#D96B43]">
                  <FolderOpen className="w-3.5 h-3.5" />
                  {currentCard.subjectTag || "HÉMATOLOGIE"}
                </span>

                {(currentCard.customTags || []).map((t, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-[#FAF8F5] dark:bg-stone-800 border border-[#E6DCD0] dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300"
                  >
                    {t}
                  </span>
                ))}

                {isAddingTag ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (tagDraft.trim()) {
                        if (!currentCard.customTags) currentCard.customTags = [];
                        currentCard.customTags.push(tagDraft.trim());
                        setTagDraft("");
                      }
                      setIsAddingTag(false);
                    }}
                    className="inline-flex items-center"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onBlur={() => setIsAddingTag(false)}
                      placeholder="Nom du tag..."
                      className="px-2 py-0.5 rounded-md border border-[#D96B43] text-xs bg-transparent text-[#18181B] dark:text-stone-100 focus:outline-none"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingTag(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#E6DCD0] dark:border-stone-700 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-[#FAF8F5] dark:hover:bg-stone-800 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Ajouter des tags
                  </button>
                )}

                <span className="hidden md:inline-flex px-2.5 py-0.5 rounded-md bg-[#FAF8F5] dark:bg-stone-800 border border-[#E6DCD0] dark:border-stone-700 text-xs font-semibold text-[#18181B] dark:text-stone-200">
                  {currentCard.courseSection}
                </span>

                {currentStep.previousModality && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono">
                    Forme permutée (précédemment :{" "}
                    {
                      MODALITY_METADATA.find(
                        (m) => m.id === currentStep.previousModality
                      )?.label
                    }
                    )
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                  {currentModality === "categorize" && "Classe chaque élément dans la bonne catégorie"}
                  {currentModality === "multiple_choice" && activeMcqChallenge.instructionBadge}
                  {currentModality === "true_false" && "Choisir la réponse (Vrai / Faux)"}
                  {currentModality === "word_bank" &&
                    (activeClozeChallenge.hasSecondBlank
                      ? "Remplir les 2 cases dans l'ordre"
                      : "Remplir la case")}
                  {currentModality === "fill_blank" &&
                    (activeClozeChallenge.hasSecondBlank
                      ? "Saisir les 2 termes manquants"
                      : "Remplir le vide")}
                  {currentModality === "matching" && "Associe chaque élément (Colonnes dérangées)"}
                  {currentModality === "open_question" && "Question ouverte"}
                  {currentModality === "read_understand" && "Lire et comprendre"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="text-stone-400 hover:text-[#D96B43] p-1 transition-colors"
                  title="Signaler cette carte"
                >
                  <Flag className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 1. LIRE ET COMPRENDRE */}
            {currentModality === "read_understand" && (
              <div className="py-8 sm:py-10 text-center space-y-7">
                <h2 className="font-serif text-lg sm:text-2xl font-bold text-[#18181B] dark:text-white max-w-2xl mx-auto leading-snug">
                  {config.swapQuestionAnswer ? currentCard.answer : effectivePrompt}
                </h2>

                {isFlipped ? (
                  <div className="pt-6 border-t border-[#EFEAE2] max-w-2xl mx-auto text-left space-y-3 animate-in fade-in">
                    <p className="text-sm sm:text-base text-stone-700 dark:text-stone-200 leading-relaxed">
                      {config.swapQuestionAnswer ? effectivePrompt : currentCard.answer}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      triggerSound("click", config.soundEffects);
                      setIsFlipped(true);
                    }}
                    className="text-sm font-bold text-[#D96B43] hover:underline"
                  >
                    Afficher la réponse complète
                  </button>
                )}
              </div>
            )}

            {/* 2. CHOIX MULTIPLE & CENSURE MULTI-RÉPONSES (1, 2 ou 3 bonnes réponses) */}
            {currentModality === "multiple_choice" && (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-2 text-center">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider ${
                      activeMcqChallenge.isCensure
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-400/40"
                        : "bg-[#D96B43]/15 text-[#C85A32] dark:text-[#E8845C] border border-[#D96B43]/30"
                    }`}
                  >
                    {activeMcqChallenge.instructionBadge}
                  </span>
                  <h2 className="font-serif text-base sm:text-xl font-bold text-[#18181B] dark:text-white leading-snug">
                    {activeMcqChallenge.questionText}
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {activeMcqChallenge.options.map((opt) => {
                    const isChecked = pickedMcqIds.includes(opt.id);
                    const showGreen = evalState !== "idle" && opt.shouldBeChecked;
                    const showRed = evalState !== "idle" && isChecked && !opt.shouldBeChecked;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={evalState !== "idle"}
                        onClick={() => handleMcqToggle(opt.id)}
                        className={`text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between gap-3 ${
                          showGreen
                            ? "bg-emerald-50/90 border-emerald-400 text-emerald-900"
                            : showRed
                            ? "bg-rose-50/90 border-rose-400 text-rose-900"
                            : isChecked
                            ? "bg-[#D96B43]/10 border-[#D96B43] text-[#18181B] dark:text-white shadow-xs"
                            : "bg-white dark:bg-stone-900 border-[#E6DCD0] hover:border-[#D96B43]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`w-6 h-6 rounded-md border flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5 ${
                              isChecked
                                ? "bg-[#D96B43] border-[#D96B43] text-white"
                                : "border-stone-300 dark:border-stone-700 text-stone-500"
                            }`}
                          >
                            {opt.id}
                          </span>
                          <span className="text-xs sm:text-sm leading-relaxed">
                            {opt.text}
                          </span>
                        </div>
                        {showGreen && (
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {evalState === "idle" && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-stone-500">
                      {pickedMcqIds.length > 0
                        ? `${pickedMcqIds.length} proposition(s) cochée(s) : ${pickedMcqIds.join(", ")}`
                        : "Cochez une ou plusieurs propositions puis validez"}
                    </span>
                    <button
                      type="button"
                      disabled={pickedMcqIds.length === 0}
                      onClick={handleValidateMcqSelection}
                      className="px-6 py-2.5 rounded-full bg-[#18181B] hover:bg-[#D96B43] disabled:opacity-40 text-white text-xs font-bold transition-colors shadow-xs"
                    >
                      Valider ma sélection ({pickedMcqIds.length})
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. VRAI OU FAUX */}
            {currentModality === "true_false" && (
              <div className="space-y-6">
                <h2 className="font-serif text-base sm:text-xl font-bold text-center text-[#18181B] dark:text-white max-w-2xl mx-auto leading-relaxed">
                  {activeTrueFalseChallenge.statement}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {[
                    { id: "A", label: "Vrai", value: true },
                    { id: "B", label: "Faux", value: false },
                  ].map((btn) => {
                    const isPicked = pickedTF === btn.value;
                    const isRight = btn.value === activeTrueFalseChallenge.isTrue;
                    const showGreen = evalState !== "idle" && isRight;
                    const showRed = evalState !== "idle" && isPicked && !isRight;

                    return (
                      <button
                        key={btn.id}
                        type="button"
                        disabled={evalState !== "idle"}
                        onClick={() => handleTFClick(btn.value)}
                        className={`p-4 sm:p-5 rounded-xl border-2 flex items-center justify-between transition-all ${
                          showGreen
                            ? "bg-emerald-50/90 border-emerald-400 text-emerald-900"
                            : showRed
                            ? "bg-rose-50/90 border-rose-400 text-rose-900"
                            : "bg-white dark:bg-stone-900 border-[#E6DCD0] hover:border-[#D96B43]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-stone-500">
                            {btn.id}
                          </span>
                          <span className="text-sm font-semibold">{btn.label}</span>
                        </div>
                        {showGreen && <Check className="w-4 h-4 text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. CHOIX EN BLANC (1 OU 2 CASES À REMPLIR + BANQUE DE MOTS MÉLANGÉE) */}
            {currentModality === "word_bank" && (
              <div className="space-y-7">
                <p className="text-sm sm:text-base text-[#18181B] dark:text-stone-100 leading-loose">
                  {activeClozeChallenge.sentenceBefore}{" "}
                  <span
                    className={`inline-flex items-center justify-center min-w-[115px] px-3 py-1 mx-1 rounded-md border text-xs sm:text-sm font-semibold align-middle transition-all ${
                      !pickedWordBank
                        ? "border-dashed border-[#D96B43] bg-[#FAF8F5] dark:bg-stone-800 text-[#D96B43]"
                        : evalState === "correct" || evalState === "partial" || pickedWordBank
                        ? "bg-emerald-100 border-emerald-500 text-emerald-800"
                        : "bg-rose-100 border-rose-400 text-rose-700"
                    }`}
                  >
                    {pickedWordBank ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span>{pickedWordBank}</span>
                        {evalState === "idle" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPickedWordBank(null);
                            }}
                            className="w-4 h-4 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 flex items-center justify-center text-stone-500 hover:text-rose-600 transition-colors"
                            title="Retirer ce mot"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ) : (
                      "• Case 1 •"
                    )}
                  </span>{" "}
                  {activeClozeChallenge.sentenceMiddle}
                  {activeClozeChallenge.hasSecondBlank && (
                    <>
                      {" "}
                      <span
                        className={`inline-flex items-center justify-center min-w-[115px] px-3 py-1 mx-1 rounded-md border text-xs sm:text-sm font-semibold align-middle transition-all ${
                          !pickedSecondWordBank
                            ? "border-dashed border-stone-400 bg-[#FAF8F5] dark:bg-stone-800 text-stone-400"
                            : "bg-emerald-100 border-emerald-500 text-emerald-800"
                        }`}
                      >
                        {pickedSecondWordBank || "• Case 2 •"}
                      </span>{" "}
                      {activeClozeChallenge.sentenceAfter}
                    </>
                  )}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-[#EFEAE2] dark:border-stone-800">
                  {wordBankChoices.map((word, idx) => {
                    const isPicked =
                      pickedWordBank === word || pickedSecondWordBank === word;
                    const wasWrong = wrongWordBankTries.includes(word);
                    const wordLower = String(word || "").toLowerCase();
                    const firstTarget = String(activeClozeChallenge?.firstMissingTerm || "").toLowerCase();
                    const secondTarget = String(activeClozeChallenge?.secondMissingTerm || "").toLowerCase();
                    const isRightOpt =
                      wordLower === firstTarget ||
                      (Boolean(activeClozeChallenge?.secondMissingTerm) && wordLower === secondTarget);

                    if (isPicked) {
                      return (
                        <div
                          key={idx}
                          className="h-9 w-28 rounded-lg bg-[#E6E2DC]/80 dark:bg-stone-800/70 border border-dashed border-[#D4C9BC] dark:border-stone-700"
                        />
                      );
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={evalState !== "idle" || wasWrong}
                        onClick={() => handleWordBankClick(word)}
                        className={`px-3.5 py-1.5 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
                          evalState !== "idle" && isRightOpt
                            ? "bg-emerald-100 border-emerald-500 text-emerald-900 font-bold"
                            : wasWrong
                            ? "bg-rose-100/80 border-rose-300 text-rose-800 line-through opacity-65"
                            : "bg-white dark:bg-stone-900 border-[#E6DCD0] dark:border-stone-700 hover:border-[#D96B43]"
                        }`}
                      >
                        {word}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. CLASSER DANS LES CATÉGORIES A / B (ITEMS MÉLANGÉS ALÉATOIREMENT) */}
            {currentModality === "categorize" && (
              <div className="space-y-6">
                <h2 className="font-serif text-base sm:text-xl font-bold text-center text-[#18181B] dark:text-white">
                  {currentCard.categorize.instruction}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(["A", "B"] as const).map((catKey) => {
                    const catTitle =
                      catKey === "A"
                        ? currentCard.categorize.categoryA
                        : currentCard.categorize.categoryB;
                    const assignedHere = shuffledCategorizeItems.filter(
                      (it) => catPlacements[it.id] === catKey
                    );
                    const isDragOverThis = dragOverZone === catKey;

                    return (
                      <div
                        key={catKey}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverZone !== catKey) setDragOverZone(catKey);
                        }}
                        onDragLeave={() => {
                          if (dragOverZone === catKey) setDragOverZone(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const droppedId =
                            e.dataTransfer.getData("text/plain") || draggedCatItemId;
                          if (droppedId) {
                            handlePlaceItemInCategory(droppedId, catKey);
                          }
                        }}
                        onClick={() => {
                          if (selectedCatItemId) {
                            handlePlaceItemInCategory(selectedCatItemId, catKey);
                          }
                        }}
                        className={`min-h-[165px] p-4 rounded-xl border-2 border-dashed transition-all duration-200 ${
                          isDragOverThis
                            ? "border-[#D96B43] bg-[#D96B43]/10 scale-[1.01] shadow-md"
                            : selectedCatItemId
                            ? "border-[#D96B43]/70 bg-[#D96B43]/5 cursor-pointer"
                            : "border-[#E6DCD0] dark:border-stone-700 bg-[#FAF8F5]/50"
                        }`}
                      >
                        <p className="text-xs sm:text-sm font-bold text-center text-[#18181B] dark:text-stone-200 mb-3.5">
                          <span className="text-stone-400 font-mono mr-1.5">
                            {catKey}
                          </span>
                          {catTitle}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {assignedHere.map((item) => {
                            const isRight = item.target === catKey;
                            const expectedCategory =
                              item.target === "A"
                                ? currentCard.categorize.categoryA
                                : currentCard.categorize.categoryB;

                            return (
                              <div
                                key={item.id}
                                draggable={evalState === "idle"}
                                onDragStart={(e) => {
                                  setDraggedCatItemId(item.id);
                                  e.dataTransfer.setData("text/plain", item.id);
                                }}
                                onDragEnd={() => {
                                  setDraggedCatItemId(null);
                                  setDragOverZone(null);
                                }}
                                className={`inline-flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg border text-xs transition-all select-none ${
                                  evalState === "idle"
                                    ? "bg-white dark:bg-stone-800 border-[#E6DCD0] text-[#18181B] dark:text-stone-100 shadow-sm cursor-grab"
                                    : isRight
                                    ? "bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold w-full"
                                    : "bg-rose-50 border-rose-300 text-rose-800 w-full"
                                }`}
                              >
                                <span className="font-medium leading-snug">
                                  {item.label}
                                </span>

                                {evalState === "idle" ? (
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleRemoveItemFromCategory(item.id, e)
                                    }
                                    className="w-5 h-5 rounded-md hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-rose-600 shrink-0"
                                    title="Retirer de cette catégorie"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  !isRight && (
                                    <span className="text-[11px] text-stone-600 text-right shrink-0">
                                      Correct : {expectedCategory}
                                    </span>
                                  )
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-[#EFEAE2]">
                  {shuffledCategorizeItems.map((item, idx) => {
                    const isPlaced = !!catPlacements[item.id];
                    const isSelected = selectedCatItemId === item.id;
                    const isBeingDragged = draggedCatItemId === item.id;

                    if (isPlaced) {
                      return (
                        <div
                          key={item.id}
                          className="h-10 rounded-lg bg-[#E6E2DC]/80 dark:bg-stone-800/70"
                        />
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        draggable={evalState === "idle"}
                        onDragStart={(e) => {
                          setDraggedCatItemId(item.id);
                          setSelectedCatItemId(item.id);
                          e.dataTransfer.setData("text/plain", item.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDraggedCatItemId(null);
                          setDragOverZone(null);
                        }}
                        onClick={() =>
                          setSelectedCatItemId((prev) =>
                            prev === item.id ? null : item.id
                          )
                        }
                        className={`px-3.5 py-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all select-none cursor-grab active:cursor-grabbing ${
                          isBeingDragged
                            ? "opacity-40 scale-95 border-[#D96B43]"
                            : isSelected
                            ? "border-[#D96B43] bg-[#D96B43]/10 text-[#C85A32] ring-2 ring-[#D96B43]/20"
                            : "border-[#E6DCD0] bg-white dark:bg-stone-800 hover:border-[#D96B43] shadow-sm"
                        }`}
                      >
                        <span className="text-stone-400 font-mono font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="line-clamp-2">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. REMPLIR LE VIDE (1 OU 2 CHAMPS DE SAISIE) */}
            {currentModality === "fill_blank" && (
              <div className="space-y-6">
                <p className="text-sm sm:text-base text-[#18181B] dark:text-stone-100 leading-relaxed">
                  {activeClozeChallenge.sentenceBefore}{" "}
                  <input
                    type="text"
                    disabled={evalState !== "idle"}
                    value={fillBlankText}
                    onChange={(e) => setFillBlankText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyFillBlank()}
                    placeholder="Terme 1..."
                    className="inline-block px-3 py-1 mx-1 rounded-lg border-2 border-[#D96B43] bg-[#FAF8F5] dark:bg-stone-900 text-sm font-semibold focus:outline-none"
                  />{" "}
                  {activeClozeChallenge.sentenceMiddle}
                  {activeClozeChallenge.hasSecondBlank && (
                    <>
                      {" "}
                      <input
                        type="text"
                        disabled={evalState !== "idle"}
                        value={fillSecondBlankText}
                        onChange={(e) => setFillSecondBlankText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleVerifyFillBlank()}
                        placeholder="Terme 2..."
                        className="inline-block px-3 py-1 mx-1 rounded-lg border-2 border-[#D96B43] bg-[#FAF8F5] dark:bg-stone-900 text-sm font-semibold focus:outline-none"
                      />{" "}
                      {activeClozeChallenge.sentenceAfter}
                    </>
                  )}
                </p>
                {evalState === "idle" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleVerifyFillBlank}
                      className="px-5 py-2 rounded-full bg-[#18181B] text-white text-xs font-semibold"
                    >
                      Vérifier
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 7. CORRESPONDANCE (COLONNE DROITE EN DÉRANGEMENT STRICT : JAMAIS A-1, B-2, C-3) */}
            {currentModality === "matching" && (
              <div className="space-y-5">
                <h2 className="font-serif text-base font-bold text-center">
                  {currentCard.matching.instruction}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2.5">
                    {derangedMatching.leftPairs.map((p, idx) => {
                      const isDone = !!matchedMap[p.id];
                      const isSelected = selectedLeftPairId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={isDone}
                          onClick={() => setSelectedLeftPairId(p.id)}
                          className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-start gap-2.5 ${
                            isDone
                              ? "bg-emerald-50 border-emerald-400 text-emerald-800"
                              : isSelected
                              ? "border-[#D96B43] bg-[#D96B43]/10"
                              : "border-[#E6DCD0] hover:border-[#D96B43]/50"
                          }`}
                        >
                          <span className="font-mono text-xs font-bold text-[#D96B43] shrink-0 mt-0.5">
                            {idx + 1}.
                          </span>
                          <span>{p.left}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-2.5">
                    {derangedMatching.rightPairs.map((p, idx) => {
                      const letter = ["A", "B", "C", "D"][idx] || String(idx + 1);
                      const isTaken = Object.values(matchedMap).includes(p.right);
                      return (
                        <button
                          key={`${p.id}-right`}
                          type="button"
                          disabled={isTaken || !selectedLeftPairId}
                          onClick={() => {
                            if (!selectedLeftPairId) return;
                            const leftObj = currentCard.matching.pairs.find(
                              (item) => item.id === selectedLeftPairId
                            );
                            if (leftObj && leftObj.right === p.right) {
                              const next = {
                                ...matchedMap,
                                [selectedLeftPairId]: p.right,
                              };
                              setMatchedMap(next);
                              setSelectedLeftPairId(null);
                              if (
                                Object.keys(next).length ===
                                currentCard.matching.pairs.length
                              ) {
                                registerSuccessMove(movesUsed > 0);
                              }
                            } else {
                              setSelectedLeftPairId(null);
                              registerWrongMove("Association inexacte");
                            }
                          }}
                          className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm transition-all flex items-start gap-2.5 ${
                            isTaken
                              ? "bg-emerald-50 border-emerald-400 text-emerald-800"
                              : "border-[#E6DCD0] hover:border-[#D96B43]"
                          }`}
                        >
                          <span className="font-mono text-xs font-bold text-stone-500 shrink-0 mt-0.5">
                            {letter}.
                          </span>
                          <span>{p.right}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 8. QUESTION OUVERTE (AVEC ESCALADE DES VARIANTES DE DIFFICULTÉ) */}
            {currentModality === "open_question" && (
              <div className="space-y-5">
                <h2 className="font-serif text-base sm:text-lg font-bold text-center">
                  {effectivePrompt}
                </h2>
                <textarea
                  rows={3}
                  disabled={evalState !== "idle"}
                  value={openAnswerText}
                  onChange={(e) => setOpenAnswerText(e.target.value)}
                  placeholder="Rédigez votre réponse analytique et clinique..."
                  className="w-full p-3.5 rounded-xl border border-[#E6DCD0] bg-[#FAF8F5] text-sm focus:outline-none focus:border-[#D96B43]"
                />
                {evalState === "idle" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleVerifyOpenQuestion}
                      className="px-6 py-2.5 rounded-full bg-[#18181B] text-white text-xs font-semibold"
                    >
                      Valider ma réponse
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Boutons d'auto-évaluation (pour Lire et comprendre) */}
          {currentModality === "read_understand" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl mt-6">
              {[
                {
                  label: "Mauvais",
                  delay: "dans 4 cartes",
                  icon: Frown,
                  status: "incorrect" as const,
                  bg: "bg-[#F9E4E4] hover:bg-[#F5D0D0] text-[#9E2A2B]",
                },
                {
                  label: "OK",
                  delay: "à la fin",
                  icon: Meh,
                  status: "partial" as const,
                  bg: "bg-[#F9EBD2] hover:bg-[#F3DEC0] text-[#9C6615]",
                },
                {
                  label: "Bon",
                  delay: "à la fin",
                  icon: Smile,
                  status: "correct" as const,
                  bg: "bg-[#DDF3E4] hover:bg-[#C8EAD3] text-[#1E7E45]",
                },
                {
                  label: "Parfait",
                  delay: "en 3 jours",
                  icon: Laugh,
                  status: "correct" as const,
                  bg: "bg-[#EFECE6] hover:bg-[#E5DFD5] text-[#18181B]",
                },
              ].map((rate) => {
                const IconComp = rate.icon;
                return (
                  <div key={rate.label} className="flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        recordCardMemoryAndLog(rate.status, 1);
                        handleContinue();
                      }}
                      className={`w-full py-4 px-4 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 shadow-sm ${rate.bg}`}
                    >
                      <IconComp className="w-6 h-6" />
                      <span className="text-sm font-bold text-[#18181B]">
                        {rate.label}
                      </span>
                    </button>
                    <span className="text-[11px] text-stone-500 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> {rate.delay}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* BARRE D'INDICATIONS DES RACCOURCIS CLAVIER SOUS LA CARTE */}
          {currentModality !== "read_understand" && (
            <div className="w-full flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 mt-3 px-1 select-none">
              <div className="flex items-center gap-1.5 flex-wrap">
                {currentModality === "categorize" && (
                  <>
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-800 border border-[#E6DCD0] dark:border-stone-700 rounded text-[10px] font-mono font-semibold text-stone-700 dark:text-stone-300 shadow-2xs">
                      1
                    </kbd>
                    <span>-</span>
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-800 border border-[#E6DCD0] dark:border-stone-700 rounded text-[10px] font-mono font-semibold text-stone-700 dark:text-stone-300 shadow-2xs">
                      4
                    </kbd>
                    <span>pour sélectionner l'élément,</span>
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-800 border border-[#E6DCD0] dark:border-stone-700 rounded text-[10px] font-mono font-semibold text-stone-700 dark:text-stone-300 shadow-2xs">
                      A
                    </kbd>
                    <span>-</span>
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-800 border border-[#E6DCD0] dark:border-stone-700 rounded text-[10px] font-mono font-semibold text-stone-700 dark:text-stone-300 shadow-2xs">
                      B
                    </kbd>
                    <span>pour sélectionner une catégorie</span>
                  </>
                )}
                {currentModality === "true_false" && (
                  <>
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-800 border border-[#E6DCD0] dark:border-stone-700 rounded text-[10px] font-mono font-semibold text-stone-700 dark:text-stone-300">
                      A
                    </kbd>
                    <span>(Vrai) ou</span>
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-800 border border-[#E6DCD0] dark:border-stone-700 rounded text-[10px] font-mono font-semibold text-stone-700 dark:text-stone-300">
                      B
                    </kbd>
                    <span>(Faux) pour répondre</span>
                  </>
                )}
                {(currentModality === "multiple_choice" || currentModality === "word_bank") && (
                  <>
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-800 border border-[#E6DCD0] dark:border-stone-700 rounded text-[10px] font-mono font-semibold text-stone-700 dark:text-stone-300">
                      1
                    </kbd>
                    <span>-</span>
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-800 border border-[#E6DCD0] dark:border-stone-700 rounded text-[10px] font-mono font-semibold text-stone-700 dark:text-stone-300">
                      4
                    </kbd>
                    <span>pour répondre</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <kbd className="px-2 py-0.5 bg-white dark:bg-stone-800 border border-[#E6DCD0] dark:border-stone-700 rounded text-[10px] font-mono font-semibold text-stone-700 dark:text-stone-300 shadow-2xs">
                  Enter
                </kbd>
                <span>poursuivre</span>
              </div>
            </div>
          )}

          {/* Explication plus approfondie */}
          {showDeepDive && evalState !== "idle" && (
            <div className="w-full mt-6 bg-white dark:bg-[#1C1917] rounded-2xl border border-[#E6DCD0] p-5 sm:p-7 shadow-md space-y-5 animate-in fade-in">
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-center text-[#D96B43]">
                Explication plus approfondie • {currentCard.courseSection}
              </p>

              <div className="space-y-3">
                <h3 className="font-serif text-base font-bold">Key Takeaways</h3>
                <ul className="space-y-2.5 text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed list-disc pl-5">
                  <li>
                    <span className="mr-1">✅</span>
                    <strong>Synthèse exacte :</strong> «{" "}
                    {currentCard.deepDive.expectedSummary} »
                  </li>
                  <li>{formatBold(currentCard.deepDive.coreExplanation)}</li>
                  <li>
                    {formatBold(currentCard.deepDive.distinctionOrCounterExample)}
                  </li>
                  <li>{formatBold(currentCard.deepDive.commonPitfall)}</li>
                </ul>
              </div>

              <div className="space-y-1.5 pt-2">
                <h4 className="font-serif text-sm font-bold">Pro Tip</h4>
                <p className="text-xs sm:text-sm text-stone-800 dark:text-stone-200 leading-relaxed">
                  🧠 {formatBold(currentCard.deepDive.causalChainProTip)}
                </p>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ====================================================================
          3. TIROIR INFÉRIEUR DE FEEDBACK
      ==================================================================== */}
      {viewMode === "arena" && evalState !== "idle" && (
        <footer
          className={`w-full bg-white dark:bg-[#1C1917] border-t-2 px-4 sm:px-8 py-4 shadow-[0_-10px_30px_rgba(0,0,0,0.04)] animate-in slide-in-from-bottom-4 ${
            evalState === "correct"
              ? "border-emerald-500"
              : evalState === "partial"
              ? "border-amber-500"
              : "border-rose-500"
          }`}
        >
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                {evalState === "correct" && (
                  <>
                    <Check className="w-5 h-5 text-emerald-600 bg-emerald-100 rounded-full p-0.5" />
                    <span>Bien joué !</span>
                  </>
                )}
                {evalState === "partial" && (
                  <>
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    <span>Tu y es presque !</span>
                  </>
                )}
                {evalState === "incorrect" && (
                  <>
                    <XCircle className="w-5 h-5 text-rose-500" />
                    <span>N'abandonne pas !</span>
                  </>
                )}
              </div>
            </div>

            {evalState === "incorrect" && (
              <div className="pl-3 border-l-2 border-[#E6DCD0] text-xs sm:text-sm space-y-1">
                <p className="font-bold text-stone-700 text-xs">Réponse attendue</p>
                <p className="text-stone-600">{currentCard.deepDive.expectedSummary}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowDeepDive((prev) => !prev)}
                className="px-5 py-2.5 rounded-full border border-[#E6DCD0] text-xs sm:text-sm font-semibold hover:bg-[#FAF8F5]"
              >
                {showDeepDive ? "Masquer" : "Expliquer"}
              </button>

              <button
                type="button"
                onClick={handleContinue}
                className="px-10 sm:px-14 py-2.5 rounded-full bg-[#18181B] hover:bg-[#D96B43] text-white text-xs sm:text-sm font-semibold transition-all"
              >
                {stepIdx + 1 < activeQueue.length
                  ? "Continuer"
                  : "Voir le Bilan de la Session"}
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* ====================================================================
          4. MODALE PARAMÈTRES (AVEC ACCORDÉON DES 8 MODES, ESCALADE & AUDIO)
      ==================================================================== */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1C1917] border border-[#E6DCD0] dark:border-stone-800 w-full max-w-xl rounded-2xl shadow-2xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-[#EFEAE2] dark:border-stone-800 pb-4">
              <h2 className="font-serif text-xl font-bold text-[#18181B] dark:text-stone-100">
                Paramètres
              </h2>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. BLOC MODE D'APPRENTISSAGE (SÉLECTION EXCLUSIVE) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Mode d'apprentissage
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({ ...c, engineMode: "fluid" }))
                  }
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    config.engineMode === "fluid"
                      ? "border-[#D96B43] bg-[#D96B43]/10 shadow-sm"
                      : "border-[#E6DCD0] dark:border-stone-700 bg-[#FAF8F5]/50 dark:bg-stone-900/40 hover:border-stone-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs sm:text-sm font-bold text-[#18181B] dark:text-stone-100">
                      Mode fluide
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        config.engineMode === "fluid"
                          ? "border-[#D96B43] bg-[#D96B43]"
                          : "border-stone-400"
                      }`}
                    >
                      {config.engineMode === "fluid" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    Enchaîne de façon continue les différents formats de questions pour un apprentissage dynamique.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      engineMode: "spaced_repetition",
                    }))
                  }
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    config.engineMode === "spaced_repetition"
                      ? "border-[#D96B43] bg-[#D96B43]/10 shadow-sm"
                      : "border-[#E6DCD0] dark:border-stone-700 bg-[#FAF8F5]/50 dark:bg-stone-900/40 hover:border-stone-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs sm:text-sm font-bold text-[#18181B] dark:text-stone-100">
                      Mode Flashcard
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        config.engineMode === "spaced_repetition"
                          ? "border-[#D96B43] bg-[#D96B43]"
                          : "border-stone-400"
                      }`}
                    >
                      {config.engineMode === "spaced_repetition" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    Priorise les cartes recto-verso traditionnelles et la répétition espacée FSRS.
                  </p>
                </button>
              </div>
            </div>

            {/* 2. ACCORDÉON TYPES DE QUESTIONS (8 MODES) */}
            <div className="rounded-xl border border-[#E6DCD0] dark:border-stone-800 bg-[#FAF8F5]/60 dark:bg-stone-900/40 overflow-hidden">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsModalitiesExpanded((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsModalitiesExpanded((prev) => !prev);
                  }
                }}
                className="w-full p-3.5 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-stone-100/60 dark:hover:bg-stone-800/60 select-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      className={`w-4 h-4 text-stone-500 transition-transform duration-200 ${
                        isModalitiesExpanded ? "rotate-180" : ""
                      }`}
                    />
                    <span className="text-xs sm:text-sm font-bold text-[#18181B] dark:text-stone-100">
                      Types de questions
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#D96B43]/15 text-[#C85A32] dark:text-[#E8845C] text-[10px] font-mono font-bold">
                      {config.enabledModalities.length}/8
                    </span>
                  </div>
                  {!isModalitiesExpanded && (
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-1">
                      {MODALITY_METADATA.filter((m) =>
                        config.enabledModalities.includes(m.id)
                      )
                        .map((m) => m.label)
                        .join(", ")}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfig((c) => ({
                      ...c,
                      enabledModalities: MODALITY_METADATA.map((m) => m.id),
                    }));
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#D96B43] hover:bg-[#D96B43]/10 transition-colors shrink-0"
                >
                  Réinitialiser
                </button>
              </div>

              {isModalitiesExpanded && (
                <div className="p-3.5 pt-1 space-y-3 border-t border-[#EFEAE2] dark:border-stone-800">
                  <div className="px-3 py-2 rounded-lg bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] dark:border-stone-800 text-[11px] text-stone-600 dark:text-stone-400 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#D96B43] shrink-0" />
                    <span>
                      Des types de questions plus variés pour une meilleure ancrage mnésique et clinique.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {MODALITY_METADATA.map((m) => {
                      const isActive = config.enabledModalities.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setConfig((c) => {
                              const exists = c.enabledModalities.includes(m.id);
                              if (exists && c.enabledModalities.length <= 1) {
                                return c; // Au moins 1 type actif
                              }
                              return {
                                ...c,
                                enabledModalities: exists
                                  ? c.enabledModalities.filter((id) => id !== m.id)
                                  : [...c.enabledModalities, m.id],
                              };
                            });
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            isActive
                              ? "border-[#D96B43] bg-white dark:bg-stone-800 text-[#18181B] dark:text-stone-100 shadow-xs"
                              : "border-[#E6DCD0] dark:border-stone-800 bg-stone-100/60 dark:bg-stone-900 text-stone-400 opacity-60"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold truncate">
                              {m.label}
                            </span>
                            {isActive && (
                              <Check className="w-3.5 h-3.5 text-[#D96B43] shrink-0" />
                            )}
                          </div>
                          <span className="text-[10px] text-stone-500 dark:text-stone-400 block truncate mt-0.5">
                            {m.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 3. CYCLE & PARCOURS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
                  Flashcards par cycle
                </label>
                <div className="h-11 rounded-xl border border-[#E6DCD0] dark:border-stone-800 flex items-center justify-between px-4 bg-white dark:bg-stone-900">
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        cardsPerCycle: Math.max(4, c.cardsPerCycle - 2),
                      }))
                    }
                    className="p-1 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800"
                  >
                    <Minus className="w-4 h-4 text-stone-600 dark:text-stone-300" />
                  </button>
                  <span className="text-sm font-semibold">
                    {config.cardsPerCycle}{" "}
                    <span className="text-stone-400">/ {activeDeckEntry.cards.length}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        cardsPerCycle: Math.min(20, c.cardsPerCycle + 2),
                      }))
                    }
                    className="p-1 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800"
                  >
                    <Plus className="w-4 h-4 text-stone-600 dark:text-stone-300" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
                  Parcours du cours
                </label>
                <select
                  value={config.sortBy}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, sortBy: e.target.value as any }))
                  }
                  className="w-full h-11 rounded-xl border border-[#E6DCD0] dark:border-stone-800 bg-white dark:bg-stone-900 px-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#D96B43]"
                >
                  <option value="chronological_course">
                    Ordre chronologique (De l'intro à la conclusion)
                  </option>
                  <option value="weakest_first">Priorité aux points non maîtrisés</option>
                  <option value="random">Aléatoire</option>
                </select>
              </div>
            </div>

            {/* 4. NOMBRE DE COUPS AUTORISÉS */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#D96B43]" />
                Nombre de coups autorisés par carte
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {([1, 2, 3] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setConfig((c) => ({ ...c, maxMovesPerCard: m }))}
                    className={`h-10 rounded-xl border-2 text-xs font-bold transition-all ${
                      config.maxMovesPerCard === m
                        ? "border-[#D96B43] bg-[#D96B43]/10 text-[#C85A32] dark:text-[#E8845C]"
                        : "border-[#E6DCD0] dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-400"
                    }`}
                  >
                    {m} {m > 1 ? "coups" : "coup"}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. SWITCHES ROTATION & EFFETS SONORES */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] dark:border-stone-800">
                <div className="pr-3">
                  <p className="text-xs sm:text-sm font-bold text-[#18181B] dark:text-stone-100">
                    Rotation des formes & Escalade de difficulté
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Change automatiquement le type de question et augmente le niveau à chaque nouvelle session
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      difficultyEscalation: !c.difficultyEscalation,
                    }))
                  }
                  className={`w-12 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                    config.difficultyEscalation ? "bg-[#D96B43]" : "bg-stone-300 dark:bg-stone-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      config.difficultyEscalation ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] dark:border-stone-800">
                <div className="pr-3">
                  <p className="text-xs sm:text-sm font-bold text-[#18181B] dark:text-stone-100">
                    Effets sonores
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Retour audio interactif lors de la validation ou d'un nouvel essai
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      soundEffects: !c.soundEffects,
                    }))
                  }
                  className={`w-12 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                    config.soundEffects ? "bg-[#D96B43]" : "bg-stone-300 dark:bg-stone-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      config.soundEffects ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsSettingsOpen(false);
                resetCardInteraction();
              }}
              className="w-full py-3.5 rounded-full bg-[#18181B] dark:bg-stone-100 hover:bg-[#D96B43] dark:hover:bg-[#D96B43] text-white dark:text-[#18181B] dark:hover:text-white text-sm font-bold transition-colors shadow-sm"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          5. MODALE DE SORTIE (CALENDRIER HEBDOMADAIRE, SÉRIE & PROGRESSION)
      ==================================================================== */}
      {isExitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1C1917] border border-[#E6DCD0] dark:border-stone-800 w-full max-w-md rounded-2xl shadow-2xl p-6 sm:p-7 text-center space-y-5">
            {/* Badge de série */}
            <div className="mx-auto w-20 h-24 rounded-full bg-[#FAF8F5] dark:bg-stone-900 border border-[#E6DCD0] dark:border-stone-800 flex flex-col items-center justify-center shadow-xs">
              <Flame className="w-8 h-8 text-[#D96B43] mb-0.5 animate-pulse" />
              <span className="text-3xl font-extrabold text-[#18181B] dark:text-stone-100">
                {streakDays}
              </span>
            </div>

            {/* Calendrier hebdomadaire 7 jours */}
            <div className="space-y-2">
              <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Jours de série cette semaine
              </p>
              <div className="flex items-center justify-center gap-2">
                {[
                  { day: "L", done: true },
                  { day: "M", done: true },
                  { day: "M", done: true },
                  { day: "J", today: true },
                  { day: "V", done: false },
                  { day: "S", done: false },
                  { day: "D", done: false },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-mono font-bold text-stone-500">
                      {item.day}
                    </span>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        item.today
                          ? "border-2 border-dashed border-[#D96B43] bg-[#D96B43]/15 text-[#C85A32]"
                          : item.done
                          ? "bg-[#D96B43] text-white"
                          : "bg-stone-100 dark:bg-stone-800 text-stone-400"
                      }`}
                    >
                      {item.done ? (
                        <Flame className="w-4 h-4 fill-current" />
                      ) : item.today ? (
                        <span className="w-2 h-2 rounded-full bg-[#D96B43]" />
                      ) : (
                        <span className="text-[10px] font-mono">II</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progression dans la session en cours */}
            <div className="space-y-1.5 px-2">
              <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
                <span>Cartes validées</span>
                <span className="font-mono font-bold text-[#18181B] dark:text-stone-100">
                  {stepIdx} / {activeQueue.length}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-[#D96B43] transition-all duration-300"
                  style={{
                    width: `${
                      activeQueue.length > 0
                        ? Math.round((stepIdx / activeQueue.length) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-serif text-lg sm:text-xl font-bold text-[#18181B] dark:text-stone-100 leading-snug">
                Termine ta session d'apprentissage pour valider ton bilan !
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Tes progrès sur cette session seront enregistrés dans ta bibliothèque adaptative.
              </p>
            </div>

            {/* Case à cocher "Ne plus me demander" */}
            <label className="flex items-center justify-center gap-2 cursor-pointer select-none text-xs text-stone-600 dark:text-stone-400 pt-1">
              <input
                type="checkbox"
                checked={dontShowExitAgain}
                onChange={(e) => {
                  const val = e.target.checked;
                  setDontShowExitAgain(val);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("dawjang_skip_smart_exit_modal", String(val));
                  }
                }}
                className="w-4 h-4 rounded border-[#E6DCD0] text-[#D96B43] focus:ring-[#D96B43]"
              />
              <span>Ne plus me demander avant de quitter</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleConfirmExitPage}
                className="py-3 px-4 rounded-full border border-[#E6DCD0] dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                Quitter la session
              </button>
              <button
                type="button"
                onClick={() => setIsExitModalOpen(false)}
                className="py-3 px-4 rounded-full bg-[#18181B] dark:bg-stone-100 hover:bg-[#D96B43] dark:hover:bg-[#D96B43] text-white dark:text-[#18181B] dark:hover:text-white text-xs font-semibold transition-colors shadow-sm"
              >
                Poursuivre l'apprentissage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartFlashcardsPage;
