// src/pages/Summaries.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  Sparkles,
  BookOpen,
  Trash2,
  Target,
  Loader2,
  LayoutGrid,
  List as ListIcon,
  FolderOpen,
  SlidersHorizontal,
  FileText,
  Download,
  MoreHorizontal,
  PenTool,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EditorSummaryItem } from "@/components/synthesis/EditorView";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { permanentlyDeleteEntity, filterOutTombstoned } from "@/lib/syncEngine";
import { cleanAndStructureMarkdown } from "@/utils/formatters";
import { DOCTRINE_LABELS, type Doctrine } from "@/config/doctrineConfig";
import { getSavedCourses, type StoredCourse } from "@/pages/Library";
import {
  getLocalSummaries,
  saveLocalSummaries,
  SUBJECT_FILTERS,
} from "@/pages/GenerateSummary";
import { exportArgonSummaryToPDF } from "@/utils/argonPdfExport";

export type SynthesisDoctrine =
  | "objectives_verbatim"
  | "drive_objective_strategy"
  | "harvard_method"
  | "arva"
  | "world_number_one";

/**
 * Nettoie l'aperçu textuel d'une synthèse en retirant les bandeaux structurels
 * (=== VOLET 1 ===, === OBJECTIF 1 : ... ===, ## Objectif 1, etc.) pour afficher
 * directement la première vraie phrase clinique du cours.
 */
function buildCleanSummaryExcerpt(rawHtml: string): string {
  if (!rawHtml) return "";
  return rawHtml
    .replace(/<[^>]*>/g, " ")
    .replace(/^@SYNTHESE_META_[^\n]*$/gim, " ")
    .replace(/^===\s*VOLET\s*\d+[^=\n]*===\s*/gim, " ")
    .replace(/^===\s*PARTIE\s*(?:I{1,3}V?|\d+)[^=\n]*===\s*/gim, " ")
    .replace(/^===\s*OBJECTIF\s*\d+[^=\n]*===\s*/gim, " ")
    .replace(/^#{1,3}\s*(?:VOLET\s*\d+|PARTIE\s*(?:I{1,3}V?|\d+)|OBJECTIF\s*\d+|Sous-partie\s*\d+|\d+\.\d+\.)[^\n]*$/gim, " ")
    .replace(/^★[^\n]*$/gim, " ")
    .replace(/^\[\s*(?:RAPPEL\s+CLINIQUE|R[ÈE]GLE\s+D['’]OR|AVERTISSEMENT|PI[ÈE]GE|[ÉE]TAPE)[^\]]*\]/gim, " ")
    .replace(/\|[^\n]+\|/g, " ")
    .replace(/==/g, "")
    .replace(/[#*`>|•◦✓→\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================================
// MENU 3 POINTS (•••) UNIFIÉ AVEC LA BANQUE DE QCM (SANS FLOUTAGE D'ÉCRAN)
// ============================================================================

const SummaryThreeDotsMenu: React.FC<{
  onOpenSummary: () => void;
  onDownloadPdf: (e: React.MouseEvent) => void;
  onRecalibrate: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}> = ({ onOpenSummary, onDownloadPdf, onRecalibrate, onDelete }) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => e.stopPropagation()}
        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0"
        title="Options de la synthèse"
      >
        <MoreHorizontal className="w-4 h-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      sideOffset={6}
      onClick={(e) => e.stopPropagation()}
      className="w-56 rounded-2xl bg-popover text-popover-foreground border border-border shadow-xl p-1.5 z-[100]"
    >
      <DropdownMenuItem
        onClick={onOpenSummary}
        className="rounded-xl text-xs font-bold cursor-pointer flex items-center gap-2.5 py-2.5 text-primary focus:text-primary"
      >
        <BookOpen className="w-3.5 h-3.5" />
        Lire & Annoter la synthèse
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={(e) => onDownloadPdf(e)}
        className="rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-2.5 py-2.5"
      >
        <Download className="w-3.5 h-3.5" />
        Télécharger en PDF
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={(e) => onRecalibrate(e)}
        className="rounded-xl text-xs font-medium cursor-pointer flex items-center gap-2.5 py-2.5"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Recalibrer / Régénérer
      </DropdownMenuItem>
      <DropdownMenuSeparator className="my-1 bg-border" />
      <DropdownMenuItem
        onClick={(e) => onDelete(e)}
        className="rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-2.5 py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Supprimer cette synthèse
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export default function Summaries() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [summaries, setSummaries] = useState<EditorSummaryItem[]>(getLocalSummaries);
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(true);
  const [libraryCoursesCount, setLibraryCoursesCount] = useState<number>(
    () => getSavedCourses().length
  );

  const [selectedSubject, setSelectedSubject] = useState("Tous");
  const [searchQuery, setSearchQuery] = useState("");
  const [layoutMode, setLayoutMode] = useState<"mosaic" | "list">("mosaic");
  const [selectedSummaryIds, setSelectedSummaryIds] = useState<string[]>([]);

  // Si l'URL contient ?new=1 ou ?courseId=..., rediriger vers la page dédiée /summaries/new
  useEffect(() => {
    const courseIdParam = searchParams.get("courseId");
    const isNewParam = searchParams.get("new");
    if (courseIdParam) {
      navigate(`/summaries/new?courseId=${encodeURIComponent(courseIdParam)}`, {
        replace: true,
      });
    } else if (isNewParam === "1") {
      navigate("/summaries/new", { replace: true });
    }
  }, [searchParams, navigate]);

  const fetchSummariesFromDb = useCallback(async () => {
    setIsLoadingSummaries(true);
    const localItems = getLocalSummaries();
    setLibraryCoursesCount(getSavedCourses().length);

    try {
      const { data, error } = await supabase
        .from("summaries")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        const remoteItems: EditorSummaryItem[] = data.map((row: any) => {
          const rawContent = row.content || "";
          const cleanedMarkdown = cleanAndStructureMarkdown(rawContent);
          const plain = cleanedMarkdown.replace(/[#*`>|=]/g, " ");
          const wc = Math.max(1, plain.trim().split(/\s+/).filter(Boolean).length);
          const meta = row.metadata || {};

          return {
            id: row.id,
            title: row.title || "Synthèse sans titre",
            subject: meta.subject || row.summary_type || "Médecine",
            updatedAt: row.created_at
              ? new Date(row.created_at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "Aujourd'hui",
            wordCount: wc,
            doctrineLabel:
              meta.doctrineLabel ||
              DOCTRINE_LABELS[meta.doctrine as Doctrine] ||
              DOCTRINE_LABELS.objectives_verbatim,
            htmlContent: cleanedMarkdown,
          };
        });

        const byId = new Map<string, EditorSummaryItem>();
        remoteItems.forEach((item) => byId.set(item.id, item));
        localItems.forEach((item) => {
          if (!byId.has(item.id)) {
            byId.set(item.id, item);
          }
        });

        const merged = filterOutTombstoned("summary", Array.from(byId.values()));
        setSummaries(merged);
        saveLocalSummaries(merged);
      } else {
        setSummaries(localItems);
      }
    } catch {
      setSummaries(localItems);
    } finally {
      setIsLoadingSummaries(false);
    }
  }, []);

  useEffect(() => {
    fetchSummariesFromDb();
  }, [fetchSummariesFromDb]);

  const handleDeleteSummary = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = summaries.find((s) => s.id === id);

    await permanentlyDeleteEntity("summary", id, target?.title);

    setSummaries((prev) => {
      const updated = filterOutTombstoned(
        "summary",
        prev.filter((s) => s.id !== id)
      );
      saveLocalSummaries(updated);
      return updated;
    });
    setSelectedSummaryIds((prev) => prev.filter((item) => item !== id));

    toast({
      title: "Synthèse supprimée",
      description: "Le résumé a été retiré de votre bibliothèque.",
    });
  };

  const handleBulkDeleteSummaries = async () => {
    if (selectedSummaryIds.length === 0) return;
    const toDelete = new Set(selectedSummaryIds);

    for (const id of selectedSummaryIds) {
      const target = summaries.find((s) => s.id === id);
      await permanentlyDeleteEntity("summary", id, target?.title);
    }

    setSummaries((prev) => {
      const updated = filterOutTombstoned(
        "summary",
        prev.filter((s) => !toDelete.has(s.id))
      );
      saveLocalSummaries(updated);
      return updated;
    });

    const count = selectedSummaryIds.length;
    setSelectedSummaryIds([]);
    toast({
      title: `${count} synthèse(s) supprimée(s)`,
      description: "La sélection a été retirée de votre bibliothèque.",
    });
  };

  const handleDirectPdfDownload = (item: EditorSummaryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const isAudit =
      (item.doctrineLabel || "").toLowerCase().includes("argon") ||
      (item.doctrineLabel || "").toLowerCase().includes("audit") ||
      (item.htmlContent || "").includes("VOLET 2");

    exportArgonSummaryToPDF({
      title: item.title,
      content: item.htmlContent,
      summaryType: isAudit ? "objectives_audit" : "objectives_only",
    });

    toast({
      title: "Export PDF lancé",
      description: `Le fichier PDF « ${item.title} » a été généré à votre demande.`,
    });
  };

  const handleRecalibrateSummary = (item: EditorSummaryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const savedCourses = getSavedCourses();
    const matchingCourse = savedCourses.find(
      (c) =>
        (c.title || "").trim().toLowerCase() ===
        (item.title || "").trim().toLowerCase()
    );
    const shortcutPayload: StoredCourse = matchingCourse || {
      id: item.id,
      code: (item.subject || "COURS").slice(0, 8).toUpperCase(),
      title: item.title,
      subject: item.subject || "Hématologie",
      updatedAt: item.updatedAt,
      wordCount: item.wordCount,
      content: item.htmlContent,
    };
    try {
      localStorage.setItem(
        "hippocampus_active_course_shortcut",
        JSON.stringify(shortcutPayload)
      );
    } catch {
      // ignore
    }
    navigate("/summaries/new");
  };

  // Compteur de synthèses par matière pour les filtres
  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = { Tous: summaries.length };
    summaries.forEach((s) => {
      const subj = s.subject || "Autre";
      counts[subj] = (counts[subj] || 0) + 1;
    });
    return counts;
  }, [summaries]);

  const filteredSummaries = summaries.filter((s) => {
    const matchSubject = selectedSubject === "Tous" || s.subject === selectedSubject;
    const q = (searchQuery || "").trim().toLowerCase();
    const matchQuery =
      !q ||
      (s.title || "").toLowerCase().includes(q) ||
      (s.subject || "").toLowerCase().includes(q) ||
      (s.doctrineLabel || "").toLowerCase().includes(q);
    return matchSubject && matchQuery;
  });

  const toggleSelectSummary = (id: string) => {
    setSelectedSummaryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllSummaries = () => {
    if (
      filteredSummaries.length > 0 &&
      selectedSummaryIds.length === filteredSummaries.length
    ) {
      setSelectedSummaryIds([]);
    } else {
      setSelectedSummaryIds(filteredSummaries.map((s) => s.id));
    }
  };

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* =====================================================================
          EN-TÊTE STUDIO ACADÉMIQUE (UNIFIÉ AVEC CONSTRUCTEUR & BANQUE DE QCM)
      ===================================================================== */}
      <header className="w-full space-y-2 pb-5 border-b border-border/80">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          <span>
            Atelier de synthèse médicale • Fidèle aux Objectifs &amp; Synthèse Unifiée (Protocole Argon)
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pt-0.5">
          <h1 className="font-serif text-2xl sm:text-[28px] font-bold tracking-tight text-foreground leading-tight shrink-0">
            Synthèses &amp; Monographies
          </h1>

          <nav
            aria-label="Actions Synthèses"
            className="inline-flex flex-nowrap items-center gap-1 p-1.5 rounded-2xl bg-muted/90 border border-border/80 w-fit max-w-full overflow-x-auto shrink-0"
          >
            <button
              type="button"
              className="relative px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all flex items-center gap-2 bg-card text-foreground shadow-sm border border-border/60"
            >
              <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Mes Synthèses</span>
              <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold leading-none bg-primary/15 text-primary">
                {summaries.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/summaries/new?mode=objectives_verbatim")}
              className="relative px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Target className="w-3.5 h-3.5 shrink-0" />
              <span>Fidèle aux Objectifs</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/summaries/new?mode=drive_objective_strategy")}
              className="relative px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Flame className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Objectifs &amp; Audit d&apos;Annales</span>
            </button>
          </nav>
        </div>
      </header>

      {/* =====================================================================
          BARRE D'OUTILS : RECHERCHE, SÉLECTION DE MASSE, MOSAÏQUE / ALIGNEMENT
      ===================================================================== */}
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                placeholder="Rechercher parmi vos synthèses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-8 rounded-2xl bg-card border-border h-10 text-xs sm:text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs px-1"
                  title="Effacer la recherche"
                >
                  ✕
                </button>
              )}
            </div>

            {filteredSummaries.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleSelectAllSummaries}
                className="rounded-xl text-xs h-10 gap-2"
              >
                <Checkbox
                  checked={
                    filteredSummaries.length > 0 &&
                    selectedSummaryIds.length === filteredSummaries.length
                  }
                />
                <span>Tout sélectionner</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {selectedSummaryIds.length > 0 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleBulkDeleteSummaries}
                className="rounded-xl h-10 px-4 text-xs font-bold gap-2 shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>Supprimer la sélection ({selectedSummaryIds.length})</span>
              </Button>
            )}

            <div className="inline-flex items-center p-1 rounded-xl bg-muted border border-border">
              <button
                type="button"
                onClick={() => setLayoutMode("mosaic")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  layoutMode === "mosaic"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Mosaïque
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  layoutMode === "list"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ListIcon className="w-3.5 h-3.5" /> Alignement
              </button>
            </div>

            <Button
              type="button"
              onClick={() => navigate("/summaries/new")}
              className="rounded-xl h-10 px-4 text-xs font-bold gap-2 bg-foreground text-background hover:bg-foreground/90"
            >
              <Plus className="w-3.5 h-3.5" /> Nouvelle synthèse
            </Button>
          </div>
        </div>

        {/* RUBAN DES DISCIPLINES MÉDICALES */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar scroll-smooth">
          {SUBJECT_FILTERS.map((subj) => {
            const active = selectedSubject === subj;
            const count = subjectCounts[subj] || 0;
            return (
              <button
                key={subj}
                type="button"
                onClick={() => setSelectedSubject(subj)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 whitespace-nowrap shrink-0 ${
                  active
                    ? "bg-foreground text-background shadow-xs"
                    : "bg-card text-muted-foreground hover:text-foreground border border-border hover:border-primary/40"
                }`}
              >
                <span>{subj}</span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] ${
                      active
                        ? "bg-background/20 text-background"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          GRILLE MOSAÏQUE OU LISTE ALIGNEMENT (AVEC MENU ••• ÉPURÉ)
      ===================================================================== */}
      {isLoadingSummaries ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="h-7 w-7 text-primary animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">
            Synchronisation de vos synthèses académiques...
          </p>
        </div>
      ) : filteredSummaries.length === 0 ? (
        <Card className="bg-card border-border/80 rounded-3xl p-14 text-center space-y-4">
          <div className="text-base font-bold text-foreground">
            Aucune synthèse trouvée dans cette sélection
          </div>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Importez un polycopié PDF/DOCX ou choisissez un cours de votre Bibliothèque ({libraryCoursesCount}) pour générer une synthèse structurée.
          </p>
          <div className="flex items-center justify-center gap-2.5 pt-1">
            <Button
              variant="outline"
              onClick={() => navigate("/summaries/new?source=library")}
              className="rounded-xl font-semibold text-xs gap-2"
            >
              <FolderOpen className="w-3.5 h-3.5 text-primary" />
              Depuis la Bibliothèque ({libraryCoursesCount})
            </Button>
            <Button
              onClick={() => navigate("/summaries/new")}
              className="rounded-xl font-bold text-xs gap-2 bg-foreground text-background"
            >
              <Sparkles className="w-3.5 h-3.5" /> Nouvelle synthèse
            </Button>
          </div>
        </Card>
      ) : layoutMode === "mosaic" ? (
        /* VUE MOSAÏQUE ÉPURÉE (ALIGNÉE SUR LA BANQUE DE QCM) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSummaries.map((item) => {
            const isSelected = selectedSummaryIds.includes(item.id);
            const rawHtml = item.htmlContent || "";
            const previewText = buildCleanSummaryExcerpt(rawHtml);

            const h2Matches =
              rawHtml.match(/(?:^##\s+.+$|^===\s*OBJECTIF.+===$)/gim) || [];
            const objectiveHeadings = h2Matches.filter(
              (h) => !/objectifs\s+p[ée]dagogiques/i.test(h)
            );
            const sectionsCount = Math.max(
              1,
              objectiveHeadings.length || h2Matches.length || 1
            );
            const tablesCount = (
              rawHtml.match(/\|.*\|.*\n\|[\s\-:|]+\|/g) || []
            ).length;
            const labelLower = (item.doctrineLabel || "").toLowerCase();
            const isArgon =
              labelLower.includes("argon") ||
              labelLower.includes("audit") ||
              rawHtml.includes("PARTIE I") ||
              rawHtml.includes("VOLET 2");
            const readingMinutes = Math.max(
              1,
              Math.ceil((item.wordCount || 100) / 200)
            );

            return (
              <Card
                key={item.id}
                onClick={() => navigate(`/summary/${item.id}`)}
                className={`group bg-card rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "border-border hover:border-primary/50 shadow-sm hover:shadow-md"
                }`}
              >
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                  <div className="space-y-3">
                    {/* Ligne supérieure : Case à cocher + Matière + Menu ••• */}
                    <div className="flex items-center justify-between gap-2">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectSummary(item.id);
                        }}
                        className="flex items-center gap-2.5 min-w-0"
                      >
                        <Checkbox checked={isSelected} />
                        <Badge variant="secondary" className="text-[10.5px] font-bold truncate">
                          {item.subject}
                        </Badge>
                        {isArgon && (
                          <span className="text-[10px] font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">
                            Audit Annales
                          </span>
                        )}
                      </div>

                      <SummaryThreeDotsMenu
                        onOpenSummary={() => navigate(`/summary/${item.id}`)}
                        onDownloadPdf={(e) => handleDirectPdfDownload(item, e)}
                        onRecalibrate={(e) => handleRecalibrateSummary(item, e)}
                        onDelete={(e) => handleDeleteSummary(item.id, e)}
                      />
                    </div>

                    {/* Titre & Méta-ligne sobre */}
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {`${sectionsCount} objectif${sectionsCount > 1 ? "s" : ""} traité${sectionsCount > 1 ? "s" : ""}`}
                        {tablesCount > 0
                          ? ` • ${tablesCount} tableau${tablesCount > 1 ? "x" : ""}`
                          : ""}
                        {` • ~${readingMinutes} min`}
                      </p>
                    </div>

                    {/* Extrait propre du cours (sans les bandeaux VOLET 1 / OBJECTIF 1) */}
                    {previewText && (
                      <p className="text-xs text-muted-foreground/90 line-clamp-2 leading-relaxed">
                        {previewText}
                      </p>
                    )}
                  </div>

                  {/* Pied de carte harmonisé avec Mes QCM */}
                  <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {item.updatedAt} • {item.wordCount.toLocaleString("fr-FR")} mots
                    </span>
                    <span className="font-bold text-primary group-hover:underline">
                      Ouvrir la synthèse →
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* VUE ALIGNEMENT AVEC SÉLECTION DE MASSE & MENU ••• */
        <div className="bg-card border border-border rounded-2xl divide-y divide-border shadow-sm">
          {filteredSummaries.map((item) => {
            const isSelected = selectedSummaryIds.includes(item.id);
            const rawHtml = item.htmlContent || "";
            const h2Matches =
              rawHtml.match(/(?:^##\s+.+$|^===\s*OBJECTIF.+===$)/gim) || [];
            const objectiveHeadings = h2Matches.filter(
              (h) => !/objectifs\s+p[ée]dagogiques/i.test(h)
            );
            const sectionsCount = Math.max(
              1,
              objectiveHeadings.length || h2Matches.length || 1
            );

            return (
              <div
                key={item.id}
                onClick={() => navigate(`/summary/${item.id}`)}
                className={`flex items-center justify-between gap-4 px-5 py-3.5 transition-colors cursor-pointer ${
                  isSelected ? "bg-primary/5" : "hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectSummary(item.id);
                    }}
                  >
                    <Checkbox checked={isSelected} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-foreground truncate">
                      {item.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {item.subject} • {sectionsCount} objectif(s) • {item.wordCount.toLocaleString("fr-FR")} mots • {item.updatedAt}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className="text-[11px] hidden sm:inline-flex">
                    {sectionsCount} obj.
                  </Badge>
                  <SummaryThreeDotsMenu
                    onOpenSummary={() => navigate(`/summary/${item.id}`)}
                    onDownloadPdf={(e) => handleDirectPdfDownload(item, e)}
                    onRecalibrate={(e) => handleRecalibrateSummary(item, e)}
                    onDelete={(e) => handleDeleteSummary(item.id, e)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
