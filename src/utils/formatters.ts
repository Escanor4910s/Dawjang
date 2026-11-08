// src/utils/formatters.ts
import {
  summaryDocToStructuredMarkdown,
  type SummaryDoc,
} from "@/lib/summaryDocConverter";

/**
 * Nettoie et normalise le texte brut ou HTML vers un format Markdown strict
 */
export function cleanAndStructureMarkdown(
  raw: string | undefined | null,
  maxWords?: number
): string {
  if (!raw || typeof raw !== "string") return "";

  let md = raw.trim();

  // 1. Détection et conversion automatique d'un objet JSON sérialisé (SummaryDoc)
  if (md.startsWith("{") && md.endsWith("}")) {
    try {
      const parsed = JSON.parse(md);
      if (parsed && (parsed.objectives || parsed.qa_matrix || parsed.flash)) {
        md = summaryDocToStructuredMarkdown(parsed as SummaryDoc);
      }
    } catch {
      // Poursuite avec le texte brut
    }
  }

  // 2. Retirer balises HTML éventuelles tout en préservant le texte et les sauts de ligne
  md = md
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:p|div|section|article)[^>]*>/gi, "\n\n")
    .replace(/<\/?(?:b|strong)[^>]*>/gi, "**")
    .replace(/<\/?(?:i|em)[^>]*>/gi, "*")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    .replace(/<\/?(?:ul|ol)[^>]*>/gi, "\n")
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<hr[^>]*\/?>/gi, "\n---\n")
    .replace(/<\/?[a-zA-Z][^>\n]*>/g, "");

  // 2b. Élimination ciblée des préambules conversationnels d'IA ou sommaires redondants (sans jamais toucher à PARTIE I..IV)
  md = md
    .replace(
      /^(?:Absolument\s*!?|Bien\s+s[ûu]r\s*!?|Certainement\s*!?|En\s+tant\s+que\s+Professeur[^\n]*|Voici\s+la\s+r[ée]daction[^\n]*|Voici\s+les\s+sous-parties[^\n]*|Voici\s+le\s+r[ée]sum[ée][^\n]*|Je\s+vais\s+r[ée]diger[^\n]*)[\s\S]*?(?=\n(?:#{1,3}\s|===\s|★|\*\s*Probabilit|•\s|-\s|\|\s|\[)|\n\n)/gim,
      ""
    )
    .replace(
      /^(?:Absolument|Bien\s+s[ûu]r|Certainement|En\s+tant\s+que\s+Professeur|Voici\s+la\s+r[ée]daction|Voici\s+les\s+sous-parties)[^\n]*\n+/gim,
      ""
    )
    .replace(/^\s*(?:#{1,3}\s*)?(?:SECTION\s*\d+\s*[:.\-]?\s*)?(?:Synth[eèé]se\s*&?\s*Cadre\s*Nosologique|Sommaire\s*Ex[eèé]cutif|Synth[eèé]se\s*M[eèé]dicale\s*Ultra-Condens[eèé]e[^\n]*)\s*\n+/gi, "")
    .replace(/\n*>\s*(?:\*\*)?Synth[eèé]se\s*M[eèé]dicale\s*Ultra-Condens[eèé]e[\s\S]*?(?=\n\s*---\s*\n|\n\s*##\s*Objectif|\n\s*#|$)(?:---\s*\n*)?/gi, "\n\n")
    .replace(/\n*>\s*(?:\*\*)?Synth[eèé]se\s*Fid[eèé]le[\s\S]*?(?=\n\s*---\s*\n|\n\s*##\s*Objectif|\n\s*#|$)(?:---\s*\n*)?/gi, "\n\n")
    .replace(/^SECTION\s*\d+\s*[^\n]*\n+/gim, "");

  // Si le document est en Mode 1 (pas de PARTIE I ni de @SYNTHESE_META_) et contient un Objectif 1 plus bas, supprimer le sommaire redondant en tête
  const isUnifiedSynthese = /(?:@SYNTHESE_META_|PARTIE\s*(?:I|1)\b|VOLET\s*1\b|1\.1\.\s*V[ée]rit[ée]\s*statistique)/i.test(md);
  if (!isUnifiedSynthese) {
    const firstObjIdx = md.search(/(?:^|\n)##\s*(?:Objectif\s*1\b|\d+\.\s*Objectif\s*1\b|Chapitre\s*1\b)/i);
    if (firstObjIdx > 0 && firstObjIdx < 1200) {
      const headerPreamble = md.slice(0, firstObjIdx).trim();
      if (
        headerPreamble.includes("Synthèse Fidèle") ||
        headerPreamble.includes("Sommaire Exécutif") ||
        headerPreamble.includes("Cadre Nosologique")
      ) {
        md = md.slice(firstObjIdx).trim();
      }
    }
  }

  // 3. Nettoyer tout ancien marqueur [SUB] résiduel en le convertissant en sous-puce indentée `  ◦ `
  md = md.replace(/^[ \t]*[-•*]?\s*\[SUB\]\s*/gm, "  ◦ ");
  md = md.replace(/\[SUB\]\s*/g, "");

  // 3b. Nettoyer les astérisques orphelins en fin de ligne (ex: "Définir l'anémie**" -> "Définir l'anémie")
  md = md.replace(/([^\s*])\*{2,}(?=\s*(\n|$))/g, "$1");
  md = md.replace(/\*{2,}(?=\s*(\n|$))/g, "");

  // 4. Nettoyer doubles retours à la ligne inutiles
  md = md.replace(/\n{3,}/g, "\n\n");

  // 5. Normaliser titres (=== PARTIE ... === → # PARTIE ..., === Autre === → ## Autre, -- Titre -- → ### Titre)
  md = md.replace(/^===\s*((?:PARTIE\s*(?:I{1,3}V?|[1-4])|VOLET\s*[12]).*?)\s*===$/gim, "# $1");
  md = md.replace(/^===\s*(.+?)\s*===$/gm, "## $1");
  md = md.replace(/^--{2,}\s*(.+?)\s*--{2,}$/gm, "### $1");

  // 6. Préserver scrupuleusement les sous-puces de niveau 2 (`  ◦ `) et les puces de niveau 1 (`• ` ou `- `)
  md = md.replace(/^[ \t]+◦\s+/gm, "  ◦ ");
  md = md.replace(/^◦\s+/gm, "  ◦ ");
  md = md.replace(/^[ \t]{2,}[-•*]\s+/gm, "  ◦ ");
  md = md.replace(/^[·∙●]\s+/gm, "• ");

  return md.trim();
}

