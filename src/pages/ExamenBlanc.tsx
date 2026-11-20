// src/pages/ExamenBlanc.tsx
// ============================================================================
// EXAMEN BLANC — Studio & Analyse · Bibliothèque · Feuille d'Examen Officielle
// Design Éditorial Haute Couture (Calibre Stripe / Linear / Claude / Presses Académiques)
// Moteur 100 % Universel (aucun biais de matière) : voir src/lib/examenBlancEngine.ts
// ============================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get as idbGet, set as idbSet } from "idb-keyval";
import {
  Upload,
  Download,
  Trash2,
  Clock,
  Play,
  Pause,
  ArrowUpDown,
  Plus,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Loader2,
  Library as LibraryIcon,
  RotateCcw,
  Square,
  Sparkles,
  Fingerprint,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Eye,
  SlidersHorizontal,
  Layers,
  Award,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { notify } from "@/lib/notificationHub";
import { useFileReader } from "@/hooks/useFileReader";
import { exportQuizToPDF } from "@/utils/pdfExport";
import type { QuizData } from "@/utils/QuizPDF";
import { getSavedCourses } from "@/pages/Library";
import { getSavedStudentProfile } from "@/lib/studentProfile";
import {
  EB_FORMAT_LABELS,
  EB_FORMAT_SHORT_LABELS,
  EXAMEN_BLANC_SYSTEM_PROMPT,
  buildLesson,
  buildExamDesign,
  cleanLessonTitle,
  computeScore,
  fillSystemPrompt,
  flagDuplicateLessons,
  formatSessionDate,
  generateExamBlanc,
  getInfiniteMemoryStats,
  getObservedLessonFrequency,
  loadInfiniteMemoryLedger,
  resetInfiniteMemoryLedger,
  isCachedAnnaleCrossContaminated,
  isItemCorrect,
  loadSessions,
  loadSessionsAsync,
  normalizeText,
  runDeepAnalysis,
  saveSessions,
  saveSessionsAsync,
  sessionToPdfQuestions,
  sizeLabelOf,
  rescueFileReadLocally,
  type AnalysisProgress,
  type CorpusAnalysis,
  type EBAnnale,
  type EBFormat,
  type EBItem,
  type EBLesson,
  type ExamSession,
} from "@/lib/examenBlancEngine";
import { detectSubjectsInExamText } from "@/lib/disciplineProfileEngine";

const STUDIO_KEY = "dawjang_eb_studio_v4_pure_universal";
const DURATION_CHOICES = [30, 45, 60, 90, 120, 180];

interface SubjectWorkspaceSnapshot {
  ue: string;
  subject: string;
  durationMin: number;
  lessons: EBLesson[];
  analysis: CorpusAnalysis | null;
  analysisSignature: string;
  selectedLessonIds: string[];
  customQuota: number | null;
  step1Validated: boolean;
  step2Validated: boolean;
  analysisValidated: boolean;
  updatedAt: number;
}

const normalizeWsPart = (val: string): string =>
  String(val || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const buildSubjectWorkspaceKey = (ue: string, subject: string): string =>
  `${normalizeWsPart(ue) || "_ue"}::${normalizeWsPart(subject) || "_subject"}`;

const buildUePoolKey = (ue: string): string =>
  normalizeWsPart(ue) || "_ue";

const formatClock = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const detectYearFromName = (name: string) => (/\b(20[012]\d)\b/.exec(name) || [])[1] || "";

export const ExamenBlanc: React.FC = () => {
  const { toast } = useToast();
  const { readFile, readingProgress } = useFileReader();

  const [activeView, setActiveView] = useState<"studio" | "library" | "exam">("studio");
  const [ueInput, setUeInput] = useState("");
  const [subjectInput, setSubjectInput] = useState("");
  const [durationMin, setDurationMin] = useState(60);

  const [lessons, setLessons] = useState<EBLesson[]>([]);
  const [annales, setAnnales] = useState<EBAnnale[]>([]);
  const [analysis, setAnalysis] = useState<CorpusAnalysis | null>(null);
  const [analysisSignature, setAnalysisSignature] = useState("");
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [probSortOrder, setProbSortOrder] = useState<"desc" | "asc">("desc");
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const [showDnaModal, setShowDnaModal] = useState(false);

  const [step1Validated, setStep1Validated] = useState(false);
  const [step2Validated, setStep2Validated] = useState(false);
  const [analysisValidated, setAnalysisValidated] = useState(false);
  const [customQuota, setCustomQuota] = useState<number | null>(null);
  const [sidebarBoundaryLeft, setSidebarBoundaryLeft] = useState(0);

  // Partitionnement multi-matières par couple (UE, Matière) et annales partagées par UE
  const [subjectWorkspaces, setSubjectWorkspaces] = useState<Record<string, SubjectWorkspaceSnapshot>>({});
  const [ueAnnalesByUe, setUeAnnalesByUe] = useState<Record<string, EBAnnale[]>>({});
  const activeWorkspaceKeyRef = useRef<string>("");
  const activeUeKeyRef = useRef<string>("");
  const activeOwnerSubjectRef = useRef<{ ue: string; subject: string }>({ ue: "", subject: "" });

  const [isReading, setIsReading] = useState(false);
  const [batchFileProgress, setBatchFileProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<AnalysisProgress | null>(null);
  const cancelRef = useRef(false);

  const [sessions, setSessions] = useState<ExamSession[]>(() => loadSessions());
  const [infiniteStats, setInfiniteStats] = useState(() => getInfiniteMemoryStats());
  const sessionsHydratedRef = useRef(false);
  const studentProfile = useMemo(() => getSavedStudentProfile(), []);
  const [activeSession, setActiveSession] = useState<ExamSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [correctionMode, setCorrectionMode] = useState(false);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [timerRemainingSec, setTimerRemainingSec] = useState(60 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDetached, setTimerDetached] = useState(false);

  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [engineInspectorOpen, setEngineInspectorOpen] = useState(false);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [libraryCourses, setLibraryCourses] = useState<any[]>([]);
  const [libraryPicked, setLibraryPicked] = useState<string[]>([]);

  const pageRootRef = useRef<HTMLDivElement>(null);
  const originStationRef = useRef<HTMLDivElement>(null);
  const coursesInputRef = useRef<HTMLInputElement>(null);
  const annalesInputRef = useRef<HTMLInputElement>(null);

  // Calcule en temps réel la ligne de séparation exacte entre la Sidebar et la page actuelle (<main>)
  useEffect(() => {
    const getAnchorEl = () =>
      (pageRootRef.current?.closest("main") as HTMLElement | null) || pageRootRef.current;

    const updateSidebarBoundary = () => {
      const anchorEl = getAnchorEl();
      if (!anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      setSidebarBoundaryLeft(Math.max(0, Math.floor(rect.left)));
    };

    updateSidebarBoundary();
    const anchorEl = getAnchorEl();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateSidebarBoundary) : null;
    if (ro) {
      if (anchorEl) ro.observe(anchorEl);
      if (pageRootRef.current && pageRootRef.current !== anchorEl) ro.observe(pageRootRef.current);
      if (document.body) ro.observe(document.body);
    }
    window.addEventListener("resize", updateSidebarBoundary, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateSidebarBoundary);
    };
  }, [activeView, leftDrawerOpen]);

  // ------------------------------------------------------------------ persistance IndexedDB (100 % intégral sans troncature)
  useEffect(() => {
    (async () => {
      try {
        const [idbState, idbSessions] = await Promise.all([
          idbGet<any>(STUDIO_KEY),
          loadSessionsAsync(),
        ]);
        if (idbSessions.length > 0) {
          setSessions(idbSessions);
        }
        const loadedLedger = await loadInfiniteMemoryLedger();
        setInfiniteStats(getInfiniteMemoryStats(loadedLedger));
        const s =
          idbState ||
          (localStorage.getItem(STUDIO_KEY) ? JSON.parse(localStorage.getItem(STUDIO_KEY)!) : null);
        if (!s) return;
        const loadedUe = s.ue || "";
        const loadedSubject = s.subject || "";
        setUeInput(loadedUe);
        setSubjectInput(loadedSubject);
        setDurationMin(s.durationMin || 60);
        const loadedLessons = Array.isArray(s.lessons) ? s.lessons : [];
        setLessons(loadedLessons);
        const cleanLoadedAnnales = Array.isArray(s.annales)
          ? s.annales.filter((a: any) => !isCachedAnnaleCrossContaminated(a?.title || "", a?.rawText || ""))
          : [];
        setAnnales(cleanLoadedAnnales);
        setAnalysis(s.analysis || null);
        setAnalysisSignature(s.analysisSignature || "");
        setSelectedLessonIds(Array.isArray(s.selectedLessonIds) ? s.selectedLessonIds : []);
        if (typeof s.customQuota === "number") setCustomQuota(s.customQuota);

        if (s.subjectWorkspaces && typeof s.subjectWorkspaces === "object") {
          setSubjectWorkspaces(s.subjectWorkspaces);
        }
        if (s.ueAnnalesByUe && typeof s.ueAnnalesByUe === "object") {
          const cleanedPools: Record<string, EBAnnale[]> = {};
          for (const [k, list] of Object.entries(s.ueAnnalesByUe)) {
            if (Array.isArray(list)) {
              cleanedPools[k] = list.filter(
                (a: any) => !isCachedAnnaleCrossContaminated(a?.title || "", a?.rawText || "")
              );
            }
          }
          setUeAnnalesByUe(cleanedPools);
        }
        if (loadedSubject.trim()) {
          activeWorkspaceKeyRef.current = buildSubjectWorkspaceKey(loadedUe, loadedSubject);
          activeUeKeyRef.current = buildUePoolKey(loadedUe);
          activeOwnerSubjectRef.current = { ue: loadedUe, subject: loadedSubject };
        }

        if (typeof s.step1Validated === "boolean") {
          setStep1Validated(s.step1Validated);
        } else if (loadedSubject.trim() && (loadedLessons.length > 0 || cleanLoadedAnnales.length > 0 || s.analysis)) {
          setStep1Validated(true);
        }
        if (typeof s.step2Validated === "boolean") {
          setStep2Validated(s.step2Validated);
        } else if (loadedLessons.length > 0 || s.analysis) {
          setStep2Validated(true);
        }
        if (typeof s.analysisValidated === "boolean") setAnalysisValidated(s.analysisValidated);
      } catch (err) {
        console.warn("[ExamenBlanc] Erreur chargement IndexedDB:", err);
      } finally {
        sessionsHydratedRef.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      const currentKey =
        activeWorkspaceKeyRef.current &&
        activeWorkspaceKeyRef.current === buildSubjectWorkspaceKey(ueInput, subjectInput)
          ? activeWorkspaceKeyRef.current
          : "";
      const currentUeKey = activeUeKeyRef.current || buildUePoolKey(ueInput);
      const nextWorkspaces: Record<string, SubjectWorkspaceSnapshot> = { ...subjectWorkspaces };
      if (currentKey && subjectInput.trim()) {
        nextWorkspaces[currentKey] = {
          ue: ueInput.trim(),
          subject: subjectInput.trim(),
          durationMin,
          lessons,
          analysis,
          analysisSignature,
          selectedLessonIds,
          customQuota,
          step1Validated,
          step2Validated,
          analysisValidated,
          updatedAt: Date.now(),
        };
      }
      const nextUeAnnales: Record<string, EBAnnale[]> = { ...ueAnnalesByUe };
      if (annales.length > 0 || nextUeAnnales[currentUeKey]) {
        nextUeAnnales[currentUeKey] = annales;
      }

      const full = {
        ue: ueInput,
        subject: subjectInput,
        durationMin,
        selectedLessonIds,
        lessons,
        annales,
        analysis,
        analysisSignature,
        customQuota,
        step1Validated,
        step2Validated,
        analysisValidated,
        subjectWorkspaces: nextWorkspaces,
        ueAnnalesByUe: nextUeAnnales,
      };
      try {
        await idbSet(STUDIO_KEY, full);
      } catch (err) {
        console.warn("[ExamenBlanc] Erreur sauvegarde IndexedDB:", err);
      }
      try {
        localStorage.setItem(
          STUDIO_KEY + "_meta",
          JSON.stringify({
            ue: ueInput,
            subject: subjectInput,
            durationMin,
            lessonCount: lessons.length,
            annaleCount: annales.length,
            selectedCount: selectedLessonIds.length,
            customQuota,
            step1Validated,
            step2Validated,
            analysisValidated,
          })
        );
      } catch {
        /* ignore localStorage quota */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [
    ueInput,
    subjectInput,
    durationMin,
    lessons,
    annales,
    analysis,
    analysisSignature,
    selectedLessonIds,
    customQuota,
    step1Validated,
    step2Validated,
    analysisValidated,
    subjectWorkspaces,
    ueAnnalesByUe,
  ]);

  useEffect(() => {
    if (!sessionsHydratedRef.current) return;
    void saveSessionsAsync(sessions);
    saveSessions(sessions);
  }, [sessions]);

  // ------------------------------------------------------------------ dérivés
  const currentSignature = useMemo(
    () =>
      JSON.stringify([
        ueInput.trim().toLowerCase(),
        subjectInput.trim().toLowerCase(),
        lessons.map((l) => `${l.id}:${l.wordCount}`),
        annales.map((a) => `${a.id}:${a.wordCount}`),
      ]),
    [ueInput, subjectInput, lessons, annales]
  );
  const analysisStale = !!analysis && analysisSignature !== currentSignature;
  const workspacePendingSwitch =
    Boolean(activeWorkspaceKeyRef.current) &&
    Boolean(subjectInput.trim()) &&
    activeWorkspaceKeyRef.current !== buildSubjectWorkspaceKey(ueInput, subjectInput);
  const activeLessons = useMemo(() => flagDuplicateLessons(lessons), [lessons]);

  const quota = useMemo(() => {
    const usableCount = Math.max(1, activeLessons.filter((l) => !l.duplicateOf).length);
    if (customQuota !== null && customQuota > 0) return Math.min(customQuota, usableCount);
    if (!analysis) return 0;
    return Math.max(1, Math.min(analysis.quota || 1, usableCount));
  }, [analysis, customQuota, activeLessons]);

  const quotaReached = quota > 0 && selectedLessonIds.length >= quota;
  const planPreview = useMemo(() => {
    if (!analysis || analysisStale || !selectedLessonIds.length) return { design: null, error: "" };
    try {
      return { design: buildExamDesign(analysis, selectedLessonIds), error: "" };
    } catch (error) {
      return { design: null, error: error instanceof Error ? error.message : "Plan d’épreuve inexploitable." };
    }
  }, [analysis, analysisStale, selectedLessonIds]);

  const selectMostFrequentLessons = () => {
    if (!analysis || quota <= 0) return;
    const topIds = [...analysis.lessonStats]
      .sort((a, b) => (getObservedLessonFrequency(b) ?? -1) - (getObservedLessonFrequency(a) ?? -1) || b.totalQcm - a.totalQcm)
      .slice(0, quota)
      .map((st) => st.lessonId);
    setSelectedLessonIds(topIds);
    toast({
      title: `Top ${topIds.length} leçons sélectionnées`,
      description: "Sélection fondée sur la fréquence détectée dans les annales disponibles, sans prédiction du prochain examen.",
    });
  };

  const rankedLessons = useMemo(() => {
    if (!analysis) return [];
    const list = analysis.lessonStats.map((stat) => ({ ...stat, percent: getObservedLessonFrequency(stat) }));
    return probSortOrder === "desc" ? list : list.reverse();
  }, [analysis, probSortOrder]);

  const examStats = useMemo(() => {
    if (!activeSession) return { found: 0, wrong: 0, total: 0, answered: 0, remaining: 0, pct: 0 };
    const s = computeScore(activeSession.blocks, answers);
    return { ...s, pct: s.total ? Math.round((s.answered / s.total) * 100) : 0 };
  }, [activeSession, answers]);

  const revealed = correctionMode || !!activeSession?.finished;

  const persistTimerForActive = useCallback(
    (sec: number) => {
      if (!activeSession || activeSession.finished) return;
      setActiveSession((curr) => (curr ? { ...curr, timerRemainingSec: sec } : curr));
      setSessions((prev) =>
        prev.map((x) => (x.id === activeSession.id ? { ...x, timerRemainingSec: sec } : x))
      );
    },
    [activeSession]
  );

  // ------------------------------------------------------------------ minuteur
  useEffect(() => {
    if (activeView !== "exam" || !timerRunning) return;
    const id = setInterval(() => {
      setTimerRemainingSec((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          persistTimerForActive(0);
          toast({
            title: "Temps écoulé",
            description: "Le temps imparti est terminé. Vous pouvez clôturer votre copie.",
          });
          return 0;
        }
        const next = prev - 1;
        if (next % 5 === 0) persistTimerForActive(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activeView, timerRunning, toast, persistTimerForActive]);

  useEffect(() => {
    if (activeView !== "exam") {
      setTimerDetached(false);
      return;
    }
    const onScroll = () => {
      if (!originStationRef.current) return;
      const rect = originStationRef.current.getBoundingClientRect();
      setTimerDetached(rect.bottom < 72);
    };
    onScroll();
    const mainScrollEl = originStationRef.current?.closest("main");
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    mainScrollEl?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true } as any);
      mainScrollEl?.removeEventListener("scroll", onScroll);
    };
  }, [activeView, activeSession]);

  // ------------------------------------------------------------------ imports
  const ingestFiles = async (files: FileList | null, target: "courses" | "annales") => {
    if (!files || files.length === 0) return;
    if (target === "courses" && workspacePendingSwitch) {
      toast({
        title: "Bascule de matière requise avant l'import",
        description: `Cliquez d'abord sur « Valider l'UE & la matière » pour isoler l'espace « ${subjectInput.trim()} » et ne pas mélanger vos cours.`,
        variant: "destructive",
      });
      return;
    }
    setIsReading(true);
    let ok = 0;
    const failed: Array<{ name: string; reason: string }> = [];
    const newLessons: EBLesson[] = [];
    const newAnnales: EBAnnale[] = [];

    const fileArray = Array.from(files);
    const FILE_CONCURRENCY = 2;

    for (let fIdx = 0; fIdx < fileArray.length; fIdx += FILE_CONCURRENCY) {
      const slice = fileArray.slice(fIdx, fIdx + FILE_CONCURRENCY);
      setBatchFileProgress({
        current: Math.min(fileArray.length, fIdx + slice.length),
        total: fileArray.length,
        name: slice.map((f) => f.name).join(" & "),
      });

      await Promise.all(
        slice.map(async (file, offset) => {
          try {
            let res: { success: boolean; content: string; usedVision?: boolean; usedLocalOcr?: boolean; error?: string };
            let threwException = false;
            try {
              res = await readFile(file, {
                mode: target,
                forceFullExtraction: true,
                stripHandwrittenCorrections: target === "annales",
              });
            } catch (readErr: any) {
              threwException = true;
              res = {
                success: false,
                content: "",
                error: readErr?.message || "Erreur lecture",
              };
            }

            // Secours local rapide uniquement si une exception inattendue s'est produite
            if (threwException && (!res.success || !res.content || res.content.trim().length < 20)) {
              const rescued = await rescueFileReadLocally(file, target);
              if (rescued.success && rescued.content.trim().length >= 20) {
                res = {
                  success: true,
                  content: rescued.content,
                  usedVision: rescued.usedVision,
                };
              }
            }

            if (!res.success || !res.content || res.content.trim().length < 20) {
              failed.push({
                name: file.name,
                reason: res.error || "Document illisible",
              });
              return;
            }

            const id = `${target === "courses" ? "c" : "a"}-${Date.now()}-${fIdx + offset}-${Math.random()
              .toString(36)
              .slice(2, 7)}`;

            if (target === "courses") {
              newLessons.push(buildLesson(id, file.name, res.content, file.size, subjectInput));
            } else {
              newAnnales.push({
                id,
                title: file.name,
                rawText: res.content,
                year: detectYearFromName(file.name),
                wordCount: res.content.split(/\s+/).filter(Boolean).length,
                sizeLabel: `${sizeLabelOf(file.size)}${res.usedVision ? " · Vision IA" : res.usedLocalOcr ? " · OCR local" : " · Vectoriel"}`,
              });
            }
            ok++;
          } catch (err: any) {
            failed.push({ name: file.name, reason: err?.message || "Erreur d'extraction" });
          }
        })
      );
    }

    if (subjectInput.trim()) {
      const wsKey = buildSubjectWorkspaceKey(ueInput, subjectInput);
      const ueKey = buildUePoolKey(ueInput);
      if (!activeWorkspaceKeyRef.current) {
        activeWorkspaceKeyRef.current = wsKey;
        activeUeKeyRef.current = ueKey;
        activeOwnerSubjectRef.current = { ue: ueInput.trim(), subject: subjectInput.trim() };
      }
    }

    if (newLessons.length) setLessons((prev) => flagDuplicateLessons([...prev, ...newLessons]));
    if (newAnnales.length) {
      setAnnales((prev) => {
        const seen = new Set(prev.map((a) => `${normalizeText(a.title)}__${a.wordCount}__${(a.rawText || "").slice(0, 60)}`));
        const uniqueIncoming = newAnnales.filter((a) => {
          const sig = `${normalizeText(a.title)}__${a.wordCount}__${(a.rawText || "").slice(0, 60)}`;
          if (seen.has(sig)) return false;
          seen.add(sig);
          return true;
        });
        return uniqueIncoming.length ? [...prev, ...uniqueIncoming] : prev;
      });
    }
    if (coursesInputRef.current) coursesInputRef.current.value = "";
    if (annalesInputRef.current) annalesInputRef.current.value = "";
    setIsReading(false);
    setBatchFileProgress(null);
    setAnalysisValidated(false);

    if (ok > 0) {
      toast({
        title: `${ok} fichier(s) indexé(s) avec succès`,
        description:
          target === "courses"
            ? "Chapitres extraits avec indexation sémantique TF-IDF."
            : "Épreuves extraites, nettoyées et prêtes pour la mesure du style.",
      });
    }
    if (failed.length) {
      toast({
        title: "Fichier(s) en échec",
        description: failed.map((f) => `${f.name} (${f.reason})`).join(", "),
        variant: "destructive",
      });
    }
  };

  const openLibraryPicker = () => {
    try {
      const saved = getSavedCourses();
      setLibraryCourses(Array.isArray(saved) ? saved.filter((c: any) => c?.title && c?.content) : []);
    } catch {
      setLibraryCourses([]);
    }
    setLibraryPicked([]);
    setLibraryPickerOpen(true);
  };

  const importFromLibrary = () => {
    const picked = libraryCourses.filter((c) => libraryPicked.includes(c.id));
    const built = picked.map((c) =>
      buildLesson(`lib-${c.id}`, c.title, c.content, c.content.length, subjectInput)
    );
    setLessons((prev) =>
      flagDuplicateLessons([...prev.filter((p) => !built.some((b) => b.id === p.id)), ...built])
    );
    setLibraryPickerOpen(false);
    if (built.length) toast({ title: `${built.length} cours importé(s) depuis votre bibliothèque` });
  };

  // Partitionnement strict par (UE, Matière) : archive l'espace sortant et isole ou restaure la matière cible
  const switchOrInitSubjectWorkspace = useCallback(
    (nextUeRaw: string, nextSubjectRaw: string) => {
      const nextUe = nextUeRaw.trim();
      const nextSubject = nextSubjectRaw.trim();
      if (!nextSubject) return;

      const targetKey = buildSubjectWorkspaceKey(nextUe, nextSubject);
      const targetUeKey = buildUePoolKey(nextUe);
      const outgoingKey = activeWorkspaceKeyRef.current;
      const outgoingUeKey = activeUeKeyRef.current || buildUePoolKey(activeOwnerSubjectRef.current.ue);
      const outgoingOwner = activeOwnerSubjectRef.current;

      const updatedWorkspaces: Record<string, SubjectWorkspaceSnapshot> = { ...subjectWorkspaces };
      if (
        outgoingKey &&
        outgoingOwner.subject.trim() &&
        outgoingKey !== targetKey &&
        (lessons.length > 0 || analysis || step2Validated)
      ) {
        updatedWorkspaces[outgoingKey] = {
          ue: outgoingOwner.ue.trim(),
          subject: outgoingOwner.subject.trim(),
          durationMin,
          lessons,
          analysis,
          analysisSignature,
          selectedLessonIds,
          customQuota,
          step1Validated: true,
          step2Validated,
          analysisValidated,
          updatedAt: Date.now(),
        };
      }

      const updatedUeAnnales: Record<string, EBAnnale[]> = { ...ueAnnalesByUe };
      if (annales.length > 0 || updatedUeAnnales[outgoingUeKey]) {
        updatedUeAnnales[outgoingUeKey] = annales;
      }

      setSubjectWorkspaces(updatedWorkspaces);
      setUeAnnalesByUe(updatedUeAnnales);

      if (outgoingKey !== targetKey) {
        const savedTarget = updatedWorkspaces[targetKey];
        if (savedTarget) {
          setLessons(savedTarget.lessons || []);
          setAnalysis(savedTarget.analysis || null);
          setAnalysisSignature(savedTarget.analysisSignature || "");
          setSelectedLessonIds(savedTarget.selectedLessonIds || []);
          setCustomQuota(savedTarget.customQuota ?? null);
          if (savedTarget.durationMin) setDurationMin(savedTarget.durationMin);
          setStep2Validated(Boolean(savedTarget.step2Validated));
          setAnalysisValidated(Boolean(savedTarget.analysisValidated));
        } else if (outgoingKey) {
          // Changement vers une nouvelle matière de l'UE (ex: Orthopédie -> Traumatologie) : ardoise 100 % propre
          setLessons([]);
          setAnalysis(null);
          setAnalysisSignature("");
          setSelectedLessonIds([]);
          setCustomQuota(null);
          setStep2Validated(false);
          setAnalysisValidated(false);
        }

        if (targetUeKey !== outgoingUeKey) {
          setAnnales(updatedUeAnnales[targetUeKey] || []);
        }
        setExpandedLessonId(null);
        setExpandedExamId(null);
      }

      setUeInput(nextUe);
      setSubjectInput(nextSubject);
      setStep1Validated(true);
      activeWorkspaceKeyRef.current = targetKey;
      activeUeKeyRef.current = targetUeKey;
      activeOwnerSubjectRef.current = { ue: nextUe, subject: nextSubject };
    },
    [
      subjectWorkspaces,
      ueAnnalesByUe,
      lessons,
      annales,
      analysis,
      analysisSignature,
      selectedLessonIds,
      customQuota,
      durationMin,
      step2Validated,
      analysisValidated,
    ]
  );

  // Détection automatique des matières d'une même UE (ex: TOR -> Orthopédie, Traumatologie, Rhumatologie)
  const detectedUeSubjects = useMemo(() => {
    const map = new Map<string, string>();
    const addLabel = (raw: string) => {
      const clean = raw.trim();
      if (!clean) return;
      const norm = normalizeWsPart(clean);
      if (!map.has(norm)) map.set(norm, clean);
    };
    const currentUeNorm = buildUePoolKey(ueInput);
    Object.values(subjectWorkspaces).forEach((ws) => {
      if (buildUePoolKey(ws.ue) === currentUeNorm) {
        addLabel(ws.subject);
      }
    });
    annales.forEach((a) => {
      detectSubjectsInExamText(a.rawText).forEach((subj) => addLabel(subj));
    });
    if (subjectInput.trim()) addLabel(subjectInput);
    return Array.from(map.values());
  }, [annales, subjectWorkspaces, ueInput, subjectInput]);

  // ------------------------------------------------------------------ analyse
  const handleAnalyze = async () => {
    if (!subjectInput.trim()) {
      toast({
        title: "Matière manquante",
        description: "Précisez l'intitulé de la matière évaluée avant de lancer l'analyse.",
        variant: "destructive",
      });
      return;
    }
    if (
      activeWorkspaceKeyRef.current &&
      activeWorkspaceKeyRef.current !== buildSubjectWorkspaceKey(ueInput, subjectInput)
    ) {
      toast({
        title: "Matière modifiée non validée",
        description: `Cliquez d'abord sur « Valider l'UE & la matière » pour basculer proprement vers « ${subjectInput.trim()} » sans mélanger les cours précédents.`,
        variant: "destructive",
      });
      return;
    }
    const usable = activeLessons.filter((l) => !l.duplicateOf);
    if (usable.length === 0) {
      toast({
        title: "Aucun cours",
        description: "Importez au moins un cours de la matière.",
        variant: "destructive",
      });
      return;
    }
    cancelRef.current = false;
    setAnalyzing(true);
    setAnalysisProgress({
      phase: "lecture",
      message: "Initialisation de l'empreinte docimologique…",
      current: 0,
      total: annales.length + 2,
    });
    try {
      const result = await runDeepAnalysis({
        subjectName: subjectInput.trim(),
        lessons: activeLessons,
        annales,
        useAI: true,
        onProgress: setAnalysisProgress,
        isCancelled: () => cancelRef.current,
      });
      if (cancelRef.current) {
        toast({ title: "Analyse interrompue" });
      } else {
        setAnalysis(result);
        setAnalysisSignature(currentSignature);
        setAnalysisValidated(false);
        setCustomQuota(null);
        setSelectedLessonIds([]);
        if (result.durationMin) setDurationMin(result.durationMin);
        toast({
          title: "Analyse docimologique terminée",
          description: `${result.exams.filter((e) => e.questionCount > 0).length} épreuve(s) · ${result.totalAnalyzedQcm} QCM analysés · Quota : ${result.quota} leçon(s).`,
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erreur d'analyse",
        description: err?.message || "Analyse impossible.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  const toggleLesson = (id: string) => {
    setSelectedLessonIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (quota > 0 && prev.length >= quota) return prev;
      return [...prev, id];
    });
  };

  // ------------------------------------------------------------------ génération
  const handleGenerate = async () => {
    if (generating) return;
    if (!analysis || analysisStale) {
      toast({
        title: "Analyse requise",
        description: "Lancez (ou relancez) l'analyse docimologique avant de générer.",
        variant: "destructive",
      });
      return;
    }
    if (!quotaReached || !planPreview.design || planPreview.error) return;
    const selected = activeLessons.filter((l) => selectedLessonIds.includes(l.id));
    cancelRef.current = false;
    setGenerating(true);
    setGenProgress({
      phase: "redaction",
      message: "Injection du style mesuré sur les annales et préparation du sujet…",
      current: 0,
      total: selected.length + 1,
    });
    try {
      const priorLedger = await loadInfiniteMemoryLedger();
      const priorCount = Math.max(
        sessions.filter((s) => s.subjectName === subjectInput.trim()).length,
        priorLedger.globalGenerationCounter || 0
      );
      const { blocks, warnings, styleReport } = await generateExamBlanc({
        ueName: ueInput.trim(),
        subjectName: subjectInput.trim(),
        selected,
        analysis,
        sessionSeed: priorCount + 1,
        onProgress: setGenProgress,
        isCancelled: () => cancelRef.current,
      });
      const updatedLedger = await loadInfiniteMemoryLedger();
      setInfiniteStats(getInfiniteMemoryStats(updatedLedger));
      if (cancelRef.current) {
        toast({ title: "Génération interrompue" });
        return;
      }
      const finalBlocks = blocks;
      if (finalBlocks.length === 0) {
        toast({
          title: "Génération impossible",
          description: "Veuillez sélectionner au moins un cours pour générer l'examen blanc.",
          variant: "destructive",
        });
        return;
      }
      const session: ExamSession = {
        id: `eb-${Date.now()}`,
        title: `Examen blanc ${priorCount + 1} — ${subjectInput.trim()}`,
        subtitle: selected.map((l) => l.cleanTitle).join(" · "),
        subjectName: subjectInput.trim(),
        ueName: ueInput.trim(),
        createdAt: new Date().toISOString(),
        durationMin,
        lessonTitles: selected.map((l) => l.cleanTitle),
        blocks: finalBlocks,
        styleReport,
        answers: {},
        finished: false,
      };
      setSessions((prev) => [session, ...prev]);
      openSession(session);
      const totalGeneratedQcm = finalBlocks.reduce((s, b) => s + b.items.length, 0);
      if (warnings.length) {
        notify.aiReady(
          `Examen blanc prêt — ${subjectInput.trim()}`,
          `${totalGeneratedQcm} QCM générés (${warnings.slice(0, 2).join(" · ")}).`,
          { label: "Démarrer l'épreuve", to: "/examen-blanc" }
        );
      } else {
        notify.aiReady(
          `Examen blanc prêt — ${subjectInput.trim()}`,
          `${totalGeneratedQcm} QCM vérifiés par Sonnet 4.6 & Gemini 2.5 Flash sont prêts à être lancés.`,
          { label: "Démarrer l'épreuve", to: "/examen-blanc" }
        );
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erreur de génération",
        description: err?.message || "Génération impossible.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
      setGenProgress(null);
    }
  };

  const openSession = useCallback((s: ExamSession) => {
    setActiveSession(s);
    setAnswers(s.answers || {});
    setCorrectionMode(false);
    setTimerRemainingSec(
      typeof s.timerRemainingSec === "number" ? s.timerRemainingSec : s.durationMin * 60
    );
    setTimerRunning(!s.finished);
    setActiveView("exam");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ------------------------------------------------------------------ épreuve
  const updateActiveAnswers = useCallback(
    (updater: (prev: Record<string, string[]>) => Record<string, string[]>) => {
      if (activeSession?.finished) return;
      setAnswers((prev) => {
        const next = updater(prev);
        if (activeSession) {
          setActiveSession((curr) => (curr ? { ...curr, answers: next } : curr));
          setSessions((sPrev) =>
            sPrev.map((x) => (x.id === activeSession.id ? { ...x, answers: next } : x))
          );
        }
        return next;
      });
    },
    [activeSession]
  );

  const setAnswer = (item: EBItem, letter: string) => {
    updateActiveAnswers((prev) => {
      const cur = prev[item.id] || [];
      if (item.format === "COMPLEMENT_MULTIPLE") {
        const next = cur.includes(letter) ? cur.filter((l) => l !== letter) : [...cur, letter];
        return { ...prev, [item.id]: next.sort() };
      }
      return { ...prev, [item.id]: [letter] };
    });
  };

  const finishAndSave = () => {
    if (!activeSession) return;
    const s = computeScore(activeSession.blocks, answers);
    const updated: ExamSession = {
      ...activeSession,
      answers,
      timerRemainingSec,
      finished: true,
      score: { found: s.found, wrong: s.wrong, total: s.total },
    };
    setSessions((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setActiveSession(updated);
    setTimerRunning(false);
    setCorrectionMode(true);
    toast({
      title: "Copie clôturée & corrigée",
      description: `Score final : ${s.found}/${s.total} (${Math.round((s.found / Math.max(1, s.total)) * 100)} %).`,
    });
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession?.id === id) setActiveSession(null);
    toast({ title: "Examen supprimé" });
  };

  const exportSessionPdf = async (s: ExamSession, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const data: QuizData = {
        title: `${s.title}`,
        subject: s.subjectName,
        difficultyLabel: "Entraînement inspiré des annales — corrigé proposé par IA",
        formatLabel: "Examen blanc",
        includeAnswerGrid: true,
        includeAnswerKey: true,
        questions: sessionToPdfQuestions(s),
      };
      await exportQuizToPDF(data, { includeAnswerKey: true, includeAnswerGrid: true });
    } catch (err) {
      console.error(err);
      toast({
        title: "Erreur PDF",
        description: "Impossible d'exporter l'examen.",
        variant: "destructive",
      });
    }
  };

  const removeLesson = (id: string) => {
    setLessons((prev) => prev.filter((l) => l.id !== id));
    setSelectedLessonIds((prev) => prev.filter((x) => x !== id));
  };

  const resetStudio = () => {
    const oldKey = activeWorkspaceKeyRef.current;
    if (oldKey) {
      setSubjectWorkspaces((prev) => {
        const copy = { ...prev };
        delete copy[oldKey];
        return copy;
      });
    }
    activeWorkspaceKeyRef.current = "";
    activeUeKeyRef.current = "";
    activeOwnerSubjectRef.current = { ue: "", subject: "" };
    setLessons([]);
    setAnnales([]);
    setAnalysis(null);
    setAnalysisSignature("");
    setSelectedLessonIds([]);
    setStep1Validated(false);
    setStep2Validated(false);
    setAnalysisValidated(false);
    setCustomQuota(null);
    toast({ title: "Studio réinitialisé" });
  };

  const progressPct = (p: AnalysisProgress | null) =>
    p && p.total > 0 ? Math.min(100, Math.round((p.current / p.total) * 100)) : 8;

  // ------------------------------------------------------------------ rendu d'une question (supporte tous les formats dont Association & Groupage dynamique)
  const renderItem = (item: EBItem) => {
    const chosen = answers[item.id] || [];
    const isMulti = item.format === "COMPLEMENT_MULTIPLE";
    const ok = isItemCorrect(item, chosen);

    return (
      <div
        key={item.id}
        id={`q-${item.id}`}
        className="group rounded-2xl border border-[#121316]/[0.09] bg-white p-5 sm:p-6 space-y-4 shadow-[0_1px_2px_rgba(18,19,22,0.03)] hover:border-[#121316]/20 transition-all scroll-mt-28"
      >
        {item.lead && (
          <div className="px-4 py-3 rounded-xl bg-[#FAF8F5] border-l-[3px] border-[#C96442] text-sm text-[#2A2C32] leading-relaxed">
            <span className="font-mono text-[10.5px] uppercase tracking-wider font-bold text-[#C96442] block mb-0.5">
              Évolution / Données complémentaires
            </span>
            <span className="italic">{item.lead}</span>
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#121316] text-[#FAF8F5] font-mono text-xs font-bold shrink-0 mt-0.5">
              {String(item.number).padStart(2, "0")}
            </span>
            <div className="space-y-1 min-w-0 flex-1">
              <p className="font-semibold text-[15.5px] text-[#121316] leading-snug">{item.stem}</p>
              {item.lessonTitle && (
                <p className="text-[11px] font-mono text-[#6E717A] truncate">
                  Chapitre : {item.lessonTitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2.5 py-1 rounded-md bg-[#FAF8F5] border border-[#121316]/10 font-mono text-[10px] font-bold uppercase tracking-wider text-[#121316]">
              {item.format === "CAS_CLINIQUE" && item.statements && item.statements.length >= 4 ? "Dossier • Groupage" : EB_FORMAT_LABELS[item.format]}
            </span>
          </div>
        </div>

        {/* TABLEAU DOUBLE COLONNE POUR LE FORMAT ASSOCIATION */}
        {item.format === "ASSOCIATION" && item.associationColumns && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#F9F7F2] border border-[#121316]/10 text-xs">
            <div className="space-y-2">
              <div className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-[#C96442] pb-1 border-b border-black/10">
                {item.associationColumns.leftTitle || "Éléments numérotés"}
              </div>
              {item.associationColumns.leftItems.map((li) => (
                <div key={li.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-white border border-black/15 font-mono font-bold text-[11px] shrink-0">
                    {li.id}
                  </span>
                  <span className="text-[#121316] pt-0.5">{li.text}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-[#121316]/70 pb-1 border-b border-black/10">
                {item.associationColumns.rightTitle || "Propositions lettrées"}
              </div>
              {item.associationColumns.rightItems.map((ri) => (
                <div key={ri.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#121316] text-white font-mono font-bold text-[11px] shrink-0">
                    {ri.id}
                  </span>
                  <span className="text-[#121316] pt-0.5">{ri.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ASSERTIONS NUMÉROTÉES POUR GROUPAGE OU JUMELAGE */}
        {item.statements && item.statements.length > 0 && (
          <div className="p-4 rounded-xl bg-[#F9F7F2] border border-[#121316]/10 space-y-2 text-sm">
            {(item.format === "GROUPAGE" || item.groupageCodeHint) && item.format !== "JUMELAGE" && (
              <div className="flex items-center justify-between gap-2 pb-2 mb-1 border-b border-black/10 text-[11px] font-mono text-[#6E717A]">
                <span>Assertions à évaluer (1 à {item.statements.length})</span>
                <span className="font-bold text-[#121316]">{item.groupageCodeHint}</span>
              </div>
            )}
            {item.format === "JUMELAGE" ? (
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-white border border-black/5">
                  <span className="font-mono text-[10px] font-bold uppercase text-[#6E717A] block mb-0.5">
                    Première proposition
                  </span>
                  <p className="text-[#121316] font-medium">{item.statements[0]}</p>
                </div>
                <div className="text-center py-0.5">
                  <span className="px-3 py-0.5 rounded-full bg-[#C96442]/15 text-[#C96442] font-mono font-bold text-[10.5px] tracking-widest uppercase">
                    PARCE QUE
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-black/5">
                  <span className="font-mono text-[10px] font-bold uppercase text-[#6E717A] block mb-0.5">
                    Seconde proposition
                  </span>
                  <p className="text-[#121316] font-medium">{item.statements[1]}</p>
                </div>
              </div>
            ) : (
              item.statements.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="font-mono text-xs font-bold text-[#C96442] shrink-0 mt-0.5">
                    {i + 1}.
                  </span>
                  <span className="text-[#121316]">{s}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* ZONE DE RÉPONSE (QNS OU PROPOSITIONS A-E) */}
        {item.format === "QNS" ? (
          <>
            <textarea
              value={chosen[0] || ""}
              disabled={!!activeSession?.finished}
              onChange={(e) => {
                const val = e.target.value;
                updateActiveAnswers((prev) => ({ ...prev, [item.id]: [val] }));
              }}
              placeholder="Rédigez votre réponse structurée comme sur une copie officielle…"
              rows={4}
              className="w-full p-3.5 rounded-xl border border-black/15 bg-[#FAF8F5]/60 focus:bg-white text-sm focus:outline-none focus:border-black/40 transition-colors"
            />
            {revealed && (
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#1B7354]/30 text-xs leading-relaxed space-y-1.5">
                <strong className="text-[#1B7354] font-mono uppercase tracking-wider block">
                  ✓ Grille de correction proposée & éléments attendus :
                </strong>
                <p className="whitespace-pre-line text-[#121316]">{item.explanation}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="space-y-2">
              {item.options.map((opt) => {
                const picked = chosen.includes(opt.letter);
                const isKey = item.correct.includes(opt.letter);
                let style = picked
                  ? "border-[#121316] bg-[#121316]/[0.04] shadow-[inset_0_0_0_1px_#121316]"
                  : "border-black/12 bg-white hover:bg-[#FAF8F5] hover:border-black/25";
                if (revealed) {
                  if (isKey)
                    style =
                      "border-[#1B7354] bg-[#1B7354]/[0.08] font-semibold text-[#0F4D37] shadow-[inset_0_0_0_1px_#1B7354]";
                  else if (picked)
                    style = "border-[#BA392D] bg-[#BA392D]/[0.08] text-[#BA392D]";
                  else style = "border-black/5 opacity-55";
                }
                return (
                  <button
                    type="button"
                    key={opt.letter}
                    onClick={() => setAnswer(item, opt.letter)}
                    className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between gap-3 text-sm transition-all cursor-pointer ${style}`}
                  >
                    <span className="flex items-start gap-3 min-w-0">
                      <span
                        className={`w-6 h-6 ${
                          isMulti ? "rounded-md" : "rounded-full"
                        } border font-mono text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                          revealed && isKey
                            ? "bg-[#1B7354] text-white border-[#1B7354]"
                            : revealed && picked && !isKey
                            ? "bg-[#BA392D] text-white border-[#BA392D]"
                            : picked
                            ? "bg-[#121316] text-white border-[#121316]"
                            : "bg-[#FAF8F5] border-black/20 text-[#121316]"
                        }`}
                      >
                        {opt.letter}
                      </span>
                      <span className="pt-0.5 leading-relaxed">{opt.text}</span>
                    </span>
                    {revealed && isKey && (
                      <span className="text-[11px] font-mono font-bold text-[#1B7354] shrink-0 px-2 py-0.5 rounded bg-[#1B7354]/10">
                        ✓ Corrigé proposé
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {isMulti && !revealed && (
              <p className="text-[11px] font-mono text-[#6E717A]">
                Complément multiple : cochez plusieurs propositions exactes, mais pas toutes.
              </p>
            )}

            {revealed && (
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs leading-relaxed space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong
                    className={`font-mono text-xs ${
                      chosen.length === 0
                        ? "text-black/60"
                        : ok
                        ? "text-[#1B7354]"
                        : "text-[#BA392D]"
                    }`}
                  >
                    {chosen.length === 0 ? "Non répondu" : ok ? "✓ Réponse exacte" : "✗ Réponse inexacte"}{" "}
                    — Corrigé proposé : {item.correct.join(", ")}
                  </strong>
                  {item.trapHighlight && (
                    <span className="px-2 py-0.5 rounded bg-[#C96442]/12 text-[#9a4a2e] font-mono text-[10.5px] font-semibold">
                      Piège ciblé : {item.trapHighlight}
                    </span>
                  )}
                </div>
                <p className="text-[#2A2C32]">{item.explanation}</p>
                {!!item.sourceQuotes?.length && (
                  <details className="border-t border-black/10 pt-2">
                    <summary className="cursor-pointer font-semibold">Extraits du cours utilisés pour la vérification</summary>
                    {item.sourceQuotes.map((quote, index) => (
                      <blockquote key={index} className="mt-2 border-l-2 border-black/20 pl-3">{quote}</blockquote>
                    ))}
                  </details>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div
      ref={pageRootRef}
      className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#121316] font-sans antialiased selection:bg-[#C96442]/20"
    >
      <input
        ref={coursesInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.pptx,.md,.rtf,.odt,.png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          ingestFiles(e.target.files, "courses");
          e.target.value = "";
        }}
        className="hidden"
      />
      <input
        ref={annalesInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.rtf,.odt,.md,.png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          ingestFiles(e.target.files, "annales");
          e.target.value = "";
        }}
        className="hidden"
      />

      {/* BARRE SUPÉRIEURE ÉDITORIALE */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/92 backdrop-blur-md border-b border-[#121316]/[0.08] px-4 sm:px-8 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#121316] text-[#FAF8F5] flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
            D
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-base sm:text-lg tracking-tight whitespace-nowrap">
              Examen Blanc
            </span>
            <span className="text-black/20">/</span>
            <span className="text-xs font-medium text-[#4A4D54] truncate max-w-[140px] sm:max-w-[260px]">
              {activeView === "studio"
                ? "Studio & profilage stylistique"
                : activeView === "library"
                ? "Bibliothèque"
                : activeSession?.title || "Épreuve"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setHowItWorksOpen(true)}
            className="w-6 h-6 rounded-full border border-black/15 bg-white text-xs font-bold text-[#4A4D54] hover:bg-[#121316] hover:text-white transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            title="Protocole docimologique universel : mesure, génération, relecture"
          >
            ?
          </button>
          <button
            type="button"
            onClick={() => setEngineInspectorOpen(true)}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#1B7354]/30 bg-[#1B7354]/10 text-[#1B7354] font-mono text-[10.5px] font-bold cursor-pointer hover:bg-[#1B7354]/15 transition-colors whitespace-nowrap"
          >
            <Fingerprint className="w-3.5 h-3.5" />
            Moteur DAWIA · Contrôles de génération
          </button>
        </div>

        <nav className="flex items-center p-1 rounded-xl bg-[#EDE8E0] text-xs font-semibold shrink-0">
          {(["studio", "library", "exam"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                if (v === "exam" && !activeSession) {
                  toast({
                    title: "Aucune épreuve ouverte",
                    description:
                      "Générez un examen blanc ou ouvrez-en un depuis la bibliothèque.",
                  });
                  setActiveView("library");
                  return;
                }
                setActiveView(v);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeView === v
                  ? "bg-white text-[#121316] shadow-sm"
                  : "text-[#4A4D54] hover:text-[#121316]"
              }`}
            >
              {v === "studio"
                ? "Studio & Analyse"
                : v === "library"
                ? `Bibliothèque (${sessions.length})`
                : "Feuille d'Examen"}
            </button>
          ))}
        </nav>
      </header>

      {/* CAPSULE FLOTTANTE DU MINUTEUR (SUIT L'ÉTUDIANT EN TEMPS RÉEL AU SCROLL ET REVIENT À SA STATION AU RETOUR EN HAUT) */}
      {activeView === "exam" && activeSession && (
        <div
          className={`fixed top-20 right-6 z-40 rounded-2xl bg-[#121316]/95 text-white px-4 py-2.5 flex items-center gap-3 transition-all duration-300 ease-out shadow-2xl border border-white/10 backdrop-blur-md ${
            timerDetached
              ? "translate-y-0 scale-100 opacity-100"
              : "-translate-y-5 scale-95 opacity-0 pointer-events-none"
          }`}
        >
          <button
            type="button"
            onClick={() => {
              originStationRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              const mainEl = originStationRef.current?.closest("main");
              mainEl?.scrollTo({ top: 0, behavior: "smooth" });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2 pr-2.5 border-r border-white/15 cursor-pointer"
            title="Revenir en haut de la copie"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                timerRunning ? "bg-[#C96442] animate-ping" : "bg-white/40"
              }`}
            />
            <span className="font-mono text-sm font-bold tracking-wider">
              {formatClock(timerRemainingSec)}
            </span>
          </button>
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setTimerRunning(!timerRunning)}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 cursor-pointer"
            >
              {timerRunning ? "Pause" : "Reprendre"}
            </button>
            {!activeSession.finished && (
              <button
                type="button"
                onClick={finishAndSave}
                className="px-2.5 py-0.5 rounded bg-[#C96442] hover:bg-[#b05333] font-semibold cursor-pointer"
              >
                Terminer
              </button>
            )}
          </div>
        </div>
      )}

      {/* TIROIR DE NAVIGATION & GRILLE OPTIQUE (ALIGNÉ SUR LA LIGNE SÉPARANT LA SIDEBAR ET LA PAGE ACTUELLE) */}
      {activeView === "exam" && activeSession && (
        <>
          <button
            type="button"
            onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
            style={{
              left: `${sidebarBoundaryLeft}px`,
              transform: `translate(${leftDrawerOpen ? 288 : 0}px, -50%)`,
            }}
            className="fixed top-1/2 z-40 pl-2 pr-3 py-3 rounded-r-2xl bg-[#121316] text-white shadow-xl border-y border-r border-white/15 flex flex-col items-center gap-1 text-xs font-bold cursor-pointer hover:bg-[#C96442] transition-[transform,colors] duration-300"
            title="Ouvrir / fermer la Grille Optique de navigation"
          >
            <span>{leftDrawerOpen ? "‹" : "›"}</span>
            <span className="font-mono text-[10px]">
              {examStats.answered}/{examStats.total}
            </span>
          </button>
          <aside
            style={{ left: `${sidebarBoundaryLeft}px` }}
            className={`fixed top-20 bottom-6 w-72 z-40 rounded-r-3xl rounded-l-none bg-white/95 backdrop-blur-xl border-y border-r border-black/10 shadow-2xl p-5 flex flex-col justify-between transition-all duration-300 ${
              leftDrawerOpen
                ? "translate-x-0 opacity-100"
                : "-translate-x-full opacity-0 pointer-events-none"
            }`}
          >
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="flex items-center justify-between pb-3 border-b border-black/10">
                <span className="font-bold text-sm">Grille Optique & Navigation</span>
                <button
                  type="button"
                  onClick={() => setLeftDrawerOpen(false)}
                  className="text-xs text-black/50 hover:text-black cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-black/5 space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Avancement de la copie</span>
                  <span>{examStats.pct}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className="bg-[#121316] h-full transition-all duration-300"
                    style={{ width: `${examStats.pct}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-1 pt-1 text-center font-mono text-[11px]">
                  <div className="p-1 rounded bg-white font-bold border border-black/5">
                    {examStats.answered} rép.
                  </div>
                  <div className="p-1 rounded bg-white font-bold border border-black/5">
                    {examStats.remaining} rest.
                  </div>
                  <div
                    className={`p-1 rounded bg-white font-bold border border-black/5 ${
                      revealed ? "text-[#1B7354]" : "text-black/30"
                    }`}
                  >
                    {revealed ? `✓ ${examStats.found}` : "✓ —"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {activeSession.blocks.flatMap((b) =>
                  b.items.map((it) => {
                    const a = answers[it.id];
                    const has = a && a.length > 0 && a[0] !== "";
                    let cls = "bg-white text-black border-black/15 hover:bg-black/5";
                    if (revealed && has && it.format !== "QNS")
                      cls = isItemCorrect(it, a)
                        ? "bg-[#1B7354] text-white border-[#1B7354]"
                        : "bg-[#BA392D] text-white border-[#BA392D]";
                    else if (has) cls = "bg-[#121316] text-white border-[#121316]";
                    return (
                      <button
                        type="button"
                        key={it.id}
                        onClick={() => {
                          document
                            .getElementById(`q-${it.id}`)
                            ?.scrollIntoView({ behavior: "smooth", block: "center" });
                          setLeftDrawerOpen(false);
                        }}
                        className={`h-8 rounded-lg font-mono text-xs font-bold transition-all border cursor-pointer ${cls}`}
                      >
                        {it.number}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <div className="pt-3 border-t border-black/10 space-y-2">
              <button
                type="button"
                onClick={() => exportSessionPdf(activeSession)}
                className="w-full py-2 rounded-xl border border-black/15 bg-white hover:bg-black/5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Télécharger le Cahier PDF
              </button>
              {!activeSession.finished && (
                <button
                  type="button"
                  onClick={finishAndSave}
                  className="w-full py-2.5 rounded-xl bg-[#121316] hover:bg-[#C96442] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Terminer & Corriger la copie
                </button>
              )}
            </div>
          </aside>
        </>
      )}

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8">
        {/* ================= VUE 1 : STUDIO & CLONAGE PROFESSORAL ================= */}
        {activeView === "studio" && (
          <div className="space-y-6">
            {/* BANNIÈRE D'ARCHITECTURE UNIVERSELLE */}
            <div className="rounded-2xl bg-gradient-to-r from-[#121316] via-[#1C1E24] to-[#121316] text-[#FAF8F5] p-5 sm:p-6 shadow-md border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-[#C96442]/20 border border-[#C96442]/40 text-[#E88D6D] font-mono text-[10.5px] font-bold uppercase tracking-wider">
                  <Fingerprint className="w-3.5 h-3.5" /> Cours & Annales · Rédaction et relecture séparées
                </div>
                <h1 className="font-bold text-lg sm:text-xl tracking-tight">
                  Entraînez-vous sur des QCM inspirés de vos cours et du style de vos annales
                </h1>
                <p className="text-xs text-white/70 leading-relaxed">
                  Importez vos cours et annales pour guider les formats et la rédaction. Chaque nouveau bloc doit passer les contrôles structurels et une résolution IA séparée, avec des citations vérifiées dans le cours. Cette relecture ne remplace pas une validation enseignante.
                </p>
              </div>
              <button
                type="button"
                onClick={resetStudio}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/85 text-xs font-semibold flex items-center gap-1.5 shrink-0 self-start sm:self-center cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Nouveau chantier
              </button>
            </div>

            {/* ÉTAPE 1 : CONFIGURATION DE LA MATIÈRE & VALIDATION PRÉALABLE */}
            <section className="bg-white rounded-2xl border border-black/10 p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-6 h-6 rounded-lg font-mono text-xs font-bold flex items-center justify-center ${
                      step1Validated ? "bg-[#1B7354] text-white" : "bg-[#121316] text-white"
                    }`}
                  >
                    {step1Validated ? "✓" : "1"}
                  </span>
                  <h2 className="font-bold text-base sm:text-lg">
                    Unité d'Enseignement & Discipline spécifique évaluée
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-black/45 hidden sm:inline">
                  Étape 1 · Calibre le filtrage multi-matières dès l'import
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-black/70 mb-1.5">
                    Unité d'Enseignement (UE / Module)
                  </label>
                  <input
                    value={ueInput}
                    onChange={(e) => {
                      setUeInput(e.target.value);
                      setStep1Validated(false);
                    }}
                    placeholder="Ex : Sciences, Droit, Lettres, Santé…"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/15 text-sm font-semibold focus:outline-none focus:bg-white focus:border-black/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black/70 mb-1.5">
                    Matière spécifique de l'épreuve <span className="text-[#C96442]">*</span>
                  </label>
                  <input
                    value={subjectInput}
                    onChange={(e) => {
                      setSubjectInput(e.target.value);
                      setStep1Validated(false);
                    }}
                    placeholder="Ex : Mathématiques, Droit civil, Histoire, Cardiologie…"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/15 text-sm font-semibold focus:outline-none focus:bg-white focus:border-black/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black/70 mb-1.5">
                    Durée de la session (à régler)
                  </label>
                  <select
                    value={durationMin}
                    onChange={(e) => setDurationMin(parseInt(e.target.value, 10))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/15 text-sm font-semibold focus:outline-none cursor-pointer"
                  >
                    {Array.from(new Set([...DURATION_CHOICES, durationMin]))
                      .sort((a, b) => a - b)
                      .map((d) => (
                        <option key={d} value={d}>
                          {Math.floor(d / 60) > 0
                            ? `${Math.floor(d / 60)}h${String(d % 60).padStart(2, "0")}`
                            : `${d} min`}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {detectedUeSubjects.length > 0 && (
                <div className="pt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-black/55 mr-1">
                    Espaces par matière de l&apos;UE :
                  </span>
                  {detectedUeSubjects.map((subj) => {
                    const targetKey = buildSubjectWorkspaceKey(ueInput, subj);
                    const isCurrent =
                      normalizeWsPart(subjectInput) === normalizeWsPart(subj) && step1Validated;
                    const savedCount =
                      targetKey === activeWorkspaceKeyRef.current
                        ? lessons.length
                        : subjectWorkspaces[targetKey]?.lessons?.length || 0;
                    return (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => {
                          if (
                            targetKey === activeWorkspaceKeyRef.current &&
                            step1Validated
                          ) {
                            return;
                          }
                          switchOrInitSubjectWorkspace(ueInput, subj);
                          const restored = subjectWorkspaces[targetKey];
                          toast({
                            title: `Matière active : ${subj}`,
                            description: restored
                              ? `Espace « ${subj} » restauré (${restored.lessons.length} cours) · ${annales.length} annale(s) de l'UE conservée(s).`
                              : targetKey === activeWorkspaceKeyRef.current
                              ? `Espace « ${subj} » validé (${lessons.length} cours).`
                              : `Nouvel espace « ${subj} » initialisé (cours réinitialisés · ${annales.length} annale(s) de l'UE conservée(s)).`,
                          });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isCurrent
                            ? "bg-[#121316] text-white border-[#121316]"
                            : "bg-[#FAF8F5] text-black/75 border-black/15 hover:border-[#C96442]/60 hover:text-[#121316]"
                        }`}
                      >
                        <span>{subj}</span>
                        {savedCount > 0 && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                              isCurrent ? "bg-white/20 text-white" : "bg-black/10 text-black/65"
                            }`}
                          >
                            {savedCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="pt-3 border-t border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-black/60">
                  {step1Validated
                    ? `✓ Matière cible verrouillée : « ${subjectInput.trim()} »${
                        ueInput.trim() ? ` (UE : ${ueInput.trim()})` : ""
                      } — Espace isolé (${lessons.length} cours) ; le moteur n'extraira que cette matière dans les évaluations multi-disciplinaires.`
                    : "Renseignez l'UE et la matière spécifique puis cliquez sur Valider pour déverrouiller ou basculer l'espace isolé de cette matière."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (!subjectInput.trim()) {
                      toast({
                        title: "Matière spécifique requise",
                        description:
                          "Veuillez indiquer la matière exacte à évaluer (ex : Orthopédie, Traumatologie) avant de valider l'Étape 1.",
                        variant: "destructive",
                      });
                      return;
                    }
                    const nextKey = buildSubjectWorkspaceKey(ueInput, subjectInput);
                    const changedSubject =
                      Boolean(activeWorkspaceKeyRef.current) &&
                      activeWorkspaceKeyRef.current !== nextKey;
                    const existingSaved = subjectWorkspaces[nextKey];
                    switchOrInitSubjectWorkspace(ueInput, subjectInput);
                    toast({
                      title: changedSubject
                        ? `Bascule vers « ${subjectInput.trim()} » ✓`
                        : "Étape 1 validée ✓",
                      description: changedSubject
                        ? existingSaved
                          ? `Espace « ${subjectInput.trim()} » restauré (${existingSaved.lessons.length} cours) avec vos annales d'UE.`
                          : `Nouvel espace « ${subjectInput.trim()} » prêt : importez maintenant les cours propres à cette matière (l'espace précédent est conservé).`
                        : `Moteur pré-calibré sur « ${subjectInput.trim()} ». Vous pouvez maintenant importer vos cours et annales.`,
                    });
                  }}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                    step1Validated
                      ? "bg-[#1B7354] text-white"
                      : "bg-[#121316] hover:bg-[#C96442] text-white shadow-sm"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {step1Validated
                    ? "Étape 1 validée — Pôles d'importation actifs"
                    : "Valider l'UE & la matière →"}
                </button>
              </div>
            </section>

            {/* BANNIÈRE DE PROGRESSION INTELLIGENTE (FICHIER & PAGES) */}
            {(readingProgress || batchFileProgress) && (
              <div className="p-4 rounded-2xl bg-white border border-[#C96442]/35 text-[#121316] space-y-2 shadow-sm">
                <div className="flex items-center justify-between gap-3 text-xs font-medium">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Loader2 className="w-4 h-4 animate-spin text-[#C96442] shrink-0" />
                    {batchFileProgress && batchFileProgress.total > 1 && (
                      <span className="px-2 py-0.5 rounded-md bg-[#121316] text-white font-mono text-[10.5px] font-bold shrink-0">
                        Fichier {batchFileProgress.current}/{batchFileProgress.total}
                      </span>
                    )}
                    <span className="font-semibold truncate">
                      {readingProgress?.stage || `Lecture intégrale de « ${batchFileProgress?.name || "document"} »…`}
                    </span>
                  </span>
                  {readingProgress?.pct !== undefined && (
                    <span className="font-mono font-bold text-[#C96442] bg-[#FAF8F5] px-2.5 py-0.5 rounded-md border border-[#C96442]/25 shrink-0">
                      {readingProgress.pct}%
                    </span>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className="h-full bg-[#C96442] transition-all duration-200"
                    style={{ width: `${readingProgress?.pct ?? 50}%` }}
                  />
                </div>
              </div>
            )}

            {/* ÉTAPE 2 : DOUBLE PÔLE D'IMPORT (COURS & ANNALES) — APPARAÎT APRÈS VALIDATION DE L'ÉTAPE 1 */}
            {(step1Validated || lessons.length > 0 || annales.length > 0 || !!analysis) && (
              <section className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* PÔLE A : COURS */}
                  <div className="bg-white rounded-2xl border border-black/10 p-5 space-y-3 shadow-sm flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-[#121316] text-white font-mono text-[11px] font-bold flex items-center justify-center">
                            2A
                          </span>
                          <div>
                            <h3 className="font-bold text-sm">Pôle Cours (Référentiel de vérité)</h3>
                            <p className="text-[11px] text-black/50">
                              Tous les chapitres de « {subjectInput || "la matière"} » (PDF, DOCX, PPTX, TXT…)
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-[#121316] bg-[#FAF8F5] px-2.5 py-1 rounded-lg border border-black/10">
                          {lessons.length} cours
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {activeLessons.length === 0 && (
                          <div className="py-8 text-center border border-dashed border-black/10 rounded-xl bg-[#FAF8F5]/50 space-y-1">
                            <FileText className="w-6 h-6 mx-auto text-black/25" />
                            <p className="text-xs text-black/45">Aucun cours importé pour le moment.</p>
                          </div>
                        )}
                        {activeLessons.map((c) => (
                          <div
                            key={c.id}
                            className="p-2.5 rounded-xl bg-[#FAF8F5] border border-black/5 flex justify-between items-center text-xs gap-2 hover:border-black/15 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold block truncate" title={c.title}>
                                {cleanLessonTitle(c.title)}
                              </span>
                              <span className="text-[10px] text-black/45 font-mono">
                                {c.wordCount.toLocaleString("fr-FR")} mots · {c.sizeLabel} ·{" "}
                                {c.keywords.length} concepts clés
                                {c.duplicateOf ? " · doublon ignoré" : ""}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeLesson(c.id)}
                              className="text-black/40 hover:text-red-500 p-1 cursor-pointer shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        type="button"
                        disabled={isReading}
                        onClick={() => coursesInputRef.current?.click()}
                        className="py-2.5 rounded-xl border border-dashed border-black/25 bg-[#FAF8F5] hover:bg-black/5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        {isReading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}{" "}
                        Importer des fichiers
                      </button>
                      <button
                        type="button"
                        onClick={openLibraryPicker}
                        className="py-2.5 rounded-xl border border-black/15 bg-white hover:bg-black/5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <LibraryIcon className="w-3.5 h-3.5" /> Ma bibliothèque
                      </button>
                    </div>
                  </div>

                  {/* PÔLE B : ANNALES & ÉVALUATIONS */}
                  <div className="bg-white rounded-2xl border border-black/10 p-5 space-y-3 shadow-sm flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-[#C96442] text-white font-mono text-[11px] font-bold flex items-center justify-center">
                            2B
                          </span>
                          <div>
                            <h3 className="font-bold text-sm">
                              Pôle Annales & Évaluations (style des enseignants)
                            </h3>
                            <p className="text-[11px] text-black/50">
                              Épreuves passées, sujets d'UE ou évaluations de la faculté
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-[#C96442] bg-[#C96442]/10 px-2.5 py-1 rounded-lg border border-[#C96442]/20">
                          {annales.length} épreuves
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {annales.length === 0 && (
                          <div className="py-8 text-center border border-dashed border-black/10 rounded-xl bg-[#FAF8F5]/50 space-y-1 px-3">
                            <Fingerprint className="w-6 h-6 mx-auto text-black/25" />
                            <p className="text-xs text-black/45">
                              Importez vos annales pour guider les formats et le style, ou lancez un entraînement de base sans annale.
                            </p>
                          </div>
                        )}
                        {annales.map((a) => (
                          <div
                            key={a.id}
                            className="p-2.5 rounded-xl bg-[#FAF8F5] border border-black/5 flex justify-between items-center text-xs gap-2 hover:border-black/15 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold block truncate" title={a.title}>
                                {a.title}
                              </span>
                              <span className="text-[10px] text-black/45 font-mono">
                                {a.year ? `Session ${a.year}` : "Session non datée"} ·{" "}
                                {a.wordCount.toLocaleString("fr-FR")} mots · {a.sizeLabel}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAnnales((prev) => prev.filter((x) => x.id !== a.id))}
                              className="text-black/40 hover:text-red-500 p-1 cursor-pointer shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isReading}
                      onClick={() => annalesInputRef.current?.click()}
                      className="w-full py-2.5 mt-2 rounded-xl border border-dashed border-[#C96442]/40 bg-[#C96442]/[0.05] hover:bg-[#C96442]/10 text-[#9a4a2e] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      {isReading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}{" "}
                      Importer des annales / évaluations
                    </button>
                  </div>
                </div>

                {/* PORTE DE VALIDATION DE L'ÉTAPE 2 */}
                <div className="bg-white rounded-2xl border border-black/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="text-xs text-black/65">
                    {activeLessons.filter((l) => !l.duplicateOf).length > 0 ? (
                      <span>
                        <strong>{activeLessons.filter((l) => !l.duplicateOf).length} cours</strong> et{" "}
                        <strong>{annales.length} épreuve(s)</strong> prêts pour « {subjectInput.trim() || "la matière"} ». Validez l'Étape 2 pour passer à l'analyse docimologique.
                      </span>
                    ) : (
                      <span>
                        Importez au moins vos cours (Pôle 2A) et vos annales (Pôle 2B), puis cliquez sur Valider.
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={isReading || activeLessons.filter((l) => !l.duplicateOf).length === 0}
                    onClick={() => {
                      setStep2Validated(true);
                      if (!analysis || analysisStale) {
                        void handleAnalyze();
                      }
                    }}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-45 ${
                      step2Validated
                        ? "bg-[#1B7354] text-white"
                        : "bg-[#121316] hover:bg-[#C96442] text-white shadow-sm"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {step2Validated
                      ? "Étape 2 validée — Section d'analyse déverrouillée"
                      : "Valider les fichiers & Passer à l'analyse (Étape 3) →"}
                  </button>
                </div>
              </section>
            )}

            {/* ÉTAPE 3 : ANALYSE DOCIMOLOGIQUE & PROFIL STYLISTIQUE MESURÉ */}
            {(step2Validated || !!analysis) && (
              <section className="bg-white rounded-2xl border border-black/10 p-6 space-y-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                        analysisValidated ? "bg-[#1B7354] text-white" : "bg-[#121316] text-white"
                      }`}
                    >
                      {analysisValidated ? "✓" : "3"}
                    </span>
                    <div>
                      <h3 className="font-bold text-base sm:text-lg">
                        Analyse docimologique & matrice d’incidence
                      </h3>
                      <p className="text-xs text-black/60 max-w-2xl">
                        Isole la matière « {subjectInput} » au sein de l'UE, calcule la moyenne et le calibre maximal de QCM, et établit le pourcentage global de chaque format (majoritaires vs rares) sur l'ensemble des annales.
                      </p>
                    </div>
                  </div>
                  {analyzing ? (
                    <button
                      type="button"
                      onClick={() => (cancelRef.current = true)}
                      className="px-4 py-2 rounded-xl border border-black/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-black/5 shrink-0"
                    >
                      <Square className="w-3 h-3" /> Interrompre
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={generating}
                      className="px-5 py-2.5 rounded-xl bg-[#121316] hover:bg-[#C96442] text-white text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-colors shrink-0 shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />{" "}
                      {analysis ? "Actualiser l'analyse" : "Analyser les documents"}
                    </button>
                  )}
                </div>

                {analyzing && analysisProgress && (
                  <div className="p-4 rounded-xl bg-[#FAF8F5] border border-black/10 space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C96442]" />
                        {analysisProgress.message}
                      </span>
                      <span className="font-mono">
                        {Math.min(analysisProgress.current + 1, analysisProgress.total)}/
                        {analysisProgress.total}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className="h-full bg-[#121316] transition-all duration-500"
                        style={{ width: `${progressPct(analysisProgress)}%` }}
                      />
                    </div>
                  </div>
                )}

                {analysisStale && (
                  <div className="p-3.5 rounded-xl bg-[#C96442]/10 border border-[#C96442]/30 text-xs text-[#9a4a2e] font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Les fichiers ou la matière ont changé depuis la dernière analyse : relancez l'analyse pour mettre à jour les fréquences observées.
                  </div>
                )}

                {analysis && (
                  <div className="space-y-5">
                    {/* MÉTRIQUES CLÉS */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        {
                          k: "Épreuves retenues",
                          v: `${analysis.exams.filter((e) => e.questionCount > 0).length} / ${analysis.exams.length}`,
                          sub: `${analysis.totalAnalyzedQcm} QCM de « ${subjectInput} »`,
                        },
                        {
                          k: "Calibre d'épreuve (Réf. Max)",
                          v:
                            analysis.totalAnalyzedQcm > 0
                              ? `${analysis.plannedExamTotalQcm || analysis.maxQcm || analysis.avgQcmPerExam} QCM`
                              : annales.length > 0
                              ? "0 QCM détecté"
                              : "12 QCM",
                          sub:
                            analysis.totalAnalyzedQcm > 0
                              ? analysis.maxQcmExamTitle
                                ? `Calibré sur le max : ${analysis.maxQcmExamTitle}${
                                    analysis.minQcm && analysis.minQcm !== analysis.maxQcm
                                      ? ` (plage ${analysis.minQcm}–${analysis.maxQcm})`
                                      : ""
                                  }`
                                : `Calibre maximal observé : ${analysis.maxQcm || analysis.avgQcmPerExam} QCM`
                              : annales.length > 0
                              ? "Ré-importez les scans"
                              : "Sur le programme de cours",
                        },
                        {
                          k: "Chapitres / épreuve",
                          v:
                            analysis.totalAnalyzedQcm > 0 && analysis.avgLessonsPerExam > 0
                              ? `${analysis.avgLessonsPerExam}`
                              : "—",
                          sub:
                            analysis.totalAnalyzedQcm > 0 && analysis.avgLessonsPerExam > 0
                              ? "Chapitres corrélés / sujet"
                              : "En attente de corrélation",
                        },
                        {
                          k: "Quota recommandé",
                          v: `${quota} leçon${quota > 1 ? "s" : ""}`,
                          sub: `Sur ${activeLessons.filter((l) => !l.duplicateOf).length} cours`,
                        },
                      ].map((c) => (
                        <div
                          key={c.k}
                          className="p-3.5 rounded-xl bg-[#FAF8F5] border border-black/10 space-y-0.5"
                        >
                          <div className="text-[11px] text-black/55 font-semibold">{c.k}</div>
                          <div className="text-2xl font-bold font-mono text-[#121316]">{c.v}</div>
                          <div className="text-[10px] font-mono text-black/45">{c.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* CARTE EMPREINTE STYLISTIQUE MESURÉE */}
                    <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-black/10 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Fingerprint className="w-4 h-4 text-[#C96442]" />
                          <span className="text-xs font-bold uppercase tracking-wider text-[#121316]">
                            Empreinte Stylistique Mesurée & Répartition Globale des Formats (Toutes Annales Cumulées)
                          </span>
                        </div>
                        {(analysis.style?.measuredProfile?.tracedCount || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowDnaModal(true)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-black/15 hover:bg-black/5 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#C96442]" /> Inspecter les mesures et exemples
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-[#121316] font-medium leading-relaxed">
                        {analysis.style?.professorSignatureSummary}
                      </p>

                      {Array.isArray(analysis.style?.qualitativeStyleInsights) &&
                        analysis.style.qualitativeStyleInsights.length > 0 && (
                          <div className="p-3 rounded-xl bg-white border border-black/10 space-y-1.5">
                            <div className="text-[11px] font-bold text-[#121316]">
                              Interprétation qualitative du style de l’enseignant & mécanique des QCM :
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-[11px] text-[#373A40] leading-relaxed">
                              {analysis.style.qualitativeStyleInsights.map((insight, idx) => (
                                <li key={idx}>{insight}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {analysis.style?.measuredProfile && analysis.style.measuredProfile.questionCount > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[11px] font-bold text-black/65">
                            Construction des énoncés et assertions observée sur {analysis.style.measuredProfile.questionCount} QCM d’annales ({analysis.style.measuredProfile.sourceCount} épreuve(s)) :
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.style.measuredProfile.formats.map((m) => (
                              <span key={m.format} className="px-2 py-1 rounded-lg bg-white border border-black/10 text-[10px] font-mono text-black/70">
                                {EB_FORMAT_LABELS[m.format as EBFormat] || m.format} ({m.count} QCM) · énoncé ~{m.stemWords.median} mots
                                {m.optionWords ? ` · assertions/choix ~${m.optionWords.median} mots` : ""}
                                {m.negativeCount > 0 ? ` · ${m.negativeCount} tournure(s) négative(s)/piège` : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {(() => {
                        const entries = Object.entries(analysis.formatDistribution || {})
                          .filter(([f, n]) => Boolean(EB_FORMAT_LABELS[f as EBFormat]) && (n || 0) > 0)
                          .sort((a, b) => (b[1] || 0) - (a[1] || 0));
                        const totalFmtCount = entries.reduce((s, [, n]) => s + (n || 0), 0);
                        const perExamStats = analysis.formatStatsPerExam || [];
                        const rareFormatStats = perExamStats.filter((st) => st.isRare);
                        const plannedTotal =
                          analysis.plannedExamTotalQcm || analysis.maxQcm || analysis.avgQcmPerExam || 0;

                        return (
                          <div className="space-y-2.5 pt-1">
                            <div className="text-[11px] font-bold text-[#121316]">
                              {annales.length > 0
                                ? `Types de QCM & Quotas que vous aurez dans votre Examen Blanc (Calibre maximal : ${plannedTotal} QCM · basés sur ${totalFmtCount} QCM extraits) :`
                                : "Profil d’entraînement — aucune mesure d’annales"}
                            </div>
                            {entries.length === 0 ? (
                              <span className="text-xs text-black/50">
                                {annales.length > 0
                                  ? "Aucun format détecté dans les annales actuelles"
                                  : "Entraînement de base sans annale : réponse unique, 5 choix, sans dossier"}
                              </span>
                            ) : (
                              <div className="space-y-2.5">
                                <div className="flex flex-wrap gap-2 items-center">
                                  {entries.map(([f, n], idx) => {
                                    const fmtKey = f as EBFormat;
                                    const stat = perExamStats.find((s) => s.format === fmtKey);
                                    const pct =
                                      analysis.formatPercentages?.[fmtKey] !== undefined
                                        ? analysis.formatPercentages[fmtKey]!
                                        : Math.round(((n || 0) / totalFmtCount) * 100);
                                    const isRare = stat ? stat.isRare : pct < 15;
                                    const isDominant = stat ? stat.isDominant : idx === 0;
                                    const plannedQuota =
                                      stat?.plannedInExamBlanc ??
                                      analysis.plannedExamFormatCounts?.[fmtKey] ??
                                      stat?.maxInSingleExam ??
                                      stat?.avgPerExamRounded ??
                                      1;
                                    return (
                                      <span
                                        key={f}
                                        className={`px-3 py-1.5 rounded-xl border font-mono text-[11px] font-semibold flex items-center gap-2 ${
                                          isDominant
                                            ? "bg-[#121316] border-[#121316] text-white shadow-xs"
                                            : !isRare
                                            ? "bg-white border-[#121316]/20 text-[#121316] shadow-2xs"
                                            : "bg-[#C96442]/[0.08] border-[#C96442]/35 text-[#9a4a2e]"
                                        }`}
                                      >
                                        <span>{EB_FORMAT_LABELS[fmtKey]}</span>
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                            isDominant
                                              ? "bg-[#C96442] text-white"
                                              : !isRare
                                              ? "bg-[#121316] text-white"
                                              : "bg-[#C96442]/20 text-[#9a4a2e]"
                                          }`}
                                        >
                                          {plannedQuota} QCM dans l'examen blanc
                                        </span>
                                        <span className="text-[10px] opacity-80">
                                          ({pct}% · max {stat?.maxInSingleExam || plannedQuota}/épreuve ·{" "}
                                          {isDominant
                                            ? "Format dominant"
                                            : !isRare
                                            ? `Moy. ~${stat?.avgPerExamRounded || 1}/épreuve`
                                            : `Cas rare (${stat?.examsPresentCount || 1}/${stat?.totalMeasuredExams || 1} épreuve)`}
                                          )
                                        </span>
                                      </span>
                                    );
                                  })}
                                </div>

                                {rareFormatStats.length > 0 && (
                                  <div className="p-2.5 rounded-xl bg-[#C96442]/[0.06] border border-[#C96442]/25 text-[11px] text-[#7a3720] space-y-1">
                                    <div className="font-bold">
                                      Cas rares relevés dans vos évaluations (intégrés dans l’examen blanc avec leur quota exact) :
                                    </div>
                                    <ul className="list-disc list-inside space-y-0.5">
                                      {rareFormatStats.map((st) => (
                                        <li key={st.format}>
                                          <strong>{EB_FORMAT_LABELS[st.format]}</strong> : apparu dans{" "}
                                          {st.examOccurrences
                                            .map(
                                              (occ) =>
                                                `« ${occ.examTitle} »${occ.year ? ` (${occ.year})` : ""} (${occ.count} QCM)`
                                            )
                                            .join(", ")}{" "}
                                          → <strong>{st.plannedInExamBlanc || st.maxInSingleExam} QCM</strong> programmé(s) dans votre examen blanc.
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {analysis.style?.detectedGroupageCode && (
                        <div className="text-[11px] font-mono text-black/65 bg-white px-3 py-1.5 rounded-lg border border-black/10 inline-block">
                          <strong>Code Groupage détecté :</strong> {analysis.style?.detectedGroupageCode}
                        </div>
                      )}
                    </div>

                    {analysis.warnings.length > 0 && (
                      <ul className="space-y-1 text-[11px] text-[#9a4a2e] bg-[#C96442]/5 border border-[#C96442]/20 rounded-xl p-3 list-disc list-inside">
                        {analysis.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}

                    {/* DÉTAIL PAR ÉPREUVE */}
                    {analysis.exams.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-black/60">
                          Traçabilité épreuve par épreuve ({analysis.exams.length})
                        </h4>
                        {analysis.exams.map((e) => {
                          const open = expandedExamId === e.examId;
                          return (
                            <div
                              key={e.examId}
                              className="rounded-xl border border-black/10 overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => setExpandedExamId(open ? null : e.examId)}
                                className="w-full p-3 flex items-center justify-between gap-3 text-left bg-[#FAF8F5] hover:bg-black/[0.04] cursor-pointer"
                              >
                                <span className="min-w-0">
                                  <span className="flex items-center gap-2">
                                    <span className="block text-xs font-bold truncate">
                                      {e.title}
                                    </span>
                                    {e.ignoredReason === "OTHER_SUBJECT" && (
                                      <span className="px-1.5 py-0.5 rounded bg-black/10 text-black/60 text-[10px] font-mono shrink-0">
                                        Hors matière
                                      </span>
                                    )}
                                    {e.ignoredReason === "DUPLICATE_EXAM" && (
                                      <span className="px-1.5 py-0.5 rounded bg-[#C96442]/15 text-[#9a4a2e] text-[10px] font-mono shrink-0">
                                        Doublon fusionné
                                      </span>
                                    )}
                                  </span>
                                  <span className="block text-[10.5px] text-black/50 font-mono">
                                    {e.ignoredReason
                                      ? e.ignoredReason === "DUPLICATE_EXAM"
                                        ? `Fusionné avec « ${e.duplicateOfTitle || "épreuve précédente"} »`
                                        : "Écartée (autre matière de l'UE)"
                                      : `${e.questionCount} QCM retenus pour « ${subjectInput} » · ${e.caseCount} dossier(s)/cas · ${e.lessonsUsed.length} chapitre(s) identifié(s)`}
                                  </span>
                                </span>
                                {open ? (
                                  <ChevronDown className="w-4 h-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 shrink-0" />
                                )}
                              </button>
                              {open && (
                                <div className="p-3.5 space-y-2 text-xs bg-white border-t border-black/5">
                                  {e.ignoredReason ? (
                                    <div className="space-y-1 text-[#9a4a2e]">
                                      {(Array.isArray(e.summaryNotes)
                                        ? e.summaryNotes
                                        : typeof e.summaryNotes === "string"
                                        ? [e.summaryNotes]
                                        : []
                                      ).length ? (
                                        (Array.isArray(e.summaryNotes)
                                          ? e.summaryNotes
                                          : [String(e.summaryNotes)]
                                        ).map((note, idx) => <p key={idx}>{note}</p>)
                                      ) : (
                                        <p>
                                          {e.ignoredReason === "OTHER_SUBJECT"
                                            ? "Épreuve portant sur une autre matière — écartée du calcul."
                                            : `Doublon de « ${e.duplicateOfTitle} » — exclu pour éviter le double comptage.`}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(e.formatCounts)
                                          .filter(
                                            ([f, n]) => Boolean(EB_FORMAT_LABELS[f as EBFormat]) && n > 0
                                          )
                                          .map(([f, n]) => (
                                            <span
                                              key={f}
                                              className="px-2 py-0.5 rounded bg-[#FAF8F5] border border-black/10 font-mono text-[10px]"
                                            >
                                              {EB_FORMAT_LABELS[f as EBFormat]} × {n}
                                            </span>
                                          ))}
                                      </div>
                                      <p className="text-black/70">
                                        <strong>Chapitres sortis :</strong>{" "}
                                        {e.lessonsUsed.length
                                          ? e.lessonsUsed
                                              .map(
                                                (id) =>
                                                  analysis.lessonStats.find((s) => s.lessonId === id)
                                                    ?.title || id
                                              )
                                              .join(" · ")
                                          : "aucune correspondance directe avec les cours importés"}
                                      </p>
                                      {(Array.isArray(e.summaryNotes)
                                        ? e.summaryNotes
                                        : typeof e.summaryNotes === "string"
                                        ? [e.summaryNotes]
                                        : []
                                      ).length > 0 && (
                                        <ul className="space-y-0.5 text-[11px] text-black/65 list-disc list-inside">
                                          {(Array.isArray(e.summaryNotes)
                                            ? e.summaryNotes
                                            : [String(e.summaryNotes)]
                                          ).map((note, idx) => (
                                            <li key={idx}>{note}</li>
                                          ))}
                                        </ul>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* PORTE DE VALIDATION DE L'ÉTAPE 3 */}
                    <div className="pt-4 border-t border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-xs">
                        <SlidersHorizontal className="w-4 h-4 text-black/50" />
                        <span className="font-bold text-black/75">
                          Quota de chapitres pour ce sujet :
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, activeLessons.filter((l) => !l.duplicateOf).length)}
                          value={quota}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                            setCustomQuota(val);
                            setSelectedLessonIds((prev) => prev.slice(0, val));
                          }}
                          className="w-16 px-2.5 py-1 rounded-lg border border-black/20 font-mono font-bold text-center bg-[#FAF8F5]"
                        />
                        <span className="text-black/55">
                          sur {activeLessons.filter((l) => !l.duplicateOf).length} disponibles
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setAnalysisValidated(true);
                          if (selectedLessonIds.length === 0) selectMostFrequentLessons();
                        }}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                          analysisValidated
                            ? "bg-[#1B7354] text-white"
                            : "bg-[#121316] hover:bg-[#C96442] text-white"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {analysisValidated
                          ? "Étape 3 validée — Sélectionnez vos chapitres ci-dessous"
                          : "Valider l'analyse & Choisir les chapitres (Étape 4) →"}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ÉTAPE 4 : CHOIX DES CHAPITRES D'ÉVALUATION */}
            {analysis && !analysisStale && analysisValidated && (
              <section className="bg-white rounded-2xl border border-black/10 p-6 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-black/10">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-[#121316] text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </span>
                    <div>
                      <h3 className="font-bold text-base">
                        Sélectionnez vos {quota} chapitre{quota > 1 ? "s" : ""} d'évaluation
                      </h3>
                      <p className="text-xs text-black/60">
                        Fréquence détectée dans les annales de « {subjectInput} », pas une probabilité de sortie au prochain examen. Un petit corpus ne permet pas de généraliser.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={selectMostFrequentLessons}
                      className="px-3 py-1.5 rounded-lg bg-[#121316] text-white hover:bg-[#C96442] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Sparkles className="w-3 h-3" /> Top {quota} observé
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setProbSortOrder(probSortOrder === "desc" ? "asc" : "desc")
                      }
                      className="p-1.5 rounded-lg border border-black/15 bg-[#FAF8F5] hover:bg-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowUpDown className="w-3 h-3" />{" "}
                      {probSortOrder === "desc" ? "Plus fréquents" : "Moins fréquents"}
                    </button>
                    <div
                      className={`px-3 py-1 rounded-xl font-mono text-xs font-bold border whitespace-nowrap ${
                        quotaReached
                          ? "bg-[#1B7354]/10 text-[#1B7354] border-[#1B7354]/30"
                          : "bg-[#C96442]/10 text-[#C96442] border-[#C96442]/30"
                      }`}
                    >
                      {selectedLessonIds.length} / {quota} {quotaReached ? "✓ Prêt" : ""}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rankedLessons.map((st) => {
                    const isSel = selectedLessonIds.includes(st.lessonId);
                    const blurred = quotaReached && !isSel;
                    const expanded = expandedLessonId === st.lessonId;
                    return (
                      <div
                        key={st.lessonId}
                        className={`rounded-xl border transition-all ${
                          blurred
                            ? "blur-[1.5px] opacity-40 pointer-events-none bg-[#FAF8F5] border-black/10"
                            : isSel
                            ? "bg-white border-[#121316] shadow-sm ring-1 ring-[#121316]/10"
                            : "bg-[#FAF8F5] hover:bg-white border-black/10"
                        }`}
                      >
                        <div
                          className="p-3.5 flex items-center justify-between gap-2 cursor-pointer"
                          onClick={() => toggleLesson(st.lessonId)}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                isSel
                                  ? "bg-[#121316] text-white border-[#121316]"
                                  : "bg-white border-black/20"
                              }`}
                            >
                              {isSel ? "✓" : ""}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold truncate">{st.title}</div>
                              <div className="text-[10.5px] text-black/50 font-mono flex items-center gap-1.5 flex-wrap">
                                <span>
                                  {st.timesOut} sortie{st.timesOut > 1 ? "s" : ""}
                                </span>
                                <span>·</span>
                                <span>
                                  {st.examsAppeared}/{st.totalExams} épreuves
                                </span>
                                <span>·</span>
                                <span>{st.totalQcm} QCM</span>
                                {(st.tracedAnnaleQuestions || 0) > 0 && (
                                  <span className="px-1.5 py-0.2 rounded bg-[#C96442]/15 text-[#9a4a2e] text-[9.5px] font-bold">
                                    {st.tracedAnnaleQuestions} énoncé(s) tracé(s)
                                  </span>
                                )}
                              </div>
                              <div className="h-1 rounded-full bg-black/10 mt-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-[#121316]"
                                  style={{ width: `${st.percent ?? 0}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="font-mono text-xs font-bold" title={st.totalExams ? `Fréquence détectée sur ${st.totalExams} épreuve(s)` : "Aucune annale exploitable"}>{st.percent === null ? "Non mesuré" : `${st.percent}%`}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedLessonId(expanded ? null : st.lessonId);
                              }}
                              className="p-1 rounded hover:bg-black/5 cursor-pointer"
                              title="Détail des sorties et modèles"
                            >
                              {expanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                        {expanded && (
                          <div className="px-3.5 pb-3.5 text-[11px] space-y-2 border-t border-black/5 pt-2.5 bg-white rounded-b-xl">
                            {st.perExam.length === 0 && (
                              <p className="text-black/50">
                                Jamais tombé directement dans les annales importées (sujet potentiel inédit).
                              </p>
                            )}
                            {st.perExam.map((p) => (
                              <div key={p.examId} className="space-y-0.5">
                                <div className="flex justify-between gap-2">
                                  <span className="truncate font-semibold">{p.examTitle}</span>
                                  <span className="font-mono shrink-0 text-[#C96442] font-bold">
                                    {p.blocks} bloc(s) · {p.qcm} QCM
                                  </span>
                                </div>
                                {p.summary && (
                                  <p className="text-[10.5px] text-black/60 pl-2 border-l-2 border-[#C96442]/40">
                                    {p.summary}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* BOUTON DE GÉNÉRATION FINALE & BANDEAU MODE INFINI ANTI-RÉPÉTITION */}
            <div className="flex flex-col items-center gap-3 pt-2">
              {planPreview.error && (
                <div role="alert" className="w-full max-w-2xl p-4 rounded-xl border border-[#C96442]/30 bg-[#C96442]/5 text-sm text-[#9a4a2e]">
                  {planPreview.error}
                </div>
              )}
              {planPreview.design && (
                <section aria-label="Plan d’épreuve" className="w-full max-w-2xl p-4 rounded-2xl border border-black/15 bg-white space-y-3 text-xs">
                  <h3 className="font-bold text-sm">Plan d’épreuve avant génération</h3>
                  <p>{planPreview.design.mode === "observed" ? `Fondé sur ${planPreview.design.observedQuestions} question(s) extraites des annales.` : "Entraînement de base — style de l’enseignant non mesuré."}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <span><strong>{planPreview.design.totalQuestions}</strong> questions prévues</span>
                    <span><strong>{planPreview.design.caseQuestions}</strong> en dossier · {planPreview.design.totalQuestions - planPreview.design.caseQuestions} indépendantes</span>
                    <span>Taille cible d’un dossier : {planPreview.design.dossierSize ?? "sans dossier"}</span>
                    <span>Énoncé observé moyen : {planPreview.design.meanStemWords === null ? "non mesuré" : `${planPreview.design.meanStemWords} mots`}</span>
                  </div>
                  <p>Formats : {Object.entries(planPreview.design.formatCounts).map(([format, count]) => `${count} ${EB_FORMAT_SHORT_LABELS[format as EBFormat]}`).join(" · ")}</p>
                  <p>Choix par question : {Object.entries(planPreview.design.optionCounts).map(([choices, count]) => `${count} question(s) à ${choices} choix`).join(" · ")}</p>
                  <p className="text-black/60">Proportions globales adaptées aux chapitres choisis ; chaque dossier reste dans un seul chapitre. La durée est un réglage de session, pas une mesure des annales.</p>
                  {planPreview.design.warnings.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 text-[#9a4a2e]">
                      {planPreview.design.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                    </ul>
                  )}
                </section>
              )}
              {analysis && !analysisStale && quotaReached && (
                <div className="w-full max-w-2xl px-4 py-3 rounded-2xl bg-[#FAF8F5] border border-black/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2 py-0.5 rounded-md bg-[#121316] text-white font-mono text-[10.5px] font-bold shrink-0">
                      ♾️ Mode Infini #{infiniteStats.totalGenerations + 1}
                    </span>
                    <span className="text-black/75 truncate">
                      {infiniteStats.totalUniqueQuestionsTracked > 0
                        ? `${infiniteStats.totalUniqueQuestionsTracked} empreintes mémorisées pour limiter les répétitions. Les doublons détectés sont rejetés.`
                        : "Historique anti-répétition actif ; l’absence de doublons sémantiques ne peut pas être garantie."}
                    </span>
                  </div>
                  {infiniteStats.totalUniqueQuestionsTracked > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        await resetInfiniteMemoryLedger();
                        setInfiniteStats({ totalGenerations: 0, totalUniqueQuestionsTracked: 0 });
                        toast({
                          title: "Mémoire infinie réinitialisée",
                          description: "L'historique anti-répétition des QCM a été remis à zéro.",
                        });
                      }}
                      className="text-[11px] font-mono text-[#C96442] hover:underline shrink-0 cursor-pointer"
                    >
                      Réinitialiser l'historique
                    </button>
                  )}
                </div>
              )}
              {generating && genProgress && (
                <div className="w-full max-w-xl p-4 rounded-2xl bg-white border border-black/10 space-y-2.5 shadow-md">
                  <div className="flex justify-between text-xs font-semibold gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <Loader2 className="w-4 h-4 animate-spin text-[#C96442] shrink-0" />
                      <span className="truncate">{genProgress.message}</span>
                    </span>
                    <span className="font-mono shrink-0">
                      {Math.min(genProgress.current + 1, genProgress.total)}/
                      {genProgress.total}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className="h-full bg-[#C96442] transition-all duration-500"
                      style={{ width: `${progressPct(genProgress)}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => (cancelRef.current = true)}
                    className="text-[11px] text-black/50 hover:text-black underline cursor-pointer"
                  >
                    Annuler la génération
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!analysis || analysisStale || !quotaReached || !planPreview.design || Boolean(planPreview.error) || generating || analyzing}
                className={`px-8 py-4 rounded-2xl font-bold text-sm transition-all shadow-lg flex items-center gap-2.5 ${
                  analysis && !analysisStale && quotaReached && planPreview.design && !planPreview.error && !generating && !analyzing
                    ? "bg-[#121316] hover:bg-[#C96442] text-white active:scale-98 cursor-pointer"
                    : "bg-black/10 text-black/40 cursor-not-allowed"
                }`}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Rédaction & relecture IA séparée en cours…
                  </>
                ) : !analysis ? (
                  "Lancez d'abord l'analyse docimologique (Étape 3)"
                ) : analysisStale ? (
                  "Relancez l'analyse suite aux changements"
                ) : quotaReached ? (
                  <>
                    <Sparkles className="w-4 h-4" /> Générer l'examen blanc ({subjectInput}) →
                  </>
                ) : (
                  `Sélectionnez encore ${quota - selectedLessonIds.length} chapitre(s) à l'Étape 4`
                )}
              </button>
            </div>
          </div>
        )}

        {/* ================= VUE 2 : BIBLIOTHÈQUE ================= */}
        {activeView === "library" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center gap-3 pb-4 border-b border-black/10">
              <div>
                <h2 className="font-bold text-xl">Bibliothèque des Examens Blancs</h2>
                <p className="text-xs text-black/60 mt-0.5">
                  Retrouvez toutes vos épreuves générées, vos copies corrigées et vos exports PDF vectoriels.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveView("studio")}
                className="px-4 py-2.5 rounded-xl bg-[#121316] hover:bg-[#C96442] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Nouvel examen blanc
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-black/10 space-y-3">
                <BookOpen className="w-10 h-10 mx-auto text-black/30" />
                <h3 className="font-bold text-base">Aucun examen blanc enregistré</h3>
                <p className="text-xs text-black/60 max-w-sm mx-auto">
                  Ouvrez le Studio : importez les cours et annales de n’importe quelle matière, lancez l’analyse docimologique et générez votre première copie.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveView("studio")}
                  className="px-4 py-2 rounded-xl bg-black text-white text-xs font-bold cursor-pointer"
                >
                  Ouvrir le Studio
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sessions.map((s) => {
                  const total = s.blocks.reduce((n, b) => n + b.items.length, 0);
                  return (
                    <div
                      key={s.id}
                      onClick={() => openSession(s)}
                      className="p-5 rounded-2xl bg-white border border-black/10 hover:border-black/30 shadow-sm cursor-pointer flex flex-col justify-between gap-4 group transition-all min-w-0"
                    >
                      <div className="space-y-2.5 min-w-0">
                        <div className="flex justify-between items-center gap-2 text-xs text-black/50 font-mono">
                          <span className="px-2 py-0.5 rounded bg-[#FAF8F5] font-bold text-black border border-black/5 whitespace-nowrap truncate max-w-[60%]">
                            {s.subjectName || `${s.lessonTitles.length} chapitre(s)`}
                          </span>
                          <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatSessionDate(s.createdAt)}
                          </span>
                        </div>
                        <h3 className="font-bold text-base leading-snug group-hover:text-[#C96442] transition-colors line-clamp-2">
                          {s.title}
                        </h3>
                        <p className="text-xs text-black/60 line-clamp-2">{s.subtitle}</p>
                        {s.score && (
                          <div className="flex items-center gap-2 font-mono text-[11px] pt-1">
                            <span className="px-2 py-0.5 rounded bg-[#1B7354]/10 text-[#1B7354] font-bold">
                              ✓ {s.score.found}/{s.score.total}
                            </span>
                            <span className="text-black/60 font-bold">
                              {Math.round((s.score.found / (s.score.total || 1)) * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="pt-3 border-t border-black/5 flex justify-between items-center text-xs font-semibold">
                        <span className="text-black/70 font-mono whitespace-nowrap">
                          {total} QCM · {s.durationMin} min
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => exportSessionPdf(s, e)}
                            className="p-1.5 rounded-lg hover:bg-black/5 text-black/60 hover:text-black cursor-pointer"
                            title="Exporter le Cahier d'Épreuve en PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => deleteSession(s.id, e)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-black/40 hover:text-rose-600 cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[#C96442] flex items-center gap-0.5 whitespace-nowrap pl-1">
                            {s.finished ? "Corrigé" : "Composer"}{" "}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= VUE 3 : FEUILLE D'EXAMEN OFFICIELLE ================= */}
        {activeView === "exam" && activeSession && (
          <div className="space-y-6">
            {/* STATION DE CONTRÔLE DOCIMOLOGIQUE */}
            <div
              ref={originStationRef}
              className="bg-white rounded-2xl border border-black/10 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <div className="px-4 py-2 rounded-xl bg-[#121316] text-white font-mono text-base font-bold flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      timerRunning ? "bg-[#C96442] animate-ping" : "bg-white/40"
                    }`}
                  />
                  {formatClock(timerRemainingSec)}
                </div>
                <div className="flex items-center p-1 rounded-xl bg-[#EDE8E0] text-xs font-mono font-bold flex-wrap gap-0.5">
                  {DURATION_CHOICES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={activeSession.finished}
                      onClick={() => {
                        const sec = m * 60;
                        setTimerRemainingSec(sec);
                        persistTimerForActive(sec);
                      }}
                      className="px-2 py-1 rounded-lg cursor-pointer text-black/70 hover:bg-white disabled:opacity-40"
                    >
                      {m >= 60
                        ? `${Math.floor(m / 60)}h${
                            m % 60 === 0 ? "00" : String(m % 60).padStart(2, "0")
                          }`
                        : `${m}m`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold flex-wrap">
                <button
                  type="button"
                  onClick={() => setLeftDrawerOpen(true)}
                  className="px-3 py-1.5 rounded-xl border border-black/15 bg-[#FAF8F5] hover:bg-black/5 cursor-pointer flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" /> Grille ({examStats.answered}/{examStats.total})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (timerRunning) persistTimerForActive(timerRemainingSec);
                    setTimerRunning(!timerRunning);
                  }}
                  disabled={activeSession.finished}
                  className="px-3 py-1.5 rounded-xl border border-black/15 bg-[#FAF8F5] hover:bg-black/5 cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
                >
                  {timerRunning ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}{" "}
                  {timerRunning ? "Pause" : "Reprendre"}
                </button>
                <button
                  type="button"
                  onClick={() => setCorrectionMode(!correctionMode)}
                  className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                    revealed
                      ? "bg-[#1B7354] text-white"
                      : "border border-black/15 bg-[#FAF8F5] hover:bg-black/5"
                  }`}
                >
                  {revealed ? "✓ Corrigé affiché" : "Vérifier les réponses"}
                </button>
                <button
                  type="button"
                  onClick={() => exportSessionPdf(activeSession)}
                  className="px-3 py-1.5 rounded-xl border border-black/15 bg-[#FAF8F5] hover:bg-black/5 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Exporter en PDF
                </button>
                {!activeSession.finished && (
                  <button
                    type="button"
                    onClick={finishAndSave}
                    className="px-4 py-1.5 rounded-xl bg-[#C96442] hover:bg-[#b05333] text-white cursor-pointer"
                  >
                    Rendre la copie
                  </button>
                )}
              </div>
            </div>

            {/* BANDEAU DE SCORE LORSQUE CORRIGÉ */}
            {revealed && (
              <div className="p-5 rounded-2xl bg-[#121316] text-white flex flex-wrap items-center justify-between gap-4 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1B7354] flex items-center justify-center">
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-white/60">
                      Résultat docimologique de la copie
                    </div>
                    <div className="text-lg font-bold">
                      Note : {examStats.found} / {examStats.total} (
                      {Math.round((examStats.found / Math.max(1, examStats.total)) * 100)} %) —{" "}
                      {Math.round((examStats.found / Math.max(1, examStats.total)) * 20 * 10) / 10}{" "}
                      / 20
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-3 py-1 rounded-lg bg-[#1B7354]/25 text-[#5CE0B5] font-bold">
                    ✓ {examStats.found} exactes
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-[#BA392D]/25 text-[#FCA5A5] font-bold">
                    ✗ {examStats.wrong} erreurs
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-white/10 text-white/80">
                    {examStats.remaining} sans réponse
                  </span>
                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => handleGenerate()}
                    className="ml-2 px-3.5 py-1.5 rounded-xl bg-[#C96442] hover:bg-[#b05333] text-white font-sans font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Nouvelle session (mêmes leçons)
                  </button>
                </div>
              </div>
            )}

            {/* BILAN STYLISTIQUE DESCRIPTIF (SANS SCORE DE FIDÉLITÉ) */}
            {activeSession.styleReport && (
              <details className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[#121316] flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-[#C96442]" />
                  Bilan stylistique — comparaison descriptive avec les annales (sans score de fidélité)
                </summary>
                <div className="mt-3 space-y-2 text-[11px] text-[#4A4D54]">
                  <p>
                    {activeSession.styleReport.referenceCount} énoncé(s) d’annales mesuré(s) · {activeSession.styleReport.generatedCount} question(s) générée(s). Les longueurs sont en mots.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-[10.5px]">
                      <thead>
                        <tr className="text-black/50">
                          <th className="py-1 pr-3">Format</th>
                          <th className="py-1 pr-3">Annales : médiane (P10–P90)</th>
                          <th className="py-1 pr-3">Examen : médiane (P10–P90)</th>
                          <th className="py-1">Énoncés négatifs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSession.styleReport.rows.map((row) => (
                          <tr key={row.format} className="border-t border-black/5">
                            <td className="py-1 pr-3 font-bold">{EB_FORMAT_SHORT_LABELS[row.format as EBFormat] || row.format}</td>
                            <td className="py-1 pr-3">
                              {row.reference ? `${row.reference.stemWords.median} (${row.reference.stemWords.p10}–${row.reference.stemWords.p90}) · ${row.reference.count} énoncé(s)` : "non mesuré"}
                            </td>
                            <td className="py-1 pr-3">
                              {row.generated.stemWords.median} ({row.generated.stemWords.p10}–{row.generated.stemWords.p90}) · {row.generated.count} question(s)
                            </td>
                            <td className="py-1">
                              {row.reference ? `${row.reference.negativeCount}/${row.reference.count}` : "—"} → {row.generated.negativeCount}/{row.generated.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {activeSession.styleReport.warnings.map((w, i) => (
                    <p key={i} className="text-[10px] text-black/55 leading-relaxed">{w}</p>
                  ))}
                  {activeSession.styleReport.sources.length > 0 && (
                    <p className="text-[10px] text-black/50 leading-relaxed">
                      Exemples de forme injectés : {activeSession.styleReport.sources.map((s) => `« ${s.title} »${s.questionNumber ? `, question ${s.questionNumber}` : ""} (ligne ${s.lineStart}${s.page ? `, page ${s.page}` : ""} du texte extrait)`).join(" · ")}
                    </p>
                  )}
                </div>
              </details>
            )}

            {/* FEUILLE D'EXAMEN OFFICIELLE */}
            <article className="bg-white rounded-3xl border border-black/12 p-6 sm:p-12 space-y-10 shadow-md">
              <header className="border-b-2 border-[#121316] pb-6 text-center space-y-2 font-serif">
                <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-[#121316]">
                  {studentProfile.university || "Établissement d'Enseignement Supérieur & Universitaire"}
                </h2>
                {studentProfile.faculty && (
                  <div className="text-xs sm:text-sm text-black/70">{studentProfile.faculty}</div>
                )}
                {activeSession.ueName && (
                  <div className="text-xs font-mono uppercase tracking-widest text-black/60">
                    {activeSession.ueName}
                  </div>
                )}
                <div className="pt-2">
                  <span className="inline-block px-5 py-1.5 border-2 border-[#121316] bg-[#FAF8F5] font-bold uppercase text-xs sm:text-sm tracking-wider">
                    ÉPREUVE DE {activeSession.subjectName.toUpperCase()} — {activeSession.title}
                  </span>
                </div>
                <p className="text-[11px] font-sans text-black/55 pt-1">
                  Chapitres évalués : {activeSession.lessonTitles.join(" · ")}
                </p>
              </header>

              <div className="space-y-10">
                {activeSession.blocks.map((b, bIdx) => (
                  <section
                    key={b.id}
                    className="space-y-5 pt-8 border-t border-black/10 first:border-t-0 first:pt-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-lg bg-[#121316] text-white">
                        {b.header || `Partie ${bIdx + 1}`}
                      </span>
                      <span className="text-[10.5px] font-mono text-[#1B7354] bg-[#1B7354]/10 px-2.5 py-0.5 rounded-full font-semibold">
                        {b.validation?.version === 1 && b.validation.status === "passed"
                          ? b.validation.differentModel ? "Relecture croisée IA effectuée" : "Relecture IA séparée effectuée"
                          : "Ancienne session : relecture non attestée"}
                      </span>
                    </div>

                    {b.kind === "CAS_CLINIQUE" && b.vignette && (
                      <div className="p-5 sm:p-6 rounded-2xl bg-[#F9F7F2] border-l-4 border-[#121316] text-[14.5px] leading-relaxed space-y-2 shadow-2xs">
                        <span className="font-mono font-bold uppercase text-[10.5px] tracking-widest block text-[#C96442]">
                          Énoncé du dossier / Cas progressif
                        </span>
                        <p className="text-[#121316] whitespace-pre-line">{b.vignette}</p>
                      </div>
                    )}

                    <div className="space-y-4">{b.items.map((it) => renderItem(it))}</div>
                  </section>
                ))}
              </div>
            </article>
          </div>
        )}
      </main>

      {/* MODAL D'INSPECTION DU PROFIL STYLISTIQUE MESURÉ & EXEMPLES LOCALISÉS */}
      {showDnaModal && analysis && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF8F5] rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center pb-3 border-b border-black/10">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-[#C96442]" />
                <h3 className="font-bold text-base">
                  Profil stylistique mesuré & exemples localisés dans vos annales
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDnaModal(false)}
                className="text-sm font-bold text-black/50 hover:text-black cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="p-4 rounded-2xl bg-[#121316] text-white space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-[#C96442] font-bold">
                    Empreinte docimologique active — {analysis.subjectName || subjectInput || "Matière étudiée"}
                  </span>
                  <span className="font-mono text-[10.5px] px-2.5 py-0.5 rounded-full bg-white/10 text-white/90">
                    {analysis.style?.measuredQuestions > 0
                      ? `${Math.round((analysis.style?.clinicalCaseRatio || 0) * 100)} % en dossier · ${100 - Math.round((analysis.style?.clinicalCaseRatio || 0) * 100)} % indépendantes`
                      : "Structure des annales non mesurée"}
                  </span>
                </div>
                <p className="text-white/80 text-[11.5px] leading-relaxed">
                  {analysis.style?.professorSignatureSummary}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(analysis.formatDistribution)
                    .filter(([, cnt]) => (cnt || 0) > 0)
                    .map(([fmt, cnt]) => (
                      <span
                        key={fmt}
                        className="px-2.5 py-1 rounded-lg bg-white/10 font-mono text-[10.5px] text-white"
                      >
                        {EB_FORMAT_SHORT_LABELS[fmt as EBFormat] || fmt} : <strong>{cnt} QCM</strong>
                      </span>
                    ))}
                </div>
              </div>

              {analysis.style?.measuredProfile && analysis.style.measuredProfile.questionCount > 0 && (
                <div className="p-4 rounded-2xl bg-white border border-black/10 space-y-2">
                  <div className="font-mono font-bold uppercase text-[10.5px] text-[#C96442]">
                    Mesures descriptives par format ({analysis.style.measuredProfile.questionCount} énoncé(s), {analysis.style.measuredProfile.tracedCount} localisé(s) dans le texte)
                  </div>
                  <div className="space-y-1.5">
                    {analysis.style.measuredProfile.formats.map((m) => (
                      <div key={m.format} className="text-[11px] text-[#121316] leading-relaxed">
                        <strong>{EB_FORMAT_LABELS[m.format as EBFormat] || m.format}</strong> — {m.count} énoncé(s) : médiane {m.stemWords.median} mots (P10–P90 {m.stemWords.p10}–{m.stemWords.p90}) ; négatifs {m.negativeCount}/{m.count} ; interrogatifs {m.interrogativeCount}/{m.count} ; deux-points {m.colonCount}/{m.count}
                        {m.optionWords ? ` ; propositions : médiane ${m.optionWords.median} mots (P10–P90 ${m.optionWords.p10}–${m.optionWords.p90}), choix courts ${m.shortOptionPercent} %, négations ${m.negativeOptionPercent} %` : ""}
                        {m.openings.length > 0 && (
                          <span className="block text-black/60">Amorces récurrentes : {m.openings.map((o) => `« ${o.text} » (×${o.count})`).join(", ")}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {analysis.style.measuredProfile.warnings.map((w, i) => (
                    <p key={i} className="text-[10px] text-black/50 leading-relaxed">{w}</p>
                  ))}
                </div>
              )}

              {(analysis.style?.measuredProfile?.examples?.length || 0) > 0 && (
                <div className="space-y-2">
                  <div className="font-mono font-bold uppercase text-[10.5px] text-black/60">
                    Exemples localisés dans le texte extrait — référence de forme uniquement, jamais recopiés dans l’examen
                  </div>
                  {analysis.style?.measuredProfile?.examples.map((ex, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-[#121316] text-white/90 font-mono text-[11px] leading-relaxed space-y-1">
                      <div className="text-[#C96442] text-[10px]">
                        {EB_FORMAT_SHORT_LABELS[ex.format as EBFormat] || ex.format} — « {ex.source!.title} »{ex.source!.questionNumber ? `, question ${ex.source!.questionNumber}` : ""}, ligne {ex.source!.lineStart}{ex.source!.page ? `, page ${ex.source!.page}` : ""} du texte extrait
                      </div>
                      <div className="whitespace-pre-wrap">{ex.stem}</div>
                      {ex.optionTexts?.length ? (
                        <div className="text-white/60 whitespace-pre-wrap">{ex.optionTexts.map((t, i) => `${"ABCDEFGHIJ"[i]}. ${t}`).join("\n")}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowDnaModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#121316] text-white text-xs font-bold cursor-pointer"
            >
              Fermer l’inspecteur de style
            </button>
          </div>
        </div>
      )}

      {/* MODAL BIBLIOTHÈQUE DE COURS */}
      {libraryPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-black/10">
              <h3 className="font-bold text-base">Importer depuis ma bibliothèque</h3>
              <button
                type="button"
                onClick={() => setLibraryPickerOpen(false)}
                className="text-sm font-bold text-black/50 hover:text-black cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {libraryCourses.length === 0 && (
                <p className="text-xs text-black/50 py-6 text-center">
                  Aucun cours enregistré dans votre bibliothèque.
                </p>
              )}
              {libraryCourses.map((c) => {
                const on = libraryPicked.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs cursor-pointer ${
                      on
                        ? "border-black bg-black/[0.03]"
                        : "border-black/10 hover:bg-black/[0.03]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setLibraryPicked((prev) =>
                          on ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                        )
                      }
                    />
                    <span className="truncate font-medium">{c.title}</span>
                  </label>
                );
              })}
            </div>
            <button
              type="button"
              disabled={libraryPicked.length === 0}
              onClick={importFromLibrary}
              className="w-full py-2.5 rounded-xl bg-black text-white text-xs font-bold cursor-pointer disabled:opacity-40"
            >
              Importer {libraryPicked.length || ""} cours
            </button>
          </div>
        </div>
      )}

      {/* MODAL '?' */}
      {howItWorksOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-black/10">
              <h3 className="font-bold text-base">
                Comment l’examen est-il construit et vérifié ?
              </h3>
              <button
                type="button"
                onClick={() => setHowItWorksOpen(false)}
                className="text-sm font-bold text-black/50 hover:text-black cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
            <ol className="text-xs text-[#4A4D54] leading-relaxed space-y-2.5 list-decimal list-inside">
              <li>
                <strong>Analyse des supports :</strong> le moteur rapproche les questions des chapitres par leur vocabulaire. Les rapprochements doivent être examinés, notamment lorsque l’OCR ou le corpus est incomplet.
              </li>
              <li>
                <strong>Statistiques descriptives :</strong> les fréquences portent uniquement sur les annales reconnues ; elles ne prédisent pas le contenu d’un futur examen.
              </li>
              <li>
                <strong>Style des annales :</strong> le moteur mesure longueurs, amorces et négations des énoncés, puis injecte des exemples localisés (ligne et page du texte extrait) comme référence de forme uniquement. Les questions recopiées d’une annale sont rejetées et un bilan comparatif descriptif accompagne la copie. Une imitation parfaite du professeur n’est pas garantie.
              </li>
              <li>
                <strong>Validation bloquante :</strong> une passe IA séparée résout les questions sans voir le corrigé initial. Les désaccords, les citations absentes, les formats invalides et les ambiguïtés empêchent la publication ; l’IA reste faillible.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setHowItWorksOpen(false)}
              className="w-full py-2.5 rounded-xl bg-black text-white text-xs font-bold cursor-pointer"
            >
              Compris
            </button>
          </div>
        </div>
      )}

      {/* MODAL INSPECTEUR DE PROMPT SYSTÈME */}
      {engineInspectorOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF8F5] rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center pb-3 border-b border-black/10">
              <h3 className="font-bold text-base font-mono">
                Inspecteur du Prompt Système & Profil Stylistique
              </h3>
              <button
                type="button"
                onClick={() => setEngineInspectorOpen(false)}
                className="text-sm font-bold text-black/50 hover:text-black cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
            <pre className="p-4 rounded-2xl bg-[#121316] text-white font-mono text-[11px] overflow-auto whitespace-pre-wrap flex-1">
              {analysis || ueInput || subjectInput
                ? fillSystemPrompt(ueInput, subjectInput, quota || 0, analysis?.style)
                : EXAMEN_BLANC_SYSTEM_PROMPT}
            </pre>
            <button
              type="button"
              onClick={() => setEngineInspectorOpen(false)}
              className="w-full py-2.5 rounded-xl bg-black text-white text-xs font-bold cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamenBlanc;
