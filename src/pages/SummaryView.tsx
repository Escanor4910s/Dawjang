import { AtlasMagistralViewer } from "@/components/synthesis/AtlasMagistralViewer";
import { tryParseAtlasMagistralHtml } from "@/lib/atlasMagistralEngine";
// src/pages/SummaryView.tsx
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorView, type EditorSummaryItem } from "@/components/synthesis/EditorView";
import { PdfExportStudioModal } from "@/components/pdf/PdfExportStudioModal";
import { exportSummaryToWord } from "@/utils/wordEngine";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { untypedTable } from "@/lib/untypedDb";
import { cleanAndStructureMarkdown } from "@/utils/formatters";
import { sanitizeAndFormatForDawJang } from "@/lib/coPilotSummaryEngine";
import { DOCTRINE_LABELS, type Doctrine } from "@/config/doctrineConfig";
import { getLocalSummaries, saveLocalSummaries } from "@/pages/GenerateSummary";
import { unTombstoneEntity } from "@/lib/syncEngine";

export default function SummaryView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const resolveSummaryLocally = useCallback((targetId: string): EditorSummaryItem | null => {
    if (!targetId) return null;
    const cleanId = decodeURIComponent(targetId).trim();
    const cleanIdLower = cleanId.toLowerCase();

    // 1. Chercher dans getLocalSummaries() standard
    const allSummaries = getLocalSummaries();
    const localMatch = allSummaries.find(
      (s) =>
        s &&
        (String(s.id || "").trim() === cleanId ||
          (s.title && String(s.title).toLowerCase() === cleanIdLower) ||
          (cleanId.length > 5 && s.title && String(s.title).toLowerCase().includes(cleanIdLower)))
    );
    if (localMatch) {
      unTombstoneEntity("summary", localMatch.id, localMatch.title);
      return {
        ...localMatch,
        htmlContent: sanitizeAndFormatForDawJang(localMatch.htmlContent),
      };
    }

    // 2. Recherche directe brute dans tous les registres localStorage (sans filtre tombstone)
    const rawKeys = [
      "hippocampus_clean_summaries_v2",
      "hippocampus_clean_summaries",
      "hippocampus_local_summaries_v2",
      "hippocampus_clean_summaries_v4",
      "hippocampus_saved_summaries_v2",
      "dawjang_last_generated_summary",
    ];
    for (const k of rawKeys) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const match = list.find(
            (s: any) =>
              s &&
              (String(s.id).trim() === cleanId ||
                s.id === cleanId ||
                (s.title && String(s.title).toLowerCase() === cleanIdLower) ||
                cleanId === "last" ||
                cleanId === "latest" ||
                cleanId === "new")
          );
          if (match && (match.htmlContent || match.content)) {
            const normalizedMatch: EditorSummaryItem = {
              id: String(match.id || cleanId),
              title: String(match.title || "Synthèse sans titre"),
              subject: String(match.subject || match.discipline || "Médecine"),
              updatedAt: String(match.updatedAt || "Aujourd'hui"),
              wordCount: Number(match.wordCount) || 100,
              doctrineLabel: String(
                match.doctrineLabel ||
                DOCTRINE_LABELS.objectives_verbatim
              ),
              htmlContent: sanitizeAndFormatForDawJang(match.htmlContent || match.content || ""),
            };
            unTombstoneEntity("summary", normalizedMatch.id, normalizedMatch.title);
            saveLocalSummaries([
              normalizedMatch,
              ...getLocalSummaries().filter((s) => s.id !== normalizedMatch.id),
            ]);
            return normalizedMatch;
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Secours de session ou dernier résumé généré
    try {
      const backupRaw =
        sessionStorage.getItem(`dawjang_active_summary_${cleanId}`) ||
        localStorage.getItem("dawjang_last_generated_summary");
      if (backupRaw) {
        const backup = JSON.parse(backupRaw);
        if (
          backup &&
          (backup.id === cleanId ||
            !cleanId ||
            cleanId.startsWith("sum-") ||
            cleanId === "latest" ||
            cleanId === "last" ||
            cleanId === "new" ||
            allSummaries.length === 0)
        ) {
          const normalizedBackup: EditorSummaryItem = {
            id: String(backup.id || cleanId),
            title: String(backup.title || "Synthèse sans titre"),
            subject: String(backup.subject || backup.discipline || "Médecine"),
            updatedAt: String(backup.updatedAt || "Aujourd'hui"),
            wordCount: Number(backup.wordCount) || 100,
            doctrineLabel: String(
              backup.doctrineLabel ||
              DOCTRINE_LABELS.objectives_verbatim
            ),
            htmlContent: sanitizeAndFormatForDawJang(backup.htmlContent || backup.content || ""),
          };
          unTombstoneEntity("summary", normalizedBackup.id, normalizedBackup.title);
          saveLocalSummaries([
            normalizedBackup,
            ...getLocalSummaries().filter((s) => s.id !== normalizedBackup.id),
          ]);
          return normalizedBackup;
        }
      }
    } catch {
      // ignore
    }

    // 4. Filet de sécurité : si l'identifiant est un ID temporaire et qu'on a des résumés locaux
    if (allSummaries.length > 0 && cleanId.startsWith("sum-")) {
      return allSummaries[0];
    }

    // 5. Filet de sécurité ultime : charger le dernier résumé généré ou le premier disponible
    try {
      const fallbackLast = localStorage.getItem("dawjang_last_generated_summary");
      if (fallbackLast) {
        const parsed = JSON.parse(fallbackLast);
        if (parsed && (parsed.htmlContent || parsed.content)) {
          return {
            id: String(parsed.id || cleanId),
            title: String(parsed.title || "Synthèse Médicale"),
            subject: String(parsed.subject || "Médecine"),
            updatedAt: String(parsed.updatedAt || "Aujourd'hui"),
            wordCount: Number(parsed.wordCount) || 100,
            doctrineLabel: String(parsed.doctrineLabel || DOCTRINE_LABELS.objectives_verbatim),
            htmlContent: sanitizeAndFormatForDawJang(parsed.htmlContent || parsed.content || ""),
          };
        }
      }
    } catch {
      // ignore
    }

    if (allSummaries.length > 0) {
      return allSummaries[0];
    }

    return null;
  }, []);

  const [summary, setSummary] = useState<EditorSummaryItem | null>(() => {
    if (!id) return null;
    return resolveSummaryLocally(id);
  });
  const [loading, setLoading] = useState<boolean>(!summary);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const loadSummaryById = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    const cleanId = decodeURIComponent(id).trim();

    const localMatch = resolveSummaryLocally(cleanId);
    if (localMatch) {
      setSummary(localMatch);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
      let query = supabase.from("summaries").select("*");
      if (isUuid) {
        query = query.eq("id", cleanId);
      } else if (!cleanId.startsWith("sum-")) {
        query = query.ilike("title", `%${cleanId}%`);
      } else {
        query = query.order("created_at", { ascending: false }).limit(1);
      }
      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        const row: any = data;
        const rawContent = row.content || "";
        const cleanedMarkdown = sanitizeAndFormatForDawJang(
          cleanAndStructureMarkdown(rawContent)
        );
        const plain = cleanedMarkdown.replace(/[#*`>|]/g, " ");
        const wc = Math.max(1, plain.trim().split(/\s+/).filter(Boolean).length);
        const meta = row.metadata || {};

        const loadedItem: EditorSummaryItem = {
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

        unTombstoneEntity("summary", loadedItem.id, loadedItem.title);
        setSummary(loadedItem);
        const currentLocal = getLocalSummaries();
        saveLocalSummaries([
          loadedItem,
          ...currentLocal.filter((item) => item.id !== loadedItem.id),
        ]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id, resolveSummaryLocally]);

  useEffect(() => {
    loadSummaryById();
  }, [loadSummaryById]);

  const handleSaveSummary = async (updatedHtml: string, updatedTitle: string) => {
    if (!summary) return;
    const plain = updatedHtml.replace(/<[^>]*>/g, " ").replace(/[#*`>|]/g, " ");
    const wc = Math.max(1, plain.trim().split(/\s+/).filter(Boolean).length);

    const updatedItem: EditorSummaryItem = {
      ...summary,
      title: updatedTitle,
      htmlContent: updatedHtml,
      wordCount: wc,
      updatedAt: "À l'instant",
    };

    setSummary(updatedItem);

    const existing = getLocalSummaries();
    saveLocalSummaries(
      existing.some((s) => s.id === summary.id)
        ? existing.map((s) => (s.id === summary.id ? updatedItem : s))
        : [updatedItem, ...existing]
    );

    try {
      await untypedTable("summaries")
        .update({
          title: updatedTitle,
          content: updatedHtml,
        })
        .eq("id", summary.id);
    } catch {
      // Sauvegardé en local
    }

    toast({
      title: "Modifications enregistrées",
      description: "Votre synthèse a été mise à jour.",
    });
  };

  const handleExportWord = async () => {
    if (!summary) return;
    await exportSummaryToWord(summary.title, summary.htmlContent);
    toast({
      title: "Export Word (.docx) réussi",
      description: `Le fichier "${summary.title}.docx" a été téléchargé.`,
    });
  };

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-16 text-center space-y-3">
        <Loader2 className="h-8 w-8 text-[#D96B43] animate-spin mx-auto" />
        <p className="text-sm text-[#71717A]">Ouverture de votre synthèse académique...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 md:px-8 py-16">
        <div className="rounded-2xl border border-[#EAE4DC] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] dark:bg-zinc-800 border border-[#EAE4DC] dark:border-zinc-700 flex items-center justify-center mx-auto">
            <BookOpen className="h-5 w-5 text-[#D96B43]" />
          </div>
          <h2 className="text-xl font-serif font-semibold text-[#18181B] dark:text-zinc-100">
            Synthèse introuvable
          </h2>
          <p className="text-xs text-[#71717A] max-w-md mx-auto">
            Cette synthèse n'existe plus ou a été supprimée de votre bibliothèque.
          </p>
          <div className="flex items-center justify-center gap-2.5 pt-2">
            <Button
              variant="outline"
              onClick={() => navigate("/summaries")}
              className="rounded-xl border-[#EAE4DC] text-xs gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Retour à la Bibliothèque</span>
            </Button>
            <Button
              onClick={() => navigate("/summaries/new")}
              className="rounded-xl bg-[#18181B] text-[#FAF8F5] text-xs"
            >
              Créer une nouvelle synthèse
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const atlasCourse = React.useMemo(() => {
    if (!summary?.htmlContent) return null;
    return tryParseAtlasMagistralHtml(summary.htmlContent);
  }, [summary?.htmlContent]);

  if (atlasCourse) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-6">
        <AtlasMagistralViewer
          course={atlasCourse}
          onBack={() => navigate("/summaries")}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-6">
      <EditorView
        summary={summary}
        onBack={() => navigate("/summaries")}
        onSave={handleSaveSummary}
        onExportPDF={() => setIsPdfModalOpen(true)}
        onExportWord={handleExportWord}
        onRecalibrate={() => navigate("/summaries/new")}
      />

      <PdfExportStudioModal
        open={isPdfModalOpen}
        onOpenChange={setIsPdfModalOpen}
        mode="summary"
        title={summary.title}
        htmlOrMarkdownContent={summary.htmlContent}
        subject={summary.subject}
        architectureLabel={summary.doctrineLabel}
      />
    </div>
  );
}
