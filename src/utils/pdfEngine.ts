import { toast } from "sonner";
import { saveAs } from "file-saver";
import React from "react";

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

  let defaultNode: SummaryNode = { title: "Généralités", level: 1, content: [], children: [] };
  let startedWithHeader = false;

  const lines = text.split('\n');

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let level = 0;
    let title = "";

    if (trimmed.startsWith("### ")) { level = 3; title = trimmed.substring(4).trim(); }
    else if (trimmed.startsWith("## ")) { level = 2; title = trimmed.substring(3).trim(); }
    else if (trimmed.startsWith("# ")) { level = 1; title = trimmed.substring(2).trim(); }
    else if (trimmed.match(/^===\s*(.+?)\s*===$/)) {
      level = 1;
      title = trimmed.match(/^===\s*(.+?)\s*===$/)![1];
    }
    else if (trimmed.match(/^--\s*(.+?)\s*--$/)) {
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
        currentH1 = { title: "Section Principale", level: 1, content: [], children: [currentH2] };
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
        currentH1 = { title: "Section Principale", level: 1, content: [], children: [] };
        currentH2 = { title: "Sous-section", level: 2, content: [], children: [currentH3] };
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

export const exportSummaryToPDF = async (title: string, content: string) => {
  const toastId = toast.loading("Compilation du PDF vectoriel HD...");
  try {
    const { pdf } = await import('@react-pdf/renderer');
    const { MedicalDocumentPDF } = await import('./MedicalDocumentPDF');

    const blob = await pdf(React.createElement(MedicalDocumentPDF, { title, content })).toBlob();
    const safeFileName = title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    saveAs(blob, `Hippocampus_${safeFileName}.pdf`);

    toast.success("PDF vectoriel HD enregistré sur votre appareil.", { id: toastId });
  } catch (error) {
    console.error("Erreur React-PDF :", error);
    toast.error("Échec de la compilation du PDF. Vérifiez la console.", { id: toastId });
  }
};
