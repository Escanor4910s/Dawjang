import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
} from "lucide-react";
import { sanitizeAndFormatForDawJang } from "@/lib/coPilotSummaryEngine";

export interface ObjectivesRendererProps {
  markdown: string;
  className?: string;
}

function slugifyHeading(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export interface ExtractedSyntheseMeta {
  kicker?: string;
  title?: string;
  subtitle?: string;
  cleanedMarkdown: string;
}

/**
 * Extrait les métadonnées d'en-tête (@SYNTHESE_META_...) et normalise le Markdown
 * pour le rendu « Synthèse Unifiée » (Parties I à IV, Sous-parties, ★ Probabilité,
 * Puces • et ◦, Encadrés Pièges Roses #FEF2F2 et Étapes Émeraude #F0FDF4).
 */
export function extractAndNormalizeSyntheseMarkdown(raw: string): ExtractedSyntheseMeta {
  if (!raw) return { cleanedMarkdown: "" };

  const normalizedWithMeta = normalizeArgonAndObjectivesMarkdown(raw);
  const rawLines = normalizedWithMeta.split("\n");
  let kicker: string | undefined;
  let title: string | undefined;
  let subtitle: string | undefined;
  const bodyLines: string[] = [];

  for (const line of rawLines) {
    const t = line.trim();
    if (t.startsWith("@SYNTHESE_META_KICKER:")) {
      kicker = t.replace("@SYNTHESE_META_KICKER:", "").trim();
      continue;
    }
    if (t.startsWith("@SYNTHESE_META_TITLE:")) {
      title = t.replace("@SYNTHESE_META_TITLE:", "").trim();
      continue;
    }
    if (t.startsWith("@SYNTHESE_META_SUBTITLE:")) {
      subtitle = t.replace("@SYNTHESE_META_SUBTITLE:", "").trim();
      continue;
    }
    // Pour ReactMarkdown uniquement, convertir `  ◦ ` en `- ◦ ` afin que `li` le détecte comme sous-puce de niveau 2
    if (/^\s*◦\s+/.test(line)) {
      bodyLines.push(`- ◦ ${t.replace(/^◦\s+/, "")}`);
      continue;
    }
    bodyLines.push(line);
  }

  return { kicker, title, subtitle, cleanedMarkdown: bodyLines.join("\n").trim() };
}

/**
 * Normalise à la fois la syntaxe Markdown classique et la syntaxe chirurgicale Argon / Synthèse Unifiée.
 * Ne génère JAMAIS de balise `[SUB]` : les sous-puces de niveau 2 sont conservées sous la forme propre `  ◦ `.
 */
export function normalizeArgonAndObjectivesMarkdown(raw: string): string {
  if (!raw) return "";

  // Extraire temporairement les métadonnées @SYNTHESE_META_ pour qu'elles soient toujours préservées en tête
  const inputLines = raw.split("\n");
  const metaHeaderLines: string[] = [];
  const contentInputLines: string[] = [];
  for (const l of inputLines) {
    if (l.trim().startsWith("@SYNTHESE_META_")) {
      metaHeaderLines.push(l.trim());
    } else {
      contentInputLines.push(l);
    }
  }

  let cleaned = sanitizeAndFormatForDawJang(contentInputLines.join("\n"));

  const lines = cleaned.split("\n");
  const normalizedLines: string[] = [...metaHeaderLines];
  if (metaHeaderLines.length > 0) {
    normalizedLines.push("");
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    if (trimmed.startsWith("@SYNTHESE_META_")) {
      continue;
    }

    // Ignorer les puces orphelines d'une à deux lettres (ex: "- É", "• A") et les placeholders vides
    if (/^[-•*◦→✓]\s*(?:\*{1,2})?[A-Za-zÀ-ÿ]{1,2}[.,;:]?(?:\*{1,2})?$/.test(trimmed)) {
      continue;
    }
    if (
      lower.includes("précisez ici la corrélation sémiologique ou physiopathologique essentielle") ||
      lower.includes("énoncez ici le réflexe clinique, le seuil biologique ou la règle d'examen incontournable") ||
      lower.includes("décrivez le distracteur classique du professeur et la parade")
    ) {
      continue;
    }

    // === PARTIE I..IV ... === ou === VOLET 1..2 ... ===
    const partieMatch = trimmed.match(
      /^===\s*((?:PARTIE\s*(?:I{1,3}V?|[1-4])|VOLET\s*[12]).*?)\s*===$/i
    );
    if (partieMatch) {
      normalizedLines.push("");
      normalizedLines.push(`# ${partieMatch[1].trim()}`);
      normalizedLines.push("");
      continue;
    }

    // === OBJECTIF X ... === ou === SOUS-PARTIE X ... ===
    const bannerMatch = trimmed.match(/^===\s*(.+?)\s*===$/);
    if (bannerMatch) {
      normalizedLines.push("");
      normalizedLines.push(`## ${bannerMatch[1].trim()}`);
      normalizedLines.push("");
      continue;
    }

    // -- Sous-titre --
    const subMatch = trimmed.match(/^--\s*(.+?)\s*--$/);
    if (subMatch) {
      normalizedLines.push("");
      normalizedLines.push(`### ${subMatch[1].trim()}`);
      normalizedLines.push("");
      continue;
    }

    // Convertir les blocs [ AVERTISSEMENT / PIÈGE ... ], [ ÉTAPE ... ], [ RAPPEL CLINIQUE ... ], [ RÈGLE D'OR ... ] en blockquotes structurés
    if (
      trimmed.startsWith("[") &&
      trimmed.endsWith("]") &&
      /^(?:AVERTISSEMENT|PI[ÈE]GE|[ÉE]TAPE|RAPPEL\s+CLINIQUE|RAPPEL\s+S[ÉE]MIOLOGIQUE|RAPPEL\s+PHYSIOPATHOLOGIQUE|NOTE\s+CLINIQUE|R[ÈE]GLE\s+D['’]OR|CONSEIL\s+STRAT[ÉE]GIQUE)/i.test(
        trimmed.slice(1, -1).trim()
      )
    ) {
      const boxInner = trimmed.slice(1, -1).trim();
      const isStepOrRule = /^[ÉE]TAPE|^R[ÈE]GLE\s+D['’]OR|^CONSEIL\s+STRAT[ÉE]GIQUE/i.test(boxInner);
      const isRappel = /^(?:RAPPEL|NOTE)\s+/i.test(boxInner);

      normalizedLines.push("");
      if (isRappel && boxInner.includes(":")) {
        const colonIdx = boxInner.indexOf(":");
        const headerPart = boxInner.slice(0, colonIdx).trim();
        const bodyPart = boxInner.slice(colonIdx + 1).trim();
        normalizedLines.push(`> **[PIÈGE] ${headerPart} :**`);
        if (bodyPart) {
          normalizedLines.push(`> ${bodyPart}`);
        }
      } else if (isStepOrRule && /^R[ÈE]GLE|^CONSEIL/i.test(boxInner) && boxInner.includes(":")) {
        const colonIdx = boxInner.indexOf(":");
        const headerPart = boxInner.slice(0, colonIdx).trim();
        const bodyPart = boxInner.slice(colonIdx + 1).trim();
        normalizedLines.push(`> **[ÉTAPE] ${headerPart} :**`);
        if (bodyPart) {
          normalizedLines.push(`> ${bodyPart}`);
        }
      } else {
        const cleanBoxHeader = boxInner
          .replace(/^(?:PI[ÈE]GE|AVERTISSEMENT)\s*(\d+)\s*[:—\-]\s*/i, "$1. Piège — ")
          .replace(/^(?:PI[ÈE]GE|AVERTISSEMENT)\s*[:—\-]\s*/i, "Piège à éviter — ");
        normalizedLines.push(
          `> **[${isStepOrRule ? "ÉTAPE" : "PIÈGE"}] ${cleanBoxHeader}**`
        );
      }

      while (i + 1 < lines.length) {
        const nextTrim = lines[i + 1].trim();
        if (
          !nextTrim ||
          nextTrim.startsWith("[") ||
          nextTrim.startsWith("#") ||
          nextTrim.startsWith("===") ||
          nextTrim.startsWith("|") ||
          nextTrim.startsWith("★")
        ) {
          break;
        }
        normalizedLines.push(
          `> ${nextTrim.replace(/\[SUB\]\s*/g, "").replace(/^[•\-*◦]\s+/, "• ")}`
        );
        i++;
      }
      normalizedLines.push("");
      continue;
    }

    // Sous-puces de niveau 2 : ◦ ... ou [SUB] ... ou indentées de >= 2 espaces
    const leadingSpaces = (line.match(/^(\s*)/)?.[1] || "").length;
    if (
      /^[-•*]?\s*\[SUB\]\s*/i.test(trimmed) ||
      /^[-•*]?\s*◦\s+/.test(trimmed) ||
      (leadingSpaces >= 2 && /^[-•*◦]\s+/.test(trimmed))
    ) {
      const subContent = trimmed
        .replace(/^[-•*◦]?\s*\[SUB\]\s*/i, "")
        .replace(/^[-•*◦]\s+/, "");
      normalizedLines.push(`  ◦ ${subContent}`);
      continue;
    }

    // Puces de niveau 1 : • , ✓ , ✔ , → , ➔ en début de ligne
    if (/^•\s+/.test(trimmed)) {
      normalizedLines.push(`- ${trimmed.replace(/^•\s+/, "")}`);
      continue;
    }
    if (/^[✓✔]\s+/.test(trimmed)) {
      normalizedLines.push(`- ✓ ${trimmed.replace(/^[✓✔]\s+/, "")}`);
      continue;
    }
    if (/^[→➔]\s+/.test(trimmed)) {
      normalizedLines.push(`- → ${trimmed.replace(/^[→➔]\s+/, "")}`);
      continue;
    }

    normalizedLines.push(line.replace(/\[SUB\]\s*/g, ""));
  }

  cleaned = normalizedLines.join("\n");

  return cleaned
    .replace(/([^\s*])\*{2,}(?=\s*(\n|$))/g, "$1")
    .replace(/\*{2,}(?=\s*(\n|$))/g, "")
    .trim();
}

/**
 * Transforme les séquences ==texte surligné== en éléments <mark> visuels
 */
function renderInlineHighlights(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    if (!child.includes("==")) return child;

    const parts = child.split(/(==[^=\n]+==)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("==") && part.endsWith("==") && part.length > 4) {
        const inner = part.slice(2, -2);
        return (
          <mark
            key={idx}
            className="bg-amber-200/85 dark:bg-amber-500/30 text-amber-950 dark:text-amber-100 px-1.5 py-0.5 rounded-sm font-semibold"
          >
            {inner}
          </mark>
        );
      }
      return part;
    });
  });
}

/**
 * Rendu Haute Fidélité « SYNTHÈSE UNIFIÉE » (Protocole Argon 4 Parties) :
 * - En-tête académique : Kicker Bleu Royal (#1D4ED8), Titre Noir (#0F172A), Sous-titre Gris Ardoise (#475569) + Filet sombre
 * - Bannières PARTIE I, II, III, IV en Bleu-Ardoise Foncé (#1E2530) pleine largeur, texte blanc gras majuscule
 * - Sous-titres (1.1, 1.2, Sous-partie K, 3.1, 3.2) en Bleu Marine (#1E3A8A) gras avec filet inférieur subtil
 * - Ligne ★ Probabilité de sortie en Rouge Cramoisi (#991B1B) gras
 * - Tableaux Markdown avec en-tête Bleu Marine (#1E3A8A) et bordures ardoise
 * - Puces hiérarchiques : niveau 1 (• plein) et niveau 2 (◦ cercle creux indenté)
 * - Encadrés Roses/Rouges (#FEF2F2 + barre #B91C1C) pour les 5 Pièges Majeurs (Partie III)
 * - Encadrés Verts Émeraude (#F0FDF4 + barre #047857) pour les 5 Étapes Opérationnelles (Partie IV)
 */
export const ObjectivesRenderer: React.FC<ObjectivesRendererProps> = ({
  markdown,
  className = "",
}) => {
  const { kicker, title, subtitle, cleanedMarkdown } = React.useMemo(
    () => extractAndNormalizeSyntheseMarkdown(markdown),
    [markdown]
  );

  const components = {
    h1: ({ node, ...props }: any) => {
      const rawText = String(
        React.Children.toArray(props.children)
          .map((c: any) => (typeof c === "string" ? c : c?.props?.children || ""))
          .join(" ")
      ).trim();

      // Bannières PARTIE I, PARTIE II, PARTIE III, PARTIE IV ou VOLET 1 / 2
      if (/^(?:PARTIE\s*(?:I{1,3}V?|[1-4])|VOLET\s*[12])\b/i.test(rawText)) {
        return (
          <div className="my-7 bg-[#1E2530] text-white px-4 py-2.5 rounded-xs shadow-2xs">
            <h1 className="text-[13.5px] sm:text-[14.5px] font-sans font-extrabold uppercase tracking-[0.03em] text-white leading-snug m-0">
              {rawText}
            </h1>
          </div>
        );
      }

      return (
        <h1
          className="text-xl sm:text-2xl font-sans font-extrabold text-[#0F172A] dark:text-zinc-100 border-b-2 border-[#1E293B] pb-3 mb-5 tracking-tight"
          {...props}
        />
      );
    },

    h2: ({ node, ...props }: any) => {
      const rawText = String(
        React.Children.toArray(props.children)
          .map((c: any) => (typeof c === "string" ? c : c?.props?.children || ""))
          .join(" ")
      ).trim();
      const headingId = `sec-${slugifyHeading(rawText)}`;

      return (
        <h2
          id={headingId}
          className="scroll-mt-24 text-[16.5px] sm:text-[18px] font-sans font-bold text-[#1E3A8A] dark:text-blue-300 border-b border-slate-200 dark:border-zinc-800 pb-1.5 mt-7 mb-2.5 tracking-tight leading-snug"
          {...props}
        />
      );
    },

    h3: ({ node, ...props }: any) => (
      <h3
        className="text-[15px] sm:text-[16px] font-sans font-bold text-[#1E3A8A] dark:text-blue-300 mt-5 mb-2 tracking-tight"
        {...props}
      />
    ),

    p: ({ node, ...props }: any) => {
      const rawText = String(
        React.Children.toArray(props.children)
          .map((c: any) => (typeof c === "string" ? c : c?.props?.children || ""))
          .join(" ")
      ).trim();

      // Ligne Étoile Cramoisi : ★ Probabilité de sortie : ...
      if (
        rawText.startsWith("★") ||
        /^[*•-]?\s*Probabilit[ée]\s+de\s+sortie\s*:/i.test(rawText)
      ) {
        return (
          <p className="text-[13px] sm:text-[13.5px] font-sans font-bold text-[#991B1B] dark:text-rose-400 mt-0.5 mb-3 leading-snug">
            {rawText.startsWith("★") ? rawText : `★ ${rawText}`}
          </p>
        );
      }

      // Cartouche [ RAPPEL CLINIQUE ]
      if (
        /^\[?\s*(?:RAPPEL\s+CLINIQUE|RAPPEL\s+S[ÉE]MIOLOGIQUE|RAPPEL\s+PHYSIOPATHOLOGIQUE|NOTE\s+CLINIQUE)\b/i.test(
          rawText
        )
      ) {
        return (
          <div className="bg-[#FEF2F2] dark:bg-rose-950/35 border border-[#F8B4B4] dark:border-rose-800/70 border-l-[4px] border-l-[#B91C1C] rounded-xs p-3.5 my-3.5 text-[#0F172A] dark:text-rose-100 flex items-start gap-2.5">
            <Stethoscope className="w-4 h-4 text-[#B91C1C] shrink-0 mt-1" />
            <div className="flex-1 text-[14px] leading-relaxed">
              {renderInlineHighlights(props.children)}
            </div>
          </div>
        );
      }

      // Cartouche [ RÈGLE D'OR ]
      if (
        /^\[?\s*(?:CONSEIL STRAT[ÉE]GIQUE|R[ÈE]GLE D'OR|RENDEMENT\s*EXAMEN)/i.test(rawText)
      ) {
        return (
          <div className="bg-[#F0FDF4] dark:bg-emerald-950/35 border border-[#A7F3D0] dark:border-emerald-700/70 border-l-[4px] border-l-[#047857] rounded-xs p-3.5 my-3.5 text-[#0F172A] dark:text-emerald-100 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0 mt-1" />
            <div className="flex-1 text-[14px] leading-relaxed font-medium">
              {renderInlineHighlights(props.children)}
            </div>
          </div>
        );
      }

      return (
        <p className="mb-2.5 text-[#0F172A] dark:text-zinc-200 leading-[1.68] text-[14px] sm:text-[14.5px]">
          {renderInlineHighlights(props.children)}
        </p>
      );
    },

    ul: ({ node, ...props }: any) => (
      <ul
        className="list-none ml-0.5 mb-3.5 space-y-1.5 text-[14px] sm:text-[14.5px]"
        {...props}
      />
    ),

    ol: ({ node, ...props }: any) => (
      <ol
        className="list-decimal list-outside ml-6 mb-3.5 space-y-1.5 text-[14px] sm:text-[14.5px] text-[#0F172A] dark:text-zinc-200 marker:font-bold marker:text-[#0F172A]"
        {...props}
      />
    ),

    li: ({ node, ...props }: any) => {
      const childArray = React.Children.toArray(props.children);
      const rawContent = String(
        childArray
          .map((c: any) => (typeof c === "string" ? c : c?.props?.children || ""))
          .join(" ")
      );

      const isSubBullet =
        rawContent.trimStart().startsWith("◦") ||
        rawContent.trimStart().startsWith("[SUB]");

      // Nettoyer le préfixe ◦ ou [SUB] dans le premier noeud texte
      const cleanedChildren = isSubBullet
        ? childArray.map((child, idx) => {
            if (idx === 0 && typeof child === "string") {
              return child.replace(/^\s*(?:◦|\[SUB\])\s*/, "");
            }
            return child;
          })
        : props.children;

      if (isSubBullet) {
        return (
          <li className="flex items-start leading-[1.65] text-[#0F172A] dark:text-zinc-200 pl-7 py-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full border border-[#334155] dark:border-zinc-400 bg-transparent mr-2.5 mt-2 shrink-0" />
            <div className="flex-1 min-w-0">
              {renderInlineHighlights(cleanedChildren)}
            </div>
          </li>
        );
      }

      return (
        <li className="flex items-start leading-[1.65] text-[#0F172A] dark:text-zinc-200 pl-1 py-0.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0F172A] dark:bg-zinc-200 mr-2.5 mt-2 shrink-0" />
          <div className="flex-1 min-w-0">
            {renderInlineHighlights(cleanedChildren)}
          </div>
        </li>
      );
    },

    strong: ({ node, ...props }: any) => (
      <strong
        className="font-bold text-[#0F172A] dark:text-white"
        {...props}
      />
    ),

    table: ({ node, ...props }: any) => (
      <div className="overflow-x-auto my-4 border border-[#CBD5E1] dark:border-zinc-700 rounded-xs bg-white dark:bg-zinc-900">
        <table className="w-full text-[13px] sm:text-[13.5px] text-left border-collapse" {...props} />
      </div>
    ),

    thead: ({ node, ...props }: any) => (
      <thead
        className="bg-[#1E3A8A] text-white border-b border-[#1E3A8A]"
        {...props}
      />
    ),

    th: ({ node, ...props }: any) => (
      <th
        className="px-3.5 py-2.5 font-bold text-white border-r border-white/20 last:border-r-0 text-[12px] text-left align-top leading-snug"
        {...props}
      />
    ),

    tr: ({ node, ...props }: any) => (
      <tr
        className="even:bg-[#F8FAFC] dark:even:bg-zinc-800/30 hover:bg-slate-100/70 dark:hover:bg-zinc-800/60 transition-colors border-b border-[#CBD5E1] dark:border-zinc-800 last:border-b-0"
        {...props}
      />
    ),

    td: ({ node, ...props }: any) => (
      <td
        className="px-3.5 py-2.5 border-r border-[#CBD5E1] dark:border-zinc-800 last:border-r-0 text-[#0F172A] dark:text-zinc-200 align-top leading-snug"
      >
        {renderInlineHighlights(props.children)}
      </td>
    ),

    blockquote: ({ node, ...props }: any) => {
      const extractText = (n: any): string => {
        if (typeof n === "string") return n;
        if (Array.isArray(n)) return n.map(extractText).join(" ");
        if (n?.props?.children) return extractText(n.props.children);
        return "";
      };

      const rawText = extractText(props.children).trim();

      const isStepBox =
        /\[?[ÉE]TAPE\s*\d*\]?/i.test(rawText) ||
        /^[ÉE]TAPE\s*\d+/i.test(rawText) ||
        /R[ÈE]GLE\s+D['’]OR|CONSEIL\s+STRAT[ÉE]GIQUE/i.test(rawText);
      const isTrapBox =
        /\[?(?:PI[ÈE]GE|AVERTISSEMENT)\s*\d*\]?/i.test(rawText) ||
        /^\d+\.\s*Pi[èe]ge/i.test(rawText) ||
        /Pi[èe]ge\s+(?:de|à|d'|du|des|sur)/i.test(rawText) ||
        /RAPPEL\s+CLINIQUE|RAPPEL\s+S[ÉE]MIOLOGIQUE|RAPPEL\s+PHYSIOPATHOLOGIQUE|NOTE\s+CLINIQUE/i.test(
          rawText
        );

      // Nettoyer les marqueurs internes [PIÈGE X] ou [ÉTAPE X] à l'affichage
      const cleanTagInChildren = (nodes: React.ReactNode): React.ReactNode =>
        React.Children.map(nodes, (child) => {
          if (typeof child === "string") {
            return child.replace(/\[(?:PI[ÈE]GE|AVERTISSEMENT|[ÉE]TAPE)\s*\d*\]\s*/gi, "");
          }
          if (React.isValidElement(child) && (child.props as any)?.children) {
            return React.cloneElement(
              child as React.ReactElement<any>,
              {},
              cleanTagInChildren((child.props as any).children)
            );
          }
          return child;
        });

      if (isStepBox) {
        return (
          <div className="bg-[#F0FDF4] dark:bg-emerald-950/30 border border-[#A7F3D0] dark:border-emerald-800/70 border-l-[5px] border-l-[#047857] rounded-xs px-4 py-3.5 my-3.5 text-[13.8px] sm:text-[14.2px] text-[#0F172A] dark:text-zinc-100 leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_p:first-child_strong:first-child]:text-[#065F46] dark:[&_p:first-child_strong:first-child]:text-emerald-300">
            {cleanTagInChildren(props.children)}
          </div>
        );
      }

      if (isTrapBox) {
        return (
          <div className="bg-[#FEF2F2] dark:bg-rose-950/30 border border-[#F8B4B4] dark:border-rose-800/70 border-l-[5px] border-l-[#B91C1C] rounded-xs px-4 py-3.5 my-3.5 text-[13.8px] sm:text-[14.2px] text-[#0F172A] dark:text-zinc-100 leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0">
            {cleanTagInChildren(props.children)}
          </div>
        );
      }

      return (
        <blockquote
          className="border-l-[4px] border-[#1E3A8A] bg-slate-50 dark:bg-zinc-800/40 px-4 py-3 my-3.5 rounded-r-xs text-[14px] text-[#0F172A] dark:text-zinc-200"
          {...props}
        />
      );
    },
  };

  return (
    <div className={`objectives-verbatim-prose font-sans ${className}`}>
      {(kicker || title || subtitle) && (
        <div className="mb-6 pb-3.5 border-b-2 border-[#1E293B] dark:border-zinc-700">
          {kicker && (
            <div className="text-[11.5px] sm:text-[12px] font-bold uppercase tracking-wider text-[#1D4ED8] dark:text-blue-400 mb-1.5">
              {kicker}
            </div>
          )}
          {title && (
            <h1 className="text-[20px] sm:text-[24px] font-extrabold text-[#0F172A] dark:text-white leading-tight mb-1.5">
              {title}
            </h1>
          )}
          {subtitle && (
            <div className="text-[12.5px] sm:text-[13.5px] text-[#475569] dark:text-zinc-400 font-normal">
              {subtitle}
            </div>
          )}
        </div>
      )}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {cleanedMarkdown}
      </ReactMarkdown>
    </div>
  );
};

export default ObjectivesRenderer;
