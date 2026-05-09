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
  const margin = 25; // Professional wide margins
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;
  let pageNum = 1;

  // --- HELPER: BRANDED DECORATIONS ---
  const addHeader = (title: string) => {
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(180, 180, 180);
    pdf.text("HIPPOCAMPUS | RÉVISION MÉDICALE AVANCÉE", margin, 15);
    pdf.text(title.toUpperCase(), pageWidth - margin, 15, { align: "right" });
    pdf.setDrawColor(240, 240, 240);
    pdf.setLineWidth(0.3);
    pdf.line(margin, 18, pageWidth - margin, 18);
  };

  const addFooter = () => {
    const footerY = pageHeight - 15;
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    pdf.setTextColor(150, 150, 150);
    pdf.text("Document confidentiel à usage pédagogique - www.hippocampus.app", pageWidth / 2, footerY, { align: "center" });
    pdf.setFont("helvetica", "bold");
    pdf.text(`${pageNum}`, pageWidth - margin, footerY, { align: "right" });
    
    // Bottom accent line (Primary Green)
    pdf.setDrawColor(99, 102, 241); // Brand Purple
    pdf.setLineWidth(1);
    pdf.line(pageWidth - 40, pageHeight, pageWidth, pageHeight);
  };

  const checkPageBreak = (neededSpace: number, title: string) => {
    if (yPosition + neededSpace > pageHeight - 25) {
      addFooter();
      pdf.addPage();
      pageNum++;
      yPosition = margin + 5;
      addHeader(title);
    }
  };

  // --- PAGE 1: PROFESSIONAL COVER PAGE ---
  // Background element (subtle circle)
  pdf.setFillColor(249, 250, 251);
  pdf.circle(pageWidth, 0, 100, "F");
  
  // Branding
  pdf.setTextColor(99, 102, 241); // Purple
  pdf.setFont("times", "bold");
  pdf.setFontSize(32);
  pdf.text("HIPPOCAMPUS", margin, 60);
  
  pdf.setTextColor(100, 100, 100);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("INTELLIGENCE ARTIFICIELLE AU SERVICE DE LA MÉDECINE", margin, 68);
  
  // Title Block
  yPosition = 120;
  pdf.setDrawColor(99, 102, 241);
  pdf.setLineWidth(1.5);
  pdf.line(margin, yPosition, margin + 20, yPosition);
  
  yPosition += 15;
  pdf.setTextColor(30, 30, 30);
  pdf.setFont("times", "bold");
  pdf.setFontSize(26);
  const titleText = cleanForPDF(quizData.title);
  const titleLines = pdf.splitTextToSize(titleText, contentWidth);
  pdf.text(titleLines, margin, yPosition);
  yPosition += titleLines.length * 10 + 5;
  
  pdf.setFont("helvetica", "light");
  pdf.setFontSize(14);
  pdf.setTextColor(120, 120, 120);
  pdf.text("Rapport complet d'évaluation clinique et pédagogique", margin, yPosition);
  
  // Metadata Table
  yPosition = pageHeight - 80;
  pdf.setFillColor(252, 252, 252);
  pdf.roundedRect(margin, yPosition, contentWidth, 40, 3, 3, "F");
  
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(150, 150, 150);
  pdf.text("DÉTAILS DU DOCUMENT", margin + 10, yPosition + 10);
  
  pdf.setFontSize(11);
  pdf.setTextColor(60, 60, 60);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Date de génération : ${getLongDate(quizData.completedAt)}`, margin + 10, yPosition + 22);
  pdf.text(`Nombre de questions : ${quizData.questions.length}`, margin + 10, yPosition + 30);
  
  if (quizData.score !== undefined && quizData.totalQuestions) {
    const percentage = Math.round((quizData.score / quizData.totalQuestions) * 100);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(99, 102, 241);
    pdf.text(`Résultat global : ${quizData.score}/${quizData.totalQuestions} (${percentage}%)`, pageWidth - margin - 10, yPosition + 26, { align: "right" });
  }

  addFooter();
  pdf.addPage();
  pageNum++;
  yPosition = margin + 5;
  addHeader(quizData.title);

  // --- SECTION: ANALYSIS ---
  pdf.setFont("times", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(30, 30, 30);
  pdf.text("I. ANALYSE DES QUESTIONS", margin, yPosition + 10);
  yPosition += 25;

  quizData.questions.forEach((question, index) => {
    checkPageBreak(60, quizData.title);

    // Question Number Tag
    pdf.setFillColor(245, 247, 250);
    pdf.roundedRect(margin, yPosition - 5, 25, 8, 1, 1, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(99, 102, 241);
    pdf.text(`ITEM ${index + 1}`, margin + 4, yPosition + 1);
    
    yPosition += 10;

    // Question Text
    pdf.setFont("times", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(0, 0, 0);
    const questionText = cleanForPDF(question.question);
    const questionLines = pdf.splitTextToSize(questionText, contentWidth);
    pdf.text(questionLines, margin, yPosition);
    yPosition += questionLines.length * 6 + 6;

    // Choices with subtle bullet points
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(70, 70, 70);
    
    question.choices.forEach((choice, choiceIndex) => {
      checkPageBreak(12, quizData.title);
      const letter = String.fromCharCode(65 + choiceIndex);
      
      // Choice Letter Box
      pdf.setDrawColor(230, 230, 230);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(margin + 2, yPosition - 4, 6, 6, 1, 1, "S");
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(letter, margin + 5, yPosition, { align: "center" });
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const choiceText = cleanForPDF(choice);
      const choiceLines = pdf.splitTextToSize(choiceText, contentWidth - 15);
      pdf.text(choiceLines, margin + 12, yPosition);
      
      yPosition += choiceLines.length * 5 + 3;
    });

    yPosition += 10;
    
    // Separator between questions
    pdf.setDrawColor(245, 245, 245);
    pdf.line(margin + 20, yPosition, pageWidth - margin - 20, yPosition);
    yPosition += 15;
  });

  // --- SECTION: CORRECTIONS ---
  checkPageBreak(100, quizData.title);
  yPosition += 5;
  pdf.setFont("times", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(30, 30, 30);
  pdf.text("II. CORRECTIONS & ARGUMENTAIRES", margin, yPosition);
  yPosition += 15;

  quizData.questions.forEach((question, index) => {
    const correctLetters = question.correct.map(i => String.fromCharCode(65 + i)).join(", ");
    
    // Check space for the whole block to avoid awkward breaks
    checkPageBreak(40, quizData.title);
    
    // Header Correction
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`ITEM ${index + 1}`, margin, yPosition);
    
    pdf.setTextColor(16, 185, 129); // Success Green
    pdf.setFontSize(11);
    pdf.text(`RÉPONSE(S) : ${correctLetters}`, pageWidth - margin, yPosition, { align: "right" });
    
    yPosition += 8;

    if (question.explanation) {
      pdf.setFont("times", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(50, 50, 50);
      
      const explText = cleanForPDF(question.explanation);
      const explanationLines = pdf.splitTextToSize(explText, contentWidth - 10);
      
      // Gray block for explanation
      pdf.setFillColor(252, 252, 252);
      pdf.roundedRect(margin - 2, yPosition - 4, contentWidth + 4, explanationLines.length * 5 + 8, 1, 1, "F");
      
      pdf.text(explanationLines, margin + 2, yPosition + 2);
      yPosition += explanationLines.length * 5 + 15;
    } else {
      yPosition += 10;
    }
  });

  addFooter();
  const fileName = `Hippocampus_Expert_Report_${cleanForPDF(quizData.title).replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}.pdf`;
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
