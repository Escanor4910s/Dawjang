// src/components/synthesis/HarvardWorkflow.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { invokeWithRetry } from "@/lib/edgeRetry";
import { HarvardRenderer, HarvardEditor } from "./HarvardEditor";
import { downloadPdf } from "@/utils/backendPdfExport";
import { cleanAndStructureMarkdown } from "@/utils/formatters";
import { summaryDocToStructuredMarkdown, type SummaryDoc } from "@/lib/summaryDocConverter";
import { Sparkles, Download, Loader2, BookOpen, PenTool, CheckCircle2 } from "lucide-react";

/**
 * Construit le prompt impératif pour la Méthode Harvard
 */
export const generateHarvardPrompt = (objectives: string[], wordLimit: number) => `
Tu es un expert médical. Génère un résumé précis en mode Harvard pour ces objectifs :

${objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}

Pour chaque objectif, structure en texte Markdown strictement comme suit :

## 1. Idée maîtresse  
Phrase claire précisant le concept principal.

## 2. Mécanisme  
Courte explication physiopathologique (2-3 phrases max).

## 3. Preuve clinique  
Données chiffrées, études ou faits validant ce mécanisme.

## 4. Décision clinique  
La règle pratique ou recommandation.

Respecte l'ordre et ne dépasse pas ${wordLimit} mots au total. Sois concis, clair et évite digressions.

Rends la réponse en Markdown, avec titres et listes selon la structure.
`;

/**
 * Fonction de génération IA dédiée au mode Harvard
 */
export async function generateHarvardSummary(
  objectives: string[],
  wordLimit: number = 2000,
  invoker = invokeWithRetry
): Promise<string> {
  const prompt = generateHarvardPrompt(objectives, wordLimit);

  const { data, error } = await invoker<{
    summary?: string | SummaryDoc;
    content?: string;
    text?: string;
  }>("generate-summary", {
    body: {
      prompt,
      objectives,
      targetWordCount: wordLimit,
      doctrine: "harvard_method",
      content: objectives.join("\n"),
    },
    retries: 2,
  });

  if (error) {
    throw new Error(error.message || "Erreur lors de la génération de la synthèse.");
  }

  let summaryMd = "";
  if (data?.summary) {
    summaryMd =
      typeof data.summary === "object"
        ? summaryDocToStructuredMarkdown(data.summary)
        : String(data.summary);
  } else if (data?.content) {
    summaryMd = String(data.content);
  } else if (data?.text) {
    summaryMd = String(data.text);
  }

  return cleanAndStructureMarkdown(summaryMd.trim());
}

export interface HarvardWorkflowProps {
  onSummaryGenerated?: (title: string, markdown: string) => void;
  className?: string;
}

export default function HarvardWorkflow({
  onSummaryGenerated,
  className = "",
}: HarvardWorkflowProps) {
  const { toast } = useToast();

  const [title, setTitle] = useState<string>("Synthèse Mode Harvard");
  const [objectivesText, setObjectivesText] = useState<string>(
    `1. Définir les anomalies de l'hémostase primaire
2. Décrire la physiopathologie du clou plaquettaire
3. Identifier les signes cliniques cutanéo-muqueux d'alerte
4. Poser la démarche diagnostique et éliminer la fausse thrombopénie`
  );
  const [summaryMd, setSummaryMd] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"preview" | "blocks">("preview");

  const wordCount = summaryMd.trim().split(/\s+/).filter(Boolean).length;

  const handleGenerate = async () => {
    const objectives = objectivesText
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);

    if (objectives.length === 0) {
      toast({
        title: "Objectifs requis",
        description: "Veuillez renseigner au moins un objectif de cours.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const generatedMd = await generateHarvardSummary(objectives, 2000, invokeWithRetry);
      setSummaryMd(generatedMd);
      toast({
        title: "Synthèse Harvard générée",
        description: "Les 4 piliers ont été structurés avec succès.",
      });

      if (onSummaryGenerated) {
        onSummaryGenerated(title, generatedMd);
      }
    } catch (err: any) {
      toast({
        title: "Erreur de génération",
        description: err.message || "Impossible de contacter l'IA.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPdf = async () => {
    if (!summaryMd.trim()) {
      toast({
        title: "Synthèse vide",
        description: "Veuillez d'abord générer la synthèse.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const today = new Date().toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      await downloadPdf(summaryMd, title, today, "DWJ-2026-1657");
    } catch (err: any) {
      toast({
        title: "Erreur d'exportation",
        description: err.message || "Échec de l'exportation PDF.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`max-w-5xl mx-auto space-y-6 ${className}`}>
      {/* CARTE DE CONFIGURATION ET GÉNÉRATION */}
      <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                Générateur Méthode Harvard (4 Piliers)
              </h2>
            </div>
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
              Harvard Academic Framework
            </Badge>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Titre du résumé :
              </label>
              <input
                type="text"
                className="w-full p-3 bg-muted/30 border border-border rounded-xl text-base sm:text-lg font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Ex: Pathologies de l'Hémostase Primaire"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isGenerating}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Objectifs pédagogiques (1 par ligne) :
              </label>
              <textarea
                className="w-full p-3.5 bg-muted/30 border border-border rounded-xl h-36 font-sans text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y leading-relaxed"
                placeholder="Ex :&#10;1. Définir le concept...&#10;2. Décrire la physiopathologie...&#10;3. Identifier la démarche..."
                value={objectivesText}
                onChange={(e) => setObjectivesText(e.target.value)}
                disabled={isGenerating}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !objectivesText.trim()}
              size="lg"
              className="w-full py-4 text-base font-bold rounded-xl gap-2 shadow-sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Génération structurée en cours (Méthode Harvard)…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Générer la synthèse Harvard</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* RÉSULTAT ET ESPACE D'ÉDITION */}
      {summaryMd && (
        <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-bold text-foreground">
                  Synthèse Structurée ({wordCount} mots)
                </h3>
              </div>

              {/* Bascule Vue : Aperçu Chromatique vs Édition par Blocs */}
              <div className="inline-flex items-center p-1 rounded-xl bg-muted border border-border">
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === "preview"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Aperçu Chromatique
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("blocks")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === "blocks"
                      ? "bg-card text-amber-600 font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Éditeur par Blocs
                </button>
              </div>
            </div>

            {/* Contenu selon l'onglet actif */}
            {activeTab === "preview" ? (
              <div className="bg-background p-6 rounded-xl border border-border">
                <HarvardRenderer markdown={summaryMd} />
              </div>
            ) : (
              <HarvardEditor
                initialMarkdown={summaryMd}
                onChange={setSummaryMd}
              />
            )}

            {/* Action d'Exportation PDF Premium */}
            <div className="pt-2">
              <Button
                onClick={handleExportPdf}
                disabled={isExporting}
                size="lg"
                className="w-full py-4 text-base font-bold rounded-xl gap-2 shadow-sm"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Compilation du PDF DawJang Press (Puppeteer)…</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Exporter en PDF Haute Qualité (DawJang A4)</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
