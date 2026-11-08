// src/components/synthesis/MarkdownEditorWithPdfExport.tsx
import React, { useState, useMemo } from "react";
import ReactMde from "react-mde";
import Showdown from "showdown";
import "react-mde/lib/styles/css/react-mde-all.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { downloadPdf } from "@/utils/backendPdfExport";
import { Download, FileText, Loader2, Sparkles } from "lucide-react";

export interface MarkdownEditorWithPdfExportProps {
  initialMarkdown?: string;
  initialTitle?: string;
  onSave?: (title: string, markdown: string) => void;
  className?: string;
}

export default function MarkdownEditorWithPdfExport({
  initialMarkdown,
  initialTitle = "Synthèse Médicale Exemple",
  onSave,
  className = "",
}: MarkdownEditorWithPdfExportProps) {
  const { toast } = useToast();

  const [markdown, setMarkdown] = useState<string>(
    initialMarkdown ||
      `# 1. Définir les pathologies de l'hémostase primaire (PHP)

**Définition maîtresse :** Anomalie acquise ou héréditaire empêchant la formation du clou hémostatique plaquettaire.

> [Note] ⚠️ Piège QCM : Ne pas confondre les anomalies de l'hémostase primaire avec les troubles de la coagulation plasmatique.

## Modalités de survenue et séméiologie

- Saignements spontanés ou provoqués par des traumatismes minimes.
- Atteinte cutanéo-muqueuse prédominante (purpura pétéchial ou ecchymotique, gingivorragies, épistaxis).

> ✓ Règle d'or : Toujours éliminer une fausse thrombopénie à l'EDTA par contrôle sur tube citraté.
`
  );

  const [title, setTitle] = useState<string>(initialTitle);
  const [selectedTab, setSelectedTab] = useState<"write" | "preview">("write");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const converter = useMemo(
    () =>
      new Showdown.Converter({
        tables: true,
        simplifiedAutoLink: true,
        strikethrough: true,
        tasklists: true,
        smoothLivePreview: true,
      }),
    []
  );

  const wordCount = useMemo(() => {
    return markdown.trim().split(/\s+/).filter(Boolean).length;
  }, [markdown]);

  const handleDownloadPdf = async () => {
    if (!markdown.trim()) {
      toast({
        title: "Contenu vide",
        description: "Veuillez renseigner le contenu de la synthèse avant d'exporter.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const today = new Date().toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      await downloadPdf(markdown, title.trim() || "Synthèse Médicale", today, "DWJ-2026-1657");

      if (onSave) {
        onSave(title, markdown);
      }
    } catch (e: any) {
      toast({
        title: "Erreur export PDF",
        description: e.message || "Impossible de compiler le PDF.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={`max-w-5xl mx-auto border-border shadow-sm rounded-2xl overflow-hidden bg-card ${className}`}>
      <CardContent className="p-6 sm:p-8 space-y-6">
        {/* En-tête : Titre & Compteur de mots */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full sm:flex-1 p-2 text-xl sm:text-2xl font-extrabold text-foreground bg-transparent focus:outline-none focus:border-b-2 border-primary transition-all"
            placeholder="Titre de la synthèse..."
          />
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Badge variant="secondary" className="font-mono text-xs px-2.5 py-1">
              {wordCount} mots
            </Badge>
            <Badge variant="outline" className="text-xs text-primary border-primary/30">
              <Sparkles className="w-3 h-3 mr-1" />
              DawJang A4
            </Badge>
          </div>
        </div>

        {/* Éditeur React MDE avec onglets Write / Preview */}
        <div className="rounded-xl border border-border overflow-hidden bg-background">
          <ReactMde
            value={markdown}
            onChange={setMarkdown}
            selectedTab={selectedTab}
            onTabChange={setSelectedTab}
            generateMarkdownPreview={(md) =>
              Promise.resolve(converter.makeHtml(md))
            }
            minEditorHeight={420}
          />
        </div>

        {/* Action Export PDF */}
        <div className="pt-2">
          <Button
            onClick={handleDownloadPdf}
            disabled={isLoading}
            size="lg"
            className="w-full py-4 text-base font-bold rounded-xl gap-2 shadow-sm transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Génération du PDF DawJang Press (Puppeteer)…</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Exporter en PDF de qualité (DawJang A4)</span>
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
