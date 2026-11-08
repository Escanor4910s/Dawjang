// src/components/synthesis/EditorView.tsx
import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Bold,
  Italic,
  Highlighter,
  Check,
  Printer,
  Copy,
  Download,
  FileDown,
  FileCode2,
  Columns2,
  Eye,
  GraduationCap,
  SlidersHorizontal,
  ListTree,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  PenLine,
  AlertTriangle,
  CheckCircle2,
  Stethoscope,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cleanAndStructureMarkdown } from "@/utils/formatters";
import { DOCTRINE_STYLES, DOCTRINE_LABELS } from "@/config/doctrineConfig";
import { DoctrineRenderer } from "@/components/synthesis/DoctrineRenderer";
import { HarvardEditor, HarvardRenderer } from "@/components/synthesis/HarvardEditor";
import { ArvaEditor } from "@/components/synthesis/ArvaEditor";
import { ArvaRenderer } from "@/components/synthesis/ArvaRenderer";
import {
  ObjectivesRenderer,
  normalizeArgonAndObjectivesMarkdown,
} from "@/components/synthesis/ObjectivesRenderer";
import { sanitizeAndFormatForDawJang } from "@/lib/coPilotSummaryEngine";
import { useNavigate } from "react-router-dom";
import { ObjectiveExamSummaryView } from "@/components/MedicalSummaryCard";
import { tryParseObjectiveExamData } from "@/lib/objectiveExamEngine";
import { exportArgonSummaryToPDF } from "@/utils/argonPdfExport";
import { toast } from "sonner";

export interface EditorSummaryItem {
  id: string;
  title: string;
  subject: string;
  updatedAt: string;
  wordCount: number;
  doctrineLabel: string;
  htmlContent: string;
}

interface EditorViewProps {
  summary: EditorSummaryItem;
  onBack: () => void;
  onSave: (updatedHtml: string, updatedTitle: string) => void;
  onExportPDF: () => void;
  onExportWord: () => void;
  onRecalibrate?: () => void;
}

type EditorDisplayMode =
  | "formatted"
  | "direct_edit"
  | "split"
  | "markdown"
  | "harvard_blocks"
  | "arva_blocks";

export const EditorView: React.FC<EditorViewProps> = ({
  summary,
  onBack,
  onSave,
  onExportPDF,
  onExportWord,
  onRecalibrate,
}) => {
  const directTextareaRef = useRef<HTMLTextAreaElement>(null);
  const sheetContainerRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(summary.title);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [copied, setCopied] = useState(false);
  const [displayMode, setDisplayMode] = useState<EditorDisplayMode>("formatted");
  const [showOutline, setShowOutline] = useState(false);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const navigate = useNavigate();

  const normalizedInitialMarkdown = useMemo(
    () =>
      normalizeArgonAndObjectivesMarkdown(
        cleanAndStructureMarkdown(summary?.htmlContent || "")
      ),
    [summary?.htmlContent]
  );

  const [markdownSource, setMarkdownSource] = useState(normalizedInitialMarkdown);

  const parsedDriveData = useMemo(() => {
    return (
      tryParseObjectiveExamData(summary?.htmlContent || "") ||
      tryParseObjectiveExamData(markdownSource)
    );
  }, [summary?.htmlContent, markdownSource]);

  const activeDoctrineKey = useMemo(() => {
    const label = String(summary?.doctrineLabel || "").toLowerCase();
    if (
      label.includes("drive") ||
      label.includes("stratégie") ||
      label.includes("strategie") ||
      label.includes("pièges") ||
      label.includes("argon") ||
      label.includes("audit") ||
      parsedDriveData !== null
    ) {
      return "drive_objective_strategy";
    }
    if (label.includes("harvard")) return "harvard_method";
    if (label.includes("arva")) return "arva";
    if (
      label.includes("amboss") ||
      label.includes("mondial") ||
      label.includes("first aid")
    ) {
      return "world_number_one";
    }
    return "objectives_verbatim";
  }, [summary.doctrineLabel, markdownSource, parsedDriveData]);

  const activeStyle =
    DOCTRINE_STYLES[activeDoctrineKey] || DOCTRINE_STYLES.objectives_verbatim;

  const [wordCount, setWordCount] = useState(() => {
    const plain = normalizedInitialMarkdown.replace(/[#*`>|]/g, " ");
    return Math.max(1, plain.trim().split(/\s+/).filter(Boolean).length);
  });

  // Extraction automatique du sommaire (sections ## ou ===)
  const sectionHeadings = useMemo(() => {
    const normalized = normalizeArgonAndObjectivesMarkdown(markdownSource);
    const matches = Array.from(normalized.matchAll(/^##\s+(.+)$/gm));
    const seen = new Set<string>();
    const headings: Array<{ index: number; title: string; anchorId: string }> = [];

    matches.forEach((m) => {
      const rawTitle = String(m?.[1] || "").replace(/\*\*/g, "").trim();
      const lower = rawTitle.toLowerCase();
      if (
        lower.includes("synthèse fidèle") ||
        lower.includes("synthèse médicale condensée")
      ) {
        return;
      }

      const cleanTitle = rawTitle
        .replace(/^(?:OBJECTIF\s*\d+\s*[:.\-–—]?\s*)/i, (match) => match)
        .replace(/^\d+\.\s*/, "")
        .trim();

      const dedupKey = String(cleanTitle || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 32);

      if (seen.has(dedupKey) || cleanTitle.length < 3) return;
      seen.add(dedupKey);

      const slug = String(rawTitle || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);

      headings.push({
        index: headings.length + 1,
        title: cleanTitle,
        anchorId: `sec-${slug}`,
      });
    });

    return headings;
  }, [markdownSource]);

  const scrollToSection = (anchorId: string) => {
    const el = document.getElementById(anchorId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    const cleaned = normalizeArgonAndObjectivesMarkdown(
       sanitizeAndFormatForDawJang(cleanAndStructureMarkdown(summary.htmlContent))
    );
    setMarkdownSource(cleaned);
    setTitle(summary.title);
    const plain = cleaned.replace(/[#*`>|]/g, " ");
    setWordCount(Math.max(1, plain.trim().split(/\s+/).filter(Boolean).length));
  }, [summary.id, summary.htmlContent, summary.title]);

  const triggerSave = (newContent: string, newTitle: string) => {
    setSaveState("saving");
    const plain = newContent
      .replace(/<[^>]*>/g, " ")
      .replace(/[#*`>|]/g, " ");
    const count = Math.max(1, plain.trim().split(/\s+/).filter(Boolean).length);
    setWordCount(count);
    onSave(newContent, newTitle);
    setTimeout(() => setSaveState("saved"), 400);
  };

  const handleMarkdownChange = (nextMd: string) => {
    setMarkdownSource(nextMd);
    triggerSave(nextMd, title);
  };

  /**
   * Applique une mise en forme (Gras **...**, Italique *...*, Surlignage ==...==, Encadrés)
   * soit dans l'éditeur actif (direct_edit / split / markdown),
   * soit directement sur le texte sélectionné dans la feuille de lecture ("formatted") !
   */
  const applyFormattingToSelection = (
    prefix: string,
    suffix: string,
    placeholder: string
  ) => {
    // Cas 1 : Un textarea d'édition est visible (direct_edit, split, markdown)
    const activeEl = document.activeElement as HTMLTextAreaElement | null;
    const textarea =
      (activeEl && activeEl.tagName === "TEXTAREA" ? activeEl : null) ||
      directTextareaRef.current;

    if (textarea && (displayMode === "direct_edit" || displayMode === "split" || displayMode === "markdown")) {
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? 0;
      const selected = markdownSource.slice(start, end) || placeholder;
      const updated =
        markdownSource.slice(0, start) +
        prefix +
        selected +
        suffix +
        markdownSource.slice(end);
      handleMarkdownChange(updated);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + prefix.length,
          start + prefix.length + selected.length
        );
      }, 20);
      return;
    }

    // Cas 2 : L'étudiant est en mode Lecture ("formatted") et a sélectionné un mot/passage à l'écran
    const windowSel = window.getSelection();
    const selectedText = windowSel ? windowSel.toString().trim() : "";

    if (selectedText && selectedText.length >= 2) {
      const idx = markdownSource.indexOf(selectedText);
      if (idx !== -1) {
        const updated =
          markdownSource.slice(0, idx) +
          prefix +
          selectedText +
          suffix +
          markdownSource.slice(idx + selectedText.length);
        handleMarkdownChange(updated);
        windowSel?.removeAllRanges();
        toast.success("Mise en forme appliquée et sauvegardée");
        return;
      }
    }

    // Cas 3 : Aucune sélection trouvée en mode Lecture -> basculer en Édition Directe et insérer
    setDisplayMode("direct_edit");
    toast.info("Mode Édition Directe activé — sélectionnez le texte à formater.");
  };

  const insertClinicalBlock = (blockTemplate: string) => {
    const textarea = directTextareaRef.current;
    if (textarea && (displayMode === "direct_edit" || displayMode === "split" || displayMode === "markdown")) {
      const start = textarea.selectionStart ?? markdownSource.length;
      const end = textarea.selectionEnd ?? markdownSource.length;
      const selected = markdownSource.slice(start, end).trim();
      const labelMatch = blockTemplate.match(/^\[\s*([^:]+):/);
      const blockToInsert =
        selected && labelMatch
          ? `[ ${labelMatch[1].trim()} : ${selected} ]`
          : blockTemplate;

      const updated =
        markdownSource.slice(0, start) +
        "\n\n" +
        blockToInsert +
        "\n\n" +
        markdownSource.slice(end);
      handleMarkdownChange(updated);
      toast.success("Encadré clinique inséré à la position du curseur");
      return;
    }

    // Si un texte est sélectionné en mode Lecture ("formatted"), l'encadrer directement
    const windowSel = window.getSelection();
    const selectedText = windowSel ? windowSel.toString().trim() : "";
    const labelMatch = blockTemplate.match(/^\[\s*([^:]+):/);
    if (selectedText && selectedText.length >= 3 && labelMatch) {
      const idx = markdownSource.indexOf(selectedText);
      if (idx !== -1) {
        const wrapped = `\n\n[ ${labelMatch[1].trim()} : ${selectedText} ]\n\n`;
        const updated =
          markdownSource.slice(0, idx) +
          wrapped +
          markdownSource.slice(idx + selectedText.length);
        handleMarkdownChange(updated);
        windowSel?.removeAllRanges();
        toast.success(`Passage converti en encadré « ${labelMatch[1].trim()} »`);
        return;
      }
    }

    // Sinon, ouvrir le mode Édition Directe pour que l'utilisateur rédige son encadré à l'endroit voulu
    setDisplayMode("direct_edit");
    toast.info("Mode Édition Directe activé — placez votre curseur ou sélectionnez une phrase pour l'encadrer.");
  };

  const handleZoomOut = () =>
    setZoomPercent((prev) => Math.max(80, prev - 10));
  const handleZoomIn = () =>
    setZoomPercent((prev) => Math.min(150, prev + 10));
  const handleZoomReset = () => setZoomPercent(100);

  const handleCopyPlain = () => {
    navigator.clipboard.writeText(markdownSource || "");
    setCopied(true);
    toast.success("Contenu copié dans le presse-papiers");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrimaryPdfExport = () => {
    const isArgonOrObjectives =
      activeDoctrineKey === "drive_objective_strategy" ||
      activeDoctrineKey === "objectives_verbatim" ||
      markdownSource.includes("VOLET 1") ||
      markdownSource.includes("VOLET 2") ||
      /Objectif\s*1/i.test(markdownSource);

    if (isArgonOrObjectives && !parsedDriveData) {
      exportArgonSummaryToPDF({
        title: title || summary.title,
        content: markdownSource,
        summaryType:
          activeDoctrineKey === "drive_objective_strategy"
            ? "objectives_audit"
            : "objectives_only",
      });
      toast.success("Export PDF Argon généré avec succès");
    } else {
      onExportPDF();
    }
  };

  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* BARRE D'OUTILS SUPÉRIEURE ÉDITORIALE UNIFIÉE */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#E6DFD3] dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3.5 py-2.5 shadow-[0_8px_28px_-10px_rgba(24,24,27,0.08)] print:hidden">
        {/* Gauche : Retour + Modes d'affichage + Outils d'édition & Zoom */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 text-[#52525B] dark:text-zinc-300 hover:text-[#18181B] dark:hover:text-white hover:bg-[#F5F2EB] dark:hover:bg-zinc-800 rounded-xl h-8 px-2.5 text-xs font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Bibliothèque</span>
          </Button>

          <div className="h-4 w-px bg-[#EAE4DC] dark:bg-zinc-800 hidden sm:block" />

          {/* Sélecteur de Mode : Lecture | Éditer | Split */}
          <div className="flex items-center gap-0.5 rounded-xl bg-[#FAF8F5] dark:bg-zinc-800/80 p-1 border border-[#E6DFD3] dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setDisplayMode("formatted")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold transition-all ${
                displayMode === "formatted"
                  ? "bg-[#881337] text-white shadow-2xs"
                  : "text-[#52525B] hover:text-[#18181B] dark:text-zinc-300 dark:hover:text-white"
              }`}
              title="Feuille Magistrale Formatée (Sélectionnez du texte pour mettre en gras ou surligner)"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Lecture</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setDisplayMode(
                  displayMode === "direct_edit" ? "formatted" : "direct_edit"
                )
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold transition-all ${
                displayMode === "direct_edit"
                  ? "bg-[#881337] text-white shadow-2xs"
                  : "text-[#52525B] hover:text-[#18181B] dark:text-zinc-300 dark:hover:text-white"
              }`}
              title="Modifier directement le texte et la mise en forme"
            >
              <PenLine className="h-3.5 w-3.5" />
              <span>Modifier</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode("split")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold transition-all ${
                displayMode === "split"
                  ? "bg-[#18181B] text-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                  : "text-[#52525B] hover:text-[#18181B] dark:text-zinc-300 dark:hover:text-white"
              }`}
              title="Éditeur Côte-à-Côte (Texte + Rendu Direct)"
            >
              <Columns2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Côte-à-Côte</span>
            </button>
            {activeDoctrineKey === "harvard_method" && (
              <button
                type="button"
                onClick={() => setDisplayMode("harvard_blocks")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold transition-all ${
                  displayMode === "harvard_blocks"
                    ? "bg-[#D96B43] text-white shadow-2xs"
                    : "text-[#D96B43] hover:bg-[#D96B43]/10"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Harvard</span>
              </button>
            )}
            {activeDoctrineKey === "arva" && (
              <button
                type="button"
                onClick={() => setDisplayMode("arva_blocks")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold transition-all ${
                  displayMode === "arva_blocks"
                    ? "bg-[#D96B43] text-white shadow-2xs"
                    : "text-[#D96B43] hover:bg-[#D96B43]/10"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                <span className="hidden md:inline">ARVA</span>
              </button>
            )}
          </div>

          {/* Contrôles de Zoom (- / 100% / +) */}
          <div className="flex items-center gap-0.5 rounded-xl bg-[#FAF8F5] dark:bg-zinc-800 p-1 border border-[#E6DFD3] dark:border-zinc-700">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomPercent <= 80}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-[#52525B] dark:text-zinc-300 disabled:opacity-40 transition-colors"
              title="Dézoomer (-10%)"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold text-[#18181B] dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 transition-colors min-w-[44px] text-center"
              title="Réinitialiser le zoom à 100%"
            >
              {zoomPercent}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomPercent >= 150}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-[#52525B] dark:text-zinc-300 disabled:opacity-40 transition-colors"
              title="Zoomer (+10%)"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Barre d'Outils de Mise en Gras, Surlignage & Encadrés (Active en Lecture ET en Édition) */}
          <div className="flex items-center gap-0.5 rounded-xl bg-[#FAF8F5] dark:bg-zinc-800 p-1 border border-[#E6DFD3] dark:border-zinc-700">
            <button
              type="button"
              onClick={() =>
                applyFormattingToSelection("**", "**", "terme clé en gras")
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-[#18181B] dark:text-zinc-200 text-[11px] font-bold transition-colors"
              title="Mettre la sélection en Gras (**texte**)"
            >
              <Bold className="h-3.5 w-3.5 text-[#881337] dark:text-rose-400" />
              <span className="hidden xl:inline">Gras</span>
            </button>
            <button
              type="button"
              onClick={() =>
                applyFormattingToSelection("*", "*", "texte en italique")
              }
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-[#18181B] dark:text-zinc-200 transition-colors"
              title="Mettre la sélection en Italique (*texte*)"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                applyFormattingToSelection("==", "==", "passage surligné")
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100/80 hover:bg-amber-200/90 text-amber-950 text-[11px] font-semibold transition-colors"
              title="Surligner le texte sélectionné (==texte==)"
            >
              <Highlighter className="h-3.5 w-3.5 text-amber-700" />
              <span className="hidden xl:inline">Surligner</span>
            </button>
            <div className="h-3.5 w-px bg-[#E6DFD3] dark:bg-zinc-700 mx-0.5 hidden md:block" />
            <button
              type="button"
              onClick={() =>
                insertClinicalBlock(
                  "[ RAPPEL CLINIQUE : Précisez ici la corrélation sémiologique ou physiopathologique essentielle. ]"
                )
              }
              className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50 text-[#881337] dark:text-rose-300 text-[11px] font-medium transition-colors"
              title="Insérer un encadré Rappel Clinique"
            >
              <Stethoscope className="h-3.5 w-3.5" />
              <span className="hidden 2xl:inline">+ Rappel</span>
            </button>
            <button
              type="button"
              onClick={() =>
                insertClinicalBlock(
                  "[ AVERTISSEMENT / PIÈGE : Attention au distracteur classique d'examen sur ce point. ]"
                )
              }
              className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-amber-50 text-amber-800 dark:text-amber-300 text-[11px] font-medium transition-colors"
              title="Insérer un encadré Piège d'examen"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="hidden 2xl:inline">+ Piège</span>
            </button>
            <button
              type="button"
              onClick={() =>
                insertClinicalBlock(
                  "[ RÈGLE D'OR : Réflexe clinique ou diagnostique de première intention à retenir absolument. ]"
                )
              }
              className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-emerald-50 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium transition-colors"
              title="Insérer un encadré Règle d'Or"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="hidden 2xl:inline">+ Règle d'Or</span>
            </button>
          </div>

          {sectionHeadings.length > 0 && (
            <button
              type="button"
              onClick={() => setShowOutline((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11.5px] font-semibold transition-all ${
                showOutline
                  ? "border-[#881337] bg-[#881337]/10 text-[#881337]"
                  : "border-[#E6DFD3] dark:border-zinc-700 bg-[#FAF8F5] dark:bg-zinc-800 text-[#52525B] dark:text-zinc-300 hover:border-[#881337]/50"
              }`}
              title="Afficher le sommaire interactif des objectifs"
            >
              <ListTree className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">
                Plan ({sectionHeadings.length})
              </span>
            </button>
          )}
        </div>

        {/* Droite : Statut de sauvegarde + Actions d'Export Unifiées (Sans doublon) */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[11px] text-[#71717A] mr-1">
            <span
              className={`h-2 w-2 rounded-full ${
                saveState === "saved"
                  ? "bg-emerald-600"
                  : "bg-amber-500 animate-pulse"
              }`}
            />
            {saveState === "saved"
              ? `${wordCount.toLocaleString("fr-FR")} mots · ~${readingTimeMin} min`
              : "Sauvegarde..."}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyPlain}
            className="h-8 gap-1.5 text-xs rounded-xl border-[#E6DFD3] dark:border-zinc-700"
            title="Copier le texte de la synthèse"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="hidden md:inline">{copied ? "Copié" : "Copier"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onExportWord}
            className="h-8 gap-1.5 text-xs rounded-xl border-[#E6DFD3] dark:border-zinc-700"
            title="Télécharger en format Word (.docx)"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>DOCX</span>
          </Button>

          {/* Bouton Principal Unique d'Export PDF (uniquement sur clic de l'étudiant) */}
          <Button
            size="sm"
            onClick={handlePrimaryPdfExport}
            className="h-8 gap-1.5 text-xs rounded-xl bg-gradient-to-r from-[#881337] to-[#6B112D] hover:from-[#9F1239] hover:to-[#881337] text-white font-semibold shadow-xs px-3.5"
            title="Télécharger le PDF Haute Précision (à votre demande uniquement)"
          >
            <Download className="h-3.5 w-3.5 text-amber-300" />
            <span>Télécharger PDF</span>
          </Button>

          {/* Option secondaire discrète pour ouvrir le Studio de mise en page PDF avancée */}
          <Button
            variant="outline"
            size="sm"
            onClick={onExportPDF}
            className="h-8 w-8 p-0 rounded-xl border-[#E6DFD3] dark:border-zinc-700 text-[#52525B]"
            title="Paramètres avancés d'impression / Studio PDF"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* SOMMAIRE INTERACTIF DES SECTIONS (SI ACTIVÉ) */}
      {showOutline && sectionHeadings.length > 0 && (
        <div className="max-w-[940px] mx-auto rounded-2xl border border-[#E6DFD3] dark:border-zinc-800 bg-[#FAF8F5] dark:bg-zinc-900/90 p-4 print:hidden animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#881337] dark:text-rose-400 font-bold">
              Plan & Objectifs de la Synthèse ({sectionHeadings.length} sections — cliquer pour naviguer)
            </span>
            <button
              type="button"
              onClick={() => setShowOutline(false)}
              className="text-[11px] text-[#71717A] hover:text-[#18181B]"
            >
              Masquer
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {sectionHeadings.map((sec) => (
              <button
                key={sec.index}
                type="button"
                onClick={() => scrollToSection(sec.anchorId)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800/70 border border-[#E6DFD3]/80 dark:border-zinc-700/70 hover:border-[#881337] text-[12.5px] text-left text-[#18181B] dark:text-zinc-200 transition-all"
              >
                <span className="font-mono text-[11px] font-bold text-[#881337] shrink-0">
                  {String(sec.index).padStart(2, "0")}.
                </span>
                <span className="truncate">{sec.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MODE 1 : FEUILLE ACADÉMIQUE FORMATÉE AVEC ZOOM & MISE EN FORME PAR SÉLECTION */}
      {displayMode === "formatted" && (
        <div
          ref={sheetContainerRef}
          style={{
            zoom: `${zoomPercent}%`,
          }}
          className={`max-w-[940px] mx-auto rounded-3xl border border-[#E6DFD3] dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_16px_48px_-14px_rgba(24,24,27,0.08)] p-6 sm:p-10 md:p-12 print:shadow-none print:border-none print:p-0 transition-all ${activeStyle.bg}`}
        >
          {/* En-tête Editorial du Document */}
          <div className="pb-6 mb-7 border-b border-[#EAE4DC] dark:border-zinc-800 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-lg bg-[#881337] text-white text-[11px] font-bold tracking-wide uppercase">
                  {summary.subject}
                </span>
                <Badge
                  variant="outline"
                  className="font-mono text-[10.5px] border-[#881337]/30 bg-[#881337]/[0.05] text-[#881337] dark:text-rose-300"
                >
                  {DOCTRINE_LABELS[activeDoctrineKey] || summary.doctrineLabel}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-[#71717A]">
                  Mis à jour le {summary.updatedAt} · {wordCount.toLocaleString("fr-FR")} mots
                </span>
                <button
                  type="button"
                  onClick={() => setDisplayMode("direct_edit")}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#881337] hover:underline print:hidden"
                >
                  <PenLine className="w-3 h-3" />
                  <span>Éditer le texte</span>
                </button>
              </div>
            </div>

            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                triggerSave(markdownSource, e.target.value);
              }}
              className="text-2xl sm:text-[30px] font-serif font-bold tracking-tight border-none px-0 h-auto py-1 focus-visible:ring-0 bg-transparent text-[#18181B] dark:text-zinc-100"
            />

            {/* Astuce interactive discrète */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 print:hidden">
              <p className="text-[11.5px] text-[#71717A] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#881337]" />
                <span>
                  Astuce : surlignez n&apos;importe quel passage avec la souris puis cliquez sur{" "}
                  <strong>Gras</strong> ou <strong>Surligner</strong> dans la barre supérieure, ou cliquez sur{" "}
                  <button
                    type="button"
                    onClick={() => setDisplayMode("direct_edit")}
                    className="font-semibold text-[#881337] underline"
                  >
                    Modifier
                  </button>{" "}
                  pour corriger librement.
                </span>
              </p>
            </div>

            {/* Ruban de navigation rapide vers chaque objectif/section */}
            {sectionHeadings.length > 0 && (
              <div className="pt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar print:hidden">
                <span className="text-[10.5px] font-mono uppercase tracking-wider text-[#71717A] shrink-0 mr-1">
                  Accès direct ({sectionHeadings.length}) :
                </span>
                {sectionHeadings.map((sec) => (
                  <button
                    key={sec.index}
                    type="button"
                    onClick={() => scrollToSection(sec.anchorId)}
                    className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] dark:bg-zinc-800 hover:bg-[#881337] hover:text-white border border-[#E6DFD3] dark:border-zinc-700 text-[11px] font-medium text-[#52525B] dark:text-zinc-300 whitespace-nowrap transition-all max-w-[220px] truncate"
                    title={sec.title}
                  >
                    {sec.index}.{" "}
                    {sec.title.replace(/^Objectif\s*\d+\s*[:.\-–—]\s*/i, "")}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Rendu Visuel Spécialisé selon la Doctrine Active */}
          {activeDoctrineKey === "drive_objective_strategy" && parsedDriveData ? (
            <ObjectiveExamSummaryView
              data={parsedDriveData}
              onExportPDF={handlePrimaryPdfExport}
              onLaunchQCM={(qcmList) => {
                navigate("/quiz", {
                  state: { targetedQcm: qcmList, subject: summary.subject },
                });
              }}
            />
          ) : activeDoctrineKey === "objectives_verbatim" ||
            activeDoctrineKey === "drive_objective_strategy" ? (
            <ObjectivesRenderer markdown={markdownSource} />
          ) : activeDoctrineKey === "harvard_method" ? (
            <HarvardRenderer markdown={markdownSource} />
          ) : activeDoctrineKey === "arva" ? (
            <ArvaRenderer markdown={markdownSource} />
          ) : (
            <DoctrineRenderer
              markdown={markdownSource}
              doctrine={activeDoctrineKey}
            />
          )}
        </div>
      )}

      {/* MODE 2 : ÉDITION DIRECTE SUR LA FEUILLE (AVEC APERÇU INSTANTANÉ) */}
      {displayMode === "direct_edit" && (
        <div
          style={{ zoom: `${zoomPercent}%` }}
          className="max-w-[940px] mx-auto rounded-3xl border-2 border-[#881337]/30 bg-white dark:bg-zinc-900 shadow-[0_16px_48px_-14px_rgba(136,19,55,0.12)] p-6 sm:p-10 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EAE4DC] dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-[#881337] text-white font-mono text-[10.5px] font-bold uppercase tracking-wider">
                  Mode Édition Directe
                </span>
                <span className="text-xs text-[#71717A]">
                  Toutes vos modifications sont sauvegardées automatiquement.
                </span>
              </div>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  triggerSave(markdownSource, e.target.value);
                }}
                className="text-xl sm:text-2xl font-serif font-bold tracking-tight border-none px-0 h-auto py-1 mt-1 focus-visible:ring-0 bg-transparent text-[#18181B] dark:text-zinc-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setDisplayMode("formatted");
                  toast.success("Modifications enregistrées");
                }}
                className="h-8 gap-1.5 text-xs rounded-xl bg-[#881337] hover:bg-[#9F1239] text-white font-semibold"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Terminer l&apos;édition</span>
              </Button>
            </div>
          </div>

          <textarea
            ref={directTextareaRef}
            value={markdownSource}
            onChange={(e) => handleMarkdownChange(e.target.value)}
            className="w-full min-h-[68vh] resize-y rounded-2xl bg-[#FAF8F5] dark:bg-zinc-800/60 border border-[#E6DFD3] dark:border-zinc-700 p-5 font-sans text-[14.5px] leading-[1.8] text-[#18181B] dark:text-zinc-100 focus:outline-none focus:border-[#881337]"
            placeholder="Rédigez ou modifiez votre synthèse ici..."
          />
        </div>
      )}

      {/* MODE 3 : STUDIO CÔTE-À-CÔTE (ÉDITION GAUCHE + RENDU TEMPS RÉEL DROITE) */}
      {displayMode === "split" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-[1440px] mx-auto">
          <div className="rounded-2xl border border-[#E6DFD3] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col h-[78vh]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#EAE4DC] dark:border-zinc-800">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#881337] font-bold">
                Éditeur Interactif (Gauche)
              </span>
              <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                Synchronisation Temps Réel
              </span>
            </div>
            <textarea
              ref={directTextareaRef}
              value={markdownSource}
              onChange={(e) => handleMarkdownChange(e.target.value)}
              className="flex-1 w-full resize-none bg-transparent font-sans text-[13.5px] leading-relaxed text-[#18181B] dark:text-zinc-200 focus:outline-none"
              placeholder="# Titre principal&#10;## Objectif 1..."
            />
          </div>

          <div
            style={{ zoom: `${zoomPercent}%` }}
            className={`rounded-2xl border border-[#E6DFD3] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 overflow-y-auto h-[78vh] ${activeStyle.bg}`}
          >
            <div className="pb-3 mb-4 border-b border-[#EAE4DC] dark:border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#71717A] font-semibold">
                Aperçu Académique ({DOCTRINE_LABELS[activeDoctrineKey]})
              </span>
              <Badge
                variant="outline"
                className="text-[10px] border-[#881337]/30 text-[#881337]"
              >
                {wordCount} mots
              </Badge>
            </div>
            {activeDoctrineKey === "objectives_verbatim" ||
            activeDoctrineKey === "drive_objective_strategy" ? (
              <ObjectivesRenderer markdown={markdownSource} />
            ) : activeDoctrineKey === "harvard_method" ? (
              <HarvardRenderer markdown={markdownSource} />
            ) : activeDoctrineKey === "arva" ? (
              <ArvaRenderer markdown={markdownSource} />
            ) : (
              <DoctrineRenderer
                markdown={markdownSource}
                doctrine={activeDoctrineKey}
              />
            )}
          </div>
        </div>
      )}

      {/* MODE 4 : ÉDITEUR PAR BLOCS HARVARD */}
      {displayMode === "harvard_blocks" && (
        <div className="max-w-[960px] mx-auto rounded-2xl border border-[#EAE4DC] dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs p-6 sm:p-8">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#EAE4DC] dark:border-zinc-800">
            <div>
              <h3 className="text-base font-serif font-bold text-[#18181B] dark:text-zinc-100 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#D96B43]" />
                <span>Atelier Structuré — Méthode de Harvard (4 Piliers)</span>
              </h3>
              <p className="text-xs text-[#71717A] mt-0.5">
                Éditez chaque pilier séparément : le document Markdown est assemblé automatiquement.
              </p>
            </div>
            <Badge
              variant="outline"
              className="font-mono text-xs border-[#D96B43]/30 text-[#D96B43]"
            >
              {wordCount} mots
            </Badge>
          </div>
          <HarvardEditor
            initialMarkdown={markdownSource}
            onChange={(updatedMd) => handleMarkdownChange(updatedMd)}
          />
        </div>
      )}

      {/* MODE 5 : ÉDITEUR PAR BLOCS ARVA */}
      {displayMode === "arva_blocks" && (
        <div className="max-w-[960px] mx-auto rounded-2xl border border-[#EAE4DC] dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs p-6 sm:p-8">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#EAE4DC] dark:border-zinc-800">
            <div>
              <h3 className="text-base font-serif font-bold text-[#18181B] dark:text-zinc-100 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#D96B43]" />
                <span>Atelier Structuré — Doctrine ARVA (4 Piliers Docimologiques)</span>
              </h3>
              <p className="text-xs text-[#71717A] mt-0.5">
                Éditez la Matrice Active Recall, les Scripts Différentiels, la Vignette Clinique et les Visas.
              </p>
            </div>
            <Badge
              variant="outline"
              className="font-mono text-xs border-[#D96B43]/30 text-[#D96B43]"
            >
              {wordCount} mots
            </Badge>
          </div>
          <ArvaEditor
            markdown={markdownSource}
            onChange={(updatedMd) => handleMarkdownChange(updatedMd)}
          />
        </div>
      )}
    </div>
  );
};
export default EditorView;
