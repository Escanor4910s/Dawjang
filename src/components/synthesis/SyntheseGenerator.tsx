// src/components/synthesis/SyntheseGenerator.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { invokeWithRetry as defaultInvoke } from "@/lib/edgeRetry";
import { exportViaPuppeteerBackend } from "@/utils/backendPdfExport";
import { printDawjangPdf } from "@/utils/dawjangPdfTemplate";
import { generateSummary, type Doctrine } from "@/utils/doctrineGenerators";
import { DoctrineRenderer } from "./DoctrineRenderer";
import { DOCTRINE_CONFIG, DOCTRINES_LIST } from "@/config/doctrineConfig";
import { Sparkles, Download, Loader2, BookOpen, Printer } from "lucide-react";

export interface SyntheseGeneratorProps {
  invokeWithRetry?: Function;
  exportPdf?: (title: string, content: string) => void | Promise<void>;
  initialDoctrine?: Doctrine;
  initialTitle?: string;
  className?: string;
}

export default function SyntheseGenerator({
  invokeWithRetry = defaultInvoke,
  exportPdf,
  initialDoctrine = "objectives_verbatim",
  initialTitle = "",
  className = "",
}: SyntheseGeneratorProps) {
  const { toast } = useToast();
  const [doctrine, setDoctrine] = useState<Doctrine>(initialDoctrine);
  const [objectivesText, setObjectivesText] = useState("");
  const [summaryMd, setSummaryMd] = useState("");
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [wordLimit, setWordLimit] = useState(2500);

  const wordCount = summaryMd.trim().split(/\s+/).filter(Boolean).length;
  const activeConfig = DOCTRINE_CONFIG[doctrine] || DOCTRINE_CONFIG.objectives_verbatim;
  const Editor = activeConfig.editorComponent;
  const Renderer = activeConfig.rendererComponent;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const objectives = objectivesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      if (objectives.length === 0) {
        throw new Error("Veuillez saisir au moins un objectif de cours.");
      }

      const md = await generateSummary({
        doctrine,
        objectives,
        wordLimit,
        invokeWithRetry,
      });

      setSummaryMd(md);
      toast({
        title: "Synthèse générée avec succès",
        description: `Doctrine : ${doctrine} • ${md.split(/\s+/).filter(Boolean).length} mots.`,
      });
    } catch (e: any) {
      toast({
        title: "Erreur de génération",
        description: e.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const docTitle = title.trim() || "Synthèse Médicale";
    if (exportPdf) {
      await exportPdf(docTitle, summaryMd);
    } else {
      await exportViaPuppeteerBackend(docTitle, summaryMd);
    }
  };

  return (
    <div className={`space-y-6 max-w-4xl mx-auto p-4 sm:p-6 ${className}`}>
      <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg text-foreground">Générateur Modulaire de Synthèse</h2>
            </div>
            <select
              value={doctrine}
              onChange={(e) => setDoctrine(e.target.value as Doctrine)}
              className="px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {DOCTRINES_LIST.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.label} ({doc.badge})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la synthèse (ex: Insuffisance Cardiaque Aiguë)..."
              className="w-full p-3 rounded-xl border border-border bg-background text-foreground font-bold text-base focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <div className="space-y-1.5">
              <Editor input={objectivesText} onInputChange={setObjectivesText} />
            </div>


            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Volume cible :</span>
              {[1500, 2500, 3000, 4000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setWordLimit(preset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    wordLimit === preset
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {preset} mots
                </button>
              ))}
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading || !objectivesText.trim()}
              className="w-full py-3.5 font-bold rounded-xl gap-2 shadow-sm"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{activeConfig.loadingText}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{activeConfig.buttonText}</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {summaryMd && (
        <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <h3 className="font-bold text-lg text-foreground">
                Rendu Spécifique — {doctrine}
              </h3>
              <Badge variant="secondary" className="font-mono text-xs">
                {wordCount} mots
              </Badge>
            </div>

            {/* Rendu Modulaire adaptatif selon la doctrine active */}
            <div className="bg-background p-6 rounded-xl border border-border shadow-xs">
              <Renderer markdown={summaryMd} />
            </div>


            {/* Actions d'Exportation PDF */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                onClick={handleExport}
                className="flex-1 py-3 font-bold rounded-xl gap-2 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Exporter en PDF Premium</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => printDawjangPdf(title || "Synthèse", summaryMd)}
                className="py-3 font-semibold rounded-xl gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Impression Directe A4</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
