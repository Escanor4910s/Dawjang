// src/components/qcm/PrismeExamSheet.tsx
import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  BookOpen,
  Sparkles,
  CheckCheck,
  Award,
  AlertTriangle,
  Cpu,
  GitCompare,
  Crosshair,
  ShieldCheck,
  HelpCircle,
  ShieldAlert,
  Layers,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  AnswerLetter,
  FacultyQCMType,
  MirrorQuestion,
  PrismeQCMQuestion,
  TrapCategory,
  evaluateFacultyQuestionScore,
  sanitizeAndRepairQuestion,
} from "@/lib/prismeEngine";

interface PrismeExamSheetProps {
  courseTitle: string;
  totalCourseSections: number;
  questions: PrismeQCMQuestion[];
  onFinishSession: (summary: {
    rawScore: number;
    total: number;
    immunityScore: number;
    cancelledByFalseCount: number;
    answers: Record<string, AnswerLetter[]>;
  }) => Promise<void>;
}

const TRAP_COLORS: Record<TrapCategory, string> = {
  INVERSION_TOPOGRAPHIQUE: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  CONFUSION_SYNDROMIQUE: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  STADE_CLASSIFICATION: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
  INTENTION_DIAG_THERAP: "bg-teal-500/10 text-teal-600 border-teal-500/30",
  EXCLUSIVITE_ABUSIVE: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  INVERSION_MECANISME: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  FAUX_LIEN_CAUSAL: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  DONNEE_CHIFFREE_ALTEREE: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  PROPOSITION_EXACTE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
};

const TYPE_META: Record<
  FacultyQCMType,
  { label: string; badgeClass: string; defaultInstruction: string }
> = {
  ELECTION: {
    label: "ÉLECTION (QCU)",
    badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    defaultInstruction: "Une seule proposition est exacte. Cocher la lettre correspondante.",
  },
  CENSURE: {
    label: "CENSURE (SAUF UN)",
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    defaultInstruction: "Cocher la lettre correspondant à l'unique proposition FAUSSE / INEXACTE.",
  },
  GROUPAGE: {
    label: "COMPLÉMENTS GROUPÉS",
    badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    defaultInstruction: "Code officiel : A = 1+2+3 | B = 1+3 | C = 2+4 | D = 4 | E = Autre choix",
  },
  JUMELAGE: {
    label: "JUMELAGE (CAUSE À EFFET)",
    badgeClass: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    defaultInstruction:
      "A = Vrai-Vrai lié | B = Vrai-Vrai non lié | C = Vrai-Faux | D = Faux-Vrai | E = Faux-Faux",
  },
  COMPLEMENTS_MULTIPLES: {
    label: "CHOIX MULTIPLES (SÉMIO / TOR)",
    badgeClass: "bg-rose-500/15 text-rose-600 border-rose-500/30",
    defaultInstruction:
      "Toute réponse juste est annotée. UNE SEULE réponse fausse cochée annule toute la question (0 pt) !",
  },
  ASSOCIATION: {
    label: "ASSOCIATION (APPARIEMENT)",
    badgeClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    defaultInstruction:
      "Associez chaque élément de la Liste 1 (1 à 4) à la Liste 2 (A à D) et choisissez la combinaison exacte.",
  },
};

export const PrismeExamSheet: React.FC<PrismeExamSheetProps> = ({
  courseTitle,
  totalCourseSections,
  questions: rawQuestions,
  onFinishSession,
}) => {
  // Nettoyage et auto-réparation systématique de toutes les questions reçues
  const questions = useMemo(
    () => rawQuestions.map((q, idx) => sanitizeAndRepairQuestion(q, idx + 1)),
    [rawQuestions]
  );

  // PAR DÉFAUT : Mode "sheet" (Feuille d'examen complète déroulante)
  const [viewMode, setViewMode] = useState<"sheet" | "single">("sheet");
  const [singleIdx, setSingleIdx] = useState<number>(0);

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, AnswerLetter[]>>({});
  const [revealedQuestions, setRevealedQuestions] = useState<Record<string, boolean>>({});
  const [instantValidationQCS, setInstantValidationQCS] = useState<boolean>(true);
  const [activeMirror, setActiveMirror] = useState<Record<string, MirrorQuestion | null>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // États des Solveurs Tactiques (Groupage, Jumelage & Association)
  const [groupageDraft, setGroupageDraft] = useState<
    Record<string, Record<number, boolean | null>>
  >({});
  const [jumelageDraft, setJumelageDraft] = useState<
    Record<string, { s1?: boolean; s2?: boolean; causal?: boolean }>
  >({});
  const [associationDraft, setAssociationDraft] = useState<
    Record<string, Record<number, string>>
  >({});

  const computeGroupageElimination = (
    q: PrismeQCMQuestion
  ): Record<AnswerLetter, boolean> => {
    const draft = groupageDraft[q.id] || {};
    const seekTrue = q.polarity === "CHERCHER_VRAIES";

    const patterns: Record<"A" | "B" | "C" | "D", Record<number, boolean>> = {
      A: { 1: true, 2: true, 3: true, 4: false },
      B: { 1: true, 2: false, 3: true, 4: false },
      C: { 1: false, 2: true, 3: false, 4: true },
      D: { 1: false, 2: false, 3: false, 4: true },
    };

    const eliminated: Record<AnswerLetter, boolean> = {
      A: false,
      B: false,
      C: false,
      D: false,
      E: false,
    };

    (["A", "B", "C", "D"] as const).forEach((letter) => {
      for (const num of [1, 2, 3, 4]) {
        const userJudgedTrue = draft[num];
        if (userJudgedTrue !== undefined && userJudgedTrue !== null) {
          const shouldBeIncludedInCode = seekTrue ? userJudgedTrue : !userJudgedTrue;
          if (shouldBeIncludedInCode !== patterns[letter][num]) {
            eliminated[letter] = true;
          }
        }
      }
    });

    const allFourKnown = [1, 2, 3, 4].every(
      (n) => draft[n] !== undefined && draft[n] !== null
    );
    if (allFourKnown) {
      const matchesStandard = (["A", "B", "C", "D"] as const).some(
        (l) => !eliminated[l]
      );
      if (matchesStandard) eliminated.E = true;
    }

    return eliminated;
  };

  const computeJumelageSuggestion = (qId: string): AnswerLetter | null => {
    const d = jumelageDraft[qId];
    if (!d || d.s1 === undefined || d.s2 === undefined) return null;
    if (d.s1 && d.s2) {
      if (d.causal === undefined) return null;
      return d.causal ? "A" : "B";
    }
    if (d.s1 && !d.s2) return "C";
    if (!d.s1 && d.s2) return "D";
    return "E";
  };

  const handleToggleOption = (q: PrismeQCMQuestion, letter: AnswerLetter) => {
    if (revealedQuestions[q.id]) return;

    if (q.type === "COMPLEMENTS_MULTIPLES") {
      setSelectedAnswers((prev) => {
        const current = prev[q.id] || [];
        const exists = current.includes(letter);
        const updated = exists
          ? current.filter((l) => l !== letter)
          : [...current, letter].sort();
        return { ...prev, [q.id]: updated };
      });
    } else {
      setSelectedAnswers((prev) => ({ ...prev, [q.id]: [letter] }));
      if (instantValidationQCS) {
        setRevealedQuestions((prev) => ({ ...prev, [q.id]: true }));
      }
    }
  };

  const stats = useMemo(() => {
    let rawScore = 0;
    let perfectCount = 0;
    let partialCount = 0;
    let cancelledByFalseCount = 0;
    let wrongCount = 0;
    let answeredCount = 0;
    let weightedPoints = 0;
    let maxWeightedPoints = 0;

    const sectionStatus: Record<number, "untested" | "mastered" | "partial" | "failed"> = {};
    for (let i = 0; i < totalCourseSections; i++) {
      sectionStatus[i] = "untested";
    }

    questions.forEach((q) => {
      const userLetters = selectedAnswers[q.id] || [];
      if (userLetters.length > 0) answeredCount++;

      const weight = q.mutationLevel;
      maxWeightedPoints += weight;

      if (revealedQuestions[q.id]) {
        const evalResult = evaluateFacultyQuestionScore(q, userLetters);
        rawScore += evalResult.score;
        weightedPoints += evalResult.score * weight;

        if (evalResult.status === "perfect") {
          perfectCount++;
          if (sectionStatus[q.sectionIndex] === "untested") {
            sectionStatus[q.sectionIndex] = "mastered";
          }
        } else if (evalResult.status === "partial_safe") {
          partialCount++;
          if (sectionStatus[q.sectionIndex] !== "failed") {
            sectionStatus[q.sectionIndex] = "partial";
          }
        } else if (evalResult.status === "cancelled_by_false") {
          cancelledByFalseCount++;
          wrongCount++;
          sectionStatus[q.sectionIndex] = "failed";
        } else if (evalResult.status === "wrong") {
          wrongCount++;
          sectionStatus[q.sectionIndex] = "failed";
        }
      }
    });

    return {
      answeredCount,
      rawScore: Number(rawScore.toFixed(2)),
      perfectCount,
      partialCount,
      cancelledByFalseCount,
      wrongCount,
      immunityScore: Math.round((weightedPoints / Math.max(1, maxWeightedPoints)) * 100),
      sectionStatus,
    };
  }, [questions, selectedAnswers, revealedQuestions, totalCourseSections]);

  const revealAll = () => {
    const all: Record<string, boolean> = {};
    questions.forEach((q) => (all[q.id] = true));
    setRevealedQuestions(all);
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      revealAll();
      let finalScore = 0;
      let finalCancelled = 0;
      questions.forEach((q) => {
        const res = evaluateFacultyQuestionScore(q, selectedAnswers[q.id] || []);
        finalScore += res.score;
        if (res.status === "cancelled_by_false") finalCancelled++;
      });

      await onFinishSession({
        rawScore: Number(finalScore.toFixed(2)),
        total: questions.length,
        immunityScore: stats.immunityScore,
        cancelledByFalseCount: finalCancelled,
        answers: selectedAnswers,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedQuestions =
    viewMode === "sheet" ? questions : [questions[singleIdx]].filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto pb-32 space-y-6">
      {/* =====================================================================
          BARRE SUPÉRIEURE : RADAR ADN DE COUVERTURE DU COURS & CONTRÔLES 1-LIGNE
         ===================================================================== */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b p-4 shadow-sm rounded-b-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
            <span className="font-bold text-sm truncate">{courseTitle}</span>
            <Badge variant="secondary" className="text-xs font-mono shrink-0">
              Immunité : {stats.immunityScore}%
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs">
              ✓ {stats.perfectCount}
            </Badge>
            {stats.partialCount > 0 && (
              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-xs">
                ½ {stats.partialCount} partiels
              </Badge>
            )}
            {stats.cancelledByFalseCount > 0 && (
              <Badge
                className="bg-rose-600 text-white text-xs animate-pulse"
                title="Questions annulées à cause d'au moins une proposition fausse cochée"
              >
                ☠ {stats.cancelledByFalseCount} annulée(s)
              </Badge>
            )}

            <Button
              size="sm"
              variant={instantValidationQCS ? "default" : "outline"}
              onClick={() => setInstantValidationQCS(!instantValidationQCS)}
              className="h-7 text-xs gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Validation directe : {instantValidationQCS ? "ON" : "OFF"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setViewMode(viewMode === "sheet" ? "single" : "sheet")}
              className="h-7 text-xs gap-1"
            >
              {viewMode === "sheet" ? (
                <>
                  <Layers className="w-3 h-3" /> Mode 1 par 1
                </>
              ) : (
                <>
                  <LayoutList className="w-3 h-3" /> Feuille complète ({questions.length} QCM)
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Radar ADN de couverture des segments de la leçon */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Radar ADN de couverture intégrale de la leçon ({totalCourseSections} segments)
            </span>
            <span>
              Score UCAD : <strong>{stats.rawScore}</strong> / {questions.length} pts (
              {stats.answeredCount}/{questions.length} traitées)
            </span>
          </div>
          <div className="grid grid-flow-col auto-cols-fr gap-1 h-2 w-full">
            {Array.from({ length: Math.max(1, totalCourseSections) }).map((_, idx) => {
              const st = stats.sectionStatus[idx];
              return (
                <div
                  key={idx}
                  title={`Segment #${idx + 1} du cours`}
                  className={`rounded-full transition-colors ${
                    st === "mastered"
                      ? "bg-emerald-500"
                      : st === "partial"
                      ? "bg-amber-500"
                      : st === "failed"
                      ? "bg-rose-500"
                      : "bg-muted"
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          LISTE COMPLÈTE DES QCM (MODE FEUILLE PAR DÉFAUT)
         ===================================================================== */}
      <div className="space-y-6">
        {displayedQuestions.map((q) => {
          const meta = TYPE_META[q.type] || TYPE_META.ELECTION;
          const userLetters = selectedAnswers[q.id] || [];
          const isRevealed = !!revealedQuestions[q.id];
          const evaluation = evaluateFacultyQuestionScore(q, userLetters);
          const isInvertedPolarity = q.polarity === "CHERCHER_FAUSSES";

          const eliminatedMap =
            q.type === "GROUPAGE" ? computeGroupageElimination(q) : null;
          const jumelageSuggestion =
            q.type === "JUMELAGE" ? computeJumelageSuggestion(q.id) : null;

          return (
            <Card
              key={q.id}
              className={`p-5 transition-all border-l-4 space-y-4 ${
                isRevealed
                  ? evaluation.status === "perfect"
                    ? "border-l-emerald-500 bg-emerald-500/[0.02]"
                    : evaluation.status === "partial_safe"
                    ? "border-l-amber-500 bg-amber-500/[0.02]"
                    : "border-l-rose-500 bg-rose-500/[0.02]"
                  : "border-l-primary/50"
              }`}
            >
              {/* CAS CLINIQUE ÉVOLUTIF (SI PRÉSENT) */}
              {q.clinicalCase && (
                <div className="space-y-3 mb-2">
                  {q.clinicalCase.initialPresentation && (
                    <div className="p-4 rounded-xl bg-primary/[0.05] border-2 border-primary/25 space-y-2 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge className="bg-primary text-primary-foreground font-bold text-xs">
                          📋 CAS CLINIQUE #{q.clinicalCase.caseNumber} — {q.clinicalCase.caseTitle}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-xs font-mono border-primary/30 text-primary"
                        >
                          {q.clinicalCase.clinicalStageLabel}
                        </Badge>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground font-normal">
                        {q.clinicalCase.initialPresentation}
                      </p>
                    </div>
                  )}

                  {q.clinicalCase.narrativeUpdate && (
                    <div className="p-3.5 rounded-lg bg-amber-500/[0.08] border-l-4 border-l-amber-500 border border-amber-500/20 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-400">
                        <span>⚡ ÉVOLUTION DU CAS CLINIQUE #{q.clinicalCase.caseNumber}</span>
                        <span className="font-mono">{q.clinicalCase.clinicalStageLabel}</span>
                      </div>
                      <p className="text-sm text-foreground/95 italic">
                        « {q.clinicalCase.narrativeUpdate} »
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* EN-TÊTE DE LA QUESTION */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                    Q{q.number}
                  </span>
                  <Badge variant="outline" className={`text-xs font-semibold ${meta.badgeClass}`}>
                    {meta.label}
                  </Badge>

                  <Badge
                    variant="outline"
                    className={
                      isInvertedPolarity
                        ? "bg-rose-500/15 text-rose-600 border-rose-500/40 font-bold text-xs"
                        : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs"
                    }
                  >
                    {isInvertedPolarity
                      ? "⚠️ CHERCHER LES FAUSSES"
                      : "✓ CHERCHER LES VRAIES"}
                  </Badge>

                  <Badge variant="secondary" className="text-[11px] gap-1">
                    <Cpu className="w-3 h-3" />
                    Niv. {q.mutationLevel}/4
                  </Badge>

                  <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                    • {q.sectionTitle}
                  </span>
                </div>

                {/* Bouton individuel Valider / Voir la réponse */}
                <div className="flex items-center gap-2">
                  {isRevealed && (
                    <Badge
                      className={
                        evaluation.status === "perfect"
                          ? "bg-emerald-600 text-white"
                          : evaluation.status === "partial_safe"
                          ? "bg-amber-500 text-white"
                          : "bg-rose-600 text-white"
                      }
                    >
                      {evaluation.status === "cancelled_by_false"
                        ? "0 pt (ANNULÉE PAR 1 FAUSSE)"
                        : `${evaluation.score} / 1 pt`}
                    </Badge>
                  )}

                  <Button
                    variant={
                      !isRevealed && userLetters.length > 0 ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() =>
                      setRevealedQuestions((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                    }
                    className="h-7 text-xs gap-1.5"
                  >
                    {isRevealed ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" /> Masquer la correction
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        {userLetters.length > 0
                          ? "Valider ma réponse"
                          : "Voir la réponse"}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* BANDEAU D'INSTRUCTION DOCIMOLOGIQUE */}
              <div
                className={`text-xs px-3 py-2 rounded-md flex items-center justify-between gap-2 ${
                  isInvertedPolarity
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                    : "bg-muted/50 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isInvertedPolarity ? (
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-primary shrink-0" />
                  )}
                  <span>{meta.defaultInstruction}</span>
                </div>
                {q.type === "COMPLEMENTS_MULTIPLES" && (
                  <span className="font-mono font-semibold shrink-0">
                    Cochées : {userLetters.length > 0 ? userLetters.join(", ") : "Aucune"}
                  </span>
                )}
              </div>

              {/* ÉNONCÉ PRINCIPAL */}
              <h3 className="font-semibold text-base leading-snug whitespace-pre-line">
                {q.stem}
              </h3>

              {/* =================================================================
                  TABLEAU D'ASSOCIATION TOUJOURS VISIBLE (CORRIGE LE BUG DE LA CAPTURE)
                 ================================================================= */}
              {q.type === "ASSOCIATION" && q.associationMatrix && (
                <div className="p-4 rounded-xl bg-indigo-500/[0.04] border-2 border-indigo-500/20 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-indigo-500/15 pb-2">
                    <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <Link2 className="w-4 h-4" />
                      TABLEAU D'APPARIEMENT DOCIMOLOGIQUE (Associez 1..4 avec A..D)
                    </span>
                    <span className="text-muted-foreground">
                      Cliquez sur les lettres à droite de chaque numéro pour composer votre brouillon
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {/* Colonne 1 : Éléments numérotés 1 à 4 */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {q.associationMatrix.leftColumnTitle || "Liste 1 (Éléments numérotés 1 à 4)"}
                      </div>
                      {q.associationMatrix.leftItems.map((item) => {
                        const selectedCode = associationDraft[q.id]?.[item.num];
                        return (
                          <div
                            key={item.num}
                            className="p-2.5 rounded-lg bg-background border flex items-start justify-between gap-2 shadow-sm"
                          >
                            <div className="flex items-start gap-2">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary font-mono font-bold text-xs shrink-0">
                                {item.num}
                              </span>
                              <span className="font-medium leading-snug">{item.text}</span>
                            </div>

                            {/* Mini-sélecteur d'appariement rapide 1 -> A/B/C/D */}
                            {!isRevealed && (
                              <div className="flex items-center gap-1 shrink-0">
                                {q.associationMatrix!.rightItems.map((rItem) => {
                                  const codeUp = rItem.code.toUpperCase();
                                  const isPicked = selectedCode === codeUp;
                                  return (
                                    <button
                                      key={codeUp}
                                      type="button"
                                      onClick={() =>
                                        setAssociationDraft((prev) => ({
                                          ...prev,
                                          [q.id]: {
                                            ...(prev[q.id] || {}),
                                            [item.num]: isPicked ? "" : codeUp,
                                          },
                                        }))
                                      }
                                      className={`w-5 h-5 rounded text-[10px] font-bold border transition-all ${
                                        isPicked
                                          ? "bg-indigo-600 text-white border-indigo-600"
                                          : "bg-muted/50 text-muted-foreground hover:border-indigo-400"
                                      }`}
                                      title={`Associer ${item.num} avec ${codeUp}`}
                                    >
                                      {codeUp}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Colonne 2 : Cibles lettrées A à D (ou a à d) */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {q.associationMatrix.rightColumnTitle || "Liste 2 (Cibles à apparier A à D)"}
                      </div>
                      {q.associationMatrix.rightItems.map((item) => (
                        <div
                          key={item.code}
                          className="p-2.5 rounded-lg bg-background border flex items-start gap-2.5 shadow-sm"
                        >
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-mono font-bold text-xs shrink-0">
                            {item.code.toUpperCase()}
                          </span>
                          <span className="leading-snug">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================================
                  SOLVEUR TACTIQUE GROUPAGE (PROPOSITIONS 1 À 4 TOUJOURS VISIBLES)
                 ================================================================= */}
              {q.type === "GROUPAGE" && q.numberedPropositions && (
                <div className="p-3.5 rounded-xl bg-muted/30 border space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pb-1.5 border-b">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Crosshair className="w-3.5 h-3.5 text-primary" />
                      Solveur Tactique Groupage (cliquez V ou F : le code filtre automatiquement les{" "}
                      <strong>{isInvertedPolarity ? "FAUSSES" : "VRAIES"}</strong>)
                    </span>
                    <span className="font-mono">A=1+2+3 | B=1+3 | C=2+4 | D=4 | E=Autre</span>
                  </div>

                  {q.numberedPropositions.map((prop) => {
                    const draftVal = groupageDraft[q.id]?.[prop.num];
                    return (
                      <div key={prop.num} className="space-y-1 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <span className="font-mono font-bold text-primary">
                              {prop.num}-
                            </span>
                            <span>{prop.text}</span>
                          </div>

                          {!isRevealed ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setGroupageDraft((prev) => ({
                                    ...prev,
                                    [q.id]: {
                                      ...(prev[q.id] || {}),
                                      [prop.num]: draftVal === true ? null : true,
                                    },
                                  }))
                                }
                                className={`px-2 py-0.5 text-xs font-bold rounded border ${
                                  draftVal === true
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-background text-muted-foreground"
                                }`}
                              >
                                V
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setGroupageDraft((prev) => ({
                                    ...prev,
                                    [q.id]: {
                                      ...(prev[q.id] || {}),
                                      [prop.num]: draftVal === false ? null : false,
                                    },
                                  }))
                                }
                                className={`px-2 py-0.5 text-xs font-bold rounded border ${
                                  draftVal === false
                                    ? "bg-rose-600 text-white border-rose-600"
                                    : "bg-background text-muted-foreground"
                                }`}
                              >
                                F
                              </button>
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className={
                                prop.isTrueInCourse
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 shrink-0"
                                  : "bg-rose-500/10 text-rose-600 border-rose-500/30 shrink-0"
                              }
                            >
                              {prop.isTrueInCourse ? "VRAI DANS LE COURS" : "FAUX DANS LE COURS"}
                            </Badge>
                          )}
                        </div>

                        {isRevealed && prop.feedback && (
                          <div className="pl-5 text-xs text-muted-foreground italic">
                            ↳ {prop.feedback}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* =================================================================
                  SOLVEUR TACTIQUE JUMELAGE (CAUSE À EFFET TOUJOURS VISIBLE)
                 ================================================================= */}
              {q.type === "JUMELAGE" && q.jumelagePair && (
                <div className="p-4 rounded-xl bg-muted/30 border space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-1.5">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Crosshair className="w-3.5 h-3.5 text-primary" />
                      Décodeur Cause à Effet
                    </span>
                    {jumelageSuggestion && !isRevealed && (
                      <Badge className="bg-primary/20 text-primary border-primary/30">
                        Déduction logique → Lettre {jumelageSuggestion}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-background p-2.5 rounded-lg border">
                    <span className="text-sm font-medium">
                      1. « {q.jumelagePair.statement1} »
                    </span>
                    {!isRevealed ? (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant={jumelageDraft[q.id]?.s1 === true ? "default" : "outline"}
                          className="h-6 px-2 text-xs"
                          onClick={() =>
                            setJumelageDraft((p) => ({
                              ...p,
                              [q.id]: { ...p[q.id], s1: true },
                            }))
                          }
                        >
                          Vrai
                        </Button>
                        <Button
                          size="sm"
                          variant={jumelageDraft[q.id]?.s1 === false ? "destructive" : "outline"}
                          className="h-6 px-2 text-xs"
                          onClick={() =>
                            setJumelageDraft((p) => ({
                              ...p,
                              [q.id]: { ...p[q.id], s1: false },
                            }))
                          }
                        >
                          Faux
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline">
                        {q.jumelagePair.statement1True ? "VRAI" : "FAUX"}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-primary">
                      — {q.jumelagePair.connector} —
                    </span>
                    {jumelageDraft[q.id]?.s1 && jumelageDraft[q.id]?.s2 && !isRevealed && (
                      <div className="flex items-center gap-1 text-xs">
                        <span>Lien causal ?</span>
                        <Button
                          size="sm"
                          variant={jumelageDraft[q.id]?.causal === true ? "default" : "outline"}
                          className="h-6 px-2 text-xs"
                          onClick={() =>
                            setJumelageDraft((p) => ({
                              ...p,
                              [q.id]: { ...p[q.id], causal: true },
                            }))
                          }
                        >
                          Oui (A)
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            jumelageDraft[q.id]?.causal === false ? "secondary" : "outline"
                          }
                          className="h-6 px-2 text-xs"
                          onClick={() =>
                            setJumelageDraft((p) => ({
                              ...p,
                              [q.id]: { ...p[q.id], causal: false },
                            }))
                          }
                        >
                          Non (B)
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-background p-2.5 rounded-lg border">
                    <span className="text-sm font-medium">
                      2. « {q.jumelagePair.statement2} »
                    </span>
                    {!isRevealed ? (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant={jumelageDraft[q.id]?.s2 === true ? "default" : "outline"}
                          className="h-6 px-2 text-xs"
                          onClick={() =>
                            setJumelageDraft((p) => ({
                              ...p,
                              [q.id]: { ...p[q.id], s2: true },
                            }))
                          }
                        >
                          Vrai
                        </Button>
                        <Button
                          size="sm"
                          variant={jumelageDraft[q.id]?.s2 === false ? "destructive" : "outline"}
                          className="h-6 px-2 text-xs"
                          onClick={() =>
                            setJumelageDraft((p) => ({
                              ...p,
                              [q.id]: { ...p[q.id], s2: false },
                            }))
                          }
                        >
                          Faux
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline">
                        {q.jumelagePair.statement2True ? "VRAI" : "FAUX"}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* =================================================================
                  GRILLE DES 5 PROPOSITIONS A, B, C, D, E + AUTOPSIE + MIROIR
                 ================================================================= */}
              <div className="space-y-2">
                {q.options.map((opt) => {
                  const isSelected = userLetters.includes(opt.letter);
                  const isTarget = q.correctLetters.includes(opt.letter);
                  const isEliminatedByTactic =
                    !isRevealed && eliminatedMap?.[opt.letter] === true;
                  const isSuggestedByJumelage =
                    !isRevealed && jumelageSuggestion === opt.letter;

                  return (
                    <div
                      key={opt.letter}
                      onClick={() => handleToggleOption(q, opt.letter)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isRevealed
                          ? isTarget
                            ? "border-emerald-500 bg-emerald-500/10"
                            : isSelected && !isTarget
                            ? "border-rose-500 bg-rose-500/15 ring-1 ring-rose-500"
                            : "border-border/60 opacity-80"
                          : isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : isSuggestedByJumelage
                          ? "border-primary/60 bg-primary/5"
                          : isEliminatedByTactic
                          ? "opacity-35 line-through bg-muted/40"
                          : "hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                            isRevealed && isTarget
                              ? "bg-emerald-600 text-white"
                              : isRevealed && isSelected && !isTarget
                              ? "bg-rose-600 text-white"
                              : isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {opt.letter}
                        </span>

                        <div className="flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium">{opt.label}</span>

                            <div className="flex items-center gap-1.5">
                              {isRevealed && isTarget && !isSelected && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-amber-500 text-amber-600"
                                >
                                  À cocher (oubliée)
                                </Badge>
                              )}

                              {isRevealed && isSelected && !isTarget && (
                                <Badge className="bg-rose-600 text-white text-[10px]">
                                  {q.type === "COMPLEMENTS_MULTIPLES"
                                    ? "☠ COCHE FATALE (ANNULE LA QUESTION)"
                                    : "Erreur"}
                                </Badge>
                              )}

                              {isRevealed && opt.trapBadgeLabel && (
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] ${
                                    TRAP_COLORS[opt.trapCategory] || TRAP_COLORS.CONFUSION_SYNDROMIQUE
                                  }`}
                                >
                                  {opt.trapBadgeLabel}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {isRevealed && (
                            <div className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2.5 space-y-1.5">
                              <p>{opt.feedback}</p>

                              {opt.mirrorQuestion && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const key = `${q.id}_${opt.letter}`;
                                    setActiveMirror((prev) => ({
                                      ...prev,
                                      [key]: prev[key] ? null : opt.mirrorQuestion!,
                                    }));
                                  }}
                                  className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary"
                                >
                                  <GitCompare className="w-3 h-3" />
                                  Tester la Question Miroir inverse
                                </Button>
                              )}

                              {activeMirror[`${q.id}_${opt.letter}`] && (
                                <div className="p-2.5 rounded bg-background border border-primary/20 space-y-1 not-italic">
                                  <div className="font-semibold text-foreground flex items-center gap-1">
                                    <HelpCircle className="w-3.5 h-3.5 text-primary" />
                                    QCM Miroir : {activeMirror[`${q.id}_${opt.letter}`]?.stem}
                                  </div>
                                  <div className="text-emerald-600 font-medium">
                                    → {activeMirror[`${q.id}_${opt.letter}`]?.answer}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    Ancrage cours : «{" "}
                                    {activeMirror[`${q.id}_${opt.letter}`]?.courseAnchor} »
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {isRevealed && isTarget && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        )}
                        {isRevealed && isSelected && !isTarget && (
                          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CITATION EXACTE DU COURS */}
              {isRevealed && q.exactCourseQuote && (
                <div className="pt-3 border-t flex items-start gap-2 text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg">
                  <BookOpen className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground">
                      Réponse(s) attendue(s) : [{q.correctLetters.join(", ")}] — Preuve dans le
                      cours ({q.sectionTitle}) :{" "}
                    </span>
                    <span className="italic">« {q.exactCourseQuote} »</span>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Navigation si Mode 1 par 1 */}
      {viewMode === "single" && questions.length > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={singleIdx === 0}
            onClick={() => setSingleIdx((i) => Math.max(0, i - 1))}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Précédent
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            Question {singleIdx + 1} / {questions.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={singleIdx === questions.length - 1}
            onClick={() => setSingleIdx((i) => Math.min(questions.length - 1, i + 1))}
            className="gap-1"
          >
            Suivant <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* =====================================================================
          PIED DE FEUILLE FIXE : BOUTON FINAL "TERMINER LA SESSION"
         ===================================================================== */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm">
            <Award className="w-5 h-5 text-primary" />
            <span>
              Score UCAD : <strong>{stats.rawScore}</strong> / {questions.length} • Immunité :{" "}
              <strong>{stats.immunityScore}%</strong>
              {stats.cancelledByFalseCount > 0 && (
                <span className="text-rose-600 ml-2 font-medium">
                  ({stats.cancelledByFalseCount} annulée(s) par coche fausse)
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={revealAll} className="gap-1.5">
              <CheckCheck className="w-4 h-4" />
              Tout corriger sur la page
            </Button>
            <Button
              size="sm"
              onClick={handleFinish}
              disabled={isSubmitting}
              className="font-semibold px-5"
            >
              {isSubmitting ? "Enregistrement..." : "Terminer la session"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
