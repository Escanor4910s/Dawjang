// src/components/synthesis/ArvaSyntheseEditor.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { invokeWithRetry } from "@/lib/edgeRetry";
import { ArvaRenderer } from "./ArvaRenderer";
import { downloadPdf } from "@/utils/backendPdfExport";
import { generateSummaryWithRetry } from "@/utils/doctrineGenerators";
import { Brain, Download, Loader2, Sparkles, CheckCircle2, Award } from "lucide-react";

export interface ArvaSyntheseEditorProps {
  onSummaryGenerated?: (title: string, markdown: string) => void;
  className?: string;
}

export default function ArvaSyntheseEditor({
  onSummaryGenerated,
  className = "",
}: ArvaSyntheseEditorProps) {
  const { toast } = useToast();

  const [title, setTitle] = useState<string>("Synthèse Médicale ARVA");
  const [objectives, setObjectives] = useState<string>(
    `1. Identifier les critères de gravité de l'insuffisance cardiaque aiguë
2. Hiérarchiser le bilan biologique et paraclinique en urgence
3. Poser la démarche thérapeutique graduée (diurétiques, vasodilatateurs, inotropes)
4. Reconnaître les pièges diagnostiques et facteurs déclenchants décompensants`
  );
  const [markdown, setMarkdown] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const wordCount = markdown.trim().split(/\s+/).filter(Boolean).length;

  const handleGenerateArva = async () => {
    const objList = objectives
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);

    if (objList.length === 0) {
      toast({
        title: "Objectifs requis",
        description: "Veuillez saisir au moins un objectif de cours.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const generated = await generateSummaryWithRetry({
        objectives: objList,
        doctrine: "arva",
        targetWordCount: 0,
        invokeWithRetry,
        courseTitle: title,
      });

      setMarkdown(generated);
      toast({
        title: "Synthèse ARVA générée",
        description: "Matrice, Scripts cliniques, Vignette et Visas structurés avec succès.",
      });

      if (onSummaryGenerated) {
        onSummaryGenerated(title, generated);
      }
    } catch (e: any) {
      toast({
        title: "Erreur de génération",
        description: e.message || "Échec de la génération ARVA.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPdf = async () => {
    if (!markdown.trim()) {
      toast({
        title: "Document vide",
        description: "Veuillez d'abord générer la synthèse ARVA.",
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
      await downloadPdf(markdown, title, today, "DWJ-ARVA-2026");
    } catch (err: any) {
      toast({
        title: "Erreur d'exportation",
        description: err.message || "Impossible de générer le PDF.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`max-w-5xl mx-auto space-y-6 ${className}`}>
      {/* PANNEAU DE CONFIGURATION ARVA */}
      <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden border-t-4 border-t-indigo-600">
        <CardContent className="p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  Générateur ARVA Excellence (Active Recall + Harvard + Vignette)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Matrice QCM (30%) • Scripts Différentiels (30%) • Cas Clinique (30%) • Visas (10%)
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs text-indigo-600 border-indigo-500/30 font-semibold gap-1">
              <Award className="w-3.5 h-3.5 text-indigo-500" />
              Qualité Élite
            </Badge>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Titre de la synthèse ARVA :
              </label>
              <input
                type="text"
                className="w-full p-3 bg-muted/30 border border-border rounded-xl text-base sm:text-lg font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Ex: Insuffisance Cardiaque Aiguë — Monographie ARVA"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Objectifs & thèmes cliniques (1 par ligne) :
              </label>
              <textarea
                className="w-full p-3.5 bg-muted/30 border border-border rounded-xl h-36 font-sans text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y leading-relaxed"
                placeholder="1. Définir...&#10;2. Décrire...&#10;3. Identifier..."
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button
              onClick={handleGenerateArva}
              disabled={isLoading || !objectives.trim()}
              size="lg"
              className="w-full py-4 text-base font-bold rounded-xl gap-2 shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Compilation des 4 sections ARVA en cours (Exhaustivité 100 %)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Générer la Synthèse ARVA Complète</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* RÉSULTAT ET ESPACE D'AFFICHAGE */}
      {markdown && (
        <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-foreground">
                  Monographie ARVA Finalisée ({wordCount} mots)
                </h3>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                Active Recall • Illness Scripts • Vignette
              </Badge>
            </div>

            {/* Rendu Haute Fidélité ARVA */}
            <div className="bg-background p-6 sm:p-8 rounded-xl border border-border shadow-xs">
              <ArvaRenderer markdown={markdown} />
            </div>

            {/* Action d'Exportation PDF DawJang Press */}
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
                    <span>Génération du PDF ARVA Premium (Puppeteer)…</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Exporter en PDF Premium DawJang Press (A4)</span>
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
