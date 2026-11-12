import { useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ocrPdfDocument, ocrImageFile, ocrCanvas, isLikelyScannedText, OcrProgress, OcrOptions } from '@/lib/ocrEngine';

// Worker PDF local servi directement par Vite (aucune dépendance réseau externe vers unpkg)
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface FileReaderProgress {
  stage: string;
  page?: number;
  total?: number;
  pct?: number;
}

export interface ReadFileOptions {
  onProgress?: (progress: FileReaderProgress) => void;
  mode?: "courses" | "annales";
  forceFullExtraction?: boolean;
  stripHandwrittenCorrections?: boolean;
}

export interface FileReaderResult {
  content: string;
  success: boolean;
  fileName?: string;
  fileType?: string;
  wordCount?: number;
  usedVision?: boolean;
  error?: string;
}

/**
 * Nettoie et reconstitue les formules médicales, fractions sur 2 lignes
 * et seuils biologiques extraits d'un PDF de diapositives.
 */
export function normalizeMedicalSlideText(raw: string): string {
  if (!raw) return "";
  return (
    raw
      // Nettoyage des glyphes parasites et puces Wingdings (❑ ❖ ➢ etc. extraits en 'q', 'v', 'Ø')
      .replace(/[\uE000-\uF8FF]/g, "• ")
      .replace(/[❑▪►●♦]/g, "• ")
      .replace(/˃/g, ">")
      .replace(/˂/g, "<")
      .replace(/ﬁ/g, "fi")
      .replace(/ﬂ/g, "fl")
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+/g, " ")
      // Reconstitue la formule du VGM coupée sur 2 lignes
      .replace(
        /VGM\s*=\s*Ht\s*\(%\)\s*[x×]\s*10\s*=\s*80\s*[-–]\s*90\s*Femtolitres\s*(?:\n+|\s+)GR\s*\(en millions\)/gi,
        "VGM = [Ht (%) × 10] / GR (en millions) = 80 – 90 fL (Normocytaire : 80–90 fL ; Microcytaire < 80 fL ; Macrocytaire > 90–100 fL)"
      )
      // Reconstitue la formule de la TCMH coupée sur 2 lignes
      .replace(
        /TCMH\s*=\s*(?:Hb|tb)\s*\(g\/dl\)\s*[x×]\s*10\s*=\s*27\s*[-–]\s*31\s*pg\s*(?:(?:\n+|\s+)GR\s*\(en millions\))?/gi,
        "TCMH = [Hb (g/dL) × 10] / GR (en millions) = 27 – 31 pg (Hypochrome si < 27 pg)"
      )
      // Reconstitue la formule de la CCMH coupée sur 2 lignes
      .replace(
        /CCMH\s*=\s*(?:Hb|tb)\s*\(g\/dl\)\s*[x×]\s*100\s*=\s*32\s*[-–]\s*36\s*%\s*(?:(?:\n+|\s+)Ht\s*\(en %\))?/gi,
        "CCMH = [Hb (g/dL) × 100] / Ht (%) = 32 – 36 %"
      )
      // Rattache les catégories démographiques à leur seuil d'Hb situé sur la ligne suivante
      .replace(
        /(Femmes enceintes et enfants|Nouveaux[\s-]nés|Chez l['’]homme|Chez la femme)\s*:?\s*\n+\s*[•-]?\s*(Hb\s*<\s*\d+(?:[.,]\d+)?\s*g\/dl)/gi,
        "$1 : $2"
      )
      // Restaure le sens physiopathologique du 2,3-DPG lorsque les flèches PowerPoint ont disparu
      .replace(
        /2,3\s*DIPHOSPHOGLYCERATE\s*(?:\n+|\s+)[•-]?\s*affinité de l['’]\s*Hb pour l['’]\s*O2/gi,
        "Augmentation du 2,3-Diphosphoglycérate (2,3-DPG) intra-érythrocytaire → diminue l'affinité de l'Hb pour l'O2 (facilite la libération d'O2 aux tissus)"
      )
      // Nettoie les lignes multiples excessives
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export const useFileReader = () => {
  const [isReading, setIsReading] = useState(false);
  const [readingProgress, setReadingProgress] = useState<FileReaderProgress | null>(null);

  const notifyProgress = (prog: FileReaderProgress, callback?: (p: FileReaderProgress) => void) => {
    setReadingProgress(prog);
    callback?.(prog);
  };

  const readFile = async (
    file: File,
    optionsOrProgress?: ((progress: FileReaderProgress) => void) | ReadFileOptions
  ): Promise<FileReaderResult> => {
    const options: ReadFileOptions =
      typeof optionsOrProgress === "function"
        ? { onProgress: optionsOrProgress }
        : optionsOrProgress || {};
    const onProgress = options.onProgress;
    setIsReading(true);
    notifyProgress({ stage: `Lecture de ${file.name}...`, pct: 5 }, onProgress);

    try {
      let content = '';
      let usedVision = false;
      const name = String(file?.name || "").toLowerCase();
      const type = file?.type || "";

      if (type === 'application/pdf' || name.endsWith('.pdf')) {
        // Lecture document PDF (avec bascule automatique OCR si scanné)
        const res = await readPDF(file, options);
        content = res.text;
        usedVision = res.usedVision;
      } else if (
        name.match(/\.(png|jpe?g|webp|bmp)$/i) ||
        type.startsWith('image/')
      ) {
        // Lecture image directe (scan / photo d'examen) par OCR
        notifyProgress({ stage: `OCR de l'image ${file.name}...`, pct: 20 }, onProgress);
        const res = await ocrImageFile(file, (p) => {
          notifyProgress(
            { stage: p.stage, page: p.page, total: p.total, pct: p.pct },
            onProgress
          );
        }, {
          stripHandwrittenCorrections: options.stripHandwrittenCorrections,
        });
        content = res.text;
        usedVision = res.usedVision;
      } else if (
        name.endsWith('.docx') ||
        type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        // Lecture document Word moderne (.docx) via décompression XML JSZip
        content = await readDocx(file);
      } else if (
        name.endsWith('.doc') ||
        type === 'application/msword'
      ) {
        // Lecture document Word 97-2003 (.doc)
        content = await readLegacyDoc(file);
      } else if (
        name.endsWith('.pptx') ||
        name.endsWith('.ppt') ||
        type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        type === 'application/vnd.ms-powerpoint'
      ) {
        // Lecture présentations PowerPoint
        content = await readPowerPoint(file);
      } else if (name.endsWith('.odt') || type === 'application/vnd.oasis.opendocument.text') {
        // Lecture document LibreOffice / OpenDocument (.odt)
        content = await readOdt(file);
      } else if (
        name.endsWith('.txt') ||
        name.endsWith('.md') ||
        name.endsWith('.markdown') ||
        name.endsWith('.csv') ||
        name.endsWith('.rtf') ||
        type.startsWith('text/')
      ) {
        // Fichiers texte brut / markdown / rtf
        content = await readTextFile(file);
        if (name.endsWith('.rtf')) {
          content = stripRtf(content);
        }
      } else {
        // Tentative de lecture en texte avec fallback
        try {
          content = await readTextFile(file);
        } catch {
          throw new Error(
            `Format non supporté (${file.name}). Formats acceptés : PDF, Word (.docx, .doc), PowerPoint (.pptx), Texte (.txt, .md, .rtf, .odt).`
          );
        }
      }

      const trimmed = normalizeMedicalSlideText(content.trim());
      if (!trimmed) {
        throw new Error("Le fichier semble vide ou aucun texte n'a pu être extrait.");
      }

      const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

      return {
        content: trimmed,
        success: true,
        fileName: file.name,
        fileType: file.type,
        wordCount,
        usedVision,
      };
    } catch (error) {
      console.error('Erreur lors de la lecture du fichier:', error);
      return {
        content: '',
        success: false,
        fileName: file.name,
        error: error instanceof Error ? error.message : 'Erreur inconnue de lecture de document',
      };
    } finally {
      setIsReading(false);
      setReadingProgress(null);
    }
  };

  // 1. Extraction PDF géométrique haute précision (préserve les mots scindés par kerning, les tableaux et les listes)
  // Bascule automatiquement sur l'OCR haute fidélité si le document est scanné / image.
  const readPDF = async (
    file: File,
    options?: ReadFileOptions
  ): Promise<{ text: string; usedVision: boolean }> => {
    const onProgress = options?.onProgress;
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();

      fileReader.onload = async function () {
        try {
          const typedArray = new Uint8Array(this.result as ArrayBuffer);
          const pdf = await pdfjs.getDocument({
            data: typedArray,
            verbosity: 0,
          }).promise;

          const slidesText: string[] = [];
          let hadVision = false;

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            interface PositionedToken {
              str: string;
              x: number;
              y: number;
              width: number;
            }

            const tokens: PositionedToken[] = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const rawItem of textContent.items as any[]) {
              if (!rawItem || typeof rawItem.str !== "string") continue;
              const rawStr = rawItem.str;
              if (!rawStr.trim()) continue;
              const tx = Array.isArray(rawItem.transform)
                ? Number(rawItem.transform[4]) || 0
                : 0;
              const ty = Array.isArray(rawItem.transform)
                ? Number(rawItem.transform[5]) || 0
                : 0;
              const w = Number(rawItem.width) || 0;
              tokens.push({ str: rawStr, x: tx, y: ty, width: w });
            }

            // Tri vertical (Y décroissant en repère PDF), puis horizontal (X croissant)
            tokens.sort((a, b) => {
              if (Math.abs(b.y - a.y) > 4.5) {
                return b.y - a.y;
              }
              return a.x - b.x;
            });

            // Regroupement par lignes partageant la même ordonnée Y (tolérance 4.5 pt)
            const lines: Array<{ y: number; parts: PositionedToken[] }> = [];
            for (const tk of tokens) {
              const lastLine = lines[lines.length - 1];
              if (lastLine && Math.abs(lastLine.y - tk.y) <= 4.5) {
                lastLine.parts.push(tk);
              } else {
                lines.push({ y: tk.y, parts: [tk] });
              }
            }

            const pageLines = lines
              .map((line) => {
                line.parts.sort((a, b) => a.x - b.x);
                let assembled = "";
                for (let idx = 0; idx < line.parts.length; idx++) {
                  const curr = line.parts[idx];
                  if (idx === 0) {
                    assembled += curr.str;
                  } else {
                    const prev = line.parts[idx - 1];
                    const gap = curr.x - (prev.x + prev.width);
                    // Si les deux fragments sont collés (kerning interne d'un même mot), pas d'espace parasite
                    if (prev.width > 0 && gap >= -2 && gap < 1.3 && !prev.str.endsWith(" ") && !curr.str.startsWith(" ")) {
                      assembled += curr.str;
                    } else if (gap > 28) {
                      // Grand écart horizontal (colonne de tableau dans un PDF)
                      assembled += "   " + curr.str;
                    } else {
                      assembled += " " + curr.str;
                    }
                  }
                }
                return assembled.replace(/[ \t]{2,}/g, " ").trim();
              })
              .filter(Boolean);

            let pageText = pageLines.join("\n").trim();

            // Condition de bascule OCR / Vision page par page :
            // Si la page a moins de 120 caractères numériques (photo d'examen, scan inséré dans un PDF hybride)
            if (pageText.length < 120 || (options?.forceFullExtraction && pageText.length < 200)) {
              try {
                const viewport = page.getViewport({ scale: 2.2 });
                const canvas = document.createElement("canvas");
                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                if (ctx) {
                  ctx.fillStyle = "#ffffff";
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  await page.render({ canvasContext: ctx, viewport }).promise;
                  const ocrRes = await ocrCanvas(canvas, {
                    scale: 2.2,
                    stripHandwrittenCorrections: options?.stripHandwrittenCorrections,
                  });
                  if (ocrRes.text && ocrRes.text.length > pageText.length) {
                    pageText = ocrRes.text;
                    if (ocrRes.usedVision) hadVision = true;
                  }
                }
              } catch (err) {
                console.warn(`[FileReader] Fallback page OCR ${pageNum} :`, err);
              }
            }

            if (pageText.length > 0) {
              slidesText.push(`--- Diapositive / Page ${pageNum} ---\n` + pageText);
            }
          }

          const finalOutput = slidesText.join("\n\n").trim();

          // Détection automatique : Si le PDF ne contient aucun texte ou est un scan
          if (!finalOutput || isLikelyScannedText(finalOutput, pdf.numPages)) {
            console.log(
              `[FileReader] Document scanné / image détecté (${pdf.numPages} pages, texte extrait quasi-nul). Activation de l'OCR automatique...`
            );
            try {
              onProgress?.({
                stage: `Scan détecté : transcription OCR de ${file.name}...`,
                page: 1,
                total: pdf.numPages,
                pct: 10,
              });
              const ocrResult = await ocrPdfDocument(file, (p) => {
                onProgress?.({
                  stage: `OCR automatique : page ${p.page}/${p.total}...`,
                  page: p.page,
                  total: p.total,
                  pct: p.pct,
                });
              }, {
                scale: 2.2,
                stripHandwrittenCorrections: options?.stripHandwrittenCorrections,
              });
              resolve({ text: ocrResult.text, usedVision: ocrResult.usedVision });
              return;
            } catch (ocrErr: any) {
              reject(
                new Error(
                  `Document scanné détecté mais l'OCR n'a pas pu extraire le texte : ${ocrErr?.message || "Erreur OCR"}`
                )
              );
              return;
            }
          }

          resolve({ text: finalOutput, usedVision: hadVision });
        } catch (error) {
          reject(new Error(`Erreur lors de l'analyse du PDF: ${error instanceof Error ? error.message : "Inconnue"}`));
        }
      };

      fileReader.onerror = () => reject(new Error("Erreur de lecture du flux binaire PDF"));
      fileReader.readAsArrayBuffer(file);
    });
  };

  // 2. Extraction Word .docx (décompression XML complète : paragraphes, tableaux, en-têtes et notes)
  const readDocx = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();

      fileReader.onload = async function () {
        try {
          const arrayBuffer = this.result as ArrayBuffer;
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(arrayBuffer);

          const xmlFilesToRead: string[] = [];
          if (zip.file('word/document.xml')) xmlFilesToRead.push('word/document.xml');
          zip.forEach((relPath) => {
            if (/^word\/(header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(relPath)) {
              xmlFilesToRead.push(relPath);
            }
          });

          if (xmlFilesToRead.length === 0) {
            throw new Error("Structure Word invalide (fichier word/document.xml introuvable).");
          }

          const decodeXmlEntities = (str: string) =>
            str
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'");

          const allSections: string[] = [];

          for (const xmlPath of xmlFilesToRead) {
            const xmlContent = await zip.file(xmlPath)?.async('text');
            if (!xmlContent) continue;

            // Extraction fidèle paragraphe par paragraphe (<w:p>) en préservant les sauts de ligne (<w:br/>, <w:tab/>)
            const paragraphMatches = xmlContent.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];
            const lines: string[] = [];

            for (const pXml of paragraphMatches) {
              const withTabsAndBreaks = pXml
                .replace(/<w:tab\b[^>]*\/>/g, ' \t ')
                .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n');
              const textMatches = Array.from(
                withTabsAndBreaks.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)
              );
              if (textMatches.length > 0) {
                const lineText = decodeXmlEntities(
                  textMatches.map((m) => m[1]).join('')
                )
                  .replace(/[ \t]+/g, ' ')
                  .trim();
                if (lineText) lines.push(lineText);
              }
            }

            if (lines.length > 0) {
              allSections.push(lines.join('\n'));
            } else {
              // Fallback universel sur toutes les balises <w:t>
              const rawMatches = Array.from(
                xmlContent.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)
              );
              const fallbackText = decodeXmlEntities(
                rawMatches.map((m) => m[1]).join(' ')
              ).trim();
              if (fallbackText) allSections.push(fallbackText);
            }
          }

          const fullText = allSections.join('\n\n');
          if (!fullText.trim()) {
            reject(new Error("Le document Word ne contient aucun texte exploitable."));
          } else {
            resolve(fullText.trim());
          }
        } catch (error) {
          reject(new Error(`Erreur lecture Word (.docx): ${error instanceof Error ? error.message : 'Inconnue'}`));
        }
      };

      fileReader.onerror = () => reject(new Error('Erreur de lecture du fichier Word'));
      fileReader.readAsArrayBuffer(file);
    });
  };

  // 3. Extraction Word .doc binaire legacy (supporte les .docx renommés, RTF, CP1252 et Unicode UTF-16LE)
  const readLegacyDoc = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = async function () {
        try {
          const arrayBuffer = this.result as ArrayBuffer;
          const bytes = new Uint8Array(arrayBuffer);

          // Cas A : Fichier .docx (archive ZIP PK\x03\x04) enregistré avec l'extension .doc
          if (bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
            try {
              const docxText = await readDocx(file);
              if (docxText && docxText.trim().length > 20) {
                resolve(docxText);
                return;
              }
            } catch {
              // Continuer sur l'analyse binaire
            }
          }

          // Cas B : Fichier RTF enregistré avec l'extension .doc
          const asciiHeader = String.fromCharCode(...bytes.slice(0, 12));
          if (asciiHeader.startsWith('{\\rtf')) {
            const dec = new TextDecoder('windows-1252');
            const rtfClean = stripRtf(dec.decode(bytes));
            if (rtfClean.length > 20) {
              resolve(rtfClean);
              return;
            }
          }

          // Cas C : Extraction hybride Windows-1252 (8 bits) + UTF-16LE (16 bits) pour Word 97-2003 OLE2
          const win1252Decoder = new TextDecoder('windows-1252');
          const chunks8Bit: string[] = [];
          let runStart = -1;

          for (let i = 0; i < bytes.length; i++) {
            const b = bytes[i];
            const isPrintableWin1252 =
              (b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13 || b >= 160;
            if (isPrintableWin1252) {
              if (runStart === -1) runStart = i;
            } else {
              if (runStart !== -1 && i - runStart >= 5) {
                const segment = win1252Decoder.decode(bytes.subarray(runStart, i)).trim();
                if (/[a-zA-ZÀ-ÿ]{3,}/.test(segment) && !/^(?:Root Entry|WordDocument|CompObj|SummaryInformation|Microsoft Word)/i.test(segment)) {
                  chunks8Bit.push(segment);
                }
              }
              runStart = -1;
            }
          }

          // Extraction UTF-16LE (caractères stockés sur 2 octets dans les flux Word Unicode)
          const chunks16Bit: string[] = [];
          let uChars: number[] = [];
          for (let i = 0; i + 1 < bytes.length; i += 2) {
            const code = bytes[i] | (bytes[i + 1] << 8);
            const isPrintableUtf16 =
              (code >= 32 && code <= 126) ||
              code === 9 ||
              code === 10 ||
              code === 13 ||
              (code >= 160 && code <= 0x024f) ||
              (code >= 0x2010 && code <= 0x203a);
            if (isPrintableUtf16) {
              uChars.push(code);
            } else {
              if (uChars.length >= 6) {
                const seg = String.fromCharCode(...uChars).trim();
                if (/[a-zA-ZÀ-ÿ]{3,}/.test(seg) && !/^(?:Root Entry|WordDocument|Normal\.dot|Microsoft)/i.test(seg)) {
                  chunks16Bit.push(seg);
                }
              }
              uChars = [];
            }
          }

          const combined = [...chunks8Bit, ...chunks16Bit]
            .join('\n')
            .replace(/\r\n|\r/g, '\n')
            .replace(/[ \t]{2,}/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

          if (combined.length > 40) {
            resolve(combined);
          } else {
            reject(
              new Error(
                "Le fichier .doc est dans un ancien format binaire difficilement lisible. Veuillez l'enregistrer au format .docx ou .pdf pour une extraction parfaite."
              )
            );
          }
        } catch (err) {
          reject(err);
        }
      };
      fileReader.onerror = () => reject(new Error('Erreur de lecture .doc'));
      fileReader.readAsArrayBuffer(file);
    });
  };

  // 4. Extraction OpenDocument .odt
  const readOdt = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = async function () {
        try {
          const arrayBuffer = this.result as ArrayBuffer;
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(arrayBuffer);
          const contentXml = await zip.file('content.xml')?.async('text');

          if (!contentXml) {
            throw new Error("Structure OpenDocument invalide.");
          }

          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(contentXml, 'application/xml');
          const paragraphs = xmlDoc.getElementsByTagName('text:p');
          const lines: string[] = [];

          for (let i = 0; i < paragraphs.length; i++) {
            const t = paragraphs[i].textContent?.trim();
            if (t) lines.push(t);
          }

          resolve(lines.join('\n\n'));
        } catch (e) {
          reject(e);
        }
      };
      fileReader.onerror = () => reject(new Error('Erreur de lecture .odt'));
      fileReader.readAsArrayBuffer(file);
    });
  };

  // 5. Extraction PowerPoint (.pptx moderne XML et .ppt binaire legacy 97-2003)
  const extractLegacyPptBinary = (bytes: Uint8Array): string => {
    const textChunks: string[] = [];
    const len = bytes.length;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Parsing des records PowerPoint binaires :
    // Chaque record possède un en-tête de 8 octets :
    // - 2 octets : recVer (4 bits) + recInstance (12 bits)
    // - 2 octets : recType (uint16 little-endian)
    // - 4 octets : recLen (uint32 little-endian)
    // RT_TextCharsAtom = 0x0F9E (4000) -> texte UTF-16LE
    // RT_TextBytesAtom = 0x0FBA (4008) -> texte ANSI/Latin1
    for (let i = 0; i + 8 <= len; i++) {
      const recType = view.getUint16(i + 2, true);
      const recLen = view.getUint32(i + 4, true);

      if (recType === 4000 && recLen > 0 && recLen < 100000 && i + 8 + recLen <= len) {
        // UTF-16LE
        const chars: string[] = [];
        for (let j = 0; j + 1 < recLen; j += 2) {
          chars.push(String.fromCharCode(view.getUint16(i + 8 + j, true)));
        }
        const str = chars.join('').replace(/\r\n|\r/g, '\n').trim();
        if (str.length >= 3 && /[a-zA-ZÀ-ÿ]/.test(str)) {
          if (!/^(?:cliquez pour modifier le style|modifiez le style du titre|modifiez les styles du texte|deuxième niveau|espace réservé)/i.test(str)) {
            textChunks.push(str);
          }
          i += 7 + recLen;
        }
      } else if (recType === 4008 && recLen > 0 && recLen < 100000 && i + 8 + recLen <= len) {
        // Latin1 / Windows-1252
        const latinChars: string[] = [];
        for (let j = 0; j < recLen; j++) {
          latinChars.push(String.fromCharCode(bytes[i + 8 + j]));
        }
        const str = latinChars.join('').replace(/\r\n|\r/g, '\n').trim();
        if (str.length >= 3 && /[a-zA-ZÀ-ÿ]/.test(str)) {
          if (!/^(?:cliquez pour modifier le style|modifiez le style du titre|modifiez les styles du texte|deuxième niveau|espace réservé)/i.test(str)) {
            textChunks.push(str);
          }
          i += 7 + recLen;
        }
      }
    }

    // Fallback supplémentaire si aucun record strict n'a été trouvé : balayage des chaînes continues
    if (textChunks.length === 0) {
      const win1252Decoder = new TextDecoder('windows-1252');
      let runStart = -1;
      for (let i = 0; i < len; i++) {
        const b = bytes[i];
        const isPrintable = (b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13 || b >= 160;
        if (isPrintable) {
          if (runStart === -1) runStart = i;
        } else {
          if (runStart !== -1 && i - runStart >= 8) {
            const seg = win1252Decoder.decode(bytes.subarray(runStart, i)).trim();
            if (/[a-zA-ZÀ-ÿ]{3,}/.test(seg) && !/^(?:Root Entry|PowerPoint Document|Current User|SummaryInformation)/i.test(seg)) {
              textChunks.push(seg);
            }
          }
          runStart = -1;
        }
      }
    }

    return textChunks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  const readPowerPoint = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();

      fileReader.onload = async function () {
        try {
          const arrayBuffer = this.result as ArrayBuffer;
          const bytes = new Uint8Array(arrayBuffer);

          // Cas A : Fichier .pptx moderne (archive ZIP PK\x03\x04)
          const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;

          if (isZip) {
            try {
              const JSZip = (await import('jszip')).default;
              const zip = await JSZip.loadAsync(arrayBuffer);

              let fullText = '';
              const slideFiles: string[] = [];

              zip.forEach((relativePath) => {
                if (relativePath.match(/ppt\/slides\/slide\d+\.xml$/)) {
                  slideFiles.push(relativePath);
                }
              });

              slideFiles.sort((a, b) => {
                const numA = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || '0');
                const numB = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || '0');
                return numA - numB;
              });

              for (const slidePath of slideFiles) {
                const slideContent = await zip.file(slidePath)?.async('text');
                if (slideContent) {
                  const parser = new DOMParser();
                  const xmlDoc = parser.parseFromString(slideContent, 'text/xml');
                  const textElements = xmlDoc.getElementsByTagName('a:t');
                  const slideTexts: string[] = [];

                  for (let i = 0; i < textElements.length; i++) {
                    const text = textElements[i].textContent?.trim();
                    if (text) slideTexts.push(text);
                  }

                  if (slideTexts.length > 0) {
                    const slideNum = slidePath.match(/slide(\d+)\.xml$/)?.[1];
                    fullText += `\n\n--- Diapositive ${slideNum} ---\n${slideTexts.join('\n')}`;
                  }
                }
              }

              if (fullText.trim().length > 30) {
                resolve(fullText.trim());
                return;
              }
            } catch {
              // Continuer vers l'analyseur binaire si JSZip échoue
            }
          }

          // Cas B : Fichier .ppt binaire legacy (PowerPoint 97-2003 OLE2)
          const legacyText = extractLegacyPptBinary(bytes);
          if (legacyText && legacyText.length > 30) {
            resolve(legacyText);
          } else {
            reject(new Error("Aucun texte n'a pu être extrait du PowerPoint. Si vos diapositives sont des images scannées sans texte, veuillez les exporter en PDF avec OCR."));
          }
        } catch (error) {
          reject(new Error(`Erreur analyse PowerPoint: ${error instanceof Error ? error.message : 'Inconnue'}`));
        }
      };

      fileReader.onerror = () => reject(new Error('Erreur de lecture du fichier PowerPoint'));
      fileReader.readAsArrayBuffer(file);
    });
  };

  // 6. Extraction Texte / Markdown
  const readTextFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = function () {
        const text = this.result as string;
        if (!text.trim()) {
          reject(new Error('Le fichier texte est vide'));
        } else {
          resolve(text);
        }
      };
      fileReader.onerror = () => reject(new Error('Erreur de lecture du fichier texte'));
      try {
        fileReader.readAsText(file, 'UTF-8');
      } catch {
        fileReader.readAsText(file, 'ISO-8859-1');
      }
    });
  };

  // Nettoyage basique RTF
  const stripRtf = (rtf: string): string => {
    return rtf
      .replace(/\\par[d]?/g, '\n')
      .replace(/\{\*?\\[^{}]+;?\}|\\([A-Za-z]+[-?\d]* ?|.)/g, '')
      .replace(/[\r\n]+/g, '\n')
      .trim();
  };

  return {
    readFile,
    isReading,
    readingProgress,
  };
};

export default useFileReader;
