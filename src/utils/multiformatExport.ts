// src/utils/multiformatExport.ts
/**
 * Module d'exportation multi-formats (PDF, Word, Markdown, HTML, TXT)
 * et de téléversement vers Supabase Storage.
 */

import { saveAs } from "file-saver";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateDawjangHtml } from "./dawjangPdfTemplate";
import { exportSummaryToWord } from "./wordEngine";

function getSafeFileName(title: string, ext: string): string {
  const safe = (title || "Synthese_Medicale")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 48);
  return `${safe || "Synthese"}.${ext}`;
}

/**
 * Téléverse un fichier PDF dans un bucket Supabase Storage
 */
export async function uploadPdfToSupabase(
  blob: Blob,
  fileName: string,
  bucket = "course-files"
): Promise<{ path: string; publicUrl?: string } | null> {
  try {
    const filePath = `summaries_pdf/${Date.now()}_${fileName}`;
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) {
      console.warn("Erreur Supabase Storage upload :", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      path: data.path,
      publicUrl: urlData?.publicUrl,
    };
  } catch (err) {
    console.warn("Échec téléversement Storage :", err);
    return null;
  }
}

/**
 * Exporte la synthèse en fichier Markdown (.md)
 */
export function exportSummaryToMarkdown(title: string, markdown: string): void {
  try {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const fileName = getSafeFileName(title, "md");
    saveAs(blob, fileName);
    toast.success("Fichier Markdown téléchargé.");
  } catch (error) {
    console.error("Erreur export Markdown :", error);
    toast.error("Impossible de télécharger le Markdown.");
  }
}

/**
 * Exporte la synthèse en fichier HTML autonome stylisé DawJang Press (.html)
 */
export function exportSummaryToHtml(title: string, markdown: string): void {
  try {
    const fullHtml = generateDawjangHtml(title, markdown);
    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const fileName = getSafeFileName(title, "html");
    saveAs(blob, fileName);
    toast.success("Page HTML valorisée téléchargée.");
  } catch (error) {
    console.error("Erreur export HTML :", error);
    toast.error("Impossible d'exporter le fichier HTML.");
  }
}

/**
 * Exporte la synthèse en texte brut (.txt)
 */
export function exportSummaryToText(title: string, markdown: string): void {
  try {
    // Nettoie les balises markdown basiques
    const plainText = markdown
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/^>\s*/gm, "")
      .replace(/`{1,3}.*?`{1,3}/g, "");

    const blob = new Blob([`${title.toUpperCase()}\n\n${plainText}`], {
      type: "text/plain;charset=utf-8",
    });
    const fileName = getSafeFileName(title, "txt");
    saveAs(blob, fileName);
    toast.success("Fichier Texte (.txt) téléchargé.");
  } catch (error) {
    console.error("Erreur export TXT :", error);
    toast.error("Impossible d'exporter le texte brut.");
  }
}

export { exportSummaryToWord };
