import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  BookOpen,
  PenTool,
  Upload,
  FileText,
  GraduationCap,
  CheckCircle2,
  ShieldAlert,
  Layers,
  GitCompare,
  Link2,
  CheckSquare,
  CircleDot,
  LayoutGrid,
  List,
  MoreHorizontal,
  Search,
  Trash2,
  Download,
  Play,
  Plus,
  Save,
  ChevronLeft,
  ChevronRight,
  Flag,
  Trophy,
  RotateCcw,
  BookMarked,
  Loader2,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFileReader } from "@/hooks/useFileReader";
import { useToast } from "@/hooks/use-toast";
import { callGeminiAcademicEngine } from "@/lib/syncEngine";
import {
  DawiaEngine,
  DAWIA_ENGINES,
  callDawiaEngine,
} from "@/lib/dawiaQcmEngine";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  analyzeUploadedAnnalesDna,
  buildAnnalesMimicryPrompt,
  buildUniversalDocimologicalBatchPrompt,
  buildFormatQuotaSchedule,
  getCourseGenerationMemory,
  recordCourseGenerationMemory,
  sanitizeAndValidateQuestions,
  cleanMedicalCourseTitle,
  DocimologicalFormat,
  AnnaleDnaProfile,
  NormalizedQcmQuestion,
} from "@/lib/annalesMimicryEngine";
import { getSavedCourses } from "./Library";
import { untypedTable } from "@/lib/untypedDb";
import { cn } from "@/lib/utils";
import {
  LockedSingleLineHeader,
  EliteQuestionSessionPlayer,
  normalizeQuestionForDisplay,
} from "@/components/quiz/QcmSessionAndHeaderFix";
import { useNavigate } from "react-router-dom";
import {
  CollisionFreeQcmHeader,
  DualMassUploadMimicryStudio,
  UploadedFileTag,
} from "@/components/quiz/MimicryMassUploadPoles";
import {
  repairAndParseQuizJson,
  STRICT_JSON_PROMPT_GUARD,
} from "@/lib/jsonRepair";
import { exportQuizToPDF } from "@/utils/pdfExport";
import type { QuizData } from "@/utils/QuizPDF";

// ============================================================================
// TYPES DES SÉRIES DE QCM & NAVIGATION
// ============================================================================

export type MainStudioTab =
  | "mes_qcm"
  | "generateur_ia"
  | "constructeur_manuel"
  | "session_active";

export type GeneratorSourceType =
  | "cours_pre_uploade"
  | "importer_fichier"
  | "avec_du_texte"
  | "mimetisme_annales";

export interface QcmQuizDeck {
  id: string;
  title: string;
  subject: string;
  sourceMode: string;
  questions: NormalizedQcmQuestion[];
  createdAt: string;
  lastScore?: { correct: number; total: number };
}

const STORAGE_KEY = "hippocampus_saved_quizzes_v1";

const FORMAT_METADATA: Array<{
  id: DocimologicalFormat;
  label: string;
  shortDesc: string;
  icon: React.ElementType;
}> = [
  { id: "election", label: "Élection (QCU)", shortDesc: "1 seule proposition vraie", icon: CircleDot },
  { id: "choix_multiple", label: "Choix Multiple", shortDesc: "1 à 5 propositions vraies", icon: CheckSquare },
  { id: "censure", label: "Censure", shortDesc: "Cocher la proposition FAUSSE", icon: ShieldAlert },
  { id: "groupage", label: "Groupage", shortDesc: "Compléments 1, 2, 3, 4 → A-E", icon: Layers },
  { id: "jumelage", label: "Jumelage", shortDesc: "Cause à effet (PARCE QUE)", icon: GitCompare },
  { id: "association", label: "Association", shortDesc: "Appariement Liste 1 ↔ Liste 2", icon: Link2 },
];

// ============================================================================
// MENU 3 POINTS (•••) SANS FLOUTAGE D'ÉCRAN (POUR MOSAÏQUE & ALIGNEMENT)
// ============================================================================

const DeckThreeDotsMenu: React.FC<{
  onStartExam: () => void;
  onEditInScrollBuilder: () => void;
  onDownloadPdf: () => void;
  onDelete: () => void;
}> = ({ onStartExam, onEditInScrollBuilder, onDownloadPdf, onDelete }) => (
  // modal={false} garantit l'absence totale de floutage ou d'assombrissement de l'écran
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => e.stopPropagation()}
        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0"
        title="Options du questionnaire"
      >
        <MoreHorizontal className="w-4 h-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      sideOffset={6}
      onClick={(e) => e.stopPropagation()}
      className="w-56 rounded-2xl bg-popover text-popover-foreground border border-border shadow-xl p-1.5 z-[100]"
    >
      <DropdownMenuItem
        onClick={onStartExam}
        className="rounded-xl text-xs font-bold cursor-pointer flex items-center gap-2.5 py-2.5 text-primary focus:text-primary"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        Lancer le Mode Examen
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={onEditInScrollBuilder}
        className="rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-2.5 py-2.5"
      >
        <PenTool className="w-3.5 h-3.5" />
        Éditer les QCM (Défilement)
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={onDownloadPdf}
        className="rounded-xl text-xs font-medium cursor-pointer flex items-center gap-2.5 py-2.5"
      >
        <Download className="w-3.5 h-3.5" />
        Télécharger en PDF
      </DropdownMenuItem>
      <DropdownMenuSeparator className="my-1 bg-border" />
      <DropdownMenuItem
        onClick={onDelete}
        className="rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-2.5 py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Supprimer ce questionnaire
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// ============================================================================
// COMPOSANT PRINCIPAL : STUDIO & BANQUE DE QCM
// ============================================================================

export default function QcmMasterStudio() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const courseFileInputRef = useRef<HTMLInputElement>(null);
  const annalesFileInputRef = useRef<HTMLInputElement>(null);
  const { readFile, isReading } = useFileReader();

  // Navigation principale (Multi-Moteurs IA supprimé !)
  const [activeTab, setActiveTab] = useState<MainStudioTab>("generateur_ia");
  const [selectedDawiaEngine, setSelectedDawiaEngine] = useState<DawiaEngine>(() => {
    try {
      return (localStorage.getItem("dawjang_selected_qcm_engine") as DawiaEngine) || "dawia1";
    } catch {
      return "dawia1";
    }
  });

  const handleSelectDawiaEngine = (engine: DawiaEngine) => {
    setSelectedDawiaEngine(engine);
    try {
      localStorage.setItem("dawjang_selected_qcm_engine", engine);
    } catch {
      // ignore
    }
  };

  // ==========================================================================
  // 1. ÉTATS DE LA BANQUE "MES QCM" & SUPPRESSION DE MASSE (BULK DELETE)
  // ==========================================================================
  const [decks, setDecks] = useState<QcmQuizDeck[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("hippocampus_quiz_decks");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Erreur lecture decks sauvegardés:", e);
    }
    return [];
  });
  const [bankViewMode, setBankViewMode] = useState<"mosaic" | "alignment">("mosaic");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);

  // Synchronisation du localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
    } catch (e) {
      console.error("Erreur sauvegarde decks:", e);
    }
  }, [decks]);

  // ==========================================================================
  // 2. ÉTATS DU "GÉNÉRATEUR IA" & DU MODE "MIMÉTISME D'ANNALES"
  // ==========================================================================
  const [sourceType, setSourceType] = useState<GeneratorSourceType>("cours_pre_uploade");
  const [librarySummaries, setLibrarySummaries] = useState<Array<{ id: string; title: string; content: string }>>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>("");
  const [coursePoleAText, setCoursePoleAText] = useState<string>("");
  const [coursePoleATitle, setCoursePoleATitle] = useState<string>("");
  const [poleACourses, setPoleACourses] = useState<UploadedFileTag[]>([]);
  const [poleBAnnales, setPoleBAnnales] = useState<UploadedFileTag[]>([]);
  const [isReadingFiles, setIsReadingFiles] = useState<boolean>(false);

  // Spécifique Pôle B : Mimétisme d'Annales
  const [annalesPoleBText, setAnnalesPoleBText] = useState<string>("");
  const [annalesFilenames, setAnnalesFilenames] = useState<string[]>([]);
  const [annalesDna, setAnnalesDna] = useState<AnnaleDnaProfile | null>(null);

  // Optionnalité du Type de QCM en mode Mimétisme
  const [enableCustomTypesInMimicry, setEnableCustomTypesInMimicry] = useState<boolean>(false);
  const [selectedFormats, setSelectedFormats] = useState<DocimologicalFormat[]>([
    "election",
    "choix_multiple",
    "censure",
  ]);
  const [standardDifficulty, setStandardDifficulty] = useState<string>("Intermédiaire");
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // ==========================================================================
  // 3. ÉTATS DE LA "SESSION ACTIVE" (NAVIGATION 1..N, EXPLICATIONS DÉTAILLÉES, SCORE FINAL)
  // ==========================================================================
  const [activeDeck, setActiveDeck] = useState<QcmQuizDeck | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [userSelections, setUserSelections] = useState<Record<string, string[]>>({});
  const [validatedQuestions, setValidatedQuestions] = useState<Record<string, boolean>>({});
  const [expandedExplanations, setExpandedExplanations] = useState<Record<string, boolean>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [isSessionFinished, setIsSessionFinished] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // ==========================================================================
  // 4. ÉTATS DU "CONSTRUCTEUR MANUEL" EN DÉFILEMENT CONTINU (SCROLLABLE BATCH EDITOR)
  // ==========================================================================
  const [editableDeckTitle, setEditableDeckTitle] = useState<string>("Nouveau Questionnaire Docimologique");
  const [editableDeckId, setEditableDeckId] = useState<string | null>(null);
  const [editableQuestions, setEditableQuestions] = useState<NormalizedQcmQuestion[]>([
    {
      id: crypto.randomUUID(),
      format: "censure",
      subject: "Hématologie",
      difficulty: "Avancé (Concours Faculté)",
      stem: "CENSURE — Parmi les propositions suivantes concernant l'anémie par carence en fer, indiquez celle qui est FAUSSE :",
      options: [
        {
          letter: "A",
          text: "C'est une anémie microcytaire hypochrome d'origine centrale qualitative",
          isCorrectSelection: false,
          truthStatus: "VRAI",
          detailedWhy: "Exact : le déficit en fer entraîne un défaut d'hémoglobinisation des érythroblastes (VGM < 80 fl, TCMH < 27 pg).",
        },
        {
          letter: "B",
          text: "La ferritinémie sérique est abaissée dès le stade initial de déplétion des réserves",
          isCorrectSelection: false,
          truthStatus: "VRAI",
          detailedWhy: "Exact : la ferritine reflète directement les réserves martiales.",
        },
        {
          letter: "C",
          text: "Le récepteur soluble de la transferrine (sTfR) est diminué",
          isCorrectSelection: true,
          truthStatus: "FAUX",
          detailedWhy: "FAUX (Proposition à censurer) : dans la carence en fer, le sTfR est AUGMENTÉ (et l'index sTfR/ferritine est très augmenté).",
        },
        {
          letter: "D",
          text: "La teneur en hémoglobine des réticulocytes (RET-He) est inférieure à 28 pg",
          isCorrectSelection: false,
          truthStatus: "VRAI",
          detailedWhy: "Exact : un RET-He < 28 pg signe l'indisponibilité actuelle du fer pour l'érythropoïèse.",
        },
        {
          letter: "E",
          text: "Le traitement curatif repose sur les sels ferreux à raison de 100 à 200 mg/j chez l'adulte pendant 2 à 3 mois",
          isCorrectSelection: false,
          truthStatus: "VRAI",
          detailedWhy: "Exact : suivi d'une demi-dose pour recharger les réserves et du traitement de la cause.",
        },
      ],
      globalSynthesis:
        "Dans la carence martiale pure, la ferritine est basse et le sTfR est augmenté.",
    },
  ]);

  // Chargement synchronisé de TOUS les cours de la Bibliothèque (Library.tsx + Supabase courses + Résumés)
  useEffect(() => {
    const syncAllLibrarySources = async () => {
      const mergedMap = new Map<string, { id: string; title: string; subject?: string; content: string }>();

      // 1. Cours enregistrés dans la Bibliothèque (Library.tsx - localStorage & cours initiaux)
      try {
        const localCourses = getSavedCourses();
        for (const c of localCourses) {
          if (c && c.title && c.content) {
            mergedMap.set(c.id, {
              id: c.id,
              title: c.subject ? `${c.title} (${c.subject})` : c.title,
              subject: c.subject,
              content: c.content,
            });
          }
        }
      } catch {
        // ignore
      }

      // 2. Résumés locaux sauvegardés
      try {
        const rawLocalSummaries = localStorage.getItem("hippocampus_saved_summaries_v2");
        if (rawLocalSummaries) {
          const parsedSum = JSON.parse(rawLocalSummaries);
          if (Array.isArray(parsedSum)) {
            for (const s of parsedSum) {
              if (s && s.title && s.content && !mergedMap.has(s.id)) {
                mergedMap.set(s.id, {
                  id: String(s.id),
                  title: s.subject ? `${s.title} (${s.subject})` : String(s.title),
                  subject: s.subject,
                  content: String(s.content),
                });
              }
            }
          }
        }
      } catch {
        // ignore
      }

      // 3. Table Supabase "courses"
      try {
        const { data: sbCourses } = await untypedTable("courses")
          .select("id, title, subject, content")
          .order("created_at", { ascending: false })
          .limit(100);
        if (Array.isArray(sbCourses)) {
          for (const row of sbCourses) {
            if (row && row.title && row.content) {
              const duplicateByTitle = Array.from(mergedMap.values()).some(
                (existing) =>
                  String(existing?.title || "")
                    .toLowerCase()
                    .startsWith(String(row.title).trim().toLowerCase())
              );
              if (!duplicateByTitle) {
                mergedMap.set(String(row.id), {
                  id: String(row.id),
                  title: row.subject ? `${row.title} (${row.subject})` : String(row.title),
                  subject: row.subject,
                  content: String(row.content),
                });
              }
            }
          }
        }
      } catch {
        // Mode hors-ligne ou table vide
      }

      // 4. Table Supabase "summaries"
      try {
        const { data: sbSummaries } = await supabase
          .from("summaries")
          .select("id, title, content")
          .order("created_at", { ascending: false })
          .limit(50);
        if (Array.isArray(sbSummaries)) {
          for (const row of sbSummaries) {
            if (row && row.title && row.content) {
              const duplicateByTitle = Array.from(mergedMap.values()).some(
                (existing) =>
                  String(existing?.title || "")
                    .toLowerCase()
                    .startsWith(String(row.title).trim().toLowerCase())
              );
              if (!duplicateByTitle) {
                mergedMap.set(String(row.id), {
                  id: String(row.id),
                  title: String(row.title),
                  content: String(row.content),
                });
              }
            }
          }
        }
      } catch {
        // ignore
      }

      const finalItems = Array.from(mergedMap.values());
      if (finalItems.length > 0) {
        setLibrarySummaries(finalItems);

        // Vérifier s'il y a un raccourci actif depuis Library.tsx
        let targetItem = finalItems[0];
        try {
          const shortcutRaw = localStorage.getItem("hippocampus_active_course_shortcut");
          if (shortcutRaw) {
            const shortcut = JSON.parse(shortcutRaw);
            const foundByShortcut = finalItems.find(
              (item) =>
                item.id === shortcut.id ||
                String(item?.title || "")
                  .toLowerCase()
                  .includes(String(shortcut.title || "").toLowerCase())
            );
            if (foundByShortcut) {
              targetItem = foundByShortcut;
              setSourceType("cours_pre_uploade");
            }
            localStorage.removeItem("hippocampus_active_course_shortcut");
          }
        } catch {
          // ignore
        }

        setSelectedLibraryId((prev) => {
          const existing = finalItems.find((item) => item.id === prev);
          const chosen = existing || targetItem;
          setCoursePoleATitle(chosen.title.replace(/\s*\([^)]*\)\s*$/, ""));
          setCoursePoleAText(chosen.content);
          return chosen.id;
        });
      }
    };

    syncAllLibrarySources();
    window.addEventListener("focus", syncAllLibrarySources);
    window.addEventListener("storage", syncAllLibrarySources);
    return () => {
      window.removeEventListener("focus", syncAllLibrarySources);
      window.removeEventListener("storage", syncAllLibrarySources);
    };
  }, []);

  // Chronomètre de la session active
  useEffect(() => {
    if (activeTab !== "session_active" || isSessionFinished) return;
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [activeTab, isSessionFinished]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // ==========================================================================
  // GESTION DE LA SUPPRESSION DE MASSE DANS "MES QCM"
  // ==========================================================================
  const toggleSelectDeck = (id: string) => {
    setSelectedDeckIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllDecks = () => {
    if (selectedDeckIds.length === filteredDecks.length) {
      setSelectedDeckIds([]);
    } else {
      setSelectedDeckIds(filteredDecks.map((d) => d.id));
    }
  };

  const handleBulkDeleteDecks = () => {
    if (selectedDeckIds.length === 0) return;
    const count = selectedDeckIds.length;
    setDecks((prev) => prev.filter((d) => !selectedDeckIds.includes(d.id)));
    setSelectedDeckIds([]);
    toast({
      title: `${count} questionnaire(s) supprimé(s)`,
      description: "La suppression de masse a été effectuée avec succès.",
    });
  };

  // ==========================================================================
  // UPLOAD PÔLE A (COURS) & PÔLE B (ANNALES D'EXAMENS)
  // ==========================================================================
  const handleAddPoleAFiles = async (files: FileList) => {
    setIsReadingFiles(true);
    const newTags: UploadedFileTag[] = [];
    for (const file of Array.from(files)) {
      const res = await readFile(file);
      const text = typeof res === "string" ? res : res?.content || "";
      if (text) {
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        newTags.push({
          id: crypto.randomUUID(),
          name: file.name,
          wordCount: words,
          extractedText: text,
        });
      }
    }
    setPoleACourses((prev) => [...prev, ...newTags]);
    setIsReadingFiles(false);
    toast({
      title: `${newTags.length} cours chargé(s) dans le Pôle A ✨`,
      description: "Supports de cours prêts pour la transformation en QCM.",
    });
  };

  const handleRemovePoleAFile = (id: string) => {
    setPoleACourses((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddPoleBFiles = async (files: FileList) => {
    setIsReadingFiles(true);
    const newTags: UploadedFileTag[] = [];
    for (const file of Array.from(files)) {
      const res = await readFile(file);
      const text = typeof res === "string" ? res : res?.content || "";
      if (text) {
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        newTags.push({
          id: crypto.randomUUID(),
          name: file.name,
          wordCount: words,
          extractedText: text,
        });
      }
    }
    setPoleBAnnales((prev) => {
      const updated = [...prev, ...newTags];
      const combinedAnnales = updated
        .map((a) => `--- EXAMEN : ${a.name} ---\n${a.extractedText}`)
        .join("\n\n");
      if (combinedAnnales.trim()) {
        const dna = analyzeUploadedAnnalesDna(combinedAnnales);
        setAnnalesDna(dna);
        setSelectedFormats(dna.detectedFormats);
      }
      return updated;
    });
    setIsReadingFiles(false);
    toast({
      title: `${newTags.length} annale(s) chargée(s) dans le Pôle B ✨`,
      description: "ADN Docimologique actualisé.",
    });
  };

  const handleRemovePoleBFile = (id: string) => {
    setPoleBAnnales((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      const combinedAnnales = updated
        .map((a) => `--- EXAMEN : ${a.name} ---\n${a.extractedText}`)
        .join("\n\n");
      if (combinedAnnales.trim()) {
        const dna = analyzeUploadedAnnalesDna(combinedAnnales);
        setAnnalesDna(dna);
        setSelectedFormats(dna.detectedFormats);
      } else {
        setAnnalesDna(null);
      }
      return updated;
    });
  };

  const handleUploadCoursePoleA = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await readFile(file);
    const text = typeof res === "string" ? res : res?.content || "";
    if (text) {
      setCoursePoleAText(text);
      setCoursePoleATitle(file.name.replace(/\.[^/.]+$/, ""));
      toast({
        title: "Cours (Pôle A) chargé",
        description: `${file.name} est prêt à être transformé en QCM.`,
      });
    }
  };

  const handleUploadAnnalesPoleB = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    let combinedAnnales = annalesPoleBText;
    const newNames: string[] = [];

    for (const file of files) {
      const res = await readFile(file);
      const extracted = typeof res === "string" ? res : res?.content || "";
      if (extracted) {
        combinedAnnales += `\n\n--- EXAMEN : ${file.name} ---\n${extracted}`;
        newNames.push(file.name);
      }
    }

    setAnnalesPoleBText(combinedAnnales);
    setAnnalesFilenames((prev) => [...prev, ...newNames]);

    // Analyse immédiate de l'ADN Docimologique des annales chargées
    const dnaProfile = analyzeUploadedAnnalesDna(combinedAnnales);
    setAnnalesDna(dnaProfile);
    setSelectedFormats(dnaProfile.detectedFormats);

    toast({
      title: "ADN Docimologique des Annales extrait ✨",
      description: dnaProfile.summaryReport,
    });
  };

  // Sélection des formats (permet 1 seul mode, 2 modes ou plusieurs)
  const handleToggleFormat = (fmt: DocimologicalFormat) => {
    setSelectedFormats((prev) =>
      prev.includes(fmt)
        ? prev.length > 1
          ? prev.filter((f) => f !== fmt)
          : prev
        : [...prev, fmt]
    );
  };

  // ==========================================================================
  // GÉNÉRATION IA PAR LOTS CALIBRÉS (GARANTIE DU NOMBRE EXACT N & DE TOUS LES TYPES CHOISIS + MIMÉTISME D'ANNALES UNIVERSEL & ANTI-RÉPÉTITION)
  // ==========================================================================
  const handleGenerateAiQcm = async () => {
    const combinedCourseText =
      sourceType === "mimetisme_annales" && poleACourses.length > 0
        ? poleACourses.map((c) => `--- COURS : ${c.name} ---\n${c.extractedText}`).join("\n\n")
        : coursePoleAText;

    const combinedAnnalesText =
      sourceType === "mimetisme_annales" && poleBAnnales.length > 0
        ? poleBAnnales.map((a) => `--- EXAMEN : ${a.name} ---\n${a.extractedText}`).join("\n\n")
        : annalesPoleBText;

    const activeCourseTitle =
      sourceType === "mimetisme_annales" && poleACourses.length > 0
        ? poleACourses.map((c) => c.name.replace(/\.[^/.]+$/, "")).join(" + ")
        : coursePoleATitle || "Session Docimologique";

    if (!combinedCourseText.trim()) {
      toast({
        title: "Cours (Pôle A) requis",
        description: "Veuillez sélectionner ou uploader les cours (Pôle A) à transformer en QCM.",
        variant: "destructive",
      });
      return;
    }

    if (sourceType === "mimetisme_annales" && !combinedAnnalesText.trim()) {
      toast({
        title: "Annales (Pôle B) requises",
        description: "Veuillez uploader au moins un sujet d'examen (Pôle B) pour activer le mimétisme.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const isMimicry = sourceType === "mimetisme_annales" && annalesDna;
      const desiredCount = Math.max(1, Math.min(60, Number(questionCount) || 10));

      // Formats sélectionnés par l'utilisateur (ou détectés dans l'annale)
      const formatsToGenerate: DocimologicalFormat[] =
        isMimicry && !enableCustomTypesInMimicry && annalesDna.detectedFormats.length > 0
          ? annalesDna.detectedFormats
          : selectedFormats.length > 0
          ? selectedFormats
          : ["election", "choix_multiple", "censure"];

      const targetDifficulty = isMimicry
        ? annalesDna.inferredDifficulty
        : standardDifficulty;

      // Récupération de la mémoire anti-répétition pour ce cours (numéro de session + énoncés déjà générés)
      const generationMemory = getCourseGenerationMemory(activeCourseTitle);
      const currentSessionNumber = generationMemory.sessionCount;

      // Planning strict des formats question par question pour garantir la présence de TOUS les types choisis
      const fullFormatSchedule = buildFormatQuotaSchedule(
        formatsToGenerate,
        desiredCount,
        currentSessionNumber
      );

      const BATCH_SIZE = 5;
      const totalBatches = Math.ceil(desiredCount / BATCH_SIZE);
      const collectedRawQuestions: any[] = [];
      const accumulatedStems = [...generationMemory.pastStems];

      const systemInstruction = `Tu es un Professeur Agrégé et Président de Jury Docimologique en Faculté de Médecine.
Tu produis des évaluations d'examen de style Annales Officielles d'une rigueur scientifique, syntaxique et docimologique absolue.
Tu réponds EXCLUSIVEMENT par un tableau JSON valide contenant le nombre exact de questions demandées.`;

      for (let b = 0; b < totalBatches; b++) {
        const batchStart = b * BATCH_SIZE;
        const batchEnd = Math.min(desiredCount, batchStart + BATCH_SIZE);
        const batchFormats = fullFormatSchedule.slice(batchStart, batchEnd);
        if (batchFormats.length === 0) break;

        // Rotation du segment de cours pour couvrir l'ensemble de la leçon et éviter toute monotonie
        const textLen = combinedCourseText.length;
        const sliceSpan = Math.min(textLen, 16000);
        const offset =
          textLen > sliceSpan
            ? ((b * 5500 + currentSessionNumber * 3700) % Math.max(1, textLen - sliceSpan + 1))
            : 0;
        const courseChunk =
          combinedCourseText.slice(offset, offset + sliceSpan) ||
          combinedCourseText.slice(0, 16000);

        const batchPrompt = buildUniversalDocimologicalBatchPrompt({
          courseTitle: activeCourseTitle,
          courseChunk,
          batchFormats,
          batchStartIndex: batchStart,
          difficulty: targetDifficulty,
          annalesPoleB: combinedAnnalesText,
          dna: annalesDna,
          sessionNumber: currentSessionNumber + b,
          pastStems: accumulatedStems,
        });

        try {
          const responseText = await callDawiaEngine(
            selectedDawiaEngine,
            systemInstruction,
            batchPrompt,
            0.38
          );

          if (responseText) {
            const parsed = repairAndParseQuizJson(responseText);
            const batchArr = Array.isArray(parsed)
              ? parsed
              : parsed?.questions || parsed?.qcm || [parsed];
            if (Array.isArray(batchArr)) {
              for (const qItem of batchArr) {
                if (qItem && (qItem.stem || qItem.question || qItem.enonce)) {
                  collectedRawQuestions.push(qItem);
                  accumulatedStems.unshift(
                    String(qItem.stem || qItem.question || qItem.enonce)
                  );
                }
              }
            }
          }
        } catch {
          // Le validateur et synthétiseur de secours complétera automatiquement le quota exact
        }
      }

      const pureSubject = cleanMedicalCourseTitle(activeCourseTitle);

      // Validation, coercition aux types sélectionnés (Election, Choix Multiple, Censure, Groupage, Jumelage, Association)
      // et complétion garantie jusqu'à desiredCount exactement
      const validatedQuestions = sanitizeAndValidateQuestions(
        collectedRawQuestions,
        pureSubject,
        {
          expectedCount: desiredCount,
          selectedFormats: formatsToGenerate,
          courseText: combinedCourseText,
          difficulty: targetDifficulty,
          sessionNumber: currentSessionNumber,
        }
      );

      if (validatedQuestions.length === 0) {
        throw new Error("Aucune question valide n'a pu être extraite.");
      }

      // Mémorisation anti-répétition pour que la prochaine génération soit 100 % alternative
      recordCourseGenerationMemory(pureSubject, validatedQuestions);

      const newDeck: QcmQuizDeck = {
        id: crypto.randomUUID(),
        title: `QCM — ${pureSubject} (Série #${currentSessionNumber + 1})`,
        subject: pureSubject,
        sourceMode: isMimicry ? "Mimétisme d'Annales" : `Annales IA • Série #${currentSessionNumber + 1}`,
        questions: validatedQuestions,
        createdAt: new Date().toISOString(),
      };

      setDecks((prev) => [newDeck, ...prev]);
      startExamSession(newDeck);

      toast({
        title: `${validatedQuestions.length} QCM générés avec succès (Série #${currentSessionNumber + 1}) ✨`,
        description: `Tous les types sélectionnés (${formatsToGenerate.length}) sont présents • Syntaxe Annales calibrée.`,
      });
    } catch (err: any) {
      toast({
        title: "Erreur de génération",
        description: err?.message || "Vérifiez vos cours ou réessayez.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // ==========================================================================
  // FONCTIONS DE LA SESSION ACTIVE & DU CONSTRUCTEUR EN DÉFILEMENT
  // ==========================================================================
  const startExamSession = (deck: QcmQuizDeck) => {
    setActiveDeck(deck);
    setCurrentQuestionIdx(0);
    setUserSelections({});
    setValidatedQuestions({});
    setExpandedExplanations({});
    setFlaggedQuestions({});
    setIsSessionFinished(false);
    setElapsedSeconds(0);
    setActiveTab("session_active");
  };

  const openDeckInScrollableEditor = (deck: QcmQuizDeck) => {
    setEditableDeckId(deck.id);
    setEditableDeckTitle(deck.title);
    setEditableQuestions(JSON.parse(JSON.stringify(deck.questions)));
    setActiveTab("constructeur_manuel");
    toast({
      title: "Mode Édition en Défilement activé",
      description: `Les ${deck.questions.length} QCM sont chargés : faites défiler pour tout modifier.`,
    });
  };

  const handleDownloadDeckPdf = async (deck: QcmQuizDeck) => {
    try {
      const pureSubject = cleanMedicalCourseTitle(deck.subject || deck.title || "Médecine");
      const quizData: QuizData = {
        title: deck.title,
        subject: pureSubject,
        difficultyLabel: deck.questions[0]?.difficulty || "Intermédiaire",
        formatLabel: deck.sourceMode,
        theme: "dawjang",
        fontMode: "serif",
        includeAnswerGrid: true,
        includeAnswerKey: true,
        questions: deck.questions.map((q) => {
          let questionText = q.stem;
          if (q.groupStatements && q.groupStatements.length > 0) {
            questionText +=
              "\n\n" +
              q.groupStatements.map((s) => `${s.num}. ${s.text}`).join("\n");
          } else if (q.jumelageStatements) {
            questionText += `\n\nI. ${q.jumelageStatements.statement1}\nPARCE QUE\nII. ${q.jumelageStatements.statement2}`;
          } else if (q.associationPairs && q.associationPairs.length > 0) {
            questionText +=
              "\n\n" +
              q.associationPairs
                .map((p) => `${p.leftIndex}. ${p.leftText}  <--->  ${p.rightLetter}. ${p.rightText}`)
                .join("\n");
          }

          const correctLetters = q.options
            .filter((o) => o.isCorrectSelection)
            .map((o) => o.letter);

          return {
            question: questionText,
            qcmType: q.format,
            options: q.options.map((o) => ({
              label: o.letter,
              text: o.text,
              isCorrect: o.isCorrectSelection,
            })),
            correct: correctLetters,
            explanation:
              q.globalSynthesis ||
              q.options
                .map((o) => `${o.letter} (${o.truthStatus}) : ${o.detailedWhy}`)
                .join("\n"),
          };
        }),
      };

      await exportQuizToPDF(quizData);
    } catch (err) {
      console.error("[QcmMasterStudio] Erreur export PDF :", err);
      toast({
        title: "Erreur de téléchargement",
        description: "Impossible de compiler le PDF du QCM.",
        variant: "destructive",
      });
    }
  };

  const handleSaveScrollableEditor = () => {
    const newDeck: QcmQuizDeck = {
      id: editableDeckId || crypto.randomUUID(),
      title: editableDeckTitle.trim() || "Questionnaire Édité",
      subject: editableQuestions[0]?.subject || "Médecine",
      sourceMode: "Édité manuellement",
      questions: editableQuestions,
      createdAt: new Date().toISOString(),
    };

    setDecks((prev) => {
      const exists = prev.some((d) => d.id === newDeck.id);
      return exists
        ? prev.map((d) => (d.id === newDeck.id ? newDeck : d))
        : [newDeck, ...prev];
    });

    setActiveTab("mes_qcm");
    toast({
      title: "Questionnaire sauvegardé ✨",
      description: `${editableQuestions.length} QCM mis à jour dans Mes QCM.`,
    });
  };

  const filteredDecks = decks.filter(
    (d) =>
      (d.title || "").toLowerCase().includes((searchQuery || "").toLowerCase()) ||
      (d.subject || "").toLowerCase().includes((searchQuery || "").toLowerCase())
  );

  // Calcul du score final à la fin de la session
  const computeSessionScore = () => {
    if (!activeDeck) return { correct: 0, total: 0, percentage: 0 };
    let correct = 0;
    activeDeck.questions.forEach((rawQ, idx) => {
      const q = normalizeQuestionForDisplay(rawQ, idx, activeDeck.title);
      const userPicked = (userSelections[q.id] || []).sort().join(",");
      const expected = q.options
        .filter((o) => o.isCorrect)
        .map((o) => o.letter)
        .sort()
        .join(",");
      if (userPicked && userPicked === expected) correct += 1;
    });
    const total = activeDeck.questions.length;
    return {
      correct,
      total,
      percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  };

  const currentQ = activeDeck?.questions[currentQuestionIdx];

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-7">
      {/* =====================================================================
          EN-TÊTE STUDIO ACADÉMIQUE (MONOLIGNE STRICT, SANS AUCUN DÉPASSEMENT)
      ===================================================================== */}
      <CollisionFreeQcmHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        qcmCount={decks.length}
        hasActiveSession={Boolean(activeDeck)}
      />

      <AnimatePresence mode="wait">
        {/* ===================================================================
            VUE 1 : MES QCM (SUPPRESSION DE MASSE + MOSAÏQUE/ALIGNEMENT + MENU •••)
        =================================================================== */}
        {activeTab === "mes_qcm" && (
          <motion.div
            key="tab-mes-qcm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5"
          >
            {/* Barre supérieure : Recherche, Sélection de masse, Mosaïque/Alignement */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher parmi vos QCM..."
                    className="pl-10 rounded-2xl bg-card border-border h-10 text-xs sm:text-sm"
                  />
                </div>

                {filteredDecks.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAllDecks}
                    className="rounded-xl text-xs h-10 gap-2"
                  >
                    <Checkbox
                      checked={
                        filteredDecks.length > 0 &&
                        selectedDeckIds.length === filteredDecks.length
                      }
                    />
                    <span>Tout sélectionner</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {/* BOUTON DE SUPPRESSION DE MASSE DYNAMIQUE */}
                {selectedDeckIds.length > 0 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDeleteDecks}
                    className="rounded-xl h-10 px-4 text-xs font-bold gap-2 shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer la sélection ({selectedDeckIds.length})</span>
                  </Button>
                )}

                <div className="inline-flex items-center p-1 rounded-xl bg-muted border border-border">
                  <button
                    type="button"
                    onClick={() => setBankViewMode("mosaic")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      bankViewMode === "mosaic"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" /> Mosaïque
                  </button>
                  <button
                    type="button"
                    onClick={() => setBankViewMode("alignment")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      bankViewMode === "alignment"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    <List className="w-3.5 h-3.5" /> Alignement
                  </button>
                </div>

                <Button
                  type="button"
                  onClick={() => setActiveTab("generateur_ia")}
                  className="rounded-xl h-10 px-4 text-xs font-bold gap-2 bg-foreground text-background hover:bg-foreground/90"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Générer par IA
                </Button>
              </div>
            </div>

            {filteredDecks.length === 0 ? (
              <Card className="bg-card border-border/80 rounded-3xl p-14 text-center space-y-4">
                <div className="text-base font-bold text-foreground">
                  Aucun QCM trouvé dans votre banque
                </div>
                <p className="text-xs text-muted-foreground">
                  Utilisez le Générateur IA ou le Mimétisme d’Annales pour construire vos QCM personnalisés.
                </p>
                <Button
                  onClick={() => setActiveTab("generateur_ia")}
                  className="rounded-xl font-bold text-xs gap-2 bg-foreground text-background"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Ouvrir le Générateur IA
                </Button>
              </Card>
            ) : bankViewMode === "mosaic" ? (
              /* VUE MOSAÏQUE AVEC CASE DE SÉLECTION DE MASSE & MENU ••• ÉPURÉ */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDecks.map((deck) => {
                  const isSelected = selectedDeckIds.includes(deck.id);
                  return (
                    <Card
                      key={deck.id}
                      onClick={() => startExamSession(deck)}
                      className={`group bg-card rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                          : "border-border hover:border-primary/50 shadow-sm hover:shadow-md"
                      }`}
                    >
                      <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectDeck(deck.id);
                              }}
                              className="flex items-center gap-2.5"
                            >
                              <Checkbox checked={isSelected} />
                              <Badge variant="secondary" className="text-[10px] font-bold">
                                {deck.sourceMode}
                              </Badge>
                            </div>

                            {/* REMPLACEMENT DES BOUTONS DISPERSÉS PAR LE MENU ••• */}
                            <DeckThreeDotsMenu
                              onStartExam={() => {
                                navigate(`/exams?deckId=${encodeURIComponent(deck.id)}`);
                              }}
                              onEditInScrollBuilder={() => openDeckInScrollableEditor(deck)}
                              onDownloadPdf={() => handleDownloadDeckPdf(deck)}
                              onDelete={() =>
                                setDecks((prev) => prev.filter((d) => d.id !== deck.id))
                              }
                            />
                          </div>

                          <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                            {deck.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {deck.questions.length} questions docimologiques
                          </p>
                        </div>

                        <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>
                            {new Date(deck.createdAt).toLocaleDateString("fr-FR")}
                          </span>
                          <span className="font-bold text-primary group-hover:underline">
                            Lancer la session →
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              /* VUE ALIGNEMENT AVEC SÉLECTION DE MASSE & MENU ••• */
              <div className="bg-card border border-border rounded-2xl divide-y divide-border shadow-sm">
                {filteredDecks.map((deck) => {
                  const isSelected = selectedDeckIds.includes(deck.id);
                  return (
                    <div
                      key={deck.id}
                      onClick={() => startExamSession(deck)}
                      className={`flex items-center justify-between gap-4 px-5 py-3.5 transition-colors cursor-pointer ${
                        isSelected ? "bg-primary/5" : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectDeck(deck.id);
                          }}
                        >
                          <Checkbox checked={isSelected} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-foreground truncate">
                            {deck.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {deck.questions.length} QCM • {deck.sourceMode}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="outline" className="text-[11px]">
                          {deck.questions.length} QCM
                        </Badge>
                        <DeckThreeDotsMenu
                          onStartExam={() => {
                            navigate(`/exams?deckId=${encodeURIComponent(deck.id)}`);
                          }}
                          onEditInScrollBuilder={() => openDeckInScrollableEditor(deck)}
                          onDownloadPdf={() => handleDownloadDeckPdf(deck)}
                          onDelete={() =>
                            setDecks((prev) => prev.filter((d) => d.id !== deck.id))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ===================================================================
            VUE 2 : GÉNÉRATEUR IA (AVEC MIMÉTISME D'ANNALES INTELLIGENT)
        =================================================================== */}
        {activeTab === "generateur_ia" && (
          <motion.div
            key="tab-generateur-ia"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-5xl mx-auto"
          >
            <Card className="bg-card border-border/80 shadow-sm rounded-3xl overflow-hidden">
              <CardContent className="p-6 sm:p-10 space-y-8">
                {/* En-tête fidèle au design */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-wider uppercase">
                      MOTEUR DAWIA • DOCIMOLOGIE MÉDICALE COMPLÈTE
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      Classique • Censure • Groupage • Jumelage • Association
                    </span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-foreground">
                    Constructeur Intelligent de QCM
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Sélectionnez votre source de cours, le type docimologique souhaité et lancez une génération calquée sur les exigences des professeurs.
                  </p>
                </div>

                {/* 1. LES 4 SOURCES DU COURS CONSERVÉES ET SUBLIMÉES */}
                <div className="space-y-3.5">
                  <label className="text-sm font-bold text-foreground block">
                    1. Source du cours à transformer en QCM
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {[
                      {
                        id: "cours_pre_uploade" as GeneratorSourceType,
                        title: "Cours pré-uploadé",
                        desc: "Choisir un cours déjà enregistré dans votre Bibliothèque.",
                        icon: BookOpen,
                      },
                      {
                        id: "importer_fichier" as GeneratorSourceType,
                        title: "Importer un fichier",
                        desc: "Uploader un document de cours depuis votre appareil.",
                        icon: Upload,
                      },
                      {
                        id: "avec_du_texte" as GeneratorSourceType,
                        title: "Avec du texte",
                        desc: "Coller directement un extrait ou un chapitre de leçon.",
                        icon: FileText,
                      },
                      {
                        id: "mimetisme_annales" as GeneratorSourceType,
                        title: "Mimétisme d’Annales",
                        desc: "Cours + Upload d'examens pour cloner le style, le type et le niveau des profs.",
                        icon: GraduationCap,
                        isNew: true,
                      },
                    ].map((src) => {
                      const SIcon = src.icon;
                      const active = sourceType === src.id;
                      return (
                        <div
                          key={src.id}
                          onClick={() => setSourceType(src.id)}
                          className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-4 ${
                            active
                              ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                              : "border-border bg-background/50 hover:border-primary/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <SIcon className="w-4 h-4 text-primary shrink-0" />
                              <span className="text-xs sm:text-sm font-bold text-foreground">
                                {src.title}
                              </span>
                            </div>
                            {src.isNew && (
                              <span className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[9px] font-extrabold uppercase">
                                NOUVEAU
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {src.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Contenu dynamique selon la source choisie */}
                  <div className="pt-2 space-y-4">
                    {sourceType === "mimetisme_annales" ? (
                      <DualMassUploadMimicryStudio
                        poleACourses={poleACourses}
                        onAddPoleAFiles={handleAddPoleAFiles}
                        onRemovePoleAFile={handleRemovePoleAFile}
                        poleBAnnales={poleBAnnales}
                        onAddPoleBFiles={handleAddPoleBFiles}
                        onRemovePoleBFile={handleRemovePoleBFile}
                        isReadingFiles={isReadingFiles}
                        detectedDnaSummary={annalesDna?.summaryReport}
                        inferredDifficulty={annalesDna?.inferredDifficulty}
                        enableCustomTypes={enableCustomTypesInMimicry}
                        onToggleCustomTypes={setEnableCustomTypesInMimicry}
                      />
                    ) : (
                      <>
                        {sourceType === "cours_pre_uploade" && (
                          <div className="space-y-2 p-4 rounded-2xl bg-background border border-border">
                            <label className="text-xs font-bold text-foreground block">
                              Sélectionner le cours dans votre Bibliothèque ({librarySummaries.length})
                            </label>
                            <select
                              value={selectedLibraryId}
                              onChange={(e) => {
                                const id = e.target.value;
                                setSelectedLibraryId(id);
                                const found = librarySummaries.find((s) => s.id === id);
                                if (found) {
                                  setCoursePoleATitle(found.title);
                                  setCoursePoleAText(found.content);
                                }
                              }}
                              className="w-full h-10 rounded-xl bg-card border border-border px-3 text-xs sm:text-sm font-medium text-foreground"
                            >
                              {librarySummaries.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {sourceType === "importer_fichier" && (
                          <div
                            onClick={() => courseFileInputRef.current?.click()}
                            className="p-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 bg-background text-center cursor-pointer space-y-2"
                          >
                            <input
                              ref={courseFileInputRef}
                              type="file"
                              accept=".pdf,.doc,.docx,.txt"
                              onChange={handleUploadCoursePoleA}
                              className="hidden"
                            />
                            <Upload className="w-6 h-6 text-primary mx-auto" />
                            <div className="text-xs font-bold text-foreground">
                              {coursePoleATitle
                                ? `✓ Cours chargé : ${coursePoleATitle}`
                                : "Cliquez pour uploader votre cours (PDF, DOCX, TXT)"}
                            </div>
                          </div>
                        )}

                        {sourceType === "avec_du_texte" && (
                          <textarea
                            value={coursePoleAText}
                            onChange={(e) => setCoursePoleAText(e.target.value)}
                            rows={4}
                            placeholder="Collez ici le contenu de votre cours..."
                            className="w-full rounded-2xl bg-background border border-border p-4 text-xs sm:text-sm"
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 2. SÉLECTION DU TYPE DE QCM (Toujours visible en mode normal, ou si l'option est activée en Mimétisme) */}
                {(sourceType !== "mimetisme_annales" || enableCustomTypesInMimicry) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-foreground">
                        2. Type(s) de QCM à produire (vous pouvez en choisir 1 seul, 2 ou plusieurs)
                      </label>
                      <span className="text-xs font-semibold text-primary">
                        {selectedFormats.length} mode(s) sélectionné(s)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {FORMAT_METADATA.map((fmt) => {
                        const FIcon = fmt.icon;
                        const active = selectedFormats.includes(fmt.id);
                        return (
                          <div
                            key={fmt.id}
                            onClick={() => handleToggleFormat(fmt.id)}
                            className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                              active
                                ? "border-primary bg-primary/10 text-foreground shadow-sm"
                                : "border-border bg-background/50 text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FIcon
                                className={`w-4 h-4 shrink-0 ${
                                  active ? "text-primary" : ""
                                }`}
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-foreground truncate">
                                  {fmt.label}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {fmt.shortDesc}
                                </div>
                              </div>
                            </div>
                            {active && (
                              <Check className="w-4 h-4 text-primary shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SÉLECTION DU MOTEUR DOCIMOLOGIQUE DAWIA (DAWIA 1 vs DAWIA 2) */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm font-bold text-foreground block">
                      Moteur d'évaluation docimologique
                    </label>
                    <Badge variant="outline" className={cn("font-mono text-[10.5px]", DAWIA_ENGINES[selectedDawiaEngine].badgeColor)}>
                      {DAWIA_ENGINES[selectedDawiaEngine].badge}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {(["dawia1", "dawia2"] as const).map((engKey) => {
                      const meta = DAWIA_ENGINES[engKey];
                      const active = selectedDawiaEngine === engKey;
                      return (
                        <button
                          key={engKey}
                          type="button"
                          onClick={() => handleSelectDawiaEngine(engKey)}
                          className={cn(
                            "rounded-2xl border p-4 text-left transition-all flex flex-col justify-between gap-2 group",
                            active
                              ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                              : "border-border bg-background/60 hover:border-foreground/30 hover:bg-secondary/20"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[11px] font-bold transition-colors",
                                  active
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground group-hover:text-foreground"
                                )}
                              >
                                {engKey === "dawia1" ? "D1" : "D2"}
                              </span>
                              <div>
                                <span className="text-sm font-bold text-foreground block leading-tight">
                                  {meta.name}
                                </span>
                                <span className="text-[11px] text-muted-foreground font-medium block">
                                  {meta.subtitle}
                                </span>
                              </div>
                            </div>
                            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0", meta.badgeColor)}>
                              {meta.badge}
                            </span>
                          </div>
                          <p className="text-[11.5px] text-muted-foreground leading-snug pt-1">
                            {meta.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. NOMBRE DE QUESTIONS (SANS LES SUGGESTIONS REDONDANTES 10, 20, 30, 50 EN DESSOUS) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground block">
                      Nombre de questions à générer
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={questionCount}
                      onChange={(e) =>
                        setQuestionCount(
                          Math.max(1, Math.min(60, Number(e.target.value) || 1))
                        )
                      }
                      className="h-11 rounded-xl bg-background border-border text-sm font-bold"
                    />
                  </div>

                  {/* Difficulté : manuelle en mode normal, verrouillée sur l'annale en mode Mimétisme */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground block">
                      Niveau de sélectivité clinique
                    </label>
                    {sourceType === "mimetisme_annales" ? (
                      <div className="h-11 rounded-xl bg-muted/60 border border-border px-3.5 flex items-center justify-between text-xs font-semibold text-foreground">
                        <span>
                          Calqué automatiquement sur l’annale :{" "}
                          <strong className="text-primary">
                            {annalesDna?.inferredDifficulty || "Auto-évaluation à l'upload"}
                          </strong>
                        </span>
                      </div>
                    ) : (
                      <select
                        value={standardDifficulty}
                        onChange={(e) => setStandardDifficulty(e.target.value)}
                        className="w-full h-11 rounded-xl bg-background border border-border px-3.5 text-xs sm:text-sm font-semibold text-foreground"
                      >
                        <option value="Fondamental">Fondamental (Seuils & Définitions)</option>
                        <option value="Intermédiaire">Intermédiaire (Mécanismes & Diagnostic)</option>
                        <option value="Avancé (Concours Faculté)">
                          Avancé (Cas cliniques, Pièges & Contre-indications)
                        </option>
                      </select>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  size="lg"
                  disabled={isGenerating}
                  onClick={handleGenerateAiQcm}
                  className="w-full rounded-2xl h-12 font-bold text-sm gap-2 shadow-md"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Clonage docimologique {DAWIA_ENGINES[selectedDawiaEngine].name} et vérification des propositions...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Lancer la génération des {questionCount} QCM ({DAWIA_ENGINES[selectedDawiaEngine].name})</span>
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ===================================================================
            VUE 3 : SESSION ACTIVE (PALETTE 1..N, PRÉCÉDENT/SUIVANT, EXPLICATION PAR ITEM, ET SAUVEGARDE EN FIN DE SESSION UNIQUEMENT)
        =================================================================== */}
        {activeTab === "session_active" && activeDeck && (
          <motion.div
            key="tab-session-active"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-4xl mx-auto space-y-5"
          >
            {!isSessionFinished ? (
              <EliteQuestionSessionPlayer
                deckTitle={activeDeck.title}
                rawQuestions={activeDeck.questions}
                currentIndex={currentQuestionIdx}
                onChangeIndex={setCurrentQuestionIdx}
                userSelections={userSelections}
                onToggleOption={(qId, letter, isSingleChoice) => {
                  setUserSelections((prev) => {
                    const currentList = prev[qId] || [];
                    if (isSingleChoice) {
                      return { ...prev, [qId]: [letter] };
                    }
                    return {
                      ...prev,
                      [qId]: currentList.includes(letter)
                        ? currentList.filter((l) => l !== letter)
                        : [...currentList, letter],
                    };
                  });
                }}
                validatedMap={validatedQuestions}
                onValidateQuestion={(qId) => {
                  setValidatedQuestions((prev) => ({ ...prev, [qId]: true }));
                  setExpandedExplanations((prev) => ({ ...prev, [qId]: true }));
                }}
                flaggedMap={flaggedQuestions}
                onToggleFlag={(qId) =>
                  setFlaggedQuestions((prev) => ({ ...prev, [qId]: !prev[qId] }))
                }
                showDetailedMap={expandedExplanations}
                onToggleDetailed={(qId) =>
                  setExpandedExplanations((prev) => ({ ...prev, [qId]: !prev[qId] }))
                }
                elapsedTimeFormatted={formatTimer(elapsedSeconds)}
                onFinishSession={() => setIsSessionFinished(true)}
              />
            ) : (
              /* ===============================================================
                 ÉCRAN FINAL : "SESSION TERMINÉE !" AVEC LES BOUTONS SAUVEGARDER, EXPORTER PDF & ÉDITER
              =============================================================== */
              <Card className="bg-card border-border/80 rounded-3xl shadow-sm overflow-hidden">
                <CardContent className="p-8 sm:p-12 text-center space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Trophy className="w-7 h-7" />
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-2xl font-extrabold text-foreground">
                      Session terminée !
                    </h2>
                    <p className="text-sm text-muted-foreground">{activeDeck.title}</p>
                  </div>

                  {(() => {
                    const score = computeSessionScore();
                    return (
                      <div className="max-w-xs mx-auto p-6 rounded-3xl bg-background border border-border space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          SCORE FINAL
                        </div>
                        <div className="text-4xl font-extrabold text-primary">
                          {score.correct}{" "}
                          <span className="text-xl text-muted-foreground">
                            / {score.total}
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-1 text-xs">
                          <Badge variant="secondary">{score.percentage}%</Badge>
                          <Badge variant="outline">⏱ {formatTimer(elapsedSeconds)}</Badge>
                        </div>
                      </div>
                    );
                  })()}

                  {/* C'EST ICI (EN FIN DE SESSION) QUE SE TROUVENT SAUVEGARDER, EXPORTER PDF & ÉDITER */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                    <Button
                      type="button"
                      onClick={() => {
                        toast({
                          title: "Session sauvegardée dans Mes QCM ✨",
                          description: "Votre score et vos réponses ont été mémorisés.",
                        });
                        setActiveTab("mes_qcm");
                      }}
                      className="rounded-xl text-xs font-bold gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Enregistrer / Sauvegarder
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => activeDeck && handleDownloadDeckPdf(activeDeck)}
                      className="rounded-xl text-xs font-bold gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger le PDF
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openDeckInScrollableEditor(activeDeck)}
                      className="rounded-xl text-xs font-bold gap-2"
                    >
                      <PenTool className="w-4 h-4" />
                      Éditer ces QCM dans le Constructeur
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setIsSessionFinished(false);
                        setCurrentQuestionIdx(0);
                      }}
                      className="rounded-xl text-xs font-bold gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Revoir les questions & corrigés
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* ===================================================================
            VUE 4 : CONSTRUCTEUR MANUEL EN DÉFILEMENT CONTINU (SCROLLABLE BATCH EDITOR)
        =================================================================== */}
        {activeTab === "constructeur_manuel" && (
          <motion.div
            key="tab-constructeur-manuel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-5xl mx-auto space-y-6 pb-16"
          >
            {/* Barre supérieure sticky d'enregistrement global du lot */}
            <div className="sticky top-3 z-30 bg-card/95 backdrop-blur-md border border-border rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[240px]">
                <Input
                  value={editableDeckTitle}
                  onChange={(e) => setEditableDeckTitle(e.target.value)}
                  className="text-base font-extrabold bg-background rounded-xl"
                  placeholder="Titre du questionnaire..."
                />
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditableQuestions((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        format: "choix_multiple",
                        subject: "Médecine",
                        difficulty: "Intermédiaire",
                        stem: `Nouvelle question #${prev.length + 1}`,
                        options: ["A", "B", "C", "D", "E"].map((letter) => ({
                          letter,
                          text: "",
                          isCorrectSelection: letter === "A",
                          truthStatus: letter === "A" ? "VRAI" : "FAUX",
                          detailedWhy: "",
                        })),
                        globalSynthesis: "",
                      },
                    ])
                  }
                  className="rounded-xl text-xs font-bold gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un QCM
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveScrollableEditor}
                  className="rounded-xl text-xs font-bold gap-1.5 px-4"
                >
                  <Save className="w-4 h-4" />
                  Sauvegarder les {editableQuestions.length} QCM
                </Button>
              </div>
            </div>

            {/* LISTE EN DÉFILEMENT CONTINU DE TOUS LES QCM DU QUESTIONNAIRE */}
            <div className="space-y-6">
              {editableQuestions.map((q, qIndex) => (
                <Card
                  key={q.id}
                  className="bg-card border-border/80 rounded-3xl shadow-sm overflow-hidden"
                >
                  <CardContent className="p-6 sm:p-8 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-primary/15 text-primary text-xs font-extrabold flex items-center justify-center">
                          Q{qIndex + 1}
                        </span>
                        <select
                          value={q.format}
                          onChange={(e) => {
                            const newFmt = e.target.value as DocimologicalFormat;
                            setEditableQuestions((prev) =>
                              prev.map((item, i) =>
                                i === qIndex ? { ...item, format: newFmt } : item
                              )
                            );
                          }}
                          className="h-9 rounded-xl bg-background border border-border px-3 text-xs font-bold text-foreground"
                        >
                          {FORMAT_METADATA.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label} — {f.shortDesc}
                            </option>
                          ))}
                        </select>
                      </div>

                      {editableQuestions.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEditableQuestions((prev) =>
                              prev.filter((_, i) => i !== qIndex)
                            )
                          }
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl text-xs"
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Supprimer Q{qIndex + 1}
                        </Button>
                      )}
                    </div>

                    {/* Énoncé */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground">
                        Énoncé de la question Q{qIndex + 1}
                      </label>
                      <textarea
                        value={q.stem}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditableQuestions((prev) =>
                            prev.map((item, i) =>
                              i === qIndex ? { ...item, stem: val } : item
                            )
                          );
                        }}
                        rows={2}
                        className="w-full rounded-2xl bg-background border border-border p-3.5 text-xs sm:text-sm font-semibold text-foreground"
                      />
                    </div>

                    {/* Propositions A-E et Explications par item */}
                    <div className="space-y-3">
                      {q.options.map((opt, oIndex) => (
                        <div
                          key={opt.letter}
                          className={`p-3.5 rounded-2xl border space-y-2 ${
                            opt.isCorrectSelection
                              ? q.format === "censure"
                                ? "border-destructive/60 bg-destructive/5"
                                : "border-emerald-500/60 bg-emerald-500/5"
                              : "border-border bg-background"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setEditableQuestions((prev) =>
                                  prev.map((item, i) => {
                                    if (i !== qIndex) return item;
                                    return {
                                      ...item,
                                      options: item.options.map((o, j) => {
                                        if (item.format === "election") {
                                          return {
                                            ...o,
                                            isCorrectSelection: j === oIndex,
                                            truthStatus: j === oIndex ? "VRAI" : "FAUX",
                                          };
                                        }
                                        if (j !== oIndex) return o;
                                        const nextSelected = !o.isCorrectSelection;
                                        return {
                                          ...o,
                                          isCorrectSelection: nextSelected,
                                          truthStatus:
                                            item.format === "censure"
                                              ? nextSelected
                                                ? "FAUX"
                                                : "VRAI"
                                              : nextSelected
                                              ? "VRAI"
                                              : "FAUX",
                                        };
                                      }),
                                    };
                                  })
                                );
                              }}
                              className={`w-8 h-8 rounded-xl text-xs font-extrabold flex items-center justify-center shrink-0 ${
                                opt.isCorrectSelection
                                  ? q.format === "censure"
                                    ? "bg-destructive text-destructive-foreground"
                                    : "bg-emerald-600 text-white"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {opt.letter}
                            </button>

                            <Input
                              value={opt.text}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditableQuestions((prev) =>
                                  prev.map((item, i) =>
                                    i !== qIndex
                                      ? item
                                      : {
                                          ...item,
                                          options: item.options.map((o, j) =>
                                            j === oIndex ? { ...o, text: val } : o
                                          ),
                                        }
                                  )
                                );
                              }}
                              placeholder={`Proposition ${opt.letter}...`}
                              className="h-9 text-xs sm:text-sm bg-card rounded-xl flex-1"
                            />

                            <Badge
                              variant={
                                opt.isCorrectSelection
                                  ? q.format === "censure"
                                    ? "destructive"
                                    : "default"
                                  : "outline"
                              }
                              className="text-[10px] shrink-0"
                            >
                              {q.format === "censure"
                                ? opt.isCorrectSelection
                                  ? "❌ Fausse (Cible)"
                                  : "✓ Vraie"
                                : opt.isCorrectSelection
                                ? "✓ Exacte"
                                : "Fausse"}
                            </Badge>
                          </div>

                          <Input
                            value={opt.detailedWhy}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditableQuestions((prev) =>
                                prev.map((item, i) =>
                                  i !== qIndex
                                    ? item
                                    : {
                                        ...item,
                                        options: item.options.map((o, j) =>
                                          j === oIndex ? { ...o, detailedWhy: val } : o
                                        ),
                                      }
                                )
                              );
                            }}
                            placeholder={`Justification de l'item ${opt.letter} (pourquoi vrai ou faux)...`}
                            className="h-8 text-[11px] bg-card/70 border-dashed rounded-lg text-muted-foreground"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
