// src/components/synthesis/HarvardEditor.tsx
import React, { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Cog, BarChart3, AlertOctagon } from "lucide-react";

export interface HarvardRendererProps {
  markdown: string;
  className?: string;
}

/**
 * Rendu optimisé pour la Méthode Harvard :
 * Les titres h2 des 4 piliers bénéficient d'un balisage chromatique haute précision.
 */
export const HarvardRenderer: React.FC<HarvardRendererProps> = ({
  markdown,
  className = "",
}) => {
  const components = {
    h2: ({ node, ...props }: any) => {
      const text = String(props.children || "");
      const lower = text.toLowerCase();

      let borderClass = "border-l-4 pl-3.5 py-1 my-5 text-lg font-bold rounded-r-md transition-all ";
      let icon = null;

      if (lower.includes("idée") || lower.includes("takeaway") || lower.includes("concept")) {
        borderClass += "border-blue-500 bg-blue-50/60 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300";
        icon = <Lightbulb className="w-4 h-4 inline mr-2 text-blue-500" />;
      } else if (lower.includes("mécanisme") || lower.includes("physiopath") || lower.includes("mecanisme")) {
        borderClass += "border-amber-500 bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300";
        icon = <Cog className="w-4 h-4 inline mr-2 text-amber-500" />;
      } else if (lower.includes("preuve") || lower.includes("clinique") || lower.includes("biologie")) {
        borderClass += "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300";
        icon = <BarChart3 className="w-4 h-4 inline mr-2 text-emerald-500" />;
      } else if (lower.includes("décision") || lower.includes("action") || lower.includes("decision") || lower.includes("red flag")) {
        borderClass += "border-rose-500 bg-rose-50/60 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300";
        icon = <AlertOctagon className="w-4 h-4 inline mr-2 text-rose-500" />;
      } else {
        borderClass += "border-primary text-primary bg-primary/5";
      }

      return (
        <h2 className={`${borderClass} ${props.className || ""}`}>
          {icon}
          {props.children}
        </h2>
      );
    },
    p: (props: any) => (
      <p className="mb-3 text-foreground/90 leading-relaxed text-sm sm:text-base text-justify" {...props} />
    ),
    ul: (props: any) => (
      <ul className="list-disc list-outside ml-5 mb-3.5 space-y-1 text-sm sm:text-base" {...props} />
    ),
    ol: (props: any) => (
      <ol className="list-decimal list-outside ml-5 mb-3.5 space-y-1 text-sm sm:text-base" {...props} />
    ),
    li: (props: any) => (
      <li className="leading-snug text-foreground/90" {...props} />
    ),
    blockquote: (props: any) => (
      <blockquote className="border-l-4 border-primary/50 bg-muted/40 p-3 my-3 italic rounded-r text-sm text-foreground/80" {...props} />
    ),
  };

  return (
    <div className={`harvard-prose ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

export interface HarvardEditorProps {
  initialMarkdown?: string;
  onChange?: (markdown: string) => void;
  input?: string;
  onInputChange?: (value: string) => void;
  className?: string;
}

/**
 * Analyse un texte Markdown pour extraire les 4 piliers Harvard s'ils existent déjà
 */
function parseHarvardMarkdown(rawText: string) {
  let idee = "";
  let mecanisme = "";
  let preuve = "";
  let decision = "";

  if (!rawText || !rawText.trim()) {
    return { idee, mecanisme, preuve, decision };
  }

  const sections = rawText.split(/^##\s+/gm);
  sections.forEach((section) => {
    const lines = section.trim().split("\n");
    const heading = (lines[0] || "").toLowerCase();
    const body = lines.slice(1).join("\n").trim();

    if (heading.includes("idée") || heading.includes("takeaway") || heading.includes("concept")) {
      idee = body;
    } else if (heading.includes("mécanisme") || heading.includes("physiopath") || heading.includes("mecanisme")) {
      mecanisme = body;
    } else if (heading.includes("preuve") || heading.includes("clinique") || heading.includes("données")) {
      preuve = body;
    } else if (heading.includes("décision") || heading.includes("action") || heading.includes("decision")) {
      decision = body;
    }
  });

  // Si aucune section ## n'a été détectée, placer le texte dans l'idée maîtresse par défaut
  if (!idee && !mecanisme && !preuve && !decision && rawText.trim()) {
    idee = rawText.trim();
  }

  return { idee, mecanisme, preuve, decision };
}

/**
 * Éditeur par Blocs Dédié à la Méthode Harvard :
 * Idée Maîtresse -> Mécanisme -> Preuve Clinique -> Décision Clinique.
 */
export const HarvardEditor: React.FC<HarvardEditorProps> = ({
  initialMarkdown = "",
  onChange,
  input,
  onInputChange,
  className = "",
}) => {
  const effectiveMarkdown = input !== undefined ? input : initialMarkdown;
  const parsed = useMemo(() => parseHarvardMarkdown(effectiveMarkdown), [effectiveMarkdown]);

  const [idee, setIdee] = useState(parsed.idee);
  const [mecanisme, setMecanisme] = useState(parsed.mecanisme);
  const [preuve, setPreuve] = useState(parsed.preuve);
  const [decision, setDecision] = useState(parsed.decision);

  // Synchronisation descendante si le markdown parent change radicalement
  useEffect(() => {
    const newParsed = parseHarvardMarkdown(effectiveMarkdown);
    setIdee(newParsed.idee);
    setMecanisme(newParsed.mecanisme);
    setPreuve(newParsed.preuve);
    setDecision(newParsed.decision);
  }, [effectiveMarkdown]);

  // Synchronisation ascendante : réassemblage du Markdown Harvard
  const handleUpdate = (
    nextIdee: string,
    nextMecanisme: string,
    nextPreuve: string,
    nextDecision: string
  ) => {
    const generatedMarkdown = `## 1. Idée maîtresse
${nextIdee.trim()}

## 2. Mécanisme
${nextMecanisme.trim()}

## 3. Preuve clinique
${nextPreuve.trim()}

## 4. Décision clinique
${nextDecision.trim()}
`.trim();

    if (onChange) onChange(generatedMarkdown);
    if (onInputChange) onInputChange(generatedMarkdown);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* BLOC 1 : IDÉE MAÎTRESSE */}
      <Card className="border-l-4 border-l-blue-500 bg-card border-border shadow-xs rounded-xl overflow-hidden">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400">
              <Lightbulb className="w-4 h-4" />
              <span>1. Idée Maîtresse (Concept Central)</span>
            </div>
            <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-500/30">
              1 phrase clé
            </Badge>
          </div>
          <textarea
            placeholder="Ex: Une phrase claire et percutante qui résume l'essence du concept médical et ses seuils physiologiques..."
            value={idee}
            onChange={(e) => {
              setIdee(e.target.value);
              handleUpdate(e.target.value, mecanisme, preuve, decision);
            }}
            rows={2}
            className="w-full p-3 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-foreground resize-y leading-relaxed font-sans"
          />
        </CardContent>
      </Card>

      {/* BLOC 2 : MÉCANISME */}
      <Card className="border-l-4 border-l-amber-500 bg-card border-border shadow-xs rounded-xl overflow-hidden">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
              <Cog className="w-4 h-4" />
              <span>2. Mécanisme Physiopathologique</span>
            </div>
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
              2 à 3 phrases max
            </Badge>
          </div>
          <textarea
            placeholder="Ex: Description précise de l'architecture mécanistique : origine cellulaire, cascade biologique et pourquoi le phénomène survient..."
            value={mecanisme}
            onChange={(e) => {
              setMecanisme(e.target.value);
              handleUpdate(idee, e.target.value, preuve, decision);
            }}
            rows={3}
            className="w-full p-3 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-foreground resize-y leading-relaxed font-sans"
          />
        </CardContent>
      </Card>

      {/* BLOC 3 : PREUVE CLINIQUE */}
      <Card className="border-l-4 border-l-emerald-500 bg-card border-border shadow-xs rounded-xl overflow-hidden">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
              <BarChart3 className="w-4 h-4" />
              <span>3. Preuve Clinique & Paraclinique</span>
            </div>
            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
              Données & Chiffres
            </Badge>
          </div>
          <textarea
            placeholder="Ex: Signes discriminants, constantes biologiques clés, critères diagnostiques, sensibilité/spécificité des examens..."
            value={preuve}
            onChange={(e) => {
              setPreuve(e.target.value);
              handleUpdate(idee, mecanisme, e.target.value, decision);
            }}
            rows={3}
            className="w-full p-3 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-foreground resize-y leading-relaxed font-sans"
          />
        </CardContent>
      </Card>

      {/* BLOC 4 : DÉCISION CLINIQUE */}
      <Card className="border-l-4 border-l-rose-500 bg-card border-border shadow-xs rounded-xl overflow-hidden">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-rose-600 dark:text-rose-400">
              <AlertOctagon className="w-4 h-4" />
              <span>4. Décision Clinique & Prise en Charge</span>
            </div>
            <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-500/30">
              Règle d'Action & Vigilance
            </Badge>
          </div>
          <textarea
            placeholder="Ex: Règle de décision thérapeutique pratique, conduite à tenir graduée, posologie et piège mortel / red flag à éviter absolument..."
            value={decision}
            onChange={(e) => {
              setDecision(e.target.value);
              handleUpdate(idee, mecanisme, preuve, e.target.value);
            }}
            rows={3}
            className="w-full p-3 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 text-foreground resize-y leading-relaxed font-sans"
          />
        </CardContent>
      </Card>
    </div>
  );
};
