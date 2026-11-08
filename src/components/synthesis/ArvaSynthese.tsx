// src/components/synthesis/ArvaSynthese.tsx
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { invokeWithRetry as defaultInvoke } from "@/lib/edgeRetry";
import { exportViaPuppeteerBackend } from "@/utils/backendPdfExport";
import { generateArvaSummary } from "@/utils/doctrineGenerators";
import { ArvaRenderer } from "./ArvaRenderer";

export interface ArvaSyntheseProps {
  invokeWithRetry?: Function;
  exportPdf?: (title: string, content: string) => void | Promise<void>;
  initialObjectives?: string;
  initialTitle?: string;
}

export default function ArvaSynthese({
  invokeWithRetry = defaultInvoke,
  exportPdf,
  initialObjectives = "",
  initialTitle = "Synthèse ARVA Exemple",
}: ArvaSyntheseProps) {
  const [objectivesText, setObjectivesText] = useState(initialObjectives);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [targetWordCount, setTargetWordCount] = useState<number>(3000);

  const generate = async () => {
    setLoading(true);
    try {
      const objectives = objectivesText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const s = await generateArvaSummary(objectives, targetWordCount, invokeWithRetry);
      setSummary(s);
    } catch (e: any) {
      alert("Erreur: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto p-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre de la synthèse ARVA"
        className="w-full p-2.5 border border-border rounded-xl bg-background text-foreground text-lg font-bold"
      />
      <textarea
        value={objectivesText}
        onChange={(e) => setObjectivesText(e.target.value)}
        className="w-full p-3 h-36 resize-y border border-border rounded-xl bg-background text-foreground font-sans text-sm leading-relaxed"
        placeholder="Objectifs du cours, un par ligne&#10;Ex:&#10;1. Définir le syndrome coronarien aigu&#10;2. Poser la prise en charge thérapeutique initiale"
      />
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-muted-foreground">Volume :</span>
        {[1500, 2500, 3000, 4000].map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => setTargetWordCount(count)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              targetWordCount === count
                ? "bg-indigo-600 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {count} mots
          </button>
        ))}
      </div>
      <Button
        disabled={loading || !objectivesText.trim()}
        onClick={generate}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
      >
        {loading ? "Génération ARVA en cours..." : "Générer synthèse ARVA"}
      </Button>

      {summary ? (
        <div className="space-y-4 mt-6">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="font-bold text-xl text-foreground">Aperçu synthèse ARVA</h2>
            <span className="text-xs font-mono text-muted-foreground">
              {summary.split(/\s+/).filter(Boolean).length} mots
            </span>
          </div>
          <div className="bg-card p-6 rounded-2xl border border-border shadow-xs">
            <ArvaRenderer markdown={summary} />
          </div>
          <Button
            onClick={async () => {
              if (exportPdf) {
                await exportPdf(title, summary);
              } else {
                await exportViaPuppeteerBackend(title, summary);
              }
            }}
            className="w-full py-3 font-bold rounded-xl"
            variant="default"
          >
            Exporter en PDF premium
          </Button>
        </div>
      ) : null}
    </div>
  );
}
