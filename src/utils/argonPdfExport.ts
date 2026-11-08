import jsPDF from "jspdf";
import { normalizeMarkdownTables } from "@/lib/coPilotSummaryEngine";

/**
 * Nettoie les symboles et caractères non supportés par la police ISO-Latin de jsPDF
 * tout en préservant optionnellement les marqueurs **gras**, *italique* et ==surligné==.
 */
const normalizeSymbolsAndEncoding = (
  raw: string,
  preserveRichMarkers: boolean
): string => {
  if (!raw) return "";
  let text = raw
    .replace(/\[SUB\]\s*/gi, "")
    .replace(/<br\s*\/?>/gi, " / ")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/«\s*/g, '"')
    .replace(/\s*»/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/`/g, "")
    .replace(/[✓✔]/g, "-> ")
    .replace(/[→➔]/g, "-> ")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/≠/g, "!=")
    .replace(/±/g, "+/-")
    .replace(/×/g, "x")
    .replace(/↑/g, "(hausse)")
    .replace(/↓/g, "(baisse)")
    .replace(/α/g, "alpha")
    .replace(/β/g, "beta")
    .replace(/γ/g, "gamma")
    .replace(/δ/g, "delta")
    .replace(/μ/g, "u")
    .replace(/•/g, " - ")
    .replace(/★/g, "")
    .replace(/◦/g, "")
    .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g, "")
    .replace(
      /[\u{1F300}-\u{1FAD6}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ""
    )
    .replace(/[\u{FE00}-\u{FEFF}]/gu, "")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "");

  if (!preserveRichMarkers) {
    text = text
      .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/==([^=]+)==/g, "$1")
      .replace(/\*+/g, "");
  } else {
    text = text
      .replace(/\*\*\*([^*]+)\*\*\*/g, "**$1**")
      .replace(/__([^_]+)__/g, "**$1**");
  }

  return text
    .replace(/[^\x00-\x7F\xC0-\xFF\u0100-\u017F\s]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
};

export const cleanTextForArgonPDF = (raw: string): string =>
  normalizeSymbolsAndEncoding(raw, false);

interface RichToken {
  text: string;
  bold: boolean;
  italic: boolean;
  highlight: boolean;
}

/**
 * Découpe une chaîne contenant **gras**, *italique* et/ou ==surligné== en segments typographiques
 */
function tokenizeRichText(raw: string): RichToken[] {
  const normalized = normalizeSymbolsAndEncoding(raw, true);
  if (!normalized) return [];

  const tokens: RichToken[] = [];
  const pattern = /(\*\*[^*]+\*\*|==[^=]+==|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      const plain = normalized.slice(lastIndex, match.index).replace(/\*+/g, "");
      if (plain) {
        tokens.push({ text: plain, bold: false, italic: false, highlight: false });
      }
    }
    const tokenRaw = match[0];
    if (tokenRaw.startsWith("**") && tokenRaw.endsWith("**")) {
      const inner = tokenRaw.slice(2, -2).replace(/\*+/g, "");
      if (inner) {
        tokens.push({ text: inner, bold: true, italic: false, highlight: false });
      }
    } else if (tokenRaw.startsWith("==") && tokenRaw.endsWith("==")) {
      const inner = tokenRaw.slice(2, -2).replace(/\*+/g, "");
      if (inner) {
        tokens.push({ text: inner, bold: true, italic: false, highlight: true });
      }
    } else if (tokenRaw.startsWith("*") && tokenRaw.endsWith("*")) {
      const inner = tokenRaw.slice(1, -1).replace(/\*+/g, "");
      if (inner) {
        tokens.push({ text: inner, bold: false, italic: true, highlight: false });
      }
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < normalized.length) {
    const tail = normalized.slice(lastIndex).replace(/\*+/g, "");
    if (tail) {
      tokens.push({ text: tail, bold: false, italic: false, highlight: false });
    }
  }

  return tokens.length > 0
    ? tokens
    : [{ text: cleanTextForArgonPDF(raw), bold: false, italic: false, highlight: false }];
}

/**
 * Découpe les tokens riches en lignes respectant `maxWidth` (en mm)
 */
function wrapRichTokens(
  pdf: jsPDF,
  tokens: RichToken[],
  maxWidth: number,
  fontSize: number
): RichToken[][] {
  pdf.setFontSize(fontSize);
  const wordsWithStyle: RichToken[] = [];

  tokens.forEach((tok) => {
    const parts = tok.text.split(/(\s+)/);
    parts.forEach((p) => {
      if (p.length > 0) {
        wordsWithStyle.push({
          text: p,
          bold: tok.bold,
          italic: tok.italic,
          highlight: tok.highlight,
        });
      }
    });
  });

  const lines: RichToken[][] = [];
  let currentLine: RichToken[] = [];
  let currentWidth = 0;

  for (const item of wordsWithStyle) {
    if (currentLine.length === 0 && /^\s+$/.test(item.text)) {
      continue;
    }
    const isSpaceOnly = /^\s+$/.test(item.text);
    const fontStyle = item.bold
      ? "bold"
      : item.italic
      ? "italic"
      : "normal";
    pdf.setFont("helvetica", fontStyle);
    const rawW = pdf.getTextWidth(item.text);
    const w = isSpaceOnly
      ? Math.max(rawW + 0.25, fontSize * 0.13)
      : rawW + (item.bold ? 0.12 : 0);

    if (currentWidth + w > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = isSpaceOnly ? [] : [item];
      currentWidth = isSpaceOnly ? 0 : w;
    } else {
      currentLine.push(item);
      currentWidth += w;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.length > 0
    ? lines
    : [[{ text: "", bold: false, italic: false, highlight: false }]];
}

/**
 * Dessine une ligne de tokens riches (gras Noir Profond #0F172A, italique et surlignage Ambre)
 */
function drawRichLine(
  pdf: jsPDF,
  lineTokens: RichToken[],
  startX: number,
  y: number,
  fontSize: number,
  baseColor: [number, number, number] = [30, 41, 59],
  boldColor: [number, number, number] = [15, 23, 42]
) {
  pdf.setFontSize(fontSize);
  let cursorX = startX;
  let prevWasBold = false;

  for (const tok of lineTokens) {
    if (!tok.text) continue;
    const isSpaceOnly = /^\s+$/.test(tok.text);
    const fontStyle = tok.bold
      ? "bold"
      : tok.italic
      ? "italic"
      : "normal";
    pdf.setFont("helvetica", fontStyle);
    const segW = pdf.getTextWidth(tok.text);

    if (isSpaceOnly) {
      const minSpaceW = prevWasBold
        ? Math.max(segW + 0.32, fontSize * 0.135)
        : Math.max(segW, fontSize * 0.115);
      cursorX += minSpaceW;
      prevWasBold = false;
      continue;
    }

    if (tok.highlight && tok.text.trim().length > 0) {
      pdf.setFillColor(254, 240, 138);
      pdf.rect(cursorX - 0.3, y - 2.9, segW + 0.6, 3.8, "F");
      pdf.setTextColor(120, 53, 15);
    } else if (tok.bold) {
      pdf.setTextColor(boldColor[0], boldColor[1], boldColor[2]);
    } else {
      pdf.setTextColor(baseColor[0], baseColor[1], baseColor[2]);
    }

    pdf.text(tok.text, cursorX, y);
    cursorX += segW + (tok.bold ? 0.12 : 0);
    prevWasBold = tok.bold;
  }
}

/**
 * Calcule des largeurs de colonnes proportionnelles intelligentes selon la densité de chaque colonne
 */
function computeSmartColumnWidths(
  rows: string[][],
  colCount: number,
  totalWidth: number
): number[] {
  if (colCount <= 1) return [totalWidth];
  const weights = new Array(colCount).fill(10);

  rows.forEach((row, rIdx) => {
    for (let c = 0; c < colCount; c++) {
      const len = (row[c] || "").length;
      const factor = rIdx === 0 ? 1.25 : 1;
      weights[c] = Math.max(weights[c], Math.min(len * factor, 105));
    }
  });

  const dampened = weights.map((w) => Math.pow(w, 0.56));
  const sum = dampened.reduce((acc, v) => acc + v, 0) || 1;
  const minColW = Math.min(22, totalWidth / colCount);

  const rawWidths = dampened.map((d) => (d / sum) * totalWidth);
  const adjusted = rawWidths.map((w) => Math.max(minColW, w));
  const adjSum = adjusted.reduce((a, b) => a + b, 0) || 1;

  return adjusted.map((w) => (w / adjSum) * totalWidth);
}

export interface ExportArgonSummaryOptions {
  title: string;
  content: string;
  summaryType?: string;
  createdAt?: string;
  facultyName?: string;
  authorName?: string;
}

/**
 * Exporte la SYNTHÈSE UNIFIÉE (Protocole Argon 4 Parties) au format PDF de référence :
 * - En-tête Page 1 sur fond blanc : Kicker Bleu Royal (#1D4ED8), Grand Titre Noir (#0F172A), Sous-titre Gris Ardoise (#475569) + Filet horizontal
 * - Bannières PARTIE I, II, III, IV en Bleu-Ardoise Foncé (#1E2530) pleine largeur
 * - Sous-titres (1.1, 1.2, Sous-partie K, 3.1, 3.2) en Bleu Marine (#1E3A8A) gras avec soulignement fin
 * - Ligne ★ Probabilité de sortie en Rouge Cramoisi (#991B1B) gras
 * - Tableaux Markdown à en-tête Bleu Marine (#1E3A8A) et colonnes proportionnelles
 * - Puces hiérarchiques : niveau 1 (• plein) et niveau 2 (◦ cercle creux indenté)
 * - Encadrés Roses/Rouges (#FEF2F2 + barre #B91C1C) pour les 5 Pièges Majeurs (Partie III)
 * - Encadrés Verts Émeraude (#F0FDF4 + barre #047857) pour les 5 Étapes du Cas Clinique (Partie IV)
 * - Pied de page académique Hipocampus 2026 + Page X of Y
 */
export const exportArgonSummaryToPDF = ({
  title,
  content,
  facultyName = "FMPO UCAD",
  authorName = "Master 1 Hématologie Clinique",
}: ExportArgonSummaryOptions) => {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 13.5;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = 14;

  const checkPageBreak = (neededHeight: number) => {
    if (yPos + neededHeight > pageHeight - 15) {
      pdf.addPage();
      yPos = 14;
    }
  };

  // Extraction des métadonnées @SYNTHESE_META_... et réparation préalable des tableaux multi-lignes
  const repairedContent = normalizeMarkdownTables(content || "");
  const allInputLines = repairedContent.split("\n");
  let metaKicker =
    "HIPPOCAMPUS 2026 - SYNTHESE UNIFIEE : COURS, INCIDENCE PAR OBJECTIF & DEMARCHE CAS CLINIQUE";
  const cleanedBaseTitle = cleanTextForArgonPDF(title)
    .replace(/^\d+\s*[-_.)\s]+\s*/, "")
    .trim();
  let metaTitle = `${cleanedBaseTitle} : Cours Complet, Audit & Stratégie d'Examen`;
  let metaSubtitle = `${authorName} | ${facultyName} | Croisement intégral avec les annales`;

  const bodyLines: string[] = [];
  for (const line of allInputLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("@SYNTHESE_META_KICKER:")) {
      metaKicker = cleanTextForArgonPDF(
        trimmed.replace("@SYNTHESE_META_KICKER:", "").replace(/•/g, "-")
      );
      continue;
    }
    if (trimmed.startsWith("@SYNTHESE_META_TITLE:")) {
      metaTitle = cleanTextForArgonPDF(trimmed.replace("@SYNTHESE_META_TITLE:", ""));
      continue;
    }
    if (trimmed.startsWith("@SYNTHESE_META_SUBTITLE:")) {
      metaSubtitle = cleanTextForArgonPDF(trimmed.replace("@SYNTHESE_META_SUBTITLE:", ""));
      continue;
    }
    bodyLines.push(line);
  }

  // 1. EN-TÊTE PAGE 1 — STYLE « SYNTHÈSE UNIFIÉE » (Fond blanc, Kicker Bleu #1D4ED8, Grand Titre Noir #0F172A, Sous-titre #475569)
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.2);
  pdf.setTextColor(29, 78, 216); // Bleu Royal #1D4ED8
  pdf.text(metaKicker.toUpperCase(), margin, yPos);
  yPos += 6.5;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15.5);
  pdf.setTextColor(15, 23, 42); // Noir Ardoise #0F172A
  const wrappedMainTitle = pdf.splitTextToSize(metaTitle, contentWidth);
  wrappedMainTitle.slice(0, 2).forEach((tLine: string) => {
    pdf.text(tLine, margin, yPos);
    yPos += 6.4;
  });

  yPos += 0.5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.8);
  pdf.setTextColor(71, 85, 105); // Gris Ardoise #475569
  pdf.text(metaSubtitle, margin, yPos);
  yPos += 3.8;

  // Filet horizontal sombre sous l'en-tête
  pdf.setDrawColor(30, 41, 59);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5.5;

  // 2. FONCTION DE DESSIN DE TABLEAU MARKDOWN À EN-TÊTE BLEU MARINE (#1E3A8A)
  const renderTableBlock = (tableLines: string[]) => {
    const parsedRows = tableLines
      .map((l) => {
        let trimmed = l.trim();
        if (trimmed.startsWith("|")) trimmed = trimmed.substring(1);
        if (trimmed.endsWith("|")) trimmed = trimmed.substring(0, trimmed.length - 1);
        return trimmed
          .split("|")
          .map((cell) => cell.trim().replace(/(?:\s*\/\s*){2,}$/g, ""));
      })
      .filter((row) => !row.every((c) => /^[-:\s]+$/.test(c)));

    if (parsedRows.length === 0) return;

    const colCount = Math.max(...parsedRows.map((r) => r.length), 1);
    if (colCount < 2) return;

    // Éliminer toute ligne de données tronquée qui n'aurait qu'une seule cellule remplie
    const rawRows = parsedRows.filter(
      (row, idx) => idx === 0 || row.filter((c) => c.length > 0 && c !== "-").length >= 2
    );

    // Ne jamais dessiner un en-tête de tableau orphelin sans aucune ligne de données développée
    if (rawRows.length < 2) return;

    const cleanedForWidths = rawRows.map((r) => r.map((c) => cleanTextForArgonPDF(c)));
    const colWidths = computeSmartColumnWidths(cleanedForWidths, colCount, contentWidth);

    rawRows.forEach((row, rowIndex) => {
      const isHeader = rowIndex === 0;
      const cellFontSize = 7.6;

      const wrappedCells = Array.from({ length: colCount }, (_, colIdx) => {
        const cellRaw = row[colIdx] || "";
        const tokens = tokenizeRichText(cellRaw);
        return wrapRichTokens(pdf, tokens, colWidths[colIdx] - 3.4, cellFontSize);
      });

      const maxLines = Math.max(...wrappedCells.map((lines) => lines.length), 1);
      const rowHeight = maxLines * 3.65 + 3.2;

      checkPageBreak(rowHeight + 2);

      if (isHeader) {
        pdf.setFillColor(30, 58, 138); // Bleu Marine #1E3A8A
        pdf.rect(margin, yPos, contentWidth, rowHeight, "F");
      } else {
        if (rowIndex % 2 === 1) {
          pdf.setFillColor(248, 250, 252); // Gris-bleu très pâle #F8FAFC
        } else {
          pdf.setFillColor(255, 255, 255);
        }
        pdf.rect(margin, yPos, contentWidth, rowHeight, "F");
      }

      pdf.setDrawColor(203, 213, 225); // Bordure #CBD5E1
      pdf.setLineWidth(0.2);

      let cellX = margin;
      for (let c = 0; c < colCount; c++) {
        const colW = colWidths[c];
        pdf.rect(cellX, yPos, colW, rowHeight, "S");
        const linesInCell = wrappedCells[c];
        linesInCell.forEach((tokenLine, lIdx) => {
          const lineY = yPos + 3.7 + lIdx * 3.55;
          if (isHeader) {
            const forcedBold = tokenLine.map((t) => ({
              ...t,
              bold: true,
              italic: false,
              highlight: false,
            }));
            drawRichLine(
              pdf,
              forcedBold,
              cellX + 1.7,
              lineY,
              cellFontSize,
              [255, 255, 255],
              [255, 255, 255]
            );
          } else {
            drawRichLine(
              pdf,
              tokenLine,
              cellX + 1.7,
              lineY,
              cellFontSize,
              [30, 41, 59],
              [15, 23, 42]
            );
          }
        });
        cellX += colW;
      }

      yPos += rowHeight;
    });

    yPos += 4.2;
  };

  // 3. FONCTION DE DESSIN D'ENCADRÉ MULTI-LIGNES (PIÈGE ROSE/ROUGE OU ÉTAPE VERT ÉMERAUDE)
  const renderCalloutBox = (
    variant: "trap" | "step" | "info",
    headerRaw: string,
    bodyRawLines: string[]
  ) => {
    const cleanHeader = cleanTextForArgonPDF(headerRaw)
      .replace(/^\[?(?:PI[ÈE]GE|AVERTISSEMENT|[ÉE]TAPE)\s*\d*\]?\s*/i, "")
      .replace(/\[(?:PI[ÈE]GE|AVERTISSEMENT|[ÉE]TAPE)\s*\d*\]\s*/gi, "")
      .trim();
    const innerWidth = contentWidth - 7.5;
    const headerFontSize = 8.5;
    const bodyFontSize = 8.2;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(headerFontSize);
    const wrappedHeader: string[] = cleanHeader
      ? pdf.splitTextToSize(cleanHeader, innerWidth)
      : [];

    interface PreparedBodyItem {
      isBullet: boolean;
      wrappedLines: RichToken[][];
    }

    const preparedBody: PreparedBodyItem[] = [];
    for (const bLine of bodyRawLines) {
      const trimmed = bLine
        .replace(/\[(?:PI[ÈE]GE|AVERTISSEMENT|[ÉE]TAPE)\s*\d*\]\s*/gi, "")
        .trim();
      if (!trimmed) continue;
      const isBullet = /^[-•*◦]\s+/.test(trimmed);
      const stripped = trimmed.replace(/^[-•*◦]\s+/, "");
      const autoBold = stripped.match(
        /^((?:\d+[\.)]\s*)?[A-Z0-9À-ÖØ-ß][^:*\n]{1,52})\s*:\s*(.+)$/
      );
      const toTok =
        autoBold && !stripped.includes("**")
          ? `**${autoBold[1].trim()} :** ${autoBold[2]}`
          : stripped;
      const tokens = tokenizeRichText(toTok);
      const wLines = wrapRichTokens(
        pdf,
        tokens,
        isBullet ? innerWidth - 4 : innerWidth,
        bodyFontSize
      );
      preparedBody.push({ isBullet, wrappedLines: wLines });
    }

    const totalBodyLinesCount = preparedBody.reduce(
      (acc, item) => acc + item.wrappedLines.length,
      0
    );
    const boxHeight =
      wrappedHeader.length * 4.1 +
      totalBodyLinesCount * 3.95 +
      preparedBody.length * 0.6 +
      4.5;

    checkPageBreak(boxHeight + 3);

    if (variant === "trap") {
      pdf.setFillColor(254, 242, 242); // Rose très doux #FEF2F2
      pdf.setDrawColor(248, 180, 180); // Bordure rose #F8B4B4
      pdf.setLineWidth(0.2);
      pdf.rect(margin, yPos, contentWidth, boxHeight, "FD");
      pdf.setFillColor(185, 28, 28); // Barre gauche Rouge Cramoisi #B91C1C
      pdf.rect(margin, yPos, 1.5, boxHeight, "F");
    } else if (variant === "step") {
      pdf.setFillColor(240, 253, 244); // Vert menthe très doux #F0FDF4
      pdf.setDrawColor(167, 243, 208); // Bordure émeraude #A7F3D0
      pdf.setLineWidth(0.2);
      pdf.rect(margin, yPos, contentWidth, boxHeight, "FD");
      pdf.setFillColor(4, 120, 87); // Barre gauche Émeraude #047857
      pdf.rect(margin, yPos, 1.5, boxHeight, "F");
    } else {
      pdf.setFillColor(239, 246, 255);
      pdf.setDrawColor(191, 219, 254);
      pdf.setLineWidth(0.2);
      pdf.rect(margin, yPos, contentWidth, boxHeight, "FD");
      pdf.setFillColor(29, 78, 216);
      pdf.rect(margin, yPos, 1.5, boxHeight, "F");
    }

    let cursorY = yPos + 4.1;

    // Dessiner l'en-tête de l'encadré
    if (wrappedHeader.length > 0) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(headerFontSize);
      if (variant === "step") {
        pdf.setTextColor(6, 95, 70); // Vert forêt #065F46
      } else if (variant === "trap") {
        pdf.setTextColor(15, 23, 42); // Noir profond #0F172A
      } else {
        pdf.setTextColor(30, 58, 138);
      }
      wrappedHeader.forEach((hLine: string) => {
        pdf.text(hLine, margin + 4, cursorY);
        cursorY += 4.1;
      });
    }

    // Dessiner les lignes du corps de l'encadré
    for (const item of preparedBody) {
      item.wrappedLines.forEach((tLine, lIdx) => {
        if (item.isBullet && lIdx === 0) {
          pdf.setFillColor(15, 23, 42);
          pdf.circle(margin + 5.2, cursorY - 1.0, 0.58, "F");
        }
        drawRichLine(
          pdf,
          tLine,
          item.isBullet ? margin + 7.4 : margin + 4,
          cursorY,
          bodyFontSize,
          [30, 41, 59],
          [15, 23, 42]
        );
        cursorY += 3.95;
      });
      cursorY += 0.6;
    }

    yPos += boxHeight + 3.2;
  };

  // 4. PARCOURS LIGNE PAR LIGNE DU MARKDOWN DE LA SYNTHÈSE UNIFIÉE
  let i = 0;

  while (i < bodyLines.length) {
    const rawLineWithIndent = bodyLines[i];
    const rawLine = rawLineWithIndent.trim();

    if (!rawLine || rawLine === "---") {
      yPos += 1.6;
      i++;
      continue;
    }

    // Ignorer les puces orphelines d'une à deux lettres
    const lowerRaw = rawLine.toLowerCase();
    if (
      /^[-•*◦→✓]\s*(?:\*{1,2})?[A-Za-zÀ-ÿ]{1,2}[.,;:]?(?:\*{1,2})?$/.test(rawLine) ||
      lowerRaw.includes("précisez ici la corrélation sémiologique ou physiopathologique essentielle") ||
      lowerRaw.includes("énoncez ici le réflexe clinique, le seuil biologique ou la règle d'examen incontournable") ||
      lowerRaw.includes("décrivez le distracteur classique du professeur et la parade")
    ) {
      i++;
      continue;
    }

    // A. Bloc Tableau Markdown
    if (rawLine.startsWith("|")) {
      const tableBuffer: string[] = [];
      while (i < bodyLines.length && bodyLines[i].trim().startsWith("|")) {
        let tLine = bodyLines[i].trim();
        if (!tLine.endsWith("|")) {
          tLine += " |";
        }
        tableBuffer.push(tLine);
        i++;
      }
      renderTableBlock(tableBuffer);
      continue;
    }

    // B. Bannière Principale : === PARTIE I..IV === ou # PARTIE I..IV / === VOLET ... ===
    const isMainHeader =
      /^===\s*(.+?)\s*===$/.test(rawLine) ||
      (/^#\s+(.+)$/.test(rawLine) &&
        !rawLine.startsWith("###") &&
        !rawLine.startsWith("##"));

    if (isMainHeader) {
      const headerMatch =
        rawLine.match(/^===\s*(.+?)\s*===$/) || rawLine.match(/^#\s+(.+)$/);
      const rawHeaderTitle = headerMatch ? headerMatch[1].trim() : rawLine;

      // Si c'est un ancien "=== OBJECTIF X ===", le traiter comme un sous-titre Bleu Marine ##
      if (/^OBJECTIF\s*\d+/i.test(rawHeaderTitle)) {
        const subTitle = cleanTextForArgonPDF(rawHeaderTitle);
        checkPageBreak(14);
        yPos += 2.5;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10.2);
        pdf.setTextColor(30, 58, 138); // Bleu Marine #1E3A8A
        pdf.text(subTitle, margin, yPos + 3.5);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.25);
        pdf.line(margin, yPos + 5.2, pageWidth - margin, yPos + 5.2);
        yPos += 8.5;
        i++;
        continue;
      }

      const headerTitle = cleanTextForArgonPDF(rawHeaderTitle).toUpperCase();
      checkPageBreak(18);
      yPos += 2.5;

      // Bannière pleine largeur Bleu-Ardoise Foncé #1E2530 ([30, 37, 48])
      pdf.setFillColor(30, 37, 48);
      pdf.rect(margin, yPos, contentWidth, 8.2, "F");

      pdf.setFontSize(9.1);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.text(headerTitle, margin + 3.2, yPos + 5.5);
      yPos += 12;
      i++;
      continue;
    }

    // C. Sous-section : ## Sous-partie K ..., ## 1.1 ..., ## 3.1 ...
    const isSubHeader =
      /^--\s*(.+?)\s*--$/.test(rawLine) ||
      (/^##\s+(.+)$/.test(rawLine) && !rawLine.startsWith("###"));

    if (isSubHeader) {
      const subMatch =
        rawLine.match(/^--\s*(.+?)\s*--$/) || rawLine.match(/^##\s+(.+)$/);
      const subTitle = cleanTextForArgonPDF(subMatch ? subMatch[1] : rawLine);

      checkPageBreak(15);
      yPos += 2.2;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.2);
      pdf.setTextColor(30, 58, 138); // Bleu Marine #1E3A8A
      const wrappedSub = pdf.splitTextToSize(subTitle, contentWidth);
      wrappedSub.forEach((sLine: string, idx: number) => {
        pdf.text(sLine, margin, yPos + 3.6 + idx * 4.4);
      });
      const subH = wrappedSub.length * 4.4;

      pdf.setDrawColor(226, 232, 240); // Soulignement gris-bleu subtil #E2E8F0
      pdf.setLineWidth(0.25);
      pdf.line(margin, yPos + subH + 0.8, pageWidth - margin, yPos + subH + 0.8);

      yPos += subH + 4.2;
      i++;
      continue;
    }

    // D. Ligne Étoile Cramoisi : ★ Probabilité de sortie : ...
    if (
      rawLine.startsWith("★") ||
      /^[*•-]?\s*Probabilit[ée]\s+de\s+sortie\s*:/i.test(rawLine)
    ) {
      const starText = cleanTextForArgonPDF(
        rawLine.replace(/^★\s*/, "").replace(/•/g, " - ")
      );
      checkPageBreak(8);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.3);
      pdf.setTextColor(153, 27, 27); // Rouge Cramoisi #991B1B
      const wrappedStar = pdf.splitTextToSize(`* ${starText}`, contentWidth);
      wrappedStar.forEach((stLine: string) => {
        pdf.text(stLine, margin, yPos);
        yPos += 4.1;
      });
      yPos += 1.4;
      i++;
      continue;
    }

    // E. Bloc de Citation Markdown `> ...` (Encadrés Pièges 3.1, Rappels Cliniques roses ou Étapes / Règles d'Or Émeraude)
    if (rawLine.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < bodyLines.length && bodyLines[i].trim().startsWith(">")) {
        quoteLines.push(bodyLines[i].trim().replace(/^>\s?/, "").trim());
        i++;
      }
      const nonEmptyQuotes = quoteLines.filter(Boolean);
      if (nonEmptyQuotes.length > 0) {
        const firstQ = nonEmptyQuotes[0];
        const restQ = nonEmptyQuotes.slice(1);
        const combinedQ = nonEmptyQuotes.join(" ");
        const isStepBox =
          /\[?[ÉE]TAPE\s*\d*\]?/i.test(firstQ) ||
          /^[ÉE]TAPE\s*\d+/i.test(firstQ) ||
          /R[ÈE]GLE\s+D['’]OR|CONSEIL\s+STRAT[ÉE]GIQUE/i.test(combinedQ);
        const isTrapBox =
          /\[?(?:PI[ÈE]GE|AVERTISSEMENT)\s*\d*\]?/i.test(firstQ) ||
          /^\d+\.\s*Pi[èe]ge/i.test(firstQ) ||
          /Pi[èe]ge\s+(?:de|à|d'|du|des|sur)/i.test(combinedQ) ||
          /RAPPEL\s+CLINIQUE|RAPPEL\s+S[ÉE]MIOLOGIQUE|RAPPEL\s+PHYSIOPATHOLOGIQUE|NOTE\s+CLINIQUE/i.test(
            combinedQ
          );

        if (restQ.length === 0 && firstQ.includes(":")) {
          const colonIdx = firstQ.indexOf(":");
          const hPart = firstQ.slice(0, colonIdx + 1);
          const bPart = firstQ.slice(colonIdx + 1).trim();
          renderCalloutBox(
            isStepBox ? "step" : isTrapBox ? "trap" : "trap",
            hPart,
            bPart ? [bPart] : []
          );
        } else {
          renderCalloutBox(
            isStepBox ? "step" : isTrapBox ? "trap" : "trap",
            firstQ,
            restQ
          );
        }
      }
      continue;
    }

    // F. Encadrés entre crochets [ AVERTISSEMENT / PIÈGE ... ], [ ÉTAPE ... ], [ RAPPEL CLINIQUE ... ], [ RÈGLE D'OR ... ]
    if (rawLine.startsWith("[") && rawLine.endsWith("]")) {
      const innerBracket = rawLine.slice(1, -1).trim();
      const isStepBracket =
        /^[ÉE]TAPE\s*\d*/i.test(innerBracket) ||
        /^R[ÈE]GLE\s+D['’]OR|^CONSEIL\s+STRAT[ÉE]GIQUE|^RENDEMENT/i.test(innerBracket);
      const isTrapOrRappelBracket =
        /^(?:AVERTISSEMENT|PI[ÈE]GE|RAPPEL|NOTE)/i.test(innerBracket);

      const collectedBody: string[] = [];
      let headerText = innerBracket;
      if (
        innerBracket.includes(":") &&
        !/^[ÉE]TAPE\s*\d+\s*[—\-]/i.test(innerBracket)
      ) {
        const colonIdx = innerBracket.indexOf(":");
        headerText = innerBracket.slice(0, colonIdx + 1).trim();
        const inlineBody = innerBracket.slice(colonIdx + 1).trim();
        if (inlineBody) {
          collectedBody.push(inlineBody);
        }
      }

      i++;
      while (i < bodyLines.length) {
        const nextTrim = bodyLines[i].trim();
        if (
          !nextTrim ||
          nextTrim.startsWith("[") ||
          nextTrim.startsWith("#") ||
          nextTrim.startsWith("===") ||
          nextTrim.startsWith(">") ||
          nextTrim.startsWith("|") ||
          nextTrim.startsWith("★")
        ) {
          break;
        }
        // Si c'est un encadré RAPPEL / RÈGLE D'OR sur une seule ligne déjà complète, ne pas avaler les puces suivantes de l'objectif
        if (
          /^(?:RAPPEL|NOTE|R[ÈE]GLE|CONSEIL)/i.test(innerBracket) &&
          collectedBody.length > 0
        ) {
          break;
        }
        collectedBody.push(nextTrim);
        i++;
      }

      renderCalloutBox(
        isStepBracket ? "step" : isTrapOrRappelBracket ? "trap" : "trap",
        headerText,
        collectedBody
      );
      continue;
    }

    // G. Sous-sous-section : ### Titre
    if (rawLine.startsWith("### ")) {
      const h3Title = cleanTextForArgonPDF(rawLine.substring(4));
      checkPageBreak(10);
      yPos += 1.2;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.8);
      pdf.setTextColor(30, 58, 138);
      pdf.text(h3Title, margin, yPos + 3.2);
      yPos += 5.8;
      i++;
      continue;
    }

    // H. Puces hiérarchiques (Niveau 1 `•`, Niveau 2 `◦` indenté, Listes numérotées `1.`) et Paragraphes
    const leadingSpaces = (rawLineWithIndent.match(/^(\s*)/)?.[1] || "").length;
    const isSubBullet =
      rawLine.startsWith("◦") ||
      /^[-•*]\s*◦\s+/.test(rawLine) ||
      /^[-•*◦]?\s*\[SUB\]/i.test(rawLine) ||
      (leadingSpaces >= 2 && /^[-•*◦]\s+/.test(rawLine));
    const isLevel1Bullet =
      !isSubBullet && /^[-•*→✓✔]\s+/.test(rawLine);
    const numberedMatch = rawLine.match(/^(\d+[\.)])\s+(.+)$/);

    let cleanContentLine = rawLine
      .replace(/^[-•*◦→✓✔]?\s*\[SUB\]\s*/i, "")
      .replace(/^[-•*]\s*◦\s+/, "")
      .replace(/^[-•*◦→✓✔]\s+/, "")
      .trim();

    if (numberedMatch) {
      cleanContentLine = `**${numberedMatch[1]}** ${numberedMatch[2]}`;
    } else {
      // Mettre automatiquement le concept avant ':' en gras s'il ne l'est pas déjà
      const autoBoldColon = cleanContentLine.match(
        /^([A-Z0-9À-ÖØ-ß][^:*\n]{1,50})\s*:\s*(.+)$/
      );
      if (autoBoldColon && !cleanContentLine.includes("**")) {
        cleanContentLine = `**${autoBoldColon[1].trim()} :** ${autoBoldColon[2]}`;
      }
    }

    const richTokens = tokenizeRichText(cleanContentLine);
    if (richTokens.length > 0) {
      const textIndent = isSubBullet
        ? 9.6
        : isLevel1Bullet || numberedMatch
        ? 4.8
        : 0;
      const fontSize = 8.4;
      const wrappedRichLines = wrapRichTokens(
        pdf,
        richTokens,
        contentWidth - textIndent,
        fontSize
      );

      wrappedRichLines.forEach((tokenLine, lineIdx) => {
        checkPageBreak(4.5);

        if (lineIdx === 0) {
          if (isSubBullet) {
            // Cercle creux ◦ (Niveau 2 — retrait à droite / alinéa)
            pdf.setDrawColor(51, 65, 85);
            pdf.setLineWidth(0.25);
            pdf.circle(margin + 6.8, yPos - 1.05, 0.62, "S");
          } else if (isLevel1Bullet) {
            // Disque plein • (Niveau 1 — retour à la marge normale)
            pdf.setFillColor(15, 23, 42);
            pdf.circle(margin + 2.2, yPos - 1.05, 0.65, "F");
          }
        }

        drawRichLine(
          pdf,
          tokenLine,
          margin + textIndent,
          yPos,
          fontSize,
          [30, 41, 59],
          [15, 23, 42]
        );
        yPos += 4.15;
      });
      yPos += 0.85;
    }

    i++;
  }

  // 5. PIEDS DE PAGE SUR TOUTES LES PAGES (STYLE « SYNTHÈSE UNIFIÉE »)
  const totalPages = pdf.getNumberOfPages();
  const shortFooterTitle = cleanedBaseTitle.substring(0, 42);

  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);

    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139); // Slate #64748B
    pdf.setFont("helvetica", "normal");
    pdf.text(
      `Hipocampus 2026 - Synthese Unifiee : ${shortFooterTitle}, Incidence par Objectif & Demarche Cas Clinique`,
      margin,
      pageHeight - 8
    );

    pdf.text(
      `Page ${p} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" }
    );
  }

  const safeFileName = cleanedBaseTitle
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 45);

  pdf.save(`Synthese_Unifiee_${safeFileName || "Medical"}.pdf`);
};
