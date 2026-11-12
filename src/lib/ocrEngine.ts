/**
 * Moteur OCR Haute Précision pour Hipocampus
 * Transcription automatique des documents scannés, photocopies d'examens et images médicales.
 * 
 * Stratégie hybride :
 * 1. Tesseract.js (Reconnaissance OCR 100% locale dans le navigateur via WebAssembly & Web Worker)
 * 2. Repli / Accélération Gemini Vision si une clé API est configurée (transcription ultra-rapide des manuscrits et photocopies dégradées)
 * 3. Lazy-loading : Tesseract.js n'est chargé que lorsque l'utilisateur uploade un fichier scanné.
 */

import * as pdfjs from "pdfjs-dist";

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
Tu es un moteur d'extraction documentaire médicale haute précision.
Ta mission est de transcrire INTÉGRALEMENT (100 % du texte, mot pour mot, sans jamais résumer ni tronquer) les pages fournies.

RÈGLES CRITIQUES POUR LES PHOTOS D'EXAMENS / ANNALES CORRIGÉES :
1. SÉPARATION IMPRIMÉ vs MANUSCRIT (DÉ-CORRECTION) :
   - Les photos d'examens contiennent souvent des corrections appliquées après coup : lettres entourées au stylo, coches, propositions barrées, surlignage au stabilo, notes manuscrites en marge ou tampons.
   - Tu dois extraire l'ESSENCE ORIGINALE de l'épreuve : restitue l'énoncé et toutes les propositions (A, B, C, D, E et/ou 1, 2, 3, 4, 5) exactement tels qu'ils ont été imprimés par le professeur, COMME SI LA COPIE ÉTAIT VIERGE.
   - Ne supprime jamais une proposition parce qu'elle est barrée au stylo sur la photo.
   - Si une correction manuscrite ou un corrigé entouré est visible, ne l'intègre PAS dans le texte de la proposition : ajoute-le uniquement sur une ligne séparée sous la question au format :
     [ANNOTATION_DETECTEE: Proposition(s) marquée(s) sur la copie = B, D (à vérifier avec le cours)]

2. PRÉSERVATION DES STRUCTURES DOCIMOLOGIQUES :
   - Conserve scrupuleusement la numérotation exacte des questions (Q1, 1., Question 1...).
   - Conserve les blocs de "Cas Clinique" / "Énoncé commun aux questions X à Y".
   - Pour les questions de GROUPAGE, sépare clairement les propositions numérotées (1, 2, 3, 4, 5) des combinaisons de réponses lettrées (A: 1+2+3, B: 1+3, C: 2+4, D: 4, E: 1+2+3+4).
   - Pour les questions de JUMELAGE, conserve les deux affirmations reliées par "PARCE QUE" ou "CAR".

3. IMAGES, SCHÉMAS ET TABLEAUX ADJOINTS :
   - Si une image médicale (radio, scanner, ECG, coupe histologique, arbre, schéma anatomique) ou un tableau biologique est présent sur la photo :
   - Transcris toutes les valeurs chiffrées et légendes du tableau en Markdown.
   - Insère une balise descriptive complète : [IMAGE_MEDICALE_ADJOINTE: description précise de ce que montre l'image et ses légendes] afin que l'analyse thématique identifie la leçon correspondante.
`;

/**
 * Détermine si le texte extrait d'un PDF est quasi-vide (signe d'un document scanné ou image)
 */
export function isLikelyScannedText(extractedText: string, pageCount = 1): boolean {
  const clean = String(extractedText || "").trim();
  if (clean.length < 50) return true;
  // Moins de 35 caractères en moyenne par page = document essentiellement composé d'images
  const avgCharsPerPage = clean.length / Math.max(1, pageCount);
  return avgCharsPerPage < 35;
}

/**
 * Nettoie et normalise le texte brut issu de l'OCR pour les QCM et examens médicaux
 */
export function cleanOcrText(raw: string): string {
  if (!raw) return "";
  return raw
    // Normalisation des fins de ligne et espaces
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    // Reconnexion des propositions QCM A, B, C, D, E mal coupées
    .replace(/\n\s*([A-Ea-e])\s*[:.)-]\s*/g, "\n$1. ")
    // Reconnexion des numéros de question (ex. "QCM 1 :", "1 -", "Question 12")
    .replace(/\n\s*(?:QCM|Question)?\s*(\d{1,3})\s*[:.-]\s*/gi, "\n\nQuestion $1 : ")
    // Nettoyage des barres verticales parasites et artefacts de marge
    .replace(/^[|¦!]\s*/gm, "")
    // Remplacement des puces exotiques
    .replace(/[❑▪►●♦❖]/g, "• ")
    // Pas plus de 2 sauts de ligne successifs
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * OCR sur une image directe (PNG, JPEG, WebP)
 */
export async function ocrImageFile(
  file: File | Blob,
  onProgress?: (progress: OcrProgress) => void,
  options?: OcrOptions
): Promise<{ text: string; usedVision: boolean }> {
  onProgress?.({ page: 1, total: 1, stage: "Initialisation du moteur OCR...", pct: 10 });

  // 1. Essai prioritaire via Gemini Vision si clé configurée (ultra-rapide)
  const geminiKey =
    import.meta.env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem("dawjang_gemini_api_key");

  let usedVision = false;

  if (geminiKey) {
    try {
      const base64 = await fileToBase64(file);
      const mime = file.type || "image/jpeg";
      const aiText = await ocrWithGeminiVision(base64, mime, geminiKey, options?.systemPrompt);
      if (aiText && aiText.trim().length >= 20) {
        onProgress?.({ page: 1, total: 1, stage: "Transcription terminée", pct: 100 });
        return { text: cleanOcrText(aiText), usedVision: true };
      }
    } catch (e) {
      console.warn("[OCR] Échec Gemini Vision, bascule sur Tesseract local :", e);
    }
  }

  // 2. Tesseract.js local
  try {
    const { createWorker } = await import("tesseract.js");
    onProgress?.({ page: 1, total: 1, stage: "Chargement du modèle OCR français...", pct: 30 });

    const worker = await createWorker("fra");
    try {
      onProgress?.({ page: 1, total: 1, stage: "Reconnaissance du texte en cours...", pct: 60 });
      const res = await worker.recognize(file as any);
      onProgress?.({ page: 1, total: 1, stage: "Finalisation...", pct: 100 });
      return { text: cleanOcrText(res.data.text || ""), usedVision: false };
    } finally {
      await worker.terminate();
    }
  } catch (err: any) {
    console.error("[OCR] Erreur Tesseract:", err);
    throw new Error(`Échec de la reconnaissance optique (OCR) : ${err?.message || "Erreur inconnue"}`);
  }
}

/**
 * OCR sur un canvas HTML (page PDF rendue)
 */
export async function ocrCanvas(
  canvas: HTMLCanvasElement,
  options?: OcrOptions
): Promise<{ text: string; usedVision: boolean }> {
  const geminiKey =
    import.meta.env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem("dawjang_gemini_api_key");

  if (geminiKey) {
    try {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];
      const aiText = await ocrWithGeminiVision(base64, "image/jpeg", geminiKey, options?.systemPrompt);
      if (aiText && aiText.trim().length >= 10) {
        return { text: cleanOcrText(aiText), usedVision: true };
      }
    } catch (e) {
      console.warn("[OCR Canvas] Échec Gemini Vision, bascule Tesseract :", e);
    }
  }

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("fra");
  try {
    const res = await worker.recognize(canvas);
    return { text: cleanOcrText(res?.data?.text || ""), usedVision: false };
  } finally {
    await worker.terminate();
  }
}

/**
 * OCR complet sur un document PDF scanné (page par page via Canvas haute résolution)
 */
export async function ocrPdfDocument(
  file: File | ArrayBuffer,
  onProgress?: (progress: OcrProgress) => void,
  options?: OcrOptions
): Promise<{ text: string; usedVision: boolean }> {
  const data = file instanceof File ? await file.arrayBuffer() : file;
  const typedArray = new Uint8Array(data);

  const pdf = await pdfjs.getDocument({
    data: typedArray,
    verbosity: 0,
  }).promise;

  const totalPages = pdf.numPages;
  if (totalPages === 0) {
    throw new Error("Le document PDF ne contient aucune page.");
  }

  const geminiKey =
    import.meta.env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem("dawjang_gemini_api_key");

  let worker: any = null;
  let hadVisionSuccess = false;

  // Si pas de clé Gemini, on pré-charge le worker Tesseract une seule fois pour tout le PDF
  if (!geminiKey) {
    onProgress?.({ page: 1, total: totalPages, stage: "Initialisation du moteur OCR local...", pct: 5 });
    const { createWorker } = await import("tesseract.js");
    worker = await createWorker("fra");
  }

  const transcribedPages: string[] = [];
  const scale = options?.scale || 2.2;

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pct = Math.round(((pageNum - 0.5) / totalPages) * 100);
      onProgress?.({
        page: pageNum,
        total: totalPages,
        stage: `Reconnaissance de la page ${pageNum}/${totalPages}...`,
        pct,
      });

      const page = await pdf.getPage(pageNum);
      // Rendu à échelle 2.2 pour une netteté de caractères optimale pour l'OCR
      const viewport = page.getViewport({ scale });

      // Création canvas hors-écran
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        throw new Error("Impossible de créer le contexte Canvas 2D pour l'OCR.");
      }

      // Fond blanc opaque (indispensable pour les scans à fond transparent)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      let pageText = "";

      // Priorité 1 : Gemini Vision si clé présente
      if (geminiKey) {
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          const base64 = dataUrl.split(",")[1];
          pageText = await ocrWithGeminiVision(base64, "image/jpeg", geminiKey, options?.systemPrompt);
          if (pageText) hadVisionSuccess = true;
        } catch (e) {
          console.warn(`[OCR] Gemini Vision page ${pageNum} échouée, essai Tesseract :`, e);
        }
      }

      // Priorité 2 / repli : Tesseract local
      if (!pageText.trim()) {
        if (!worker) {
          const { createWorker } = await import("tesseract.js");
          worker = await createWorker("fra");
        }
        const res = await worker.recognize(canvas);
        pageText = res?.data?.text || "";
      }

      const cleaned = cleanOcrText(pageText);
      if (cleaned) {
        transcribedPages.push(`--- Page ${pageNum} (OCR) ---\n` + cleaned);
      }
    }
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // Ignorer
      }
    }
  }

  const fullText = transcribedPages.join("\n\n").trim();
  if (!fullText) {
    throw new Error("L'OCR n'a détecté aucun texte lisible dans ce document scanné.");
  }

  onProgress?.({ page: totalPages, total: totalPages, stage: "Reconnaissance OCR terminée avec succès !", pct: 100 });
  return { text: fullText, usedVision: hadVisionSuccess };
}

/**
 * Envoi d'une image de page à Gemini Vision API pour transcription haute fidélité
 */
async function ocrWithGeminiVision(
  base64Data: string,
  mimeType: string,
  apiKey: string,
  customPrompt?: string
): Promise<string> {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  const instruction = customPrompt || VISION_EXTRACTION_SYSTEM_PROMPT;

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                  {
                    text: instruction,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
            },
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch {
      // Modèle suivant
    }
  }
  return "";
}

/**
 * Utilitaire de conversion File -> Base64
 */
function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const b64 = res.includes(",") ? res.split(",")[1] : res;
      resolve(b64);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}
