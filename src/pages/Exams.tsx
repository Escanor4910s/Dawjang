import { untypedTable } from "@/lib/untypedDb";
// src/pages/Exams.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Clock,
  Flag,
  Play,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  EyeOff,
  ShieldCheck,
  Layers,
  BookOpen,
  Sliders,
  Check,
  Sparkles,
  FileCheck2,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSavedQuizDecks, QuizDeck } from "./Quiz";
import { recordQcmQuestionAttempt } from "@/lib/flashcards/qcmErrorMatcher";
import { DawJangDragonIcon } from "@/components/landing/HippocampusLogo";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ExamProposition {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

interface ExamQuestionItem {
  id: string;
  deckTitle: string;
  subject: string;
  questionPrompt: string;
  propositions: ExamProposition[];
  explanation: string;
}

const FALLBACK_EXAM_QUESTIONS: ExamQuestionItem[] = [
  {
    id: "ex-mi-1",
    deckTitle: "Généralités — Infections",
    subject: "Maladies Infectieuses",
    questionPrompt:
      "Laquelle des propositions définit correctement une infection selon le cours ?",
    propositions: [
      {
        id: "A",
        label: "A",
        text: "Pénétration et multiplication active d'un micro-organisme pathogène dans un hôte avec réponse immunitaire et/ou signes cliniques",
        isCorrect: true,
      },
      {
        id: "B",
        label: "B",
        text: "Colonisation d'un organe par un agent infectieux, toujours symptomatique dès la pénétration",
        isCorrect: false,
      },
      {
        id: "C",
        label: "C",
        text: "Maladie obligatoirement due à une bactérie, caractérisée par une fièvre constante",
        isCorrect: false,
      },
      {
        id: "D",
        label: "D",
        text: "Présence d'un micro-organisme sur une surface corporelle, sans multiplication et sans réponse de l'hôte",
        isCorrect: false,
      },
      {
        id: "E",
        label: "E",
        text: "Réaction inflammatoire non liée à un agent infectieux, sans implication de la réponse immunitaire",
        isCorrect: false,
      },
    ],
    explanation:
      "Une infection implique la pénétration et la multiplication d'un agent pathogène entraînant une réaction de l'hôte, contrairement à la simple colonisation asymptomatique.",
  },
  {
    id: "ex-mi-2",
    deckTitle: "Généralités — Infections",
    subject: "Maladies Infectieuses",
    questionPrompt:
      "Parmi les éléments suivants, lesquels constituent des facteurs favorisant l'émergence et la réémergence des maladies infectieuses ?",
    propositions: [
      {
        id: "A",
        label: "A",
        text: "Mutations génétiques microbiennes et acquisition de résistances aux anti-infectieux",
        isCorrect: true,
      },
      {
        id: "B",
        label: "B",
        text: "Urbanisation rapide, forte densité démographique et précarité",
        isCorrect: true,
      },
      {
        id: "C",
        label: "C",
        text: "Intensification des voyages internationaux et échanges commerciaux",
        isCorrect: true,
      },
      {
        id: "D",
        label: "D",
        text: "Changements climatiques, déforestation et rapprochement avec les réservoirs animaux",
        isCorrect: true,
      },
      {
        id: "E",
        label: "E",
        text: "Stabilité génétique absolue des virus et des bactéries dans l'environnement",
        isCorrect: false,
      },
    ],
    explanation:
      "Les 4 grands facteurs d'émergence associent l'adaptation microbienne (antibiorésistance), la démographie humaine, la mobilité internationale et les bouleversements écologiques.",
  },
  {
    id: "ex-mi-3",
    deckTitle: "Généralités — Infections",
    subject: "Maladies Infectieuses",
    questionPrompt:
      "Quelles propositions caractérisent la transmission indirecte d'une maladie infectieuse ?",
    propositions: [
      {
        id: "A",
        label: "A",
        text: "Elle nécessite un intermédiaire inerte (eau, aliments, objets souillés) ou un vecteur animé",
        isCorrect: true,
      },
      {
        id: "B",
        label: "B",
        text: "La transmission vectorielle par un arthropode hématophage (Anophèle, Aedes) est une transmission indirecte active",
        isCorrect: true,
      },
      {
        id: "C",
        label: "C",
        text: "Les maladies liées au péril fécal (eau et mains sales) relèvent d'une transmission indirecte passive",
        isCorrect: true,
      },
      {
        id: "D",
        label: "D",
        text: "Elle s'effectue exclusivement par contact cutané direct d'individu à individu sans support",
        isCorrect: false,
      },
    ],
    explanation:
      "Contrairement à la transmission directe (gouttelettes, contact immédiat), la transmission indirecte passe par un véhicule inerte (eau, aliments) ou un vecteur biologique.",
  },
];

export default function Exams() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Phases : "setup" (Configuration), "running" (Station d'examen épurée), "report" (Correction détaillée)
  const [phase, setPhase] = useState<"setup" | "running" | "report">("setup");

  // Banque de QCM réels de l'utilisateur
  const [availableDecks, setAvailableDecks] = useState<QuizDeck[]>(getSavedQuizDecks);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("ALL");
  const [durationMinutes, setDurationMinutes] = useState<number>(20);
  const [strictLockMode, setStrictLockMode] = useState<boolean>(false);

  // Questions actives de l'examen
  const [examQuestions, setExamQuestions] = useState<ExamQuestionItem[]>(
    FALLBACK_EXAM_QUESTIONS
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(20 * 60);
  const [answersByQuestion, setAnswersByQuestion] = useState<
    Record<string, string[]>
  >({});
  const [eliminatedByQuestion, setEliminatedByQuestion] = useState<
    Record<string, string[]>
  >({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<string[]>([]);

  // Chargement des QCM depuis localStorage + Supabase
  useEffect(() => {
    const loadDecks = async () => {
      const decks = [...getSavedQuizDecks()];

      try {
        const { data: sbQuizzes } = await untypedTable("quizzes")
          .select("*")
          .limit(50);

        if (sbQuizzes && Array.isArray(sbQuizzes) && sbQuizzes.length > 0) {
          sbQuizzes.forEach((row: any) => {
            const parsedQ =
              typeof row.questions === "string"
                ? JSON.parse(row.questions)
                : row.questions;
            if (Array.isArray(parsedQ) && parsedQ.length > 0) {
              const mapped: QuizDeck = {
                id: String(row.id),
                title: row.title || row.name || "QCM",
                subject: row.subject || row.category || row.title || "Médecine",
                createdAt: "Banque QCM",
                questions: parsedQ,
              };
              if (!decks.some((d) => d.id === mapped.id || d.title === mapped.title)) {
                decks.unshift(mapped);
              }
            }
          });
        }
      } catch {
        // Fallback local
      }

      setAvailableDecks(decks);

      const deckParam = searchParams.get("deckId");
      if (deckParam && decks.some((d) => d.id === deckParam)) {
        setSelectedDeckId(deckParam);
      } else if (decks.length > 0) {
        setSelectedDeckId(decks[0].id);
      }

      const durationParam = searchParams.get("duration");
      if (durationParam) {
        const parsedDur = parseInt(durationParam, 10);
        if (!isNaN(parsedDur) && parsedDur > 0) {
          setDurationMinutes(parsedDur);
          setSecondsRemaining(parsedDur * 60);
        }
      }

      const strictParam = searchParams.get("strict");
      if (strictParam === "true") {
        setStrictLockMode(true);
      }

      // Si autoLaunch est demandé ou si une session est injectée via sessionStorage
      const rawSessionDeck = sessionStorage.getItem("exam_session_deck");
      const rawSessionConfig = sessionStorage.getItem("exam_session_config");
      if (rawSessionDeck) {
        try {
          const sDeck = JSON.parse(rawSessionDeck);
          if (sDeck && Array.isArray(sDeck.questions) && sDeck.questions.length > 0) {
            const letters = ["A", "B", "C", "D", "E", "F"];
            const mapped: ExamQuestionItem[] = sDeck.questions.map((q: any, idx: number) => ({
              id: `${sDeck.id}-q-${idx}`,
              deckTitle: sDeck.title,
              subject: sDeck.subject || "Médecine",
              questionPrompt: q.question,
              propositions: (q.options || []).map((opt: any, oIdx: number) => ({
                id: opt.label || letters[oIdx] || String(oIdx + 1),
                label: opt.label || letters[oIdx] || String(oIdx + 1),
                text: opt.text,
                isCorrect: Boolean(opt.isCorrect),
              })),
              explanation: q.explanation || "Correction validée selon les objectifs.",
            }));

            let dur = 20;
            let strict = false;
            if (rawSessionConfig) {
              const cfg = JSON.parse(rawSessionConfig);
              if (cfg.durationMinutes) dur = cfg.durationMinutes;
              if (typeof cfg.strictMode === "boolean") strict = cfg.strictMode;
            }

            setExamQuestions(mapped);
            setDurationMinutes(dur);
            setStrictLockMode(strict);
            setSecondsRemaining(dur * 60);
            setAnswersByQuestion({});
            setEliminatedByQuestion({});
            setFlaggedQuestions([]);
            setCurrentIdx(0);
            setPhase("running");
            sessionStorage.removeItem("exam_session_deck");
            sessionStorage.removeItem("exam_session_config");
            return;
          }
        } catch (e) {
          console.warn("Session restore warning:", e);
        }
      }
    };

    loadDecks();
  }, [searchParams]);

  // Construire la liste des questions à partir du QCM choisi
  const buildQuestionsForSession = useCallback((): ExamQuestionItem[] => {
    const targetDecks =
      selectedDeckId === "ALL"
        ? availableDecks
        : availableDecks.filter((d) => d.id === selectedDeckId);

    const mapped: ExamQuestionItem[] = [];
    targetDecks.forEach((deck) => {
      deck.questions.forEach((q, idx) => {
        const letters = ["A", "B", "C", "D", "E", "F"];
        mapped.push({
          id: `${deck.id}-q-${idx}`,
          deckTitle: deck.title,
          subject: deck.subject || deck.title,
          questionPrompt: q.question,
          propositions: q.options.map((opt, oIdx) => ({
            id: opt.label || letters[oIdx] || String(oIdx + 1),
            label: opt.label || letters[oIdx] || String(oIdx + 1),
            text: opt.text,
            isCorrect: Boolean(opt.isCorrect),
          })),
          explanation:
            q.explanation ||
            "Correction validée selon les objectifs de la leçon.",
        });
      });
    });

    return mapped.length > 0 ? mapped : FALLBACK_EXAM_QUESTIONS;
  }, [availableDecks, selectedDeckId]);

  const startExamSession = () => {
    const built = buildQuestionsForSession();
    setExamQuestions(built);
    setAnswersByQuestion({});
    setEliminatedByQuestion({});
    setFlaggedQuestions([]);
    setCurrentIdx(0);
    setSecondsRemaining(durationMinutes * 60);
    setPhase("running");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Chronomètre
  useEffect(() => {
    if (phase !== "running") return;
    if (secondsRemaining <= 0) {
      setPhase("report");
      return;
    }
    const timer = setInterval(() => {
      setSecondsRemaining((s) => s - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, secondsRemaining]);

  const activeQuestion = examQuestions[currentIdx] || examQuestions[0];
  const selectedForActive = answersByQuestion[activeQuestion?.id] || [];
  const eliminatedForActive = eliminatedByQuestion[activeQuestion?.id] || [];

  const toggleAnswer = useCallback(
    (propId: string) => {
      if (!activeQuestion) return;
      setAnswersByQuestion((prev) => {
        const current = prev[activeQuestion.id] || [];
        const exists = current.includes(propId);
        return {
          ...prev,
          [activeQuestion.id]: exists
            ? current.filter((id) => id !== propId)
            : [...current, propId],
        };
      });
    },
    [activeQuestion]
  );

  const toggleEliminate = (propId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeQuestion) return;
    setEliminatedByQuestion((prev) => {
      const current = prev[activeQuestion.id] || [];
      const exists = current.includes(propId);
      return {
        ...prev,
        [activeQuestion.id]: exists
          ? current.filter((id) => id !== propId)
          : [...current, propId],
      };
    });
    // Si l'option était cochée et qu'on la barre, on la décoche
    setAnswersByQuestion((prev) => {
      const current = prev[activeQuestion.id] || [];
      if (!current.includes(propId)) return prev;
      return {
        ...prev,
        [activeQuestion.id]: current.filter((id) => id !== propId),
      };
    });
  };

  const toggleFlag = (qId: string) => {
    setFlaggedQuestions((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  // Raccourcis clavier (A, B, C, D, E pour cocher, Flèches Gauche/Droite pour naviguer)
  useEffect(() => {
    if (phase !== "running" || !activeQuestion) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const upper = e.key.toUpperCase();
      const matchedProp = activeQuestion.propositions.find(
        (p) => p.label.toUpperCase() === upper
      );
      if (matchedProp && !eliminatedForActive.includes(matchedProp.id)) {
        e.preventDefault();
        toggleAnswer(matchedProp.id);
      } else if (e.key === "ArrowRight" && currentIdx + 1 < examQuestions.length) {
        e.preventDefault();
        setCurrentIdx((i) => i + 1);
      } else if (
        e.key === "ArrowLeft" &&
        !strictLockMode &&
        currentIdx > 0
      ) {
        e.preventDefault();
        setCurrentIdx((i) => i - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    phase,
    activeQuestion,
    eliminatedForActive,
    currentIdx,
    examQuestions.length,
    strictLockMode,
    toggleAnswer,
  ]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const computeQuestionScore = (q: ExamQuestionItem) => {
    const picked = answersByQuestion[q.id] || [];
    let errors = 0;
    q.propositions.forEach((p) => {
      const isPicked = picked.includes(p.id);
      if ((p.isCorrect && !isPicked) || (!p.isCorrect && isPicked)) {
        errors += 1;
      }
    });

    if (errors === 0) return { score: 1, errors: 0, status: "perfect" as const };
    if (errors === 1) return { score: 0.5, errors: 1, status: "partial" as const };
    if (errors === 2) return { score: 0.2, errors: 2, status: "partial" as const };
    return { score: 0, errors, status: "wrong" as const };
  };

  const answeredTotalCount = Object.values(answersByQuestion).filter(
    (arr) => arr && arr.length > 0
  ).length;

  // Mémorise les erreurs commises lors de la remise de la copie pour alimenter « Depuis mes Erreurs QCM »
  useEffect(() => {
    if (phase !== "report") return;
    examQuestions.forEach((q) => {
      const picked = answersByQuestion[q.id] || [];
      let errors = 0;
      q.propositions.forEach((p) => {
        const isPicked = picked.includes(p.id);
        if ((p.isCorrect && !isPicked) || (!p.isCorrect && isPicked)) errors += 1;
      });
      if (errors === 0) return;

      const sourceDeck =
        availableDecks.find((d) => d.title === q.deckTitle) || {
          id: selectedDeckId || "exam",
          title: q.deckTitle,
          subject: q.subject,
          createdAt: "",
          questions: [],
        };

      recordQcmQuestionAttempt({
        deck: sourceDeck,
        question: {
          id: q.id,
          question: q.questionPrompt,
          options: q.propositions.map((p) => ({
            id: p.id,
            label: p.label,
            text: p.text,
            isCorrect: p.isCorrect,
          })),
          explanation: q.explanation,
        },
        isCorrect: false,
        selectedOptionIds: picked,
      });
    });
  }, [phase, examQuestions, answersByQuestion, availableDecks, selectedDeckId]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* =====================================================================
          PHASE 1 : BRIEFING & CONFIGURATION DU MODE EXAMEN
         ===================================================================== */}
      {phase === "setup" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/80 pb-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[12px] font-medium text-primary">
                <FileCheck2 className="h-4 w-4" />
                <span>Évaluation Chronométrée • Conditions d'Examen</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight">
                Simulateur d'Examens Blancs
              </h1>
            </div>
            <Badge variant="secondary" className="font-mono text-[11.5px] px-3 py-1">
              Épreuve Chronométrée
            </Badge>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <Card className="lg:col-span-8">
              <CardHeader>
                <CardTitle className="text-xl">
                  Paramétrez votre épreuve
                </CardTitle>
                <CardDescription>
                  Sélectionnez le sujet issu de votre banque de QCM, la durée de l'épreuve et le mode de navigation.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* 1. Sujet d'examen */}
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    1. Sujet / Banque de QCM à évaluer
                  </label>
                  <select
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    className="w-full h-11 rounded-xl border border-border bg-card px-3.5 text-[13.5px] font-semibold text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="ALL">
                      📚 Examen Transversal — Tous mes QCM ({availableDecks.length} sujets)
                    </option>
                    {availableDecks.map((d) => (
                      <option key={d.id} value={d.id}>
                        🎯 {d.title} ({d.questions.length} questions)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Durée avec options complètes dont 1h et 2h */}
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      2. Durée du chronomètre
                    </span>
                    <span className="font-mono text-primary font-bold">
                      {durationMinutes >= 60
                        ? `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 ? `${durationMinutes % 60}m` : ""}`
                        : `${durationMinutes} min`}
                    </span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {[
                      { mins: 10, label: "10 min", sub: "Sprint" },
                      { mins: 20, label: "20 min", sub: "Standard" },
                      { mins: 45, label: "45 min", sub: "Approfondi" },
                      { mins: 60, label: "1 heure", sub: "Grand Examen" },
                      { mins: 120, label: "2 heures", sub: "Concours" },
                    ].map((opt) => (
                      <button
                        key={opt.mins}
                        type="button"
                        onClick={() => setDurationMinutes(opt.mins)}
                        className={cn(
                          "rounded-xl border p-3 text-center transition-all",
                          durationMinutes === opt.mins
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-xs scale-[1.02]"
                            : "border-border bg-background/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                        )}
                      >
                        <span className="font-mono text-base font-bold block text-foreground">
                          {opt.label}
                        </span>
                        <span className="text-[10.5px] text-muted-foreground block mt-0.5">
                          {opt.sub}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Mode de franchissement */}
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" />
                    3. Mode de navigation entre les questions
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStrictLockMode(false)}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-all",
                        !strictLockMode
                          ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                          : "border-border bg-background/60 hover:border-foreground/30"
                      )}
                    >
                      <span className="text-[13.5px] font-semibold text-foreground block">
                        Navigation Libre & Drapeaux
                      </span>
                      <span className="text-[12px] text-muted-foreground block mt-1 leading-relaxed">
                        Permet de revenir sur n'importe quelle question avant la remise finale.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStrictLockMode(true)}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-all",
                        strictLockMode
                          ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                          : "border-border bg-background/60 hover:border-foreground/30"
                      )}
                    >
                      <span className="text-[13.5px] font-semibold text-foreground block">
                        Verrouillage Séquentiel Strict
                      </span>
                      <span className="text-[12px] text-muted-foreground block mt-1 leading-relaxed">
                        Impossible de revenir en arrière une fois la question franchie.
                      </span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button size="lg" onClick={startExamSession} className="px-6">
                    <Play className="h-4 w-4 fill-current" />
                    <span>Démarrer l'épreuve blanche</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Rappel barème & Raccourcis clavier */}
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle className="text-[15px] flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Barème & Ergonomie
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-[13px] text-muted-foreground">
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                    <span>Aucune erreur</span>
                    <strong className="font-mono text-primary">1,00 pt</strong>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                    <span>1 erreur</span>
                    <strong className="font-mono text-foreground">0,50 pt</strong>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                    <span>2 erreurs</span>
                    <strong className="font-mono text-foreground">0,20 pt</strong>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span>3 erreurs ou plus</span>
                    <strong className="font-mono text-destructive">0,00 pt</strong>
                  </div>
                </div>

                <div className="rounded-xl bg-secondary/45 border border-border/70 p-3.5 space-y-1.5 text-[12px]">
                  <span className="font-semibold text-foreground block">
                    Raccourcis clavier actifs :
                  </span>
                  <p>
                    Touches <kbd className="kbd-badge">A</kbd> à{" "}
                    <kbd className="kbd-badge">E</kbd> pour cocher/décocher une proposition, et flèches{" "}
                    <kbd className="kbd-badge">←</kbd>{" "}
                    <kbd className="kbd-badge">→</kbd> pour naviguer.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* =====================================================================
          PHASE 2 : STATION D'EXAMEN PLEINE LARGEUR (ZÉRO BLOC ENTASSÉ)
         ===================================================================== */}
      {phase === "running" && activeQuestion && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
          {/* 1. DOCK SUPÉRIEUR UNIFIÉ : SUJET + RUBAN HORIZONTAL DES QUESTIONS + CHRONO */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <DawJangDragonIcon className="h-6 w-6 text-foreground shrink-0" />
                <Badge variant="default" className="font-mono text-[11px]">
                  {activeQuestion.subject}
                </Badge>
                <span className="text-[13.5px] font-semibold text-foreground truncate">
                  {activeQuestion.deckTitle}
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 font-mono text-[14px] font-bold tabular-nums",
                    secondsRemaining < 90
                      ? "border-destructive bg-destructive/10 text-destructive animate-pulse"
                      : "border-border bg-secondary/60 text-foreground"
                  )}
                >
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{formatTime(secondsRemaining)}</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPhase("report")}
                  className="h-9 rounded-xl font-semibold"
                >
                  Remettre ma copie ({answeredTotalCount}/{examQuestions.length})
                </Button>
              </div>
            </div>

            {/* Ruban horizontal des numéros de questions (Remplace la boîte coupée à droite) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-border/60 scrollbar-none">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground mr-1.5 shrink-0">
                Questions :
              </span>
              {examQuestions.map((q, idx) => {
                const isCurrent = idx === currentIdx;
                const isAnswered = (answersByQuestion[q.id] || []).length > 0;
                const isFlagged = flaggedQuestions.includes(q.id);

                return (
                  <button
                    key={q.id}
                    type="button"
                    disabled={strictLockMode && idx < currentIdx}
                    onClick={() => setCurrentIdx(idx)}
                    className={cn(
                      "relative flex h-8 min-w-[34px] px-2 shrink-0 items-center justify-center rounded-lg border font-mono text-[12px] font-bold transition-all duration-150",
                      isCurrent
                        ? "border-foreground bg-foreground text-background shadow-sm scale-105"
                        : isAnswered
                        ? "border-primary/45 bg-primary/12 text-primary hover:border-primary"
                        : "border-border/80 bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30"
                    )}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-card" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. FEUILLE D'EXAMEN ÉDITORIALE UNIFIÉE */}
          <Card className="border-border/90 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.06)] overflow-hidden">
            {/* En-tête de l'énoncé */}
            <CardHeader className="border-b border-border/75 bg-secondary/20 px-6 sm:px-9 py-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-primary">
                    QUESTION {String(currentIdx + 1).padStart(2, "0")} SUR{" "}
                    {String(examQuestions.length).padStart(2, "0")}
                  </span>
                  <span className="text-border">•</span>
                  <span className="text-[12px] text-muted-foreground">
                    Sélectionnez la ou les réponses exactes
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => toggleFlag(activeQuestion.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-[12px] font-medium transition-colors",
                    flaggedQuestions.includes(activeQuestion.id)
                      ? "border-amber-500/50 bg-amber-500/12 text-amber-700 dark:text-amber-300 font-semibold"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Flag className="h-3.5 w-3.5" />
                  <span>
                    {flaggedQuestions.includes(activeQuestion.id)
                      ? "Question marquée"
                      : "Marquer à revoir"}
                  </span>
                </button>
              </div>

              {/* Énoncé de la question avec ampleur typographique */}
              <h2 className="font-serif text-2xl sm:text-[27px] font-normal text-foreground leading-[1.35] tracking-normal pt-1">
                {activeQuestion.questionPrompt}
              </h2>
            </CardHeader>

            {/* Liste des propositions pleine largeur (Aérées, lisibles sur 1 à 2 lignes) */}
            <CardContent className="p-6 sm:p-9 space-y-3">
              {activeQuestion.propositions.map((prop) => {
                const isSelected = selectedForActive.includes(prop.id);
                const isEliminated = eliminatedForActive.includes(prop.id);

                return (
                  <div
                    key={prop.id}
                    onClick={() => !isEliminated && toggleAnswer(prop.id)}
                    className={cn(
                      "group relative flex items-center justify-between gap-4 rounded-xl border px-4 sm:px-5 py-3.5 sm:py-4 cursor-pointer transition-all duration-150",
                      isEliminated
                        ? "border-border/50 bg-secondary/20 opacity-45"
                        : isSelected
                        ? "border-primary bg-primary/[0.07] shadow-[0_2px_10px_-3px_rgba(201,100,66,0.18)]"
                        : "border-border/85 bg-card hover:border-foreground/35 hover:bg-secondary/35"
                    )}
                  >
                    {/* Filet latéral d'activation */}
                    <div
                      className={cn(
                        "absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full transition-opacity",
                        isSelected ? "bg-primary opacity-100" : "opacity-0"
                      )}
                    />

                    <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                      {/* Lettre A, B, C, D, E */}
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-[13px] font-bold transition-all",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-background text-muted-foreground group-hover:border-foreground/40 group-hover:text-foreground"
                        )}
                      >
                        {prop.label}
                      </span>

                      {/* Texte de la proposition sur toute la largeur */}
                      <span
                        className={cn(
                          "text-[14.5px] sm:text-[15px] leading-relaxed transition-colors",
                          isEliminated
                            ? "line-through text-muted-foreground"
                            : isSelected
                            ? "font-semibold text-foreground"
                            : "text-foreground/90 group-hover:text-foreground"
                        )}
                      >
                        {prop.text}
                      </span>
                    </div>

                    {/* Actions droites : État coché + Bouton Barrer l'hypothèse */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isSelected && !isEliminated && (
                        <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 font-mono text-[10.5px] font-bold text-primary">
                          <Check className="h-3 w-3" /> Retenue
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => toggleEliminate(prop.id, e)}
                        title={
                          isEliminated
                            ? "Restaurer cette proposition"
                            : "Barrer / Éliminer cette hypothèse"
                        }
                        className={cn(
                          "p-2 rounded-lg border transition-colors",
                          isEliminated
                            ? "border-border bg-secondary text-foreground"
                            : "border-transparent text-muted-foreground/55 hover:border-border hover:bg-background hover:text-foreground"
                        )}
                      >
                        <EyeOff className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Barre de navigation inférieure */}
              <div className="pt-6 mt-4 border-t border-border/75 flex flex-wrap items-center justify-between gap-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={strictLockMode || currentIdx === 0}
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  className="h-10 px-4 rounded-xl"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Précédent</span>
                </Button>

                <span className="font-mono text-[12px] text-muted-foreground">
                  {selectedForActive.length === 0
                    ? "Aucune proposition sélectionnée"
                    : `${selectedForActive.length} proposition(s) retenue(s)`}
                </span>

                {currentIdx + 1 < examQuestions.length ? (
                  <Button
                    type="button"
                    onClick={() => setCurrentIdx((i) => i + 1)}
                    className="h-10 px-6 rounded-xl font-semibold"
                  >
                    <span>Question suivante</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setPhase("report")}
                    className="h-10 px-6 rounded-xl font-semibold bg-primary text-primary-foreground"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Terminer et corriger l'épreuve</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =====================================================================
          PHASE 3 : PROCÈS-VERBAL DE CORRECTION DÉTAILLÉ
         ===================================================================== */}
      {phase === "report" && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
          {(() => {
            const results = examQuestions.map((q) => ({
              question: q,
              ...computeQuestionScore(q),
            }));
            const totalPoints = results.reduce((acc, r) => acc + r.score, 0);
            const maxPoints = examQuestions.length;
            const gradeOutOf20 = maxPoints > 0 ? ((totalPoints / maxPoints) * 20).toFixed(1) : "0.0";
            const pct = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

            return (
              <>
                <Card className="border-border/90 shadow-sm">
                  <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="space-y-1.5">
                      <Badge variant="default" className="font-mono">
                        BILAN D'EXAMEN DAWJANG
                      </Badge>
                      <h2 className="font-serif text-3xl text-foreground pt-1">
                        Note Finale :{" "}
                        <span className="font-mono font-bold text-primary">
                          {gradeOutOf20} / 20
                        </span>{" "}
                        <span className="text-lg font-sans text-muted-foreground">
                          ({pct}%)
                        </span>
                      </h2>
                      <p className="text-[13.5px] text-muted-foreground">
                        Score pondéré : {totalPoints.toFixed(2)} / {maxPoints} points
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <Button
                        variant="outline"
                        onClick={() => navigate("/stats?view=lacunes")}
                      >
                        <AlertCircle className="h-4 w-4 text-primary" />
                        <span>Voir le rapport des lacunes</span>
                      </Button>
                      <Button onClick={() => setPhase("setup")}>
                        <RotateCcw className="h-4 w-4" />
                        <span>Nouvelle épreuve</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  {results.map(({ question, score, errors }, idx) => {
                    const userPicked = answersByQuestion[question.id] || [];
                    return (
                      <Card key={question.id} className="overflow-hidden">
                        <CardHeader className="border-b border-border/70 bg-secondary/20 pb-3.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[12px] font-bold text-primary">
                              QUESTION #{idx + 1} • {question.deckTitle}
                            </span>
                            <Badge
                              variant={
                                score === 1
                                  ? "default"
                                  : score > 0
                                  ? "secondary"
                                  : "destructive"
                              }
                              className="font-mono"
                            >
                              {score} / 1 pt ({errors} erreur{errors > 1 ? "s" : ""})
                            </Badge>
                          </div>
                          <CardTitle className="text-[16.5px] mt-1.5 leading-snug">
                            {question.questionPrompt}
                          </CardTitle>
                        </CardHeader>

                        <CardContent className="pt-5 space-y-3">
                          <div className="space-y-2">
                            {question.propositions.map((p) => {
                              const picked = userPicked.includes(p.id);
                              return (
                                <div
                                  key={p.id}
                                  className={cn(
                                    "flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-[13.5px]",
                                    p.isCorrect
                                      ? "border-emerald-500/45 bg-emerald-500/[0.07] text-foreground"
                                      : picked
                                      ? "border-destructive/50 bg-destructive/[0.08] text-destructive"
                                      : "border-border/60 text-muted-foreground"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <strong className="font-mono">{p.label}.</strong>
                                    <span>{p.text}</span>
                                  </div>
                                  <span className="font-mono text-[11px] font-bold shrink-0">
                                    {p.isCorrect
                                      ? picked
                                        ? "✓ VRAI (Coché)"
                                        : "⚠ VRAI (Oublié)"
                                      : picked
                                      ? "✗ FAUX (Coché)"
                                      : "FAUX"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="rounded-xl bg-secondary/45 border border-border p-4 text-[13.5px] text-foreground">
                            <strong className="text-primary block mb-1">
                              Synthèse de correction :
                            </strong>
                            {question.explanation}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
export { Exams };
