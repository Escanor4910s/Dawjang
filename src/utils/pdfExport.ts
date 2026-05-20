import jsPDF from "jspdf";

interface Question {
  question: string;
  choices: string[];
  correct: number[];
  explanation?: string;
}

interface QuizData {
  title: string;
  questions: Question[];
  score?: number;
  totalQuestions?: number;
  timeElapsed?: number;
  completedAt?: string;
}

// Helper: safe text and cleaning
const cleanForPDF = (text: string): string => {
  if (!text) return "";
  return String(text)
    .replace(/[\u{1F600}-\u{1F9FF}]/gu, "") // Remove emojis
    .replace(/[✓→•📌📚🔬💊🫀🧠📋📊⚖️⚠️💡🛡️🎯🩺🧬]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const getLongDate = (dateStr?: string) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleDateString("fr-FR", { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

/**
 * OVERHAUL: Premium, Medical-Grade Academic PDF Export
 */
export const exportQuizToPDF = (quizData: QuizData) => {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 25;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;
  let pageNum = 1;

  // ─────────────────────────────────────────────────────────
  //  COLOR PALETTE — Muted, professional academic tones
  // ─────────────────────────────────────────────────────────
  const colors = {
    accentIndigo:  [61, 79, 124]  as const, // #3D4F7C — dignified dark indigo
    correctGreen:  [45, 106, 79]  as const, // #2D6A4F — sage green
    textDark:      [35, 35, 40]   as const, // near-black
    textBody:      [55, 55, 60]   as const,
    textMuted:     [130, 130, 135] as const,
    textLight:     [170, 170, 175] as const,
    ruleLight:     [220, 220, 225] as const,
    ruleMedium:    [200, 200, 205] as const,
    bgSubtle:      [248, 248, 250] as const,
    bgCard:        [244, 245, 248] as const,
    white:         [255, 255, 255] as const,
  };

  // ─────────────────────────────────────────────────────────
  //  TYPOGRAPHY CONSTANTS
  // ─────────────────────────────────────────────────────────
  const QUESTION_FONT_SIZE  = 11.5;
  const CHOICE_FONT_SIZE    = 10.5;
  const EXPL_FONT_SIZE      = 10;
  const QUESTION_LINE_H     = 5.5;
  const CHOICE_LINE_H       = 5;
  const EXPL_LINE_H         = 4.8;
  const CHOICE_GAP          = 2.5;   // vertical gap between choices
  const POST_QUESTION_GAP   = 12;    // gap after a full question block
  const SEPARATOR_GAP       = 8;     // extra gap for the decorative rule
  const HEADER_ZONE         = 22;    // reserved for header
  const FOOTER_ZONE         = 20;    // reserved for footer
  const USABLE_BOTTOM       = pageHeight - FOOTER_ZONE;
  const CONTENT_TOP         = margin + 8; // y after header on new pages

  // ─────────────────────────────────────────────────────────
  //  HEADER — subtle HIPPOCAMPUS branding on every page
  // ─────────────────────────────────────────────────────────
  const addHeader = (sectionLabel: string) => {
    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...colors.textLight);
    pdf.text("HIPPOCAMPUS", margin, 14);
    pdf.setFont("helvetica", "normal");
    pdf.text("|", margin + pdf.getTextWidth("HIPPOCAMPUS") + 2, 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...colors.textMuted);
    pdf.text(
      sectionLabel.toUpperCase(),
      margin + pdf.getTextWidth("HIPPOCAMPUS  |  ") + 2,
      14
    );
    // thin rule
    pdf.setDrawColor(...colors.ruleLight);
    pdf.setLineWidth(0.25);
    pdf.line(margin, 17, pageWidth - margin, 17);
  };

  // ─────────────────────────────────────────────────────────
  //  FOOTER — page number centred, with subtle branding
  // ─────────────────────────────────────────────────────────
  const addFooter = () => {
    const fy = pageHeight - 12;
    // thin rule above footer
    pdf.setDrawColor(...colors.ruleLight);
    pdf.setLineWidth(0.2);
    pdf.line(margin, fy - 3, pageWidth - margin, fy - 3);

    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...colors.textLight);
    pdf.text(
      "Document confidentiel - usage pedagogique uniquement",
      margin,
      fy
    );
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...colors.textMuted);
    pdf.text(`${pageNum}`, pageWidth - margin, fy, { align: "right" });

    // decorative accent — short indigo line at bottom-right
    pdf.setDrawColor(...colors.accentIndigo);
    pdf.setLineWidth(0.8);
    pdf.line(pageWidth - 35, pageHeight - 2, pageWidth, pageHeight - 2);
  };

  // ─────────────────────────────────────────────────────────
  //  SMART PAGE-BREAK  — the critical function
  //  Ensures `neededSpace` mm are available below yPosition.
  //  If not, finishes current page and starts a new one.
  // ─────────────────────────────────────────────────────────
  const ensureSpace = (neededSpace: number, sectionLabel: string): void => {
    if (yPosition + neededSpace > USABLE_BOTTOM) {
      addFooter();
      pdf.addPage();
      pageNum++;
      yPosition = CONTENT_TOP;
      addHeader(sectionLabel);
    }
  };

  // ─────────────────────────────────────────────────────────
  //  HEIGHT ESTIMATORS — used BEFORE rendering to decide
  //  whether we need a page break.
  // ─────────────────────────────────────────────────────────
  /** Estimate total height of a question block (tag + text + all choices + gaps) */
  const estimateQuestionBlockHeight = (question: Question): number => {
    // Tag line
    let h = 14; // tag rect (8) + gap to question text (6)

    // Question text
    pdf.setFont("times", "bold");
    pdf.setFontSize(QUESTION_FONT_SIZE);
    const qLines = pdf.splitTextToSize(cleanForPDF(question.question), contentWidth - 8);
    h += qLines.length * QUESTION_LINE_H + 6; // +6 gap before choices

    // Each choice
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(CHOICE_FONT_SIZE);
    question.choices.forEach((choice) => {
      const cLines = pdf.splitTextToSize(cleanForPDF(choice), contentWidth - 18);
      h += cLines.length * CHOICE_LINE_H + CHOICE_GAP;
    });

    h += POST_QUESTION_GAP + SEPARATOR_GAP; // trailing gap + separator
    return h;
  };

  /** Estimate total height of a correction block */
  const estimateCorrectionBlockHeight = (question: Question): number => {
    let h = 14; // header line + gap

    if (question.explanation) {
      pdf.setFont("times", "normal");
      pdf.setFontSize(EXPL_FONT_SIZE);
      const eLines = pdf.splitTextToSize(
        cleanForPDF(question.explanation),
        contentWidth - 16
      );
      h += eLines.length * EXPL_LINE_H + 16; // padding inside card + gap after
    } else {
      h += 10;
    }
    return h;
  };

  // ═══════════════════════════════════════════════════════════
  //  PAGE 1 — COVER PAGE
  // ═══════════════════════════════════════════════════════════

  // Subtle background wash — top-right decorative ellipse
  pdf.setFillColor(...colors.bgSubtle);
  pdf.ellipse(pageWidth + 10, -20, 110, 90, "F");

  // Decorative vertical rule — left accent
  pdf.setDrawColor(...colors.accentIndigo);
  pdf.setLineWidth(2.5);
  pdf.line(margin, 45, margin, 58);

  // Institution name
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...colors.accentIndigo);
  pdf.text("HIPPOCAMPUS", margin + 6, 50);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...colors.textMuted);
  pdf.text("PLATEFORME DE REVISION MEDICALE AVANCEE", margin + 6, 56);

  // Main title
  yPosition = 90;
  pdf.setFont("times", "bold");
  pdf.setFontSize(28);
  pdf.setTextColor(...colors.textDark);
  const titleText = cleanForPDF(quizData.title);
  const titleLines = pdf.splitTextToSize(titleText, contentWidth);
  pdf.text(titleLines, margin, yPosition);
  yPosition += titleLines.length * 12 + 4;

  // Decorative rule under title
  pdf.setDrawColor(...colors.accentIndigo);
  pdf.setLineWidth(0.6);
  pdf.line(margin, yPosition, margin + 45, yPosition);
  yPosition += 10;

  // Subtitle
  pdf.setFont("times", "italic");
  pdf.setFontSize(13);
  pdf.setTextColor(...colors.textMuted);
  pdf.text("Evaluation formative - Questions a choix multiples", margin, yPosition);
  yPosition += 7;
  pdf.setFontSize(11);
  pdf.text("Avec corriges et argumentaires detailles", margin, yPosition);

  // ── Metadata block at bottom of cover ──
  const metaBlockY = pageHeight - 90;
  const metaBlockH = 52;

  // Outer border
  pdf.setDrawColor(...colors.ruleMedium);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(margin, metaBlockY, contentWidth, metaBlockH, 2, 2, "S");

  // Inner fill
  pdf.setFillColor(...colors.bgSubtle);
  pdf.roundedRect(margin + 0.3, metaBlockY + 0.3, contentWidth - 0.6, metaBlockH - 0.6, 2, 2, "F");

  // Left column — labels
  let my = metaBlockY + 12;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...colors.textLight);
  pdf.text("DATE", margin + 10, my);
  pdf.text("QUESTIONS", margin + 10, my + 10);
  if (quizData.timeElapsed) {
    pdf.text("DUREE", margin + 10, my + 20);
  }
  if (quizData.score !== undefined && quizData.totalQuestions) {
    pdf.text("RESULTAT", margin + 10, my + 30);
  }

  // Left column — values
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...colors.textBody);
  pdf.text(getLongDate(quizData.completedAt), margin + 40, my);
  pdf.text(`${quizData.questions.length} items`, margin + 40, my + 10);
  if (quizData.timeElapsed) {
    pdf.text(formatTime(quizData.timeElapsed), margin + 40, my + 20);
  }

  // Score — right-aligned, prominent
  if (quizData.score !== undefined && quizData.totalQuestions) {
    const pct = Math.round((quizData.score / quizData.totalQuestions) * 100);
    pdf.setFont("times", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(...colors.accentIndigo);
    pdf.text(
      `${quizData.score} / ${quizData.totalQuestions}`,
      pageWidth - margin - 12,
      metaBlockY + 20,
      { align: "right" }
    );
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...colors.textMuted);
    pdf.text(`(${pct} %)`, pageWidth - margin - 12, metaBlockY + 28, {
      align: "right",
    });
  }

  addFooter();

  // ═══════════════════════════════════════════════════════════
  //  SECTION I — QUESTIONS
  // ═══════════════════════════════════════════════════════════
  pdf.addPage();
  pageNum++;
  addHeader("Analyse des questions");
  yPosition = CONTENT_TOP;

  // Section title
  pdf.setFont("times", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(...colors.textDark);
  pdf.text("I.  Analyse des questions", margin, yPosition + 6);
  // rule under section title
  pdf.setDrawColor(...colors.accentIndigo);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition + 10, margin + 55, yPosition + 10);
  yPosition += 22;

  quizData.questions.forEach((question, index) => {
    // ── PRE-CALCULATE full block height ──
    const blockHeight = estimateQuestionBlockHeight(question);
    ensureSpace(blockHeight, "Analyse des questions");

    // ── Question number tag ──
    pdf.setFillColor(...colors.bgCard);
    pdf.roundedRect(margin, yPosition - 4.5, 30, 8, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...colors.accentIndigo);
    pdf.text(`Question ${index + 1}`, margin + 3.5, yPosition + 1);

    // Small accent line next to tag
    pdf.setDrawColor(...colors.accentIndigo);
    pdf.setLineWidth(0.4);
    pdf.line(margin + 31, yPosition - 2, margin + 31, yPosition + 2);

    yPosition += 10;

    // ── Question text ──
    pdf.setFont("times", "bold");
    pdf.setFontSize(QUESTION_FONT_SIZE);
    pdf.setTextColor(...colors.textDark);
    const questionText = cleanForPDF(question.question);
    const questionLines = pdf.splitTextToSize(questionText, contentWidth - 8);
    pdf.text(questionLines, margin + 2, yPosition);
    yPosition += questionLines.length * QUESTION_LINE_H + 6;

    // ── Choices ──
    question.choices.forEach((choice, choiceIndex) => {
      const letter = String.fromCharCode(65 + choiceIndex);

      // Letter circle/box
      pdf.setDrawColor(...colors.ruleMedium);
      pdf.setLineWidth(0.3);
      pdf.setFillColor(...colors.white);
      pdf.roundedRect(margin + 4, yPosition - 3.8, 6.5, 6.5, 1, 1, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...colors.accentIndigo);
      pdf.text(letter, margin + 7.25, yPosition + 0.5, { align: "center" });

      // Choice text
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(CHOICE_FONT_SIZE);
      pdf.setTextColor(...colors.textBody);
      const choiceText = cleanForPDF(choice);
      const choiceLines = pdf.splitTextToSize(choiceText, contentWidth - 18);
      pdf.text(choiceLines, margin + 14, yPosition);

      yPosition += choiceLines.length * CHOICE_LINE_H + CHOICE_GAP;
    });

    yPosition += POST_QUESTION_GAP;

    // ── Separator ──
    pdf.setDrawColor(...colors.ruleLight);
    pdf.setLineWidth(0.15);
    const sepCenter = pageWidth / 2;
    pdf.line(sepCenter - 30, yPosition, sepCenter + 30, yPosition);
    yPosition += SEPARATOR_GAP;
  });

  // ═══════════════════════════════════════════════════════════
  //  SECTION II — CORRECTIONS & ARGUMENTAIRES
  // ═══════════════════════════════════════════════════════════

  // Always start corrections on a fresh page for clarity
  addFooter();
  pdf.addPage();
  pageNum++;
  addHeader("Corrections");
  yPosition = CONTENT_TOP;

  // Section title
  pdf.setFont("times", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(...colors.textDark);
  pdf.text("II.  Corrections et argumentaires", margin, yPosition + 6);
  pdf.setDrawColor(...colors.correctGreen);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition + 10, margin + 55, yPosition + 10);
  yPosition += 22;

  quizData.questions.forEach((question, index) => {
    const correctLetters = question.correct
      .map((i) => String.fromCharCode(65 + i))
      .join(", ");

    // ── PRE-CALCULATE full correction block height ──
    const blockH = estimateCorrectionBlockHeight(question);
    ensureSpace(blockH, "Corrections");

    // ── Correction header line ──
    // Number
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...colors.textMuted);
    pdf.text(`Question ${index + 1}`, margin, yPosition);

    // Correct answer badge
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...colors.correctGreen);
    const answerLabel = `Reponse(s) : ${correctLetters}`;
    pdf.text(answerLabel, pageWidth - margin, yPosition, { align: "right" });

    // Thin rule under header
    pdf.setDrawColor(...colors.ruleLight);
    pdf.setLineWidth(0.2);
    pdf.line(margin, yPosition + 3, pageWidth - margin, yPosition + 3);
    yPosition += 9;

    // ── Explanation block ──
    if (question.explanation) {
      pdf.setFont("times", "normal");
      pdf.setFontSize(EXPL_FONT_SIZE);

      const explText = cleanForPDF(question.explanation);
      const explLines = pdf.splitTextToSize(explText, contentWidth - 16);

      // Background card for explanation
      const cardH = explLines.length * EXPL_LINE_H + 10;
      pdf.setFillColor(...colors.bgSubtle);
      pdf.setDrawColor(...colors.ruleLight);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(margin, yPosition - 2, contentWidth, cardH, 1.5, 1.5, "FD");

      // Left accent bar inside card
      pdf.setFillColor(...colors.correctGreen);
      pdf.rect(margin + 0.5, yPosition, 1.2, cardH - 4, "F");

      // Explanation text
      pdf.setTextColor(...colors.textBody);
      pdf.text(explLines, margin + 8, yPosition + 5);
      yPosition += cardH + 8;
    } else {
      yPosition += 8;
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  FINALIZE
  // ═══════════════════════════════════════════════════════════
  addFooter();

  const safeTitle = cleanForPDF(quizData.title)
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 30);
  const fileName = `Hippocampus_QCM_${safeTitle}.pdf`;
  pdf.save(fileName);
};

/**
 * Flashcards Export - Elegant Grid/Card Layout
 */
export const exportFlashcardsToPDF = (flashcards: { question: string; answer: string }[], title = "Fiches de Révision") => {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = 30;
  let pageNum = 1;

  const addHeader = () => {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(180, 180, 180);
    pdf.text("HIPPOCAMPUS | FLASHCARDS", margin, 15);
    pdf.text(cleanForPDF(title).toUpperCase(), pageWidth - margin, 15, { align: "right" });
  };

  const addFooter = () => {
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  };

  addHeader();
  pdf.setFont("times", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(30, 30, 30);
  pdf.text(cleanForPDF(title), margin, yPosition);
  yPosition += 15;

  flashcards.forEach((card, index) => {
    const qLines = pdf.splitTextToSize(cleanForPDF(card.question), contentWidth - 10);
    const aLines = pdf.splitTextToSize(cleanForPDF(card.answer), contentWidth - 10);
    const blockHeight = (qLines.length + aLines.length) * 6 + 15;

    if (yPosition + blockHeight > pageHeight - 20) {
      addFooter();
      pdf.addPage();
      pageNum++;
      yPosition = 25;
      addHeader();
    }

    // Card background
    pdf.setFillColor(254, 254, 255);
    pdf.setDrawColor(230, 230, 240);
    pdf.roundedRect(margin, yPosition, contentWidth, blockHeight, 2, 2, "FD");
    
    // Card ID
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(180, 180, 200);
    pdf.text(`FICHE #${index + 1}`, margin + 5, yPosition + 5);

    // Question
    pdf.setFont("times", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(40, 40, 40);
    pdf.text(qLines, margin + 5, yPosition + 12);
    
    // Answer
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(80, 80, 80);
    pdf.text(aLines, margin + 5, yPosition + 12 + qLines.length * 6 + 2);

    yPosition += blockHeight + 6;
  });

  addFooter();
  pdf.save(`Hippocampus_Flashcards_${new Date().toISOString().split("T")[0]}.pdf`);
};

export const exportQuizListToPDF = (quizzes: QuizData[]) => {
  // Keeping this simple for lists but adding consistent styling
  const pdf = new jsPDF("p", "mm", "a4");
  const margin = 20;
  let yPosition = 30;

  pdf.setFont("times", "bold");
  pdf.setFontSize(20);
  pdf.text("RÉSUMÉ DES ÉVALUATIONS", margin, yPosition);
  yPosition += 15;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Généré le ${getLongDate()}`, margin, yPosition);
  yPosition += 15;

  quizzes.forEach((quiz, idx) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(30, 30, 30);
    pdf.text(`${idx + 1}. ${cleanForPDF(quiz.title)}`, margin, yPosition);
    
    if (quiz.score !== undefined) {
      pdf.setTextColor(99, 102, 241);
      pdf.text(`${quiz.score}/${quiz.totalQuestions}`, 180, yPosition, { align: "right" });
    }
    
    yPosition += 10;
    pdf.setDrawColor(240, 240, 240);
    pdf.line(margin, yPosition - 5, 190, yPosition - 5);
  });

  pdf.save("Hippocampus_Recapitulatif.pdf");
};
