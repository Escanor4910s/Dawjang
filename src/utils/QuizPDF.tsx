import React, { Fragment } from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  PDF_THEMES,
  PdfFontMode,
  PdfThemeKey,
  sanitizePdfText,
} from "./MedicalDocumentPDF";

export interface QuizPdfOptionItem {
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizData {
  title: string;
  subject?: string;
  difficultyLabel?: string;
  formatLabel?: string;
  authorName?: string;
  facultyName?: string;
  theme?: PdfThemeKey;
  fontMode?: PdfFontMode;
  includeAnswerGrid?: boolean;
  includeAnswerKey?: boolean;
  questions: Array<{
    question: string;
    qcmType?: string;
    choices?: string[];
    options?: string[] | Array<{ id?: string; label?: string; text: string; isCorrect?: boolean }>;
    correct?: string[];
    explanation?: string;
  }>;
}

const QCM_TYPE_LABELS: Record<string, string> = {
  election: "QCM D'ÉLECTION • 1 SEUL CHOIX EXACT",
  classique: "QCM À CHOIX MULTIPLES • TOUT OU RIEN",
  censure: "QCM DE CENSURE • IDENTIFIER L'ERREUR",
  groupage: "QCM PAR GROUPAGE • ASSERTIONS 1 À 5",
  jumelage: "QCM DE JUMELAGE • CAUSE À EFFET",
  association: "QCM D'ASSOCIATION • APPARIEMENT CLINIQUE",
};

function normalizeQuestionOptions(q: QuizData["questions"][number]): QuizPdfOptionItem[] {
  const rawOpts = q.options || q.choices || [];
  const correctList = Array.isArray(q.correct) ? q.correct : [];

  return rawOpts.map((opt, idx) => {
    const fallbackLabel = String.fromCharCode(65 + idx);
    if (typeof opt === "string") {
      const cleaned = sanitizePdfText(opt.replace(/^[A-E][.)]\s*/i, ""));
      const isCorrect =
        correctList.includes(opt) ||
        correctList.includes(fallbackLabel) ||
        correctList.some((c) => sanitizePdfText(c) === cleaned);
      return {
        label: fallbackLabel,
        text: cleaned,
        isCorrect,
      };
    }

    const label = sanitizePdfText(opt.label || fallbackLabel);
    const cleaned = sanitizePdfText((opt.text || "").replace(/^[A-E][.)]\s*/i, ""));
    const isCorrect =
      Boolean(opt.isCorrect) ||
      correctList.includes(opt.text) ||
      correctList.includes(label);

    return {
      label,
      text: cleaned,
      isCorrect,
    };
  });
}

/**
 * Sépare l'énoncé principal et les assertions structurées :
 * - Groupage (assertions numérotées 1 à 5)
 * - Jumelage (Première assertion / PARCE QUE / Seconde assertion)
 * - Association (Numéros à associer 1-3 & Propositions lettrées A-E)
 */
function splitQuestionStemAndAssertions(rawQuestion: string): {
  mainStem: string;
  assertions: string[];
} {
  if (!rawQuestion) return { mainStem: "", assertions: [] };

  // Garantir un retour à la ligne avant chaque marqueur docimologique même si l'énoncé a été aplati
  const preSplit = rawQuestion
    .replace(/\s+(?=(?:Premi[èe]re\s+assertion|Seconde\s+assertion|Proposition\s+(?:I|II|1|2))\s*:)/gi, "\n")
    .replace(/\s+(?=PARCE\s+QUE\b)/g, "\n")
    .replace(/\s+(?=(?:Num[ée]ros\s+[àa]\s+associer|Propositions\s+lettr[ée]es))/gi, "\n")
    .replace(/\s+(?=[1-5]\)\s+[A-ZÀ-Ÿ])/g, "\n");

  const lines = preSplit
    .split(/\r?\n/)
    .map((l) => sanitizePdfText(l))
    .filter(Boolean);

  if (lines.length <= 1) {
    return { mainStem: sanitizePdfText(rawQuestion), assertions: [] };
  }

  const mainLines: string[] = [];
  const assertionLines: string[] = [];

  for (const line of lines) {
    if (
      /^(?:[1-5][.)]|Premi[èe]re\s+assertion\s*:|Seconde\s+assertion\s*:|Proposition\s+(?:I|II|1|2)\s*:|PARCE\s+QUE\b|Num[ée]ros\s+[àa]\s+associer|Propositions\s+lettr[ée]es|[A-E][.)]\s+)/i.test(
        line
      )
    ) {
      assertionLines.push(line);
    } else if (assertionLines.length === 0) {
      mainLines.push(line);
    } else {
      assertionLines.push(line);
    }
  }

  return {
    mainStem: mainLines.join(" ") || lines[0],
    assertions: assertionLines,
  };
}

export const QuizPDF = ({
  data,
  theme = "dawjang",
  fontMode = "serif",
  includeAnswerGrid = true,
  includeAnswerKey = true,
}: {
  data: QuizData | QuizData[];
  theme?: PdfThemeKey;
  fontMode?: PdfFontMode;
  includeAnswerGrid?: boolean;
  includeAnswerKey?: boolean;
}) => {
  const quizzes = Array.isArray(data) ? data : [data];
  const firstQuiz = quizzes[0];
  const activeThemeKey = firstQuiz?.theme || theme;
  const activeFontMode = firstQuiz?.fontMode || fontMode;
  const showGrid =
    firstQuiz?.includeAnswerGrid !== undefined
      ? firstQuiz.includeAnswerGrid
      : includeAnswerGrid;
  const showKey =
    firstQuiz?.includeAnswerKey !== undefined
      ? firstQuiz.includeAnswerKey
      : includeAnswerKey;

  const palette = PDF_THEMES[activeThemeKey] || PDF_THEMES.dawjang;
  const bodyFont = activeFontMode === "serif" ? "Times-Roman" : "Helvetica";
  const bodyBold = activeFontMode === "serif" ? "Times-Bold" : "Helvetica-Bold";

  const formattedDate = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const styles = StyleSheet.create({
    page: {
      paddingTop: 38,
      paddingBottom: 38,
      paddingHorizontal: 36,
      backgroundColor: "#FFFFFF",
      fontFamily: bodyFont,
      color: palette.textMain,
    },
    runningHeader: {
      position: "absolute",
      top: 14,
      left: 36,
      right: 36,
      paddingBottom: 4,
      borderBottomWidth: 0.8,
      borderBottomColor: palette.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    runningBrand: {
      fontFamily: "Helvetica-Bold",
      fontSize: 7,
      color: palette.primary,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    runningRight: {
      fontFamily: "Courier-Bold",
      fontSize: 7,
      color: palette.accent,
    },

    // CARTOUCHE D'ÉPREUVE OFFICIEL COMPACT HAUTE DENSITÉ
    examBanner: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      borderRadius: 3,
      marginBottom: 8,
      overflow: "hidden",
    },
    examTopBar: {
      height: 3,
      backgroundColor: palette.primary,
    },
    examAccentBar: {
      height: 1.5,
      backgroundColor: palette.accent,
    },
    examInner: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    examSuperRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    examBadge: {
      backgroundColor: palette.accent,
      paddingVertical: 1.5,
      paddingHorizontal: 6,
      borderRadius: 2,
    },
    examBadgeText: {
      fontFamily: "Helvetica-Bold",
      fontSize: 6.5,
      color: "#FFFFFF",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    examDateText: {
      fontFamily: "Courier-Bold",
      fontSize: 7,
      color: palette.primary,
    },
    examTitle: {
      fontFamily: "Times-Bold",
      fontSize: 15.5,
      color: palette.primary,
      lineHeight: 1.18,
      marginBottom: 5,
    },
    candidateRow: {
      flexDirection: "row",
      borderTopWidth: 0.75,
      borderTopColor: palette.border,
      paddingTop: 5,
    },
    candidateCell: {
      flex: 1,
      paddingRight: 6,
    },
    candidateCellBorder: {
      flex: 1,
      paddingHorizontal: 6,
      borderLeftWidth: 0.75,
      borderLeftColor: palette.border,
    },
    candidateLabel: {
      fontFamily: "Helvetica-Bold",
      fontSize: 6,
      color: palette.textMuted,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: 1.5,
    },
    candidateValue: {
      fontFamily: "Helvetica-Bold",
      fontSize: 7.5,
      color: palette.primary,
    },

    // GRILLE OPTIQUE DE COCHE RAPIDE (5 COLONNES COMPACTES)
    opticalGridBox: {
      borderWidth: 0.8,
      borderColor: palette.accentBorder,
      backgroundColor: palette.accentSoft,
      borderRadius: 3,
      paddingVertical: 5,
      paddingHorizontal: 10,
      marginBottom: 8,
    },
    opticalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottomWidth: 0.6,
      borderBottomColor: palette.accentBorder,
      paddingBottom: 3,
      marginBottom: 4,
    },
    opticalTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: 7,
      color: palette.primary,
      letterSpacing: 0.9,
      textTransform: "uppercase",
    },
    opticalHint: {
      fontFamily: "Helvetica",
      fontSize: 6.5,
      color: palette.textMuted,
    },
    opticalWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    opticalCell: {
      width: "20%",
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 2.5,
      paddingRight: 4,
    },
    opticalQNum: {
      fontFamily: "Courier-Bold",
      fontSize: 7,
      color: palette.primary,
      width: 20,
    },
    opticalBubblesRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    opticalBubble: {
      width: 10.5,
      height: 9.5,
      borderWidth: 0.7,
      borderColor: palette.primary,
      backgroundColor: "#FFFFFF",
      borderRadius: 1.5,
      marginRight: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    opticalBubbleText: {
      fontFamily: "Courier-Bold",
      fontSize: 6,
      color: palette.primary,
    },

    // BLOC QUESTION INDIVIDUELLE — FLUX CONTINU JUSQU'AU PIED DE PAGE (ZÉRO VIDE)
    questionCard: {
      borderWidth: 0.75,
      borderColor: palette.border,
      borderRadius: 3,
      marginBottom: 6,
    },
    questionHeaderBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: palette.surface,
      borderBottomWidth: 0.75,
      borderBottomColor: palette.border,
      paddingVertical: 3.5,
      paddingHorizontal: 9,
    },
    questionNumBadge: {
      backgroundColor: palette.primary,
      paddingVertical: 1,
      paddingHorizontal: 5.5,
      borderRadius: 2,
    },
    questionNumText: {
      fontFamily: "Courier-Bold",
      fontSize: 7,
      color: "#FFFFFF",
      letterSpacing: 0.7,
    },
    questionTypeText: {
      fontFamily: "Helvetica-Bold",
      fontSize: 6.5,
      color: palette.accent,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    questionBody: {
      paddingVertical: 5.5,
      paddingHorizontal: 9,
    },
    questionStemText: {
      fontFamily: bodyBold,
      fontSize: 9.6,
      color: palette.primary,
      lineHeight: 1.32,
      marginBottom: 4,
    },
    assertionsBox: {
      backgroundColor: palette.accentSoft,
      borderLeftWidth: 2.5,
      borderLeftColor: palette.accent,
      paddingVertical: 4,
      paddingHorizontal: 7,
      marginBottom: 4.5,
      borderRadius: 2,
    },
    assertionLine: {
      fontFamily: bodyFont,
      fontSize: 9,
      color: palette.primary,
      lineHeight: 1.3,
      marginBottom: 1.5,
    },
    assertionConnector: {
      fontFamily: "Helvetica-Bold",
      fontSize: 7.5,
      color: palette.accent,
      letterSpacing: 1,
      marginVertical: 2,
    },
    optionsContainer: {
      paddingTop: 1,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 2.2,
    },
    optionCheckSquare: {
      width: 8,
      height: 8,
      borderWidth: 0.85,
      borderColor: palette.primary,
      borderRadius: 1.2,
      marginTop: 1.5,
      marginRight: 5,
    },
    optionLetter: {
      fontFamily: "Courier-Bold",
      fontSize: 9,
      color: palette.accent,
      width: 14,
    },
    optionText: {
      flex: 1,
      fontFamily: bodyFont,
      fontSize: 9.2,
      color: palette.textMain,
      lineHeight: 1.32,
    },

    // PAGE DE CORRIGÉ OFFICIEL
    summaryKeyGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      borderWidth: 0.8,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      borderRadius: 3,
      paddingVertical: 6,
      paddingHorizontal: 9,
      marginBottom: 8,
    },
    summaryKeyCell: {
      width: "20%",
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 2.5,
      paddingRight: 4,
    },
    summaryKeyQ: {
      fontFamily: "Courier-Bold",
      fontSize: 7.5,
      color: palette.textMuted,
      width: 24,
    },
    summaryKeyAns: {
      fontFamily: "Courier-Bold",
      fontSize: 8,
      color: "#047857",
    },
    correctionCard: {
      borderWidth: 0.75,
      borderColor: palette.border,
      borderRadius: 3,
      paddingVertical: 5.5,
      paddingHorizontal: 9,
      marginBottom: 6,
    },
    correctionTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 3,
    },
    correctionQTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: 8.5,
      color: palette.primary,
    },
    exactAnswerBadge: {
      backgroundColor: "#ECFDF5",
      borderWidth: 0.75,
      borderColor: "#A7F3D0",
      paddingVertical: 1,
      paddingHorizontal: 6,
      borderRadius: 2,
    },
    exactAnswerBadgeText: {
      fontFamily: "Courier-Bold",
      fontSize: 7.5,
      color: "#047857",
    },
    correctOptionFullText: {
      fontFamily: bodyBold,
      fontSize: 9,
      color: "#065F46",
      lineHeight: 1.32,
      marginBottom: 3.5,
    },
    explanationBox: {
      backgroundColor: palette.accentSoft,
      borderLeftWidth: 2,
      borderLeftColor: palette.accent,
      paddingVertical: 4,
      paddingHorizontal: 7,
      borderRadius: 2,
    },
    explanationLabel: {
      fontFamily: "Helvetica-Bold",
      fontSize: 6.5,
      color: palette.accent,
      letterSpacing: 0.7,
      textTransform: "uppercase",
      marginBottom: 1.5,
    },
    explanationText: {
      fontFamily: bodyFont,
      fontSize: 8.8,
      color: palette.textMain,
      lineHeight: 1.34,
    },

    // PIED DE PAGE COURANT
    runningFooter: {
      position: "absolute",
      bottom: 14,
      left: 36,
      right: 36,
      borderTopWidth: 0.8,
      borderTopColor: palette.border,
      paddingTop: 4,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    footerLeft: {
      fontFamily: "Helvetica",
      fontSize: 7,
      color: palette.textMuted,
    },
    folioPill: {
      backgroundColor: palette.primary,
      paddingVertical: 1.5,
      paddingHorizontal: 6,
      borderRadius: 2,
    },
    folioText: {
      fontFamily: "Courier-Bold",
      fontSize: 7,
      color: "#FFFFFF",
    },
  });

  return (
    <Document
      author={sanitizePdfText(firstQuiz?.authorName || "DawJang Studio")}
      title={sanitizePdfText(firstQuiz?.title || "Cahier QCM")}
      creator="DawJang Studio — Département Docimologique"
    >
      {quizzes.map((quiz, quizIndex) => {
        const cleanTitle = sanitizePdfText(quiz.title || "Épreuve de QCM");
        const cleanSubject = sanitizePdfText(quiz.subject || "Médecine & Clinique");
        const cleanFormat = sanitizePdfText(
          quiz.formatLabel || "Barème Docimologique Officiel (A-E)"
        );
        const estimatedMin = Math.max(5, Math.round(quiz.questions.length * 1.5));

        return (
          <Fragment key={quizIndex}>
            {/* ===============================================================
                PARTIE 1 : CAHIER D'ÉPREUVE OFFICIEL (SUJET & GRILLE DE COCHE)
               =============================================================== */}
            <Page size="A4" style={styles.page} wrap>
              <View style={styles.runningHeader} fixed>
                <Text style={styles.runningBrand}>
                  DAWJANG DOCIMOLOGIE • CAHIER D'ÉPREUVE OFFICIEL
                </Text>
                <Text style={styles.runningRight}>{cleanSubject}</Text>
              </View>

              {/* CARTOUCHE D'EN-TÊTE D'EXAMEN */}
              <View style={styles.examBanner}>
                <View style={styles.examTopBar} />
                <View style={styles.examAccentBar} />
                <View style={styles.examInner}>
                  <View style={styles.examSuperRow}>
                    <View style={styles.examBadge}>
                      <Text style={styles.examBadgeText}>
                        SUJET D'ÉVALUATION • {cleanSubject}
                      </Text>
                    </View>
                    <Text style={styles.examDateText}>
                      SESSION DU {formattedDate.toUpperCase()}
                    </Text>
                  </View>

                  <Text style={styles.examTitle}>{cleanTitle}</Text>

                  <View style={styles.candidateRow}>
                    <View style={styles.candidateCell}>
                      <Text style={styles.candidateLabel}>CANDIDAT / ÉTUDIANT</Text>
                      <Text style={styles.candidateValue}>
                        {sanitizePdfText(quiz.authorName || "______________________")}
                      </Text>
                    </View>
                    <View style={styles.candidateCellBorder}>
                      <Text style={styles.candidateLabel}>MODALITÉ DOCIMOLOGIQUE</Text>
                      <Text style={styles.candidateValue}>{cleanFormat}</Text>
                    </View>
                    <View style={styles.candidateCellBorder}>
                      <Text style={styles.candidateLabel}>VOLUME & DURÉE</Text>
                      <Text style={styles.candidateValue}>
                        {quiz.questions.length} QCM • ~{estimatedMin} min
                      </Text>
                    </View>
                    <View style={styles.candidateCellBorder}>
                      <Text style={styles.candidateLabel}>SCORE FINAL</Text>
                      <Text style={styles.candidateValue}>
                        _____ / {quiz.questions.length}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* GRILLE OPTIQUE DE COCHE RAPIDE (A B C D E) */}
              {showGrid && quiz.questions.length > 0 && (
                <View style={styles.opticalGridBox}>
                  <View style={styles.opticalHeader}>
                    <Text style={styles.opticalTitle}>
                      FEUILLE DE COCHE RAPIDE (GRILLE OPTIQUE A - B - C - D - E)
                    </Text>
                    <Text style={styles.opticalHint}>
                      Noircissez la ou les cases correspondant à votre réponse
                    </Text>
                  </View>
                  <View style={styles.opticalWrap}>
                    {quiz.questions.map((_, qIdx) => (
                      <View key={qIdx} style={styles.opticalCell} wrap={false}>
                        <Text style={styles.opticalQNum}>
                          Q{String(qIdx + 1).padStart(2, "0")}
                        </Text>
                        <View style={styles.opticalBubblesRow}>
                          {["A", "B", "C", "D", "E"].map((letter) => (
                            <View key={letter} style={styles.opticalBubble}>
                              <Text style={styles.opticalBubbleText}>{letter}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* LISTE DES QUESTIONS — REMPLISSAGE INTÉGRAL JUSQU'AU PIED DE PAGE */}
              {quiz.questions.map((q, qIndex) => {
                const normOpts = normalizeQuestionOptions(q);
                const { mainStem, assertions } = splitQuestionStemAndAssertions(
                  q.question
                );
                const typeBadge =
                  (q.qcmType && QCM_TYPE_LABELS[q.qcmType]) ||
                  "PROPOSITIONS A À E";

                return (
                  <View key={qIndex} style={styles.questionCard} wrap>
                    <View
                      style={styles.questionHeaderBar}
                      wrap={false}
                      minPresenceAhead={42}
                    >
                      <View style={styles.questionNumBadge}>
                        <Text style={styles.questionNumText}>
                          QUESTION {String(qIndex + 1).padStart(2, "0")}
                        </Text>
                      </View>
                      <Text style={styles.questionTypeText}>{typeBadge}</Text>
                    </View>

                    <View style={styles.questionBody}>
                      <Text style={styles.questionStemText} minPresenceAhead={28}>
                        {mainStem}
                      </Text>

                      {assertions.length > 0 && (
                        <View style={styles.assertionsBox}>
                          {assertions.map((assertion, aIdx) =>
                            /^PARCE\s+QUE$/i.test(assertion.trim()) ? (
                              <Text key={aIdx} style={styles.assertionConnector}>
                                — PARCE QUE (LIEN DE CAUSALITÉ) —
                              </Text>
                            ) : (
                              <Text key={aIdx} style={styles.assertionLine}>
                                {assertion}
                              </Text>
                            )
                          )}
                        </View>
                      )}

                      <View style={styles.optionsContainer}>
                        {normOpts.map((opt, optIndex) => (
                          <View key={optIndex} style={styles.optionRow} wrap={false}>
                            <View style={styles.optionCheckSquare} />
                            <Text style={styles.optionLetter}>{opt.label}.</Text>
                            <Text style={styles.optionText}>{opt.text}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                );
              })}

              <View style={styles.runningFooter} fixed>
                <Text style={styles.footerLeft}>
                  DawJang Studio • Cahier d'Épreuve Docimologique ({cleanTitle})
                </Text>
                <View style={styles.folioPill}>
                  <Text
                    style={styles.folioText}
                    render={({ pageNumber, totalPages }) =>
                      `FOLIO ${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`
                    }
                  />
                </View>
              </View>
            </Page>

            {/* ===============================================================
                PARTIE 2 : CORRIGÉ OFFICIEL & JUSTIFICATIONS CLINIQUES
               =============================================================== */}
            {showKey && (
              <Page size="A4" style={styles.page} wrap>
                <View style={styles.runningHeader} fixed>
                  <Text style={styles.runningBrand}>
                    DAWJANG DOCIMOLOGIE • CORRIGÉ OFFICIEL & COMMENTAIRES
                  </Text>
                  <Text style={styles.runningRight}>CORRECTION CERTIFIÉE</Text>
                </View>

                <View style={styles.examBanner}>
                  <View style={styles.examTopBar} />
                  <View style={styles.examAccentBar} />
                  <View style={styles.examInner}>
                    <View style={styles.examSuperRow}>
                      <View style={styles.examBadge}>
                        <Text style={styles.examBadgeText}>
                          GRILLE DE CORRECTION & RAPPELS DE COURS
                        </Text>
                      </View>
                      <Text style={styles.examDateText}>
                        {quiz.questions.length} QUESTIONS CORRIGÉES
                      </Text>
                    </View>
                    <Text style={styles.examTitle}>
                      Corrigé Officiel — {cleanTitle}
                    </Text>
                  </View>
                </View>

                {/* GRILLE RÉCAPITULATIVE EXPRESS */}
                <View style={styles.summaryKeyGrid}>
                  {quiz.questions.map((q, qIdx) => {
                    const normOpts = normalizeQuestionOptions(q);
                    const letters = normOpts
                      .filter((o) => o.isCorrect)
                      .map((o) => o.label)
                      .join(", ");
                    return (
                      <View key={qIdx} style={styles.summaryKeyCell} wrap={false}>
                        <Text style={styles.summaryKeyQ}>
                          Q{String(qIdx + 1).padStart(2, "0")} :
                        </Text>
                        <Text style={styles.summaryKeyAns}>
                          {letters || "—"}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* DÉTAIL QUESTION PAR QUESTION — FLUX CONTINU JUSQU'AU PIED DE PAGE */}
                {quiz.questions.map((q, qIndex) => {
                  const normOpts = normalizeQuestionOptions(q);
                  const correctOpts = normOpts.filter((o) => o.isCorrect);
                  const correctLetters = correctOpts
                    .map((o) => o.label)
                    .join(", ");
                  const { mainStem } = splitQuestionStemAndAssertions(q.question);

                  return (
                    <View key={qIndex} style={styles.correctionCard} wrap>
                      <View
                        style={styles.correctionTopRow}
                        wrap={false}
                        minPresenceAhead={36}
                      >
                        <Text style={styles.correctionQTitle}>
                          Question {String(qIndex + 1).padStart(2, "0")} —{" "}
                          {mainStem.length > 74
                            ? `${mainStem.slice(0, 74)}...`
                            : mainStem}
                        </Text>
                        <View style={styles.exactAnswerBadge}>
                          <Text style={styles.exactAnswerBadgeText}>
                            RÉPONSE : {correctLetters || "A"}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.correctOptionFullText}>
                        {correctOpts
                          .map((o) => `${o.label}. ${o.text}`)
                          .join("  |  ")}
                      </Text>

                      {q.explanation && (
                        <View style={styles.explanationBox}>
                          <Text style={styles.explanationLabel}>
                            JUSTIFICATION DOCIMOLOGIQUE & RAPPEL DE COURS
                          </Text>
                          <Text style={styles.explanationText}>
                            {sanitizePdfText(q.explanation)}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}

                <View style={styles.runningFooter} fixed>
                  <Text style={styles.footerLeft}>
                    DawJang Studio • Corrigé Officiel ({cleanTitle})
                  </Text>
                  <View style={styles.folioPill}>
                    <Text
                      style={styles.folioText}
                      render={({ pageNumber, totalPages }) =>
                        `FOLIO ${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`
                      }
                    />
                  </View>
                </View>
              </Page>
            )}
          </Fragment>
        );
      })}
    </Document>
  );
};
