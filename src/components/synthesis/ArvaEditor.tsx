// src/components/synthesis/ArvaEditor.tsx
import React, { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Brain, FileText, CheckCircle2, AlertCircle, BookOpen, Layers } from "lucide-react";

export interface ArvaEditorProps {
  input?: string;
  onInputChange?: (value: string) => void;
  markdown?: string;
  onChange?: (markdown: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Analyse un texte Markdown pour extraire les 4 sections ARVA obligatoires
 */
function parseArvaMarkdown(rawText: string) {
  let matrice = "";
  let scripts = "";
  let vignette = "";
  let visas = "";

  if (!rawText || !rawText.trim()) {
    return { matrice, scripts, vignette, visas, isArvaDocument: false };
  }

  const sections = rawText.split(/^##\s+/gm);
  let foundCount = 0;

  sections.forEach((section) => {
    const lines = section.trim().split("\n");
    const heading = (lines[0] || "").toLowerCase();
    const body = lines.slice(1).join("\n").trim();

    if (heading.includes("active recall") || heading.includes("matrice") || heading.includes("questions")) {
      matrice = body;
      foundCount++;
    } else if (heading.includes("scripts") || heading.includes("différentiel") || heading.includes("differentiel") || heading.includes("illness")) {
      scripts = body;
      foundCount++;
    } else if (heading.includes("vignette") || heading.includes("cas clinique") || heading.includes("application")) {
      vignette = body;
      foundCount++;
    } else if (heading.includes("visa") || heading.includes("révision") || heading.includes("revision") || heading.includes("notes")) {
      visas = body;
      foundCount++;
    }
  });

  return {
    matrice,
    scripts,
    vignette,
    visas,
    isArvaDocument: foundCount >= 2,
  };
}

/**
 * Éditeur spécialisé ARVA Excellence
 * Offre un mode blocs pour les 4 sections ARVA et un mode entrée libre / objectifs.
 */
export function ArvaEditor({
  input,
  onInputChange,
  markdown,
  onChange,
  className = "",
  disabled = false,
}: ArvaEditorProps) {
  const effectiveText = input !== undefined ? input : markdown || "";
  const parsed = useMemo(() => parseArvaMarkdown(effectiveText), [effectiveText]);

  const [activeTab, setActiveTab] = useState<string>(parsed.isArvaDocument ? "blocks" : "raw");
  const [rawText, setRawText] = useState(effectiveText);
  const [matrice, setMatrice] = useState(parsed.matrice);
  const [scripts, setScripts] = useState(parsed.scripts);
  const [vignette, setVignette] = useState(parsed.vignette);
  const [visas, setVisas] = useState(parsed.visas);

  // Synchronisation descendante
  useEffect(() => {
    setRawText(effectiveText);
    const p = parseArvaMarkdown(effectiveText);
    setMatrice(p.matrice);
    setScripts(p.scripts);
    setVignette(p.vignette);
    setVisas(p.visas);
  }, [effectiveText]);

  const emitChange = (val: string) => {
    setRawText(val);
    if (onInputChange) onInputChange(val);
    if (onChange) onChange(val);
  };

  const handleBlockUpdate = (
    nextMatrice: string,
    nextScripts: string,
    nextVignette: string,
    nextVisas: string
  ) => {
    setMatrice(nextMatrice);
    setScripts(nextScripts);
    setVignette(nextVignette);
    setVisas(nextVisas);

    const assembled = [
      `## 1. Matrice Active Recall (Questions & Preuves du cours)\n${nextMatrice.trim()}`,
      `## 2. Scripts Cliniques Différentiels (Harvard Illness Scripts)\n${nextScripts.trim()}`,
      `## 3. Vignette Clinique d'Application (Case Based Clinical Learning)\n${nextVignette.trim()}`,
      `## 4. Visas de Révision & Annotations Personnelles\n${nextVisas.trim()}`,
    ].join("\n\n");

    emitChange(assembled);
  };

  const countWords = (text: string) =>
    (text || "").trim().split(/\s+/).filter(Boolean).length;

  const totalWords = countWords(effectiveText);
  const matriceWords = countWords(matrice);
  const scriptsWords = countWords(scripts);
  const vignetteWords = countWords(vignette);
  const visasWords = countWords(visas);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-2">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-foreground">Éditeur ARVA Excellence</span>
          <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-500/30">
            {totalWords} mots
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="h-7 p-0.5 bg-muted">
            <TabsTrigger value="raw" className="text-[11px] h-6 px-2.5 gap-1">
              <FileText className="w-3 h-3" />
              Saisie Objectifs
            </TabsTrigger>
            <TabsTrigger value="blocks" className="text-[11px] h-6 px-2.5 gap-1">
              <Layers className="w-3 h-3" />
              4 Blocs ARVA
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "raw" ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Objectifs et axes cliniques pour la génération ARVA (1 par ligne) :</span>
            <span className="font-mono text-[11px]">{countWords(rawText)} mots</span>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => emitChange(e.target.value)}
            disabled={disabled}
            rows={7}
            className="w-full p-3.5 bg-background border border-border rounded-xl font-sans text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-y"
            placeholder="1. Identifier les critères de gravité de l'insuffisance cardiaque aiguë&#10;2. Hiérarchiser le bilan biologique et paraclinique discriminant en urgence&#10;3. Poser la démarche thérapeutique graduée&#10;4. Reconnaître les pièges diagnostiques et facteurs déclenchants"
          />
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {/* Bloc 1 : Matrice Active Recall */}
          <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-50/20 dark:bg-blue-950/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-300">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                1. Matrice Active Recall (QCM + Preuves)
              </span>
              <span className="font-mono text-[10px]">{matriceWords} mots (~30%)</span>
            </div>
            <textarea
              value={matrice}
              onChange={(e) => handleBlockUpdate(e.target.value, scripts, vignette, visas)}
              rows={4}
              disabled={disabled}
              placeholder="Questions fermées de haute valeur ajoutée, constantes et preuves..."
              className="w-full p-2.5 bg-background border border-border rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Bloc 2 : Scripts Cliniques Différentiels */}
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-300">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                2. Scripts Cliniques Différentiels (Tableaux comparatifs)
              </span>
              <span className="font-mono text-[10px]">{scriptsWords} mots (~30%)</span>
            </div>
            <textarea
              value={scripts}
              onChange={(e) => handleBlockUpdate(matrice, e.target.value, vignette, visas)}
              rows={4}
              disabled={disabled}
              placeholder="Tableau Markdown (| Pathologie | Signes discriminants | Pièges |)..."
              className="w-full p-2.5 bg-background border border-border rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Bloc 3 : Vignette Clinique */}
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-emerald-500" />
                3. Vignette Clinique d'Application (Cas Réaliste)
              </span>
              <span className="font-mono text-[10px]">{vignetteWords} mots (~30%)</span>
            </div>
            <textarea
              value={vignette}
              onChange={(e) => handleBlockUpdate(matrice, scripts, e.target.value, visas)}
              rows={4}
              disabled={disabled}
              placeholder="Cas clinique immersif : anamnèse, constantes, décision et résolution..."
              className="w-full p-2.5 bg-background border border-border rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Bloc 4 : Visas de Révision */}
          <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <span className="flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-indigo-500" />
                4. Visas de Révision & Annotations Personnelles
              </span>
              <span className="font-mono text-[10px]">{visasWords} mots (~10%)</span>
            </div>
            <textarea
              value={visas}
              onChange={(e) => handleBlockUpdate(matrice, scripts, vignette, e.target.value)}
              rows={3}
              disabled={disabled}
              placeholder="Points docimologiques capitaux, pièges d'examen et rappels..."
              className="w-full p-2.5 bg-background border border-border rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ArvaEditor;
