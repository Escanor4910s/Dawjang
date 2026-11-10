import {
  generateAtlasMagistralSummary,
  compileAtlasSummaryToHtml,
  type AtlasMagistralSummary
} from "@/lib/atlasMagistralEngine";
// src/pages/GenerateSummary.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardPaste,
  FileUp,
  FolderOpen,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Wand2,
  AlertCircle,
  Check,
  FileText,
  Layers,
  ShieldCheck,
  Eye,
  Compass,
  ShieldAlert,
  FolderPlus,
  X,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFileReader } from "@/hooks/useFileReader";
import { supabase } from "@/integrations/supabase/client";
import { untypedTable } from "@/lib/untypedDb";
import { cleanMedicalSourceText } from "@/lib/summaryDocConverter";
import { filterOutTombstoned, callGeminiAcademicEngine, unTombstoneEntity } from "@/lib/syncEngine";
import { cleanAndStructureMarkdown } from "@/utils/formatters";
import { DOCTRINE_LABELS } from "@/config/doctrineConfig";
import { extractObjectivesFromCourseText } from "@/lib/summaryEngine";
import { getSavedCourses, type StoredCourse } from "@/pages/Library";
import { grantDawJangXP, DAWJANG_XP_REWARDS } from "@/hooks/useGamification";
import { pushAppNotification } from "@/hooks/useNotifications";
import {
  repairMedicalFormulasInText,
} from "@/lib/remnoteStructuredEngine";
import {
  executeDualModelMedicalPipeline,
} from "@/lib/aiPolicePipeline";
import {
  generateMasterMedicalSummary,
  cleanForDawJangPdf,
} from "@/lib/coPilotSummaryEngine";
import type { EditorSummaryItem } from "@/components/synthesis/EditorView";

import {
  objectiveSummaryDataToMarkdown,
  executeArgonDualStagePipeline,
  type UploadedExamInput,
} from "@/lib/objectiveExamEngine";
import { ObjectiveExamBatchUploader } from "@/components/ObjectiveExamBatchUploader";

export type PureSynthesisMode =
  | "atlas_magistral"
  | "objectives_verbatim"
  | "drive_objective_strategy";
type SourceTabMode = "upload" | "library" | "paste";

export const LOCAL_SUMMARIES_KEY = "hippocampus_clean_summaries_v2";
export const LEGACY_SUMMARIES_KEY = "hippocampus_clean_summaries";

export const SUBJECT_FILTERS = [
  "Tous",
  "Cardiologie",
  "Pneumologie",
  "Neurologie",
  "Néphrologie",
  "Maladies Infectieuses",
  "Hématologie",
  "Hépato-Gastro",
  "Endocrinologie",
  "Pédiatrie",
  "Gynécologie-Obstétrique",
];

export function getLocalSummaries(): EditorSummaryItem[] {
  try {
    const rawKeys = [
      LOCAL_SUMMARIES_KEY,
      LEGACY_SUMMARIES_KEY,
      "hippocampus_local_summaries_v2",
      "hippocampus_clean_summaries_v4",
    ];
    const itemMap = new Map<string, EditorSummaryItem>();
    for (const key of rawKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const it of parsed) {
              if (it && it.id && !itemMap.has(it.id)) {
                const normalized: EditorSummaryItem = {
                  id: String(it.id),
                  title: String(it.title || "Synthèse sans titre"),
                  subject: String(it.subject || it.discipline || "Médecine"),
                  updatedAt: String(it.updatedAt || "Aujourd'hui"),
                  wordCount: Number(it.wordCount) || 100,
                  doctrineLabel: String(
                    it.doctrineLabel ||
                    DOCTRINE_LABELS.objectives_verbatim
                  ),
                  htmlContent: String(it.htmlContent || it.content || ""),
                };
                itemMap.set(it.id, normalized);
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }
    if (itemMap.size > 0) {
      const allItems = Array.from(itemMap.values());
      return filterOutTombstoned("summary", allItems);
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalSummaries(items: EditorSummaryItem[]) {
  try {
    for (const item of items) {
      if (item && (item.id || item.title)) {
        unTombstoneEntity("summary", item.id, item.title);
      }
    }
    const serialized = JSON.stringify(items);
    localStorage.setItem(LOCAL_SUMMARIES_KEY, serialized);
    localStorage.setItem(LEGACY_SUMMARIES_KEY, serialized);
    localStorage.setItem("hippocampus_local_summaries_v2", serialized);
    localStorage.setItem("hippocampus_clean_summaries_v4", serialized);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("dawjang_summaries_updated"));
    }
  } catch {
    // ignore
  }
}

/**
 * Extrait le texte brut de la diapositive « OBJECTIFS » du professeur pour affichage et vérification verbatim
 */
function extractRawObjectivesSlideSnippet(text: string): string | null {
  if (!text) return null;
  if (/---\s*Diapositive\s*\d+\s*---/i.test(text)) {
    const slides = text.split(/(?=---\s*Diapositive\s*\d+\s*---)/i);
    for (let i = 0; i < Math.min(slides.length, 12); i++) {
      const s = slides[i];
      const headerZone = s.split(/\r?\n/).slice(0, 5).join(" ");
      if (/\bobjectifs?\b/i.test(headerZone) || /capable\s+de\b/i.test(headerZone)) {
        let combined = s.trim();
        if (i + 1 < slides.length && /\bobjectifs?\b/i.test(slides[i + 1].split(/\r?\n/).slice(0, 3).join(" "))) {
          combined += "\n\n" + slides[i + 1].trim();
        }
        return combined;
      }
    }
  }
  const match = text.match(
    /(?:^|\n)\s*(objectifs?\s*(?:pédagogiques?|du\s*cours|de\s*la\s*leçon|spécifiques?)?\s*[:\n][\s\S]{20,1200}?)(?=(?:\n\s*(?:PLAN|SOMMAIRE|CHAPITRE|INTRODUCTION|I\s*[.\-)\s]+)\b|$))/i
  );
  return match ? match[1].trim() : null;
}

/**
 * Fallback déterministe riche pour un objectif précis si hors-ligne
 */
function buildFallbackObjectiveSection(
  objectiveTitle: string,
  objectiveIndex: number,
  totalObjectives: number,
  courseText: string
): string {
  const paragraphs = courseText
    .split(/\n{2,}/)
    .map((p) => p.replace(/^---\s*Diapositive\s*\d+\s*---\s*/i, "").trim())
    .filter((p) => p.length > 30);

  const keywords = (objectiveTitle || "")
    .toLowerCase()
    .replace(/[^a-zàâçéèêëîïôûùüÿñæœ0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const scored = paragraphs.map((p, idx) => {
    const lower = (p || "").toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 3;
    }
    return { p, idx, score };
  });

  const matching = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .sort((a, b) => a.idx - b.idx)
    .map((item) => item.p);

  const sliceStart = Math.floor(
    ((objectiveIndex - 1) / Math.max(1, totalObjectives)) * paragraphs.length
  );
  const sliceEnd = Math.max(
    sliceStart + 3,
    Math.ceil((objectiveIndex / Math.max(1, totalObjectives)) * paragraphs.length)
  );
  const selectedParagraphs =
    matching.length >= 2 ? matching : paragraphs.slice(sliceStart, sliceEnd);

  const bulletLines = selectedParagraphs
    .flatMap((para) =>
      para
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 15 && !/^---\s*Diapositive/i.test(s))
    )
    .slice(0, 14)
    .map((line) => `- ${line}`);

  return [
    `## Objectif ${objectiveIndex} : ${objectiveTitle}`,
    "",
    bulletLines.length > 0
      ? bulletLines.join("\n")
      : `- Synthèse fidèle au cours portant sur : **${objectiveTitle}**.`,
    "",
  ].join("\n");
}

/**
 * Normalise le bloc Markdown retourné pour un objectif individuel K afin de garantir
 * qu'il commence TOUJOURS par `## Objectif K : [Intitulé exact]`
 */
function normalizeSingleObjectiveMarkdown(
  rawResponse: string,
  objNum: number,
  objTitle: string
): string {
  const cleaned = rawResponse
    .replace(/^```(?:markdown|md)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  // Retirer tout titre H1 ou H2 initial redondant pour imposer le titre exact numéroté
  const withoutLeadingHeading = cleaned
    .replace(/^(?:#{1,3}\s*(?:Objectif\s*\d+\s*[:.\-–—]?\s*)?[^\n]+\n+)/i, "")
    .trim();

  const body = withoutLeadingHeading.length > 40 ? withoutLeadingHeading : cleaned;
  return `## Objectif ${objNum} : ${objTitle}\n\n${body}`;
}

/**
 * Génère une synthèse 100 % complète OBJECTIF PAR OBJECTIF (1 appel dédié par objectif,
 * de l'Objectif 1 jusqu'au dernier Objectif N sans jamais pouvoir en sauter ni en tronquer un seul).
 */
async function generateExhaustiveObjectivesSummary(params: {
  title: string;
  subject: string;
  courseText: string;
  objectives: string[];
  onProgress?: (currentObj: number, totalObjs: number, objTitle: string) => void;
}): Promise<string> {
  const { title, subject, courseText, objectives, onProgress } = params;
  const cleanedCourse = repairMedicalFormulasInText(cleanMedicalSourceText(courseText));

  const effectiveObjectives =
    objectives.length > 0
      ? objectives
      : [
          "Définir l'entité nosologique, les critères diagnostiques et les constantes biologiques de référence",
          "Expliquer les mécanismes physiopathologiques et étiopathogéniques",
          "Décrire les signes cliniques, paracliniques et les formes cliniques",
          "Établir le diagnostic positif, différentiel et étiologique",
          "Planifier la prise en charge thérapeutique complète (posologies, surveillance et contre-indications)",
        ];

  const totalObjs = effectiveObjectives.length;

  const sections: string[] = [];
  const failedObjectives: number[] = [];

  // Boucle stricte 1 OBJECTIF PAR PASSE : garantit mathématiquement que chaque objectif 1..N est rédigé de façon claire et logique
  for (let i = 0; i < totalObjs; i++) {
    const objNum = i + 1;
    const objTitle = effectiveObjectives[i];
    onProgress?.(objNum, totalObjs, objTitle);

    const allObjectivesContext = effectiveObjectives
      .map((o, idx) => `${idx + 1}. Objectif ${idx + 1} : ${o}${idx === i ? "  <-- [OBJECTIF À TRAITER MAINTENANT]" : ""}`)
      .join("\n");

    const isHemogramme = /h[eéè]mogramme|nfs|formule\s*sanguine|interpr[eéè]ter/i.test(objTitle);

    const specificDirective = isHemogramme
      ? `\nDIRECTIVE SPÉCIALE D'EXPLICATION LOGIQUE (OBJECTIF CLÉ D'INTERPRÉTATION) :
Ne fais SURTOUT PAS de copier-coller brut du cours. Développe par toi-même une LOGIQUE CLINIQUE ÉTAPE PAR ÉTAPE pour expliquer à l'étudiant comment raisonner devant les résultats :
- Étape 1 : Diagnostic de certitude de l'anémie (Taux d'Hb < seuils officiels : Homme < 13 g/dL, Femme/Enfant < 12 g/dL, Grossesse T2/T3 < 10,5 g/dL).
- Étape 2 : Taille des hématies via le VGM : Microcytaire (< 80 fL), Normocytaire (80-100 fL), Macrocytaire (> 100 fL).
- Étape 3 : Coloration / charge en Hb via la CCMH et TCMH : Hypochrome (CCMH < 32 %, TCMH < 27 pg) vs Normochrome (CCMH 32-36 %, TCMH 27-32 pg).
- Étape 4 : Réponse médullaire via les Réticulocytes : Régénérative (> 120 G/L ou 150 G/L = origine périphérique : hémolyse ou hémorragie aiguë) vs Arégénérative (< 120 G/L = origine centrale : carence en fer/vitamines, infiltration médullaire).
- Qualification finale : Montre la démarche d'assemblage (ex: « anémie microcytaire hypochrome arégénérative » ou « anémie normocytaire normochrome régénérative »).
Reste limpide, logique, structuré et synthétique (environ 100 à 135 mots).`
      : "";

    const systemPrompt = `Tu es le Rédacteur Médical Synthétique DawJang pour le cours « ${title} » (${subject}).
MISSION EXCLUSIVE DE CETTE PASSE (${objNum} / ${totalObjs}) :
Rédige une section CLAIRE, LOGIQUE ET CONDENSÉE pour :
**Objectif ${objNum} : ${objTitle}**
${specificDirective}

RÈGLES D'OR STRICTES (BUDGET DE 80 À 135 MOTS POUR CET OBJECTIF) :
1. PÉDAGOGIE LOGIQUE : Pour l'interprétation d'un hémogramme ou bilan, explique à l'étudiant la logique pas à pas (taille VGM, couleur CCMH/TCMH, réticulocytes, qualification globale) plutôt qu'un copier-coller brut.
2. DÉFINITION : Si cet objectif est une définition, donne la définition officielle et les fausses anémies (hémodilution).
3. TRIADES & SIGNES CARDINAUX : Cite la triade et les signes clés nettement sans dilution.
4. ÉLÉMENTS À ÉVITER / DÉCLENCHANTS : Liste à puces brève et percutante.
5. TRAITEMENT : Buts, seuils d'urgence et posologies/durées de recharge des réserves.
6. ZÉRO INTRO / ZÉRO ROBOTIQUE : N'écris jamais "Voici la rédaction...", "L'anémie est définie...". Attaque directement le contenu clinique.
7. FORMATAGE :
   - Commence OBLIGATOIREMENT par le titre exact :
     ## Objectif ${objNum} : ${objTitle}
   - Reste impérativement sous la barre des 135 mots.`;

    // Pour que même les longs cours (> 35 000 car.) transmettent intégralement les dernières diapositives (souvent dédiées aux objectifs 4 et 5 : étiologies & traitements)
    const courseWindow =
      cleanedCourse.length <= 38000
        ? cleanedCourse
        : i >= totalObjs - 2
        ? `${cleanedCourse.slice(0, 14000)}\n\n[...]\n\n${cleanedCourse.slice(-24000)}`
        : cleanedCourse.slice(0, 38000);

    const userPrompt = `PLAN GLOBAL DES ${totalObjs} OBJECTIFS DU COURS :
${allObjectivesContext}

=== SUPPORT DE COURS DU PROFESSEUR ===
${courseWindow}
=== FIN DU SUPPORT DE COURS ===

Rédige maintenant l'intégralité de la section :
## Objectif ${objNum} : ${objTitle}`;

    // Jusqu'à 4 tentatives avec attente progressive (anti rate-limit / coupure réseau)
    let aiResponse: string | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await sleep(1500 * attempt);
      try {
        aiResponse = await callGeminiAcademicEngine(
          systemPrompt,
          userPrompt,
          attempt === 0 ? 0.15 : 0.25
        );
      } catch {
        aiResponse = null;
      }
      if (aiResponse && aiResponse.trim().length >= 90) break;
    }

    // Continuation automatique si la réponse semble coupée en plein milieu
    if (aiResponse && aiResponse.trim().length >= 90) {
      for (let cont = 0; cont < 3 && looksTruncated(aiResponse); cont++) {
        const tail = aiResponse.slice(-1800);
        const more = await callGeminiAcademicEngine(
          systemPrompt,
          `${userPrompt}\n\nTa réponse précédente s'est interrompue ici :\n"""\n${tail}\n"""\nContinue EXACTEMENT à partir de ce point (sans répéter ce qui précède et sans nouveau titre) jusqu'à la fin complète de l'Objectif ${objNum}.`,
          0.15
        );
        if (!more || more.trim().length < 20) break;
        aiResponse = `${aiResponse.trimEnd()}\n${more.trim()}`;
      }
    }

    // Petite pause entre deux objectifs pour éviter le blocage du quota
    if (i < totalObjs - 1) await sleep(700);

    if (aiResponse && aiResponse.trim().length >= 90) {
      sections.push(normalizeSingleObjectiveMarkdown(aiResponse, objNum, objTitle));
    } else {
      failedObjectives.push(objNum);
      sections.push(
        buildFallbackObjectiveSection(objTitle, objNum, totalObjs, cleanedCourse)
      );
    }
  }

  if (failedObjectives.length > 0) {
    console.warn("[Synthèse] Objectifs générés en mode secours (IA indisponible) :", failedObjectives);
    lastFailedObjectives = failedObjectives;
  } else {
    lastFailedObjectives = [];
  }

  return sections.join("\n\n---\n\n");
}

/** Objectifs ayant dû basculer en mode secours lors de la dernière génération */
let lastFailedObjectives: number[] = [];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Détecte une réponse IA coupée en plein milieu (phrase, puce ou tableau inachevé) */
function looksTruncated(text: string): boolean {
  const t = text.trimEnd();
  if (t.length < 1500) return false;
  const lastLine = t.split("\n").pop() || "";
  if (/[.!?:;)\]|*✓»"]$/.test(lastLine.trim())) return false;
  if (/^#{1,4}\s/.test(lastLine.trim())) return true;
  return lastLine.trim().length > 0;
}

export default function GenerateSummary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { readFile } = useFileReader();

  // Mode de synthèse (UNIQUEMENT les 2 modes purs demandés)
  const [selectedMode, setSelectedMode] = useState<PureSynthesisMode>("objectives_verbatim");

  // Onglet de source
  const [sourceTab, setSourceTab] = useState<SourceTabMode>("upload");
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Bibliothèque de cours synchronisée
  const [libraryCourses, setLibraryCourses] = useState<StoredCourse[]>(getSavedCourses);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [selectedLibraryCourseId, setSelectedLibraryCourseId] = useState<string | null>(null);

  // Données du cours
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("Hématologie");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedCourseFile, setUploadedCourseFile] = useState<File | null>(null);
  const [uploadedRawText, setUploadedRawText] = useState("");
  const [batchExamFiles, setBatchExamFiles] = useState<File[]>([]);

  // Objectifs du cours (Mode 1 : Fidèle aux objectifs du cours)
  const [objectivesList, setObjectivesList] = useState<string[]>([]);
  const [rawObjectivesSlideSnippet, setRawObjectivesSlideSnippet] = useState<string | null>(null);
  const [showRawSlidePreview, setShowRawSlidePreview] = useState(false);
  const [newObjectiveDraft, setNewObjectiveDraft] = useState("");
  const [hadExplicitObjectivesInCourse, setHadExplicitObjectivesInCourse] = useState<boolean | null>(
    null
  );
  const [isProposingObjectives, setIsProposingObjectives] = useState(false);

  // Progression de génération détaillée
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string>("");
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [totalStepsCount, setTotalStepsCount] = useState<number>(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isGenerating) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isGenerating]);

  // Synchronisation avec la Bibliothèque (Local + Supabase)
  const fetchLibraryCourses = useCallback(async () => {
    const localList = getSavedCourses();
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data } = await supabase
          .from("courses")
          .select("id, title, content, subject, created_at")
          .eq("user_id", authData.user.id)
          .order("created_at", { ascending: false });

        if (data && data.length > 0) {
          const mergedMap = new Map<string, StoredCourse>();
          data.forEach((row: any) => {
            if (!row.content || row.content.trim().length < 20) return;
            mergedMap.set(row.id, {
              id: row.id,
              code: String(row.subject || "COURS").substring(0, 8).toUpperCase(),
              title: row.title || "Cours sans titre",
              subject: row.subject || "Médecine",
              updatedAt: row.created_at
                ? new Date(row.created_at).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "Récent",
              wordCount: row.content.trim().split(/\s+/).filter(Boolean).length,
              content: row.content,
            });
          });
          localList.forEach((c) => {
            if (!mergedMap.has(c.id)) mergedMap.set(c.id, c);
          });
          setLibraryCourses(filterOutTombstoned("course", Array.from(mergedMap.values())));
          return;
        }
      }
    } catch {
      // ignore
    }
    setLibraryCourses(localList);
  }, []);

  useEffect(() => {
    fetchLibraryCourses();
  }, [fetchLibraryCourses]);

  // Extraction verbatim assistée par IA sur la diapositive "Objectifs" pour ne jamais manquer un seul objectif
  const verifyObjectivesSlideWithAI = useCallback(
    async (rawText: string, regexDetected: string[]) => {
      const snippet = extractRawObjectivesSlideSnippet(rawText);
      setRawObjectivesSlideSnippet(snippet);

      // Si une diapositive Objectifs existe dans le cours, on demande à l'IA de vérifier la liste exacte mot-à-mot
      const targetZone = snippet || rawText.slice(0, 6500);
      if (!/\bobjectifs?\b/i.test(targetZone) && !/capable\s+de\b/i.test(targetZone)) {
        return;
      }

      try {
        const sys = `Tu es un extracteur diplomatique de diapositives médicales.
Repère la diapositive intitulée « OBJECTIFS » (ou « OBJECTIFS PÉDAGOGIQUES » / « À la fin de ce cours ») dans l'extrait fourni.
Extrais MOT POUR MOT, dans l'ordre exact, CHACUN des objectifs listés par le professeur (s'il y en a 5, retourne les 5 sans en fusionner ni en oublier aucun).
Réponds UNIQUEMENT par un tableau JSON de chaînes de caractères :
["Objectif 1 exact...", "Objectif 2 exact...", ...]`;

        const usr = `Extrait du début du cours :\n${targetZone}\n\nRetourne uniquement le tableau JSON contenant tous les objectifs exacts de la diapositive Objectifs.`;
        const rawReply = await callGeminiAcademicEngine(sys, usr, 0.05);
        if (!rawReply) return;

        const cleanedJson = rawReply.replace(/```json|```/gi, "").trim();
        const firstBracket = cleanedJson.indexOf("[");
        const lastBracket = cleanedJson.lastIndexOf("]");
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          const parsed = JSON.parse(cleanedJson.slice(firstBracket, lastBracket + 1));
          if (Array.isArray(parsed)) {
            const cleanedList = parsed
              .map((item) =>
                String(item)
                  .replace(/^(?:Objectif\s*\d+\s*[:.\-)]|\d+\s*[.\-):]|[•\-*])\s*/i, "")
                  .trim()
              )
              .filter((s) => s.length > 5);

            // Si l'IA a trouvé davantage d'objectifs sur la diapo que l'extracteur regex (ex: 5 au lieu de 4), on met à jour immédiatement
            if (cleanedList.length >= regexDetected.length && cleanedList.length > 0) {
              setObjectivesList(cleanedList);
              setHadExplicitObjectivesInCourse(true);
            }
          }
        }
      } catch {
        // L'extraction déterministe regex reste en place
      }
    },
    []
  );

  // Analyse automatique des objectifs dès qu'un texte de cours change
  const scanCourseForObjectives = useCallback(
    (rawText: string) => {
      if (!rawText || rawText.trim().length < 30) {
        setHadExplicitObjectivesInCourse(null);
        setRawObjectivesSlideSnippet(null);
        return;
      }
      const snippet = extractRawObjectivesSlideSnippet(rawText);
      setRawObjectivesSlideSnippet(snippet);

      const detected = extractObjectivesFromCourseText(rawText);
      if (detected.length > 0) {
        setObjectivesList(detected);
        setHadExplicitObjectivesInCourse(true);
      } else {
        setObjectivesList([]);
        setHadExplicitObjectivesInCourse(false);
      }

      // Vérification asynchrone de la diapositive Objectifs pour garantir que 5 objectifs sur la diapo = 5 objectifs extraits
      verifyObjectivesSlideWithAI(rawText, detected);
    },
    [verifyObjectivesSlideWithAI]
  );

  // Prise en charge de ?source=library ou ?courseId=... ou raccourci localStorage
  useEffect(() => {
    const sourceParam = searchParams.get("source");
    const courseIdParam = searchParams.get("courseId");
    const modeParam = searchParams.get("mode");

    if (modeParam === "drive_objective_strategy" || modeParam === "objectives_verbatim") {
      setSelectedMode(modeParam);
    }
    if (sourceParam === "library") {
      setSourceTab("library");
    }

    try {
      const rawShortcut = localStorage.getItem("hippocampus_active_course_shortcut");
      if (rawShortcut) {
        const shortcutCourse = JSON.parse(rawShortcut) as StoredCourse;
        if (shortcutCourse && shortcutCourse.content) {
          setNewTitle(shortcutCourse.title || "Synthèse de cours");
          setNewSubject(shortcutCourse.subject || "Hématologie");
          const cleaned = repairMedicalFormulasInText(
            cleanMedicalSourceText(shortcutCourse.content)
          );
          setUploadedRawText(cleaned);
          setUploadedFileName(`${shortcutCourse.title} (Bibliothèque)`);
          setSelectedLibraryCourseId(shortcutCourse.id);
          setSourceTab("library");
          scanCourseForObjectives(cleaned);
          localStorage.removeItem("hippocampus_active_course_shortcut");
          return;
        }
      }
    } catch {
      // ignore
    }

    if (courseIdParam && libraryCourses.length > 0) {
      const found = libraryCourses.find((c) => c.id === courseIdParam);
      if (found) {
        setNewTitle(found.title);
        setNewSubject(found.subject || "Hématologie");
        const cleaned = repairMedicalFormulasInText(cleanMedicalSourceText(found.content));
        setUploadedRawText(cleaned);
        setUploadedFileName(`${found.title} (Bibliothèque)`);
        setSelectedLibraryCourseId(found.id);
        setSourceTab("library");
        scanCourseForObjectives(cleaned);
      }
    }
  }, [searchParams, libraryCourses, scanCourseForObjectives]);

  const sourceWordCount = useMemo(() => {
    if (!uploadedRawText.trim()) return 0;
    return uploadedRawText.trim().split(/\s+/).filter(Boolean).length;
  }, [uploadedRawText]);

  const filteredLibraryCourses = useMemo(() => {
    const q = (librarySearchQuery || "").trim().toLowerCase();
    if (!q) return libraryCourses;
    return libraryCourses.filter(
      (c) =>
        (c.title || "").toLowerCase().includes(q) ||
        (c.subject || "").toLowerCase().includes(q) ||
        (c.content || "").toLowerCase().includes(q)
    );
  }, [libraryCourses, librarySearchQuery]);

  // Lecture d'un fichier uploadé
  const processSelectedFile = async (file: File) => {
    setUploadedCourseFile(file);
    setUploadedFileName(file.name);
    if (!newTitle.trim()) {
      setNewTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " "));
    }

    const result = await readFile(file);
    if (result.success && result.content) {
      const cleaned = repairMedicalFormulasInText(cleanMedicalSourceText(result.content));
      setUploadedRawText(cleaned);

      scanCourseForObjectives(cleaned);
      const detected = extractObjectivesFromCourseText(cleaned);

      toast({
        title: "Support de cours chargé avec succès",
        description: `${file.name} (${cleaned
          .split(/\s+/)
          .filter(Boolean)
          .length.toLocaleString("fr-FR")} mots${
          detected.length > 0
            ? ` · ${detected.length} objectifs extraits de la diapositive`
            : " · Vérification des objectifs en cours"
        }).`,
      });
    } else {
      toast({
        title: "Erreur de lecture du fichier",
        description: result.error || "Impossible d'extraire le texte de ce document.",
        variant: "destructive",
      });
    }
  };

  // Upload en masse d'examens et annales pour le Mode 3 (Protocole Argon)
  const handleBatchExamsSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const incoming = Array.from(e.target.files);
      setBatchExamFiles((prev) => {
        const existing = new Set(prev.map((f) => f.name));
        const unique = incoming.filter((f) => !existing.has(f.name));
        return [...prev, ...unique];
      });
      e.target.value = "";
    }
  };

  const removeBatchExamFile = (fileName: string) => {
    setBatchExamFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const handleSelectLibraryCourse = (course: StoredCourse) => {
    setSelectedLibraryCourseId(course.id);
    setNewTitle(course.title);
    if (course.subject) setNewSubject(course.subject);
    const cleaned = repairMedicalFormulasInText(cleanMedicalSourceText(course.content));
    setUploadedRawText(cleaned);
    setUploadedFileName(`${course.title} (Bibliothèque)`);
    scanCourseForObjectives(cleaned);

    toast({
      title: "Cours sélectionné depuis la Bibliothèque",
      description: `« ${course.title} » est prêt à être synthétisé.`,
    });
  };

  // Extraction ou Proposition automatique des objectifs du cours par l'IA
  const handleProposeObjectivesWithAI = async () => {
    if (!uploadedRawText || uploadedRawText.trim().length < 30) {
      toast({
        title: "Aucun cours chargé",
        description:
          "Importez d'abord un fichier, choisissez un cours de la bibliothèque ou collez votre texte.",
        variant: "destructive",
      });
      return;
    }

    setIsProposingObjectives(true);
    try {
      const snippet = extractRawObjectivesSlideSnippet(uploadedRawText);
      const systemPrompt = snippet
        ? `Tu es un Professeur Agrégé de Faculté de Médecine.
Une diapositive « OBJECTIFS » a été détectée dans le cours.
Lis cette diapositive et extrais MOT POUR MOT, dans l'ordre exact, TOUS les objectifs pédagogiques qui y figurent (sans en oublier ni en fusionner aucun).
Réponds UNIQUEMENT par un tableau JSON de chaînes de caractères :
["Objectif 1...", "Objectif 2...", ...]`
        : `Tu es un Professeur Agrégé de Faculté de Médecine.
Analyse l'intégralité du cours fourni (du début à la toute fin) et formule entre 5 et 7 objectifs pédagogiques officiels qui couvrent 100 % des sections du cours dans l'ordre chronologique.
Réponds UNIQUEMENT par un tableau JSON de chaînes de caractères :
["Objectif 1...", "Objectif 2...", ...]`;

      const userPrompt = snippet
        ? `Diapositive Objectifs du cours « ${newTitle || "Cours médical"} » :\n${snippet}\n\nDébut du cours :\n${uploadedRawText.slice(0, 6000)}\n\nRetourne uniquement le tableau JSON contenant tous les objectifs exacts.`
        : `Titre du cours : ${newTitle || "Cours médical"}\nTexte du cours :\n${uploadedRawText.slice(0, 26000)}\n\nRetourne uniquement le tableau JSON des objectifs pédagogiques couvrant tout le cours.`;

      const raw = await callGeminiAcademicEngine(systemPrompt, userPrompt, 0.1);

      let proposed: string[] = [];
      if (raw) {
        try {
          const cleanedJson = raw.replace(/```json|```/gi, "").trim();
          const firstB = cleanedJson.indexOf("[");
          const lastB = cleanedJson.lastIndexOf("]");
          const targetJson =
            firstB !== -1 && lastB > firstB
              ? cleanedJson.slice(firstB, lastB + 1)
              : cleanedJson;
          const parsed = JSON.parse(targetJson);
          if (Array.isArray(parsed)) {
            proposed = parsed
              .map((item) =>
                String(item)
                  .replace(/^(?:Objectif\s*\d+\s*[:.\-)]|\d+\s*[.\-):]|[•\-*])\s*/i, "")
                  .trim()
              )
              .filter((s) => s.length > 5);
          }
        } catch {
          proposed = raw
            .split("\n")
            .map((l) => l.replace(/^[-•*\d.)\s"]+|[",]+$/g, "").trim())
            .filter((l) => l.length > 8);
        }
      }

      if (proposed.length === 0) {
        proposed = [
          `Définir ${newTitle || "la pathologie"}, ses critères biologiques et ses constantes de référence`,
          "Expliquer la physiopathologie et les mécanismes étiopathogéniques du cours",
          "Identifier le tableau clinique typique, les formes cliniques et le bilan paraclinique",
          "Établir le diagnostic positif, différentiel et étiologique complet",
          "Maîtriser la prise en charge thérapeutique (molécules, posologies exactes, surveillance et contre-indications)",
        ];
      }

      setObjectivesList(proposed);
      toast({
        title: `${proposed.length} objectifs extraits et validés`,
        description:
          "Chaque objectif sera traité individuellement du 1er jusqu'au dernier sans aucune omission.",
      });
    } finally {
      setIsProposingObjectives(false);
    }
  };

  const handleAddObjective = () => {
    const trimmed = newObjectiveDraft.trim();
    if (!trimmed) return;
    setObjectivesList((prev) => [...prev, trimmed]);
    setNewObjectiveDraft("");
  };

  const handleUpdateObjective = (index: number, value: string) => {
    setObjectivesList((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const handleRemoveObjective = (index: number) => {
    setObjectivesList((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Générateur dédié appelé directement depuis le composant ObjectiveExamBatchUploader (Mode 3 autonome)
  const handleGenerateFromBatchUploader = async (
    courseFile: File | null,
    examFiles: File[],
    options?: {
      libraryCourse?: { id: string; title: string; subject: string; wordCount: number; content: string } | null;
      customTitle?: string;
      customSubject?: string;
    }
  ) => {
    const libCourse = options?.libraryCourse || null;
    if (courseFile) {
      setUploadedCourseFile(courseFile);
      setUploadedFileName(courseFile.name);
    } else if (libCourse) {
      setUploadedFileName(libCourse.title);
    }

    const effectiveSubj = options?.customSubject || newSubject;
    if (options?.customSubject) setNewSubject(options.customSubject);

    const title =
      (options?.customTitle || newTitle).trim() ||
      (courseFile ? courseFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ") : "") ||
      libCourse?.title ||
      "Synthèse Médicale Protocole Argon";
    setNewTitle(title);

    setIsGenerating(true);
    setCurrentStepIndex(1);
    setTotalStepsCount(2);
    setProgressLabel("Lecture intégrale du support de cours...");

    try {
      let courseText = "";
      if (courseFile) {
        const courseRes = await readFile(courseFile);
        if (!courseRes.success || !courseRes.content) {
          throw new Error(courseRes.error || "Impossible de lire le fichier de cours.");
        }
        courseText = repairMedicalFormulasInText(cleanMedicalSourceText(courseRes.content));
      } else if (libCourse?.content) {
        courseText = repairMedicalFormulasInText(cleanMedicalSourceText(libCourse.content));
      } else if (uploadedRawText.trim()) {
        courseText = repairMedicalFormulasInText(cleanMedicalSourceText(uploadedRawText));
      } else {
        throw new Error("Veuillez sélectionner un fichier de cours ou un cours de votre bibliothèque.");
      }

      setUploadedRawText(courseText);

      const parsedExams: UploadedExamInput[] = [];
      for (let i = 0; i < examFiles.length; i++) {
        const ef = examFiles[i];
        setProgressLabel(`Lecture de l'évaluation (${i + 1}/${examFiles.length}) : ${ef.name}...`);
        const res = await readFile(ef);
        if (res.success && res.content) {
          parsedExams.push({
            fileName: ef.name,
            name: ef.name,
            content: res.content,
          });
        }
      }

      const argonResult = await executeArgonDualStagePipeline({
        courseTitle: title,
        courseText,
        examFiles: parsedExams,
        forcedMatiere: effectiveSubj,
        predefinedObjectives: objectivesList.length > 0 ? objectivesList : undefined,
        onProgress: (step, total, label) => {
          setCurrentStepIndex(step);
          setTotalStepsCount(total);
          setProgressLabel(label);
        },
      });

      const finalMarkdown = argonResult.markdown;
      const plain = finalMarkdown.replace(/[#*`>|]/g, " ");
      const wc = Math.max(1, plain.trim().split(/\s+/).filter(Boolean).length);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      let insertedRow: any = null;

      if (userId) {
        try {
          const { data: dbRow } = await untypedTable("summaries")
            .insert({
              user_id: userId,
              title,
              content: finalMarkdown,
              summary_type: "drive_objective_strategy",
              metadata: {
                subject: effectiveSubj,
                doctrine: "drive_objective_strategy",
                doctrineLabel: "Objectifs & Audit d'Examens (Protocole Argon)",
                auditedExamsCount: parsedExams.length,
                auditedExamNames: parsedExams.map((e) => e.fileName),
                generatedAt: new Date().toISOString(),
              },
            })
            .select()
            .single();
          insertedRow = dbRow;
        } catch {
          // Sauvegarde locale garantie
        }
      }

      const createdItem: EditorSummaryItem = {
        id: insertedRow?.id || `sum-${Date.now()}`,
        title,
        subject: effectiveSubj,
        updatedAt: "Aujourd'hui",
        wordCount: wc,
        doctrineLabel: "Objectifs & Audit d'Examens (Protocole Argon)",
        htmlContent: finalMarkdown,
      };

      unTombstoneEntity("summary", createdItem.id, createdItem.title);

      try {
        sessionStorage.setItem(`dawjang_active_summary_${createdItem.id}`, JSON.stringify(createdItem));
        localStorage.setItem("dawjang_last_generated_summary", JSON.stringify(createdItem));
      } catch {
        // ignore
      }

      const existing = getLocalSummaries();
      const updated = [createdItem, ...existing.filter((s) => s.id !== createdItem.id)];
      saveLocalSummaries(updated);

      grantDawJangXP(
        DAWJANG_XP_REWARDS.SUMMARY_GENERATED,
        `Synthèse « ${title} » générée (Protocole Argon)`
      );

      toast({
        title: "Synthèse & Audit générés avec succès !",
        description: `"${title}" est prêt. Vous pouvez le lire, le modifier et télécharger le PDF officiel à tout moment.`,
      });

      navigate(`/summary/${createdItem.id}`);
    } catch (err: any) {
      toast({
        title: "Erreur lors de la génération",
        description: err?.message || "Impossible de générer le rapport.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setProgressLabel("");
    }
  };

  // Lancement de la génération selon l'un des 2 modes purs
  const handleGenerateSummary = async () => {
    const rawCourse = cleanMedicalSourceText(uploadedRawText.trim());
    const title = newTitle.trim() || "Synthèse Médicale Universitaire";

    // Si aucun objectif n'est encore saisi, initialiser les 5 objectifs académiques types
    let effectiveObjectives = [...objectivesList];
    if (selectedMode === "objectives_verbatim" && effectiveObjectives.length === 0) {
      effectiveObjectives = [
        `Définir les critères diagnostiques et seuils biologiques de référence relatifs à « ${title} »`,
        `Expliquer la physiopathologie et la démarche d'interprétation des examens de première intention`,
        `Établir le diagnostic positif, différentiel et la classification étiologique (centrale vs périphérique)`,
        `Identifier les signes de gravité immédiate et les complications à dépister`,
        `Planifier la prise en charge thérapeutique complète (traitements de 1re intention, posologies et surveillance)`,
      ];
      setObjectivesList(effectiveObjectives);
    }

    const effectiveCourseText =
      rawCourse.length >= 25
        ? rawCourse
        : `Cours médical universitaire sur : ${title} (${newSubject}).\nObjectifs pédagogiques officiels de la faculté :\n${effectiveObjectives
            .map((o, idx) => `${idx + 1}. ${o}`)
            .join("\n")}`;

    setIsGenerating(true);
    setCurrentStepIndex(1);
    setTotalStepsCount(
      selectedMode === "objectives_verbatim"
        ? effectiveObjectives.length
        : 3
    );
    setProgressLabel(
      selectedMode === "objectives_verbatim"
        ? `Rédaction intégrale de l'Objectif 1 sur ${effectiveObjectives.length} : « ${effectiveObjectives[0]} »...`
        : "Croisement avec les annales et rédaction de la Synthèse Unifiée (Protocole Argon)..."
    );

    try {
      let generatedMarkdown = "";

      if (selectedMode === "atlas_magistral") {
        setCurrentStepIndex(1);
        setTotalStepsCount(7);
        setProgressLabel("Étape 1/7 : Cartographie des chapitres Romains (Mode Atlas)...");

        const atlasResult = await generateAtlasMagistralSummary({
          rawCourseText: effectiveCourseText,
          courseTitle: title,
          courseAuthor: "Faculté de Médecine",
          onProgress: (step, total, label) => {
            setCurrentStepIndex(step);
            setTotalStepsCount(total);
            setProgressLabel(label);
          },
        });

        const atlasHtml = compileAtlasSummaryToHtml(atlasResult);
        generatedMarkdown = atlasHtml;
      } else if (selectedMode === "drive_objective_strategy") {
        setCurrentStepIndex(1);
        setTotalStepsCount(5);
        setProgressLabel(
          batchExamFiles.length > 0
            ? `Étape 1/5 : Cartographie du cours + ${batchExamFiles.length} évaluation(s) (Protocole Argon)...`
            : "Étape 1/5 : Cartographie docimologique des objectifs et annales (Protocole Argon)..."
        );

        const parsedExams: UploadedExamInput[] = [];
        for (let i = 0; i < batchExamFiles.length; i++) {
          const ef = batchExamFiles[i];
          setProgressLabel(`Lecture de l'évaluation (${i + 1}/${batchExamFiles.length}) : ${ef.name}...`);
          const res = await readFile(ef);
          if (res.success && res.content) {
            parsedExams.push({
              fileName: ef.name,
              name: ef.name,
              content: res.content,
            });
          }
        }

        const argonResult = await executeArgonDualStagePipeline({
          courseTitle: title,
          courseText: effectiveCourseText,
          examFiles: parsedExams,
          forcedMatiere: newSubject,
          predefinedObjectives: effectiveObjectives.length > 0 ? effectiveObjectives : undefined,
          onProgress: (step, total, label) => {
            setCurrentStepIndex(step);
            setTotalStepsCount(total);
            setProgressLabel(label);
          },
        });

        generatedMarkdown = argonResult.markdown;
      } else {
        try {
          const masterResult = await generateMasterMedicalSummary({
            courseTitle: title,
            courseText: effectiveCourseText,
            predefinedObjectives: effectiveObjectives,
            onProgress: (step, total, label) => {
              setCurrentStepIndex(step);
              setTotalStepsCount(total);
              setProgressLabel(label);
            },
          });
          if (masterResult?.markdown && masterResult.markdown.trim().length > 200) {
            generatedMarkdown = masterResult.markdown;
          }
        } catch (copilotErr) {
          console.warn(
            "[GenerateSummary] Échec tandem Gemini->Sonnet, repli sur pipeline bi-modèle :",
            copilotErr
          );
        }

        if (!generatedMarkdown) {
          try {
            const dualResult = await executeDualModelMedicalPipeline({
              mode: "objectives",
              courseTitle: title,
              courseText: effectiveCourseText,
              extractedObjectives: effectiveObjectives,
              onProgress: (step, total, label) => {
                setCurrentStepIndex(step);
                setTotalStepsCount(total);
                setProgressLabel(label);
              },
            });
            if (dualResult?.markdown && dualResult.markdown.trim().length > 200) {
              generatedMarkdown = dualResult.markdown;
            }
          } catch (dualErr) {
            console.warn(
              "[GenerateSummary] Relais séquentiel sur générateur local :",
              dualErr
            );
          }
        }

        if (!generatedMarkdown) {
          generatedMarkdown = await generateExhaustiveObjectivesSummary({
            title,
            subject: newSubject,
            courseText: effectiveCourseText,
            objectives: effectiveObjectives,
            onProgress: (currentObj, totalObjs, objTitle) => {
              setCurrentStepIndex(currentObj);
              setTotalStepsCount(totalObjs);
              setProgressLabel(
                `Objectif ${currentObj} / ${totalObjs} en cours : « ${objTitle} »`
              );
            },
          });
        }
      }

      let finalMarkdown = "";
      let plain = "";

      if (selectedMode === "drive_objective_strategy") {
        finalMarkdown = generatedMarkdown;
        try {
          const parsed = JSON.parse(generatedMarkdown);
          plain = objectiveSummaryDataToMarkdown(parsed);
        } catch {
          plain = generatedMarkdown;
        }
      } else {
        const rawCleaned = cleanAndStructureMarkdown(generatedMarkdown);
        finalMarkdown = cleanForDawJangPdf(rawCleaned);
        plain = finalMarkdown.replace(/[#*`>|]/g, " ");
      }

      const wc = Math.max(1, plain.trim().split(/\s+/).filter(Boolean).length);
      const doctrineLabel =
        selectedMode === "atlas_magistral"
          ? (DOCTRINE_LABELS.atlas_magistral || "Mode Atlas Magistral")
          : selectedMode === "objectives_verbatim"
          ? DOCTRINE_LABELS.objectives_verbatim
          : DOCTRINE_LABELS.drive_objective_strategy;

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      let insertedRow: any = null;

      if (userId) {
        try {
          const { data: dbRow } = await untypedTable("summaries")
            .insert({
              user_id: userId,
              title,
              content: finalMarkdown,
              summary_type: selectedMode,
              metadata: {
                subject: newSubject,
                doctrine: selectedMode,
                doctrineLabel,
                objectives: objectivesList,
                generatedAt: new Date().toISOString(),
              },
            })
            .select()
            .single();
          insertedRow = dbRow;
        } catch {
          // Sauvegarde locale garantie
        }
      }

      const createdItem: EditorSummaryItem = {
        id: insertedRow?.id || `sum-${Date.now()}`,
        title,
        subject: newSubject,
        updatedAt: "Aujourd'hui",
        wordCount: wc,
        doctrineLabel,
        htmlContent: finalMarkdown,
      };

      // Dverrouillage immdiat du registre d'exclusion pour ce nouveau rsum
      unTombstoneEntity("summary", createdItem.id, createdItem.title);

      // Sauvegarde session & stockage local de secours immdiat
      try {
        sessionStorage.setItem(`dawjang_active_summary_${createdItem.id}`, JSON.stringify(createdItem));
        localStorage.setItem("dawjang_last_generated_summary", JSON.stringify(createdItem));
      } catch {
        // ignore
      }

      const existing = getLocalSummaries();
      const updated = [createdItem, ...existing.filter((s) => s.id !== createdItem.id)];
      saveLocalSummaries(updated);

      grantDawJangXP(
        DAWJANG_XP_REWARDS.SUMMARY_GENERATED,
        `Synthèse « ${title} » générée`
      );

      pushAppNotification({
        type: "course",
        title: "Synthèse académique générée",
        message: `"${title}" (${wc.toLocaleString("fr-FR")} mots · ${
          selectedMode === "objectives_verbatim"
            ? `${objectivesList.length}/${objectivesList.length} objectifs traités`
            : "Synthèse Unifiée (Protocole Argon)"
        }) est prête.`,
      });

      if (selectedMode === "objectives_verbatim" && lastFailedObjectives.length > 0) {
        toast({
          title: "Certains objectifs n'ont pas pu être rédigés par l'IA",
          description: `Objectif(s) ${lastFailedObjectives.join(", ")} : service IA indisponible ou quota atteint (version extraite du cours insérée). Relancez la synthèse plus tard.`,
          variant: "destructive",
        });
      }

      toast({
        title: "Synthèse intégrale générée avec succès",
        description:
          selectedMode === "objectives_verbatim"
            ? `Les ${objectivesList.length} objectifs ont été rédigés du 1er au ${objectivesList.length}e (${wc.toLocaleString("fr-FR")} mots).`
            : `Synthèse Unifiée axée sur les objectifs et croisée avec les annales prête.`,
      });

      // Redirection directe vers la page dédiée de lecture/édition du résumé
      navigate(`/summary/${createdItem.id}`);
    } catch (err: any) {
      toast({
        title: "Erreur lors de la génération",
        description: err?.message || "Impossible de générer la synthèse.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setProgressLabel("");
    }
  };

  const progressPercentage = useMemo(() => {
    if (!isGenerating || totalStepsCount <= 0) return 0;
    return Math.min(98, Math.round(((currentStepIndex - 0.25) / totalStepsCount) * 100));
  }, [isGenerating, currentStepIndex, totalStepsCount]);

  return (
    <div className="min-h-screen w-full pb-16">
      <div className="container max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-7">
        {/* =====================================================================
            EN-TÊTE STUDIO ACADÉMIQUE (UNIFIÉ AVEC CONSTRUCTEUR QCM & SYNTHÈSES)
        ===================================================================== */}
        <header className="w-full space-y-2 pb-5 border-b border-border/80">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <span>
              Constructeur de synthèses médicales • Fidèle aux Objectifs &amp; Synthèse Unifiée (Protocole Argon)
            </span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pt-0.5">
            <h1 className="font-serif text-2xl sm:text-[28px] font-bold tracking-tight text-foreground leading-tight shrink-0">
              Constructeur de Synthèses
            </h1>

            <nav
              aria-label="Navigation Synthèses"
              className="inline-flex flex-nowrap items-center gap-1 p-1.5 rounded-2xl bg-muted/90 border border-border/80 w-fit max-w-full overflow-x-auto shrink-0"
            >
              <button
                type="button"
                onClick={() => navigate("/summaries")}
                className="relative px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Mes Synthèses</span>
              </button>

              {[
                {
                  id: "atlas_magistral" as PureSynthesisMode,
                  label: "Mode Atlas",
                  icon: Layers,
                },
                {
                  id: "objectives_verbatim" as PureSynthesisMode,
                  label: "Fidèle aux Objectifs",
                  icon: Target,
                },
                {
                  id: "drive_objective_strategy" as PureSynthesisMode,
                  label: "Objectifs & Audit d'Annales",
                  icon: ShieldCheck,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = selectedMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedMode(tab.id)}
                    className={`relative px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all flex items-center gap-2 ${
                      isActive
                        ? "bg-card text-foreground shadow-sm border border-border/60"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? "text-primary" : ""
                      }`}
                    />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* ÉTAPE 1 : CHOIX DE L'ARCHITECTURE (2 MODES EXCLUSIFS) */}
        <section className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 space-y-5 shadow-sm">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-wider uppercase">
                1. ARCHITECTURE DE SYNTHÈSE MÉDICALE
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                100 % des Objectifs &amp; Tableaux du cours garantis
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-foreground">
              Choisissez votre mode de rédaction
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Sélectionnez l&apos;architecture souhaitée : le Mode 1 traite les objectifs du cours, tandis que le Protocole Argon génère la Synthèse Unifiée complète (Cours + Audit d&apos;annales en masse).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: "atlas_magistral" as PureSynthesisMode,
                title: "Mode Atlas",
                desc: "Restitution intégrale du cours en chapitres Romains • Tableaux comparatifs .course-table, seuils chiffrés & protocoles sans coupure.",
                icon: Layers,
                badge: "ATLAS",
                isHighlight: true,
              },
              {
                id: "objectives_verbatim" as PureSynthesisMode,
                title: "Fidèle aux Objectifs",
                desc: "Extrait la diapositive officielle « Objectifs » du professeur et consacre 1 passe dédiée à chaque objectif du 1er au dernier.",
                icon: Target,
                badge: "OBJECTIFS",
                isHighlight: false,
              },
              {
                id: "drive_objective_strategy" as PureSynthesisMode,
                title: "Objectifs & Audit d'Annales",
                desc: "Synthèse Unifiée en 4 Parties : Audit d'incidence par sous-partie, Cours exhaustif complet, 5 Pièges Majeurs & Démarche Cas Clinique.",
                icon: ShieldCheck,
                badge: "AUDIT D'ANNALES",
                isHighlight: false,
              },
            ].map((modeCard) => {
              const MIcon = modeCard.icon;
              const active = selectedMode === modeCard.id;
              return (
                <div
                  key={modeCard.id}
                  onClick={() => setSelectedMode(modeCard.id)}
                  className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                    active
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                      : "border-border bg-background/50 hover:border-primary/40"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <MIcon className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs sm:text-sm font-bold text-foreground">
                          {modeCard.title}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[9.5px] font-extrabold uppercase ${
                          modeCard.isHighlight
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {modeCard.badge}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                      {modeCard.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================
            SI MODE 3 (PROTOCOLE ARGON) : SCHÉMA AUTONOME SANS DOUBLON DE L'ÉTAPE 1
        ======================================================================== */}
        {selectedMode === "drive_objective_strategy" ? (
          <ObjectiveExamBatchUploader
            defaultCourseFile={uploadedCourseFile}
            isGenerating={isGenerating}
            progressLabel={progressLabel}
            onGenerateComplete={handleGenerateFromBatchUploader}
            title={newTitle}
            onTitleChange={setNewTitle}
            subject={newSubject}
            onSubjectChange={setNewSubject}
            subjectFilters={SUBJECT_FILTERS}
            libraryCourses={libraryCourses}
          />
        ) : (
          <>
            {/* ====================================================================
                SI MODE 1 OU MODE 2 : ÉTAPE 2 — SOURCE DU COURS & IDENTIFICATION
            ==================================================================== */}
            <section className="rounded-3xl border border-[#E5DEC9] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-7 space-y-5 shadow-[0_10px_30px_-14px_rgba(24,24,27,0.05)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-[#18181B] text-[#FAF8F5] font-mono text-xs font-bold inline-flex items-center justify-center shadow-2xs">
                    02
                  </span>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-[#18181B] dark:text-zinc-100">
                      Source du Cours &amp; Identification
                    </h2>
                    <p className="text-xs text-[#71717A]">
                      Importez votre polycopié PDF/DOCX, choisissez un cours enregistré ({libraryCourses.length}) ou collez votre texte.
                    </p>
                  </div>
                </div>

                {/* Sélecteur 3 sources */}
                <div className="inline-flex items-center rounded-xl bg-[#FAF8F5] dark:bg-zinc-800 p-1 border border-[#E5DEC9] dark:border-zinc-700 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setSourceTab("upload")}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      sourceTab === "upload"
                        ? "bg-[#18181B] text-[#FAF8F5] dark:bg-white dark:text-zinc-900 shadow-2xs"
                        : "text-[#71717A] hover:text-[#18181B]"
                    }`}
                  >
                    <FileUp className="h-3.5 w-3.5" />
                    <span>Fichier (PDF / DOCX)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceTab("library")}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      sourceTab === "library"
                        ? "bg-[#18181B] text-[#FAF8F5] dark:bg-white dark:text-zinc-900 shadow-2xs"
                        : "text-[#71717A] hover:text-[#18181B]"
                    }`}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>Bibliothèque ({libraryCourses.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceTab("paste")}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      sourceTab === "paste"
                        ? "bg-[#18181B] text-[#FAF8F5] dark:bg-white dark:text-zinc-900 shadow-2xs"
                        : "text-[#71717A] hover:text-[#18181B]"
                    }`}
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    <span>Texte libre</span>
                  </button>
                </div>
              </div>

              {/* Onglet 1 : Upload Fichier */}
              {sourceTab === "upload" && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setIsDraggingFile(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) await processSelectedFile(file);
                  }}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border-2 border-dashed transition-all ${
                    isDraggingFile
                      ? "border-[#D96B43] bg-[#D96B43]/10"
                      : uploadedFileName
                      ? "border-[#2E6F4E]/45 bg-[#2E6F4E]/[0.05]"
                      : "border-[#E5DEC9] dark:border-zinc-700 bg-[#FAF8F5]/75 dark:bg-zinc-800/40 hover:border-[#D96B43]/50"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`p-3.5 rounded-2xl shrink-0 ${
                        uploadedFileName
                          ? "bg-[#2E6F4E]/15 text-[#2E6F4E]"
                          : "bg-[#D96B43]/15 text-[#D96B43]"
                      }`}
                    >
                      {uploadedFileName ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <FileUp className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#18181B] dark:text-zinc-100 truncate">
                        {uploadedFileName
                          ? `Document actif : ${uploadedFileName}`
                          : "Glissez-déposez un polycopié (.PDF, .DOCX, .PPTX, .TXT)"}
                      </p>
                      <p className="text-xs text-[#71717A] mt-0.5">
                        {sourceWordCount > 0
                          ? `${sourceWordCount.toLocaleString(
                              "fr-FR"
                            )} mots extraits · Lecture intégrale de la 1re à la dernière diapositive`
                          : "Détection automatique de la diapositive Objectifs, des formules LaTeX et des tableaux cliniques"}
                      </p>
                    </div>
                  </div>
                  <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-[#18181B] text-[#FAF8F5] dark:bg-white dark:text-zinc-900 px-4 py-2.5 text-xs font-semibold hover:bg-[#27272A] transition-all shrink-0 shadow-xs">
                    <FileUp className="h-3.5 w-3.5 text-[#D96B43]" />
                    <span>{uploadedFileName ? "Changer de fichier" : "Parcourir..."}</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.pptx,.txt,.md"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) await processSelectedFile(f);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Onglet 2 : Bibliothèque */}
              {sourceTab === "library" && (
                <div className="space-y-3 rounded-2xl border border-[#E5DEC9] dark:border-zinc-700 bg-[#FAF8F5]/70 dark:bg-zinc-800/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71717A]" />
                      <Input
                        value={librarySearchQuery}
                        onChange={(e) => setLibrarySearchQuery(e.target.value)}
                        placeholder="Rechercher un cours enregistré dans votre Bibliothèque..."
                        className="pl-8.5 h-9 text-xs bg-white dark:bg-zinc-900 border-[#E5DEC9] rounded-xl"
                      />
                    </div>
                    <span className="font-mono text-[11px] text-[#71717A] shrink-0">
                      {filteredLibraryCourses.length} cours disponible(s)
                    </span>
                  </div>

                  {filteredLibraryCourses.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[#71717A]">
                      Aucun cours trouvé dans votre Bibliothèque. Importez un fichier dans l&apos;onglet « Fichier ».
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
                      {filteredLibraryCourses.map((course) => {
                        const isSelected = selectedLibraryCourseId === course.id;
                        return (
                          <button
                            key={course.id}
                            type="button"
                            onClick={() => handleSelectLibraryCourse(course)}
                            className={`text-left p-3.5 rounded-xl border transition-all flex items-start justify-between gap-2 ${
                              isSelected
                                ? "border-[#D96B43] bg-[#D96B43]/[0.08] shadow-2xs"
                                : "border-[#E5DEC9] dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-[#D96B43]/50"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#FAF8F5] dark:bg-zinc-800 border border-[#E5DEC9] dark:border-zinc-700 text-[#52525B]">
                                  {course.subject}
                                </span>
                                <span className="text-[10.5px] font-mono text-[#71717A]">
                                  {course.wordCount.toLocaleString("fr-FR")} mots
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-[#18181B] dark:text-zinc-100 truncate mt-1.5">
                                {course.title}
                              </p>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-[#D96B43] shrink-0 mt-0.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Onglet 3 : Texte libre */}
              {sourceTab === "paste" && (
                <div className="space-y-2">
                  <textarea
                    rows={6}
                    value={uploadedRawText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUploadedRawText(val);
                      setUploadedFileName(val.trim() ? "Texte collé manuellement" : null);
                      scanCourseForObjectives(val);
                    }}
                    placeholder="Collez ici l'intégralité de votre cours, polycopié ou prise de notes..."
                    className="w-full rounded-2xl border border-[#E5DEC9] dark:border-zinc-700 bg-[#FAF8F5] dark:bg-zinc-800 px-4 py-3 text-xs text-[#18181B] dark:text-zinc-100 focus:outline-none focus:border-[#D96B43] leading-relaxed font-sans"
                  />
                </div>
              )}

              {/* Titre & Discipline */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#52525B] dark:text-zinc-400">
                    Intitulé de la Synthèse
                  </label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex : Anémies — Diagnostic & Prise en charge (Pr Saliou Diop)"
                    className="h-10 text-xs rounded-xl border-[#E5DEC9] dark:border-zinc-700 bg-[#FAF8F5] dark:bg-zinc-800"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#52525B] dark:text-zinc-400">
                    Discipline / Unité d&apos;Enseignement
                  </label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full h-10 rounded-xl border border-[#E5DEC9] dark:border-zinc-700 bg-[#FAF8F5] dark:bg-zinc-800 px-3 text-xs text-[#18181B] dark:text-zinc-100 focus:outline-none focus:border-[#D96B43]"
                  >
                    {SUBJECT_FILTERS.filter((s) => s !== "Tous").map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SI MODE 1 ACTIF : VÉRIFICATION DE LA DIAPO OBJECTIFS & LISTE NUMÉROTÉE */}
              {selectedMode === "objectives_verbatim" && (
                <div className="rounded-2xl border border-[#E5DEC9] dark:border-zinc-700 bg-[#FAF8F5]/80 dark:bg-zinc-800/40 p-5 space-y-4 mt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Target className="h-4 w-4 text-[#D96B43]" />
                        <h3 className="text-xs sm:text-sm font-bold text-[#18181B] dark:text-zinc-100">
                          Objectifs Pédagogiques du Cours ({objectivesList.length} objectif
                          {objectivesList.length > 1 ? "s" : ""} prêt
                          {objectivesList.length > 1 ? "s" : ""} à être traité
                          {objectivesList.length > 1 ? "s" : ""} de 1 à {objectivesList.length || 1})
                        </h3>
                        {hadExplicitObjectivesInCourse === true && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-[#2E6F4E]/35 bg-[#2E6F4E]/10 text-[#2E6F4E]"
                          >
                            Diapositive « Objectifs » détectée
                          </Badge>
                        )}
                        {hadExplicitObjectivesInCourse === false && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-[#C87D28]/40 bg-[#C87D28]/10 text-[#C87D28]"
                          >
                            Aucun bloc d&apos;objectifs explicite — Saisissez ou générez-les
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11.5px] text-[#71717A]">
                        Vérifiez que les objectifs correspondent exactement à la diapositive du professeur. Chacun sera rédigé intégralement dans sa propre passe.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {rawObjectivesSlideSnippet && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowRawSlidePreview((v) => !v)}
                          className="h-9 gap-1.5 rounded-xl border-[#E5DEC9] bg-white dark:bg-zinc-900 text-xs font-semibold"
                        >
                          <Eye className="h-3.5 w-3.5 text-[#D96B43]" />
                          <span>{showRawSlidePreview ? "Masquer la diapo brute" : "Voir la diapo Objectifs brute"}</span>
                        </Button>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        onClick={handleProposeObjectivesWithAI}
                        disabled={isProposingObjectives}
                        className="h-9 gap-1.5 rounded-xl bg-[#D96B43] hover:bg-[#C25A34] text-white text-xs font-semibold shrink-0 shadow-2xs"
                      >
                        {isProposingObjectives ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {rawObjectivesSlideSnippet
                            ? "Relire la diapo Objectifs par l'IA"
                            : objectivesList.length > 0
                            ? "Re-proposer les objectifs par l'IA"
                            : "Proposer les objectifs du cours par l'IA"}
                        </span>
                      </Button>
                    </div>
                  </div>

                  {showRawSlidePreview && rawObjectivesSlideSnippet && (
                    <div className="rounded-xl border border-[#D96B43]/35 bg-white dark:bg-zinc-900 p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#D96B43]">
                          Texte brut extrait de la diapositive « Objectifs » du polycopié :
                        </span>
                      </div>
                      <pre className="text-[11.5px] font-mono whitespace-pre-wrap text-[#27272A] dark:text-zinc-300 leading-relaxed max-h-44 overflow-y-auto">
                        {rawObjectivesSlideSnippet}
                      </pre>
                    </div>
                  )}

                  {objectivesList.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#E5DEC9] dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 text-center space-y-2">
                      <AlertCircle className="h-5 w-5 text-[#D96B43] mx-auto" />
                      <p className="text-xs font-medium text-[#18181B] dark:text-zinc-200">
                        Aucun objectif défini pour le moment.
                      </p>
                      <p className="text-[11.5px] text-[#71717A] max-w-lg mx-auto">
                        Cliquez sur <strong>« Proposer les objectifs du cours par l&apos;IA »</strong> ci-dessus ou ajoutez manuellement chaque objectif ci-dessous.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {objectivesList.map((obj, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2.5 bg-white dark:bg-zinc-900 border border-[#E5DEC9] dark:border-zinc-700 rounded-xl px-3.5 py-2 shadow-2xs"
                        >
                          <span className="font-mono text-[11px] font-bold text-white bg-[#18181B] dark:bg-[#D96B43] px-2 py-0.5 rounded-md shrink-0">
                            Obj. {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={obj}
                            onChange={(e) => handleUpdateObjective(idx, e.target.value)}
                            className="flex-1 bg-transparent text-xs font-medium text-[#18181B] dark:text-zinc-100 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveObjective(idx)}
                            className="p-1 text-[#71717A] hover:text-destructive rounded-lg transition-colors shrink-0"
                            title="Retirer cet objectif"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      value={newObjectiveDraft}
                      onChange={(e) => setNewObjectiveDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddObjective();
                        }
                      }}
                      placeholder="Ajouter un objectif pédagogique (ex : Énoncer les principes et modalités du traitement)..."
                      className="h-9 text-xs bg-white dark:bg-zinc-900 border-[#E5DEC9] rounded-xl"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddObjective}
                      className="h-9 gap-1.5 rounded-xl border-[#E5DEC9] bg-white dark:bg-zinc-900 text-xs font-semibold shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5 text-[#D96B43]" />
                      <span>Ajouter</span>
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {/* PIED D'ACTION UNIQUE POUR LE MODE 1 (FIDÈLE AUX OBJECTIFS) */}
            <div className="rounded-3xl border border-[#E5DEC9] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_12px_32px_-12px_rgba(24,24,27,0.06)]">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-[#18181B] dark:text-zinc-100">
                  {`Mode 1 actif (Fidèle aux Objectifs) : ${objectivesList.length} objectif(s) seront rédigés individuellement du 1er au ${
                    objectivesList.length || 1
                  }e`}
                </p>
                <p className="text-[11.5px] text-[#71717A]">
                  Une fois la rédaction terminée, votre synthèse s&apos;ouvrira automatiquement dans le Lecteur &amp; Éditeur Interactif.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/summaries")}
                  disabled={isGenerating}
                  className="h-11 rounded-xl border-[#E5DEC9] text-xs font-semibold px-4"
                >
                  Annuler
                </Button>

                <Button
                  type="button"
                  onClick={handleGenerateSummary}
                  disabled={isGenerating}
                  className="h-11 gap-2 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-[#FAF8F5] dark:bg-white dark:text-zinc-900 px-6 text-xs font-bold shadow-md transition-all active:scale-[0.99]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 text-[#D96B43] animate-spin" />
                      <span>
                        Passe {currentStepIndex}/{totalStepsCount} ({elapsedSeconds}s)...
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-[#D96B43]" />
                      <span>Lancer la Synthèse Intégrale</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* BARRE DE PROGRESSION EN DIRECT PENDANT LA GÉNÉRATION SÉQUENTIELLE */}
        {isGenerating && (
          <section className="rounded-3xl border-2 border-[#881337] bg-white dark:bg-zinc-900 p-6 shadow-xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#881337]/15 text-[#881337] dark:text-rose-400 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <div>
                  <span className="text-[10.5px] font-mono font-bold uppercase tracking-widest text-[#881337] dark:text-rose-400">
                    RÉDACTION CHIRURGICALE SANS TRONCATURE • PASSE {currentStepIndex} / {totalStepsCount}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-[#18181B] dark:text-white mt-0.5">
                    {progressLabel}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] dark:bg-zinc-800 border border-[#E5DEC9] font-bold text-[#881337] dark:text-rose-400">
                  {progressPercentage}%
                </span>
                <span className="text-[#71717A] tabular-nums">{elapsedSeconds}s écoulées</span>
              </div>
            </div>

            <div className="w-full h-2.5 rounded-full bg-[#F2ECE1] dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#881337] to-[#D96B43] transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            {selectedMode === "objectives_verbatim" && objectivesList.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                {objectivesList.map((obj, idx) => {
                  const stepNum = idx + 1;
                  const isDone = stepNum < currentStepIndex;
                  const isCurrent = stepNum === currentStepIndex;
                  return (
                    <div
                      key={idx}
                      className={`px-3 py-2 rounded-xl border text-xs flex items-center gap-2 transition-all ${
                        isDone
                          ? "bg-[#2E6F4E]/10 border-[#2E6F4E]/30 text-[#2E6F4E] font-semibold"
                          : isCurrent
                          ? "bg-[#881337]/10 border-[#881337] text-[#18181B] dark:text-white font-bold"
                          : "bg-[#FAF8F5] dark:bg-zinc-800/50 border-[#E5DEC9] text-[#71717A]"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#2E6F4E] shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="h-3.5 w-3.5 text-[#881337] animate-spin shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-current shrink-0 inline-block" />
                      )}
                      <span className="truncate">
                        Obj. {stepNum} : {obj}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
