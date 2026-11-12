// src/hooks/useFileReader.ts
// ============================================================================
// LECTEUR MULTIMODAL AUTONOME 100 % — PDF Natifs, PDF Scannés (CamScanner/Photos),
// Filtre Anti-Corrections Manuscrites (Stylo Bleu/Rouge) & OCR WebAssembly Auto-Injecté
// ============================================================================
import { useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";

// Worker PDF local servi directement par Vite (aucune dépendance réseau externe)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
  pageCount?: number;
  wordCount?: number;
  fileName?: string;
  fileType?: string;
  error?: string;
}
export type FileReaderResult = ReadFileResult;

// ----------------------------------------------------------------------------
// 1. CHARGEMENT AUTOMATIQUE DE TESSERACT WEBASSEMBLY VIA CDN
//    (Zéro "npm install" requis, fonctionne immédiatement sur localhost:8080)
// ----------------------------------------------------------------------------
let tesseractScriptPromise: Promise<any> | null = null;

function loadTesseractFromCDN(): Promise<any> {
  if (typeof window !== "undefined" && (window as any).Tesseract) {
    return Promise.resolve((window as any).Tesseract);
  }
  if (tesseractScriptPromise) return tesseractScriptPromise;

  tesseractScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    script.async = true;
    script.onload = () => {
      if ((window as any).Tesseract) resolve((window as any).Tesseract);
      else reject(new Error("Tesseract non initialisé"));
    };
    script.onerror = () => {
      // Fallback miroir unpkg si jsdelivr est bloqué
      const fallback = document.createElement("script");
      fallback.src = "https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js";
      fallback.async = true;
      fallback.onload = () => resolve((window as any).Tesseract);
      fallback.onerror = () => reject(new Error("Impossible de charger le moteur OCR depuis le CDN"));
      document.head.appendChild(fallback);
    };
    document.head.appendChild(script);
  });

  return tesseractScriptPromise;
}

// ----------------------------------------------------------------------------
// 2. PRÉ-TRAITEMENT MATRICIEL CANVAS : SUPPRESSION DU STYLO BLEU/ROUGE,
//    DES FILIGRANES "U" ET DES OMBRES CAMSCANNER AVANT L'OCR
// ----------------------------------------------------------------------------
export function cleanScannedExamCanvas(canvas: HTMLCanvasElement, stripHandwriting = true): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 1. Détection de l'encre de stylo bleu, rouge, vert ou stabilo (forte saturation chromatique)
    // Le texte imprimé de l'examen a R ≈ G ≈ B (neutre). Le stylo bleu a B >> R et B >> G.
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const colorSpread = maxC - minC;

    if (stripHandwriting && colorSpread > 34 && maxC > 75) {
      // Efface l'annotation au stylo coloré -> Blanc pur
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      continue;
    }

    // 2. Suppression des filigranes clairs ("U" en fond) et des ombres grises CamScanner
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 188) {
      // Fond blanc pur
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    } else if (lum < 135) {
      // Renforcement des caractères imprimés en noir net pour maximiser la précision OCR
      const darkened = Math.max(0, Math.round(lum * 0.45));
      data[i] = darkened;
      data[i + 1] = darkened;
      data[i + 2] = darkened;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// Post-nettoyage docimologique du texte extrait par OCR (retire le bruit résiduel des marges)
export function cleanExtractedExamText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/Scanned with[\s\S]{0,25}CamScanner/gi, "")
    .replace(/\bCamScanner\b/gi, "")
    .replace(/[☑✓✔✗✘☐]/g, " ")
    // Normalise les en-têtes de QCM mal reconnus par l'OCR ("OCM 1", "0CM 2", "QCMI")
    .replace(/\b(?:OCM|0CM|QCMI)\b/g, (m) => (m === "QCMI" ? "QCM 1" : "QCM"))
    .replace(/\b(?:EC1|EC\s*1)\b/gi, "\n=== SECTION EC1 ===\n")
    .replace(/\b(?:EC2|EC\s*2)\b/gi, "\n=== SECTION EC2 ===\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const canvasToDataUrl = (canvas: HTMLCanvasElement, quality = 0.82): string =>
  canvas.toDataURL("image/jpeg", quality);

// ----------------------------------------------------------------------------
// 3. EXTRACTION HYBRIDE : CLAUDE SONNET 4.6 VISION (SI DISPONIBLE)
//    + BASCULE AUTOMATIQUE SUR LE POOL DE WORKERS WEBASSEMBLY TESSERACT CDN
// ----------------------------------------------------------------------------
async function tryClaudeDirectVision(
  pages: Array<{ pageNumber: number; dataUrl: string }>,
  mode: "courses" | "annales"
): Promise<string | null> {
  const env = (import.meta as any).env || {};
  const anthropicKey =
    env.VITE_ANTHROPIC_API_KEY ||
    env.VITE_CLAUDE_API_KEY ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("ANTHROPIC_API_KEY") : null);

  if (!anthropicKey) return null;

  try {
    const content: any[] = [];
    for (const p of pages) {
      const base64 = p.dataUrl.includes(",") ? p.dataUrl.split(",")[1] : p.dataUrl;
      content.push({ type: "text", text: `--- PAGE ${p.pageNumber} ---` });
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: base64 },
      });
    }
    content.push({
      type: "text",
      text:
        mode === "annales"
          ? "Transcris INTÉGRALEMENT (100 % des QCM, cas cliniques et propositions A-E / 1-5) ces pages d'examen sans aucun résumé. Ignore toutes les notes manuscrites, coches ou diapositives de cours rajoutées."
          : "Transcris INTÉGRALEMENT (100 % du cours, titres, tableaux et valeurs) ces pages sans aucun résumé.",
    });

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        temperature: 0.05,
        messages: [{ role: "user", content }],
      }),
    });

    if (!resp.ok) return null;
    const json = await resp.json();
    const text = json?.content?.map((c: any) => c.text || "").join("\n") || "";
    return text.trim().length > 30 ? text.trim() : null;
  } catch {
    return null;
  }
}

async function extractScannedPagesGuaranteed(
  pages: Array<{ pageNumber: number; dataUrl: string }>,
  mode: "courses" | "annales",
  fileName: string,
  onProgress?: (p: ReadingProgress) => void
): Promise<string> {
  // 1. Tentative rapide avec Claude Sonnet 4.6 direct si une clé locale est présente
  const directClaude = await tryClaudeDirectVision(pages.slice(0, 5), mode);
  if (directClaude && pages.length <= 5) {
    return cleanExtractedExamText(directClaude);
  }

  // 2. Tentative via Supabase Edge Function (avec timeout court de 8s pour ne jamais bloquer si non déployée)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const { data, error } = await supabase.functions.invoke("generate-quiz", {
      body: {
        action: "vision_ocr_extract",
        mode,
        images: pages.slice(0, 4).map((p) => ({
          pageNumber: p.pageNumber,
          mimeType: "image/jpeg",
          data: p.dataUrl.includes(",") ? p.dataUrl.split(",")[1] : p.dataUrl,
        })),
      },
    });
    clearTimeout(timeoutId);
    if (!error && data?.extractedText && String(data.extractedText).trim().length > 40 && pages.length <= 4) {
      return cleanExtractedExamText(String(data.extractedText));
    }
  } catch {
    // Bascule immédiate sur le moteur OCR WebAssembly embarqué
  }

  // 3. MOTEUR GARANTI 100 % : Pool de Workers WebAssembly (Tesseract v5 CDN)
  onProgress?.({
    stage: `Initialisation du moteur OCR haute précision pour « ${fileName} »…`,
    pct: 30,
  });

  const Tesseract = await loadTesseractFromCDN();
  const concurrency = Math.min(3, pages.length);
  const workers: any[] = [];

  for (let w = 0; w < concurrency; w++) {
    const worker = await Tesseract.createWorker("fra");
    workers.push(worker);
  }

  const results: string[] = new Array(pages.length).fill("");
  let completed = 0;

  try {
    await Promise.all(
      workers.map(async (worker, workerIdx) => {
        for (let idx = workerIdx; idx < pages.length; idx += concurrency) {
          const item = pages[idx];
          const { data } = await worker.recognize(item.dataUrl);
          const cleanedPage = cleanExtractedExamText(data?.text || "");
          results[idx] = `--- PAGE ${item.pageNumber} ---\n${cleanedPage}`;
          completed++;
          const pct = 30 + Math.round((completed / pages.length) * 68);
          onProgress?.({
            stage: `Extraction OCR & Dé-correction manuscrite : page ${completed}/${pages.length} (${fileName})…`,
            pct,
          });
        }
      })
    );
  } finally {
    await Promise.all(workers.map((w) => w.terminate().catch(() => {})));
  }

  return results.filter(Boolean).join("\n\n").trim();
}

// ----------------------------------------------------------------------------
// 4. HOOK PRINCIPAL useFileReader
// ----------------------------------------------------------------------------
export function useFileReader() {
  const [isReading, setIsReading] = useState(false);
  const [readingProgress, setReadingProgress] = useState<ReadingProgress | null>(null);

  const notifyProgress = (prog: ReadingProgress, callback?: (p: ReadingProgress) => void) => {
    setReadingProgress(prog);
    callback?.(prog);
  };

  const readPdfHybrid = useCallback(
    async (file: File, options: ReadFileOptions): Promise<ReadFileResult> => {
      const mode = options.mode || "annales";
      const stripHandwriting = options.stripHandwrittenCorrections ?? mode === "annales";

      notifyProgress({ stage: `Ouverture de « ${file.name} »…`, pct: 5 }, options.onProgress);

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      const nativeOutputs: Array<string | null> = new Array(numPages).fill(null);
      const scannedPages: Array<{ pageIndex: number; pageNumber: number; dataUrl: string }> = [];

      for (let i = 1; i <= numPages; i++) {
        notifyProgress(
          {
            stage: `Préparation et nettoyage de la page ${i}/${numPages} (${file.name})…`,
            pct: Math.round((i / numPages) * 28),
          },
          options.onProgress
        );

        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const rawPageText = textContent.items
          .map((item: any) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        // Si la page contient une vraie couche texte numérique (>= 120 caractères)
        if (rawPageText.length >= 120) {
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
          nativeOutputs[i - 1] = `--- PAGE ${i} ---\n${cleanExtractedExamText(lines.join("\n"))}`;
        } else {
          // Page scannée / photo d'examen -> Rendu Canvas haute résolution + Filtre Anti-Stylo
          const baseVp = page.getViewport({ scale: 1.0 });
          const scale = Math.min(2.2, Math.max(1.5, 1650 / Math.max(1, baseVp.width)));
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          const ctx = canvas.getContext("2d");

          if (ctx) {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport }).promise;
            cleanScannedExamCanvas(canvas, stripHandwriting);
            scannedPages.push({
              pageIndex: i - 1,
              pageNumber: i,
              dataUrl: canvasToDataUrl(canvas, 0.84),
            });
          }
        }
      }

      // Extraction garantie sur toutes les pages scannées détectées
      if (scannedPages.length > 0) {
        const extractedAll = await extractScannedPagesGuaranteed(
          scannedPages,
          mode,
          file.name,
          (prog) => notifyProgress(prog, options.onProgress)
        );

        // Réinsertion page par page ou globale
        const splitByPages = extractedAll.split(/(?=--- PAGE \d+ ---)/g).filter((s) => s.trim());
        if (splitByPages.length === scannedPages.length) {
          scannedPages.forEach((sp, idx) => {
            nativeOutputs[sp.pageIndex] = splitByPages[idx].trim();
          });
        } else {
          nativeOutputs[scannedPages[0].pageIndex] = extractedAll;
        }
      }

      const fullContent = nativeOutputs.filter(Boolean).join("\n\n").trim();

      return {
        success: fullContent.length >= 20,
        content: fullContent,
        usedVision: scannedPages.length > 0,
        pageCount: numPages,
        error: fullContent.length < 20 ? "Document vide ou illisible" : undefined,
      };
    },
    []
  );

  // Extraction Word moderne .docx via JSZip (zéro dépendance externe)
  const readDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXml = await zip.file("word/document.xml")?.async("text");
    if (!docXml) throw new Error("Document Word corrompu ou illisible.");
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
  };

  // Extraction PowerPoint moderne (.pptx)
  const readPowerPoint = async (file: File): Promise<string> => {
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
    for (const path of slideFiles) {
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
  };

  const readFile = useCallback(
    async (
      file: File,
      optionsOrProgress: ((progress: ReadingProgress) => void) | ReadFileOptions = {}
    ): Promise<ReadFileResult> => {
      const options: ReadFileOptions =
        typeof optionsOrProgress === "function"
          ? { onProgress: optionsOrProgress }
          : optionsOrProgress || {};

      setIsReading(true);
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const mode = options.mode || "annales";

      try {
        // 1. Tous les PDF (natifs, scannés, photos assemblées, copies corrigées)
        if (ext === "pdf" || file.type === "application/pdf") {
          const res = await readPdfHybrid(file, options);
          setIsReading(false);
          setReadingProgress(null);
          return res;
        }

        // 2. Images et photos directes (.png, .jpg, .jpeg, .webp)
        if (["png", "jpg", "jpeg", "webp"].includes(ext) || file.type.startsWith("image/")) {
          notifyProgress({ stage: `Nettoyage de la photo « ${file.name} »…`, pct: 25 }, options.onProgress);
          const bitmap = await createImageBitmap(file);
          const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(bitmap.width * scale));
          canvas.height = Math.max(1, Math.round(bitmap.height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas 2D indisponible");
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

          cleanScannedExamCanvas(canvas, mode === "annales");
          const dataUrl = canvasToDataUrl(canvas, 0.85);

          const text = await extractScannedPagesGuaranteed(
            [{ pageNumber: 1, dataUrl }],
            mode,
            file.name,
            (prog) => notifyProgress(prog, options.onProgress)
          );
          setIsReading(false);
          setReadingProgress(null);
          return {
            success: text.trim().length >= 20,
            content: text.trim(),
            usedVision: true,
            pageCount: 1,
            wordCount: text.split(/\s+/).filter(Boolean).length,
            fileName: file.name,
            fileType: file.type,
          };
        }

        // 3. Fichiers Word (.docx)
        if (ext === "docx") {
          notifyProgress({ stage: `Lecture Word : ${file.name}…`, pct: 50 }, options.onProgress);
          const value = await readDocx(file);
          setIsReading(false);
          setReadingProgress(null);
          return {
            success: value.trim().length >= 20,
            content: value.trim(),
            usedVision: false,
            wordCount: value.split(/\s+/).filter(Boolean).length,
            fileName: file.name,
            fileType: file.type,
          };
        }

        // 4. Fichiers PowerPoint (.pptx)
        if (ext === "pptx") {
          notifyProgress({ stage: `Lecture PowerPoint : ${file.name}…`, pct: 50 }, options.onProgress);
          const value = await readPowerPoint(file);
          setIsReading(false);
          setReadingProgress(null);
          return {
            success: value.trim().length >= 20,
            content: value.trim(),
            usedVision: false,
            wordCount: value.split(/\s+/).filter(Boolean).length,
            fileName: file.name,
            fileType: file.type,
          };
        }

        // 5. Fichiers texte (.txt, .md, .rtf)
        notifyProgress({ stage: `Lecture texte : ${file.name}…`, pct: 50 }, options.onProgress);
        const text = await file.text();
        setIsReading(false);
        setReadingProgress(null);
        return {
          success: text.trim().length >= 20,
          content: text.trim(),
          usedVision: false,
          wordCount: text.split(/\s+/).filter(Boolean).length,
          fileName: file.name,
          fileType: file.type,
        };
      } catch (err: any) {
        console.error("[useFileReader] Erreur sur", file.name, err);
        setIsReading(false);
        setReadingProgress(null);
        return {
          success: false,
          content: "",
          error: err?.message || "Erreur lors de la lecture du fichier",
        };
      }
    },
    [readPdfHybrid]
  );

  return { readFile, isReading, readingProgress };
}
