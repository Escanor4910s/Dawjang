import { untypedTable } from "@/lib/untypedDb";
// src/pages/Flashcards.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Layers,
  GitBranch,
  RotateCcw,
  Eye,
  Plus,
  Edit3,
  Sparkles,
  Save,
  FileUp,
  Target,
  Shuffle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Trash2,
  Play,
  SkipForward,
  Quote,
  Clock,
  Cpu,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getSavedCourses, StoredCourse, COURSES_STORAGE_KEY } from "./Library";
import { getSavedQuizDecks, QuizDeck } from "./Quiz";
import {
  getCourseQcmErrorStatus,
  buildCourseFailedQcmFlashcards,
} from "@/lib/flashcards/qcmErrorMatcher";
import { getSavedStudentProfile } from "./Settings";
import { useToast } from "@/hooks/use-toast";
import { useFileReader } from "@/hooks/useFileReader";
import { cn } from "@/lib/utils";
import {
  permanentlyDeleteEntity,
  permanentlyDeleteFlashcardNode,
  permanentlyDeleteFlashcardLesson,
  isFlashcardNodeTombstoned,
  isFlashcardLessonTombstoned,
  unTombstoneFlashcardNode,
  unTombstoneFlashcardLesson,
  filterOutTombstoned,
} from "@/lib/syncEngine";

import { previewRatings, scheduleReview, createNewSrsState, type SrsRating } from "@/lib/flashcards/fsrs";
import type { CalibratedFlashcard, FlashcardOriginMode } from "@/lib/flashcards/types";
import { loadFlashcards, saveFlashcards } from "@/lib/flashcards/store";
import {
  formatLessonTitle,
  generateLocalFlashcards,
  countRemainingNotions,
} from "@/lib/flashcards/localGenerator";
import { generateAiFlashcards } from "@/lib/flashcards/aiGenerator";
import {
  buildStudySession,
  computeScopeStats,
  recordSession,
} from "@/lib/flashcards/sessionBuilder";
import { assessCourseContent, makeContentKey, normalizeForKey } from "@/lib/flashcards/text";

const CONTENT_PROBLEM_MESSAGES: Record<string, string> = {
  empty: "Ce cours ne contient presque aucun texte.",
  placeholder:
    "Seul le titre de ce cours a été enregistré : le texte du fichier n'a pas pu être lu lors de l'import.",
  garbled:
    "Le texte enregistré pour ce cours est illisible (fichier PDF/Word/PowerPoint importé sans extraction).",
};

export type {
  CalibratedFlashcard,
  CourseFlashcard,
  FlashcardOriginMode,
  QcmPropositionItem,
} from "@/lib/flashcards/types";

const CUSTOM_NODES_STORAGE_KEY = "hippocampus_student_custom_nodes_v2";

const DEFAULT_CUSTOM_NODES = [
  "Objectifs du cours",
  "Points essentiels",
  "Clinique & Diagnostic",
  "Traitement",
  "Erreurs QCM",
];

const SESSION_SIZES = [10, 20, 30, 50];
const GENERATION_SIZES = [8, 12, 20];

const RATING_BUTTONS: Array<{ rating: SrsRating; label: string; key: string; tone: string }> = [
  { rating: 1, label: "À revoir", key: "1", tone: "hover:border-destructive hover:bg-destructive/10" },
  { rating: 2, label: "Difficile", key: "2", tone: "hover:border-amber-500 hover:bg-amber-500/10" },
  { rating: 3, label: "Correct", key: "3", tone: "hover:border-primary hover:bg-primary/10" },
  { rating: 4, label: "Facile", key: "4", tone: "hover:border-emerald-500 hover:bg-emerald-500/10" },
];

/**
 * Compatibilité : ancienne API publique du noyau.
 * Produit désormais un lot de cartes atomiques extraites du cours (moteur local).
 */
export function buildCoreFlashcardsForCourse(
  course: StoredCourse,
  mode: "objectives" | "relevance",
  customNode: string
): CalibratedFlashcard[] {
  return generateLocalFlashcards(course, mode, customNode, [], 12);
}

/**
 * Mode 3 : Génère les flashcards à partir des Erreurs QCM (Classique & Jumelage)
 */
function buildFailedQcmFlashcards(decks: QuizDeck[], customNode: string): CalibratedFlashcard[] {
  const now = Date.now();
  const cards: CalibratedFlashcard[] = [];

  decks.forEach((deck) => {
    (deck.questions || []).forEach((q, idx) => {
      const isJumelage = q.options.length === 2;
      cards.push({
        id: `fc-qcm-err-${deck.id}-${idx}-${now}`,
        courseId: deck.id,
        lessonTitle: formatLessonTitle(deck.title),
        subject: deck.subject || "QCM",
        customNode: customNode || "Erreurs QCM",
        originMode: "qcm_error",
        qcmType: isJumelage ? "jumelage" : "multiple",
        question: q.question,
        answerSummary: q.explanation,
        answerDetails: [],
        qcmPropositions: q.options.map((o) => ({
          label: o.label,
          text: o.text,
          isCorrect: o.isCorrect,
        })),
        qcmExplanation: q.explanation,
        format: "qcm",
        generator: "qcm",
        contentKey: makeContentKey(q.question, q.explanation || ""),
        createdAt: now,
        intervalDays: 0,
        repetitionCount: 0,
        status: "new",
        srs: createNewSrsState(now),
      });
    });
  });

  return cards;
}

/** Affiche une question « cloze » avec un trou stylisé à la place de […] */
function ClozePrompt({ text }: { text: string }) {
  const parts = text.split("[…]");
  return (
    <>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {p}
          {i < parts.length - 1 && (
            <span className="inline-block min-w-[4.5rem] mx-1 border-b-2 border-dashed border-primary align-baseline text-primary">
              &nbsp;?&nbsp;
            </span>
          )}
        </React.Fragment>
      ))}
    </>
  );
}

/** Affiche la phrase complète en surlignant le terme masqué ({{c1::terme}}) */
function ClozeReveal({ cloze }: { cloze: string }) {
  const segments = cloze.split(/(\{\{c\d+::.+?\}\})/g);
  return (
    <>
      {segments.map((seg, i) => {
        const m = seg.match(/^\{\{c\d+::(.+?)(?:::[^}]*)?\}\}$/);
        return m ? (
          <mark key={i} className="rounded px-1 bg-primary/15 text-primary font-semibold">
            {m[1]}
          </mark>
        ) : (
          <React.Fragment key={i}>{seg}</React.Fragment>
        );
      })}
    </>
  );
}

interface ActiveSession {
  scopeKey: string;
  ids: string[];
  index: number;
  requeues: Record<string, number>;
  results: Record<SrsRating, number>;
  startedAt: number;
}

export default function Flashcards() {
  const { toast } = useToast();
  const { readFile, isReading: isReadingUploadedFile } = useFileReader();
  const [courses, setCourses] = useState<StoredCourse[]>([]);
  const [cards, setCards] = useState<CalibratedFlashcard[]>([]);
  const [customNodes, setCustomNodes] = useState<string[]>(DEFAULT_CUSTOM_NODES);

  const [viewMode, setViewMode] = useState<"serial" | "nodes" | "create">("serial");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("ALL");
  const [selectedNodeFilter, setSelectedNodeFilter] = useState<string>("ALL");

  // Session d'étude
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [finishedSession, setFinishedSession] = useState<ActiveSession | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionSize, setSessionSize] = useState<number>(20);

  // Réglages synchronisés avec Paramètres
  const [retention, setRetention] = useState<number>(() => {
    const p = getSavedStudentProfile();
    return Math.min(0.97, Math.max(0.7, (p.targetRetention || 90) / 100));
  });
  const [dailyCap, setDailyCap] = useState<number>(() => getSavedStudentProfile().dailyCap || 50);

  // Création d'un Nœud Personnalisé
  const [newNodeNameInput, setNewNodeNameInput] = useState("");
  const [showAddNodeInput, setShowAddNodeInput] = useState(false);

  // Studio « Nouvelle Carte »
  const [creationTab, setCreationTab] = useState<"ai" | "manual">("ai");
  const [aiCalibrationMode, setAiCalibrationMode] = useState<FlashcardOriginMode>(() => {
    const p = getSavedStudentProfile();
    return (p.defaultFlashcardMode as FlashcardOriginMode) || "objectives";
  });
  const [generationCount, setGenerationCount] = useState<number>(12);
  const [engineChoice, setEngineChoice] = useState<"ai" | "local">("ai");
  const [selectedBackendCourseId, setSelectedBackendCourseId] = useState<string>("");
  const [selectedTargetNode, setSelectedTargetNode] = useState<string>("Objectifs du cours");
  const [uploadedCourseText, setUploadedCourseText] = useState<string>("");
  const [uploadedCourseTitle, setUploadedCourseTitle] = useState<string>("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [savedDecks, setSavedDecks] = useState<QuizDeck[]>([]);

  // Synchronise les QCM enregistrés pour l'analyse des erreurs
  useEffect(() => {
    setSavedDecks(getSavedQuizDecks());
  }, [viewMode]);

  const activeTargetCourse = useMemo((): StoredCourse | undefined => {
    if (selectedBackendCourseId === "UPLOADED_DIRECT" && uploadedCourseText.trim()) {
      const title = uploadedCourseTitle.trim() || "Nouvelle leçon";
      return {
        id: `uploaded-${normalizeForKey(title).replace(/\s+/g, "-") || "lecon"}`,
        code: "COURS",
        title,
        subject: "Cours importé",
        updatedAt: "Aujourd'hui",
        wordCount: uploadedCourseText.split(/\s+/).length,
        content: uploadedCourseText,
      };
    }
    return courses.find((c) => c.id === selectedBackendCourseId) || courses[0];
  }, [selectedBackendCourseId, uploadedCourseText, uploadedCourseTitle, courses]);

  // Analyse si un QCM fait avec ce cours existe et contient des erreurs
  const courseQcmStatus = useMemo(
    () => getCourseQcmErrorStatus(activeTargetCourse, savedDecks),
    [activeTargetCourse, savedDecks]
  );

  // Bascule automatique si le mode QCM est inaccessible pour ce cours
  useEffect(() => {
    if (aiCalibrationMode === "qcm_error" && !courseQcmStatus.isAccessible) {
      setAiCalibrationMode("objectives");
    }
  }, [courseQcmStatus.isAccessible, aiCalibrationMode]);

  // États Création Manuelle
  const [manualLessonTitle, setManualLessonTitle] = useState("");
  const [manualNode, setManualNode] = useState("Objectifs du cours");
  const [manualQuestion, setManualQuestion] = useState("");
  const [manualSummary, setManualSummary] = useState("");
  const [manualDetails, setManualDetails] = useState("");

  const persistCards = useCallback((updated: CalibratedFlashcard[]) => {
    setCards(updated);
    saveFlashcards(updated);
  }, []);

  useEffect(() => {
    // Nettoyage des anciennes clés obsolètes
    localStorage.removeItem("hippocampus_calibrated_flashcards_v5");
    localStorage.removeItem("hippocampus_clinical_flashcards_v4");
    localStorage.removeItem("hippocampus_course_nodes_flashcards_v3");

    const savedNodes = localStorage.getItem(CUSTOM_NODES_STORAGE_KEY);
    if (savedNodes !== null) {
      try {
        const parsed = JSON.parse(savedNodes);
        if (Array.isArray(parsed)) {
          const activeNodes = parsed.filter((n: string) => !isFlashcardNodeTombstoned(n));
          setCustomNodes(activeNodes);
          if (activeNodes.length > 0) {
            setSelectedTargetNode(activeNodes[0]);
            setManualNode(activeNodes[0]);
          }
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      const initialNodes = DEFAULT_CUSTOM_NODES.filter((n) => !isFlashcardNodeTombstoned(n));
      setCustomNodes(initialNodes);
    }

    const loadAllData = async () => {
      const allCourses = [...getSavedCourses()];

      try {
        const { data: sbCourses } = await untypedTable("courses").select("*").limit(50);
        if (sbCourses && Array.isArray(sbCourses) && sbCourses.length > 0) {
          const ids = new Set(allCourses.map((c) => c.id));
          sbCourses.forEach((row: any) => {
            const id = String(row.id);
            if (ids.has(id)) return;
            const content = row.content || row.summary || "";
            allCourses.push({
              id,
              code: row.code || "COURS",
              title: row.title || row.name || "Cours",
              subject: row.subject || row.category || "Médecine",
              updatedAt: "Enregistré",
              wordCount: content.split(/\s+/).length,
              content,
            });
          });
        }
      } catch {
        // Repli local
      }

      setCourses(allCourses);
      if (allCourses.length > 0) {
        setSelectedBackendCourseId(allCourses[0].id);
        setManualLessonTitle(formatLessonTitle(allCourses[0].title));
      }

      const stored = filterOutTombstoned("flashcard", loadFlashcards());
      persistCards(stored);
    };

    loadAllData();

    const syncProfileSettings = () => {
      const p = getSavedStudentProfile();
      if (p.defaultFlashcardMode) setAiCalibrationMode(p.defaultFlashcardMode as FlashcardOriginMode);
      setRetention(Math.min(0.97, Math.max(0.7, (p.targetRetention || 90) / 100)));
      setDailyCap(p.dailyCap || 50);
    };
    window.addEventListener("hippocampus-profile-updated", syncProfileSettings);
    return () => window.removeEventListener("hippocampus-profile-updated", syncProfileSettings);
  }, [persistCards]);

  const persistCustomNodes = (updated: string[]) => {
    setCustomNodes(updated);
    localStorage.setItem(CUSTOM_NODES_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleCreateCustomNode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newNodeNameInput.trim();
    if (!clean) return;
    unTombstoneFlashcardNode(clean);
    if (!customNodes.includes(clean)) {
      persistCustomNodes([...customNodes, clean]);
      setSelectedTargetNode(clean);
      setManualNode(clean);
    }
    setNewNodeNameInput("");
    setShowAddNodeInput(false);
    toast({ title: "Nœud personnalisé créé", description: `Le nœud « ${clean} » est maintenant actif.` });
  };

  const handleDeleteCustomNode = async (nodeName: string) => {
    const cleanNode = nodeName.trim();
    if (!cleanNode) return;

    const cardsInNode = cards.filter((c) => c.customNode === cleanNode);
    await permanentlyDeleteFlashcardNode(cleanNode, cardsInNode);

    const remainingNodes = customNodes.filter((n) => n !== cleanNode);
    persistCustomNodes(remainingNodes);

    const remainingCards = filterOutTombstoned(
      "flashcard",
      cards.filter((c) => c.customNode !== cleanNode)
    );
    persistCards(remainingCards);

    if (selectedNodeFilter === cleanNode) setSelectedNodeFilter("ALL");
    if (selectedTargetNode === cleanNode) {
      setSelectedTargetNode(remainingNodes[0] || "Objectifs du cours");
    }
    if (manualNode === cleanNode) {
      setManualNode(remainingNodes[0] || "Objectifs du cours");
    }

    toast({
      title: "Nœud supprimé définitivement",
      description: `Le nœud « ${cleanNode} » et ses ${cardsInNode.length} flashcard(s) associée(s) ont été définitivement retirés.`,
    });
  };

  const handleDeleteLessonFlashcards = async (lessonTitle: string) => {
    const cleanLesson = lessonTitle.trim();
    if (!cleanLesson) return;

    const cardsInLesson = cards.filter((c) => c.lessonTitle === cleanLesson);
    await permanentlyDeleteFlashcardLesson(cleanLesson, cardsInLesson);

    const remainingCards = filterOutTombstoned(
      "flashcard",
      cards.filter((c) => c.lessonTitle !== cleanLesson)
    );
    persistCards(remainingCards);

    if (selectedCourseFilter === cleanLesson) {
      setSelectedCourseFilter("ALL");
    }
    resetSessionView();

    toast({
      title: "Série de flashcards supprimée définitivement",
      description: `Les ${cardsInLesson.length} flashcard(s) de « ${cleanLesson} » ont été supprimées et ne réapparaîtront plus.`,
    });
  };

  const handleDeleteSpecificCard = async (card: CalibratedFlashcard) => {
    await permanentlyDeleteEntity(
      "flashcard",
      card.id,
      card.question,
      card.contentKey ? [`key:${card.contentKey}`] : undefined
    );
    const nextCards = filterOutTombstoned(
      "flashcard",
      cards.filter((c) => c.id !== card.id)
    );
    persistCards(nextCards);
    toast({
      title: "Flashcard supprimée définitivement",
      description: "Cette carte a été retirée de façon permanente.",
    });
  };

  const handleDirectUploadInBuilder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
    const result = await readFile(file);
    if (!result.success || assessCourseContent(result.content) !== "ok") {
      toast({
        title: "Impossible d'extraire le texte de ce fichier",
        description:
          result.error ||
          "Ce document ne contient pas de texte sélectionnable (ex. PDF scanné sous forme d'images). Exportez-le en PDF texte ou en .docx.",
        variant: "destructive",
      });
      return;
    }

    // Si un cours enregistré porte le même titre ou si le cours actuellement sélectionné avait un texte cassé, on le répare directement
    const currentSelected = courses.find((c) => c.id === selectedBackendCourseId);
    const matchingByTitle = courses.find(
      (c) =>
        (c.title || "").trim().toLowerCase() === (cleanTitle || "").trim().toLowerCase() ||
        formatLessonTitle(c.title || "").toLowerCase() === formatLessonTitle(cleanTitle || "").toLowerCase()
    );
    const courseToRepair =
      matchingByTitle ||
      (currentSelected && assessCourseContent(currentSelected.content) !== "ok" ? currentSelected : undefined);

    if (courseToRepair) {
      const repaired: StoredCourse = {
        ...courseToRepair,
        content: result.content,
        wordCount: Math.max(1, result.content.trim().split(/\s+/).filter(Boolean).length),
        updatedAt: "Aujourd'hui",
      };
      const updatedCourses = courses.map((c) => (c.id === repaired.id ? repaired : c));
      setCourses(updatedCourses);
      try {
        localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(updatedCourses));
      } catch {
        // ignore quota errors
      }
      setSelectedBackendCourseId(repaired.id);
      toast({
        title: "Cours réparé et prêt",
        description: `Le texte complet de « ${repaired.title} » (${repaired.wordCount} mots) a été extrait et enregistré.`,
      });
      return;
    }

    setUploadedCourseTitle(cleanTitle);
    setUploadedCourseText(result.content);
    setSelectedBackendCourseId("UPLOADED_DIRECT");
    toast({
      title: "Cours chargé",
      description: `« ${cleanTitle} » (${result.content.trim().split(/\s+/).length} mots) est prêt pour la génération de flashcards.`,
    });
  };

  const resetSessionView = () => {
    setSession(null);
    setFinishedSession(null);
    setIsFlipped(false);
  };

  // ───────────────────────── Génération (additive, jamais destructive) ─────────────────────────
  const handleRunAiCalibration = async () => {
    setIsGeneratingAi(true);
    try {
      const finalNode = (newNodeNameInput.trim() ? newNodeNameInput.trim() : selectedTargetNode) || "Objectifs du cours";
      unTombstoneFlashcardNode(finalNode);
      if (!customNodes.includes(finalNode)) {
        persistCustomNodes([...customNodes, finalNode]);
        setNewNodeNameInput("");
      }

      const targetCourse = activeTargetCourse;
      if (!targetCourse) {
        toast({
          title: "Aucun cours sélectionné",
          description: "Veuillez choisir un cours ou importer un fichier.",
          variant: "destructive",
        });
        return;
      }

      const contentStatus = assessCourseContent(targetCourse.content);
      if (contentStatus !== "ok") {
        toast({
          title: "Impossible de générer : texte du cours inexploitable",
          description: `${CONTENT_PROBLEM_MESSAGES[contentStatus]} Utilisez le bouton rouge « Réparer avec le fichier (.pdf, .docx…) » pour recharger le document original.`,
          variant: "destructive",
        });
        return;
      }

      const lesson = formatLessonTitle(targetCourse.title);
      unTombstoneFlashcardLesson(lesson);

      // Mode 3 : Depuis mes Erreurs QCM
      if (aiCalibrationMode === "qcm_error") {
        if (!courseQcmStatus.isAccessible || courseQcmStatus.failedQuestions.length === 0) {
          toast({
            title: "Fonctionnalité inaccessible",
            description: courseQcmStatus.statusMessage,
            variant: "destructive",
          });
          return;
        }

        const existingQ = new Set(
          cards.filter((c) => c.originMode === "qcm_error").map((c) => normalizeForKey(c.question))
        );
        const fresh = buildCourseFailedQcmFlashcards(
          targetCourse,
          courseQcmStatus.failedQuestions,
          finalNode
        ).filter((c) => !existingQ.has(normalizeForKey(c.question)));

        if (fresh.length === 0) {
          toast({
            title: "Toutes vos erreurs QCM sont déjà converties",
            description: "Chaque question ratée sur le QCM de ce cours est déjà dans votre banque.",
          });
          return;
        }

        persistCards([...fresh, ...cards]);
        setSelectedCourseFilter(lesson);
        setSelectedNodeFilter(finalNode);
        resetSessionView();
        setViewMode("serial");
        toast({
          title: `${fresh.length} flashcards d'erreurs QCM ajoutées`,
          description: `Générées à partir de vos erreurs sur « ${targetCourse.title} ».`,
        });
        return;
      }

      // Mode 1 (« À partir des Objectifs ») et Mode 2 (« Aléatoire par Pertinence »)
      const existing = cards.filter((c) => c.courseId === targetCourse.id || c.lessonTitle === lesson);
      const mode = aiCalibrationMode === "relevance" ? "relevance" : "objectives";

      let generated: CalibratedFlashcard[] = [];
      let engine: "ai" | "local" = engineChoice;

      if (engineChoice === "ai") {
        try {
          generated = await generateAiFlashcards({
            course: targetCourse,
            mode,
            customNode: finalNode,
            count: generationCount,
            existingForCourse: existing,
            studyLevel: getSavedStudentProfile().studyLevel,
          });
        } catch {
          // Bascule transparente sur le moteur médical local de haute précision
          engine = "local";
          generated = generateLocalFlashcards(targetCourse, mode, finalNode, existing, generationCount);
        }
      } else {
        generated = generateLocalFlashcards(targetCourse, mode, finalNode, existing, generationCount);
      }

      if (generated.length === 0) {
        toast({
          title: "Aucune nouvelle carte à ajouter",
          description: "Toutes les notions de ce cours sont déjà couvertes dans votre banque de révision.",
        });
        return;
      }

      persistCards([...generated, ...cards]);
      setSelectedCourseFilter(lesson);
      setSelectedNodeFilter(finalNode);
      resetSessionView();
      setViewMode("serial");

      toast({
        title: `${generated.length} nouvelles flashcards calibrées`,
        description:
          engine === "ai"
            ? mode === "objectives"
              ? `Questions d'objectifs et réponses précises générées sur « ${lesson} ».`
              : `Questions et affirmations cliniques calibrées sur « ${lesson} ».`
            : `Questions et réponses cliniques extraites avec précision de « ${lesson} ».`,
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCreateManualFlashcard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuestion.trim() || !manualSummary.trim()) {
      toast({
        title: "Champs requis",
        description: "Veuillez saisir la question et la réponse principale.",
        variant: "destructive",
      });
      return;
    }
    const details = manualDetails
      .split("\n")
      .map((l) => l.replace(/^[•\-*]\s*/, "").trim())
      .filter(Boolean);
    const cleanLesson = formatLessonTitle(manualLessonTitle.trim() || "Ma leçon");
    const targetNode = manualNode || "Objectifs du cours";
    unTombstoneFlashcardNode(targetNode);
    unTombstoneFlashcardLesson(cleanLesson);
    if (!customNodes.includes(targetNode)) {
      persistCustomNodes([...customNodes, targetNode]);
    }
    const now = Date.now();

    const newCard: CalibratedFlashcard = {
      id: `fc-man-${now}`,
      courseId: `man-${normalizeForKey(cleanLesson).replace(/\s+/g, "-")}`,
      lessonTitle: cleanLesson,
      subject: cleanLesson,
      customNode: targetNode,
      originMode: "manual",
      question: manualQuestion.trim(),
      answerSummary: manualSummary.trim(),
      answerDetails: details,
      format: "qa",
      generator: "manual",
      importance: 4,
      contentKey: makeContentKey(manualQuestion, manualSummary),
      createdAt: now,
      intervalDays: 0,
      repetitionCount: 0,
      status: "new",
      srs: createNewSrsState(now),
    };

    persistCards([newCard, ...cards]);
    setManualQuestion("");
    setManualSummary("");
    setManualDetails("");
    setSelectedCourseFilter(cleanLesson);
    setSelectedNodeFilter(targetNode);
    resetSessionView();
    setViewMode("serial");
    toast({ title: "Flashcard ajoutée", description: `Enregistrée dans le nœud « ${targetNode} ».` });
  };

  /** Complète les cours non supprimés sans cartes (ne ressuscite jamais une leçon ou carte supprimée) */
  const handlePurgeAndRecalibrateAll = () => {
    const additions: CalibratedFlashcard[] = [];
    const defaultNode = customNodes[0] || "Objectifs du cours";
    courses.forEach((c) => {
      const lesson = formatLessonTitle(c.title);
      if (isFlashcardLessonTombstoned(lesson)) return;
      const existing = cards.filter((x) => x.courseId === c.id || x.lessonTitle === lesson);
      if (existing.length === 0) {
        additions.push(...generateLocalFlashcards(c, "objectives", defaultNode, [], 12));
      }
    });
    const cleaned = filterOutTombstoned("flashcard", loadFlashcards());
    persistCards(filterOutTombstoned("flashcard", [...additions, ...cleaned]));
    resetSessionView();
    toast({
      title: "Banque recalibrée",
      description: additions.length
        ? `${additions.length} cartes créées pour les nouvelles leçons. Les éléments supprimés restent définitivement exclus.`
        : "Votre banque est à jour et toutes les suppressions sont verrouillées.",
    });
  };

  // ───────────────────────── Périmètre & session ─────────────────────────
  const scopePool = useMemo(
    () =>
      cards.filter(
        (c) =>
          (selectedCourseFilter === "ALL" || c.lessonTitle === selectedCourseFilter) &&
          (selectedNodeFilter === "ALL" || c.customNode === selectedNodeFilter)
      ),
    [cards, selectedCourseFilter, selectedNodeFilter]
  );
  const scopeKey = `${selectedCourseFilter}::${selectedNodeFilter}`;
  const scopeStats = useMemo(() => computeScopeStats(scopePool), [scopePool]);

  // Changer de filtre interrompt la session en cours
  useEffect(() => {
    if (session && session.scopeKey !== scopeKey) resetSessionView();
  }, [scopeKey, session]);

  const startSession = () => {
    const ids = buildStudySession(scopePool, {
      size: sessionSize,
      newLimit: Math.max(3, Math.min(sessionSize, Math.round(dailyCap / 2))),
      scopeKey,
    });
    if (ids.length === 0) return;
    recordSession(scopeKey, ids);
    setFinishedSession(null);
    setIsFlipped(false);
    setSession({
      scopeKey,
      ids,
      index: 0,
      requeues: {},
      results: { 1: 0, 2: 0, 3: 0, 4: 0 },
      startedAt: Date.now(),
    });
  };

  const currentCard = useMemo(() => {
    if (!session) return null;
    return cards.find((c) => c.id === session.ids[session.index]) || null;
  }, [session, cards]);

  // Carte supprimée entre-temps : on avance automatiquement
  useEffect(() => {
    if (session && !currentCard && session.index < session.ids.length) {
      const ids = session.ids.filter((id) => cards.some((c) => c.id === id));
      if (ids.length === 0 || session.index >= ids.length) {
        setFinishedSession({ ...session, ids });
        setSession(null);
      } else {
        setSession({ ...session, ids });
      }
    }
  }, [session, currentCard, cards]);

  const ratingPreview = useMemo(
    () => (currentCard ? previewRatings(currentCard.srs, Date.now(), retention) : null),
    [currentCard, retention]
  );

  const advance = useCallback((next: ActiveSession) => {
    setIsFlipped(false);
    if (next.index >= next.ids.length) {
      setFinishedSession(next);
      setSession(null);
    } else {
      setSession(next);
    }
  }, []);

  const handleRate = useCallback(
    (rating: SrsRating) => {
      if (!session || !currentCard) return;
      const now = Date.now();
      const updatedCard = { ...currentCard, srs: scheduleReview(currentCard.srs, rating, now, retention) };
      persistCards(cards.map((c) => (c.id === currentCard.id ? updatedCard : c)));

      const ids = [...session.ids];
      const requeues = { ...session.requeues };
      // « À revoir » : la carte revient plus loin dans la même session (comme Anki)
      if (rating === 1 && (requeues[currentCard.id] || 0) < 2) {
        const insertAt = Math.min(ids.length, session.index + 4);
        ids.splice(insertAt, 0, currentCard.id);
        requeues[currentCard.id] = (requeues[currentCard.id] || 0) + 1;
      }
      advance({
        ...session,
        ids,
        requeues,
        index: session.index + 1,
        results: { ...session.results, [rating]: session.results[rating] + 1 },
      });
    },
    [session, currentCard, cards, retention, persistCards, advance]
  );

  const handleSkip = useCallback(() => {
    if (!session || !currentCard) return;
    const ids = [...session.ids];
    if (session.index < ids.length - 1) {
      ids.splice(session.index, 1);
      ids.push(currentCard.id);
      setIsFlipped(false);
      setSession({ ...session, ids });
    }
  }, [session, currentCard]);

  const handleDeleteCurrentCard = async () => {
    if (!currentCard) return;
    const target = currentCard;
    await permanentlyDeleteEntity(
      "flashcard",
      target.id,
      target.question
    );
    const nextCards = filterOutTombstoned(
      "flashcard",
      cards.filter((c) => c.id !== target.id)
    );
    persistCards(nextCards);
    toast({
      title: "Flashcard supprimée définitivement",
      description: "Cette carte ne réapparaîtra plus lors des actualisations.",
    });
  };

  // Raccourcis clavier : Espace = retourner, 1–4 = noter, → = passer
  useEffect(() => {
    if (viewMode !== "serial" || !session) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (isFlipped && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        handleRate(Number(e.key) as SrsRating);
      } else if (e.key === "ArrowRight") {
        handleSkip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode, session, isFlipped, handleRate, handleSkip]);

  const uniqueLessons = Array.from(new Set(cards.map((c) => c.lessonTitle)));

  const selectedCourseForHint = courses.find((c) => c.id === selectedBackendCourseId);
  const remainingNotions = useMemo(() => {
    if (!selectedCourseForHint) return null;
    const lesson = formatLessonTitle(selectedCourseForHint.title);
    if (assessCourseContent(selectedCourseForHint.content) !== "ok") return -1;
    return countRemainingNotions(
      selectedCourseForHint,
      cards.filter((c) => c.courseId === selectedCourseForHint.id || c.lessonTitle === lesson)
    );
  }, [selectedCourseForHint, cards]);

  const openGeneratorForScope = () => {
    if (selectedCourseFilter !== "ALL") {
      const match = courses.find((c) => formatLessonTitle(c.title) === selectedCourseFilter);
      if (match) setSelectedBackendCourseId(match.id);
    }
    setCreationTab("ai");
    setViewMode("create");
  };

  const sessionProgress = session ? Math.round((session.index / session.ids.length) * 100) : 0;

  return (
    <div className="space-y-6 pb-20">
      {/* =====================================================================
          1. EN-TÊTE ERGONOMIQUE SUR UNE SEULE LIGNE
         ===================================================================== */}
      <header className="flex flex-nowrap items-center justify-between gap-2.5 border-b border-border/80 pb-4 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 border border-primary/25 text-primary">
            <Layers className="h-4 w-4" />
          </div>
          <h1 className="font-serif text-xl sm:text-2xl text-foreground tracking-tight leading-none whitespace-nowrap">
            Révision & Flashcards
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
          <div className="inline-flex items-center rounded-xl border border-border bg-secondary/70 p-1">
            <button
              type="button"
              onClick={() => setViewMode("serial")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all whitespace-nowrap",
                viewMode === "serial" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>Session ({scopeStats.due} à réviser)</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("nodes")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all whitespace-nowrap",
                viewMode === "nodes" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GitBranch className="h-3.5 w-3.5 text-primary" />
              <span>Mes Nœuds</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("create")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all whitespace-nowrap",
                viewMode === "create" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span>Nouvelle Carte</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePurgeAndRecalibrateAll}
            className="h-8 rounded-xl px-3 text-[12px] whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5 text-primary" />
            <span>Recalibrer mes cours</span>
          </Button>
        </div>
      </header>

      {/* =====================================================================
          2. BARRE DE FILTRES + NŒUDS PERSONNALISÉS (AVEC SUPPRESSION DIRECTE DES NŒUDS & LEÇONS)
         ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5">
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-[12.5px] font-medium text-foreground focus:outline-none focus:border-primary max-w-[230px]"
            >
              <option value="ALL">Toutes mes leçons ({uniqueLessons.length})</option>
              {uniqueLessons.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>

            {selectedCourseFilter !== "ALL" && (
              <button
                type="button"
                onClick={() => handleDeleteLessonFlashcards(selectedCourseFilter)}
                title={`Supprimer définitivement toutes les flashcards de « ${selectedCourseFilter} »`}
                className="h-8 px-2 inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground text-[11.5px] font-medium transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Supprimer la leçon</span>
              </button>
            )}
          </div>

          <div className="h-4 w-[1px] bg-border hidden sm:block" />

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedNodeFilter("ALL")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors whitespace-nowrap",
                selectedNodeFilter === "ALL"
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              Tous les nœuds
            </button>

            {customNodes.map((nodeName) => (
              <div
                key={nodeName}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg pl-2.5 pr-1 py-1 text-[12px] font-medium transition-colors whitespace-nowrap",
                  selectedNodeFilter === nodeName
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedNodeFilter(nodeName)}
                  className="text-left"
                >
                  {nodeName}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCustomNode(nodeName);
                  }}
                  title={`Supprimer définitivement le nœud « ${nodeName} »`}
                  className="ml-0.5 rounded p-0.5 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/15 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            {!showAddNodeInput ? (
              <button
                type="button"
                onClick={() => setShowAddNodeInput(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border hover:border-primary px-2.5 py-1 text-[11.5px] font-medium text-primary transition-colors whitespace-nowrap"
              >
                <Plus className="h-3 w-3" />
                <span>Créer mon nœud</span>
              </button>
            ) : (
              <form onSubmit={handleCreateCustomNode} className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={newNodeNameInput}
                  onChange={(e) => setNewNodeNameInput(e.target.value)}
                  placeholder="Ex: MI, Bactério…"
                  autoFocus
                  className="h-7 w-32 rounded-lg border border-primary bg-background px-2 text-[12px] text-foreground focus:outline-none"
                />
                <Button type="submit" size="sm" className="h-7 px-2 text-[11px]">
                  OK
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          VUE 1 : SESSION D'ÉTUDE (répétition espacée FSRS) + GESTION DES CARTES PRÉ-ENREGISTRÉES
         ===================================================================== */}
      {viewMode === "serial" && !session && !finishedSession && (
        <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-200">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-xl">
                    {selectedCourseFilter === "ALL" ? "Toutes mes leçons" : selectedCourseFilter}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Chaque session présente des questions cliniques bien posées ou des affirmations ciblées au Recto, et des réponses claires, concises et conformes au cours au Verso.
                  </CardDescription>
                </div>
                {selectedNodeFilter !== "ALL" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteCustomNode(selectedNodeFilter)}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8 text-[12px]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Supprimer le nœud « {selectedNodeFilter} »</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Cartes", value: scopeStats.total },
                  { label: "À réviser", value: scopeStats.due, accent: true },
                  { label: "Nouvelles", value: scopeStats.fresh },
                  { label: "Maîtrisées", value: scopeStats.mastered },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-background/60 px-4 py-3">
                    <span className="font-mono text-[11px] text-muted-foreground">{s.label}</span>
                    <div
                      className={cn(
                        "text-2xl font-semibold tabular-nums",
                        s.accent && s.value > 0 ? "text-primary" : "text-foreground"
                      )}
                    >
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {scopeStats.total === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-3">
                  <p className="text-[13.5px] text-muted-foreground">
                    Aucune flashcard dans ce périmètre pour l'instant.
                  </p>
                  <Button onClick={openGeneratorForScope}>
                    <Sparkles className="h-4 w-4" />
                    <span>Générer des flashcards</span>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium text-muted-foreground">Taille de session</span>
                    <div className="inline-flex rounded-lg border border-border bg-secondary/60 p-0.5">
                      {SESSION_SIZES.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSessionSize(n)}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[12px] font-medium tabular-nums transition-colors",
                            sessionSize === n ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button size="lg" onClick={startSession}>
                    <Play className="h-4 w-4" />
                    <span>Démarrer la session classique</span>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-[#1664F6] text-[#1664F6] hover:bg-[#1664F6]/10 font-semibold"
                    onClick={() => {
                      window.location.href = "/smart-flashcards";
                    }}
                  >
                    <Sparkles className="h-4 w-4 text-[#1664F6] animate-pulse" />
                    <span>Mode Adaptatif IA (8 modes)</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Liste des flashcards enregistrées dans ce périmètre avec suppression définitive à l'unité */}
          {scopePool.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      Flashcards enregistrées dans ce périmètre ({scopePool.length})
                    </CardTitle>
                    <CardDescription className="text-[12px]">
                      Toute suppression d'une flashcard ou d'une leçon pré-enregistrée est immédiate et définitive.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 max-h-[420px] overflow-y-auto pr-2">
                {scopePool.map((card) => (
                  <div
                    key={card.id}
                    className="rounded-xl border border-border/80 bg-background/60 p-3.5 flex items-start justify-between gap-3 hover:border-foreground/25 transition-colors"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10.5px]">
                          {card.lessonTitle}
                        </Badge>
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                          <GitBranch className="h-2.5 w-2.5" />
                          {card.customNode}
                        </span>
                      </div>
                      <p className="text-[13.5px] font-semibold text-foreground leading-snug">
                        <span className="font-mono text-[10.5px] uppercase text-primary mr-1.5">Recto :</span>
                        {card.question}
                      </p>
                      <p className="text-[12.5px] text-muted-foreground leading-relaxed line-clamp-2">
                        <span className="font-mono text-[10.5px] uppercase text-foreground/80 mr-1.5">Verso :</span>
                        {card.answerSummary}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSpecificCard(card)}
                      title="Supprimer définitivement cette flashcard"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {viewMode === "serial" && finishedSession && !session && (
        <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-200">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Session terminée</CardTitle>
              <CardDescription>
                {finishedSession.results[1] + finishedSession.results[2] + finishedSession.results[3] + finishedSession.results[4]}{" "}
                réponses en {Math.max(1, Math.round((Date.now() - finishedSession.startedAt) / 60000))} min. Les
                prochaines révisions sont planifiées automatiquement selon votre mémoire.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {RATING_BUTTONS.map((b) => (
                  <div key={b.rating} className="rounded-xl border border-border bg-background/60 px-4 py-3">
                    <span className="font-mono text-[11px] text-muted-foreground">{b.label}</span>
                    <div className="text-2xl font-semibold tabular-nums text-foreground">
                      {finishedSession.results[b.rating]}
                    </div>
                  </div>
                ))}
              </div>
              {scopeStats.fresh < 5 && (
                <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-4 text-[13px] text-foreground flex flex-wrap items-center justify-between gap-3">
                  <span>Il reste peu de cartes nouvelles dans ce périmètre. Enrichissez votre banque pour varier davantage.</span>
                  <Button size="sm" variant="outline" onClick={openGeneratorForScope}>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Générer de nouvelles cartes</span>
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-border/60">
                <Button variant="ghost" onClick={resetSessionView}>
                  Retour
                </Button>
                <Button onClick={startSession}>
                  <Shuffle className="h-4 w-4" />
                  <span>Nouvelle session</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {viewMode === "serial" && session && currentCard && (
        <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-200">
          {/* Barre de progression de la session */}
          <div className="rounded-2xl border border-border/80 bg-card px-4 py-2.5 shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetSessionView}
                className="h-8 rounded-xl px-3 text-[12.5px] font-medium"
              >
                Terminer
              </Button>
              <div className="text-center">
                <span className="font-mono text-[12px] font-semibold text-foreground tabular-nums">
                  Carte {session.index + 1} sur {session.ids.length}
                </span>
                <span className="hidden sm:inline text-muted-foreground mx-2">•</span>
                <span className="hidden sm:inline text-[12.5px] font-medium text-primary">{currentCard.lessonTitle}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSkip}
                disabled={session.index >= session.ids.length - 1}
                className="h-8 rounded-xl px-3 text-[12.5px] font-medium"
              >
                <span>Passer</span>
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="h-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${sessionProgress}%` }} />
            </div>
          </div>

          {/* CARTE PRINCIPALE */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className={cn(
              "group relative cursor-pointer rounded-2xl border bg-card p-7 sm:p-10 min-h-[390px] flex flex-col justify-between transition-all duration-200 shadow-[0_10px_32px_-12px_rgba(0,0,0,0.07)]",
              isFlipped ? "border-primary/55" : "border-border hover:border-foreground/30"
            )}
          >
            {/* En-tête de la carte */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" className="text-[11.5px] font-semibold">
                  {currentCard.lessonTitle}
                </Badge>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 text-[11.5px] font-medium text-foreground">
                  <GitBranch className="h-3 w-3 text-primary" />
                  {currentCard.customNode}
                </span>
                {currentCard.srs?.phase === "new" && (
                  <span className="font-mono text-[10.5px] text-primary font-semibold">• Nouvelle</span>
                )}
                {currentCard.format === "cloze" && (
                  <span className="font-mono text-[10.5px] text-muted-foreground">• Texte à trous</span>
                )}
                {currentCard.format === "definition" && (
                  <span className="font-mono text-[10.5px] text-muted-foreground">• Définition</span>
                )}
                {currentCard.format === "list" && (
                  <span className="font-mono text-[10.5px] text-muted-foreground">• Liste</span>
                )}
                {currentCard.originMode === "objectives" && currentCard.format === "qa" && (
                  <span className="font-mono text-[10.5px] text-muted-foreground">• Objectif pédagogique</span>
                )}
                {currentCard.originMode === "qcm_error" && (
                  <Badge variant="outline" className="font-mono text-[10.5px] border-primary/40 text-primary">
                    {currentCard.qcmType === "jumelage" ? "QCM JUMELAGE" : "ERREUR QCM"}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
                  {isFlipped ? "VERSO • RÉPONSE" : "RECTO • QUESTION"}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCurrentCard();
                  }}
                  title="Supprimer cette carte"
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* CORPS CENTRAL DE LA CARTE */}
            <div className="my-auto py-7 space-y-6">
              {!isFlipped ? (
                <div className="space-y-6">
                  <h2 className="font-serif text-2xl sm:text-[29px] text-foreground leading-[1.32] tracking-normal">
                    {currentCard.format === "cloze" ? <ClozePrompt text={currentCard.question} /> : currentCard.question}
                  </h2>

                  {currentCard.originMode === "qcm_error" && currentCard.qcmPropositions && (
                    <div className="space-y-2.5 pt-2">
                      {currentCard.qcmPropositions.map((prop) => (
                        <div
                          key={prop.label}
                          className="flex items-start gap-3.5 rounded-xl border border-border/85 bg-background/65 px-4 py-3 text-[14.5px] text-foreground leading-relaxed"
                        >
                          <span className="inline-flex h-6 min-w-[28px] px-1.5 shrink-0 items-center justify-center rounded-md bg-secondary font-mono text-[11.5px] font-bold text-primary mt-0.5">
                            {prop.label}
                          </span>
                          <span>{prop.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  {currentCard.format !== "cloze" && (
                    <p className="text-[13.5px] font-medium text-muted-foreground">{currentCard.question}</p>
                  )}

                  {currentCard.originMode === "qcm_error" && currentCard.qcmPropositions ? (
                    <div className="space-y-3">
                      {currentCard.qcmPropositions.map((prop) => (
                        <div
                          key={prop.label}
                          className={cn(
                            "flex items-start justify-between gap-4 rounded-xl border px-4 py-3.5 text-[14.5px] leading-relaxed",
                            prop.isCorrect
                              ? "border-emerald-500/45 bg-emerald-500/[0.07] text-foreground"
                              : "border-destructive/40 bg-destructive/[0.06] text-foreground/85"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={cn(
                                "inline-flex h-6 min-w-[28px] px-1.5 shrink-0 items-center justify-center rounded-md font-mono text-[11.5px] font-bold mt-0.5",
                                prop.isCorrect ? "bg-emerald-600 text-white" : "bg-destructive text-white"
                              )}
                            >
                              {prop.label}
                            </span>
                            <span className="font-medium">{prop.text}</span>
                          </div>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold shrink-0",
                              prop.isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
                            )}
                          >
                            {prop.isCorrect ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" /> VRAI
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3.5 w-3.5" /> FAUX
                              </>
                            )}
                          </span>
                        </div>
                      ))}
                      {currentCard.qcmExplanation && (
                        <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-4 text-[13.5px] text-foreground leading-relaxed">
                          <strong className="text-primary block mb-1">Justification clinique :</strong>
                          {currentCard.qcmExplanation}
                        </div>
                      )}
                    </div>
                  ) : currentCard.format === "cloze" ? (
                    <div className="rounded-2xl border border-border/90 bg-secondary/30 p-6 space-y-4">
                      <p className="font-serif text-[22px] sm:text-[25px] text-foreground leading-[1.4]">
                        {currentCard.clozeText ? (
                          <ClozeReveal cloze={currentCard.clozeText} />
                        ) : (
                          currentCard.answerDetails[0] || currentCard.answerSummary
                        )}
                      </p>
                      <div className="border-l-[3px] border-primary pl-4">
                        <span className="font-mono text-[11px] text-muted-foreground">Terme attendu</span>
                        <p className="text-[17px] font-semibold text-foreground">{currentCard.answerSummary}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border/90 bg-secondary/30 p-6 space-y-4">
                      {!/^\d+\s+éléments?\s+à\s+connaître/i.test(currentCard.answerSummary) &&
                       !/^point(?:s)?\s+cl[ée]/i.test(currentCard.answerSummary) && (
                        <div className="border-l-[3px] border-primary pl-4">
                          <p className="text-[16px] sm:text-[17px] font-semibold text-foreground leading-relaxed">
                            {currentCard.answerSummary}
                          </p>
                        </div>
                      )}
                      {currentCard.answerDetails.length > 0 &&
                        (currentCard.format === "list" ? (
                          <ol className="space-y-2 pt-2 border-t border-border/60">
                            {currentCard.answerDetails.map((detail, idx) => (
                              <li key={idx} className="flex items-start gap-3 text-[14.5px] text-foreground/90 leading-relaxed">
                                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-primary/15 font-mono text-[11px] font-bold text-primary mt-0.5">
                                  {idx + 1}
                                </span>
                                <span>{detail}</span>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <ul className="space-y-2.5 pt-2 border-t border-border/60">
                            {currentCard.answerDetails.map((detail, idx) => (
                              <li key={idx} className="flex items-start gap-3 text-[14.5px] text-foreground/90 leading-relaxed">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                                <span>{detail}</span>
                              </li>
                            ))}
                          </ul>
                        ))}
                    </div>
                  )}

                  {currentCard.sourceExcerpt &&
                    currentCard.format !== "cloze" &&
                    normalizeForKey(currentCard.sourceExcerpt) !== normalizeForKey(currentCard.answerSummary) && (
                      <p className="flex items-start gap-2 text-[12.5px] italic text-muted-foreground leading-relaxed">
                        <Quote className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/70" />
                        <span>Extrait du cours : « {currentCard.sourceExcerpt} »</span>
                      </p>
                    )}
                </div>
              )}
            </div>

            {/* Pied de carte */}
            {!isFlipped ? (
              <div
                onClick={(e) => e.stopPropagation()}
                className="pt-4 border-t border-border/60 flex items-center justify-between gap-3"
              >
                <span className="hidden sm:inline font-mono text-[10.5px] text-muted-foreground">
                  Espace : retourner • → : passer
                </span>
                <button
                  type="button"
                  onClick={() => setIsFlipped(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-5 py-2.5 text-[13px] font-semibold hover:bg-primary hover:text-primary-foreground transition-all shadow-sm ml-auto"
                >
                  <Eye className="h-4 w-4" />
                  <span>Révéler la réponse</span>
                </button>
              </div>
            ) : (
              <div
                onClick={(e) => e.stopPropagation()}
                className="pt-4 border-t border-border/70 grid grid-cols-2 sm:grid-cols-4 gap-2.5"
              >
                {RATING_BUTTONS.map((btn) => (
                  <button
                    key={btn.rating}
                    type="button"
                    onClick={() => handleRate(btn.rating)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border border-border bg-background py-2.5 px-3 transition-all",
                      btn.tone
                    )}
                  >
                    <span className="font-mono text-[10.5px] text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {ratingPreview?.[btn.rating]}
                    </span>
                    <span className="text-[13px] font-semibold text-foreground mt-0.5">{btn.label}</span>
                    <span className="hidden sm:block font-mono text-[9.5px] text-muted-foreground/70">touche {btn.key}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          VUE 2 : MES NŒUDS PERSONNALISÉS & GESTION DES SÉRIES PRÉ-ENREGISTRÉES
         ===================================================================== */}
      {viewMode === "nodes" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <Card>
            <CardHeader>
              <CardTitle>Mes Nœuds d'Étude Personnalisés</CardTitle>
              <CardDescription>
                Créez ou supprimez librement vos nœuds d'étude. La suppression d'un nœud retire définitivement le nœud et toutes les flashcards qui lui sont rattachées.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleCreateCustomNode} className="flex gap-2.5 max-w-md">
                <Input
                  value={newNodeNameInput}
                  onChange={(e) => setNewNodeNameInput(e.target.value)}
                  placeholder="Nom de votre nœud (ex: MI, Anatomie, Bactério)…"
                />
                <Button type="submit">
                  <Plus className="h-4 w-4" />
                  <span>Ajouter</span>
                </Button>
              </form>

              {customNodes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
                  Aucun nœud actif. Créez votre propre nœud ci-dessus pour organiser vos flashcards.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                  {customNodes.map((nodeName) => {
                    const nodeCards = cards.filter((c) => c.customNode === nodeName);
                    const nodeStats = computeScopeStats(nodeCards);
                    return (
                      <div
                        key={nodeName}
                        onClick={() => {
                          setSelectedNodeFilter(nodeName);
                          setViewMode("serial");
                        }}
                        className="group cursor-pointer rounded-xl border border-border bg-background/60 hover:bg-card hover:border-primary/50 p-4 flex items-center justify-between transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4 text-primary" />
                            <h4 className="text-[14.5px] font-semibold text-foreground group-hover:text-primary transition-colors">
                              {nodeName}
                            </h4>
                          </div>
                          <span className="font-mono text-[11.5px] text-muted-foreground block">
                            {nodeStats.total} flashcard(s) • {nodeStats.due} à réviser
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomNode(nodeName);
                          }}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          title={`Supprimer définitivement le nœud « ${nodeName} »`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gestion et suppression définitive des séries de flashcards par leçon */}
          <Card>
            <CardHeader>
              <CardTitle>Mes Séries de Flashcards par Leçon ({uniqueLessons.length})</CardTitle>
              <CardDescription>
                Supprimez définitivement n'importe quelle série de flashcards pré-enregistrée ou générée. Elle ne réapparaîtra jamais au rechargement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {uniqueLessons.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
                  Aucune série de flashcards enregistrée actuellement.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {uniqueLessons.map((lessonTitle) => {
                    const lessonCards = cards.filter((c) => c.lessonTitle === lessonTitle);
                    const lessonStats = computeScopeStats(lessonCards);
                    return (
                      <div
                        key={lessonTitle}
                        onClick={() => {
                          setSelectedCourseFilter(lessonTitle);
                          setViewMode("serial");
                        }}
                        className="group cursor-pointer rounded-xl border border-border bg-background/60 hover:bg-card hover:border-primary/50 p-4 flex items-center justify-between transition-all"
                      >
                        <div className="space-y-1 min-w-0 pr-2">
                          <h4 className="text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {lessonTitle}
                          </h4>
                          <span className="font-mono text-[11.5px] text-muted-foreground block">
                            {lessonStats.total} flashcard(s) • {lessonStats.due} à réviser
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLessonFlashcards(lessonTitle);
                          }}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0"
                          title={`Supprimer définitivement la série « ${lessonTitle} »`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* =====================================================================
          VUE 3 : NOUVELLE CARTE (CONSTRUIRE AVEC L'IA / CRÉATION MANUELLE)
         ===================================================================== */}
      {viewMode === "create" && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCreationTab("ai")}
              className={cn(
                "rounded-2xl border p-4 text-left transition-all flex items-start gap-3.5",
                creationTab === "ai" ? "border-primary bg-primary/[0.07] shadow-sm" : "border-border bg-card hover:border-foreground/30"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">Construire avec l'IA</h3>
                <p className="text-[12.5px] text-muted-foreground mt-0.5">
                  Générez vos flashcards par objectifs, par pertinence ou depuis vos erreurs QCM.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCreationTab("manual")}
              className={cn(
                "rounded-2xl border p-4 text-left transition-all flex items-start gap-3.5",
                creationTab === "manual" ? "border-primary bg-primary/[0.07] shadow-sm" : "border-border bg-card hover:border-foreground/30"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
                <Edit3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">Création Manuelle</h3>
                <p className="text-[12.5px] text-muted-foreground mt-0.5">
                  Rédigez vous-même la question, la réponse et votre nœud personnalisé.
                </p>
              </div>
            </button>
          </div>

          {creationTab === "ai" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Construire avec l'IA</CardTitle>
                <CardDescription>
                  Les nouvelles cartes s'ajoutent à votre banque sans jamais dupliquer ni effacer celles que vous avez déjà
                  travaillées.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* 1. Choix du cours ou Upload direct (toujours visible pour calibrer le bon cours) */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[12.5px] font-semibold text-foreground">
                      1. Choisir un cours enregistré ou importer un fichier
                    </label>
                    <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary hover:text-primary-foreground px-3.5 py-1.5 text-[12.5px] font-semibold text-primary transition-colors">
                      <FileUp className="h-3.5 w-3.5" />
                      <span>{isReadingUploadedFile ? "Extraction du texte…" : "Importer un fichier (.pdf, .docx, .pptx, .txt)"}</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.pptx,.ppt,.odt,.txt,.md,.rtf,.csv"
                        onChange={handleDirectUploadInBuilder}
                        disabled={isReadingUploadedFile}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <select
                    value={selectedBackendCourseId}
                    onChange={(e) => setSelectedBackendCourseId(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-card px-3.5 text-[13.5px] font-medium text-foreground focus:outline-none focus:border-primary"
                  >
                    {uploadedCourseTitle && (
                      <option value="UPLOADED_DIRECT">Fichier importé : {uploadedCourseTitle}</option>
                    )}
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {formatLessonTitle(c.title)} ({c.subject})
                      </option>
                    ))}
                  </select>

                  {remainingNotions === -1 && selectedBackendCourseId !== "UPLOADED_DIRECT" && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-[12px] text-destructive">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>
                          Ce cours a été enregistré avant l'activation de l'extracteur PDF/Word (son texte interne est vide ou illisible). Cliquez ci-contre pour recharger le fichier original et le réparer instantanément.
                        </span>
                      </div>
                      <label className="cursor-pointer shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 px-3 py-1.5 text-[11.5px] font-semibold transition-opacity">
                        <FileUp className="h-3.5 w-3.5" />
                        <span>Réparer avec le fichier (.pdf, .docx…)</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.pptx,.ppt,.odt,.txt,.md,.rtf,.csv"
                          onChange={handleDirectUploadInBuilder}
                          disabled={isReadingUploadedFile}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  {remainingNotions !== null && remainingNotions !== -1 && selectedBackendCourseId !== "UPLOADED_DIRECT" && (
                    <p className="text-[12px] text-muted-foreground">
                      {remainingNotions > 0
                        ? `${remainingNotions} notion(s) de ce cours ne sont pas encore dans votre banque (moteur local). L'IA peut en rédiger davantage.`
                        : "Le moteur local a déjà couvert ce cours : l'IA explorera de nouveaux angles."}
                    </p>
                  )}
                </div>

                {/* 2. Les 3 paramètres de calibrage (adaptés réactivement au cours sélectionné) */}
                <div className="space-y-2.5 pt-2 border-t border-border/60">
                  <label className="text-[12.5px] font-semibold text-foreground">2. Paramètre de calibrage</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        id: "objectives" as const,
                        icon: Target,
                        title: "À partir des Objectifs",
                        desc: "Le Recto pose l'objectif du cours (écrit par le professeur dans le chapeau). Le Verso donne la réponse exacte extraite du cours.",
                        disabled: false,
                        badge: null,
                      },
                      {
                        id: "relevance" as const,
                        icon: Shuffle,
                        title: "Aléatoire par Pertinence",
                        desc: "Sélectionne par ordre d'importance les notions indispensables, urgences et seuils clés du cours.",
                        disabled: false,
                        badge: null,
                      },
                      {
                        id: "qcm_error" as const,
                        icon: AlertCircle,
                        title: "Depuis mes Erreurs QCM",
                        desc: courseQcmStatus.isAccessible
                          ? `Convertit vos ${courseQcmStatus.failedQuestions.length} question(s) ratée(s) sur le QCM de cette leçon en flashcards.`
                          : "Inaccessible : aucun QCM avec erreurs enregistré pour cette leçon. Entraînez-vous d'abord sur son QCM.",
                        disabled: !courseQcmStatus.isAccessible,
                        badge: courseQcmStatus.isAccessible
                          ? `${courseQcmStatus.failedQuestions.length} erreur(s) disponible(s)`
                          : "Inaccessible",
                      },
                    ].map((m) => {
                      const Icon = m.icon;
                      const active = aiCalibrationMode === m.id && !m.disabled;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={m.disabled}
                          onClick={() => {
                            if (!m.disabled) setAiCalibrationMode(m.id);
                          }}
                          className={cn(
                            "rounded-xl border p-4 text-left transition-all flex flex-col justify-between gap-2.5",
                            m.disabled
                              ? "opacity-45 bg-muted/30 border-border cursor-not-allowed"
                              : active
                              ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-sm"
                              : "border-border bg-background/60 hover:border-foreground/30 cursor-pointer"
                          )}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Icon className={cn("h-4 w-4 shrink-0", m.disabled ? "text-muted-foreground" : "text-primary")} />
                                <span className="text-[13.5px] font-semibold text-foreground">{m.title}</span>
                              </div>
                            </div>
                            {m.badge && (
                              <Badge
                                variant={m.disabled ? "outline" : "default"}
                                className={cn(
                                  "text-[10px] px-2 py-0.5 font-medium",
                                  m.disabled
                                    ? "border-muted-foreground/30 text-muted-foreground"
                                    : "bg-primary text-primary-foreground"
                                )}
                              >
                                {m.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[12px] text-muted-foreground leading-relaxed">{m.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] font-medium text-muted-foreground">Nombre de cartes</span>
                        <div className="inline-flex rounded-lg border border-border bg-secondary/60 p-0.5">
                          {GENERATION_SIZES.map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setGenerationCount(n)}
                              className={cn(
                                "px-2.5 py-1 rounded-md text-[12px] font-medium tabular-nums transition-colors",
                                generationCount === n ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                              )}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Cpu className="h-3.5 w-3.5 text-primary" />
                        <div className="inline-flex rounded-lg border border-border bg-secondary/60 p-0.5">
                          {[
                            { id: "ai" as const, label: "IA (crédits)" },
                            { id: "local" as const, label: "Local (gratuit)" },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setEngineChoice(opt.id)}
                              className={cn(
                                "px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors",
                                engineChoice === opt.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                {/* 3. Choix ou création du nœud */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
                  <div className="space-y-1.5">
                    <label className="text-[12.5px] font-semibold text-foreground">3. Nœud personnalisé</label>
                    <select
                      value={selectedTargetNode}
                      onChange={(e) => setSelectedTargetNode(e.target.value)}
                      className="w-full h-10 rounded-xl border border-border bg-card px-3 text-[13.5px] text-foreground focus:outline-none focus:border-primary"
                    >
                      {customNodes.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12.5px] font-semibold text-muted-foreground">
                      Ou créer un nouveau nœud directement
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={newNodeNameInput}
                        onChange={(e) => setNewNodeNameInput(e.target.value)}
                        placeholder="Ex: MI, Parasitologie…"
                        className="h-10"
                      />
                      <Button type="button" variant="outline" onClick={handleCreateCustomNode} className="h-10 shrink-0">
                        Ajouter
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <Button size="lg" onClick={handleRunAiCalibration} disabled={isGeneratingAi}>
                    <Sparkles className="h-4 w-4" />
                    <span>{isGeneratingAi ? "Construction des flashcards…" : "Générer la série de Flashcards"}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Création Manuelle</CardTitle>
                <CardDescription>Rédigez votre question et sa réponse structurée.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateManualFlashcard} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-medium text-muted-foreground">Intitulé de la leçon</label>
                      <Input
                        value={manualLessonTitle}
                        onChange={(e) => setManualLessonTitle(e.target.value)}
                        placeholder="Ex: Généralités — Infections"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[12px] font-medium text-muted-foreground">Nœud personnalisé</label>
                      <select
                        value={manualNode}
                        onChange={(e) => setManualNode(e.target.value)}
                        className="w-full h-9 rounded-xl border border-border bg-card px-3 text-[13px] text-foreground"
                      >
                        {customNodes.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-muted-foreground">Question (Recto)</label>
                    <Input
                      value={manualQuestion}
                      onChange={(e) => setManualQuestion(e.target.value)}
                      placeholder="Ex: Quels sont les 4 facteurs favorisant l'émergence des infections ?"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-muted-foreground">Réponse principale (Verso)</label>
                    <Input
                      value={manualSummary}
                      onChange={(e) => setManualSummary(e.target.value)}
                      placeholder="Synthèse directe de la réponse…"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-muted-foreground">
                      Points détaillés complémentaires (1 point par ligne)
                    </label>
                    <Textarea
                      rows={4}
                      value={manualDetails}
                      onChange={(e) => setManualDetails(e.target.value)}
                      placeholder={`1. Mutations et antibiorésistance.\n2. Urbanisation et démographie.\n3. Voyages internationaux.\n4. Changements climatiques et zoonoses.`}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setViewMode("serial")}>
                      Annuler
                    </Button>
                    <Button type="submit">
                      <Save className="h-4 w-4" />
                      <span>Enregistrer la flashcard</span>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export { Flashcards };
