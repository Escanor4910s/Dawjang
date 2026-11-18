import * as pdfjs from "pdfjs-dist";
import { supabase } from "@/integrations/supabase/client";

export interface OcrProgress {
  page: number;
  total: number;
  stage: string;
  pct: number;
}

export interface OcrOptions {
  systemPrompt?: string;
  stripHandwrittenCorrections?: boolean;
  scale?: number;
}

export const VISION_EXTRACTION_SYSTEM_PROMPT = `
Transcris intégralement et fidèlement le texte visible de ce document médical.
Conserve les numéros, propositions, valeurs, unités et tableaux. Ignore les annotations manuscrites dans le texte principal et signale-les séparément. Ne résume pas et ne commente pas.
`;

export function isLikelyScannedText(extractedText: string, pageCount = 1): boolean {
  const clean = String(extractedText || "").trim();
  if (clean.length < 50) return true;
  return clean.length / Math.max(1, pageCount) < 35;
}

export function cleanOcrText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*([A-Ea-e])\s*[:.)-]\s*/g, "\n$1. ")
    .replace(/\n\s*(?:QCM|Question)?\s*(\d{1,3})\s*[:.-]\s*/gi, "\n\nQuestion $1 : ")
    .replace(/^[|¦!]\s*/gm, "")
    .replace(/[❑▪►●♦❖]/g, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function ocrWithVision(
  base64Data: string,
  mimeType: string,
  systemPrompt?: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("ocr-vision", {
    body: { image: base64Data, mimeType, systemPrompt },
  });
  if (error) throw error;
  const text = typeof data?.text === "string" ? data.text : "";
  if (!text.trim()) throw new Error("La transcription Vision n'a détecté aucun texte.");
  return text;
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function createTesseractWorker() {
  const { createWorker, OEM } = await import("tesseract.js");
  const assetRoot = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.origin).href;
  return new Promise<import("tesseract.js").Worker>((resolve, reject) => {
    createWorker("fra", OEM.LSTM_ONLY, {
      workerPath: `${assetRoot}worker.min.js`,
      corePath: `${assetRoot}core/`,
      langPath: `${assetRoot}lang/`,
      workerBlobURL: false,
      errorHandler: (error) => reject(new Error(`Initialisation de l'OCR local impossible : ${String(error)}`)),
    }).then(resolve, reject);
  });
}

export async function ocrImageFile(
  file: File | Blob,
  onProgress?: (progress: OcrProgress) => void,
  options?: OcrOptions,
): Promise<{ text: string; usedVision: boolean }> {
  onProgress?.({ page: 1, total: 1, stage: "Initialisation du moteur OCR...", pct: 10 });
  try {
    const base64 = await fileToBase64(file);
    const text = await ocrWithVision(base64, file.type || "image/jpeg", options?.systemPrompt);
    onProgress?.({ page: 1, total: 1, stage: "Transcription terminée", pct: 100 });
    return { text: cleanOcrText(text), usedVision: true };
  } catch (error) {
    console.warn("[OCR] Vision indisponible, utilisation de Tesseract local", error);
  }

  const worker = await createTesseractWorker();
  try {
    onProgress?.({ page: 1, total: 1, stage: "Reconnaissance locale en cours...", pct: 60 });
    const result = await worker.recognize(file as Blob);
    onProgress?.({ page: 1, total: 1, stage: "Transcription terminée", pct: 100 });
    return { text: cleanOcrText(result.data.text || ""), usedVision: false };
  } finally {
    await worker.terminate();
  }
}

export async function ocrCanvas(
  canvas: HTMLCanvasElement,
  options?: OcrOptions,
): Promise<{ text: string; usedVision: boolean }> {
  const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  try {
    const text = await ocrWithVision(base64, "image/jpeg", options?.systemPrompt);
    return { text: cleanOcrText(text), usedVision: true };
  } catch (error) {
    console.warn("[OCR] Vision indisponible, utilisation de Tesseract local", error);
  }
  const worker = await createTesseractWorker();
  try {
    const result = await worker.recognize(canvas);
    return { text: cleanOcrText(result.data.text || ""), usedVision: false };
  } finally {
    await worker.terminate();
  }
}

export async function ocrPdfDocument(
  file: File | ArrayBuffer,
  onProgress?: (progress: OcrProgress) => void,
  options?: OcrOptions,
): Promise<{ text: string; usedVision: boolean }> {
  const data = file instanceof File ? await file.arrayBuffer() : file;
  const typedArray = new Uint8Array(data.slice(0));

  if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions?.workerSrc) {
    const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    if (workerMod?.default) pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pdf = await pdfjs.getDocument({
    data: typedArray,
    wasmUrl: origin ? `${origin}/pdfjs/wasm/` : "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/wasm/",
    iccUrl: origin ? `${origin}/pdfjs/iccs/` : "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/iccs/",
    standardFontDataUrl: origin ? `${origin}/pdfjs/standard_fonts/` : "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/standard_fonts/",
    cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/cmaps/",
    cMapPacked: true,
    isEvalSupported: true,
    verbosity: 0,
  } as any).promise;

  if (!pdf.numPages) throw new Error("Le document PDF ne contient aucune page.");
  let worker: Awaited<ReturnType<typeof createTesseractWorker>> | null = null;
  let usedVision = false;
  const pages: string[] = [];
  const scale = options?.scale || 1.8;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      onProgress?.({
        page: pageNumber,
        total: pdf.numPages,
        stage: `Reconnaissance de la page ${pageNumber}/${pdf.numPages}...`,
        pct: Math.round(((pageNumber - 0.5) / pdf.numPages) * 100),
      });
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Impossible de créer le contexte Canvas 2D pour l'OCR.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // L'OCR doit continuer même lorsque l'onglet est masqué.
      await page.render({ canvas, canvasContext: ctx, viewport, intent: "print" }).promise;

      let pageText = "";
      const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
      try {
        pageText = await ocrWithVision(base64, "image/jpeg", options?.systemPrompt);
        usedVision = true;
      } catch (error) {
        console.warn(`[OCR] Vision indisponible pour la page ${pageNumber}`, error);
      }
      if (!pageText.trim()) {
        if (!worker) worker = await createTesseractWorker();
        pageText = (await worker.recognize(canvas)).data.text || "";
      }
      const cleaned = cleanOcrText(pageText);
      if (cleaned) pages.push(`--- Page ${pageNumber} (OCR) ---\n${cleaned}`);
    }
  } finally {
    if (worker) await worker.terminate();
  }

  const text = pages.join("\n\n").trim();
  if (!text) throw new Error("L'OCR n'a détecté aucun texte lisible dans ce document scanné.");
  onProgress?.({ page: pdf.numPages, total: pdf.numPages, stage: "Reconnaissance OCR terminée", pct: 100 });
  return { text, usedVision };
}
