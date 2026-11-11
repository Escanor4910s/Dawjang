// src/pages/ExamenBlanc.tsx
// ============================================================================
// EXAMEN BLANC — Studio & Analyse · Bibliothèque · Feuille d'Examen
// Moteur universel (aucun biais de matière) : voir src/lib/examenBlancEngine.ts
// ============================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFileReader } from "@/hooks/useFileReader";
import { exportQuizToPDF } from "@/utils/pdfExport";
import type { QuizData } from "@/utils/QuizPDF";
import { getSavedCourses } from "@/pages/Library";
import {
  EB_FORMAT_LABELS,
  EXAMEN_BLANC_SYSTEM_PROMPT,
  buildLesson,
  cleanLessonTitle,
  computeCorpusAnalysis,
  computeScore,
  fillSystemPrompt,
  flagDuplicateLessons,
  formatSessionDate,
  generateExamBlanc,
  isItemCorrect,
  loadSessions,
  runDeepAnalysis,
  saveSessions,
  sessionToPdfQuestions,
  sizeLabelOf,
  type AnalysisProgress,
  type CorpusAnalysis,
  type EBAnnale,
  type EBItem,
  type EBLesson,
  type ExamSession,
} from "@/lib/examenBlancEngine";

const STUDIO_KEY = "dawjang_eb_studio_v2";
const DURATION_CHOICES = [30, 45, 60, 90, 120, 180];

const formatClock = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const detectYearFromName = (name: string) => (/\b(20[12]\d)\b/.exec(name) || [])[1] || "";

export const ExamenBlanc: React.FC = () => {
  const { toast } = useToast();
  const { readFile } = useFileReader();

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

  const [isReading, setIsReading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<AnalysisProgress | null>(null);
  const cancelRef = useRef(false);

  const [sessions, setSessions] = useState<ExamSession[]>(() => loadSessions());
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

  const originStationRef = useRef<HTMLDivElement>(null);
  const coursesInputRef = useRef<HTMLInputElement>(null);
  const annalesInputRef = useRef<HTMLInputElement>(null);

  // ------------------------------------------------------------------ persistance
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STUDIO_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      setUeInput(s.ue || "");
      setSubjectInput(s.subject || "");
      setDurationMin(s.durationMin || 60);
      setLessons(Array.isArray(s.lessons) ? s.lessons : []);
      setAnnales(Array.isArray(s.annales) ? s.annales : []);
      setAnalysis(s.analysis || null);
      setAnalysisSignature(s.analysisSignature || "");
      setSelectedLessonIds(Array.isArray(s.selectedLessonIds) ? s.selectedLessonIds : []);
    } catch {
      // état corrompu : on repart d'un studio vierge
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const base = { ue: ueInput, subject: subjectInput, durationMin, selectedLessonIds };
      const attempts = [
        { ...base, lessons, annales, analysis, analysisSignature },
        { ...base, lessons, annales, analysis: null, analysisSignature: "" },
        { ...base, lessons: lessons.map((l) => ({ ...l, content: l.content.slice(0, 40000) })), annales: [], analysis: null, analysisSignature: "" },
      ];
      for (const a of attempts) {
        try {
          localStorage.setItem(STUDIO_KEY, JSON.stringify(a));
          return;
        } catch {
          // quota dépassé : tentative suivante, plus légère
        }
      }
    }, 600);
    return () => clearTimeout(t);
  }, [ueInput, subjectInput, durationMin, lessons, annales, analysis, analysisSignature, selectedLessonIds]);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  // ------------------------------------------------------------------ dérivés
  const currentSignature = useMemo(
    () => JSON.stringify([subjectInput.trim().toLowerCase(), lessons.map((l) => l.id), annales.map((a) => a.id)]),
    [subjectInput, lessons, annales]
  );
  const analysisStale = !!analysis && analysisSignature !== currentSignature;
  const quota = analysis?.quota || 0;
  const activeLessons = useMemo(() => flagDuplicateLessons(lessons), [lessons]);
  const quotaReached = quota > 0 && selectedLessonIds.length >= quota;

  const rankedLessons = useMemo(() => {
    if (!analysis) return [];
    const list = [...analysis.lessonStats];
    return probSortOrder === "desc" ? list : list.reverse();
  }, [analysis, probSortOrder]);

  const examStats = useMemo(() => {
    if (!activeSession) return { found: 0, wrong: 0, total: 0, answered: 0, remaining: 0, pct: 0 };
    const s = computeScore(activeSession.blocks, answers);
    return { ...s, pct: s.total ? Math.round((s.answered / s.total) * 100) : 0 };
  }, [activeSession, answers]);

  const revealed = correctionMode || !!activeSession?.finished;

  // ------------------------------------------------------------------ minuteur
  useEffect(() => {
    if (activeView !== "exam" || !timerRunning) return;
    const id = setInterval(() => {
      setTimerRemainingSec((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          toast({ title: "Temps écoulé", description: "Le temps imparti est terminé. Vous pouvez terminer l'épreuve." });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activeView, timerRunning, toast]);

  useEffect(() => {
    if (activeView !== "exam") return;
    const onScroll = () => {
      if (!originStationRef.current) return;
      setTimerDetached(originStationRef.current.getBoundingClientRect().bottom < 68);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [activeView]);

  // ------------------------------------------------------------------ imports
  const ingestFiles = async (files: FileList | null, target: "courses" | "annales") => {
    if (!files || files.length === 0) return;
    setIsReading(true);
    let ok = 0;
    const failed: string[] = [];
    const newLessons: EBLesson[] = [];
    const newAnnales: EBAnnale[] = [];
    for (const file of Array.from(files)) {
      try {
        const res = await readFile(file);
        if (!res.success || !res.content || res.content.trim().length < 40) {
          failed.push(file.name);
          continue;
        }
        const id = `${target === "courses" ? "c" : "a"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        if (target === "courses") {
          newLessons.push(buildLesson(id, file.name, res.content, file.size, subjectInput));
        } else {
          newAnnales.push({
            id,
            title: file.name,
            rawText: res.content,
            year: detectYearFromName(file.name),
            wordCount: res.content.split(/\s+/).filter(Boolean).length,
            sizeLabel: sizeLabelOf(file.size),
          });
        }
        ok++;
      } catch {
        failed.push(file.name);
      }
    }
    if (newLessons.length) setLessons((prev) => flagDuplicateLessons([...prev, ...newLessons]));
    if (newAnnales.length) setAnnales((prev) => [...prev, ...newAnnales]);
    setIsReading(false);
    if (ok > 0)
      toast({
        title: `${ok} fichier(s) lu(s)`,
        description: target === "courses" ? "Cours extraits et prêts pour l'analyse." : "Épreuves extraites et prêtes pour l'analyse.",
      });
    if (failed.length)
      toast({
        title: "Lecture impossible",
        description: `Fichier(s) illisible(s) ou vide(s) : ${failed.join(", ")}`,
        variant: "destructive",
      });
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
    const built = picked.map((c) => buildLesson(`lib-${c.id}`, c.title, c.content, c.content.length, subjectInput));
    setLessons((prev) => flagDuplicateLessons([...prev.filter((p) => !built.some((b) => b.id === p.id)), ...built]));
    setLibraryPickerOpen(false);
    if (built.length) toast({ title: `${built.length} cours importé(s) depuis votre bibliothèque` });
  };

  // ------------------------------------------------------------------ analyse
  const handleAnalyze = async () => {
    if (!subjectInput.trim()) {
      toast({ title: "Matière manquante", description: "Précisez la matière de l'examen avant l'analyse.", variant: "destructive" });
      return;
    }
    const usable = activeLessons.filter((l) => !l.duplicateOf);
    if (usable.length === 0) {
      toast({ title: "Aucun cours", description: "Importez au moins un cours de la matière.", variant: "destructive" });
      return;
    }
    cancelRef.current = false;
    setAnalyzing(true);
    setAnalysisProgress({ phase: "lecture", message: "Préparation de l'analyse…", current: 0, total: annales.length });
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
        setSelectedLessonIds([]);
        if (result.durationMin) setDurationMin(result.durationMin);
        toast({
          title: "Analyse terminée",
          description: `${result.exams.length} épreuve(s) · jusqu'à ${result.maxQcm} QCM · ${result.quota} leçon(s) à choisir.`,
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erreur d'analyse", description: err?.message || "Analyse impossible.", variant: "destructive" });
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
      toast({ title: "Analyse requise", description: "Lancez (ou relancez) l'analyse approfondie avant de générer.", variant: "destructive" });
      return;
    }
    if (!quotaReached) return;
    const selected = activeLessons.filter((l) => selectedLessonIds.includes(l.id));
    cancelRef.current = false;
    setGenerating(true);
    setGenProgress({ phase: "redaction", message: "Préparation du plan de l'épreuve…", current: 0, total: 1 });
    try {
      const priorCount = sessions.filter((s) => s.subjectName === subjectInput.trim()).length;
      const { blocks, warnings } = await generateExamBlanc({
        ueName: ueInput.trim(),
        subjectName: subjectInput.trim(),
        selected,
        analysis,
        sessionSeed: priorCount,
        onProgress: setGenProgress,
        isCancelled: () => cancelRef.current,
      });
      if (cancelRef.current) {
        toast({ title: "Génération interrompue" });
        return;
      }
      if (blocks.length === 0) {
        toast({
          title: "Génération impossible",
          description: "Le moteur IA n'a pas répondu ou n'a produit aucun bloc valide. Vérifiez votre clé API puis réessayez.",
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
        blocks,
        answers: {},
        finished: false,
      };
      setSessions((prev) => [session, ...prev]);
      openSession(session);
      if (warnings.length)
        toast({ title: "Épreuve prête avec réserves", description: warnings.join(" "), variant: "destructive" });
      else toast({ title: "Épreuve prête ✨", description: `${blocks.reduce((s, b) => s + b.items.length, 0)} QCM générés et relus.` });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erreur de génération", description: err?.message || "Génération impossible.", variant: "destructive" });
    } finally {
      setGenerating(false);
      setGenProgress(null);
    }
  };

  const openSession = useCallback((s: ExamSession) => {
    setActiveSession(s);
    setAnswers(s.answers || {});
    setCorrectionMode(false);
    setTimerRemainingSec(s.durationMin * 60);
    setTimerRunning(!s.finished);
    setActiveView("exam");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ------------------------------------------------------------------ épreuve
  const setAnswer = (item: EBItem, letter: string) => {
    if (activeSession?.finished) return;
    setAnswers((prev) => {
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
      finished: true,
      score: { found: s.found, wrong: s.wrong, total: s.total },
    };
    setSessions((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setActiveSession(updated);
    setTimerRunning(false);
    setActiveView("library");
    toast({ title: "Épreuve enregistrée", description: `Score : ${s.found}/${s.total} — corrigé disponible dans la bibliothèque.` });
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
        difficultyLabel: "Calibre examen de faculté",
        formatLabel: "Examen Blanc",
        includeAnswerGrid: true,
        includeAnswerKey: true,
        questions: sessionToPdfQuestions(s),
      };
      await exportQuizToPDF(data, { includeAnswerKey: true, includeAnswerGrid: true, facultyName: "Faculté de Médecine, de Pharmacie et d'Odonto-Stomatologie — UCAD" });
    } catch (err) {
      console.error(err);
      toast({ title: "Erreur PDF", description: "Impossible d'exporter l'examen.", variant: "destructive" });
    }
  };

  const removeLesson = (id: string) => {
    setLessons((prev) => prev.filter((l) => l.id !== id));
    setSelectedLessonIds((prev) => prev.filter((x) => x !== id));
  };

  const resetStudio = () => {
    setLessons([]);
    setAnnales([]);
    setAnalysis(null);
    setAnalysisSignature("");
    setSelectedLessonIds([]);
    toast({ title: "Studio réinitialisé" });
  };

  // ------------------------------------------------------------------ rendu
  const progressPct = (p: AnalysisProgress | null) => (p && p.total > 0 ? Math.min(100, Math.round((p.current / p.total) * 100)) : 5);

  const renderItem = (item: EBItem) => {
    const chosen = answers[item.id] || [];
    const isMulti = item.format === "COMPLEMENT_MULTIPLE";
    const ok = isItemCorrect(item, chosen);
    return (
      <div key={item.id} id={`q-${item.id}`} className="space-y-3 scroll-mt-28">
        {item.lead && (
          <div className="px-4 py-2.5 rounded-xl bg-[#FAF8F5] border-l-2 border-[#C96442] text-sm italic">
            <strong className="not-italic text-[#C96442] mr-2">Transition clinique —</strong>
            {item.lead}
          </div>
        )}
        <div className="flex justify-between items-start gap-3">
          <p className="font-bold text-base leading-snug">
            {item.number}. {item.stem}
          </p>
          <span className="px-2 py-0.5 rounded bg-black/5 font-mono text-[10px] font-bold uppercase shrink-0 whitespace-nowrap">
            {EB_FORMAT_LABELS[item.format]}
          </span>
        </div>

        {item.statements && item.statements.length > 0 && (
          <div className="p-3.5 rounded-xl bg-[#F9F7F2] border border-black/10 space-y-1.5 text-sm">
            {item.format === "JUMELAGE" ? (
              <>
                <p>
                  <strong>1.</strong> {item.statements[0]}
                </p>
                <p className="text-center font-bold tracking-widest text-xs text-black/60">PARCE QUE</p>
                <p>
                  <strong>2.</strong> {item.statements[1]}
                </p>
              </>
            ) : (
              item.statements.map((s, i) => (
                <p key={i}>
                  <strong>{i + 1}.</strong> {s}
                </p>
              ))
            )}
          </div>
        )}

        {item.format === "QNS" ? (
          <>
            <textarea
              value={chosen[0] || ""}
              disabled={!!activeSession?.finished}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [item.id]: [e.target.value] }))}
              placeholder="Votre réponse rédigée…"
              rows={3}
              className="w-full p-3 rounded-xl border border-black/15 bg-white text-sm focus:outline-none focus:border-black/40"
            />
            {revealed && (
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs leading-relaxed">
                <strong className="text-[#1B7354] font-mono">Réponse attendue :</strong>
                <p>{item.explanation}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="space-y-2">
              {item.options.map((opt) => {
                const picked = chosen.includes(opt.letter);
                const isKey = item.correct.includes(opt.letter);
                let style = picked ? "border-black bg-black/[0.04]" : "border-black/15 bg-white hover:bg-black/5";
                if (revealed) {
                  if (isKey) style = "border-[#1B7354] bg-[#1B7354]/10 font-semibold";
                  else if (picked) style = "border-[#BA392D] bg-[#BA392D]/10 text-[#BA392D]";
                  else style = "border-black/5 opacity-50";
                }
                return (
                  <button
                    type="button"
                    key={opt.letter}
                    onClick={() => setAnswer(item, opt.letter)}
                    className={`w-full text-left p-3 rounded-xl border flex items-center justify-between gap-3 text-sm transition-all cursor-pointer ${style}`}
                  >
                    <span className="flex items-start gap-3 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-${isMulti ? "md" : "full"} border font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
                          picked && !revealed ? "bg-black text-white border-black" : ""
                        }`}
                      >
                        {opt.letter}
                      </span>
                      <span className="pt-0.5">{opt.text}</span>
                    </span>
                    {revealed && isKey && <span className="text-xs font-mono font-bold text-[#1B7354] shrink-0">✓ Clé</span>}
                  </button>
                );
              })}
            </div>
            {isMulti && !revealed && <p className="text-[11px] text-black/50">Plusieurs réponses possibles — cochez toutes les propositions exactes.</p>}
            {revealed && (
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs leading-relaxed space-y-1">
                <strong className={`font-mono ${chosen.length === 0 ? "text-black/60" : ok ? "text-[#1B7354]" : "text-[#BA392D]"}`}>
                  {chosen.length === 0 ? "Non répondu" : ok ? "✓ Exact" : "✗ Inexact"} — Réponse : {item.correct.join(", ")}
                </strong>
                <p>{item.explanation}</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const runningProgress = analyzing ? analysisProgress : generating ? genProgress : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#121316] font-sans antialiased">
      <input
        ref={coursesInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.txt,.pptx,.ppt,.md,.rtf,.odt"
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
        accept=".pdf,.docx,.doc,.txt,.rtf,.odt,.md"
        onChange={(e) => {
          ingestFiles(e.target.files, "annales");
          e.target.value = "";
        }}
        className="hidden"
      />

      {/* BARRE SUPÉRIEURE */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/92 backdrop-blur-md border-b border-[#121316]/[0.08] px-4 sm:px-8 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#121316] text-[#FAF8F5] flex items-center justify-center font-bold text-sm shadow-sm shrink-0">D</div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-base sm:text-lg tracking-tight whitespace-nowrap">Examen Blanc</span>
            <span className="text-black/20">/</span>
            <span className="text-xs font-medium text-[#4A4D54] truncate max-w-[140px] sm:max-w-[260px]">
              {activeView === "studio" ? "Studio & Analyse" : activeView === "library" ? "Bibliothèque" : activeSession?.title || "Épreuve"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setHowItWorksOpen(true)}
            className="w-6 h-6 rounded-full border border-black/15 bg-white text-xs font-bold text-[#4A4D54] hover:bg-[#121316] hover:text-white transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            title="Comment fonctionne l'Examen Blanc ?"
          >
            ?
          </button>
          <button
            type="button"
            onClick={() => setEngineInspectorOpen(true)}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-[#1B7354]/30 bg-[#1B7354]/10 text-[#1B7354] font-mono text-[10.5px] font-bold cursor-pointer hover:bg-[#1B7354]/15 transition-colors whitespace-nowrap"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Moteur universel actif
          </button>
        </div>
        <nav className="flex items-center p-1 rounded-xl bg-[#EDE8E0] text-xs font-semibold shrink-0">
          {(["studio", "library", "exam"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                if (v === "exam" && !activeSession) {
                  toast({ title: "Aucune épreuve ouverte", description: "Générez un examen blanc ou ouvrez-en un depuis la bibliothèque." });
                  setActiveView("library");
                  return;
                }
                setActiveView(v);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeView === v ? "bg-white text-black shadow-sm" : "text-[#4A4D54] hover:text-black"
              }`}
            >
              {v === "studio" ? "Studio & Analyse" : v === "library" ? "Bibliothèque" : "Feuille d'Examen"}
            </button>
          ))}
        </nav>
      </header>

      {/* CAPSULE FLOTTANTE DU MINUTEUR */}
      {activeView === "exam" && activeSession && (
        <div
          className={`fixed top-20 right-5 z-40 rounded-2xl bg-[#121316]/95 text-white px-4 py-2.5 flex items-center gap-3 transition-all duration-300 shadow-2xl border border-white/10 ${
            timerDetached ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0 pointer-events-none"
          }`}
        >
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2 pr-2 border-r border-white/15 cursor-pointer">
            <span className={`w-2 h-2 rounded-full ${timerRunning ? "bg-[#C96442] animate-ping" : "bg-white/40"}`} />
            <span className="font-mono text-sm font-bold tracking-wider">{formatClock(timerRemainingSec)}</span>
          </button>
          <div className="flex items-center gap-1.5 text-xs">
            <button type="button" onClick={() => setTimerRunning(!timerRunning)} className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 cursor-pointer">
              {timerRunning ? "Pause" : "Reprendre"}
            </button>
            {!activeSession.finished && (
              <button type="button" onClick={finishAndSave} className="px-2.5 py-0.5 rounded bg-[#C96442] hover:bg-[#b05333] font-semibold cursor-pointer">
                Terminer
              </button>
            )}
          </div>
        </div>
      )}

      {/* VOLET GAUCHE */}
      {activeView === "exam" && activeSession && (
        <>
          <button
            type="button"
            onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-40 pl-2 pr-3 py-3 rounded-r-2xl bg-[#121316] text-white shadow-xl flex flex-col items-center gap-1 text-xs font-bold cursor-pointer hover:bg-[#C96442] transition-colors"
          >
            <span>{leftDrawerOpen ? "‹" : "›"}</span>
            <span className="font-mono text-[10px]">
              {examStats.answered}/{examStats.total}
            </span>
          </button>
          <aside
            className={`fixed left-4 top-24 bottom-6 w-72 z-40 rounded-3xl bg-white/95 backdrop-blur-xl border border-black/10 shadow-2xl p-5 flex flex-col justify-between transition-transform duration-300 ${
              leftDrawerOpen ? "translate-x-0" : "-translate-x-80 pointer-events-none"
            }`}
          >
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="flex items-center justify-between pb-3 border-b border-black/10">
                <span className="font-bold text-sm">Navigation & Jauge</span>
                <button type="button" onClick={() => setLeftDrawerOpen(false)} className="text-xs text-black/50 hover:text-black cursor-pointer p-1">✕</button>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-black/5 space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Avancement</span>
                  <span>{examStats.pct}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div className="bg-[#121316] h-full transition-all duration-300" style={{ width: `${examStats.pct}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-1 pt-1 text-center font-mono text-[11px]">
                  <div className="p-1 rounded bg-white font-bold border border-black/5">{examStats.answered} rép.</div>
                  <div className="p-1 rounded bg-white font-bold border border-black/5">{examStats.remaining} rest.</div>
                  <div className={`p-1 rounded bg-white font-bold border border-black/5 ${revealed ? "text-[#1B7354]" : "text-black/30"}`}>
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
                    if (revealed && has && it.format !== "QNS") cls = isItemCorrect(it, a) ? "bg-[#1B7354] text-white border-[#1B7354]" : "bg-[#BA392D] text-white border-[#BA392D]";
                    else if (has) cls = "bg-[#121316] text-white border-[#121316]";
                    return (
                      <button
                        type="button"
                        key={it.id}
                        onClick={() => {
                          document.getElementById(`q-${it.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
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
              <button type="button" onClick={() => exportSessionPdf(activeSession)} className="w-full py-2 rounded-xl border border-black/15 bg-white hover:bg-black/5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                <Download className="w-3.5 h-3.5" /> Télécharger en PDF
              </button>
              {!activeSession.finished && (
                <button type="button" onClick={finishAndSave} className="w-full py-2.5 rounded-xl bg-[#121316] hover:bg-[#C96442] text-white text-xs font-bold transition-colors cursor-pointer">
                  Terminer & Enregistrer
                </button>
              )}
            </div>
          </aside>
        </>
      )}

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8">
        {/* ================= VUE 1 : STUDIO & ANALYSE ================= */}
        {activeView === "studio" && (
          <div className="space-y-6">
            {/* ÉTAPE 1 */}
            <section className="bg-white rounded-2xl border border-black/10 p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-lg">1. Unité d'Enseignement & matière de l'examen</h2>
                <button type="button" onClick={resetStudio} className="text-xs text-black/50 hover:text-red-600 flex items-center gap-1 cursor-pointer">
                  <RotateCcw className="w-3 h-3" /> Réinitialiser
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-black/70 mb-1">Unité d'Enseignement (UE)</label>
                  <input value={ueInput} onChange={(e) => setUeInput(e.target.value)} placeholder="Ex : UE Néphro-Urologie" className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/15 text-sm font-semibold focus:outline-none focus:bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black/70 mb-1">Matière sur laquelle porte l'examen</label>
                  <input value={subjectInput} onChange={(e) => setSubjectInput(e.target.value)} placeholder="Ex : Néphrologie" className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/15 text-sm font-semibold focus:outline-none focus:bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black/70 mb-1">Durée de l'épreuve</label>
                  <select value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value, 10))} className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/15 text-sm font-semibold focus:outline-none cursor-pointer">
                    {Array.from(new Set([...DURATION_CHOICES, durationMin])).sort((a, b) => a - b).map((d) => (
                      <option key={d} value={d}>
                        {Math.floor(d / 60) > 0 ? `${Math.floor(d / 60)}h${String(d % 60).padStart(2, "0")}` : `${d} min`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-black/55">
                Une UE peut contenir plusieurs matières : seule la partie de vos fichiers qui concerne la matière indiquée est analysée.
              </p>
            </section>

            {/* ÉTAPE 2 */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-black/10 p-5 space-y-3 shadow-sm flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-sm">2. Les cours de la matière</h3>
                      <p className="text-[11px] text-black/50">Upload de masse : PDF, DOCX, PPTX, TXT…</p>
                    </div>
                    <span className="text-xs font-mono text-black/60 bg-[#FAF8F5] px-2 py-0.5 rounded border border-black/10">{lessons.length} fichiers</span>
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {activeLessons.length === 0 && <p className="text-xs text-black/40 py-4 text-center">Aucun cours importé.</p>}
                    {activeLessons.map((c) => (
                      <div key={c.id} className="p-2.5 rounded-xl bg-[#FAF8F5] border border-black/5 flex justify-between items-center text-xs gap-2">
                        <div className="min-w-0">
                          <span className="font-medium block truncate" title={c.title}>{cleanLessonTitle(c.title)}</span>
                          <span className="text-[10px] text-black/45 font-mono">
                            {c.wordCount.toLocaleString("fr-FR")} mots · {c.sizeLabel}
                            {c.duplicateOf ? " · doublon ignoré" : c.relevance === 0 && subjectInput.trim() ? " · matière non repérée" : ""}
                          </span>
                        </div>
                        <button type="button" onClick={() => removeLesson(c.id)} className="text-black/40 hover:text-red-500 p-1 cursor-pointer shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button type="button" disabled={isReading} onClick={() => coursesInputRef.current?.click()} className="py-2.5 rounded-xl border border-dashed border-black/25 bg-[#FAF8F5] hover:bg-black/5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                    {isReading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Importer des cours
                  </button>
                  <button type="button" onClick={openLibraryPicker} className="py-2.5 rounded-xl border border-black/15 bg-white hover:bg-black/5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                    <LibraryIcon className="w-3.5 h-3.5" /> Ma bibliothèque
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-black/10 p-5 space-y-3 shadow-sm flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-sm">Examens et évaluations</h3>
                      <p className="text-[11px] text-black/50">Toutes les épreuves de l'UE correspondante</p>
                    </div>
                    <span className="text-xs font-mono text-black/60 bg-[#FAF8F5] px-2 py-0.5 rounded border border-black/10">{annales.length} épreuves</span>
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {annales.length === 0 && <p className="text-xs text-black/40 py-4 text-center">Aucune épreuve importée.</p>}
                    {annales.map((a) => (
                      <div key={a.id} className="p-2.5 rounded-xl bg-[#FAF8F5] border border-black/5 flex justify-between items-center text-xs gap-2">
                        <div className="min-w-0">
                          <span className="font-medium block truncate" title={a.title}>{a.title}</span>
                          <span className="text-[10px] text-black/45 font-mono">{a.year || "année ?"} · {a.wordCount.toLocaleString("fr-FR")} mots</span>
                        </div>
                        <button type="button" onClick={() => setAnnales((prev) => prev.filter((x) => x.id !== a.id))} className="text-black/40 hover:text-red-500 p-1 cursor-pointer shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
                <button type="button" disabled={isReading} onClick={() => annalesInputRef.current?.click()} className="w-full py-2.5 mt-2 rounded-xl border border-dashed border-black/25 bg-[#FAF8F5] hover:bg-black/5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                  {isReading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Importer des épreuves
                </button>
              </div>
            </section>

            {/* ÉTAPE 3 : ANALYSE */}
            <section className="bg-white rounded-2xl border border-black/10 p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base">3. Analyse approfondie des épreuves</h3>
                  <p className="text-xs text-black/60 max-w-xl">
                    Lecture épreuve par épreuve, ligne par ligne : une leçon est « sortie » uniquement si elle fait l'objet du cas clinique ou de l'énoncé — jamais pour une simple mention dans une proposition.
                  </p>
                </div>
                {analyzing ? (
                  <button type="button" onClick={() => (cancelRef.current = true)} className="px-4 py-2 rounded-xl border border-black/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-black/5">
                    <Square className="w-3 h-3" /> Interrompre
                  </button>
                ) : (
                  <button type="button" onClick={handleAnalyze} disabled={generating} className="px-5 py-2.5 rounded-xl bg-[#121316] hover:bg-[#C96442] text-white text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50">
                    <Sparkles className="w-3.5 h-3.5" /> {analysis ? "Relancer l'analyse" : "Lancer l'analyse"}
                  </button>
                )}
              </div>

              {analyzing && analysisProgress && (
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-black/10 space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />{analysisProgress.message}</span>
                    <span className="font-mono">{Math.min(analysisProgress.current + 1, analysisProgress.total)}/{analysisProgress.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div className="h-full bg-[#121316] transition-all duration-500" style={{ width: `${progressPct(analysisProgress)}%` }} />
                  </div>
                </div>
              )}

              {analysisStale && (
                <div className="p-3 rounded-xl bg-[#C96442]/10 border border-[#C96442]/30 text-xs text-[#9a4a2e] font-semibold">
                  Les fichiers ou la matière ont changé depuis la dernière analyse : relancez l'analyse pour actualiser les résultats.
                </div>
              )}

              {analysis && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { k: "Épreuves analysées", v: analysis.exams.filter((e) => e.questionCount > 0).length },
                      { k: "QCM max (référence)", v: analysis.maxQcm },
                      { k: "Leçons / épreuve (moy.)", v: analysis.avgLessonsPerExam || "—" },
                      { k: "Quota à choisir", v: analysis.quota },
                    ].map((c) => (
                      <div key={c.k} className="p-3.5 rounded-xl bg-[#FAF8F5] border border-black/10">
                        <div className="text-[11px] text-black/55 font-semibold">{c.k}</div>
                        <div className="text-2xl font-bold font-mono">{c.v}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs font-bold mr-1">Formats détectés :</span>
                    {Object.entries(analysis.formatDistribution).length === 0 && <span className="text-xs text-black/50">aucun</span>}
                    {Object.entries(analysis.formatDistribution).map(([f, n]) => (
                      <span key={f} className="px-2 py-0.5 rounded bg-white border border-black/10 font-mono text-[10px] font-semibold">
                        {EB_FORMAT_LABELS[f as keyof typeof EB_FORMAT_LABELS]} × {n}
                      </span>
                    ))}
                  </div>

                  {analysis.warnings.length > 0 && (
                    <ul className="space-y-1 text-[11px] text-[#9a4a2e] bg-[#C96442]/5 border border-[#C96442]/20 rounded-xl p-3 list-disc list-inside">
                      {analysis.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-black/60">Détail par épreuve</h4>
                    {analysis.exams.map((e) => {
                      const open = expandedExamId === e.examId;
                      return (
                        <div key={e.examId} className="rounded-xl border border-black/10 overflow-hidden">
                          <button type="button" onClick={() => setExpandedExamId(open ? null : e.examId)} className="w-full p-3 flex items-center justify-between gap-3 text-left bg-[#FAF8F5] hover:bg-black/[0.04] cursor-pointer">
                            <span className="min-w-0">
                              <span className="block text-xs font-bold truncate">{e.title}</span>
                              <span className="block text-[10.5px] text-black/50 font-mono">
                                {e.questionCount} QCM · {e.caseCount} cas clinique(s) · {e.lessonsUsed.length} leçon(s){e.audited ? " · audité IA" : ""}
                              </span>
                            </span>
                            {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                          </button>
                          {open && (
                            <div className="p-3 space-y-2 text-xs bg-white">
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(e.formatCounts).map(([f, n]) => (
                                  <span key={f} className="px-2 py-0.5 rounded bg-[#FAF8F5] border border-black/10 font-mono text-[10px]">
                                    {EB_FORMAT_LABELS[f as keyof typeof EB_FORMAT_LABELS]} × {n}
                                  </span>
                                ))}
                              </div>
                              <p className="text-black/60">
                                Leçons sorties :{" "}
                                {e.lessonsUsed.length
                                  ? e.lessonsUsed.map((id) => analysis.lessonStats.find((s) => s.lessonId === id)?.title || id).join(" · ")
                                  : "aucune correspondance détectée"}
                              </p>
                              {e.questionCount === 0 && <p className="text-[#BA392D]">Aucune question numérotée repérée dans ce fichier.</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* ÉTAPE 4 : CHOIX DES LEÇONS */}
            {analysis && !analysisStale && (
              <section className="bg-white rounded-2xl border border-black/10 p-6 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-black/10">
                  <div>
                    <h3 className="font-bold text-base">4. Choisissez vos {quota} leçon{quota > 1 ? "s" : ""} d'évaluation</h3>
                    <p className="text-xs text-black/60">Classées par pourcentage de sortie. Le reste devient flou dès que le quota est atteint.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setProbSortOrder(probSortOrder === "desc" ? "asc" : "desc")} className="p-1.5 rounded-lg border border-black/15 bg-[#FAF8F5] hover:bg-white text-xs font-semibold flex items-center gap-1 cursor-pointer">
                      <ArrowUpDown className="w-3 h-3" /> {probSortOrder === "desc" ? "Plus fréquentes d'abord" : "Moins fréquentes d'abord"}
                    </button>
                    <div className={`px-3 py-1 rounded-xl font-mono text-xs font-bold border whitespace-nowrap ${quotaReached ? "bg-[#1B7354]/10 text-[#1B7354] border-[#1B7354]/30" : "bg-[#C96442]/10 text-[#C96442] border-[#C96442]/30"}`}>
                      {selectedLessonIds.length} / {quota} {quotaReached ? "✓ Complet" : ""}
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
                          blurred ? "blur-[2px] opacity-35 pointer-events-none bg-[#FAF8F5] border-black/10" : isSel ? "bg-white border-black shadow-sm ring-1 ring-black/10" : "bg-[#FAF8F5] hover:bg-white border-black/10"
                        }`}
                      >
                        <div className="p-3.5 flex items-center justify-between gap-2 cursor-pointer" onClick={() => toggleLesson(st.lessonId)}>
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold shrink-0 ${isSel ? "bg-black text-white border-black" : "bg-white border-black/20"}`}>{isSel ? "✓" : ""}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold truncate">{st.title}</div>
                              <div className="text-[10.5px] text-black/50 font-mono">
                                {st.timesOut} sortie{st.timesOut > 1 ? "s" : ""} · {st.examsAppeared}/{st.totalExams} épreuves · {st.totalQcm} QCM
                              </div>
                              <div className="h-1 rounded-full bg-black/10 mt-1.5 overflow-hidden">
                                <div className="h-full bg-[#121316]" style={{ width: `${st.percent}%` }} />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="font-mono text-xs font-bold">{st.percent}%</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedLessonId(expanded ? null : st.lessonId);
                              }}
                              className="p-1 rounded hover:bg-black/5 cursor-pointer"
                              title="Détail des sorties"
                            >
                              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        {expanded && (
                          <div className="px-3.5 pb-3 text-[11px] space-y-1 border-t border-black/5 pt-2">
                            {st.perExam.length === 0 && <p className="text-black/50">Jamais sortie dans les épreuves analysées.</p>}
                            {st.perExam.map((p) => (
                              <div key={p.examId} className="flex justify-between gap-2">
                                <span className="truncate">{p.examTitle}{p.weak ? " (attribution faible)" : ""}</span>
                                <span className="font-mono shrink-0">{p.blocks} bloc(s) · {p.qcm} QCM</span>
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

            {/* BOUTON FINAL */}
            <div className="flex flex-col items-center gap-3 pt-2">
              {generating && genProgress && (
                <div className="w-full max-w-xl p-4 rounded-xl bg-white border border-black/10 space-y-2 shadow-sm">
                  <div className="flex justify-between text-xs font-semibold gap-3">
                    <span className="flex items-center gap-2 min-w-0"><Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /><span className="truncate">{genProgress.message}</span></span>
                    <span className="font-mono shrink-0">{Math.min(genProgress.current + 1, genProgress.total)}/{genProgress.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div className="h-full bg-[#C96442] transition-all duration-500" style={{ width: `${progressPct(genProgress)}%` }} />
                  </div>
                  <button type="button" onClick={() => (cancelRef.current = true)} className="text-[11px] text-black/50 hover:text-black underline cursor-pointer">Annuler la génération</button>
                </div>
              )}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!analysis || analysisStale || !quotaReached || generating || analyzing}
                className={`px-8 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-md flex items-center gap-2 ${
                  analysis && !analysisStale && quotaReached && !generating && !analyzing ? "bg-[#121316] hover:bg-[#C96442] text-white active:scale-95 cursor-pointer" : "bg-black/10 text-black/40 cursor-not-allowed"
                }`}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Rédaction & relecture en cours…
                  </>
                ) : !analysis ? (
                  "Lancez d'abord l'analyse"
                ) : analysisStale ? (
                  "Relancez l'analyse"
                ) : quotaReached ? (
                  <>Générer l'examen blanc ({subjectInput}) →</>
                ) : (
                  `Sélectionnez encore ${quota - selectedLessonIds.length} leçon(s)`
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
                <p className="text-xs text-black/60 mt-0.5">Historique de vos simulations, scores et corrigés.</p>
              </div>
              <button type="button" onClick={() => setActiveView("studio")} className="px-4 py-2 rounded-xl bg-[#121316] hover:bg-[#C96442] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                <Plus className="w-3.5 h-3.5" /> Nouvel examen blanc
              </button>
            </div>
            {sessions.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-black/10 space-y-3">
                <BookOpen className="w-10 h-10 mx-auto text-black/30" />
                <h3 className="font-bold text-base">Aucun examen blanc</h3>
                <p className="text-xs text-black/60 max-w-sm mx-auto">Rendez-vous dans le Studio : importez vos cours et vos épreuves, lancez l'analyse puis générez votre première épreuve.</p>
                <button type="button" onClick={() => setActiveView("studio")} className="px-4 py-2 rounded-xl bg-black text-white text-xs font-bold cursor-pointer">Ouvrir le Studio</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessions.map((s) => {
                  const total = s.blocks.reduce((n, b) => n + b.items.length, 0);
                  return (
                    <div key={s.id} onClick={() => openSession(s)} className="p-5 rounded-2xl bg-white border border-black/10 hover:border-black/30 shadow-sm cursor-pointer flex flex-col justify-between gap-4 group transition-all min-w-0">
                      <div className="space-y-2.5 min-w-0">
                        <div className="flex justify-between items-center gap-2 text-xs text-black/50 font-mono">
                          <span className="px-2 py-0.5 rounded bg-[#FAF8F5] font-bold text-black border border-black/5 whitespace-nowrap truncate max-w-[60%]">{s.lessonTitles.length} leçon{s.lessonTitles.length > 1 ? "s" : ""}</span>
                          <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0"><Clock className="w-3 h-3" />{formatSessionDate(s.createdAt)}</span>
                        </div>
                        <h3 className="font-bold text-base leading-snug group-hover:text-[#C96442] transition-colors line-clamp-2">{s.title}</h3>
                        <p className="text-xs text-black/60 line-clamp-2">{s.subtitle}</p>
                        {s.score && (
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-[#1B7354]/10 text-[#1B7354] font-bold">✓ {s.score.found}/{s.score.total}</span>
                            <span className="text-black/60">{Math.round((s.score.found / (s.score.total || 1)) * 100)}%</span>
                          </div>
                        )}
                      </div>
                      <div className="pt-3 border-t border-black/5 flex justify-between items-center text-xs font-semibold">
                        <span className="text-black/70 whitespace-nowrap">{total} QCM</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={(e) => exportSessionPdf(s, e)} className="p-1.5 rounded-lg hover:bg-black/5 text-black/60 hover:text-black cursor-pointer" title="Exporter en PDF"><Download className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={(e) => deleteSession(s.id, e)} className="p-1.5 rounded-lg hover:bg-rose-50 text-black/40 hover:text-rose-600 cursor-pointer" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                          <span className="text-[#C96442] flex items-center gap-0.5 whitespace-nowrap">{s.finished ? "Revoir" : "Passer"} <ChevronRight className="w-3.5 h-3.5" /></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= VUE 3 : FEUILLE D'EXAMEN ================= */}
        {activeView === "exam" && activeSession && (
          <div className="space-y-6">
            <div ref={originStationRef} className="bg-white rounded-2xl border border-black/10 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-xl bg-[#121316] text-white font-mono text-base font-bold flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${timerRunning ? "bg-[#C96442] animate-ping" : "bg-white/40"}`} />
                  {formatClock(timerRemainingSec)}
                </div>
                <div className="flex items-center p-1 rounded-xl bg-[#EDE8E0] text-xs font-mono font-bold">
                  {[60, 120].map((m) => (
                    <button key={m} type="button" disabled={activeSession.finished} onClick={() => setTimerRemainingSec(m * 60)} className="px-2.5 py-1 rounded-lg cursor-pointer text-black/70 hover:bg-white disabled:opacity-40">
                      {m / 60}h00
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold flex-wrap">
                <button type="button" onClick={() => setTimerRunning(!timerRunning)} disabled={activeSession.finished} className="px-3 py-1.5 rounded-xl border border-black/15 bg-[#FAF8F5] hover:bg-black/5 cursor-pointer flex items-center gap-1.5 disabled:opacity-40">
                  {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} {timerRunning ? "Pause" : "Reprendre"}
                </button>
                <button type="button" onClick={() => setCorrectionMode(!correctionMode)} className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${revealed ? "bg-[#1B7354] text-white" : "border border-black/15 bg-[#FAF8F5] hover:bg-black/5"}`}>
                  {revealed ? "✓ Corrigé affiché" : "Mode correction"}
                </button>
                <button type="button" onClick={() => exportSessionPdf(activeSession)} className="px-3 py-1.5 rounded-xl border border-black/15 bg-[#FAF8F5] hover:bg-black/5 flex items-center gap-1 cursor-pointer">
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
                {!activeSession.finished && (
                  <button type="button" onClick={finishAndSave} className="px-4 py-1.5 rounded-xl bg-[#C96442] hover:bg-[#b05333] text-white cursor-pointer">Terminer</button>
                )}
              </div>
            </div>

            <article className="bg-white rounded-3xl border border-black/10 p-6 sm:p-12 space-y-8 shadow-md">
              <header className="border-b-2 border-black pb-6 text-center space-y-1.5 font-serif">
                <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider">Université Cheikh Anta Diop de Dakar</h2>
                <div className="text-xs sm:text-sm text-black/70">Faculté de Médecine, de Pharmacie et d'Odonto-Stomatologie</div>
                {activeSession.ueName && <div className="text-xs text-black/60">{activeSession.ueName}</div>}
                <div className="pt-2">
                  <span className="inline-block px-4 py-1 border border-black font-semibold uppercase text-xs sm:text-sm tracking-wide">
                    {activeSession.subjectName} — {activeSession.title}
                  </span>
                </div>
              </header>

              <div className="space-y-10">
                {activeSession.blocks.map((b) => (
                  <section key={b.id} className="space-y-6 pt-8 border-t border-black/10 first:border-t-0 first:pt-0">
                    {b.kind === "CAS_CLINIQUE" && (
                      <div className="p-5 rounded-2xl bg-[#F9F7F2] border-l-4 border-black text-sm leading-relaxed space-y-1">
                        <span className="font-bold uppercase text-xs tracking-wider block text-black/70">{b.header || "Cas clinique"}</span>
                        <p>{b.vignette}</p>
                      </div>
                    )}
                    {b.items.map((it) => renderItem(it))}
                  </section>
                ))}
              </div>
            </article>
          </div>
        )}
      </main>

      {/* MODAL BIBLIOTHÈQUE */}
      {libraryPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-black/10">
              <h3 className="font-bold text-base">Importer depuis ma bibliothèque</h3>
              <button type="button" onClick={() => setLibraryPickerOpen(false)} className="text-sm font-bold text-black/50 hover:text-black cursor-pointer p-1">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {libraryCourses.length === 0 && <p className="text-xs text-black/50 py-6 text-center">Aucun cours enregistré dans votre bibliothèque.</p>}
              {libraryCourses.map((c) => {
                const on = libraryPicked.includes(c.id);
                return (
                  <label key={c.id} className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs cursor-pointer ${on ? "border-black bg-black/[0.03]" : "border-black/10 hover:bg-black/[0.03]"}`}>
                    <input type="checkbox" checked={on} onChange={() => setLibraryPicked((prev) => (on ? prev.filter((x) => x !== c.id) : [...prev, c.id]))} />
                    <span className="truncate font-medium">{c.title}</span>
                  </label>
                );
              })}
            </div>
            <button type="button" disabled={libraryPicked.length === 0} onClick={importFromLibrary} className="w-full py-2.5 rounded-xl bg-black text-white text-xs font-bold cursor-pointer disabled:opacity-40">
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
              <h3 className="font-bold text-base">Fonctionnement de l'Examen Blanc</h3>
              <button type="button" onClick={() => setHowItWorksOpen(false)} className="text-sm font-bold text-black/50 hover:text-black cursor-pointer p-1">✕</button>
            </div>
            <ol className="text-xs text-[#4A4D54] leading-relaxed space-y-2 list-decimal list-inside">
              <li>Indiquez l'UE et la matière : seule la partie de vos fichiers qui concerne cette matière est lue.</li>
              <li>Importez en masse vos cours et vos épreuves de l'UE.</li>
              <li>L'analyse lit chaque épreuve ligne par ligne. Une leçon est « sortie » seulement si elle fait l'objet d'un cas clinique ou d'un énoncé — pas si elle apparaît dans une proposition.</li>
              <li>Vous obtenez le classement des leçons (% de sortie, épreuves, QCM), les formats réels (cas cliniques, élections, censures, groupages…), le nombre maximal de QCM et le quota moyen de leçons.</li>
              <li>Choisissez vos leçons : le reste se floute. L'épreuve est rédigée dans le style exact des professeurs, relue par un second modèle, puis vérifiée avant affichage. Chaque session est totalement nouvelle.</li>
            </ol>
            <button type="button" onClick={() => setHowItWorksOpen(false)} className="w-full py-2.5 rounded-xl bg-black text-white text-xs font-bold cursor-pointer">Compris</button>
          </div>
        </div>
      )}

      {/* MODAL INSPECTEUR */}
      {engineInspectorOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF8F5] rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center pb-3 border-b border-black/10">
              <h3 className="font-bold text-base font-mono">Moteur universel (EXAMEN_BLANC_SYSTEM_PROMPT)</h3>
              <button type="button" onClick={() => setEngineInspectorOpen(false)} className="text-sm font-bold text-black/50 hover:text-black cursor-pointer p-1">✕</button>
            </div>
            <pre className="p-4 rounded-2xl bg-[#121316] text-white font-mono text-[11px] overflow-auto whitespace-pre-wrap flex-1">
              {analysis || ueInput || subjectInput
                ? fillSystemPrompt(ueInput, subjectInput, quota || 0)
                : EXAMEN_BLANC_SYSTEM_PROMPT}
            </pre>
            <button type="button" onClick={() => setEngineInspectorOpen(false)} className="w-full py-2.5 rounded-xl bg-black text-white text-xs font-bold cursor-pointer">Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamenBlanc;
