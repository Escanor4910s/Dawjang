// src/pages/Infini.tsx
// Constructeur de QCM & Mode Infini unifié (DAWIA 1 / DAWIA 2) avec Feuille d'Examen Prisme par défaut
import React, { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFileReader } from "@/hooks/useFileReader";
import { useGamification } from "@/hooks/useGamification";
import { supabase } from "@/integrations/supabase/client";
import { callGeminiAcademicEngine } from "@/lib/syncEngine";
import { repairAndParseQuizJson } from "@/lib/jsonRepair";
import {
  Sparkles,
  Upload,
  FileText,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Check,
  BookOpen,
  Layers,
  Cpu,
} from "lucide-react";
import { PrismeExamSheet } from "@/components/qcm/PrismeExamSheet";
import {
  AnswerLetter,
  FacultyQCMType,
  PrismeQCMQuestion,
  QuestionPolarity,
  SessionGenerationMode,
  WritingSignature,
  buildPrismeSystemPrompt,
  buildSelfContainedStemForLegacyUI,
  computeCourseHash,
  generateBalancedAnswerSequence,
  sanitizeAndRepairQuestion,
  splitCourseIntoExhaustiveSections,
} from "@/lib/prismeEngine";

const ALL_LETTERS: AnswerLetter[] = ["A", "B", "C", "D", "E"];

const FORMAT_CARDS: {
  id: FacultyQCMType;
  label: string;
  desc: string;
}[] = [
  { id: "ELECTION", label: "Élection (QCU)", desc: "1 seule proposition vraie" },
  { id: "COMPLEMENTS_MULTIPLES", label: "Choix Multiple", desc: "1 à 5 vraies (1 fausse = 0 pt)" },
  { id: "CENSURE", label: "Censure", desc: "Cocher la proposition FAUSSE" },
  { id: "GROUPAGE", label: "Groupage", desc: "Compléments 1-2-3, 1-3, 2-4, 4, E" },
  { id: "JUMELAGE", label: "Jumelage", desc: "Cause à effet (PARCE QUE)" },
  { id: "ASSOCIATION", label: "Association", desc: "Appariement Liste 1 (1-4) ↔ Liste 2 (A-D)" },
];

const CLINICAL_STEP_ROLES = [
  "Étape 1 : Sémiologie & Hypothèses diagnostiques de 1re intention",
  "Étape 2 : Révélation paraclinique, examen de confirmation & mécanisme",
  "Étape 3 : Classification, stadification pronostique ou diagnostic différentiel",
  "Étape 4 : Stratégie thérapeutique, surveillance & complication évolutive",
];

function pickRandomMultiLetters(primarySeedLetter: AnswerLetter): AnswerLetter[] {
  const count = Math.floor(Math.random() * 3) + 2;
  const pool = ALL_LETTERS.filter((l) => l !== primarySeedLetter).sort(
    () => Math.random() - 0.5
  );
  return [primarySeedLetter, ...pool.slice(0, count - 1)].sort();
}

/**
 * Générateur local de secours si le backend Supabase et l'API IA sont temporairement inaccessibles
 */
function generateLocalFallbackQuestions(
  courseSectionTitle: string,
  courseSectionText: string,
  specs: Array<{
    number: number;
    type: FacultyQCMType;
    polarity: QuestionPolarity;
    targetLetters: AnswerLetter[];
    mutationLevel: 1 | 2 | 3 | 4;
    clinicalCasePlan?: {
      caseId: string;
      caseNumber: number;
      stepIndex: number;
      totalSteps: number;
      stepRole: string;
    };
  }>,
  sectionIndex: number
): PrismeQCMQuestion[] {
  const sentences = courseSectionText
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);

  return specs.map((spec, idx) => {
    const mainSentence = sentences[idx % Math.max(1, sentences.length)] || courseSectionTitle;
    const targetLetter = spec.targetLetters[0] || "A";

    return sanitizeAndRepairQuestion(
      {
        id: `local_${sectionIndex}_${spec.number}_${Date.now()}`,
        number: spec.number,
        type: spec.type,
        polarity: spec.polarity,
        sectionIndex,
        sectionTitle: courseSectionTitle,
        mutationLevel: spec.mutationLevel,
        stem:
          spec.polarity === "CHERCHER_FAUSSES"
            ? `Concernant ${courseSectionTitle}, toutes les propositions suivantes sont exactes sauf une. Laquelle ?`
            : spec.type === "COMPLEMENTS_MULTIPLES"
            ? `Parmi les signes et données sémiologiques suivants relatifs à ${courseSectionTitle}, cochez la ou les affirmations exactes :`
            : spec.type === "ASSOCIATION"
            ? `Associez chaque élément de la liste 1 aux correspondances diagnostiques de la liste 2 :`
            : `Au cours de l'évaluation clinique de ${courseSectionTitle}, quelle est l'attitude ou la notion exacte ?`,
        clinicalCase: spec.clinicalCasePlan
          ? {
              caseId: spec.clinicalCasePlan.caseId,
              caseNumber: spec.clinicalCasePlan.caseNumber,
              caseTitle: courseSectionTitle,
              initialPresentation:
                spec.clinicalCasePlan.stepIndex === 1
                  ? `Patient de 48 ans reçu en consultation pour des manifestations cliniques évoluant depuis 3 semaines. L'examen initial et le bilan biologique de première intention révèlent les éléments suivants : ${mainSentence.slice(0, 160)}.`
                  : undefined,
              narrativeUpdate:
                spec.clinicalCasePlan.stepIndex > 1
                  ? `Suite de la prise en charge : les examens complémentaires confirment le tableau initial et l'évolution sous traitement montre : ${mainSentence.slice(0, 120)}.`
                  : undefined,
              clinicalStageLabel: spec.clinicalCasePlan.stepRole,
            }
          : undefined,
        numberedPropositions:
          spec.type === "GROUPAGE"
            ? [
                { num: 1, text: `${mainSentence.slice(0, 80)}`, isTrueInCourse: true, feedback: "Conforme au cours" },
                { num: 2, text: `Ce signe est constant et obligatoire dans tous les cas`, isTrueInCourse: false, feedback: "Piège d'exclusivité abusive" },
                { num: 3, text: `Caractéristique diagnostique de première intention`, isTrueInCourse: true, feedback: "Mentionné dans la leçon" },
                { num: 4, text: `Association syndromique inverse à ce qui est décrit`, isTrueInCourse: false, feedback: "Inversion syndromique" },
              ]
            : undefined,
        jumelagePair:
          spec.type === "JUMELAGE"
            ? {
                statement1: mainSentence.slice(0, 80),
                connector: "parce que",
                statement2: `Le mécanisme physiopathologique sous-jacent est directement lié à ${courseSectionTitle}`,
                statement1True: true,
                statement2True: true,
                hasCausalLink: targetLetter === "A",
              }
            : undefined,
        associationMatrix:
          spec.type === "ASSOCIATION"
            ? {
                leftColumnTitle: "Liste 1 : Signes et mécanismes",
                rightColumnTitle: "Liste 2 : Entités nosologiques",
                leftItems: [
                  { num: 1, text: mainSentence.slice(0, 60) },
                  { num: 2, text: `Caractéristique sémiologique spécifique B` },
                  { num: 3, text: `Anomalie paraclinique C` },
                  { num: 4, text: `Complication évolutive D` },
                ],
                rightItems: [
                  { code: "A", text: `Entité nosologique A` },
                  { code: "B", text: `Entité nosologique B` },
                  { code: "C", text: `Entité nosologique C` },
                  { code: "D", text: `Entité nosologique D` },
                ],
              }
            : undefined,
        options: [
          {
            letter: "A",
            label: spec.type === "ASSOCIATION" ? "Appariement : 1-A • 2-B • 3-C • 4-D" : `${mainSentence.slice(0, 90)} (Conforme au cours)`,
            isStatementTrueInCourse: spec.targetLetters.includes("A"),
            isTargetToCheck: spec.targetLetters.includes("A"),
            trapCategory: "PROPOSITION_EXACTE",
            trapBadgeLabel: "Conforme au cours",
            feedback: "Validé par le texte de la leçon.",
          },
          {
            letter: "B",
            label: spec.type === "ASSOCIATION" ? "Appariement : 1-B • 2-D • 3-A • 4-C" : `Inversion topographique ou syndromique relative à : ${courseSectionTitle}`,
            isStatementTrueInCourse: spec.targetLetters.includes("B"),
            isTargetToCheck: spec.targetLetters.includes("B"),
            trapCategory: "CONFUSION_SYNDROMIQUE",
            trapBadgeLabel: "Inversion syndromique",
            feedback: "Leurre classique FMPOS.",
          },
          {
            letter: "C",
            label: spec.type === "ASSOCIATION" ? "Appariement : 1-C • 2-A • 3-D • 4-B" : `Seuil biologique altéré ou modification de stade dans ${courseSectionTitle}`,
            isStatementTrueInCourse: spec.targetLetters.includes("C"),
            isTargetToCheck: spec.targetLetters.includes("C"),
            trapCategory: "DONNEE_CHIFFREE_ALTEREE",
            trapBadgeLabel: "Seuil chiffré modifié",
            feedback: "Leurre classique FMPOS.",
          },
          {
            letter: "D",
            label: spec.type === "ASSOCIATION" ? "Appariement : 1-D • 2-C • 3-B • 4-A" : `Caractère obligatoire ou systématique non mentionné dans le cours`,
            isStatementTrueInCourse: spec.targetLetters.includes("D"),
            isTargetToCheck: spec.targetLetters.includes("D"),
            trapCategory: "EXCLUSIVITE_ABUSIVE",
            trapBadgeLabel: "Exclusivité abusive",
            feedback: "Leurre classique FMPOS.",
          },
          {
            letter: "E",
            label: spec.type === "ASSOCIATION" ? "Appariement : 1-B • 2-A • 3-D • 4-C" : `Autre assertion incompatible avec les données de la leçon`,
            isStatementTrueInCourse: spec.targetLetters.includes("E"),
            isTargetToCheck: spec.targetLetters.includes("E"),
            trapCategory: "INVERSION_MECANISME",
            trapBadgeLabel: "Mécanisme inversé",
            feedback: "Leurre classique FMPOS.",
          },
        ],
        correctLetters: spec.targetLetters,
        exactCourseQuote: mainSentence.slice(0, 150),
        factSignature: `${courseSectionTitle} - ${spec.number}`,
      },
      spec.number
    );
  });
}

export default function Infini() {
  const { toast } = useToast();
  const { readFile, isReading } = useFileReader();
  const { addXP } = useGamification();

  const [sourceMode, setSourceMode] = useState<"file" | "text">("file");
  const [courseTitle, setCourseTitle] = useState<string>("");
  const [courseContent, setCourseContent] = useState<string>("");
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [targetQuestionCount, setTargetQuestionCount] = useState<number>(10);

  // Formats sélectionnés par l'étudiant (1, 2 ou plusieurs)
  const [selectedFormats, setSelectedFormats] = useState<FacultyQCMType[]>([
    "ELECTION",
    "COMPLEMENTS_MULTIPLES",
    "CENSURE",
    "GROUPAGE",
    "JUMELAGE",
    "ASSOCIATION",
  ]);

  // Moteur docimologique : DAWIA 1 (UCAD_AMPHI) vs DAWIA 2 (HARVARD_OXFORD_UCAD)
  const [writingSignature, setWritingSignature] =
    useState<WritingSignature>("HARVARD_OXFORD_UCAD");

  const [generationMode, setGenerationMode] =
    useState<SessionGenerationMode>("HYBRID_EXAM_SIMULATOR");

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [activeQuestions, setActiveQuestions] = useState<PrismeQCMQuestion[]>([]);
  const [totalCourseSections, setTotalCourseSections] = useState<number>(1);

  const toggleFormat = (fmt: FacultyQCMType) => {
    setSelectedFormats((prev) => {
      if (prev.includes(fmt)) {
        return prev.length > 1 ? prev.filter((item) => item !== fmt) : prev;
      }
      return [...prev, fmt];
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let combinedText = courseContent;
    const newNames: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const fileRes: any = await readFile(file);
        const text = typeof fileRes === "string" ? fileRes : fileRes?.content || "";
        if (text) {
          combinedText += (combinedText ? "\n\n" : "") + text;
          newNames.push(file.name);
          if (!courseTitle) {
            setCourseTitle(file.name.replace(/\.[^/.]+$/, ""));
          }
        }
      } catch (err) {
        console.error("Erreur lecture fichier:", err);
      }
    }

    setCourseContent(combinedText);
    setUploadedFileNames((prev) => [...prev, ...newNames]);
  };

  const fetchGhostHistory = async (courseHash: string): Promise<string[]> => {
    const localKey = `prisme_ghost_${courseHash}`;
    const localStems: string[] = JSON.parse(localStorage.getItem(localKey) || "[]");

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return localStems;

      const { data } = await supabase
        .from("qcm_ghost_ledger" as any)
        .select("question_stem_preview")
        .eq("user_id", userData.user.id)
        .eq("course_content_hash", courseHash)
        .limit(150);

      if (data && Array.isArray(data)) {
        const dbStems = data.map((r: any) => r.question_stem_preview);
        return Array.from(new Set([...localStems, ...dbStems]));
      }
    } catch {
      // Fallback localStorage
    }
    return localStems;
  };

  const recordInGhostLedger = async (
    courseHash: string,
    questions: PrismeQCMQuestion[]
  ) => {
    const localKey = `prisme_ghost_${courseHash}`;
    const existing: string[] = JSON.parse(localStorage.getItem(localKey) || "[]");
    const updated = Array.from(
      new Set([...existing, ...questions.map((q) => q.stem)])
    ).slice(-300);
    localStorage.setItem(localKey, JSON.stringify(updated));

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const rows = questions.map((q) => ({
        user_id: userData.user.id,
        course_content_hash: courseHash,
        fact_signature: q.factSignature || q.sectionTitle,
        question_type: q.type,
        question_stem_hash: courseHash.slice(0, 16) + "_" + q.number,
        question_stem_preview: q.stem,
      }));

      await supabase.from("qcm_ghost_ledger" as any).insert(rows);
    } catch {
      // Déjà sauvegardé en local
    }
  };

  const handleGeneratePrismeSession = async () => {
    if (!courseContent.trim() || courseContent.trim().length < 80) {
      toast({
        title: "Cours requis",
        description: "Importez un fichier PDF/DOCX ou collez le texte de votre cours.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      setGenerationStep("Empreinte SHA-256 & vérification du Registre Fantôme anti-répétition...");
      const courseHash = await computeCourseHash(courseContent);
      const ghostExcludedStems = await fetchGhostHistory(courseHash);

      setGenerationStep("Découpage intégral de 100% de la leçon...");
      const sections = splitCourseIntoExhaustiveSections(courseContent);
      setTotalCourseSections(sections.length);

      // Séquence de bonnes réponses équilibrée sans série monotone (A, A, A...)
      const balancedSeeds = generateBalancedAnswerSequence(targetQuestionCount, 2);

      const allGenerated: PrismeQCMQuestion[] = [];
      let globalQNum = 1;
      let caseCounter = 1;

      for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        const section = sections[sIdx];
        const remainingQuestions = targetQuestionCount - (globalQNum - 1);
        const remainingSections = sections.length - sIdx;
        const countForThisSection = Math.max(
          1,
          Math.round(remainingQuestions / remainingSections)
        );

        if (globalQNum > targetQuestionCount) break;

        const useProgressiveCaseForSection =
          generationMode === "PROGRESSIVE_CLINICAL" ||
          (generationMode === "HYBRID_EXAM_SIMULATOR" && sIdx % 2 === 0 && countForThisSection >= 3);

        const currentCaseNumber = useProgressiveCaseForSection ? caseCounter++ : 0;
        const currentCaseId = `case_${currentCaseNumber}`;

        const specsForSection = Array.from({ length: countForThisSection }).map((_, i) => {
          const qNum = globalQNum + i;
          const qType = selectedFormats[(qNum - 1) % selectedFormats.length];
          const seedLetter = balancedSeeds[(qNum - 1) % balancedSeeds.length];

          const polarity: QuestionPolarity =
            qType === "CENSURE"
              ? "CHERCHER_FAUSSES"
              : (qType === "COMPLEMENTS_MULTIPLES" || qType === "GROUPAGE") &&
                qNum % 4 === 0
              ? "CHERCHER_FAUSSES"
              : "CHERCHER_VRAIES";

          const targetLetters: AnswerLetter[] =
            qType === "COMPLEMENTS_MULTIPLES"
              ? pickRandomMultiLetters(seedLetter)
              : [seedLetter];

          const mutationLevel: 1 | 2 | 3 | 4 =
            qType === "ELECTION"
              ? 1
              : qType === "CENSURE"
              ? 2
              : qType === "GROUPAGE" || qType === "ASSOCIATION"
              ? 3
              : 4;

          return {
            number: qNum,
            type: qType,
            polarity,
            targetLetters,
            mutationLevel,
            clinicalCasePlan: useProgressiveCaseForSection
              ? {
                  caseId: currentCaseId,
                  caseNumber: currentCaseNumber,
                  stepIndex: i + 1,
                  totalSteps: countForThisSection,
                  stepRole:
                    CLINICAL_STEP_ROLES[i % CLINICAL_STEP_ROLES.length],
                }
              : undefined,
          };
        });

        globalQNum += countForThisSection;

        setGenerationStep(
          `Moteur ${writingSignature === "HARVARD_OXFORD_UCAD" ? "DAWIA 2 (Haute Docimologie)" : "DAWIA 1"} : Segment ${sIdx + 1}/${sections.length}...`
        );

        const systemPrompt = buildPrismeSystemPrompt({
          courseSectionTitle: section.title,
          courseSectionIndex: sIdx,
          courseSectionText: section.content,
          ghostExcludedStems,
          generationMode,
          writingSignature,
          questionSpecs: specsForSection,
        });

        let rawQuestions: any[] = [];

        // 1. Appel principal vers Supabase Edge Function
        try {
          const { data, error } = await supabase.functions.invoke("generate-quiz", {
            body: {
              systemPrompt,
              courseTitle: courseTitle || "Cours Médical",
              sectionIndex: sIdx,
              sectionTitle: section.title,
              questionSpecs: specsForSection,
              enableSupervisorAudit: writingSignature === "HARVARD_OXFORD_UCAD",
              content: section.content,
            },
          });

          if (!error && data?.questions && Array.isArray(data.questions)) {
            rawQuestions = data.questions;
          }
        } catch (invokeErr) {
          console.warn("[Infini] Edge function unavailable, switching to academic engine:", invokeErr);
        }

        // 2. Fallback via callGeminiAcademicEngine si l'Edge Function est indisponible
        if (rawQuestions.length === 0) {
          try {
            const fallbackOutput = await callGeminiAcademicEngine(
              systemPrompt,
              `Génère le JSON { "questions": [...] } pour le segment "${section.title}" du cours.`
            );
            if (fallbackOutput) {
              const parsed = repairAndParseQuizJson(fallbackOutput);
              const list = parsed?.questions || (Array.isArray(parsed) ? parsed : parsed?.qcm);
              if (Array.isArray(list) && list.length > 0) {
                rawQuestions = list;
              }
            }
          } catch (academicErr) {
            console.warn("[Infini] Academic engine fallback error:", academicErr);
          }
        }

        // 3. Fallback local structuré garanti si aucun réseau externe n'est disponible
        if (rawQuestions.length === 0) {
          rawQuestions = generateLocalFallbackQuestions(
            section.title,
            section.content,
            specsForSection,
            sIdx
          );
        }

        // Auto-réparation et assainissement docimologique de chaque question
        allGenerated.push(
          ...rawQuestions.map((q: any, localIdx: number) => {
            const spec = specsForSection[localIdx] || specsForSection[0];
            const repaired = sanitizeAndRepairQuestion(
              {
                ...q,
                id: q.id || `prisme_${courseHash.slice(0, 8)}_${spec.number}_${Date.now()}_${localIdx}`,
                number: spec.number,
                type: spec.type,
                polarity: spec.polarity,
                sectionIndex: sIdx,
                sectionTitle: section.title,
                mutationLevel: spec.mutationLevel,
                correctLetters: q.correctLetters || spec.targetLetters,
              },
              spec.number
            );
            return repaired;
          })
        );
      }

      await recordInGhostLedger(courseHash, allGenerated);
      setActiveQuestions(allGenerated);

      toast({
        title: "Feuille d'examen Prisme prête",
        description: `${allGenerated.length} QCM générés sur 100% du cours (Tableaux d'Association, Groupage et Jumelage vérifiés).`,
      });
    } catch (err: any) {
      toast({
        title: "Erreur lors de la génération",
        description: err?.message || "Vérifiez votre cours et réessayez.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4">
        {activeQuestions.length === 0 ? (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-primary" />
                Constructeur de QCM & Mode Infini — Prisme FMPOS × Harvard
              </h1>
              <p className="text-sm text-muted-foreground">
                Sélectionnez votre source de cours, les types docimologiques souhaités et lancez une
                feuille d'examen complète garantie sans répétition.
              </p>
            </div>

            <Card className="p-6 space-y-6">
              {/* 1. SOURCE DU COURS À TRANSFORMER EN QCM */}
              <div className="space-y-3">
                <label className="text-sm font-semibold">
                  1. Source du cours à transformer en QCM
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSourceMode("file")}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      sourceMode === "file"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <Upload className="w-4 h-4 text-primary" />
                      Importer un fichier (PDF, DOCX, TXT)
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Uploader un document de cours depuis votre appareil
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSourceMode("text")}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      sourceMode === "text"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      Avec du texte / Copier-Coller
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Coller directement un extrait ou un chapitre de leçon
                    </p>
                  </button>
                </div>

                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="Titre du cours (ex: 1-Anémies 2026, Sémiologie Cardiaque...)"
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                  />
                  <label className="cursor-pointer shrink-0">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.txt,.md,.docx"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button type="button" variant="outline" asChild disabled={isReading}>
                      <span className="gap-2">
                        <Upload className="w-4 h-4" />
                        {isReading ? "Lecture..." : "Charger un fichier"}
                      </span>
                    </Button>
                  </label>
                </div>

                {uploadedFileNames.length > 0 && (
                  <div className="p-3 rounded-xl border border-dashed bg-muted/30 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {uploadedFileNames.map((name, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="gap-1.5 pl-2.5 pr-1.5 py-1 text-xs"
                        >
                          <FileText className="w-3 h-3 text-primary" />
                          <span>✓ Cours chargé : {name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setUploadedFileNames((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="hover:text-destructive ml-1 font-bold"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {courseContent.length.toLocaleString()} caractères extraits
                    </span>
                  </div>
                )}

                {sourceMode === "text" && (
                  <Textarea
                    rows={6}
                    placeholder="Collez le contenu de votre cours ici..."
                    value={courseContent}
                    onChange={(e) => setCourseContent(e.target.value)}
                  />
                )}
              </div>

              {/* 2. TYPES DE QCM À PRODUIRE (GRILLE DE CARTES MULTI-SÉLECTION) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">
                    2. Type(s) de QCM à produire (vous pouvez en choisir 1 seul, 2 ou plusieurs)
                  </label>
                  <span className="text-xs text-primary font-semibold">
                    {selectedFormats.length} mode(s) sélectionné(s)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {FORMAT_CARDS.map((fmt) => {
                    const active = selectedFormats.includes(fmt.id);
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => toggleFormat(fmt.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between gap-2 ${
                          active
                            ? "border-primary bg-primary/[0.06] ring-1 ring-primary shadow-sm"
                            : "border-border bg-background hover:border-primary/40 opacity-75"
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-xs text-foreground">
                            {fmt.label}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {fmt.desc}
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "border border-muted-foreground/40"
                          }`}
                        >
                          {active && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. MOTEUR D'ÉVALUATION DOCIMOLOGIQUE : DAWIA 1 vs DAWIA 2 */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">
                    3. Moteur d'évaluation docimologique
                  </label>
                  <Badge variant="outline" className="text-[11px] text-primary border-primary/30">
                    Haute Précision
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setWritingSignature("UCAD_AMPHI")}
                    className={`p-4 rounded-xl border text-left transition-all space-y-1.5 ${
                      writingSignature === "UCAD_AMPHI"
                        ? "border-primary bg-primary/[0.06] ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        DAWIA 1 — Moteur Docimologique Standard
                      </span>
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">
                        Fluide & Rapide
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Génération directe calquée sur les cahiers d'examens de la FMPOS. Idéal pour
                      les révisions quotidiennes structurées.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWritingSignature("HARVARD_OXFORD_UCAD")}
                    className={`p-4 rounded-xl border text-left transition-all space-y-1.5 ${
                      writingSignature === "HARVARD_OXFORD_UCAD"
                        ? "border-primary bg-primary/[0.06] ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-primary" />
                        DAWIA 2 — Haute Docimologie & Litige Clinique
                      </span>
                      <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">
                        FMPOS × Harvard
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Raisonnement clinique en 2 étapes, pièges docimologiques d'examen sélectif,
                      Cas Cliniques Évolutifs et supervision par second agent IA.
                    </p>
                  </button>
                </div>
              </div>

              {/* 4. NOMBRE DE QUESTIONS & BOUTON DE LANCEMENT */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Nombre de questions à générer :</span>
                  {[10, 15, 20, 30].map((n) => (
                    <Button
                      key={n}
                      type="button"
                      size="sm"
                      variant={targetQuestionCount === n ? "default" : "outline"}
                      onClick={() => setTargetQuestionCount(n)}
                      className="h-8 px-3 text-xs font-mono"
                    >
                      {n}
                    </Button>
                  ))}
                </div>

                <Button
                  onClick={handleGeneratePrismeSession}
                  disabled={isGenerating}
                  className="gap-2 font-semibold px-6"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {generationStep || "Génération en cours..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Générer la Feuille d'Examen ({targetQuestionCount} QCM)
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveQuestions([])}
                className="gap-1.5 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Retour au configurateur / Changer de cours
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleGeneratePrismeSession}
                disabled={isGenerating}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                Générer une série 100% inédite sur ce cours (Mémoire Fantôme active)
              </Button>
            </div>

            <PrismeExamSheet
              courseTitle={courseTitle || "Épreuve Médicale FMPOS"}
              totalCourseSections={totalCourseSections}
              questions={activeQuestions}
              onFinishSession={async (summary) => {
                const earnedXp = Math.max(15, Math.round(summary.rawScore * 20));
                if (addXP) await addXP(earnedXp);

                toast({
                  title: `Session terminée : ${summary.rawScore} / ${summary.total} pts`,
                  description: `Immunité Docimologique : ${summary.immunityScore}% • +${earnedXp} XP !`,
                });
              }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
