import { toast } from "sonner";
import { saveAs } from "file-saver";
import React from "react";
import type {
  MedicalDocumentProps,
  PdfFontMode,
  PdfThemeKey,
} from "./MedicalDocumentPDF";
import { getSavedStudentProfile } from "@/pages/Settings";

export interface SummaryNode {
  title: string;
  level: number;
  content: string[];
  children: SummaryNode[];
}

export const parseHierarchicalSummary = (text: string): SummaryNode[] => {
  const roots: SummaryNode[] = [];
  let currentH1: SummaryNode | null = null;
  let currentH2: SummaryNode | null = null;
  let currentH3: SummaryNode | null = null;

  const defaultNode: SummaryNode = {
    title: "Généralités",
    level: 1,
    content: [],
    children: [],
  };
  let startedWithHeader = false;

  const lines = text.split("\n");

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let level = 0;
    let title = "";

    if (trimmed.startsWith("### ")) {
      level = 3;
      title = trimmed.substring(4).trim();
    } else if (trimmed.startsWith("## ")) {
      level = 2;
      title = trimmed.substring(3).trim();
    } else if (trimmed.startsWith("# ")) {
      level = 1;
      title = trimmed.substring(2).trim();
    } else if (trimmed.match(/^===\s*(.+?)\s*===$/)) {
      level = 1;
      title = trimmed.match(/^===\s*(.+?)\s*===$/)![1];
    } else if (trimmed.match(/^--\s*(.+?)\s*--$/)) {
      level = 2;
      title = trimmed.match(/^--\s*(.+?)\s*--$/)![1];
    }

    if (level === 1) {
      currentH1 = { title, level: 1, content: [], children: [] };
      roots.push(currentH1);
      currentH2 = null;
      currentH3 = null;
      startedWithHeader = true;
    } else if (level === 2) {
      currentH2 = { title, level: 2, content: [], children: [] };
      if (currentH1) {
        currentH1.children.push(currentH2);
      } else {
        currentH1 = {
          title: "Section Principale",
          level: 1,
          content: [],
          children: [currentH2],
        };
        roots.push(currentH1);
      }
      currentH3 = null;
      startedWithHeader = true;
    } else if (level === 3) {
      currentH3 = { title, level: 3, content: [], children: [] };
      if (currentH2) {
        currentH2.children.push(currentH3);
      } else if (currentH1) {
        currentH1.children.push(currentH3);
      } else {
        currentH1 = {
          title: "Section Principale",
          level: 1,
          content: [],
          children: [],
        };
        currentH2 = {
          title: "Sous-section",
          level: 2,
          content: [],
          children: [currentH3],
        };
        currentH1.children.push(currentH2);
        roots.push(currentH1);
      }
      startedWithHeader = true;
    } else {
      if (currentH3) currentH3.content.push(trimmed);
      else if (currentH2) currentH2.content.push(trimmed);
      else if (currentH1) currentH1.content.push(trimmed);
      else {
        defaultNode.content.push(trimmed);
      }
    }
  });

  if (!startedWithHeader && defaultNode.content.length > 0) {
    roots.unshift(defaultNode);
  }

  return roots;
};

export interface ExportSummaryPdfOptions {
  subject?: string;
  type?: string;
  resolutionLabel?: string;
  architectureLabel?: string;
  authorName?: string;
  facultyName?: string;
  theme?: PdfThemeKey;
  fontMode?: PdfFontMode;
  includeToc?: boolean;
  includeRevisionBox?: boolean;
  engineStyle?: "monograph_press" | "standard_clinical";
}

export const exportSummaryToPDF = async (
  title: string,
  content: string,
  options: ExportSummaryPdfOptions = {}
) => {
  const toastId = toast.loading("Compilation du PDF Vectoriel Haute Définition…");
  try {
    const { pdf } = await import("@react-pdf/renderer");

    let defaultAuthor = "Édition Magistrale DawJang";
    let defaultFaculty = "Faculté de Médecine • Cursus Hospitalo-Universitaire";
    try {
      const profile = getSavedStudentProfile();
      if (profile?.fullName) defaultAuthor = profile.fullName;
      if (profile?.faculty) {
        defaultFaculty = `${profile.faculty}${
          profile.studyLevel ? ` • ${profile.studyLevel}` : ""
        }`;
      }
    } catch {
      // Profil par défaut
    }

    // 1. Export Monographie DawJang Press (Maquette haute-densité avec scale, branches & révision)
    if (options.engineStyle !== "standard_clinical") {
      try {
        const { MonographPDF } = await import("@/components/pdf/MonographPDF");
        const { convertMarkdownToMonograph } = await import("./monographConverter");
        const monographData = convertMarkdownToMonograph(title, content, {
          subject: options.subject,
          faculty: options.facultyName || defaultFaculty,
          authorName: options.authorName || defaultAuthor,
        });

        const blob = await pdf(
          React.createElement(MonographPDF, { data: monographData }) as any
        ).toBlob();

        const safeFileName = title
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9_-]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .substring(0, 48);

        saveAs(blob, `DawJang_${safeFileName || "Monographie"}.pdf`);
        toast.success("Monographie DawJang Press téléchargée avec succès.", { id: toastId });
        return true;
      } catch (monoErr) {
        console.warn("[pdfEngine] Repli sur maquette standard :", monoErr);
      }
    }

    // 2. Export Standard Clinique (Repli de secours)
    const { MedicalDocumentPDF } = await import("./MedicalDocumentPDF");

    const docProps: MedicalDocumentProps = {
      title,
      content,
      subject: options.subject || "Médecine & Sciences Cliniques",
      type: options.type || "Monographie de Synthèse",
      resolutionLabel: options.resolutionLabel || "Calibrage Standard",
      architectureLabel: options.architectureLabel || "Édition Structurée",
      authorName: options.authorName || defaultAuthor,
      facultyName: options.facultyName || defaultFaculty,
      theme: options.theme || "dawjang",
      fontMode: options.fontMode || "serif",
      includeToc: options.includeToc !== undefined ? options.includeToc : true,
      includeRevisionBox:
        options.includeRevisionBox !== undefined ? options.includeRevisionBox : true,
    };

    const blob = await pdf(
      React.createElement(MedicalDocumentPDF, docProps)
    ).toBlob();

    const safeFileName = title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .substring(0, 48);

    saveAs(blob, `DawJang_${safeFileName || "Synthese_Medicale"}.pdf`);

    toast.success("PDF Vectoriel HD téléchargé avec succès.", { id: toastId });
    return true;
  } catch (error) {
    console.error("Erreur React-PDF :", error);
    toast.error("Échec de la compilation du PDF.", { id: toastId });
    return false;
  }
};
