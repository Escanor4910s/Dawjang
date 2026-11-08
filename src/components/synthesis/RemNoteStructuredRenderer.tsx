// src/components/synthesis/RemNoteStructuredRenderer.tsx
import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Pin,
  RefreshCw,
  Search,
  AlertTriangle,
  Brain,
  Flag,
  MapPin,
  Eye,
  FolderKanban,
  Layers,
} from "lucide-react";

export interface RemNoteStructuredRendererProps {
  markdown: string;
  className?: string;
}

/**
 * Rendu mathématique natif pour les expressions LaTeX ($...$ et $$...$$)
 * Transforme notamment \frac{num}{den} en véritables fractions empilées avec barre horizontale.
 */
export function renderLatexExpression(latexRaw: string, isBlock = false): React.ReactNode {
  const cleanSymbols = (s: string) =>
    s
      .replace(/\\times\b/g, " × ")
      .replace(/\\div\b/g, " ÷ ")
      .replace(/\\pm\b/g, " ± ")
      .replace(/\\le(?:q)?\b/g, " ≤ ")
      .replace(/\\ge(?:q)?\b/g, " ≥ ")
      .replace(/\\ne(?:q)?\b/g, " ≠ ")
      .replace(/\\approx\b/g, " ≈ ")
      .replace(/\\uparrow\b/g, "↑")
      .replace(/\\downarrow\b/g, "↓")
      .replace(/\\rightarrow\b/g, "→")
      .replace(/\\Rightarrow\b/g, "⇒")
      .replace(/\\%/g, "%")
      .replace(/\\,/g, " ")
      .replace(/\\;/g, " ")
      .replace(/\\text\{([^}]*)\}/g, "$1")
      .replace(/\^3\b/g, "³")
      .replace(/\^2\b/g, "²");

  // Découpage des fractions \frac{num}{den}
  const fracRegex = /\\frac\{([^{}]+)\}\{([^{}]+)\}/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fracRegex.exec(latexRaw)) !== null) {
    if (match.index > lastIndex) {
      parts.push(cleanSymbols(latexRaw.slice(lastIndex, match.index)));
    }
    const numerator = cleanSymbols(match[1].trim());
    const denominator = cleanSymbols(match[2].trim());
    parts.push(
      <span
        key={`frac-${match.index}`}
        className="inline-flex flex-col items-center justify-center align-middle mx-1.5 px-1 text-[0.92em] leading-tight"
      >
        <span className="border-b border-[#18181B] dark:border-zinc-200 px-1 pb-0.5 font-semibold">
          {numerator}
        </span>
        <span className="px-1 pt-0.5 font-semibold text-[#52525B] dark:text-zinc-300">
          {denominator}
        </span>
      </span>
    );
    lastIndex = fracRegex.lastIndex;
  }

  if (lastIndex < latexRaw.length) {
    parts.push(cleanSymbols(latexRaw.slice(lastIndex)));
  }

  return (
    <span
      className={
        isBlock
          ? "my-2.5 flex items-center justify-center py-2.5 px-4 rounded-xl bg-[#FAF8F5] dark:bg-zinc-800/80 border border-[#EAE4DC] dark:border-zinc-700 font-serif text-[15px] text-[#18181B] dark:text-zinc-100 shadow-2xs"
          : "inline-flex items-center px-2 py-0.5 mx-0.5 rounded-lg bg-[#FAF8F5] dark:bg-zinc-800 border border-[#EAE4DC] dark:border-zinc-700 font-serif text-[0.96em] text-[#18181B] dark:text-zinc-100"
      }
    >
      {parts}
    </span>
  );
}

/**
 * Parse une ligne de texte contenant du gras (**...**), des formules LaTeX ($$...$$ ou $...$)
 * et des flèches logiques (⇒, →, ↑, ↓).
 */
export function renderRichLineContent(text: string): React.ReactNode {
  if (!text) return null;

  // Tokenize $$...$$, $...$, and **...**
  const tokenRegex = /(\$\$[\s\S]+?\$\$|\$[^$]+?\$|\*\*[^*]+?\*\*)/g;
  const tokens = text.split(tokenRegex);

  return tokens.map((token, idx) => {
    if (!token) return null;
    if (token.startsWith("$$") && token.endsWith("$$")) {
      return (
        <React.Fragment key={idx}>
          {renderLatexExpression(token.slice(2, -2).trim(), true)}
        </React.Fragment>
      );
    }
    if (token.startsWith("$") && token.endsWith("$")) {
      return (
        <React.Fragment key={idx}>
          {renderLatexExpression(token.slice(1, -1).trim(), false)}
        </React.Fragment>
      );
    }
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong
          key={idx}
          className="font-semibold text-[#18181B] dark:text-white bg-[#F5F2EB]/90 dark:bg-zinc-800 px-1 py-0.2 rounded"
        >
          {token.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

interface ParsedSection {
  id: string;
  rawHeading: string;
  cleanTitle: string;
  badgeLabel: string;
  accentColor: string;
  bgTint: string;
  icon: React.ElementType;
  lines: string[];
}

function getSectionMeta(heading: string) {
  const lower = String(heading || "").toLowerCase();
  if (lower.includes("core concepts") || lower.includes("concepts")) {
    return {
      id: "core_concepts",
      badgeLabel: "01 · CORE CONCEPTS",
      accentColor: "border-[#D96B43] text-[#D96B43]",
      bgTint: "bg-[#D96B43]/[0.05]",
      icon: BookOpen,
    };
  }
  if (lower.includes("must remember") || lower.includes("retenir")) {
    return {
      id: "must_remember",
      badgeLabel: "02 · MUST REMEMBER & FORMULES",
      accentColor: "border-[#C87D28] text-[#C87D28]",
      bgTint: "bg-[#C87D28]/[0.06]",
      icon: Pin,
    };
  }
  if (lower.includes("key processes") || lower.includes("processus")) {
    return {
      id: "key_processes",
      badgeLabel: "03 · KEY PROCESSES",
      accentColor: "border-[#2E6F4E] text-[#2E6F4E]",
      bgTint: "bg-[#2E6F4E]/[0.05]",
      icon: RefreshCw,
    };
  }
  if (lower.includes("key comparisons") || lower.includes("comparaisons")) {
    return {
      id: "key_comparisons",
      badgeLabel: "04 · KEY COMPARISONS",
      accentColor: "border-blue-600 text-blue-600",
      bgTint: "bg-blue-500/[0.05]",
      icon: Search,
    };
  }
  if (lower.includes("misunderstandings") || lower.includes("idées reçues")) {
    return {
      id: "common_misunderstandings",
      badgeLabel: "05 · COMMON MISUNDERSTANDINGS",
      accentColor: "border-amber-600 text-amber-600",
      bgTint: "bg-amber-500/[0.06]",
      icon: AlertTriangle,
    };
  }
  if (lower.includes("mental models") || lower.includes("intuition")) {
    return {
      id: "mental_models",
      badgeLabel: "06 · MENTAL MODELS / INTUITION",
      accentColor: "border-emerald-700 text-emerald-700",
      bgTint: "bg-emerald-500/[0.05]",
      icon: Brain,
    };
  }
  if (lower.includes("exceptions") || lower.includes("edge cases")) {
    return {
      id: "exceptions_edge_cases",
      badgeLabel: "07 · EXCEPTIONS & EDGE CASES",
      accentColor: "border-rose-600 text-rose-600",
      bgTint: "bg-rose-500/[0.05]",
      icon: Flag,
    };
  }
  if (lower.includes("when to use") || lower.includes("indications")) {
    return {
      id: "when_to_use_which",
      badgeLabel: "08 · WHEN TO USE WHICH",
      accentColor: "border-[#D96B43] text-[#D96B43]",
      bgTint: "bg-[#D96B43]/[0.05]",
      icon: MapPin,
    };
  }
  if (lower.includes("patterns") || lower.includes("reconnaître")) {
    return {
      id: "patterns_to_recognize",
      badgeLabel: "09 · PATTERNS TO RECOGNIZE",
      accentColor: "border-[#2E6F4E] text-[#2E6F4E]",
      bgTint: "bg-[#2E6F4E]/[0.05]",
      icon: Eye,
    };
  }
  if (lower.includes("exam traps") || lower.includes("pièges")) {
    return {
      id: "exam_traps",
      badgeLabel: "10 · EXAM TRAPS (QCM / EDN)",
      accentColor: "border-red-600 text-red-600",
      bgTint: "bg-red-500/[0.06]",
      icon: FolderKanban,
    };
  }
  return {
    id: `sec-${Math.random().toString(36).slice(2, 7)}`,
    badgeLabel: "SECTION CLINIQUE",
    accentColor: "border-[#D96B43] text-[#D96B43]",
    bgTint: "bg-[#FAF8F5]",
    icon: Layers,
  };
}

export const RemNoteStructuredRenderer: React.FC<RemNoteStructuredRendererProps> = ({
  markdown,
  className = "",
}) => {
  const [selectedSectionId, setSelectedSectionId] = useState<string>("all");

  const sections = useMemo<ParsedSection[]>(() => {
    if (!markdown || !markdown.trim()) return [];
    const rawBlocks = markdown.split(/^##\s+/gm).filter((b) => b.trim().length > 0);

    return rawBlocks.map((block, index) => {
      const allLines = block.split("\n");
      const rawHeading = (allLines[0] || `Section ${index + 1}`).trim();
      const bodyLines = allLines
        .slice(1)
        .filter((l) => l.trim().length > 0);
      const meta = getSectionMeta(rawHeading);

      return {
        id: `${meta.id}-${index}`,
        rawHeading,
        cleanTitle: rawHeading,
        badgeLabel: meta.badgeLabel,
        accentColor: meta.accentColor,
        bgTint: meta.bgTint,
        icon: meta.icon,
        lines: bodyLines,
      };
    });
  }, [markdown]);

  const visibleSections = useMemo(() => {
    if (selectedSectionId === "all") return sections;
    return sections.filter((s) => s.id === selectedSectionId);
  }, [sections, selectedSectionId]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* BARRE DE NAVIGATION PAR SECTION COGNITIVE (10 SECTIONS REMNOTE) */}
      {sections.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#EAE4DC] dark:border-zinc-800 print:hidden no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedSectionId("all")}
            className={`px-3 py-1.5 rounded-xl text-[11.5px] font-semibold transition-all whitespace-nowrap ${
              selectedSectionId === "all"
                ? "bg-[#18181B] text-[#FAF8F5] dark:bg-white dark:text-zinc-900 shadow-2xs"
                : "bg-[#FAF8F5] dark:bg-zinc-800 text-[#52525B] dark:text-zinc-300 border border-[#EAE4DC] dark:border-zinc-700 hover:border-[#D96B43]/50"
            }`}
          >
            Toutes les sections ({sections.length})
          </button>
          {sections.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSelectedSectionId(sec.id)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all whitespace-nowrap ${
                selectedSectionId === sec.id
                  ? "bg-[#D96B43] text-white shadow-2xs"
                  : "bg-white dark:bg-zinc-900 text-[#52525B] dark:text-zinc-400 border border-[#EAE4DC] dark:border-zinc-800 hover:border-[#D96B43]/50"
              }`}
            >
              {sec.cleanTitle}
            </button>
          ))}
        </div>
      )}

      {/* RENDU DES SECTIONS COGNITIVES */}
      <div className="space-y-6">
        {visibleSections.map((sec) => {
          const Icon = sec.icon;
          return (
            <section
              key={sec.id}
              className="rounded-2xl border border-[#EAE4DC] dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-[0_4px_20px_-8px_rgba(24,24,27,0.05)] break-inside-avoid"
            >
              {/* En-tête de la section cognitive */}
              <div
                className={`px-5 py-3.5 border-b border-[#EAE4DC] dark:border-zinc-800 border-l-4 ${sec.accentColor} ${sec.bgTint} flex items-center justify-between gap-3`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  <h2 className="text-[17.5px] sm:text-[19px] font-serif font-semibold text-[#18181B] dark:text-zinc-100 tracking-tight">
                    {sec.cleanTitle}
                  </h2>
                </div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/80 dark:bg-zinc-900/80 border border-[#EAE4DC] dark:border-zinc-700 text-[#71717A] hidden sm:inline-block">
                  {sec.badgeLabel}
                </span>
              </div>

              {/* Corps hiérarchique avec support des sous-puces, étapes numérotées et formules LaTeX */}
              <div className="p-5 sm:p-6 space-y-2.5">
                {sec.lines.map((rawLine, lIdx) => {
                  const isSubBullet =
                    /^\s{2,}[-*•]\s+/.test(rawLine) || /^\t+[-*•]\s+/.test(rawLine);
                  const isOrderedSub = /^\s{2,}(\d+)\.\s+/.exec(rawLine);
                  const cleanLine = rawLine
                    .replace(/^\s*[-*•]\s+/, "")
                    .replace(/^\s*\d+\.\s+/, "")
                    .trim();

                  if (isOrderedSub) {
                    const stepNum = isOrderedSub[1];
                    return (
                      <div
                        key={lIdx}
                        className="ml-5 sm:ml-7 flex items-start gap-2.5 py-1 pl-3 border-l-2 border-[#EAE4DC] dark:border-zinc-700 text-[14px] sm:text-[14.5px] text-[#27272A] dark:text-zinc-200 leading-[1.7]"
                      >
                        <span className="font-mono text-[11.5px] font-bold text-[#D96B43] bg-[#D96B43]/10 px-1.5 py-0.2 rounded shrink-0 mt-0.5">
                          {stepNum}.
                        </span>
                        <div className="flex-1 min-w-0">
                          {renderRichLineContent(cleanLine)}
                        </div>
                      </div>
                    );
                  }

                  if (isSubBullet) {
                    return (
                      <div
                        key={lIdx}
                        className="ml-5 sm:ml-7 flex items-start gap-2.5 py-0.5 pl-3 border-l-2 border-[#EAE4DC]/80 dark:border-zinc-800 text-[13.5px] sm:text-[14px] text-[#3F3F46] dark:text-zinc-300 leading-[1.68]"
                      >
                        <span className="w-1.5 h-1.5 rounded-full border border-[#D96B43] mt-2 shrink-0" />
                        <div className="flex-1 min-w-0">
                          {renderRichLineContent(cleanLine)}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={lIdx}
                      className="flex items-start gap-2.5 pt-1 text-[14.5px] sm:text-[15px] text-[#18181B] dark:text-zinc-100 leading-[1.72]"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D96B43] mt-2.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        {renderRichLineContent(cleanLine)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
