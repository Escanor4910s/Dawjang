import React from "react";
import {
  BookOpen,
  Sparkles,
  PenTool,
  Play,
  Flag,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  BookMarked,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { sanitizeQcmOptionText, cleanMedicalCourseTitle } from "@/lib/annalesMimicryEngine";

// ============================================================================
// 1. NORMALISATEUR UNIVERSEL D'UNE QUESTION (ZÉRO CHAMP VIDE POSSIBLE)
// ============================================================================

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const FORMAT_LABELS: Record<string, string> = {
  election: "Élection (QCU • 1 réponse juste)",
  qcu: "Élection (QCU • 1 réponse juste)",
  choix_multiple: "QCM à Choix Multiples (A–E)",
  multiple: "QCM à Choix Multiples (A–E)",
  classic: "QCM à Choix Multiples (A–E)",
  censure: "Censure (« SAUF UNE » • Identifier l'affirmation FAUSSE)",
  groupage: "Groupage Docimologique (Assertions 1 à 5)",
  jumelage: "Jumelage Causal (Assertion I PARCE QUE Assertion II)",
  association: "Association Docimologique (Appariement 1–4 ↔ A–D)",
};

export function normalizeQuestionForDisplay(rawQ: any, index: number, deckTitle?: string) {
  const rawFormat = String(rawQ?.format || rawQ?.type || "choix_multiple").toLowerCase();
  const formatLabel = FORMAT_LABELS[rawFormat] || "QCM Docimologique (A–E)";

  const rawSubject =
    rawQ?.subject ||
    rawQ?.category ||
    rawQ?.matiere ||
    deckTitle ||
    "Médecine";
  const subjectLabel = cleanMedicalCourseTitle(rawSubject);

  const rawQuestionText =
    rawQ?.question ||
    rawQ?.stem ||
    rawQ?.enonce ||
    rawQ?.question_text ||
    rawQ?.title ||
    "";

  const defaultQuestionByFormat = rawFormat.includes("censure")
    ? `CENSURE — Concernant « ${subjectLabel} », indiquez la proposition FAUSSE :`
    : rawFormat.includes("election") || rawFormat.includes("qcu")
    ? `ÉLECTION — Parmi les propositions suivantes concernant « ${subjectLabel} », indiquez l'unique proposition exacte :`
    : rawFormat.includes("groupage")
    ? `GROUPAGE — Concernant « ${subjectLabel} », indiquez la combinaison exacte selon le code docimologique :`
    : rawFormat.includes("jumelage")
    ? `JUMELAGE — Concernant « ${subjectLabel} », évaluez la relation causale entre les assertions :`
    : rawFormat.includes("association")
    ? `ASSOCIATION — Concernant « ${subjectLabel} », associez chaque élément à sa proposition :`
    : `Parmi les propositions suivantes concernant « ${subjectLabel} », indiquez celle(s) qui est (sont) exacte(s) :`;

  let questionStem =
    String(rawQuestionText).trim().length > 3
      ? String(rawQuestionText).trim()
      : defaultQuestionByFormat;

  // Nettoyer les mentions de fichiers bruts du type « 1-Anémies 2026 » dans le stem
  questionStem = questionStem
    .replace(/«\s*\d+[-_\s]*([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)*)\s*(?:20\d\d)?(?:\.pdf)?\s*»/gi, "« $1 »")
    .replace(/«\s*cette entité\s*»/gi, "cette pathologie");

  const rawOpts = Array.isArray(rawQ?.options)
    ? rawQ.options
    : Array.isArray(rawQ?.propositions)
    ? rawQ.propositions
    : Array.isArray(rawQ?.choices)
    ? rawQ.choices
    : [];

  const options = rawOpts.map((opt: any, optIdx: number) => {
    const letter = LETTERS[optIdx] || String.fromCharCode(65 + optIdx);

    const rawText =
      typeof opt === "string"
        ? opt
        : opt?.text || opt?.proposition || opt?.assertion || opt?.label || opt?.content || "";

    const cleanText = sanitizeQcmOptionText(
      String(rawText).replace(/^[A-F][\.\)\-\s]+/i, "").trim()
    );

    const isCorrect =
      typeof opt === "object" && typeof opt?.isCorrectSelection === "boolean"
        ? opt.isCorrectSelection
        : typeof opt === "object" && typeof opt?.isCorrect === "boolean"
        ? opt.isCorrect
        : typeof opt === "object" && typeof opt?.correct === "boolean"
        ? opt.correct
        : Array.isArray(rawQ?.correctAnswers)
        ? rawQ.correctAnswers.includes(optIdx) || rawQ.correctAnswers.includes(letter)
        : Array.isArray(rawQ?.correct_answers)
        ? rawQ.correct_answers.includes(optIdx) || rawQ.correct_answers.includes(letter)
        : Array.isArray(rawQ?.correct)
        ? rawQ.correct.includes(optIdx) || rawQ.correct.includes(letter)
        : Array.isArray(rawQ?.reponses_exactes)
        ? rawQ.reponses_exactes.includes(letter) || rawQ.reponses_exactes.includes(optIdx)
        : Array.isArray(rawQ?.answers)
        ? rawQ.answers.includes(optIdx) || rawQ.answers.includes(letter)
        : rawQ?.correctAnswer === optIdx ||
          rawQ?.correctAnswer === letter ||
          rawQ?.correct_answer === optIdx ||
          rawQ?.correct_answer === letter ||
          rawQ?.answer === optIdx ||
          rawQ?.answer === letter ||
          (opt?.truthStatus === "VRAI" && !rawFormat.includes("censure")) ||
          (opt?.truthStatus === "FAUX" && rawFormat.includes("censure"));

    const isCensure = rawFormat.includes("censure");
    const truthStatus: "VRAI" | "FAUX" =
      opt?.truthStatus ||
      (isCensure ? (isCorrect ? "FAUX" : "VRAI") : isCorrect ? "VRAI" : "FAUX");

    const detailedWhy =
      opt?.detailedWhy ||
      opt?.explanation ||
      opt?.justification ||
      (rawQ?.explanations && rawQ.explanations[optIdx]) ||
      (truthStatus === "VRAI"
        ? "Proposition exacte, conforme aux données du cours."
        : "Proposition fausse : comporte une discordance par rapport aux données du cours.");

    return {
      letter,
      text: cleanText || `Proposition ${letter}`,
      isCorrect: Boolean(isCorrect),
      truthStatus,
      detailedWhy,
    };
  });

  return {
    id: rawQ?.id || `q-${index}`,
    rawFormat,
    formatLabel,
    subjectLabel,
    questionStem,
    groupStatements: Array.isArray(rawQ?.groupStatements) ? rawQ.groupStatements : undefined,
    jumelageStatements: rawQ?.jumelageStatements || undefined,
    associationPairs: Array.isArray(rawQ?.associationPairs) ? rawQ.associationPairs : undefined,
    options,
    globalExplanation:
      rawQ?.explanation ||
      rawQ?.globalSynthesis ||
      rawQ?.correction ||
      "Consultez le détail de chaque proposition ci-dessus.",
  };
}

// ============================================================================
// 2. EN-TÊTE MONOLIGNE VERROUILLÉ (IMPOSSIBLE DE PASSER SUR 2 LIGNES)
// ============================================================================

export const LockedSingleLineHeader: React.FC<{
  activeTab: string;
  onSelectTab: (tab: any) => void;
  qcmCount: number;
  hasActiveSession: boolean;
}> = ({ activeTab, onSelectTab, qcmCount, hasActiveSession }) => {
  const navItems = [
    { id: "mes_qcm", label: `Mes QCM (${qcmCount})`, icon: BookOpen },
    { id: "generateur_ia", label: "Générateur IA", icon: Sparkles },
    { id: "constructeur_manuel", label: "Manuel", icon: PenTool },
    ...(hasActiveSession
      ? [{ id: "session_active", label: "Examen", icon: Play, live: true }]
      : []),
  ];

  return (
    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-5 border-b border-border/80">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium text-muted-foreground truncate">
          Studio docimologique • Classique, Censure, Groupage, Jumelage & Association
        </p>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground whitespace-nowrap">
          Constructeur & Banque de QCM
        </h1>
      </div>

      <div
        style={{ flexWrap: "nowrap", whiteSpace: "nowrap" }}
        className="inline-flex flex-nowrap items-center gap-1 p-1.5 rounded-2xl bg-muted/90 border border-border/80 w-fit shrink-0 self-start xl:self-center"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              style={{ whiteSpace: "nowrap" }}
              className={`relative px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all flex items-center gap-2 ${
                active
                  ? "bg-card text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-primary" : ""}`} />
              <span>{item.label}</span>
              {item.live && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 3. LECTEUR DE QUESTION HAUTE COUTURE (AVEC BLOCS GROUPAGE, JUMELAGE, ASSOCIATION)
// ============================================================================

export const EliteQuestionSessionPlayer: React.FC<{
  deckTitle: string;
  rawQuestions: any[];
  currentIndex: number;
  onChangeIndex: (idx: number) => void;
  userSelections: Record<string, string[]>;
  onToggleOption: (questionId: string, letter: string, isSingleChoice: boolean) => void;
  validatedMap: Record<string, boolean>;
  onValidateQuestion: (questionId: string) => void;
  flaggedMap: Record<string, boolean>;
  onToggleFlag: (questionId: string) => void;
  showDetailedMap: Record<string, boolean>;
  onToggleDetailed: (questionId: string) => void;
  elapsedTimeFormatted: string;
  onFinishSession: () => void;
}> = ({
  deckTitle,
  rawQuestions,
  currentIndex,
  onChangeIndex,
  userSelections,
  onToggleOption,
  validatedMap,
  onValidateQuestion,
  flaggedMap,
  onToggleFlag,
  showDetailedMap,
  onToggleDetailed,
  elapsedTimeFormatted,
  onFinishSession,
}) => {
  const normalizedList = rawQuestions.map((q, idx) =>
    normalizeQuestionForDisplay(q, idx, deckTitle)
  );
  const currentQ = normalizedList[currentIndex];
  if (!currentQ) return null;

  const isSingleChoice =
    currentQ.rawFormat.includes("election") ||
    currentQ.rawFormat.includes("qcu") ||
    currentQ.rawFormat.includes("censure") ||
    currentQ.rawFormat.includes("groupage") ||
    currentQ.rawFormat.includes("jumelage") ||
    currentQ.rawFormat.includes("association");
  const isCensure = currentQ.rawFormat.includes("censure");
  const pickedLetters = userSelections[currentQ.id] || [];
  const isValidated = Boolean(validatedMap[currentQ.id]);
  const showDetails = Boolean(showDetailedMap[currentQ.id]);
  const isFlagged = Boolean(flaggedMap[currentQ.id]);

  // Calcul en direct des réussites / échecs pour la progression de l'étudiant
  let exactCount = 0;
  let wrongCount = 0;
  let doneCount = 0;

  normalizedList.forEach((q) => {
    const isDone = Boolean(validatedMap[q.id]);
    if (isDone) {
      doneCount++;
      const userPicked = (userSelections[q.id] || [])
        .map((l: string) => String(l).trim().toUpperCase())
        .slice()
        .sort()
        .join(",");
      const expected = q.options
        .filter((o: any) => o.isCorrect)
        .map((o: any) => String(o.letter).trim().toUpperCase())
        .sort()
        .join(",");
      if (expected.length > 0 && userPicked === expected) {
        exactCount++;
      } else {
        wrongCount++;
      }
    }
  });

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* 1. BARRE SUPÉRIEURE DE NAVIGATION RAPIDE (1, 2, 3, 4, 5...) */}
      <Card className="bg-card border-border/80 rounded-2xl shadow-sm">
        <CardContent className="p-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {normalizedList.map((q, idx) => {
              const isCurr = idx === currentIndex;
              const isDone = Boolean(validatedMap[q.id]);
              const isFlag = Boolean(flaggedMap[q.id]);

              // Vérification d'exactitude de la réponse pour cette question
              const userPicked = (userSelections[q.id] || [])
                .map((l: string) => String(l).trim().toUpperCase())
                .slice()
                .sort()
                .join(",");
              const expected = q.options
                .filter((o: any) => o.isCorrect)
                .map((o: any) => String(o.letter).trim().toUpperCase())
                .sort()
                .join(",");
              const isExact = expected.length > 0 && userPicked === expected;

              let buttonClasses = "";
              if (isDone) {
                if (isExact) {
                  // Si l'étudiant a trouvé la question -> VERT ÉCLATANT (Réussite)
                  buttonClasses = isCurr
                    ? "bg-emerald-600 text-white border-2 border-emerald-500 shadow-md ring-4 ring-emerald-500/30 scale-110 font-black"
                    : "bg-emerald-500 text-white border border-emerald-600 shadow-sm hover:bg-emerald-600 font-extrabold";
                } else {
                  // Si l'étudiant a faussé / raté la question -> ROUGE FRANC (Erreur)
                  buttonClasses = isCurr
                    ? "bg-rose-600 text-white border-2 border-rose-500 shadow-md ring-4 ring-rose-500/30 scale-110 font-black"
                    : "bg-rose-500 text-white border border-rose-600 shadow-sm hover:bg-rose-600 font-extrabold";
                }
              } else if (isCurr) {
                // Question active en cours de réflexion (Non encore validée -> Bleu/Indigo distinctif, jamais rouge)
                buttonClasses =
                  "bg-indigo-600 text-white border-2 border-indigo-700 shadow-md ring-4 ring-indigo-500/25 scale-110 font-black";
              } else {
                // Non encore répondue -> Gris neutre
                buttonClasses =
                  "bg-muted/70 text-foreground/80 border-border hover:border-primary/50 hover:bg-muted";
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    if (!isValidated && pickedLetters.length > 0) {
                      onValidateQuestion(currentQ.id);
                    }
                    onChangeIndex(idx);
                  }}
                  title={
                    isDone
                      ? isExact
                        ? `Question ${idx + 1} : Trouvée (Exacte) ✓`
                        : `Question ${idx + 1} : Faussée (Erreur) ✗`
                      : `Question ${idx + 1} (En attente)`
                  }
                  className={`w-9 h-9 rounded-xl text-xs transition-all flex items-center justify-center relative border ${buttonClasses}`}
                >
                  <span>{idx + 1}</span>
                  {isDone && (
                    <span
                      className={`w-2 h-2 rounded-full absolute -top-1 -right-1 border border-white shadow-sm ${
                        isExact ? "bg-emerald-300" : "bg-rose-200"
                      }`}
                    />
                  )}
                  {isFlag && (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-card absolute -top-1 -left-1" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Visualisation en temps réel de la progression de l'étudiant (Vert = Trouvées, Rouge = Faussées) */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border shadow-xs text-xs font-mono font-bold">
              <span
                className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"
                title="Questions trouvées (Exactes)"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="font-extrabold">{exactCount}</span>
                <span className="text-[10px] uppercase font-sans font-medium text-muted-foreground hidden sm:inline">trouvée{exactCount > 1 ? "s" : ""}</span>
              </span>
              <span className="text-muted-foreground/30 font-sans">|</span>
              <span
                className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5"
                title="Questions faussées (Erreurs)"
              >
                <XCircle className="w-4 h-4 text-rose-500" />
                <span className="font-extrabold">{wrongCount}</span>
                <span className="text-[10px] uppercase font-sans font-medium text-muted-foreground hidden sm:inline">faussée{wrongCount > 1 ? "s" : ""}</span>
              </span>
              <span className="text-muted-foreground/30 font-sans">|</span>
              <span
                className="text-muted-foreground flex items-center gap-1"
                title="Questions restantes à traiter"
              >
                <span className="text-[10px] uppercase font-sans font-medium">Reste :</span>
                <span className="font-bold text-foreground">
                  {normalizedList.length - doneCount}
                </span>
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/80 border border-border text-xs font-semibold text-foreground">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>{elapsedTimeFormatted}</span>
            </div>

            <button
              type="button"
              onClick={() => onToggleFlag(currentQ.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                isFlagged
                  ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>À revoir</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 2. CARTE PRINCIPALE DE LA QUESTION */}
      <Card className="bg-card border-border/90 rounded-3xl shadow-md overflow-hidden">
        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* En-tête de la question */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/70">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-primary/12 text-primary border border-primary/25 text-xs font-bold">
                {currentQ.subjectLabel}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  isCensure
                    ? "bg-destructive/10 text-destructive border-destructive/30"
                    : "bg-muted text-foreground border-border"
                }`}
              >
                {currentQ.formatLabel}
              </span>
            </div>

            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Question {currentIndex + 1} / {normalizedList.length}
            </span>
          </div>

          {/* ÉNONCÉ DE LA QUESTION */}
          <div className="p-4 sm:p-5 rounded-2xl bg-muted/40 border-l-4 border-primary space-y-4">
            <h2 className="font-serif text-base sm:text-lg font-bold text-foreground leading-relaxed">
              {currentQ.questionStem}
            </h2>

            {/* BLOC SPÉCIFIQUE GROUPAGE (Assertions 1 à 5) */}
            {currentQ.groupStatements && currentQ.groupStatements.length > 0 && (
              <div className="rounded-xl border border-border/90 bg-card p-4 space-y-2.5">
                <div className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-primary">
                  Assertions soumises au barème de Groupage :
                </div>
                {currentQ.groupStatements.map((stmt: any, sIdx: number) => (
                  <div
                    key={sIdx}
                    className="flex items-start gap-3 text-xs sm:text-sm text-foreground leading-relaxed"
                  >
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary font-mono text-xs font-extrabold">
                      {stmt.num || sIdx + 1}
                    </span>
                    <span className="pt-0.5 font-medium">{stmt.text}</span>
                    {isValidated && typeof stmt.isTrue === "boolean" && (
                      <span
                        className={`ml-auto shrink-0 px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          stmt.isTrue
                            ? "bg-emerald-500/15 text-emerald-700"
                            : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {stmt.isTrue ? "VRAIE" : "FAUSSE"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* BLOC SPÉCIFIQUE JUMELAGE (Assertion I PARCE QUE Assertion II) */}
            {currentQ.jumelageStatements && (
              <div className="rounded-xl border border-border/90 bg-card p-4 space-y-3">
                <div className="space-y-1">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Première Assertion (I)
                  </span>
                  <p className="text-xs sm:text-sm font-semibold text-foreground leading-relaxed">
                    {currentQ.jumelageStatements.statement1}
                  </p>
                </div>
                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="px-3 py-1 rounded-full bg-primary/15 text-primary font-mono text-[11px] font-extrabold tracking-widest uppercase">
                    PARCE QUE
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-1">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Seconde Assertion (II)
                  </span>
                  <p className="text-xs sm:text-sm font-semibold text-foreground leading-relaxed">
                    {currentQ.jumelageStatements.statement2}
                  </p>
                </div>
              </div>
            )}

            {/* BLOC SPÉCIFIQUE ASSOCIATION (Appariement Liste 1..4 <-> Liste A..D) */}
            {currentQ.associationPairs && currentQ.associationPairs.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border/90 bg-card p-4">
                <div className="space-y-2">
                  <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-primary block">
                    Colonne I (Entités numérotées)
                  </span>
                  {currentQ.associationPairs.map((pair: any, pIdx: number) => (
                    <div
                      key={`l-${pIdx}`}
                      className="flex items-start gap-2.5 rounded-lg bg-muted/40 p-2 text-xs text-foreground"
                    >
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground font-mono text-[11px] font-bold">
                        {pair.leftIndex || pIdx + 1}
                      </span>
                      <span className="font-medium leading-snug">{pair.leftText}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-primary block">
                    Colonne II (Cibles lettrées)
                  </span>
                  {currentQ.associationPairs.map((pair: any, pIdx: number) => (
                    <div
                      key={`r-${pIdx}`}
                      className="flex items-start gap-2.5 rounded-lg bg-muted/40 p-2 text-xs text-foreground"
                    >
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-card font-mono text-[11px] font-bold text-primary">
                        {pair.rightLetter || ["A", "B", "C", "D"][pIdx]}
                      </span>
                      <span className="font-medium leading-snug">{pair.rightText}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* LISTE DES PROPOSITIONS AVEC MÉDAILLONS A, B, C, D, E */}
          <div className="space-y-3">
            {currentQ.options.map((opt: any, optIdx: number) => {
              const displayLetter = opt.letter || LETTERS[optIdx] || "A";
              const isSelected = pickedLetters.includes(displayLetter);

              let cardClasses =
                "border-border bg-background/70 hover:bg-muted/30 hover:border-primary/40";
              let badgeClasses =
                "bg-card text-foreground border-2 border-border shadow-sm";

              if (!isValidated && isSelected) {
                cardClasses =
                  "border-primary bg-primary/8 ring-1 ring-primary/30 shadow-sm";
                badgeClasses =
                  "bg-primary text-primary-foreground border-2 border-primary shadow-sm";
              } else if (isValidated) {
                if (opt.isCorrect) {
                  cardClasses =
                    "border-emerald-500/80 bg-emerald-500/10 shadow-sm";
                  badgeClasses =
                    "bg-emerald-600 text-white border-2 border-emerald-600";
                } else if (isSelected && !opt.isCorrect) {
                  cardClasses = "border-destructive/80 bg-destructive/10";
                  badgeClasses =
                    "bg-destructive text-destructive-foreground border-2 border-destructive";
                }
              }

              return (
                <div
                  key={displayLetter}
                  onClick={() => {
                    if (isValidated) return;
                    onToggleOption(currentQ.id, displayLetter, isSingleChoice);
                  }}
                  className={`rounded-2xl border p-4 transition-all duration-150 cursor-pointer ${cardClasses}`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-9 h-9 rounded-xl font-serif font-extrabold text-sm flex items-center justify-center shrink-0 transition-colors select-none ${badgeClasses}`}
                    >
                      {displayLetter}
                    </div>

                    <div className="flex-1 pt-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs sm:text-sm font-medium text-foreground leading-relaxed">
                          {opt.text}
                        </p>

                        {isValidated && (
                          <span className="shrink-0">
                            {opt.isCorrect ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : isSelected ? (
                              <XCircle className="w-5 h-5 text-destructive" />
                            ) : null}
                          </span>
                        )}
                      </div>

                      {isValidated && showDetails && (
                        <div className="mt-2.5 pt-2.5 border-t border-border/70 text-xs space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                                opt.truthStatus === "VRAI"
                                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                  : "bg-destructive/20 text-destructive"
                              }`}
                            >
                              Proposition {opt.truthStatus} dans le cours
                            </span>
                            {opt.isCorrect && (
                              <span className="text-[11px] font-bold text-emerald-600">
                                ✓ Case à cocher
                              </span>
                            )}
                          </div>
                          <p className="text-muted-foreground leading-relaxed">
                            {opt.detailedWhy}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* PIED DE CARTE */}
          <div className="pt-5 border-t border-border/80 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={currentIndex === 0}
              onClick={() => onChangeIndex(Math.max(0, currentIndex - 1))}
              className="rounded-xl text-xs font-bold gap-1.5 h-10"
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </Button>

            <div className="flex flex-wrap items-center gap-2.5">
              {!isValidated ? (
                <Button
                  type="button"
                  disabled={pickedLetters.length === 0}
                  onClick={() => onValidateQuestion(currentQ.id)}
                  className="rounded-xl text-xs font-bold px-6 h-10 shadow-sm"
                >
                  Valider ma réponse
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onToggleDetailed(currentQ.id)}
                  className="rounded-xl text-xs font-bold gap-2 h-10 border border-border"
                >
                  <BookMarked className="w-3.5 h-3.5 text-primary" />
                  <span>
                    {showDetails
                      ? "Masquer les justifications"
                      : "Explication détaillée (Vrai / Faux)"}
                  </span>
                </Button>
              )}

              {currentIndex < normalizedList.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (!isValidated && pickedLetters.length > 0) {
                      onValidateQuestion(currentQ.id);
                    }
                    onChangeIndex(currentIndex + 1);
                  }}
                  className="rounded-xl text-xs font-bold gap-1.5 h-10"
                >
                  <span>Suivant</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    if (!isValidated && pickedLetters.length > 0) {
                      onValidateQuestion(currentQ.id);
                    }
                    onFinishSession();
                  }}
                  className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-10 shadow-sm"
                >
                  Terminer la session
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
