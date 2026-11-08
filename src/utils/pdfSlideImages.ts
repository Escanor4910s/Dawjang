// src/utils/pdfSlideImages.ts
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Extrait des captures d'écran basse résolution (JPEG base64) des diapositives clés d'un PDF
 * (notamment les diapositives contenant des formules mathématiques, des tableaux ou des arbres décisionnels)
 * pour alimenter le pipeline multimodal (Texte + Vision).
 */
export async function extractPdfSlideImagesBase64(
  file: File,
  maxSlides = 14
): Promise<string[]> {
  const fileName = String(file?.name || "").toLowerCase();
  const fileType = file?.type || "";
  if (!file || (!fileName.endsWith(".pdf") && fileType !== "application/pdf")) {
    return [];
  }

  try {
    const buffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(buffer);
    const pdf = await pdfjs.getDocument({ data: typedArray, verbosity: 0 }).promise;
    const totalPages = pdf.numPages;

    if (totalPages === 0) return [];

    // Sélection intelligente des pages : si <= maxSlides, toutes les pages ; sinon échantillonnage couvrant début, milieu (formules/tableaux) et fin (traitements/posologies)
    const pagesToRender: number[] = [];
    if (totalPages <= maxSlides) {
      for (let p = 1; p <= totalPages; p++) pagesToRender.push(p);
    } else {
      const step = (totalPages - 1) / (maxSlides - 1);
      for (let i = 0; i < maxSlides; i++) {
        const pageNum = Math.min(totalPages, Math.max(1, Math.round(1 + i * step)));
        if (!pagesToRender.includes(pageNum)) {
          pagesToRender.push(pageNum);
        }
      }
    }

    const imagesBase64: string[] = [];

    for (const pageNum of pagesToRender) {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.9 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        await page.render({
          canvasContext: ctx,
          viewport,
        } as any).promise;

        const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
        if (dataUrl && dataUrl.startsWith("data:image/jpeg;base64,")) {
          imagesBase64.push(dataUrl);
        }
      } catch {
        // Ignorer une page en cas d'erreur de rendu isolée
      }
    }

    return imagesBase64;
  } catch {
    return [];
  }
}
