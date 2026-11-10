import { AtlasMagistralViewer } from "@/components/synthesis/AtlasMagistralViewer";
import { ATLAS_MAGISTRAL_SONNET_4_6_SYSTEM_PROMPT } from "@/lib/atlasMagistralEngine";
// src/config/doctrineConfig.ts
import React from "react";
import { ObjectifEditor, ObjectivesEditor } from "@/components/synthesis/ObjectifEditor";
import { ObjectivesRenderer } from "@/components/synthesis/ObjectivesRenderer";
import { HarvardEditor, HarvardRenderer } from "@/components/synthesis/HarvardEditor";
import { ArvaEditor } from "@/components/synthesis/ArvaEditor";
import ArvaSyntheseEditor from "@/components/synthesis/ArvaSyntheseEditor";
import { ArvaRenderer } from "@/components/synthesis/ArvaRenderer";
import { PROMPTS, buildArvaPrompt } from "@/utils/doctrineGenerators";

export type Doctrine =
  | "atlas_magistral"
  | "objectives_verbatim"
  | "harvard_method"
  | "world_number_one"
  | "arva"
  | "drive_objective_strategy";

export type DoctrineKey = Doctrine;

export interface DoctrineDefinition {
  id: Doctrine;
  label: string;
  title: string;
  shortLabel: string;
  badge: string;
  subtitle: string;
  tooltip: string;
  buttonText: string;
  loadingText: string;
  inputLabel: string;
  inputHelper: string;
  inputPlaceholder: string;
  promptDescription: string;
  editorComponent: React.ComponentType<any>;
  rendererComponent: React.ComponentType<any>;
  promptBuilder: (objectives: string[], wordLimit: number) => string;
  buildPrompt: (objectives: string[], wordLimit: number) => string;
}

export const DOCTRINE_CONFIG: Record<Doctrine, DoctrineDefinition> = {
  atlas_magistral: {
    id: "atlas_magistral",
    label: "Mode Atlas Magistral (Diapo-par-Diapo)",
    title: "Mode Atlas Magistral",
    shortLabel: "Atlas Magistral",
    badge: "Intégral 100% • Diapo par Diapo",
    subtitle: "Synthèse intégrale diapo-par-diapo • Tableaux comparatifs, seuils chiffrés & protocoles exacts",
    tooltip:
      "Transforme l'intégralité des diapositives du cours magistral en un atlas structuré (Chapitres I à VI, badges de diapositives, tableaux comparatifs .course-table, seuils en évidence et export PDF A4 avec filigranes DawJang).",
    buttonText: "Générer le Résumé en Mode Atlas Magistral",
    loadingText: "Construction de l'Atlas Magistral diapo par diapo (Claude Sonnet 4.6)...",
    inputLabel: "Support de cours magistral (PDF, DOCX ou Texte)",
    inputHelper: "Toutes les diapositives sont couvertes de la 1re à la dernière sans aucune perte de chiffre",
    inputPlaceholder: "Importez votre cours magistral pour générer l'Atlas Magistral...",
    promptDescription: ATLAS_MAGISTRAL_SONNET_4_6_SYSTEM_PROMPT,
    editorComponent: AtlasMagistralViewer,
    rendererComponent: AtlasMagistralViewer,
    promptBuilder: () => ATLAS_MAGISTRAL_SONNET_4_6_SYSTEM_PROMPT,
    buildPrompt: () => ATLAS_MAGISTRAL_SONNET_4_6_SYSTEM_PROMPT,
  },

  objectives_verbatim: {
    id: "objectives_verbatim",
    label: "Objectifs du Cours (Verbatim)",
    title: "Objectifs du Cours (Verbatim)",
    shortLabel: "Objectifs Verbatim",
    badge: "Fidélité 100%",
    subtitle: "Collé aux mots, à la syntaxe et aux chiffres du professeur",
    tooltip:
      "Structure le résumé uniquement autour des objectifs du cours (du 1er au dernier sans jamais couper) avec la terminologie exacte de l'enseignant.",
    buttonText: "Générer la synthèse par objectifs (Verbatim)",
    loadingText: "Restitution intégrale des objectifs du professeur...",
    inputLabel: "Objectifs pédagogiques du cours (Recommandé)",
    inputHelper: "1 objectif par ligne — respect strict de l'ordre pédagogique",
    inputPlaceholder:
      "Ex:\n1. Définir l'insuffisance cardiaque à FEVG altérée vs préservée\n2. Connaître les 4 piliers thérapeutiques médicamenteux\n3. Reconnaître les signes de décompensation aiguë",
    promptDescription:
      "DOCTRINE EXCLUSIVE : 'OBJECTIFS DU COURS (VERBATIM STRICT)'. Tu es un expert de synthèse centré UNIQUEMENT sur les objectifs du cours. Traite chaque objectif dans l'ordre chronologique sans en omettre aucun. Utilise fidèlement les termes exacts et les chiffres du professeur. N'UTILISE AUCUNE AUTRE DOCTRINE.",
    editorComponent: ObjectifEditor,
    rendererComponent: ObjectivesRenderer,
    promptBuilder: (objs, words) => PROMPTS.objectives_verbatim(objs, words),
    buildPrompt: (objs, words) => PROMPTS.objectives_verbatim(objs, words),
  },
  harvard_method: {
    id: "harvard_method",
    label: "Méthode de Harvard",
    title: "Méthode de Harvard",
    shortLabel: "Méthode Harvard",
    badge: "Harvard Framework",
    subtitle: "Idée Maîtresse → Mécanisme → Preuve Clinique → Décision",
    tooltip:
      "Applique la grille analytique de la Harvard Medical School : encadré exécutif en tête de section, logique mécanistique, corrélation paraclinique et règles de décision.",
    buttonText: "Générer la synthèse Harvard",
    loadingText: "Framework Harvard (Idée → Mécanisme → Preuve → Décision)...",
    inputLabel: "Concepts clés & Mécanismes physiopathologiques",
    inputHelper: "1 concept ou mécanisme par ligne — format analytique",
    inputPlaceholder:
      "Ex:\n1. Dysfonction systolique et remodelage ventriculaire gauche\n2. Activation neuro-hormonale (SRAA, SNS) et surcharge volémique\n3. Preuves hémodynamiques et biochimiques (BNP / NT-proBNP)\n4. Règle de décision : quadrithérapie optimale et critères d'hospitalisation",
    promptDescription:
      "DOCTRINE EXCLUSIVE : 'MÉTHODE HARVARD (FRAMEWORK MÉDICAL)'. Pour chaque objectif ou concept clé, structure obligatoirement selon les 4 étapes h2 : '## 1. Idée maîtresse' (1 phrase claire résumant le concept), '## 2. Mécanisme' (2-3 phrases sur la physiopathologie), '## 3. Preuve clinique' (données cliniques, constantes biologiques et chiffres pertinents), '## 4. Décision clinique' (recommandation pratique, règle de prise en charge et red flag). N'UTILISE AUCUNE AUTRE DOCTRINE.",
    editorComponent: HarvardEditor,
    rendererComponent: HarvardRenderer,
    promptBuilder: (objs, words) => PROMPTS.harvard_method(objs, words),
    buildPrompt: (objs, words) => PROMPTS.harvard_method(objs, words),
  },
  arva: {
    id: "arva",
    label: "Méthode ARVA Excellence",
    title: "Méthode ARVA Excellence",
    shortLabel: "ARVA Excellence",
    badge: "Standing Élite",
    subtitle: "Active Recall (30%) • Harvard Scripts (30%) • Vignette (30%) • Visas (10%)",
    tooltip:
      "La doctrine reine pour la préparation de haut niveau : Matrice de questions ciblées QCM avec preuves, scripts différentiels comparatifs, cas clinique réel immersif et visas de révision.",
    buttonText: "Générer la synthèse ARVA Excellence",
    loadingText: "Compilation quadripartite ARVA (Recall, Scripts, Vignette, Visas)...",
    inputLabel: "Objectifs & Compétences cliniques pour la matrice ARVA",
    inputHelper: "1 compétence / axe par ligne — base de questions QCM et scripts",
    inputPlaceholder:
      "Ex:\n1. Identifier les critères de gravité de l'insuffisance cardiaque aiguë\n2. Hiérarchiser le bilan biologique et paraclinique discriminant en urgence\n3. Poser la démarche thérapeutique graduée (diurétiques, vasodilatateurs, inotropes)\n4. Reconnaître les pièges diagnostiques et facteurs déclenchants décompensants",
    promptDescription:
      "DOCTRINE EXCLUSIVE : 'MÉTHODE ARVA EXCELLENCE'. Tu dois obligatoirement diviser la synthèse en 4 grandes sections h2 : '## 1. Matrice Active Recall (Questions & Preuves du cours)' (30% du volume), '## 2. Scripts Cliniques Différentiels (Harvard Illness Scripts)' (30% du volume sous forme de tableaux comparatifs), '## 3. Vignette Clinique d'Application (Case Based Clinical Learning)' (30% du volume, cas clinique immersif complet), '## 4. Visas de Révision & Annotations Personnelles' (10% du volume). N'UTILISE AUCUNE AUTRE DOCTRINE.",
    editorComponent: ArvaEditor,
    rendererComponent: ArvaRenderer,
    promptBuilder: (objs, words) => buildArvaPrompt(objs, words),
    buildPrompt: (objs, words) => buildArvaPrompt(objs, words),
  },
  world_number_one: {
    id: "world_number_one",
    label: "Standard Mondial N°1 (AMBOSS / First Aid)",
    title: "Standard Mondial N°1 (AMBOSS / First Aid)",
    shortLabel: "Standard Mondial N°1",
    badge: "N°1 Mondial",
    subtitle: "Blocs High-Yield ⚡, Pièges Cliniques ⚠️ & Mots-clés colorés",
    tooltip:
      "Le modèle de synthèse médicale le plus utilisé au monde : encadrés High-Yield Facts, alertes sur les contre-indications et mise en couleur automatique des valeurs seuils.",
    buttonText: "Générer la synthèse Standard Mondial",
    loadingText: "Extraction High-Yield Facts ⚡ & Tableaux comparatifs...",
    inputLabel: "Points de cours & Critères différentiels High-Yield",
    inputHelper: "1 point clé ou piège par ligne — format docimologique",
    inputPlaceholder:
      "Ex:\n1. Critères diagnostiques majeurs et mineurs de Framingham\n2. Biomarqueurs clés (BNP/NT-proBNP) et seuils d'exclusion en urgence\n3. Contre-indications absolues et pièges docimologiques des bêtabloquants en poussée aiguë",
    promptDescription:
      "DOCTRINE EXCLUSIVE : 'STANDARD MONDIAL N°1 (AMBOSS / FIRST AID)'. Blocs High-Yield ⚡, Règles d'or '- ✓ ', Pièges cliniques '- ⚠️ ', Tableaux différentiels comparatifs et valeurs seuils en gras : **valeur clé**. N'UTILISE AUCUNE AUTRE DOCTRINE.",
    editorComponent: ObjectifEditor,
    rendererComponent: ObjectivesRenderer,
    promptBuilder: (objs, words) => PROMPTS.world_number_one(objs, words),
    buildPrompt: (objs, words) => PROMPTS.world_number_one(objs, words),
  },
  drive_objective_strategy: {
    id: "drive_objective_strategy",
    label: "Objectifs & Audit d'Examens (Protocole Argon)",
    title: "Objectifs & Audit d'Examens (Upload de Masse & Claude Sonnet 4.6)",
    shortLabel: "Protocole Argon (Sonnet 4.6)",
    badge: "Argon Sonnet 4.6 + Annales en Masse",
    subtitle: "2 Volets Indissociables • Objectifs Exhaustifs • Matrice d'Incidence • Anti-Pièges Preuves à l'Appui",
    tooltip:
      "Pipeline en 2 étapes : extraction croisée du lot d'examens uploadés en masse (Gemini Flash), puis rédaction chirurgicale sans raccourci par Claude Sonnet 4.6 avec export PDF déterministe.",
    buttonText: "Générer le Résumé Complet & Exporter le Rapport PDF",
    loadingText: "Analyse croisée Cours + Examens en masse (Protocole Argon)...",
    inputLabel: "Objectifs prioritaires ou lot d'examens",
    inputHelper: "Ex: Sessions 2020, 2021, 2024, Cas 1 QCM 11...",
    inputPlaceholder: "Optionnel : précisez le semestre ou laissez l'IA classer automatiquement...",
    promptDescription:
      "DOCTRINE EXCLUSIVE : 'OBJECTIFS & AUDIT D\\'EXAMENS (PROTOCOLE ARGON CLAUDE SONNET 4.6)'.",
    editorComponent: ObjectifEditor,
    rendererComponent: ObjectivesRenderer,
    promptBuilder: (objs, words) => PROMPTS.objectives_verbatim(objs, words),
    buildPrompt: (objs, words) => PROMPTS.objectives_verbatim(objs, words),
  },
};

export const doctrineConfig = DOCTRINE_CONFIG;
export const DOCTRINES_LIST: DoctrineDefinition[] = Object.values(DOCTRINE_CONFIG);

export const DOCTRINE_LABELS: Record<Doctrine, string> = {
  atlas_magistral: "Mode Atlas Magistral (Diapo-par-Diapo)",
  objectives_verbatim: "Objectifs du Cours (Verbatim)",
  harvard_method: "Méthode de Harvard",
  arva: "Méthode ARVA Excellence",
  world_number_one: "Standard Mondial N°1 (AMBOSS)",
  drive_objective_strategy: "Objectifs & Audit d'Examens (Protocole Argon)",
};

export const DOCTRINE_STYLES: Record<Doctrine, { bg: string; border: string; accent: string }> = {
  atlas_magistral: {
    bg: "",
    border: "border-[#C96442]",
    accent: "text-[#C96442]",
  },

  objectives_verbatim: {
    bg: "",
    border: "border-[#D96B43]",
    accent: "text-[#D96B43]",
  },
  harvard_method: {
    bg: "",
    border: "border-blue-600",
    accent: "text-blue-600",
  },
  arva: {
    bg: "",
    border: "border-[#2E6F4E]",
    accent: "text-[#2E6F4E]",
  },
  world_number_one: {
    bg: "",
    border: "border-[#C87D28]",
    accent: "text-[#C87D28]",
  },
  drive_objective_strategy: {
    bg: "",
    border: "border-amber-600",
    accent: "text-amber-600",
  },
};

export {
  ObjectivesEditor,
  HarvardEditor,
  ArvaEditor,
  ArvaSyntheseEditor,
  ObjectivesRenderer,
  HarvardRenderer,
  ArvaRenderer,
  AtlasMagistralViewer,
};

