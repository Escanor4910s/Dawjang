// src/components/quiz/MultiEngineQuizGenerator.tsx
import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callGeminiAcademicEngine } from "@/lib/syncEngine";
import { callDawiaEngine } from "@/lib/dawiaQcmEngine";
import { repairAndParseQuizJson, STRICT_JSON_PROMPT_GUARD } from "@/lib/jsonRepair";
import {
  Sparkles,
  Bot,
  BrainCircuit,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Play,
  Save,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUserQuizzes } from "@/hooks/useUserQuizzes";
import { cn } from "@/lib/utils";
import { sanitizeQcmOptionText, cleanMedicalCourseTitle } from "@/lib/annalesMimicryEngine";

export type QuizEngine = "dawia1" | "dawia2" | "academic-gemini" | "openai" | "supabase-ai" | "generic";

export interface NormalizedQuizQuestion {
  id: string;
  question: string;
  choices: string[];
  answer: string;
  explanation?: string;
}

export interface NormalizedQuizData {
  id: string;
  title: string;
  subject: string;
  questions: NormalizedQuizQuestion[];
}

export interface MultiEngineQuizGeneratorProps {
  onQuizReady?: (quiz: NormalizedQuizData) => void;
  onStartSession?: (quiz: NormalizedQuizData) => void;
  className?: string;
}

const ENGINE_CONFIG: Record<
  QuizEngine,
  { label: string; description: string; endpoint: string; icon: React.ElementType }
> = {
  dawia1: {
    label: "DAWIA 1",
    description: "Moteur Docimologique Standard • Calibrage fluide et direct sur le cours pour révisions quotidiennes",
    endpoint: "dawia1",
    icon: Sparkles,
  },
  dawia2: {
    label: "DAWIA 2",
    description: "Moteur Haute Docimologie & Litige • Raisonnement approfondi, assertions subtiles qui sèment le doute",
    endpoint: "dawia2",
    icon: BrainCircuit,
  },
  "academic-gemini": {
    label: "DAWIA 1 (Secours)",
    description: "Moteur académique de repli DawJang",
    endpoint: "local-academic",
    icon: Sparkles,
  },
  openai: {
    label: "Moteur Hybride A",
    description: "Fonction Edge Supabase avec calibrage de questions à choix multiples",
    endpoint: "generate-quiz-openai",
    icon: BrainCircuit,
  },
  "supabase-ai": {
    label: "Moteur Embarqué B",
    description: "Endpoint d'inférence directe Supabase Edge avec modèle embarqué",
    endpoint: "generate-quiz-supabase-ai",
    icon: Bot,
  },
  generic: {
    label: "Moteur Généraliste C",
    description: "Microservice standard de génération QCM multi-sujets",
    endpoint: "generate-quiz",
    icon: Cpu,
  },
};

/**
 * Normalise n'importe quelle structure de quiz renvoyée par un modèle ou endpoint
 */
export function normalizeRawQuizData(
  data: any,
  defaultTitle = "QCM Médical Généré",
  defaultSubject = "Médecine"
): NormalizedQuizData {
  const rawList = Array.isArray(data)
    ? data
    : Array.isArray(data?.questions)
    ? data.questions
    : Array.isArray(data?.quiz)
    ? data.quiz
    : [];

  const cleanTitle = cleanMedicalCourseTitle(String(data?.title || defaultTitle));
  const cleanSubj = cleanMedicalCourseTitle(String(data?.subject || defaultSubject));

  const questions: NormalizedQuizQuestion[] = rawList.map((q: any, idx: number) => {
    let choices: string[] = [];
    let answer = "";

    // 1. Format options avec label et isCorrect: [{ label: 'A', text: '...', isCorrect: true }]
    if (Array.isArray(q.options) && q.options.length > 0) {
      choices = q.options.map((o: any) =>
        typeof o === "string" ? o : String(o.text || o.label || "")
      );
      const correctOpt = q.options.find((o: any) => o.isCorrect);
      if (correctOpt) {
        answer = typeof correctOpt === "string" ? correctOpt : String(correctOpt.text || correctOpt.label || "");
      } else {
        answer = choices[0] || "";
      }
    }
    // 2. Format choices / answer: { choices: [...], answer: '...' }
    else if (Array.isArray(q.choices) && q.choices.length > 0) {
      choices = q.choices.map(String);
      answer = String(q.answer || choices[0] || "");
    }
    // 3. Format propositions / correctAnswer: { propositions: [...], correctAnswer: '...' }
    else if (Array.isArray(q.propositions) && q.propositions.length > 0) {
      choices = q.propositions.map(String);
      answer = String(q.correctAnswer || q.answer || choices[0] || "");
    }

    const sanitizedChoices = choices.map((c) => sanitizeQcmOptionText(String(c)));
    let cleanQText = String(q.question || q.enonce || `Question ${idx + 1}`);
    cleanQText = cleanQText.replace(/«\s*\d+[-_\s]*([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)*)\s*(?:20\d\d)?(?:\.pdf)?\s*»/gi, "« $1 »");
    cleanQText = cleanQText.replace(/«\s*cette entité\s*»/gi, "cette pathologie");

    return {
      id: String(q.id || `q-${idx + 1}`),
      question: cleanQText,
      choices: sanitizedChoices,
      answer: sanitizeQcmOptionText(answer),
      explanation: q.explanation || q.justification || "",
    };
  });

  return {
    id: String(data?.id || `quiz-${Date.now()}`),
    title: cleanTitle,
    subject: cleanSubj,
    questions,
  };
}

export function MultiEngineQuizGenerator({
  onQuizReady,
  onStartSession,
  className,
}: MultiEngineQuizGeneratorProps) {
  const [engine, setEngine] = useState<QuizEngine>("dawia1");
  const [subject, setSubject] = useState("Cardiologie — Insuffisance Cardiaque");
  const [questionCount, setQuestionCount] = useState(5);
  const [quiz, setQuiz] = useState<NormalizedQuizData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { saveQuiz } = useUserQuizzes();

  async function fetchQuiz() {
    setLoading(true);
    setError(null);
    setQuiz(null);

    // Diversification dynamique : seed aléatoire & variation d'angle clinique
    const sessionSeed = Math.floor(Math.random() * 900000) + 100000;
    const CLINICAL_ANGLES = [
      "Cas clinique aigu, diagnostic étiologique & thérapeutique d'urgence",
      "Pièges sémiologiques, diagnostics différentiels & critères d'hospitalisation",
      "Stratégie d'investigation complémentaire (biologie, imagerie) & recommandations HAS/ESC",
      "Prise en charge pharmacologique, contre-indications & effets indésirables",
      "Pronostic, surveillance ambulatoire & prévention secondaire",
      "Complications évolutives et prise en charge multidisciplinaire",
    ];
    const chosenAngle = CLINICAL_ANGLES[Math.floor(Math.random() * CLINICAL_ANGLES.length)];

    try {
      let rawData: any = null;

      // 1. MOTEURS DAWIA (DAWIA 1 ou DAWIA 2) OU ACADÉMIQUE DIRECT
      if (engine === "dawia1" || engine === "dawia2" || engine === "academic-gemini") {
        const dawiaTarget = engine === "dawia2" ? "dawia2" : "dawia1";
        const cleanSubj = cleanMedicalCourseTitle(subject);
        const systemPrompt = `Tu es un professeur agrégé de médecine.
Rédige exactement ${questionCount} QCM de haute précision docimologique sur le sujet : "${cleanSubj}".
Critères de diversification & unicité :
- Seed aléatoire de session : #${sessionSeed}
- Angle d'évaluation clinique : ${chosenAngle}
- Varie impérativement les profils de patients, âges, antécédents et niveaux de gravité pour éliminer toute répétition avec des sessions antérieures.
Chaque QCM doit comporter :
- Un énoncé clinique ou théorique clair portant sur « ${cleanSubj} » (sans aucun nom de fichier brut ni numéro de diapositive)
- 5 propositions (A, B, C, D, E) DIVERSIFIÉES :
  * Jongle obligatoirement entre phrases SIMPLES (affirmations directes et nettes de 8 à 15 mots) et phrases COMPLEXES (propositions de 20 à 35 mots avec nuance physiopathologique ou condition clinique qui SÈMENT LE DOUTE).
  * Alterne la longueur et la complexité des propositions (ex: A=Simple, B=Complexe, C=Simple, D=Complexe, E=Simple/Moyenne). Ne fais JAMAIS 5 pavés complexes uniformes !
  * ZÉRO SUFFIXE MÉCANIQUE : Interdiction formelle de formules artificielles comme « ce qui dispense formellement de toute exploration » ou « rendant tout bilan inutile ».
- Exactement UNE seule proposition correcte
- Une explication médicale détaillée justifiant la bonne réponse.

Réponds STRICTEMENT par un JSON valide :
[
  {
    "question": "Énoncé...",
    "options": [
      { "label": "A", "text": "Proposition A...", "isCorrect": false },
      { "label": "B", "text": "Proposition B...", "isCorrect": true },
      { "label": "C", "text": "Proposition C...", "isCorrect": false },
      { "label": "D", "text": "Proposition D...", "isCorrect": false },
      { "label": "E", "text": "Proposition E...", "isCorrect": false }
    ],
    "explanation": "Explication..."
  }
]`;

        const responseText = await callDawiaEngine(
          dawiaTarget,
          systemPrompt,
          `Génère ${questionCount} QCM médicaux inédits (seed #${sessionSeed}, angle: ${chosenAngle}) sur : ${cleanSubj}`,
          0.35
        );

        if (!responseText) {
          throw new Error("Aucune réponse reçue du moteur docimologique.");
        }

        rawData = repairAndParseQuizJson(responseText);
      }
      // 2. MOTEUR OPENAI (Edge Function generate-quiz-openai)
      else if (engine === "openai") {
        const { data, error: fnError } = await supabase.functions.invoke(
          "generate-quiz-openai",
          {
            body: {
              subject,
              count: questionCount,
              difficulty: "standard",
              seed: sessionSeed,
              angle: chosenAngle,
            },
          }
        );
        if (fnError) throw new Error(fnError.message || "Erreur Edge Function OpenAI");
        rawData = data;
      }
      // 3. MOTEUR SUPABASE-AI OU GÉNÉRIQUE (Edge Function standard)
      else {
        const functionName =
          engine === "supabase-ai" ? "generate-quiz-supabase-ai" : "generate-quiz";

        const { data, error: fnError } = await supabase.functions.invoke(functionName, {
          body: {
            subject,
            count: questionCount,
            seed: sessionSeed,
            angle: chosenAngle,
          },
        });

        if (fnError) {
          // Si l'endpoint spécifique n'est pas déployé, bascule gracieuse vers le moteur académique
          console.warn(`Fonction ${functionName} non disponible, bascule automatique sur Academic Engine.`);
          toast({
            title: "Bascule automatique",
            description: `L'endpoint ${functionName} n'étant pas disponible, le moteur académique a pris le relais.`,
          });
          const fallbackPrompt = `Tu es un expert médical. Rédige ${questionCount} QCM sur : ${subject} (seed #${sessionSeed}, angle: ${chosenAngle}).
Format JSON: [{"question": "...", "choices": ["A", "B", "C", "D", "E"], "answer": "B", "explanation": "..."}]`;
          const rawFallback = await callGeminiAcademicEngine(fallbackPrompt, subject, 0.35);
          rawData = rawFallback ? repairAndParseQuizJson(rawFallback) : [];
        } else {
          rawData = data;
        }
      }

      // Normalisation universelle
      const normalized = normalizeRawQuizData(
        rawData,
        `QCM — ${subject}`,
        subject.split("—")[0]?.trim() || "Médecine"
      );

      if (!normalized.questions || normalized.questions.length === 0) {
        throw new Error("Le moteur a retourné une réponse mais aucune question n'a pu être extraite.");
      }

      setQuiz(normalized);
      // Sauvegarde automatique et persistante dans user_quizzes
      await saveQuiz(normalized, {
        title: normalized.title,
        subject: normalized.subject,
      });
      onQuizReady?.(normalized);
      toast({
        title: "QCM généré et sauvegardé ✨",
        description: `${normalized.questions.length} questions uniques générées via ${ENGINE_CONFIG[engine].label} et enregistrées dans vos quiz.`,
      });
    } catch (err: any) {
      console.error("Erreur génération multi-engines:", err);
      setError(err.message || "Erreur inconnue lors de la génération du QCM.");
    } finally {
      setLoading(false);
    }
  }

  const ActiveIcon = ENGINE_CONFIG[engine].icon;

  return (
    <div className={cn("max-w-2xl mx-auto space-y-6", className)}>
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ActiveIcon className="h-4 w-4" />
            </span>
            <CardTitle className="text-xl font-bold">
              Générateur QCM Multi-Moteurs
            </CardTitle>
          </div>
          <CardDescription>
            Basculez librement entre les moteurs de génération IA avec normalisation automatique des propositions.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Sélection dynamique du moteur */}
          <div className="space-y-1.5">
            <label htmlFor="engine-select" className="text-xs font-bold text-foreground">
              Moteur d'intelligence artificielle :
            </label>
            <select
              id="engine-select"
              value={engine}
              onChange={(e) => setEngine(e.target.value as QuizEngine)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              {(Object.keys(ENGINE_CONFIG) as QuizEngine[]).map((key) => (
                <option key={key} value={key}>
                  {ENGINE_CONFIG[key].label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground pt-0.5">
              {ENGINE_CONFIG[engine].description}
            </p>
          </div>

          {/* Sujet médical */}
          <div className="space-y-1.5">
            <label htmlFor="subject-input" className="text-xs font-bold text-foreground">
              Sujet ou Thématique médicale :
            </label>
            <Input
              id="subject-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Pneumologie — Pneumonies communautaires, ECG..."
            />
          </div>

          {/* Nombre de questions */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-bold text-foreground">Volume de questions :</span>
            <div className="inline-flex rounded-lg border border-border bg-secondary/50 p-1">
              {[5, 10, 20].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    questionCount === count
                      ? "bg-card text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {count} QCM
                </button>
              ))}
            </div>
          </div>

          {/* Bouton de génération */}
          <Button
            onClick={fetchQuiz}
            disabled={loading || !subject.trim()}
            className="w-full rounded-xl h-11 font-bold text-sm gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Génération en cours via {engine}...</span>
              </>
            ) : (
              <>
                <ActiveIcon className="h-4 w-4" />
                <span>Générer le QCM ({questionCount} questions)</span>
              </>
            )}
          </Button>

          {/* Message d'erreur */}
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 flex items-start gap-2.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">Erreur de génération :</span>
                <span>{error}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visualisation et normalisation du QCM généré */}
      {quiz && (
        <Card className="border-border bg-card shadow-sm animate-in fade-in duration-200">
          <CardHeader className="border-b border-border/70 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{quiz.subject}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {quiz.questions.length} questions
                  </span>
                </div>
                <CardTitle className="text-lg font-bold">{quiz.title}</CardTitle>
              </div>

              {onStartSession && (
                <Button
                  size="sm"
                  onClick={() => onStartSession(quiz)}
                  className="gap-1.5 font-bold"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Démarrer l'entraînement</span>
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            <ol className="space-y-5">
              {quiz.questions.map((q, idx) => (
                <li
                  key={q.id}
                  className="rounded-xl border border-border/80 bg-secondary/20 p-4 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-xs font-bold text-primary">
                      {idx + 1}
                    </span>
                    <p className="font-semibold text-sm text-foreground leading-snug">
                      {q.question}
                    </p>
                  </div>

                  <ul className="space-y-1.5 pl-8">
                    {q.choices.map((choice, cIdx) => {
                      const isCorrect = choice === q.answer;
                      const letter = String.fromCharCode(65 + cIdx);

                      return (
                        <li
                          key={cIdx}
                          className={cn(
                            "flex items-start gap-2 p-2 rounded-lg text-xs leading-relaxed transition-colors",
                            isCorrect
                              ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 font-bold"
                              : "text-muted-foreground border border-transparent"
                          )}
                        >
                          <span className="font-mono font-bold w-4 shrink-0">{letter}.</span>
                          <span className="flex-1">{choice}</span>
                          {isCorrect && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300 shrink-0 font-bold">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Bonne réponse
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {q.explanation && (
                    <div className="ml-8 p-2.5 rounded-lg bg-muted/60 text-[11.5px] text-muted-foreground border-l-2 border-primary/50">
                      <strong className="text-foreground block mb-0.5">Justification :</strong>
                      {q.explanation}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default MultiEngineQuizGenerator;
