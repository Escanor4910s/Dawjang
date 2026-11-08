import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export type PdfThemeKey = "dawjang" | "prestige" | "hospital" | "monochrome";
export type PdfFontMode = "serif" | "sans";

export interface PdfThemePalette {
  id: PdfThemeKey;
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  textMain: string;
  textMuted: string;
  border: string;
  surface: string;
  highlightBg: string;
}

export const PDF_THEMES: Record<PdfThemeKey, PdfThemePalette> = {
  dawjang: {
    id: "dawjang",
    label: "Signature DawJang (Bleu Nuit & Terracotta)",
    primary: "#0F172A",
    secondary: "#1E293B",
    accent: "#C96442",
    accentSoft: "#FAF5F0",
    accentBorder: "#EBD5C8",
    textMain: "#1E293B",
    textMuted: "#64748B",
    border: "#E2E8F0",
    surface: "#F8FAFC",
    highlightBg: "#FEF3C7",
  },
  prestige: {
    id: "prestige",
    label: "Édition Prestige (Ébène & Or Académique)",
    primary: "#181715",
    secondary: "#292524",
    accent: "#92400E",
    accentSoft: "#FEFCE8",
    accentBorder: "#FDE68A",
    textMain: "#1C1917",
    textMuted: "#78716C",
    border: "#E5E2DC",
    surface: "#FAF8F5",
    highlightBg: "#FEF08A",
  },
  hospital: {
    id: "hospital",
    label: "Clinique CHU (Bleu Oxford & Émeraude)",
    primary: "#0F172A",
    secondary: "#1E3A8A",
    accent: "#0F766E",
    accentSoft: "#F0FDFA",
    accentBorder: "#99F6E4",
    textMain: "#1E293B",
    textMuted: "#64748B",
    border: "#E2E8F0",
    surface: "#F8FAFC",
    highlightBg: "#CCFBF1",
  },
  monochrome: {
    id: "monochrome",
    label: "Imprimerie Laser (Noir Pur & Acier)",
    primary: "#09090B",
    secondary: "#27272A",
    accent: "#27272A",
    accentSoft: "#F4F4F5",
    accentBorder: "#D4D4D8",
    textMain: "#18181B",
    textMuted: "#52525B",
    border: "#D4D4D8",
    surface: "#FAFAFA",
    highlightBg: "#E4E4E7",
  },
};

export interface PdfInlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  highlight?: boolean;
}

export interface PdfBlock {
  type: "h3" | "paragraph" | "callout" | "bullet_list" | "ordered_list";
  title?: string;
  calloutLabel?: string;
  spans?: PdfInlineSpan[];
  items?: PdfInlineSpan[][];
}

export interface PdfSection {
  index: number;
  badge: string;
  title: string;
  blocks: PdfBlock[];
}

export interface MedicalDocumentProps {
  title: string;
  content: string;
  subject?: string;
  date?: string;
  type?: string;
  resolutionLabel?: string;
  architectureLabel?: string;
  authorName?: string;
  facultyName?: string;
  theme?: PdfThemeKey;
  fontMode?: PdfFontMode;
  includeToc?: boolean;
  includeRevisionBox?: boolean;
  referenceCode?: string;
}

/**
 * Normalise toutes les chaînes pour les polices vectorielles PDF standard (WinAnsiEncoding)
 * afin d'éviter tout glyphe manquant sur les symboles médicaux (B₁₂, SpO₂, ≥, ≤, →, μg/dL, etc.).
 */
export function sanitizePdfText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[\u202F\u00A0\u2009\u2007]/g, " ")
    // Subscripts (fréquents en médecine : B₁₂, O₂, CO₂, H₂O, T₃, T₄)
    .replace(/₀/g, "0")
    .replace(/₁/g, "1")
    .replace(/₂/g, "2")
    .replace(/₃/g, "3")
    .replace(/₄/g, "4")
    .replace(/₅/g, "5")
    .replace(/₆/g, "6")
    .replace(/₇/g, "7")
    .replace(/₈/g, "8")
    .replace(/₉/g, "9")
    .replace(/₊/g, "+")
    .replace(/₋/g, "-")
    // Superscripts hors Latin-1
    .replace(/⁰/g, "^0")
    .replace(/⁴/g, "^4")
    .replace(/⁵/g, "^5")
    .replace(/⁶/g, "^6")
    .replace(/⁷/g, "^7")
    .replace(/⁸/g, "^8")
    .replace(/⁹/g, "^9")
    .replace(/⁺/g, "+")
    .replace(/⁻/g, "-")
    // Lettres grecques médicales courantes
    .replace(/μ/g, "µ")
    .replace(/α/g, "alpha")
    .replace(/β/g, "beta")
    .replace(/γ/g, "gamma")
    .replace(/δ/g, "delta")
    .replace(/Δ/g, "Delta")
    // Symboles mathématiques et flèches cliniques
    .replace(/[→➔⟶⇒⟹]/g, " -> ")
    .replace(/[←⟵⇐]/g, " <- ")
    .replace(/[↔⟷⇔]/g, " <-> ")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/≠/g, "!=")
    .replace(/≈/g, "~")
    .replace(/∞/g, "infini")
    .replace(/[▪▸▹►▻●◦]/g, "•")
    .replace(/[✓✔☑]/g, "[V]")
    .replace(/[✗✘☒]/g, "[X]")
    // Suppression propre des emojis non supportés par WinAnsi
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    // Contractions grammaticales françaises et corrections de tronquage
    .replace(/\b([àa])\s+le\b/gi, "au")
    .replace(/\b([àa])\s+les\b/gi, "aux")
    .replace(/\bde\s+le\b/gi, "du")
    .replace(/\bde\s+les\b/gi, "des")
    .replace(/(^|\s),3\s*diphosphoglyc[ée]rate/gi, "$12,3-diphosphoglycérate")
    // Nettoyage des astérisques orphelins (ex: "13 g/dl**" -> "13 g/dl")
    .replace(/(?<=\S)\s*\*{2,}(?=\s|$)/g, "")
    .replace(/\*{2,}/g, "")
    // Nettoyage des espaces multiples
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Parse une chaîne contenant des balises HTML inline (<strong>, <b>, <em>, <i>, <u>, <mark>)
 * ou du Markdown (**gras**, *italique*) en segments typographiques vectoriels.
 */
export function parseInlineSpans(rawHtmlOrMd: string): PdfInlineSpan[] {
  if (!rawHtmlOrMd) return [];

  // Convertir d'abord les balises HTML inline en marqueurs canoniques
  let normalized = rawHtmlOrMd
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(strong|b)\b[^>]*>(.*?)<\/\1>/gis, "**$2**")
    .replace(/<(em|i)\b[^>]*>(.*?)<\/\1>/gis, "__ITALIC_START__$2__ITALIC_END__")
    .replace(/<u\b[^>]*>(.*?)<\/u>/gis, "__UNDERLINE_START__$1__UNDERLINE_END__")
    .replace(/<mark\b[^>]*>(.*?)<\/mark>/gis, "__MARK_START__$1__MARK_END__")
    .replace(/<\/?(?:strong|b|em|i|u|mark|span|p|div|br|hr)\b[^>]*>/gi, "");

  // Nettoyage des doubles astérisques orphelins en fin de ligne (ex: "13 g/dl**" -> "13 g/dl")
  normalized = normalized
    .replace(/([^\s*])\*{2,}(?=\s*(\n|$))/g, "$1")
    .replace(/\*{2,}(?=\s*(\n|$))/g, "")
    .replace(/(?<=[^\s*])\*{2,}(?=\s|$)/g, "");

  const tokenRegex =
    /(\*\*.*?\*\*|__ITALIC_START__.*?__ITALIC_END__|__UNDERLINE_START__.*?__UNDERLINE_END__|__MARK_START__.*?__MARK_END__)/gs;

  const parts = normalized.split(tokenRegex).filter(Boolean);
  const spans: PdfInlineSpan[] = [];

  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = sanitizePdfText(
        part
          .slice(2, -2)
          .replace(/__(?:ITALIC|UNDERLINE|MARK)_(?:START|END)__/g, "")
      );
      if (inner) spans.push({ text: inner, bold: true });
    } else if (
      part.startsWith("__ITALIC_START__") &&
      part.endsWith("__ITALIC_END__")
    ) {
      const inner = sanitizePdfText(
        part
          .replace(/^__ITALIC_START__/, "")
          .replace(/__ITALIC_END__$/, "")
          .replace(/\*\*/g, "")
      );
      if (inner) spans.push({ text: inner, italic: true });
    } else if (
      part.startsWith("__UNDERLINE_START__") &&
      part.endsWith("__UNDERLINE_END__")
    ) {
      const inner = sanitizePdfText(
        part
          .replace(/^__UNDERLINE_START__/, "")
          .replace(/__UNDERLINE_END__$/, "")
          .replace(/\*\*/g, "")
      );
      if (inner) spans.push({ text: inner, underline: true });
    } else if (
      part.startsWith("__MARK_START__") &&
      part.endsWith("__MARK_END__")
    ) {
      const inner = sanitizePdfText(
        part
          .replace(/^__MARK_START__/, "")
          .replace(/__MARK_END__$/, "")
          .replace(/\*\*/g, "")
      );
      if (inner) spans.push({ text: inner, highlight: true, bold: true });
    } else {
      let cleaned = sanitizePdfText(part);
      cleaned = cleaned.replace(/\*{2,}$/g, "").replace(/^\*{2,}/g, "");
      if (cleaned) {
        // Préserver un espace de liaison si nécessaire
        const leadingSpace = /^\s/.test(part) && spans.length > 0 ? " " : "";
        const trailingSpace = /\s$/.test(part) ? " " : "";
        spans.push({ text: `${leadingSpace}${cleaned}${trailingSpace}` });
      }
    }
  }

  return spans;
}

/**
 * Transforme aussi bien du HTML riche (Summaries.tsx / Le Rédacteur) que du Markdown
 * en sections structurées dignes d'une édition médicale professionnelle.
 */
export function parseMedicalDocumentToSections(rawContent: string): PdfSection[] {
  if (!rawContent || !rawContent.trim()) {
    return [
      {
        index: 1,
        badge: "SECTION 01",
        title: "Synthèse clinique",
        blocks: [
          {
            type: "paragraph",
            spans: [{ text: "Aucun contenu disponible pour ce document." }],
          },
        ],
      },
    ];
  }

  // 1. Élimination impérative de tout préambule de sommaire redondant (HTML & Markdown)
  // pour démarrer DIRECTEMENT et EXCLUSIVEMENT à l'Objectif 1
  let sanitizedContent = rawContent
    .replace(/<blockquote\b[^>]*>[\s\S]*?(?:Synth[eèé]se|Objectif|Cadre|Sommaire|Moins de)[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<h[1-3]\b[^>]*>[\s\S]*?(?:Synth[eèé]se\s*&?\s*Cadre|Sommaire\s*Ex[eèé]cutif)[\s\S]*?<\/h[1-3]>/gi, "")
    .replace(/^\s*(?:#{1,3}\s*)?(?:SECTION\s*\d+\s*[:.\-]?\s*)?(?:Synth[eèé]se\s*&?\s*Cadre\s*Nosologique|Sommaire\s*Ex[eèé]cutif|Synth[eèé]se\s*M[eèé]dicale[^\n]*)\s*\n+/gi, "")
    .replace(/^\s*(?:SECTION\s*\d+\s*[^\n]*\n+)?(?:>\s*[^\n]*\n+)+(?:---\s*\n*)?/im, "")
    .replace(/\n*>\s*(?:\*\*)?Synth[eèé]se[\s\S]*?(?=\n\s*---\s*\n|\n\s*#{1,3}\s*Objectif|\n\s*#|$)(?:---\s*\n*)?/gi, "\n\n")
    .replace(/^\s*>\s*\d+\.\s*(?:\*\*)?Objectif\s*\d+.*?(?=\n\s*#{1,3}|\n\s*#|$)/gims, "")
    .replace(/^SECTION\s*\d+\s*[^\n]*\n+/gim, "")
    .trim();

  // Trouver le vrai premier titre d'objectif (Markdown ou HTML) pour purger tout bloc amont
  const firstMdObjIdx = sanitizedContent.search(/(?:^|\n)#{1,3}\s+(?:Objectif\s*1\b|\d+\.\s*Objectif\s*1\b|Chapitre\s*1\b)/i);
  const firstHtmlObjIdx = sanitizedContent.search(/<h[1-3][^>]*>(?:\s*(?:Objectif\s*1\b|\d+\.\s*Objectif\s*1\b|Chapitre\s*1\b))/i);
  const firstRealIdx = firstMdObjIdx !== -1 ? firstMdObjIdx : firstHtmlObjIdx;

  if (firstRealIdx > 0) {
    const headerPreamble = sanitizedContent.slice(0, firstRealIdx).trim();
    if (
      headerPreamble.includes("Synthèse") ||
      headerPreamble.includes("Objectif") ||
      headerPreamble.includes("Sommaire") ||
      headerPreamble.includes("Cadre") ||
      headerPreamble.includes("SECTION") ||
      headerPreamble.startsWith(">") ||
      headerPreamble.endsWith("---")
    ) {
      sanitizedContent = sanitizedContent.slice(firstRealIdx).trim();
    }
  }

  // Nettoyage des astérisques orphelins en fin de ligne (ex: "Définir l'anémie**" -> "Définir l'anémie")
  sanitizedContent = sanitizedContent
    .replace(/([^\s*])\*{2,}(?=\s*(\n|$))/g, "$1")
    .replace(/\*{2,}(?=\s*(\n|$))/g, "");

  const hasHtmlTags = /<(h[1-4]|p|ul|ol|li|div|blockquote)\b/i.test(sanitizedContent);

  const sections: PdfSection[] = [];
  let currentSection: PdfSection | null = null;

  const ensureSection = (defaultTitle = "Développement clinique"): PdfSection => {
    if (!currentSection) {
      const idx = sections.length + 1;
      currentSection = {
        index: idx,
        badge: `SECTION ${String(idx).padStart(2, "0")}`,
        title: defaultTitle,
        blocks: [],
      };
      sections.push(currentSection);
    }
    return currentSection;
  };

  const pushNewSectionFromHeading = (rawHeadingText: string) => {
    const clean = sanitizePdfText(rawHeadingText.replace(/<[^>]+>/g, ""));
    if (!clean) return;

    // Ignore expressément les préambules redondants ("Synthèse & Cadre Nosologique", "Synthèse Médicale...")
    if (
      /Synthèse\s*&?\s*Cadre/i.test(clean) ||
      /Cadre\s*Nosologique/i.test(clean) ||
      /^Synthèse\s*Médicale/i.test(clean) ||
      /^Sommaire\s*Exécutif/i.test(clean)
    ) {
      return;
    }

    const idx = sections.length + 1;
    const objMatch = clean.match(/^Objectif\s*(\d+)\s*[—–\-:]\s*(.+)$/i);
    const chapMatch = clean.match(/^Chapitre\s*(\d+)\s*[—–\-:]\s*(.+)$/i);

    let badge = `SECTION ${String(idx).padStart(2, "0")}`;
    let title = clean;

    if (objMatch) {
      badge = `OBJECTIF ${String(Number(objMatch[1])).padStart(2, "0")}`;
      title = objMatch[2].trim();
    } else if (chapMatch) {
      badge = `CHAPITRE ${String(Number(chapMatch[1])).padStart(2, "0")}`;
      title = chapMatch[2].trim();
    }

    currentSection = {
      index: idx,
      badge,
      title,
      blocks: [],
    };
    sections.push(currentSection);
  };

  const classifyParagraphOrCallout = (innerHtml: string): PdfBlock | null => {
    const plain = sanitizePdfText(innerHtml.replace(/<[^>]+>/g, ""));
    if (!plain) return null;

    // Élimine toute ligne parasite de bloc-note résumant les objectifs ou cartouches
    if (
      /^(?:>\s*)?Synthèse\s*Médicale/i.test(plain) ||
      /^(?:>\s*)?Synthèse\s*Fidèle/i.test(plain) ||
      /^(?:>\s*)?Cadre\s*Nosologique/i.test(plain) ||
      /^(?:>\s*)?\d+\.\s*Objectif\s*\d+/i.test(plain) ||
      /^(?:>\s*)?Objectif\s*\d+\s*[:.\-–—]/i.test(plain) ||
      /Moins\s*de\s*\d+\s*mots/i.test(plain)
    ) {
      return null;
    }

    const isCallout =
      /^(?:À retenir|Point(?:s)? clé(?:s)?|Attention|Piège(?:s)?|Urgence|Règle d'or|En synthèse|Synthèse clinique|Conduite à tenir|Diagnostic positif)\s*:/i.test(
        plain
      );

    if (isCallout) {
      const colonIdx = plain.indexOf(":");
      const label = colonIdx > 0 ? plain.slice(0, colonIdx).toUpperCase() : "POINT CLINIQUE";
      return {
        type: "callout",
        calloutLabel: label,
        spans: parseInlineSpans(innerHtml),
      };
    }

    return {
      type: "paragraph",
      spans: parseInlineSpans(innerHtml),
    };
  };

  if (hasHtmlTags) {
    // Normaliser le HTML en flux de blocs séquentiels
    const blockRegex =
      /<(h1|h2|h3|h4|p|ul|ol|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(sanitizedContent)) !== null) {
      const tag = String(match[1] || "").toLowerCase();
      const inner = match[2].trim();

      if (tag === "h1" || tag === "h2") {
        pushNewSectionFromHeading(inner);
      } else if (tag === "h3" || tag === "h4") {
        const sec = ensureSection();
        const cleanSub = sanitizePdfText(inner.replace(/<[^>]+>/g, ""));
        if (cleanSub) {
          sec.blocks.push({
            type: "h3",
            title: cleanSub,
          });
        }
      } else if (tag === "ul" || tag === "ol") {
        const sec = ensureSection();
        const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
        const items: PdfInlineSpan[][] = [];
        let liMatch: RegExpExecArray | null;
        while ((liMatch = liRegex.exec(inner)) !== null) {
          const spans = parseInlineSpans(liMatch[1].trim());
          if (spans.length > 0) {
            items.push(spans);
          }
        }
        if (items.length > 0) {
          sec.blocks.push({
            type: tag === "ol" ? "ordered_list" : "bullet_list",
            items,
          });
        }
      } else if (tag === "blockquote") {
        // Ignorer les blockquotes de préambule
        if (!/Synthèse\s*Médicale|Objectif\s*\d+|Cadre\s*Nosologique/i.test(inner)) {
          const sec = ensureSection();
          const spans = parseInlineSpans(inner);
          if (spans.length > 0) {
            sec.blocks.push({
              type: "callout",
              calloutLabel: "ENCADRÉ CLINIQUE",
              spans,
            });
          }
        }
      } else if (tag === "p") {
        const blk = classifyParagraphOrCallout(inner);
        if (blk) ensureSection().blocks.push(blk);
      }
    }
  } else {
    // Fallback / Mode Markdown & Texte structuré (filtrage sécurisé des balises HTML sans avaler les < > mathématiques)
    const lines = sanitizedContent
      .replace(/<\/?(?:h[1-6]|p|div|span|ul|ol|li|blockquote|table|tr|th|td|br|hr)\b[^>]*>/gi, "\n")
      .split(/\r?\n/);
    let pendingBullets: PdfInlineSpan[][] = [];
    let pendingOrdered: PdfInlineSpan[][] = [];

    const flushLists = () => {
      if (pendingBullets.length > 0) {
        ensureSection().blocks.push({
          type: "bullet_list",
          items: [...pendingBullets],
        });
        pendingBullets = [];
      }
      if (pendingOrdered.length > 0) {
        ensureSection().blocks.push({
          type: "ordered_list",
          items: [...pendingOrdered],
        });
        pendingOrdered = [];
      }
    };

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        flushLists();
        continue;
      }

      if (
        /^===\s*(.+?)\s*===$/.test(trimmed) ||
        /^#{1,2}\s+(.+)$/.test(trimmed) ||
        /^(?:Objectif|Chapitre)\s+\d+\s*[—–\-:]/i.test(trimmed)
      ) {
        flushLists();
        const cleanHeading = trimmed
          .replace(/^===\s*/, "")
          .replace(/\s*===$/, "")
          .replace(/^#{1,2}\s+/, "");
        pushNewSectionFromHeading(cleanHeading);
        continue;
      }

      if (/^--\s*(.+?)\s*--$/.test(trimmed) || /^#{3,4}\s+(.+)$/.test(trimmed)) {
        flushLists();
        const cleanSub = sanitizePdfText(
          trimmed
            .replace(/^--\s*/, "")
            .replace(/\s*--$/, "")
            .replace(/^#{3,4}\s+/, "")
        );
        if (cleanSub) {
          ensureSection().blocks.push({
            type: "h3",
            title: cleanSub,
          });
        }
        continue;
      }

      if (/^[-*•]\s+(.+)$/.test(trimmed)) {
        if (pendingOrdered.length > 0) flushLists();
        const itemText = trimmed.replace(/^[-*•]\s+/, "");
        const spans = parseInlineSpans(itemText);
        if (spans.length > 0) pendingBullets.push(spans);
        continue;
      }

      if (/^\d+[.)]\s+(.+)$/.test(trimmed)) {
        if (pendingBullets.length > 0) flushLists();
        const itemText = trimmed.replace(/^\d+[.)]\s+/, "");
        const spans = parseInlineSpans(itemText);
        if (spans.length > 0) pendingOrdered.push(spans);
        continue;
      }

      flushLists();
      const blk = classifyParagraphOrCallout(trimmed);
      if (blk) ensureSection().blocks.push(blk);
    }

    flushLists();
  }

  // Élimine impérativement TOUTE section préambule ("Synthèse & Cadre Nosologique" ou cartouche de sommaire redondant)
  const validSections = sections.filter((s, idx) => {
    // Si le titre évoque une section d'en-tête technique ou un titre générique
    if (/Synthèse\s*&?\s*Cadre/i.test(s.title)) return false;
    if (/Cadre\s*Nosologique/i.test(s.title)) return false;
    if (/^Synthèse\s*Médicale/i.test(s.title)) return false;
    if (/^Sommaire\s*Exécutif/i.test(s.title)) return false;

    // Si d'autres sections sont des Objectifs, toute première section non-objectif est un résidu à éliminer
    if (idx === 0 && sections.length > 1) {
      const nextHasObjectives = sections.slice(1).some((other) =>
        other.badge.startsWith("OBJECTIF") || other.badge.startsWith("CHAPITRE")
      );
      if (nextHasObjectives && !s.badge.startsWith("OBJECTIF") && !s.badge.startsWith("CHAPITRE")) {
        return false;
      }
    }
    return s.blocks.length > 0 || s.title;
  });

  // Nettoie aussi l'intérieur des blocs de chaque section valide
  validSections.forEach((s) => {
    s.blocks = s.blocks.filter((b) => {
      if (b.type === "callout" && /Synthèse\s*Médicale|Objectifs?\s*du\s*cours/i.test(b.calloutLabel || "")) {
        return false;
      }
      return true;
    });
  });

  // Réindexation rigoureuse 1..N
  validSections.forEach((s, i) => {
    s.index = i + 1;
    if (s.badge.startsWith("SECTION")) {
      s.badge = `SECTION ${String(i + 1).padStart(2, "0")}`;
    }
  });

  return validSections.length > 0
    ? validSections
    : [
        {
          index: 1,
          badge: "SECTION 01",
          title: "Synthèse du cours",
          blocks: [
            {
              type: "paragraph",
              spans: [{ text: sanitizePdfText(rawContent) }],
            },
          ],
        },
      ];
}

export const MedicalDocumentPDF: React.FC<MedicalDocumentProps> = ({
  title,
  content,
  subject = "Médecine & Sciences Cliniques",
  date,
  type = "Monographie de Synthèse",
  resolutionLabel = "Calibrage Standard",
  architectureLabel = "Édition Structurée",
  authorName = "Cabinet d'Édition DawJang",
  facultyName = "Faculté de Médecine • Cursus Hospitalo-Universitaire",
  theme = "dawjang",
  fontMode = "serif",
  includeToc = true,
  includeRevisionBox = true,
  referenceCode,
}) => {
  const palette = PDF_THEMES[theme] || PDF_THEMES.dawjang;
  const sections = parseMedicalDocumentToSections(content);

  const bodyFont = fontMode === "serif" ? "Times-Roman" : "Helvetica";
  const bodyBold = fontMode === "serif" ? "Times-Bold" : "Helvetica-Bold";
  const bodyItalic = fontMode === "serif" ? "Times-Italic" : "Helvetica-Oblique";

  const formattedDate =
    date ||
    new Date().toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  const cleanDocTitle = sanitizePdfText(title || "Fiche de Synthèse Médicale");
  const cleanSubject = sanitizePdfText(subject);
  const cleanType = sanitizePdfText(type);
  const cleanResolution = sanitizePdfText(resolutionLabel);
  const cleanArchitecture = sanitizePdfText(architectureLabel);
  const cleanAuthor = sanitizePdfText(authorName);
  const cleanFaculty = sanitizePdfText(facultyName);

  const plainWords = sanitizePdfText(content.replace(/<[^>]+>/g, " "))
    .split(/\s+/)
    .filter(Boolean).length;
  const readingMinutes = Math.max(2, Math.round(plainWords / 190));

  const refCode =
    referenceCode ||
    `DWJ-${new Date().getFullYear()}-${String((cleanDocTitle.length * 37 + sections.length * 13) % 9000 + 1000)}`;

  const styles = StyleSheet.create({
    page: {
      paddingTop: 40,
      paddingBottom: 40,
      paddingHorizontal: 38,
      backgroundColor: "#FFFFFF",
      fontFamily: bodyFont,
      color: palette.textMain,
    },
    // EN-TÊTE COURANT (Répété sur chaque page)
    runningHeader: {
      position: "absolute",
      top: 15,
      left: 38,
      right: 38,
      paddingBottom: 5,
      borderBottomWidth: 0.8,
      borderBottomColor: palette.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    runningHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    runningHeaderBrand: {
      fontFamily: "Helvetica-Bold",
      fontSize: 7.5,
      color: palette.primary,
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    runningHeaderDot: {
      fontFamily: "Helvetica",
      fontSize: 7.5,
      color: palette.accent,
      marginHorizontal: 5,
    },
    runningHeaderSubject: {
      fontFamily: "Helvetica-Bold",
      fontSize: 7.5,
      color: palette.accent,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    runningHeaderRight: {
      fontFamily: "Courier",
      fontSize: 7.5,
      color: palette.textMuted,
    },

    // CARTOUCHE D'ÉDITION MAGISTRALE (Page 1)
    mastheadCard: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      borderRadius: 4,
      marginBottom: 16,
      overflow: "hidden",
    },
    mastheadTopRule: {
      height: 4,
      backgroundColor: palette.primary,
    },
    mastheadAccentRule: {
      height: 2,
      backgroundColor: palette.accent,
    },
    mastheadInner: {
      paddingTop: 14,
      paddingBottom: 14,
      paddingHorizontal: 18,
    },
    mastheadSuperRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    mastheadPill: {
      backgroundColor: palette.accent,
      paddingVertical: 2.5,
      paddingHorizontal: 7,
      borderRadius: 2,
    },
    mastheadPillText: {
      fontFamily: "Helvetica-Bold",
      fontSize: 7.5,
      color: "#FFFFFF",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    mastheadArchiveCode: {
      fontFamily: "Courier-Bold",
      fontSize: 8,
      color: palette.primary,
      letterSpacing: 0.6,
    },
    documentTitle: {
      fontFamily: "Times-Bold",
      fontSize: 21,
      color: palette.primary,
      lineHeight: 1.22,
      marginBottom: 5,
    },
    documentSubtitle: {
      fontFamily: "Helvetica",
      fontSize: 8.5,
      color: palette.textMuted,
      letterSpacing: 0.4,
      marginBottom: 12,
    },
    metaGrid: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: palette.border,
      paddingTop: 9,
      marginTop: 2,
    },
    metaCell: {
      flex: 1,
      paddingRight: 8,
    },
    metaCellBordered: {
      flex: 1,
      paddingHorizontal: 8,
      borderLeftWidth: 1,
      borderLeftColor: palette.border,
    },
    metaLabel: {
      fontFamily: "Helvetica-Bold",
      fontSize: 6.5,
      color: palette.textMuted,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 2,
    },
    metaValue: {
      fontFamily: "Helvetica-Bold",
      fontSize: 8,
      color: palette.primary,
    },

    // SOMMAIRE EXÉCUTIF (Table synoptique des chapitres/objectifs)
    tocBox: {
      borderWidth: 1,
      borderColor: palette.accentBorder,
      backgroundColor: palette.accentSoft,
      borderRadius: 4,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 18,
    },
    tocHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottomWidth: 0.75,
      borderBottomColor: palette.accentBorder,
      paddingBottom: 5,
      marginBottom: 7,
    },
    tocHeaderTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: 8,
      color: palette.primary,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    tocHeaderCount: {
      fontFamily: "Courier-Bold",
      fontSize: 7.5,
      color: palette.accent,
    },
    tocGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    tocItem: {
      width: "50%",
      flexDirection: "row",
      alignItems: "flex-start",
      paddingRight: 10,
      marginBottom: 4,
    },
    tocIndex: {
      fontFamily: "Courier-Bold",
      fontSize: 8,
      color: palette.accent,
      width: 20,
    },
    tocText: {
      flex: 1,
      fontFamily: "Helvetica",
      fontSize: 8,
      color: palette.primary,
      lineHeight: 1.35,
    },

    // SECTIONS / CHAPITRES (H2)
    sectionContainer: {
      marginBottom: 14,
    },
    sectionHeaderBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.accentSoft,
      borderLeftWidth: 4,
      borderLeftColor: palette.accent,
      borderBottomWidth: 0.75,
      borderBottomColor: palette.accentBorder,
      paddingVertical: 7,
      paddingHorizontal: 11,
      marginTop: 10,
      marginBottom: 9,
    },
    sectionBadgePill: {
      backgroundColor: palette.primary,
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 2,
      marginRight: 8,
    },
    sectionBadgeText: {
      fontFamily: "Courier-Bold",
      fontSize: 7.5,
      color: "#FFFFFF",
      letterSpacing: 0.8,
    },
    sectionTitleText: {
      flex: 1,
      fontFamily: "Times-Bold",
      fontSize: 13.5,
      color: palette.primary,
      lineHeight: 1.25,
    },

    // SOUS-TITRES CLINIQUES (H3)
    h3Row: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      marginBottom: 5,
      paddingBottom: 2.5,
      borderBottomWidth: 0.5,
      borderBottomColor: palette.border,
    },
    h3Marker: {
      width: 5,
      height: 5,
      backgroundColor: palette.accent,
      marginRight: 6,
    },
    h3Text: {
      fontFamily: "Helvetica-Bold",
      fontSize: 10,
      color: palette.accent,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },

    // PARAGRAPHES & ENCADRÉS
    paragraph: {
      fontFamily: bodyFont,
      fontSize: 10.2,
      color: palette.textMain,
      lineHeight: 1.56,
      marginBottom: 6.5,
      textAlign: "justify",
    },
    calloutBox: {
      borderLeftWidth: 3,
      borderLeftColor: palette.accent,
      backgroundColor: palette.surface,
      borderTopWidth: 0.5,
      borderRightWidth: 0.5,
      borderBottomWidth: 0.5,
      borderTopColor: palette.border,
      borderRightColor: palette.border,
      borderBottomColor: palette.border,
      borderRadius: 2,
      paddingVertical: 7,
      paddingHorizontal: 10,
      marginVertical: 6,
    },
    calloutLabel: {
      fontFamily: "Helvetica-Bold",
      fontSize: 7.5,
      color: palette.accent,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 3,
    },
    calloutText: {
      fontFamily: bodyFont,
      fontSize: 9.8,
      color: palette.primary,
      lineHeight: 1.5,
      textAlign: "justify",
    },

    // LISTES À PUCES & NUMÉROTÉES
    listContainer: {
      marginTop: 2,
      marginBottom: 7,
      paddingLeft: 4,
    },
    listItemRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 4.5,
    },
    bulletBox: {
      width: 14,
      paddingTop: 1.5,
      alignItems: "center",
    },
    bulletDot: {
      width: 4,
      height: 4,
      backgroundColor: palette.accent,
      borderRadius: 1,
      marginTop: 3.5,
    },
    orderedNumber: {
      width: 18,
      fontFamily: "Courier-Bold",
      fontSize: 9,
      color: palette.accent,
      paddingTop: 0.5,
    },
    listItemText: {
      flex: 1,
      fontFamily: bodyFont,
      fontSize: 10,
      color: palette.textMain,
      lineHeight: 1.52,
      textAlign: "justify",
    },

    // STYLES INLINE
    spanBold: {
      fontFamily: bodyBold,
      color: palette.primary,
    },
    spanItalic: {
      fontFamily: bodyItalic,
    },
    spanUnderline: {
      textDecoration: "underline",
    },
    spanHighlight: {
      backgroundColor: palette.highlightBg,
      fontFamily: bodyBold,
      color: palette.primary,
    },

    // CARTOUCHE DE FIN DE DOCUMENT (Visa de révision & Notes)
    revisionBox: {
      marginTop: 18,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      borderRadius: 4,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    revisionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottomWidth: 0.75,
      borderBottomColor: palette.border,
      paddingBottom: 6,
      marginBottom: 8,
    },
    revisionTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: 8,
      color: palette.primary,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    revisionCheckRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    revisionCheckItem: {
      flexDirection: "row",
      alignItems: "center",
    },
    checkSquare: {
      width: 8,
      height: 8,
      borderWidth: 1,
      borderColor: palette.primary,
      marginRight: 5,
    },
    checkLabel: {
      fontFamily: "Helvetica",
      fontSize: 8,
      color: palette.textMain,
    },
    notesLine: {
      borderBottomWidth: 0.5,
      borderBottomColor: palette.border,
      height: 15,
      marginBottom: 3,
    },

    // PIED DE PAGE COURANT (Répété sur chaque page)
    runningFooter: {
      position: "absolute",
      bottom: 15,
      left: 38,
      right: 38,
      borderTopWidth: 0.8,
      borderTopColor: palette.border,
      paddingTop: 5,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    footerLeft: {
      fontFamily: "Helvetica",
      fontSize: 7.5,
      color: palette.textMuted,
    },
    footerCenter: {
      fontFamily: "Courier",
      fontSize: 7.5,
      color: palette.textMuted,
    },
    folioPill: {
      backgroundColor: palette.primary,
      paddingVertical: 2,
      paddingHorizontal: 7,
      borderRadius: 2,
    },
    folioText: {
      fontFamily: "Courier-Bold",
      fontSize: 7.5,
      color: "#FFFFFF",
      letterSpacing: 0.8,
    },
  });

  const renderSpans = (spans?: PdfInlineSpan[]) => {
    if (!spans || spans.length === 0) return null;
    return spans.map((sp, idx) => {
      const styleList: any[] = [];
      if (sp.bold) styleList.push(styles.spanBold);
      if (sp.italic) styleList.push(styles.spanItalic);
      if (sp.underline) styleList.push(styles.spanUnderline);
      if (sp.highlight) styleList.push(styles.spanHighlight);
      return (
        <Text key={idx} style={styleList.length > 0 ? styleList : undefined}>
          {sp.text}
        </Text>
      );
    });
  };

  return (
    <Document
      author={cleanAuthor}
      title={cleanDocTitle}
      subject={cleanSubject}
      creator="DawJang Studio — Presses Médicales & Académiques"
    >
      <Page size="A4" style={styles.page}>
        {/* EN-TÊTE COURANT SUR TOUTES LES PAGES */}
        <View style={styles.runningHeader} fixed>
          <View style={styles.runningHeaderLeft}>
            <Text style={styles.runningHeaderBrand}>DAWJANG PRESS</Text>
            <Text style={styles.runningHeaderDot}>•</Text>
            <Text style={styles.runningHeaderSubject}>{cleanSubject}</Text>
          </View>
          <Text style={styles.runningHeaderRight}>
            {cleanDocTitle.length > 48
              ? `${cleanDocTitle.slice(0, 48)}...`
              : cleanDocTitle}
          </Text>
        </View>

        {/* CARTOUCHE D'ÉDITION MAGISTRALE (Page 1) */}
        <View style={styles.mastheadCard}>
          <View style={styles.mastheadTopRule} />
          <View style={styles.mastheadAccentRule} />
          <View style={styles.mastheadInner}>
            <View style={styles.mastheadSuperRow}>
              <View style={styles.mastheadPill}>
                <Text style={styles.mastheadPillText}>
                  {cleanType} • {cleanSubject}
                </Text>
              </View>
              <Text style={styles.mastheadArchiveCode}>RÉF. {refCode}</Text>
            </View>

            <Text style={styles.documentTitle}>{cleanDocTitle}</Text>
            <Text style={styles.documentSubtitle}>
              {cleanFaculty} • Édition structurée haute lisibilité ({sections.length}{" "}
              {sections.length > 1 ? "sections" : "section"} • ~{readingMinutes} min de lecture)
            </Text>

            <View style={styles.metaGrid}>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>DISCIPLINE</Text>
                <Text style={styles.metaValue}>{cleanSubject}</Text>
              </View>
              <View style={styles.metaCellBordered}>
                <Text style={styles.metaLabel}>ARCHITECTURE</Text>
                <Text style={styles.metaValue}>{cleanArchitecture}</Text>
              </View>
              <View style={styles.metaCellBordered}>
                <Text style={styles.metaLabel}>CALIBRAGE</Text>
                <Text style={styles.metaValue}>{cleanResolution}</Text>
              </View>
              <View style={styles.metaCellBordered}>
                <Text style={styles.metaLabel}>ÉDITION & DATE</Text>
                <Text style={styles.metaValue}>{formattedDate}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* SOMMAIRE EXÉCUTIF (Table synoptique des sections) */}
        {includeToc && sections.length >= 2 && (
          <View style={styles.tocBox}>
            <View style={styles.tocHeaderRow} wrap={false}>
              <Text style={styles.tocHeaderTitle}>
                SOMMAIRE EXÉCUTIF & PLAN DIRECTEUR DU COURS
              </Text>
              <Text style={styles.tocHeaderCount}>
                {String(sections.length).padStart(2, "0")} SECTIONS
              </Text>
            </View>
            <View style={styles.tocGrid}>
              {sections.map((sec) => (
                <View key={sec.index} style={styles.tocItem} wrap={false}>
                  <Text style={styles.tocIndex}>
                    {String(sec.index).padStart(2, "0")}.
                  </Text>
                  <Text style={styles.tocText}>{sec.title}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* CORPS DU DOCUMENT : SECTIONS & BLOCS TYPOGRAPHIQUES */}
        {sections.map((section) => (
          <View key={section.index} style={styles.sectionContainer} wrap>
            <View style={styles.sectionHeaderBox} wrap={false} minPresenceAhead={38}>
              <View style={styles.sectionBadgePill}>
                <Text style={styles.sectionBadgeText}>{section.badge}</Text>
              </View>
              <Text style={styles.sectionTitleText}>{section.title}</Text>
            </View>

            {section.blocks.map((block, bIdx) => {
              if (block.type === "h3") {
                return (
                  <View
                    key={bIdx}
                    style={styles.h3Row}
                    wrap={false}
                    minPresenceAhead={26}
                  >
                    <View style={styles.h3Marker} />
                    <Text style={styles.h3Text}>{block.title}</Text>
                  </View>
                );
              }

              if (block.type === "callout") {
                return (
                  <View key={bIdx} style={styles.calloutBox} wrap>
                    <Text style={styles.calloutLabel} minPresenceAhead={22}>
                      {block.calloutLabel || "POINT CLINIQUE ESSENTIEL"}
                    </Text>
                    <Text style={styles.calloutText}>
                      {renderSpans(block.spans)}
                    </Text>
                  </View>
                );
              }

              if (block.type === "bullet_list" || block.type === "ordered_list") {
                return (
                  <View key={bIdx} style={styles.listContainer} wrap>
                    {(block.items || []).map((itemSpans, itemIdx) => (
                      <View
                        key={itemIdx}
                        style={styles.listItemRow}
                        wrap
                      >
                        {block.type === "ordered_list" ? (
                          <Text style={styles.orderedNumber}>
                            {String(itemIdx + 1).padStart(2, "0")}.
                          </Text>
                        ) : (
                          <View style={styles.bulletBox}>
                            <View style={styles.bulletDot} />
                          </View>
                        )}
                        <Text style={styles.listItemText}>
                          {renderSpans(itemSpans)}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              }

              return (
                <Text key={bIdx} style={styles.paragraph}>
                  {renderSpans(block.spans)}
                </Text>
              );
            })}
          </View>
        ))}

        {/* CARTOUCHE FINAL DE VALIDATION & NOTES D'ÉTUDE */}
        {includeRevisionBox && (
          <View style={styles.revisionBox} wrap={false}>
            <View style={styles.revisionHeaderRow}>
              <Text style={styles.revisionTitle}>
                VISA DE RÉVISION & ANNOTATIONS PERSONNELLES
              </Text>
              <Text style={styles.runningHeaderRight}>
                TITULAIRE : {cleanAuthor.toUpperCase()}
              </Text>
            </View>
            <View style={styles.revisionCheckRow}>
              <View style={styles.revisionCheckItem}>
                <View style={styles.checkSquare} />
                <Text style={styles.checkLabel}>
                  1re Lecture (Compréhension globale)
                </Text>
              </View>
              <View style={styles.revisionCheckItem}>
                <View style={styles.checkSquare} />
                <Text style={styles.checkLabel}>
                  2e Lecture (Ancrage des seuils & définitions)
                </Text>
              </View>
              <View style={styles.revisionCheckItem}>
                <View style={styles.checkSquare} />
                <Text style={styles.checkLabel}>
                  3e Lecture (Validation pré-examen & QCM)
                </Text>
              </View>
            </View>
            <View style={styles.notesLine} />
            <View style={styles.notesLine} />
          </View>
        )}

        {/* PIED DE PAGE COURANT SUR TOUTES LES PAGES */}
        <View style={styles.runningFooter} fixed>
          <Text style={styles.footerLeft}>
            DawJang Studio • Édition Académique & Médicale Haute Précision
          </Text>
          <Text style={styles.footerCenter}>{refCode}</Text>
          <View style={styles.folioPill}>
            <Text
              style={styles.folioText}
              render={({ pageNumber, totalPages }) =>
                `FOLIO ${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`
              }
            />
          </View>
        </View>
      </Page>
    </Document>
  );
};
