// src/hooks/useFileReader.ts
import { useState, useCallback } from "react";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";

// Worker PDF local servi directement par Vite (aucune dépendance réseau externe)
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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

export const VISION_EXTRACTION_PROMPT_ANNALES = `Tu es un moteur d'extraction docimologique médicale haute précision.
Ta mission est de transcrire INTÉGRALEMENT (100 % du texte, mot pour mot, sans jamais résumer ni omettre aucune question ou proposition) les pages d'examen photographiées ou scannées ci-jointes.

RÈGLES IMPÉRATIVES :
1. DÉ-CORRECTION (NETTOYAGE DES COPIES CORRIGÉES) :
   - Ces photos d'examens contiennent souvent des corrections ajoutées à la main : lettres entourées au stylo, coches, propositions barrées/rayées, surlignages au stabilo, mentions "Vrai/Faux" ou notes manuscrites en marge.
   - Ignore ces marques dans le corps de la question : restitue l'énoncé et TOUTES les propositions (A, B, C, D, E et/ou 1, 2, 3, 4, 5) exactement tels qu'ils ont été imprimés à l'origine, COMME SI LA FEUILLE D'EXAMEN ÉTAIT VIERGE.
   - Ne supprime JAMAIS une proposition parce qu'elle a été barrée au stylo.
   - Si une correction manuscrite est clairement identifiable, note-la uniquement à part sous la question sous la forme :
     [CORRECTION_MANUSCRITE_DETECTEE: B, D]

2. RESPECT ABSOLU DES FORMATS DE QCM :
   - Conserve la numérotation exacte (1., Q1, Question 1...).
   - Conserve les titres et vignettes des "Cas Cliniques" ou "Énoncé commun aux questions X à Y".
   - Pour un GROUPAGE, garde bien la liste numérotée (1, 2, 3, 4, 5) ET les combinaisons lettrées (A: 1+2+3, B: 1+3, etc.).
   - Pour un JUMELAGE, garde les deux affirmations séparées par "PARCE QUE" ou "CAR".

3. IMAGES ET TABLEAUX ADJOINTS :
   - Si un tableau biologique ou clinique est présent, retranscris-le intégralement en texte/Markdown avec toutes ses valeurs.
   - Si une image médicale (radio, scanner, ECG, schéma) est présente sur la photo, insère :
     [IMAGE_ADJOINTE: description détaillée des éléments visibles et des légendes].`;

export const VISION_EXTRACTION_PROMPT_COURSES = `Tu es un moteur d'extraction de cours médicaux haute précision.
Transcris INTÉGRALEMENT (100 % du texte, mot pour mot, sans jamais résumer ni tronquer) le contenu des pages fournies.
- Conserve toute la hiérarchie des titres, sous-titres, listes à puces, valeurs numériques, posologies et classifications.
- Retranscris tous les tableaux et schémas annotés sous forme structurée complète.`;

/**
 * Nettoie et reconstitue les formules médicales, fractions sur 2 lignes
 * et seuils biologiques extraits d'un PDF de diapositives.
 */
export function normalizeMedicalSlideText(raw: string): string {
  if (!raw) return "";
  return (
    raw
      .replace(/[\uE000-\uF8FF]/g, "• ")
      .replace(/[❑▪►●♦]/g, "• ")
      .replace(/˃/g, ">")
      .replace(/˂/g, "<")
      .replace(/ﬁ/g, "fi")
      .replace(/ﬂ/g, "fl")
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(
        /VGM\s*=\s*Ht\s*\(%\)\s*[x×]\s*10\s*=\s*80\s*[-–]\s*90\s*Femtolitres\s*(?:\n+|\s+)GR\s*\(en millions\)/gi,
        "VGM = [Ht (%) × 10] / GR (en millions) = 80 – 90 fL (Normocytaire : 80–90 fL ; Microcytaire < 80 fL ; Macrocytaire > 90–100 fL)"
      )
      .replace(
        /TCMH\s*=\s*(?:Hb|tb)\s*\(g\/dl\)\s*[x×]\s*10\s*=\s*27\s*[-–]\s*31\s*pg\s*(?:(?:\n+|\s+)GR\s*\(en millions\))?/gi,
        "TCMH = [Hb (g/dL) × 10] / GR (en millions) = 27 – 31 pg (Hypochrome si < 27 pg)"
      )
      .replace(
        /CCMH\s*=\s*(?:Hb|tb)\s*\(g\/dl\)\s*[x×]\s*100\s*=\s*32\s*[-–]\s*36\s*%\s*(?:(?:\n+|\s+)Ht\s*\(en %\))?/gi,
        "CCMH = [Hb (g/dL) × 100] / Ht (%) = 32 – 36 %"
      )
      .replace(
        /(Femmes enceintes et enfants|Nouveaux[\s-]nés|Chez l['’]homme|Chez la femme)\s*:?\s*\n+\s*[•-]?\s*(Hb\s*<\s*\d+(?:[.,]\d+)?\s*g\/dl)/gi,
        "$1 : $2"
      )
      .replace(
        /2,3\s*DIPHOSPHOGLYCERATE\s*(?:\n+|\s+)[•-]?\s*affinité de l['’]\s*Hb pour l['’]\s*O2/gi,
        "Augmentation du 2,3-Diphosphoglycérate (2,3-DPG) intra-érythrocytaire → diminue l'affinité de l'Hb pour l'O2 (facilite la libération d'O2 aux tissus)"
      )
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// Convertit un Blob/File image en base64 pur (sans en-tête data:...)
const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || "");
      resolve(res.includes(",") ? res.split(",")[1] : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// Normalise et redimensionne une image brute avant envoi Vision
const imageFileToJpegBase64 = async (file: File, maxDim = 2200): Promise<string> => {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponible");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Échec encodage JPEG"))), "image/jpeg", 0.86)
  );
  return blobToBase64(blob);
};

// Appelle l'Edge Function Supabase ou l'API Gemini Vision pour transcrire un lot d'images
async function extractImagesWithVisionAI(
  base64Jpegs: Array<{ pageNumber: number; base64: string }>,
  mode: "courses" | "annales"
): Promise<string> {
  const systemPrompt =
    mode === "annales" ? VISION_EXTRACTION_PROMPT_ANNALES : VISION_EXTRACTION_PROMPT_COURSES;

  // 1. Clé Gemini (priorité aux clés configurées par l'utilisateur ou par env)
  const apiKey =
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem("dawjang_gemini_api_key");

  if (apiKey) {
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    const parts: any[] = [
      {
        text: `${systemPrompt}\n\nTranscris INTÉGRALEMENT les ${base64Jpegs.length} page(s) suivante(s) dans l'ordre exact :`,
      },
    ];
    for (const img of base64Jpegs) {
      parts.push({ text: `\n--- PAGE ${img.pageNumber} ---` });
      parts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: img.base64,
        },
      });
    }

    for (const model of models) {
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
            }),
          }
        );

        if (resp.ok) {
          const json = await resp.json();
          const text =
            json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("\n") || "";
          if (text.trim().length > 10) return text.trim();
        }
      } catch (err) {
        console.warn(`[useFileReader] Essai modèle ${model} échoué:`, err);
      }
    }
  }

  // 2. Tentative via Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke("generate-quiz", {
      body: {
        action: "vision_ocr_extract",
        mode,
        systemPrompt,
        images: base64Jpegs.map((img) => ({
          pageNumber: img.pageNumber,
          mimeType: "image/jpeg",
          data: img.base64,
        })),
      },
    });

    if (!error && data?.extractedText && String(data.extractedText).trim().length > 20) {
      return String(data.extractedText).trim();
    }
  } catch (err) {
    console.warn("[useFileReader] Repli après appel Edge Function Vision:", err);
  }

  // 3. Filet de sécurité local : Tesseract.js (OCR WebAssembly dans le navigateur)
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("fra");
    try {
      const chunks: string[] = [];
      for (const img of base64Jpegs) {
        const { data } = await worker.recognize(`data:image/jpeg;base64,${img.base64}`);
        if (data?.text) chunks.push(`--- PAGE ${img.pageNumber} ---\n${data.text.trim()}`);
      }
      return chunks.join("\n\n");
    } finally {
      await worker.terminate();
    }
  } catch (tessErr) {
    console.warn("[useFileReader] Repli Tesseract échoué:", tessErr);
    return "";
  }
}

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
      notifyProgress({ stage: `Ouverture du PDF : ${file.name}…`, pct: 5 }, options.onProgress);

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      const pageOutputs: string[] = new Array(numPages).fill("");
      const pagesNeedingVision: Array<{ pageIndex: number; pageNumber: number; base64: string }> = [];
      let usedVision = false;

      // Passe 1 : inspection page par page (texte natif vs photo scannée)
      for (let i = 1; i <= numPages; i++) {
        notifyProgress(
          {
            stage: `Inspection de la page ${i}/${numPages} (${file.name})…`,
            pct: Math.round((i / numPages) * 40),
            page: i,
            total: numPages,
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

        const isScannedOrPhotoPage = rawPageText.length < 120;

        if (!isScannedOrPhotoPage && !options.forceFullExtraction) {
          // Reconstruction propre avec sauts de ligne basés sur la coordonnée Y
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
          pageOutputs[i - 1] = `--- PAGE ${i} ---\n${lines.join("\n")}`;
        } else {
          // Page photo / scan / copie corrigée -> Rendu Canvas haute résolution pour Vision IA
          usedVision = true;
          const viewport = page.getViewport({ scale: 2.2 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport }).promise;
            const blob: Blob = await new Promise((res, rej) =>
              canvas.toBlob((b) => (b ? res(b) : rej(new Error("Canvas toBlob error"))), "image/jpeg", 0.85)
            );
            const base64 = await blobToBase64(blob);
            pagesNeedingVision.push({ pageIndex: i - 1, pageNumber: i, base64 });
          }
        }
      }

      // Passe 2 : Extraction Vision par lots de 4 pages pour garantir 100 % d'extraction sans coupure
      if (pagesNeedingVision.length > 0) {
        const BATCH_SIZE = 4;
        for (let b = 0; b < pagesNeedingVision.length; b += BATCH_SIZE) {
          const batch = pagesNeedingVision.slice(b, b + BATCH_SIZE);
          const firstP = batch[0].pageNumber;
          const lastP = batch[batch.length - 1].pageNumber;
          const pct = 40 + Math.round(((b + batch.length) / pagesNeedingVision.length) * 55);

          notifyProgress(
            {
              stage:
                mode === "annales"
                  ? `Vision IA & Dé-correction manuscrite : pages ${firstP} à ${lastP}/${numPages} (${file.name})…`
                  : `Extraction Vision 100 % : pages ${firstP} à ${lastP}/${numPages} (${file.name})…`,
              pct,
              page: lastP,
              total: numPages,
            },
            options.onProgress
          );

          const extractedBatchText = await extractImagesWithVisionAI(
            batch.map((x) => ({ pageNumber: x.pageNumber, base64: x.base64 })),
            mode
          );

          // Répartition dans l'ordre des pages
          pageOutputs[batch[0].pageIndex] = extractedBatchText;
        }
      }

      const fullContent = normalizeMedicalSlideText(pageOutputs.filter(Boolean).join("\n\n").trim());
      const wordCount = fullContent.split(/\s+/).filter(Boolean).length;

      return {
        success: fullContent.length >= 20,
        content: fullContent,
        usedVision,
        pageCount: numPages,
        wordCount,
        fileName: file.name,
        fileType: file.type,
        error: fullContent.length < 20 ? "Aucune donnée lisible extraite du PDF" : undefined,
      };
    },
    []
  );

  // Extraction Word moderne .docx via JSZip
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

  // Extraction Word 97-2003 binaire (.doc)
  const readLegacyDoc = async (file: File): Promise<string> => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const decoder = new TextDecoder("windows-1252");
    const textChunks: string[] = [];
    let runStart = -1;
    const len = bytes.length;
    for (let i = 0; i < len; i++) {
      const b = bytes[i];
      const isPrintable = (b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13 || b >= 160;
      if (isPrintable) {
        if (runStart === -1) runStart = i;
      } else {
        if (runStart !== -1 && i - runStart >= 12) {
          const seg = decoder.decode(bytes.subarray(runStart, i)).trim();
          if (/[a-zA-ZÀ-ÿ]{3,}/.test(seg) && !/^(?:Root Entry|WordDocument|SummaryInformation)/i.test(seg)) {
            textChunks.push(seg);
          }
        }
        runStart = -1;
      }
    }
    return textChunks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
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
      notifyProgress({ stage: `Lecture de ${file.name}…`, pct: 5 }, options.onProgress);

      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const mode = options.mode || "annales";

      try {
        // 1. Fichiers PDF (hybride page par page + vision automatique)
        if (ext === "pdf" || file.type === "application/pdf") {
          const res = await readPdfHybrid(file, options);
          setIsReading(false);
          setReadingProgress(null);
          return res;
        }

        // 2. Photos d'examens ou de cours (.png, .jpg, .jpeg, .webp)
        if (["png", "jpg", "jpeg", "webp"].includes(ext) || file.type.startsWith("image/")) {
          notifyProgress(
            {
              stage:
                mode === "annales"
                  ? `Lecture photo & nettoyage des corrections : ${file.name}…`
                  : `Extraction visuelle complète : ${file.name}…`,
              pct: 35,
            },
            options.onProgress
          );
          const base64 = await imageFileToJpegBase64(file);
          notifyProgress(
            { stage: `Transcription IA 100 % en cours (${file.name})…`, pct: 75 },
            options.onProgress
          );
          const text = await extractImagesWithVisionAI([{ pageNumber: 1, base64 }], mode);
          const normalized = normalizeMedicalSlideText(text.trim());
          const wordCount = normalized.split(/\s+/).filter(Boolean).length;
          setIsReading(false);
          setReadingProgress(null);
          return {
            success: normalized.length >= 20,
            content: normalized,
            usedVision: true,
            pageCount: 1,
            wordCount,
            fileName: file.name,
            fileType: file.type,
            error: normalized.length < 20 ? "Photo illisible ou floue" : undefined,
          };
        }

        // 3. Documents Word (.docx)
        if (ext === "docx") {
          notifyProgress({ stage: `Extraction intégrale Word : ${file.name}…`, pct: 40 }, options.onProgress);
          const text = normalizeMedicalSlideText(await readDocx(file));
          setIsReading(false);
          setReadingProgress(null);
          return {
            success: text.length >= 20,
            content: text,
            usedVision: false,
            wordCount: text.split(/\s+/).filter(Boolean).length,
            fileName: file.name,
            fileType: file.type,
          };
        }

        // 4. Documents Word 97-2003 (.doc)
        if (ext === "doc") {
          notifyProgress({ stage: `Extraction binaire Word 97-2003 : ${file.name}…`, pct: 40 }, options.onProgress);
          const text = normalizeMedicalSlideText(await readLegacyDoc(file));
          setIsReading(false);
          setReadingProgress(null);
          return {
            success: text.length >= 20,
            content: text,
            usedVision: false,
            wordCount: text.split(/\s+/).filter(Boolean).length,
            fileName: file.name,
            fileType: file.type,
          };
        }

        // 5. Présentations PowerPoint (.pptx)
        if (ext === "pptx" || ext === "ppt") {
          notifyProgress({ stage: `Extraction diapositives PowerPoint : ${file.name}…`, pct: 40 }, options.onProgress);
          const text = normalizeMedicalSlideText(await readPowerPoint(file));
          setIsReading(false);
          setReadingProgress(null);
          return {
            success: text.length >= 20,
            content: text,
            usedVision: false,
            wordCount: text.split(/\s+/).filter(Boolean).length,
            fileName: file.name,
            fileType: file.type,
          };
        }

        // 6. Fichiers texte brut / markdown / rtf
        notifyProgress({ stage: `Lecture du fichier texte : ${file.name}…`, pct: 60 }, options.onProgress);
        const rawText = await file.text();
        const text = normalizeMedicalSlideText(rawText);
        setIsReading(false);
        setReadingProgress(null);
        return {
          success: text.length >= 20,
          content: text,
          usedVision: false,
          wordCount: text.split(/\s+/).filter(Boolean).length,
          fileName: file.name,
          fileType: file.type,
        };
      } catch (err: any) {
        setIsReading(false);
        setReadingProgress(null);
        return {
          success: false,
          content: "",
          fileName: file.name,
          fileType: file.type,
          error: err?.message || "Erreur lors de l'extraction du fichier",
        };
      }
    },
    [readPdfHybrid]
  );

  return {
    readFile,
    isReading,
    readingProgress,
  };
}

export default useFileReader;
