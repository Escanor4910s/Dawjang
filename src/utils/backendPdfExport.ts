// src/utils/backendPdfExport.ts
/**
 * Pont Front-End (React) vers le microservice Puppeteer / Backend Supabase
 * et fallback vectoriel navigateur immédiat (DawJang Press).
 */

import { toast } from "sonner";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { printDawjangPdf } from "./dawjangPdfTemplate";

export interface BackendPdfExportOptions {
  date?: string;
  ref?: string;
  serviceUrl?: string;
}

/**
 * Exporte une synthèse en PDF de qualité mondiale via le backend Node.js (Puppeteer)
 * avec cascade automatique : Microservice -> Edge Function -> Print Vectoriel Navigateur.
 */
export async function exportViaPuppeteerBackend(
  title: string,
  markdown: string,
  options: BackendPdfExportOptions = {}
): Promise<boolean> {
  const toastId = toast.loading("Génération du PDF DawJang Press (Puppeteer)…");
  const serviceUrl = options.serviceUrl || (import.meta.env.VITE_PDF_SERVICE_URL as string) || "http://localhost:3001";

  const safeFileName = (title || "Synthese_Medicale")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 48);

  // Étape 1 : Tentative via le microservice Node.js / Puppeteer
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch(`${serviceUrl}/api/generate-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown,
        title,
        date: options.date,
        ref: options.ref,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/pdf")) {
        const blob = await response.blob();
        saveAs(blob, `DawJang_${safeFileName}.pdf`);
        toast.success("PDF DawJang Press généré avec succès par Puppeteer !", { id: toastId });
        return true;
      }
    }
  } catch (err) {
    console.warn("Microservice Puppeteer local non disponible ou hors délai, tentative Edge Function...", err);
  }

  // Étape 2 : Tentative via Supabase Edge Function 'generate-pdf'
  try {
    const { data, error } = await supabase.functions.invoke("generate-pdf", {
      body: { markdown, title, date: options.date, reference: options.ref, ref: options.ref },
    });

    if (!error && data) {
      if (data instanceof Blob) {
        saveAs(data, `DawJang_${safeFileName}.pdf`);
        toast.success("PDF DawJang Press téléchargé avec succès !", { id: toastId });
        return true;
      }
      if (typeof data === "object" && (data as any).html) {
        // L'Edge function a retourné le template DawJang HTML
        printDawjangPdf(title, markdown);
        toast.success("Affichage du document officiel DawJang prêt pour l'impression A4.", { id: toastId });
        return true;
      }
    }
  } catch (err) {
    console.warn("Supabase Edge Function 'generate-pdf' non disponible, bascule sur impression vectorielle...", err);
  }

  // Étape 3 : Fallback direct et infaillible — Impression vectorielle haute fidélité native du navigateur
  try {
    printDawjangPdf(title, markdown);
    toast.info("Impression vectorielle A4 lancée (Template DawJang Press).", { id: toastId });
    return true;
  } catch (finalError) {
    console.error("Échec du pipeline d'exportation PDF :", finalError);
    toast.error("Impossible de générer le PDF.", { id: toastId });
    return false;
  }
}

/**
 * Fonction frontend directe conforme à l'exemple d'intégration serverless
 */
export async function downloadPdf(
  markdown: string,
  title = "Synthèse Médicale",
  date?: string,
  reference?: string
): Promise<void> {
  const success = await exportViaPuppeteerBackend(title, markdown, { date, ref: reference });
  if (!success) {
    throw new Error("Erreur lors de la génération du PDF.");
  }
}
