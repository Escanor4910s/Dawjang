import { saveAs } from "file-saver";
import { toast } from "sonner";
import React from "react";
import type { QuizData } from "./QuizPDF";
import type { PdfFontMode, PdfThemeKey } from "./MedicalDocumentPDF";
import { getSavedStudentProfile } from "@/pages/Settings";

export interface ExportQuizPdfOptions {
  theme?: PdfThemeKey;
  fontMode?: PdfFontMode;
  includeAnswerGrid?: boolean;
  includeAnswerKey?: boolean;
  authorName?: string;
  facultyName?: string;
}

export const exportQuizToPDF = async (
  quizData: QuizData,
  options: ExportQuizPdfOptions = {}
) => {
  const toastId = toast.loading("Compilation du Cahier QCM Vectoriel HD…");
  try {
    const { pdf } = await import("@react-pdf/renderer");
    const { QuizPDF } = await import("./QuizPDF");

    let defaultAuthor = "Candidat DawJang";
    let defaultFaculty = "Faculté de Médecine";
    try {
      const profile = getSavedStudentProfile();
      if (profile?.fullName) defaultAuthor = profile.fullName;
      if (profile?.faculty) defaultFaculty = profile.faculty;
    } catch {
      // Profil par défaut
    }

    const enrichedQuiz: QuizData = {
      ...quizData,
      authorName: options.authorName || quizData.authorName || defaultAuthor,
      facultyName: options.facultyName || quizData.facultyName || defaultFaculty,
      theme: options.theme || quizData.theme || "dawjang",
      fontMode: options.fontMode || quizData.fontMode || "serif",
      includeAnswerGrid:
        options.includeAnswerGrid !== undefined
          ? options.includeAnswerGrid
          : quizData.includeAnswerGrid !== undefined
          ? quizData.includeAnswerGrid
          : true,
      includeAnswerKey:
        options.includeAnswerKey !== undefined
          ? options.includeAnswerKey
          : quizData.includeAnswerKey !== undefined
          ? quizData.includeAnswerKey
          : true,
    };

    const blob = await pdf(
      React.createElement(QuizPDF, {
        data: enrichedQuiz,
        theme: enrichedQuiz.theme,
        fontMode: enrichedQuiz.fontMode,
        includeAnswerGrid: enrichedQuiz.includeAnswerGrid,
        includeAnswerKey: enrichedQuiz.includeAnswerKey,
      }) as unknown as React.ReactElement
    ).toBlob();

    const safeFileName = quizData.title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .substring(0, 48);

    saveAs(blob, `DawJang_QCM_${safeFileName || "Evaluation"}.pdf`);

    toast.success("Cahier QCM PDF téléchargé avec succès.", { id: toastId });
    return true;
  } catch (error) {
    console.error("PDF Export Error:", error);
    toast.error("Échec de la génération du PDF QCM.", { id: toastId });
    return false;
  }
};

export const exportQuizListToPDF = async (quizzes: QuizData[]) => {
  const toastId = toast.loading("Compilation du Recueil QCM en cours…");
  try {
    const { pdf } = await import("@react-pdf/renderer");
    const { QuizPDF } = await import("./QuizPDF");

    const blob = await pdf(
      React.createElement(QuizPDF, { data: quizzes }) as unknown as React.ReactElement
    ).toBlob();
    saveAs(blob, "DawJang_Recueil_QCM.pdf");

    toast.success("Recueil QCM généré avec succès.", { id: toastId });
  } catch (error) {
    console.error("PDF Export Error:", error);
    toast.error("Échec de la génération.", { id: toastId });
  }
};

export const exportFlashcardsToPDF = async (
  flashcards: { question: string; answer: string; courseName?: string }[],
  title = "Fiches de Révision",
  options: { theme?: PdfThemeKey; fontMode?: PdfFontMode } = {}
) => {
  const toastId = toast.loading("Compilation du Carnet de Flashcards PDF HD…");
  try {
    const { pdf } = await import("@react-pdf/renderer");
    const { FlashcardPDF } = await import("./FlashcardPDF");

    const blob = await pdf(
      React.createElement(FlashcardPDF, {
        cards: flashcards,
        title,
        theme: options.theme || "dawjang",
        fontMode: options.fontMode || "serif",
      }) as unknown as React.ReactElement
    ).toBlob();

    const safeFileName = title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .substring(0, 44);

    saveAs(blob, `DawJang_Flashcards_${safeFileName || "Revision"}.pdf`);

    toast.success("Carnet de Flashcards PDF généré avec succès.", {
      id: toastId,
    });
  } catch (error) {
    console.error("PDF Export Error:", error);
    toast.error("Échec de la génération.", { id: toastId });
  }
};
