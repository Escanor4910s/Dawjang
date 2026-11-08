// src/components/synthesis/ObjectifEditor.tsx
import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ListOrdered } from "lucide-react";

export interface ObjectifEditorProps {
  objectives?: string[];
  setObjectives?: (objectives: string[]) => void;
  input?: string;
  onInputChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Éditeur spécialisé pour la doctrine « Objectif du cours »
 * Compatible avec { input, onInputChange } et { objectives, setObjectives }
 */
export function ObjectifEditor({
  objectives,
  setObjectives,
  input: externalInput,
  onInputChange,
  className = "",
  disabled = false,
}: ObjectifEditorProps) {
  const initialValue =
    externalInput !== undefined
      ? externalInput
      : objectives
      ? objectives.join("\n")
      : "";

  const [input, setInput] = useState(initialValue);

  useEffect(() => {
    if (externalInput !== undefined && externalInput !== input) {
      setInput(externalInput);
    }
  }, [externalInput]);

  const handleChange = (newVal: string) => {
    setInput(newVal);
    if (onInputChange) {
      onInputChange(newVal);
    }
    if (setObjectives) {
      const list = newVal
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      setObjectives(list);
    }
  };

  const count = (input || "").split("\n").filter((l) => l.trim().length > 0).length;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ListOrdered className="w-3.5 h-3.5 text-primary" />
          Liste des Objectifs (1 par ligne — ordre chronologique) :
        </span>
        <Badge variant="secondary" className="text-[10px] font-mono">
          {count} objectif{count > 1 ? "s" : ""}
        </Badge>
      </div>
      <textarea
        value={input}
        onChange={(e) => handleChange(e.target.value)}
        rows={Math.max(5, Math.min(10, count + 1))}
        disabled={disabled}
        className="w-full p-3.5 bg-muted/30 border border-border rounded-xl font-sans text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y leading-relaxed"
        placeholder="1. Définir la pathologie...&#10;2. Décrire la démarche diagnostique...&#10;3. Identifier la prise en charge..."
      />
    </div>
  );
}

export { ObjectifEditor as ObjectivesEditor };
export default ObjectifEditor;

