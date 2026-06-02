import { saveAs } from "file-saver";
import { toast } from "sonner";
import React from 'react';

interface QuizData {
  title: string;
  questions: Array<{
    question: string;
    choices?: string[];
    options?: string[];
    correct: string[];
    explanation?: string;
  }>;
}

export const exportQuizToPDF = async (quizData: QuizData) => {
  const toastId = toast.loading("Génération du PDF HD en cours...");
  try {
    const { pdf } = await import('@react-pdf/renderer');
    const { QuizPDF } = await import('./QuizPDF');

    const blob = await pdf(React.createElement(QuizPDF, { data: quizData })).toBlob();
    const safeFileName = quizData.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    saveAs(blob, `QCM_${safeFileName}.pdf`);

    toast.success("PDF généré avec succès.", { id: toastId });
  } catch (error) {
    console.error("PDF Export Error:", error);
    toast.error("Échec de la génération.", { id: toastId });
  }
};

export const exportQuizListToPDF = async (quizzes: QuizData[]) => {
  const toastId = toast.loading("Génération du Livre QCM en cours...");
  try {
    const { pdf } = await import('@react-pdf/renderer');
    const { QuizPDF } = await import('./QuizPDF');

    const blob = await pdf(React.createElement(QuizPDF, { data: quizzes })).toBlob();
    saveAs(blob, `Livre_QCM_Hippocampus.pdf`);

    toast.success("Livre QCM généré avec succès.", { id: toastId });
  } catch (error) {
    console.error("PDF Export Error:", error);
    toast.error("Échec de la génération.", { id: toastId });
  }
};

export const exportFlashcardsToPDF = async (flashcards: { question: string; answer: string; courseName?: string }[], title = "Fiches de Révision") => {
  const toastId = toast.loading("Génération du PDF HD en cours...");
  try {
    const { pdf } = await import('@react-pdf/renderer');
    const { FlashcardPDF } = await import('./FlashcardPDF');

    const blob = await pdf(React.createElement(FlashcardPDF, { cards: flashcards, title: title })).toBlob();
    saveAs(blob, `Flashcards_Hippocampus.pdf`);

    toast.success("PDF généré avec succès.", { id: toastId });
  } catch (error) {
    console.error("PDF Export Error:", error);
    toast.error("Échec de la génération.", { id: toastId });
  }
};
