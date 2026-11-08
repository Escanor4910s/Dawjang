// src/components/MedicalSummaryCard.tsx
import React, { useState, useMemo } from "react";
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  SlidersHorizontal,
  Copy,
  Check,
  Printer,
  FileDown,
  Download,
  Columns2,
  Eye,
  Code2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileText,
  Target,
  ShieldAlert,
  HelpCircle,
  Compass,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ObjectiveExamSummaryData } from "@/lib/objectiveExamEngine";
export type { ObjectiveExamSummaryData } from "@/lib/objectiveExamEngine";
import { useToast } from "@/hooks/use-toast";
import { sanitizeAndFormatForDawJang } from "@/lib/coPilotSummaryEngine";
import { cleanAndStructureMarkdown } from "@/utils/formatters";
import { PdfExportStudioModal } from "@/components/pdf/PdfExportStudioModal";

export interface MedicalSummaryCardProps {
  summaryId?: string;
  title: string;
  subject?: string;
  content: string; // Markdown or HTML
  summaryType?: "complete" | "structured" | "concise";
  onBack?: () => void;
  onRecalibrate?: () => void;
  onExportPdfStudio?: () => void;
  onExportDocx?: () => void;
  onSave?: (updatedContent: string, updatedTitle: string) => void;
}

interface ParsedObjectiveSection {
  id: string;
  objectiveNumber: number;
  title: string;
  content: string;
}

/**
 * Nettoyage chirurgical du document :
 * - Élimine les cartouches de préambule ("Synthèse Médicale Ultra-Condensée", "Synthèse & Cadre Nosologique")
 * - Supprime les astérisques orphelins (ex: "Définir l'anémie**" -> "Définir l'anémie")
 * - Dédoublonne les objectifs redondants (Objectif 5 rédigé 4 fois)
 */
function parseAndPurifySections(rawContent: string): ParsedObjectiveSection[] {
  if (!rawContent) return [];

  const cleaned = sanitizeAndFormatForDawJang(
    cleanAndStructureMarkdown(rawContent)
  );

  // Découpage strict par titre ## Objectif ou ## [Numéro]
  const rawBlocks = cleaned.split(/(?=^##\s+)/gm);
  const sections: ParsedObjectiveSection[] = [];
  const seenKeys = new Set<string>();

  rawBlocks.forEach((block) => {
    const trimmed = block.trim();
    if (!trimmed) return;

    const headingMatch = trimmed.match(/^##\s+(.+)$/m);
    if (!headingMatch) return;

    const rawHeading = (headingMatch[1] || "").replace(/\*\*/g, "").trim();
    const lower = rawHeading.toLowerCase();

    // Filtre impératif : ignore les fausses sections de sommaire ou titres parasites
    if (
      lower.includes("anemies 2026") ||
      lower.includes("anémies 2026") ||
      lower.includes("synthèse fidèle") ||
      lower.includes("synthèse médicale") ||
      lower.includes("synthèse & cadre") ||
      lower.includes("cadre nosologique") ||
      lower.includes("sommaire exécutif")
    ) {
      return;
    }

    const cleanTitle = rawHeading
      .replace(/^(?:OBJECTIF\s*\d+\s*[:.\-–—]?\s*)/i, "")
      .replace(/^\d+\.\s*/, "")
      .trim();

    if (!cleanTitle || cleanTitle.length < 3) return;

    // Clé de dédoublonnage canonique
    const dedupKey = cleanTitle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 32);

    if (seenKeys.has(dedupKey)) return;
    seenKeys.add(dedupKey);

    // Extraction du contenu sans le titre H2
    let bodyContent = trimmed
      .replace(/^##\s+[^\n]+\n+/, "")
      // Élimination des citations ou puces de sommaire résiduelles en tête de section
      .replace(/^\s*(?:>\s*[^\n]*\n+)+/gi, "")
      .replace(/^(?:[-*•]\s*Objectif\s*\d+[^\n]*\n+)+/gi, "")
      // Assainissement des doubles astérisques orphelins
      .replace(/([^\s*])\*{2,}(?=\s*(\n|$))/g, "$1")
      .replace(/\*{2,}(?=\s*(\n|$))/g, "")
      .trim();

    sections.push({
      id: `obj-${sections.length + 1}`,
      objectiveNumber: sections.length + 1,
      title: cleanTitle,
      content: bodyContent,
    });
  });

  return sections;
}

/**
 * Rendu des fractions mathématiques empilées (\frac{num}{den})
 */
function renderStackedFractions(text: string): React.ReactNode[] {
  const fractionRegex = /\\frac\{([^{}]+)\}\{([^{}]+)\}/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fractionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const numerator = match[1];
    const denominator = match[2];

    parts.push(
      <span
        key={`frac-${match.index}`}
        className="inline-flex flex-col items-center justify-center align-middle mx-1 px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-[11px] font-mono leading-none"
      >
        <span className="border-b border-stone-400 dark:border-stone-500 pb-0.5 px-0.5 font-bold text-stone-900 dark:text-stone-100">
          {numerator}
        </span>
        <span className="pt-0.5 px-0.5 text-stone-700 dark:text-stone-300">
          {denominator}
        </span>
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Mise en forme inline du texte médical (gras, puces, alertes)
 */
function renderInlineMedicalText(rawText: string): React.ReactNode {
  // Nettoyage préalable des astérisques orphelins en fin de ligne
  const text = rawText
    .replace(/([^\s*])\*{2,}(?=\s*$)/g, "$1")
    .replace(/\*{2,}(?=\s*$)/g, "");

  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong
          key={idx}
          className="font-bold text-stone-950 dark:text-stone-100"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded font-mono text-xs bg-stone-200/60 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{renderStackedFractions(part)}</span>;
  });
}

/**
 * Badge sémantique automatique pour valeurs cliniques (Abaissé, Élevé, Normal)
 */
function renderTableCellWithBadge(cellText: string): React.ReactNode {
  const clean = String(cellText || "").trim();
  const lower = clean.toLowerCase();

  if (
    lower.includes("abaissé") ||
    lower.includes("très abaissé") ||
    lower.includes("carence") ||
    lower.includes("anémie")
  ) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
        {clean}
      </span>
    );
  }

  if (
    lower.includes("élevé") ||
    lower.includes("très élevé") ||
    lower.includes("augmenté") ||
    lower.includes("régénératif")
  ) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
        {clean}
      </span>
    );
  }

  if (lower.includes("normal") || lower.includes("arégénératif")) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
        {clean}
      </span>
    );
  }

  return renderInlineMedicalText(clean);
}

/**
 * Rendu structuré d'une section clinique (tableaux, listes, encadrés)
 */
function RichSectionRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];

  let tableBuffer: string[] = [];
  let inTable = false;

  const flushTable = (keyIdx: number) => {
    if (!inTable || tableBuffer.length === 0) return;

    const rows = tableBuffer
      .filter((l) => !/^[\|\s:-]+$/.test(l))
      .map((line) =>
        line
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim())
      );

    if (rows.length > 0) {
      const headers = rows[0];
      const bodyRows = rows.slice(1);

      nodes.push(
        <div
          key={`tbl-${keyIdx}`}
          className="my-4 overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-stone-900/70 shadow-2xs"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-100 dark:bg-stone-800/90 border-b border-stone-200 dark:border-stone-700">
                {headers.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="py-2.5 px-3.5 font-bold uppercase tracking-wider text-[11px] text-stone-700 dark:text-stone-300"
                  >
                    {renderInlineMedicalText(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {bodyRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="hover:bg-stone-50/70 dark:hover:bg-stone-800/50 transition-colors"
                >
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="py-2 px-3.5 text-stone-700 dark:text-stone-300 align-middle"
                    >
                      {renderTableCellWithBadge(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    tableBuffer = [];
    inTable = false;
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();

    if (!line) {
      if (inTable) flushTable(idx);
      return;
    }

    // Gestion des tableaux
    if (line.startsWith("|") && line.endsWith("|")) {
      inTable = true;
      tableBuffer.push(line);
      return;
    } else if (inTable) {
      flushTable(idx);
    }

    // Encadré Règle d'or / Point clé (✓ ou [V])
    if (
      line.startsWith("- ✓") ||
      line.startsWith("- ✔") ||
      line.startsWith("✓") ||
      line.startsWith("✔") ||
      line.startsWith("- [V]") ||
      line.startsWith("[V]")
    ) {
      const clean = line
        .replace(/^[-*•]?\s*(?:[✔✓]|\[V\])\s*/i, "")
        .replace(/([^\s*])\*{2,}(?=\s*$)/g, "$1");

      nodes.push(
        <div
          key={`gold-${idx}`}
          className="my-3 p-3.5 rounded-xl border border-amber-300/80 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 flex items-start gap-2.5 text-xs sm:text-[13px] leading-relaxed shadow-2xs"
        >
          <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">{renderInlineMedicalText(clean)}</div>
        </div>
      );
      return;
    }

    // Encadré Piège d'examen (⚠️)
    if (line.startsWith("- ⚠️") || line.startsWith("⚠️")) {
      const clean = line
        .replace(/^[-*•]?\s*⚠️\s*/, "")
        .replace(/([^\s*])\*{2,}(?=\s*$)/g, "$1");

      nodes.push(
        <div
          key={`trap-${idx}`}
          className="my-3 p-3.5 rounded-xl border border-rose-300/80 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100 flex items-start gap-2.5 text-xs sm:text-[13px] leading-relaxed shadow-2xs"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">{renderInlineMedicalText(clean)}</div>
        </div>
      );
      return;
    }

    // Sous-titre H3
    if (line.startsWith("###")) {
      const subTitle = line.replace(/^###\s+/, "");
      nodes.push(
        <h4
          key={`h3-${idx}`}
          className="mt-4 mb-2 font-serif font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 flex items-center gap-2"
        >
          <span className="w-1.5 h-3.5 rounded-full bg-[#C96442]" />
          {renderInlineMedicalText(subTitle)}
        </h4>
      );
      return;
    }

    // Liste à puces standard
    if (/^[-*•]\s+/.test(line)) {
      const bulletText = line.replace(/^[-*•]\s+/, "");
      nodes.push(
        <div
          key={`li-${idx}`}
          className="flex items-start gap-2.5 my-1 text-xs sm:text-[13px] text-stone-800 dark:text-stone-200 leading-relaxed"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#C96442] shrink-0 mt-2" />
          <div className="flex-1">{renderInlineMedicalText(bulletText)}</div>
        </div>
      );
      return;
    }

    // Paragraphe classique
    nodes.push(
      <p
        key={`p-${idx}`}
        className="my-2 text-xs sm:text-[13px] text-stone-800 dark:text-stone-200 leading-relaxed text-justify"
      >
        {renderInlineMedicalText(line)}
      </p>
    );
  });

  if (inTable) {
    flushTable(lines.length);
  }

  return <div className="space-y-1">{nodes}</div>;
}

export const MedicalSummaryCard: React.FC<MedicalSummaryCardProps> = ({
  summaryId,
  title,
  subject = "Hématologie & Médecine Interne",
  content,
  onBack,
  onRecalibrate,
  onExportPdfStudio,
  onExportDocx,
  onSave,
}) => {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"reading" | "split" | "markdown">(
    "reading"
  );
  const [focusedObjective, setFocusedObjective] = useState<number | "all">(
    "all"
  );
  const [copied, setCopied] = useState(false);
  const [isPdfStudioOpen, setIsPdfStudioOpen] = useState(false);

  // Sections nettoyées chirurgicalement
  const cleanSections = useMemo(
    () => parseAndPurifySections(content),
    [content]
  );

  // Markdown reconstitué propre pour l'export et l'affichage source
  const compiledCleanMarkdown = useMemo(() => {
    return cleanSections
      .map((s) => `## Objectif ${s.objectiveNumber} : ${s.title}\n\n${s.content}`)
      .join("\n\n---\n\n");
  }, [cleanSections]);

  const wordCount = useMemo(() => {
    const plain = compiledCleanMarkdown.replace(/[#*`>|]/g, " ");
    return Math.max(1, plain.trim().split(/\s+/).filter(Boolean).length);
  }, [compiledCleanMarkdown]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(compiledCleanMarkdown);
      setCopied(true);
      toast({
        title: "Copié dans le presse-papier",
        description: `${cleanSections.length} objectifs (${wordCount} mots) copiés en Markdown propre.`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Erreur de copie",
        description: "Impossible d'accéder au presse-papier.",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const displayedSections = useMemo(() => {
    if (focusedObjective === "all") return cleanSections;
    return cleanSections.filter((s) => s.objectiveNumber === focusedObjective);
  }, [cleanSections, focusedObjective]);

  return (
    <div className="min-h-screen bg-[#F7F5F0] dark:bg-[#121110] text-stone-900 dark:text-stone-100 flex flex-col font-sans select-text">
      {/* ==================================================================
          1. BARRE DE COMMANDE SUPÉRIEURE VITRÉE (SINGLE-ROW COMMAND BAR)
      ================================================================== */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-stone-200/90 dark:border-stone-800 bg-[#F7F5F0]/90 dark:bg-[#121110]/90 backdrop-blur-md px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Retour à la liste"
              className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-bold text-sm sm:text-base text-stone-950 dark:text-white truncate">
                {title || "Monographie Médicale"}
              </h1>
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#C96442]/15 text-[#C96442] border border-[#C96442]/30">
                {cleanSections.length} OBJECTIFS
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
              {subject} • {wordCount} mots • Calibrage Pédagogique 2026
            </p>
          </div>
        </div>

        {/* Commandes d'action & sélecteur de vue */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Sélecteur de vue : Lecture / Studio Split / Markdown */}
          <div className="p-0.5 rounded-xl bg-stone-200/70 dark:bg-stone-800/80 border border-stone-300/80 dark:border-stone-700 flex items-center">
            <button
              type="button"
              onClick={() => setViewMode("reading")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "reading"
                  ? "bg-white dark:bg-stone-900 text-stone-950 dark:text-white shadow-2xs"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Lecture</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "split"
                  ? "bg-white dark:bg-stone-900 text-stone-950 dark:text-white shadow-2xs"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white"
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Studio Split</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("markdown")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "markdown"
                  ? "bg-white dark:bg-stone-900 text-stone-950 dark:text-white shadow-2xs"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Markdown</span>
            </button>
          </div>

          {/* Re-calibrer */}
          {onRecalibrate && (
            <button
              type="button"
              onClick={onRecalibrate}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 hover:border-[#C96442]/40 hover:text-[#C96442] transition-colors"
              title="Re-calibrer le résumé avec l'IA"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Re-calibrer</span>
            </button>
          )}

          {/* Copier */}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 hover:text-stone-950 dark:hover:text-white transition-colors"
            title="Copier le document"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {copied ? "Copié !" : "Copier"}
            </span>
          </button>

          {/* Imprimer */}
          <button
            type="button"
            onClick={handlePrint}
            className="p-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 hover:text-stone-950 dark:hover:text-white transition-colors"
            title="Imprimer"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Export Word */}
          {onExportDocx && (
            <button
              type="button"
              onClick={onExportDocx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 hover:text-stone-950 dark:hover:text-white transition-colors"
              title="Exporter en DOCX"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden xl:inline">Word</span>
            </button>
          )}

          {/* Export PDF Studio */}
          <button
            type="button"
            onClick={() => {
              if (onExportPdfStudio) {
                onExportPdfStudio();
              } else {
                setIsPdfStudioOpen(true);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#C96442] hover:bg-[#B75837] text-white shadow-xs transition-all active:scale-95"
            title="Ouvrir le PDF Studio DawJang"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Studio</span>
          </button>
        </div>
      </header>

      {/* ==================================================================
          2. CORPS CENTRAL : RAIL TOC SOMMAIRE + CONTENU ÉDITORIAL
      ================================================================== */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex gap-6 min-h-0">
        {/* RAIL SOMMAIRE (TABLE OF CONTENTS) */}
        {cleanSections.length > 1 && (
          <aside className="hidden lg:flex flex-col w-64 shrink-0 space-y-2 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
            <div className="flex items-center justify-between px-2 pb-1 border-b border-stone-200 dark:border-stone-800">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500">
                PLAN DIRECTEUR ({cleanSections.length})
              </span>
              <button
                type="button"
                onClick={() => setFocusedObjective("all")}
                className={`text-[10px] font-semibold transition-colors ${
                  focusedObjective === "all"
                    ? "text-[#C96442]"
                    : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                }`}
              >
                Tout voir
              </button>
            </div>

            <nav className="space-y-1">
              {cleanSections.map((sec) => {
                const isSelected = focusedObjective === sec.objectiveNumber;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      setFocusedObjective(sec.objectiveNumber);
                      const el = document.getElementById(sec.id);
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? "bg-white dark:bg-stone-800 text-stone-950 dark:text-white font-bold shadow-xs border border-[#C96442]/40"
                        : "text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-800/50 hover:text-stone-950 dark:hover:text-white"
                    }`}
                  >
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#C96442]/15 text-[#C96442]">
                      0{sec.objectiveNumber}
                    </span>
                    <span className="line-clamp-2 leading-snug">{sec.title}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        {/* ZONE DE CONTENU PRINCIPALE */}
        <main
          className={`flex-1 min-w-0 ${
            viewMode === "split"
              ? "grid grid-cols-1 lg:grid-cols-2 gap-6"
              : "space-y-6"
          }`}
        >
          {/* VUE FORMATÉE / CLINIQUE */}
          {(viewMode === "reading" || viewMode === "split") && (
            <div className="space-y-6">
              {displayedSections.map((sec) => (
                <article
                  key={sec.id}
                  id={sec.id}
                  className="p-5 sm:p-7 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 shadow-2xs space-y-4 transition-all"
                >
                  {/* En-tête de section avec badge officiel */}
                  <div className="flex items-center gap-2.5 border-b border-stone-100 dark:border-stone-800/70 pb-3">
                    <span className="px-2.5 py-0.5 rounded-md font-mono text-[10.5px] font-bold text-white bg-[#0F172A] dark:bg-stone-800">
                      OBJECTIF {String(sec.objectiveNumber).padStart(2, "0")}
                    </span>
                    <h2 className="font-serif font-bold text-base sm:text-lg text-stone-900 dark:text-stone-100">
                      {sec.title}
                    </h2>
                  </div>

                  {/* Corps de section assaini */}
                  <RichSectionRenderer content={sec.content} />
                </article>
              ))}

              {/* Contrôles de navigation Focus par Objectif */}
              {focusedObjective !== "all" && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                  <button
                    disabled={focusedObjective <= 1}
                    onClick={() =>
                      setFocusedObjective((prev) =>
                        typeof prev === "number" ? Math.max(1, prev - 1) : 1
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 dark:bg-stone-800 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Objectif précédent
                  </button>

                  <button
                    onClick={() => setFocusedObjective("all")}
                    className="text-xs font-semibold text-[#C96442]"
                  >
                    Voir tous les objectifs
                  </button>

                  <button
                    disabled={focusedObjective >= cleanSections.length}
                    onClick={() =>
                      setFocusedObjective((prev) =>
                        typeof prev === "number"
                          ? Math.min(cleanSections.length, prev + 1)
                          : cleanSections.length
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 disabled:opacity-40"
                  >
                    Objectif suivant
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VUE MARKDOWN / CODE SOURCE */}
          {(viewMode === "markdown" || viewMode === "split") && (
            <div className="rounded-2xl bg-[#181816] text-stone-200 border border-stone-800 shadow-md overflow-hidden flex flex-col h-fit">
              <div className="flex items-center justify-between px-4 py-3 bg-[#111110] border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-[#C96442]" />
                  <span className="text-xs font-mono font-semibold text-stone-300">
                    Source Markdown Structurée ({wordCount} mots)
                  </span>
                </div>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copied ? "Copié" : "Copier"}</span>
                </button>
              </div>

              <pre className="p-5 text-xs font-mono leading-relaxed text-stone-300 overflow-x-auto whitespace-pre-wrap max-h-[75vh] overflow-y-auto">
                {compiledCleanMarkdown}
              </pre>
            </div>
          )}
        </main>
      </div>

      {/* Modal PDF Export Studio */}
      <PdfExportStudioModal
        open={isPdfStudioOpen}
        onOpenChange={setIsPdfStudioOpen}
        mode="summary"
        title={title}
        subject={subject}
        htmlOrMarkdownContent={compiledCleanMarkdown}
      />
    </div>
  );
};

export interface ObjectiveExamSummaryViewProps {
  data: ObjectiveExamSummaryData;
  onExportPDF: (data: ObjectiveExamSummaryData) => void;
  onLaunchQCM: (qcmList: ObjectiveExamSummaryData["qcm_entrainement_cibles"]) => void;
}

export const ObjectiveExamSummaryView: React.FC<ObjectiveExamSummaryViewProps> = ({
  data,
  onExportPDF,
  onLaunchQCM,
}) => {
  const [activeTab, setActiveTab] = useState<"objectifs" | "strategie">("objectifs");

  return (
    <div className="space-y-6">
      {/* Barre supérieure : Métadonnées du compartiment Drive + Barre d'actions sur une seule ligne */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Badge variant="default" className="px-3 py-1 text-xs font-semibold">
            {data.metadata.niveau_semestre}
          </Badge>
          <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
            {data.metadata.matiere}
          </Badge>
          <h2 className="text-base font-bold text-foreground">
            {data.metadata.titre_lecon}
          </h2>
        </div>

        {/* Boutons d'action ergonomiques alignés sur une seule ligne */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={activeTab === "objectifs" ? "default" : "outline"}
            onClick={() => setActiveTab("objectifs")}
            className="gap-1.5"
          >
            <Target className="h-4 w-4" />
            Objectifs ({data.objectifs_developpes.length})
          </Button>

          <Button
            size="sm"
            variant={activeTab === "strategie" ? "default" : "outline"}
            onClick={() => setActiveTab("strategie")}
            className="gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400"
          >
            <ShieldAlert className="h-4 w-4" />
            Marche à suivre & Pièges ({data.strategie_examen.pieges_des_professeurs.length})
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onLaunchQCM(data.qcm_entrainement_cibles)}
            className="gap-1.5"
          >
            <HelpCircle className="h-4 w-4 text-primary" />
            Générer QCM Ciblé
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onExportPDF(data)}
            className="gap-1.5"
          >
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* VUE 1 : Résumé calibré Objectif par Objectif */}
      {activeTab === "objectifs" && (
        <div className="space-y-4">
          {data.objectifs_developpes.map((obj) => (
            <Card key={obj.numero} className="overflow-hidden border-l-4 border-l-primary">
              <CardHeader className="bg-muted/30 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {obj.numero}
                    </span>
                    {obj.intitule_objectif}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    <Sparkles className="mr-1 h-3 w-3 text-amber-500" />
                    {obj.importance_examen}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line">
                  {obj.contenu_structuré_markdown}
                </div>

                {obj.points_incontournables.length > 0 && (
                  <div className="rounded-lg bg-primary/5 p-3 border border-primary/15">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                      À retenir absolument pour cet objectif :
                    </p>
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {obj.points_incontournables.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* VUE 2 : Marche à suivre à l'évaluation & Pièges des professeurs */}
      {activeTab === "strategie" && (
        <div className="space-y-6">
          {/* Étapes de la marche à suivre devant une évaluation */}
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-emerald-600 dark:text-emerald-400">
                <Compass className="h-5 w-5" />
                Marche à suivre étape par étape le jour de l'évaluation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.strategie_examen.marche_a_suivre_evaluation.map((step) => (
                <div key={step.etape} className="flex items-start gap-3 rounded-lg border p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-600">
                    {step.etape}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{step.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.detail_reflexe}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Les tours de passe-passe / pièges des professeurs dans les annales */}
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-5 w-5" />
                Pièges récurrents des professeurs (Croisement Annales Drive)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {data.strategie_examen.pieges_des_professeurs.map((piege, idx) => (
                <div key={idx} className="rounded-xl border bg-amber-500/5 p-4 space-y-2">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    ⚠️ {piege.titre_piege}
                  </p>
                  <p className="text-xs italic text-muted-foreground border-l-2 border-amber-500/40 pl-2">
                    « {piege.distracteur_qcm} »
                  </p>
                  <p className="text-xs font-medium text-foreground">
                    <strong className="text-emerald-600 dark:text-emerald-400">Parade : </strong>
                    {piege.parade_etudiant}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Liste rouge : Ce qu'il ne faut jamais oublier */}
          <Card className="border-l-4 border-l-destructive">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Erreurs éliminatoires & Points à ne jamais oublier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {data.strategie_examen.a_ne_jamais_oublier.map((item, i) => (
                  <li key={i} className="text-xs font-medium flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MedicalSummaryCard;
