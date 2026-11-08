// src/components/synthesis/DoctrineRenderer.tsx
import React from "react";
import { HarvardRenderer } from "./HarvardRenderer";
import { ArvaRenderer } from "./ArvaRenderer";
import { ObjectivesRenderer } from "./ObjectivesRenderer";

export type DoctrineType = "objectives_verbatim" | "harvard_method" | "arva" | "world_number_one" | string;

export interface DoctrineRendererProps {
  markdown: string;
  doctrine?: DoctrineType;
  className?: string;
}

/**
 * Rendu React modulaire et adaptatif selon la doctrine docimologique active :
 * - "objectives_verbatim" -> ObjectivesRenderer
 * - "harvard_method"      -> HarvardRenderer
 * - "arva"                -> ArvaRenderer
 */
export const DoctrineRenderer: React.FC<DoctrineRendererProps> = ({
  markdown,
  doctrine = "objectives_verbatim",
  className = "",
}) => {
  // 1. Doctrine ARVA (ou détection automatique de la matrice / scripts)
  if (doctrine === "arva" || markdown.includes("Matrice Active Recall") || markdown.includes("Illness Scripts")) {
    return <ArvaRenderer markdown={markdown} className={className} />;
  }

  // 2. Doctrine Méthode Harvard (ou détection des 4 piliers h2)
  if (doctrine === "harvard_method" || markdown.includes("## 1. Idée") || markdown.includes("## 2. Mécanisme")) {
    return <HarvardRenderer markdown={markdown} className={className} />;
  }

  // 3. Doctrine Objectifs Verbatim & Standard Mondial
  return <ObjectivesRenderer markdown={markdown} className={className} />;
};

export default DoctrineRenderer;
