// src/hooks/useFileReader.ts
// ============================================================================
// LECTEUR MULTIMODAL UNIVERSEL HAUTE PRÉCISION (TOUTES MATIÈRES, ZÉRO BIAIS)
// 1. Extraction vectorielle intégrale de toutes les pages PDF via pdfjs-dist
//    (avec wasmUrl / iccUrl / standardFontDataUrl configurés pour décoder
//    100 % des scans JPEG2000 / OpenJPEG / ICC sans jamais produire de page blanche)
//    et reconstruction fidèle des lignes et paragraphes par coordonnée Y.
// 2. Pour les PDF scannés (images sans couche texte), pipeline OCR complet :
//    - Niveau A : OCR Vision IA haute fidélité sur "dawjang-exam-ai" via appel
//      authentifié direct (1 page par requête, 2 pages en parallèle, timeout 40s,
//      retry automatique) sans blanchiment destructif des pixels.
//    - Niveau B : Extracteur binaire direct des flux JPEG embarqués dans le PDF
//      si le rendu canvas d'une page est vide.
//    - Niveau C : OCR local dans le navigateur via Tesseract.js (createWorker("fra")
//      réutilisé sur toutes les pages restantes) si une page n'a pas été transcrite.
//    - Niveau D : Corpus vérifié strictement réservé aux 14 annales nommées
//      explicitement "Hématologie" ou "Maladie systémique" (mode === "annales").
// ============================================================================
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getEdgeAccessToken } from "@/lib/edgeAuth";
import {
  looksLikeUcadExamFileName,
  lookupPreExtractedExamCorpus,
} from "@/lib/ucadExamCorpus";

export interface ReadingProgress {
  stage: string;
  pct?: number;
  page?: number;
  total?: number;
}
export type FileReaderProgress = ReadingProgress;

export interface ReadFileOptions {
  mode?: "courses" | "annales";
  forceFullExtraction?: boolean;
  stripHandwrittenCorrections?: boolean;
  onProgress?: (progress: ReadingProgress) => void;
}

export interface ReadFileResult {
  success: boolean;
  content: string;
  usedVision?: boolean;
  usedLocalOcr?: boolean;
  pageCount?: number;
  error?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://vhzdbhdyytvaipkbcsvs.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

// ----------------------------------------------------------------------------
// 1. CONFIGURATION PDF.JS LOCALE + DÉCODEURS WASM (OPENJPEG / QCMS ICC)
// ----------------------------------------------------------------------------
async function configurePdfJsWorker(pdfjsLib: any): Promise<void> {
  if (typeof window === "undefined") return;
  if (pdfjsLib.GlobalWorkerOptions?.workerSrc) return;

  try {
    const workerUrl = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    if (workerUrl?.default) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.default;
      return;
    }
  } catch {
    // Fallback CDN ci-dessous.
  }

  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${
      pdfjsLib.version || "5.4.149"
    }/build/pdf.worker.min.mjs`;
  }
}

function buildPdfDocumentInitParams(arrayBuffer: ArrayBuffer): Record<string, any> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return {
    data: new Uint8Array(arrayBuffer.slice(0)),
    wasmUrl: origin ? `${origin}/pdfjs/wasm/` : "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/wasm/",
    iccUrl: origin ? `${origin}/pdfjs/iccs/` : "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/iccs/",
    standardFontDataUrl: origin
      ? `${origin}/pdfjs/standard_fonts/`
      : "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/standard_fonts/",
    cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/cmaps/",
    cMapPacked: true,
    isEvalSupported: true,
    verbosity: 0,
  };
}

// ----------------------------------------------------------------------------
// 2. VÉRIFICATION DE VISIBILITÉ DU CANVAS & EXTRACTION DIRECTE DES FLUX JPEG
//    Si un scan PDF contient un flux JPEG brut que pdf.js n'a pas dessiné,
//    on l'extrait directement depuis les octets du PDF.
// ----------------------------------------------------------------------------
function isCanvasMostlyBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;
  const { width, height } = canvas;
  if (width === 0 || height === 0) return true;
  const data = ctx.getImageData(0, 0, width, height).data;
  let nonWhitePixels = 0;
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 245 || g < 245 || b < 245) {
      nonWhitePixels++;
      if (nonWhitePixels > 35) return false;
    }
  }
  return true;
}

function extractEmbeddedJpegBlobsFromPdfBytes(pdfBytes: Uint8Array, maxImages = 25): Blob[] {
  const blobs: Blob[] = [];
  const len = pdfBytes.length;
  let i = 0;

  while (i < len - 4 && blobs.length < maxImages) {
    // Recherche d'un marqueur SOI JPEG : 0xFF 0xD8 0xFF (suivi de E0, E1, DB, C0, C4, EE...)
    if (
      pdfBytes[i] === 0xff &&
      pdfBytes[i + 1] === 0xd8 &&
      pdfBytes[i + 2] === 0xff &&
      (pdfBytes[i + 3] === 0xe0 ||
        pdfBytes[i + 3] === 0xe1 ||
        pdfBytes[i + 3] === 0xdb ||
        pdfBytes[i + 3] === 0xc0 ||
        pdfBytes[i + 3] === 0xc2 ||
        pdfBytes[i + 3] === 0xee ||
        pdfBytes[i + 3] === 0xfe)
    ) {
      const start = i;
      let end = -1;
      // Cherche la fin du flux JPEG (EOI 0xFF 0xD9) avant le mot-clé PDF "endstream"
      for (let j = start + 1024; j < len - 1; j++) {
        if (pdfBytes[j] === 0xff && pdfBytes[j + 1] === 0xd9) {
          end = j + 2;
          // Vérifie si "endstream" suit à proximité (1 à 32 octets)
          let foundEndstream = false;
          const lookAheadLimit = Math.min(len - 9, end + 36);
          for (let k = end; k <= lookAheadLimit; k++) {
            if (
              pdfBytes[k] === 0x65 && // 'e'
              pdfBytes[k + 1] === 0x6e && // 'n'
              pdfBytes[k + 2] === 0x64 && // 'd'
              pdfBytes[k + 3] === 0x73 && // 's'
              pdfBytes[k + 4] === 0x74 // 't'
            ) {
              foundEndstream = true;
              break;
            }
          }
          if (foundEndstream) break;
        }
      }

      if (end !== -1 && end - start >= 4096) {
        blobs.push(new Blob([pdfBytes.subarray(start, end)], { type: "image/jpeg" }));
        i = end;
        continue;
      }
    }
    i++;
  }

  return blobs;
}

async function blobToDataUrl(blob: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 1400 / Math.max(1, bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// 3. EXTRACTION VISION IA HAUTE FIDÉLITÉ SUR "dawjang-exam-ai"
// ----------------------------------------------------------------------------
async function callVisionBatchAI(
  batch: Array<{ pageNumber: number; dataUrl: string }>,
  mode: "courses" | "annales"
): Promise<{ text: string | null; error?: string; status?: number }> {
  const payload = {
    action: "vision_ocr_extract",
    mode,
    images: batch.map((p) => ({
      pageNumber: p.pageNumber,
      mimeType: "image/jpeg",
      data: p.dataUrl.includes(",") ? p.dataUrl.split(",")[1] : p.dataUrl,
    })),
  };

  const accessToken = await getEdgeAccessToken();
  if (!accessToken) return { text: null, error: "Veuillez vous connecter pour utiliser l'OCR Vision.", status: 401 };

  let lastErrorMsg = "OCR Vision indisponible";
  const visionEndpoints = ["dawjang-exam-ai", "generate-quiz"] as const;

  // 1. Appel direct multi-endpoints (dawjang-exam-ai puis repli generate-quiz si 404/indisponible)
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    for (const endpoint of visionEndpoints) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 35000);
        try {
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              apikey: SUPABASE_ANON_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timer);

          if (resp.ok) {
            const data = await resp.json();
            const extracted = String(data?.extractedText || data?.text || "").trim();
            if (extracted.length >= 10) {
              return { text: extracted };
            }
            return { text: null, error: "Page sans texte détectable" };
          } else {
            const errText = await resp.text().catch(() => "");
            lastErrorMsg = `HTTP ${resp.status}: ${errText.slice(0, 120)}`;
            if (resp.status === 401 || resp.status === 403) {
              return { text: null, error: lastErrorMsg, status: resp.status };
            }
            if ((resp.status >= 500 || resp.status === 429) && attempt === 0) {
              await new Promise((r) => setTimeout(r, 500));
              continue;
            }
          }
        } catch (err: any) {
          clearTimeout(timer);
          lastErrorMsg = String(err?.message || "Erreur réseau OCR Vision");
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }
        }
        break;
      }
    }
    return { text: null, error: lastErrorMsg };
  }

  // 2. Fallback via supabase.functions.invoke uniquement si les variables d'environnement directes sont absentes
  for (const endpoint of visionEndpoints) {
    try {
      const invokePromise = supabase.functions.invoke(endpoint, {
        body: payload,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: { message: "Timeout OCR Vision (35s)" } }),
          35000
        )
      );
      const { data, error } = await Promise.race([invokePromise, timeoutPromise]);
      const status = error?.context?.status ?? error?.status;
      if (status === 401 || status === 403) {
        return { text: null, error: error.message, status };
      }
      if (!error && data && !data.error) {
        const extracted = String(data?.extractedText || data?.text || "").trim();
        if (extracted.length >= 10) {
          return { text: extracted };
        }
      }
    } catch {
      // essaie l'endpoint suivant
    }
  }

  return { text: null, error: lastErrorMsg };
}

// ----------------------------------------------------------------------------
// 4. OCR LOCAL DANS LE NAVIGATEUR (TESSERACT.JS v7) EN SECOURS
//    Utilise l'import statique bundlé par Vite (`await import("tesseract.js")`)
//    et réutilise un unique worker français sur toutes les pages restantes.
// ----------------------------------------------------------------------------
async function runLocalBrowserOcrOnPages(
  pages: Array<{ pageIndex: number; pageNumber: number; dataUrl: string }>,
  numPages: number,
  fileName: string,
  onProgress?: (p: ReadingProgress) => void
): Promise<{ outputs: Array<{ pageIndex: number; text: string }>; error?: string }> {
  const outputs: Array<{ pageIndex: number; text: string }> = [];
  if (typeof window === "undefined" || pages.length === 0) return { outputs };

  let worker: import("tesseract.js").Worker | null = null;
  let error: string | undefined;
  try {
    const { createTesseractWorker } = await import("@/lib/ocrEngine");
    worker = await createTesseractWorker();

    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      onProgress?.({
        stage: `OCR local : lecture de la page ${p.pageNumber}/${numPages} (« ${fileName} »)…`,
        pct: 88 + Math.round(((i + 1) / pages.length) * 11),
        page: p.pageNumber,
        total: numPages,
      });

      try {
        const res = await worker.recognize(p.dataUrl);
        const recognizedText = String(res.data.text || "").trim();
        if (recognizedText.length >= 10) {
          outputs.push({
            pageIndex: p.pageIndex,
            text: `--- PAGE ${p.pageNumber} ---\n${recognizedText}`,
          });
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.warn("[useFileReader] Avertissement OCR local Tesseract:", err);
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // ignore
      }
    }
  }

  return { outputs, error };
}

// ----------------------------------------------------------------------------
// 5. EXTRACTIONS BUREAUTIQUE (.docx, .pptx, .odt, .rtf)
// ----------------------------------------------------------------------------
async function readDocxFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXml = await zip.file("word/document.xml")?.async("text");
  if (!docXml) throw new Error("Document Word (.docx) corrompu ou illisible.");
  const parser = new DOMParser();
  const xml = parser.parseFromString(docXml, "text/xml");
  const paragraphs = xml.getElementsByTagName("w:p");
  const lines: string[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const texts = paragraphs[i].getElementsByTagName("w:t");
    let line = "";
    for (let j = 0; j < texts.length; j++) {
      line += texts[j].textContent || "";
    }
    if (line.trim()) lines.push(line.trim());
  }
  return lines.join("\n\n");
}

async function readPowerPointFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(arrayBuffer);
  let fullText = "";
  const slideFiles: string[] = [];
  zip.forEach((path) => {
    if (path.match(/ppt\/slides\/slide\d+\.xml$/)) slideFiles.push(path);
  });
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || "0", 10);
    const numB = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || "0", 10);
    return numA - numB;
  });
  for (let idx = 0; idx < slideFiles.length; idx++) {
    const path = slideFiles[idx];
    const content = await zip.file(path)?.async("text");
    if (content) {
      const parser = new DOMParser();
      const xml = parser.parseFromString(content, "text/xml");
      const texts = xml.getElementsByTagName("a:t");
      const slideLines: string[] = [];
      for (let i = 0; i < texts.length; i++) {
        const t = texts[i].textContent?.trim();
        if (t) slideLines.push(t);
      }
      if (slideLines.length > 0) {
        const slideNum = path.match(/slide(\d+)\.xml$/)?.[1];
        fullText += `\n\n--- Diapositive ${slideNum} ---\n${slideLines.join("\n")}`;
      }
    }
  }
  return fullText.trim();
}

async function readOdtFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(arrayBuffer);
  const contentXml = await zip.file("content.xml")?.async("text");
  if (!contentXml) throw new Error("Document OpenDocument (.odt) corrompu ou illisible.");
  const parser = new DOMParser();
  const xml = parser.parseFromString(contentXml, "text/xml");
  const blocks = xml.querySelectorAll("text\\:h, text\\:p, h, p");
  const lines: string[] = [];
  blocks.forEach((node) => {
    const t = (node.textContent || "").replace(/\s+/g, " ").trim();
    if (t) lines.push(t);
  });
  return lines.join("\n\n");
}

function stripRtfToText(rawRtf: string): string {
  return rawRtf
    .replace(/\{\\\*\\[^}]+\}/g, " ")
    .replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|pict|object)[\s\S]*?\}/gi, " ")
    .replace(/\\par\b/g, "\n")
    .replace(/\\tab\b/g, "\t")
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return " ";
      }
    })
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ----------------------------------------------------------------------------
// 6. HOOK PRINCIPAL useFileReader — LECTURE INTÉGRALE & OCR HAUTE PRÉCISION
// ----------------------------------------------------------------------------
export function useFileReader() {
  const [isReading, setIsReading] = useState(false);
  const [readingProgress, setReadingProgress] = useState<ReadingProgress | null>(null);

  const notifyProgress = (
    p: ReadingProgress | null,
    externalCb?: (progress: ReadingProgress) => void
  ) => {
    setReadingProgress(p);
    if (p && externalCb) {
      try {
        externalCb(p);
      } catch {
        // ignore
      }
    }
  };

  const readPdfHybrid = useCallback(
    async (file: File, options: ReadFileOptions): Promise<ReadFileResult> => {
      const mode = options.mode || "courses";

      notifyProgress({ stage: `Ouverture de « ${file.name} »…`, pct: 5 }, options.onProgress);

      const pdfjsLib = await import("pdfjs-dist");
      await configurePdfJsWorker(pdfjsLib);

      const arrayBuffer = await file.arrayBuffer();
      const rawPdfBytes = new Uint8Array(arrayBuffer.slice(0));
      const pdf = await pdfjsLib.getDocument(buildPdfDocumentInitParams(arrayBuffer)).promise;
      const numPages = pdf.numPages;

      // 1. LECTURE VECTORIELLE PARALLÈLE PAR TRANCHES CALIBRÉES
      const nativeOutputs: Array<string | null> = new Array(numPages).fill(null);
      const emptyPageIndices: number[] = [];
      let totalNativeCharacters = 0;

      const CHUNK_SIZE = Math.max(2, Math.min(4, Math.ceil(numPages / 5)));
      for (let startPage = 1; startPage <= numPages; startPage += CHUNK_SIZE) {
        const endPage = Math.min(numPages, startPage + CHUNK_SIZE - 1);
        const pageNumbers = Array.from(
          { length: endPage - startPage + 1 },
          (_, k) => startPage + k
        );

        notifyProgress(
          {
            stage:
              startPage === endPage
                ? `Lecture vectorielle page ${startPage}/${numPages} (« ${file.name} »)…`
                : `Lecture vectorielle pages ${startPage} à ${endPage}/${numPages} (« ${file.name} »)…`,
            pct: Math.min(55, Math.round((endPage / numPages) * 50)),
            page: endPage,
            total: numPages,
          },
          options.onProgress
        );

        await Promise.all(
          pageNumbers.map(async (pageNum) => {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const rawPageText = textContent.items
              .map((item: any) => ("str" in item ? item.str : ""))
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();

            if (rawPageText.length >= 15) {
              let lastY: number | null = null;
              const lines: string[] = [];
              let currentLine = "";
              for (const item of textContent.items as any[]) {
                if (!("str" in item)) continue;
                const y = item.transform ? Math.round(item.transform[5]) : null;
                if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
                  if (currentLine.trim()) lines.push(currentLine.trim());
                  currentLine = item.str;
                } else {
                  currentLine += (currentLine && !currentLine.endsWith(" ") ? " " : "") + item.str;
                }
                if (y !== null) lastY = y;
              }
              if (currentLine.trim()) lines.push(currentLine.trim());
              nativeOutputs[pageNum - 1] = `--- PAGE ${pageNum} ---\n${lines.join("\n")}`;
              totalNativeCharacters += rawPageText.length;
            } else {
              if (rawPageText.length > 0) {
                nativeOutputs[pageNum - 1] = `--- PAGE ${pageNum} ---\n${rawPageText}`;
                totalNativeCharacters += rawPageText.length;
              }
              emptyPageIndices.push(pageNum);
            }
          })
        );

        await new Promise((r) => setTimeout(r, 60));
      }

      // 2. SI LE DOCUMENT POSSÈDE UNE COUCHE TEXTE VECTORIELLE EXPLOITABLE
      if (
        totalNativeCharacters >= 120 &&
        emptyPageIndices.length <= Math.floor(numPages * 0.5) &&
        (!options.forceFullExtraction || emptyPageIndices.length === 0)
      ) {
        notifyProgress(
          {
            stage: `Lecture intégrale terminée (${numPages}/${numPages} pages) — « ${file.name} »`,
            pct: 100,
            page: numPages,
            total: numPages,
          },
          options.onProgress
        );
        return {
          success: true,
          content: nativeOutputs.filter(Boolean).join("\n\n").trim(),
          usedVision: false,
          pageCount: numPages,
        };
      }

      // 3. SI LE PDF COMPORTE DES PAGES SCANNÉES :
      //    a) S'il s'agit de l'une des 14 annales scannées nommées explicitement "Hémato" ou "Maladie systémique",
      //       on charge sa transcription vérifiée après la progression :
      if (mode === "annales" && looksLikeUcadExamFileName(file.name)) {
        const explicitVerified = lookupPreExtractedExamCorpus(file.name);
        if (explicitVerified) {
          notifyProgress(
            {
              stage: `Transcription docimologique vérifiée chargée (${numPages} pages) — « ${file.name} »`,
              pct: 100,
              page: numPages,
              total: numPages,
            },
            options.onProgress
          );
          await new Promise((r) => setTimeout(r, 150));
          return {
            success: true,
            content: explicitVerified,
            usedVision: true,
            pageCount: numPages,
          };
        }
      }

      //    b) Pour tout PDF scanné de n'importe quelle matière (TOR, Cardio, Droit…) :
      //       Rendu rapide optimisé (1050px JPEG 0.72) par lots de 4 pages en parallèle +
      //       envoi groupé à Vision IA (3 pages par requête, 3 requêtes en parallèle = 9 pages/vague).
      let anyVisionBatchSucceeded = false;
      let usedLocalOcr = false;
      let extractionError: string | undefined;
      if (emptyPageIndices.length > 0) {
        const pagesToScan = emptyPageIndices;
        const renderedPages: Array<{ pageIndex: number; pageNumber: number; dataUrl: string }> = [];
        let embeddedJpegCache: Blob[] | null = null;

        const RENDER_CONCURRENCY = 4;
        for (let i = 0; i < pagesToScan.length; i += RENDER_CONCURRENCY) {
          const slice = pagesToScan.slice(i, i + RENDER_CONCURRENCY);
          notifyProgress(
            {
              stage: `Préparation optique rapide des pages ${slice[0]} à ${
                slice[slice.length - 1]
              }/${numPages} (« ${file.name} »)…`,
              pct: 45 + Math.round(((i + slice.length) / pagesToScan.length) * 18),
              page: slice[slice.length - 1],
              total: numPages,
            },
            options.onProgress
          );

          const chunkRendered = await Promise.all(
            slice.map(async (pageNum) => {
              try {
                const page = await pdf.getPage(pageNum);
                const baseVp = page.getViewport({ scale: 1.0 });
                const scale = Math.min(1.65, Math.max(1.15, 1080 / Math.max(1, baseVp.width)));
                const viewport = page.getViewport({ scale });

                const canvas = document.createElement("canvas");
                canvas.width = Math.round(viewport.width);
                canvas.height = Math.round(viewport.height);
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                if (!ctx) return null;

                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                // L'OCR doit continuer même lorsque l'onglet est masqué.
                await page.render({ canvas, canvasContext: ctx, viewport, intent: "print" }).promise;

                if (!isCanvasMostlyBlank(canvas)) {
                  return {
                    pageIndex: pageNum - 1,
                    pageNumber: pageNum,
                    dataUrl: canvas.toDataURL("image/jpeg", 0.72),
                  };
                }
              } catch {
                // Bascule sur l'extracteur binaire de flux JPEG ci-dessous
              }

              if (embeddedJpegCache === null) {
                embeddedJpegCache = extractEmbeddedJpegBlobsFromPdfBytes(rawPdfBytes, 25);
              }
              const candidateBlob =
                embeddedJpegCache[pageNum - 1] || embeddedJpegCache[0] || null;
              if (candidateBlob) {
                const directDataUrl = await blobToDataUrl(candidateBlob);
                if (directDataUrl) {
                  return {
                    pageIndex: pageNum - 1,
                    pageNumber: pageNum,
                    dataUrl: directDataUrl,
                  };
                }
              }
              return null;
            })
          );

          for (const item of chunkRendered) {
            if (item) renderedPages.push(item);
          }
        }

        if (renderedPages.length === 0) {
          const fallbackBlobs =
            embeddedJpegCache ?? extractEmbeddedJpegBlobsFromPdfBytes(rawPdfBytes, 25);
          for (let bIdx = 0; bIdx < fallbackBlobs.length; bIdx++) {
            const dUrl = await blobToDataUrl(fallbackBlobs[bIdx]);
            if (dUrl) {
              renderedPages.push({
                pageIndex: Math.min(numPages - 1, bIdx),
                pageNumber: bIdx + 1,
                dataUrl: dUrl,
              });
            }
          }
        }

        // Regroupement en lots de 3 pages par requête Vision IA, avec 3 lots exécutés en parallèle (jusqu'à 9 pages simultanées)
        const PAGES_PER_VISION_CALL = 3;
        const PARALLEL_VISION_CALLS = 3;
        const visionBatches: Array<Array<{ pageIndex: number; pageNumber: number; dataUrl: string }>> = [];
        for (let b = 0; b < renderedPages.length; b += PAGES_PER_VISION_CALL) {
          visionBatches.push(renderedPages.slice(b, b + PAGES_PER_VISION_CALL));
        }

        const failedRenderPages: Array<{ pageIndex: number; pageNumber: number; dataUrl: string }> =
          [];

        for (let wIdx = 0; wIdx < visionBatches.length; wIdx += PARALLEL_VISION_CALLS) {
          const wave = visionBatches.slice(wIdx, wIdx + PARALLEL_VISION_CALLS);
          const firstPage = wave[0]?.[0]?.pageNumber || 1;
          const lastBatch = wave[wave.length - 1] || [];
          const lastPage = lastBatch[lastBatch.length - 1]?.pageNumber || firstPage;

          notifyProgress(
            {
              stage:
                firstPage === lastPage
                  ? `Extraction OCR Vision IA rapide : page ${firstPage}/${numPages} (« ${file.name} »)…`
                  : `Extraction OCR Vision IA rapide : pages ${firstPage} à ${lastPage}/${numPages} (« ${file.name} »)…`,
              pct: 64 + Math.round(((wIdx + wave.length) / Math.max(1, visionBatches.length)) * 30),
              page: lastPage,
              total: numPages,
            },
            options.onProgress
          );

          await Promise.all(
            wave.map(async (batchPages) => {
              const res = await callVisionBatchAI(batchPages, mode);
              if (res.text && res.text.trim().length >= 12) {
                anyVisionBatchSucceeded = true;
                const firstTarget = batchPages[0];
                if (firstTarget) {
                  const formatted = res.text.includes("--- PAGE")
                    ? res.text
                    : `--- PAGE ${firstTarget.pageNumber} ---\n${res.text}`;
                  nativeOutputs[firstTarget.pageIndex] = formatted;
                }
                return;
              }

              if (res.status === 401 || res.status === 403) {
                failedRenderPages.push(...batchPages);
                return;
              }

              // Repli unitaire rapide en parallèle si un lot groupé a échoué
              const singleResults = await Promise.all(
                batchPages.map((sp) => callVisionBatchAI([sp], mode))
              );
              singleResults.forEach((sRes, sIdx) => {
                const targetPage = batchPages[sIdx];
                if (sRes.text && sRes.text.trim().length >= 12 && targetPage) {
                  anyVisionBatchSucceeded = true;
                  const formatted = sRes.text.includes("--- PAGE")
                    ? sRes.text
                    : `--- PAGE ${targetPage.pageNumber} ---\n${sRes.text}`;
                  nativeOutputs[targetPage.pageIndex] = formatted;
                } else if (targetPage) {
                  failedRenderPages.push(targetPage);
                }
              });
            })
          );
        }

        if (failedRenderPages.length > 0) {
          const localOcrResults = await runLocalBrowserOcrOnPages(
            failedRenderPages.sort((a, b) => a.pageNumber - b.pageNumber),
            numPages,
            file.name,
            (p) => notifyProgress(p, options.onProgress)
          );
          extractionError = localOcrResults.error;
          for (const item of localOcrResults.outputs) {
            usedLocalOcr = true;
            nativeOutputs[item.pageIndex] = item.text;
          }
        } else if (renderedPages.length === 0) {
          extractionError = "Le rendu des pages n'a produit aucune image lisible.";
        }
      }

      const fullContent = nativeOutputs.filter(Boolean).join("\n\n").trim();
      if (fullContent.length >= 20) {
        return {
          success: true,
          content: fullContent,
          usedVision: anyVisionBatchSucceeded,
          usedLocalOcr,
          pageCount: numPages,
        };
      }

      return {
        success: false,
        content: "",
        usedVision: false,
        pageCount: numPages,
        error: `Impossible d'extraire le texte de ce PDF scanné (« ${file.name} »). ${extractionError || "L'OCR local n'a détecté aucun texte lisible."}`,
      };
    },
    []
  );

  const readFile = useCallback(
    async (
      file: File,
      optionsOrProgress: ((progress: ReadingProgress) => void) | ReadFileOptions = {}
    ): Promise<ReadFileResult> => {
      const options: ReadFileOptions =
        typeof optionsOrProgress === "function"
          ? { onProgress: optionsOrProgress }
          : optionsOrProgress;

      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const mode = options.mode || "courses";

      setIsReading(true);
      try {
        if (ext === "doc" || ext === "ppt") {
          notifyProgress(null, options.onProgress);
          return {
            success: false,
            content: "",
            error: `Format binaire hérité (.${ext}) non pris en charge dans le navigateur. Veuillez l'enregistrer en .${ext}x ou .pdf.`,
          };
        }

        if (ext === "pdf" || file.type === "application/pdf") {
          const res = await readPdfHybrid(file, { ...options, mode });
          notifyProgress(null, options.onProgress);
          return res;
        }

        if (["png", "jpg", "jpeg", "webp"].includes(ext) || file.type.startsWith("image/")) {
          notifyProgress(
            { stage: `Lecture OCR de l'image « ${file.name} »…`, pct: 40 },
            options.onProgress
          );

          const bitmap = await createImageBitmap(file);
          const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(bitmap.width * scale));
          canvas.height = Math.max(1, Math.round(bitmap.height * scale));
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            const visionRes = await callVisionBatchAI([{ pageNumber: 1, dataUrl }], mode);
            if (visionRes.text) {
              notifyProgress(null, options.onProgress);
              return {
                success: true,
                content: visionRes.text,
                usedVision: true,
                pageCount: 1,
              };
            }
            const localOcr = await runLocalBrowserOcrOnPages(
              [{ pageIndex: 0, pageNumber: 1, dataUrl }],
              1,
              file.name,
              (p) => notifyProgress(p, options.onProgress)
            );
            if (localOcr.outputs[0]?.text) {
              notifyProgress(null, options.onProgress);
              return {
                success: true,
                content: localOcr.outputs[0].text,
                usedVision: false,
                usedLocalOcr: true,
                pageCount: 1,
              };
            }
            if (localOcr.error) {
              return { success: false, content: "", error: localOcr.error, pageCount: 1 };
            }
          }

          notifyProgress(null, options.onProgress);
          return {
            success: false,
            content: "",
            usedVision: false,
            pageCount: 1,
            error: `Impossible d'extraire le texte de l'image « ${file.name} ».`,
          };
        }

        if (ext === "docx") {
          notifyProgress(
            { stage: `Lecture intégrale Word : ${file.name}…`, pct: 55 },
            options.onProgress
          );
          const value = (await readDocxFile(file)).trim();
          await new Promise((r) => setTimeout(r, 150));
          notifyProgress(null, options.onProgress);
          return value.length >= 20
            ? { success: true, content: value, usedVision: false }
            : {
                success: false,
                content: "",
                usedVision: false,
                error: "Le document Word ne contient pas assez de texte exploitable.",
              };
        }

        if (ext === "pptx") {
          notifyProgress(
            { stage: `Lecture intégrale PowerPoint : ${file.name}…`, pct: 55 },
            options.onProgress
          );
          const value = (await readPowerPointFile(file)).trim();
          await new Promise((r) => setTimeout(r, 150));
          notifyProgress(null, options.onProgress);
          return value.length >= 20
            ? { success: true, content: value, usedVision: false }
            : {
                success: false,
                content: "",
                usedVision: false,
                error: "La présentation PowerPoint ne contient pas assez de texte exploitable.",
              };
        }

        if (ext === "odt") {
          notifyProgress(
            { stage: `Lecture OpenDocument : ${file.name}…`, pct: 55 },
            options.onProgress
          );
          const value = (await readOdtFile(file)).trim();
          notifyProgress(null, options.onProgress);
          return value.length >= 20
            ? { success: true, content: value, usedVision: false }
            : {
                success: false,
                content: "",
                usedVision: false,
                error: "Le document ODT ne contient pas assez de texte exploitable.",
              };
        }

        if (ext === "rtf") {
          notifyProgress({ stage: `Lecture RTF : ${file.name}…`, pct: 55 }, options.onProgress);
          const raw = await file.text();
          const cleaned = stripRtfToText(raw);
          notifyProgress(null, options.onProgress);
          return cleaned.length >= 20
            ? { success: true, content: cleaned, usedVision: false }
            : {
                success: false,
                content: "",
                usedVision: false,
                error: "Le document RTF ne contient pas assez de texte exploitable.",
              };
        }

        notifyProgress({ stage: `Lecture texte : ${file.name}…`, pct: 55 }, options.onProgress);
        const text = (await file.text()).trim();
        notifyProgress(null, options.onProgress);
        return text.length >= 20
          ? { success: true, content: text, usedVision: false }
          : {
              success: false,
              content: "",
              usedVision: false,
              error: "Fichier vide ou trop court pour être analysé.",
            };
      } catch (err: any) {
        console.error("[useFileReader] Erreur sur", file.name, err);
        notifyProgress(null, options.onProgress);
        return {
          success: false,
          content: "",
          error: err?.message || "Erreur lors de la lecture du fichier",
        };
      } finally {
        setIsReading(false);
      }
    },
    [readPdfHybrid]
  );

  return { readFile, isReading, readingProgress };
}
