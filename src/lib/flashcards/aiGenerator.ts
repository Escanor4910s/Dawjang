// src/lib/flashcards/aiGenerator.ts
// Génération IA (Edge Function « generate-flashcards-openai »).
// Pour économiser les crédits et varier les cartes, chaque appel n'envoie
// qu'une FENÊTRE du cours qui avance à chaque génération (couverture tournante)
// et transmet la liste des questions déjà existantes pour les exclure.
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errorUtils";
import { callGeminiAcademicEngine } from "@/lib/syncEngine";
import type { CalibratedFlashcard, FlashcardFormat, RawGeneratedCard } from "./types";
import {
  cleanCourseText,
  isGarbledCard,
  repairClozeAndFormatCard,
  stripMarkdown,
} from "./text";
import {
  isDuplicateOf,
  rawToFlashcard,
  type FlashcardSourceCourse,
} from "./localGenerator";

const COVERAGE_KEY = "hippocampus_flashcard_coverage_v1";
const WINDOW_CHARS = 45_000;

function readCoverage(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(COVERAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCoverage(courseId: string, offset: number) {
  const cov = readCoverage();
  cov[courseId] = offset;
  try {
    localStorage.setItem(COVERAGE_KEY, JSON.stringify(cov));
  } catch {
    // ignore
  }
}

/**
 * Prépare le texte envoyé au LLM :
 * - En mode « objectifs » : le chapeau / introduction (où le professeur écrit les objectifs)
 *   est TOUJOURS transmis en tête, complété par le reste du cours.
 * - En mode « pertinence » : analyse l'ensemble du cours (jusqu'à 45 000 caractères).
 */
function nextContentWindow(
  courseId: string,
  fullText: string,
  mode: "objectives" | "relevance"
): { text: string; nextOffset: number } {
  if (fullText.length <= WINDOW_CHARS) return { text: fullText, nextOffset: 0 };

  if (mode === "objectives") {
    // Le chapeau (intro + objectifs du professeur) est garanti dans les 6 000 premiers caractères
    const intro = fullText.slice(0, 6_000);
    let start = readCoverage()[courseId] || 6_000;
    if (start >= fullText.length - 1_000) start = 6_000;
    const bodyBudget = WINDOW_CHARS - intro.length - 100;
    const bodySlice = fullText.slice(start, start + bodyBudget);
    const nextOffset = start + bodyBudget >= fullText.length ? 6_000 : start + bodyBudget;
    return {
      text: `${intro}\n\n[... suite du cours pour répondre aux objectifs ...]\n\n${bodySlice}`,
      nextOffset,
    };
  }

  let start = readCoverage()[courseId] || 0;
  if (start >= fullText.length - 1_000) start = 0;
  let end = Math.min(fullText.length, start + WINDOW_CHARS);
  const paragraphEnd = fullText.lastIndexOf("\n", end);
  if (paragraphEnd > start + WINDOW_CHARS * 0.7) end = paragraphEnd;
  return { text: fullText.slice(start, end), nextOffset: end >= fullText.length ? 0 : end };
}

const FORMATS: FlashcardFormat[] = ["qa", "definition", "list"];

function normalizeAiCard(input: unknown): RawGeneratedCard | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const rawQuestion = String(raw.question || raw.front || raw.recto || "");
  const rawAnswer = String(raw.answer || raw.back || raw.verso || "");
  const rawCloze = String(raw.cloze || raw.clozeText || "");

  const repaired = repairClozeAndFormatCard(rawQuestion, rawAnswer, rawCloze);
  const question = repaired.question;
  const answer = repaired.answer;

  const rawFormat = String(raw.type || raw.format || "") as FlashcardFormat;
  const format: FlashcardFormat = FORMATS.includes(rawFormat) ? rawFormat : "qa";

  if (question.length < 8 || answer.length < 2) return null;
  const details = Array.isArray(raw.details)
    ? (raw.details as unknown[])
        .map((d: unknown) => stripMarkdown(String(d)))
        .filter((d: string) => d.length > 2)
    : [];

  if (isGarbledCard({ question, answerSummary: answer, answerDetails: details })) {
    return null;
  }
  const importance = Math.max(1, Math.min(5, Number(raw.importance) || 3));

  return {
    format,
    question,
    answer,
    details: details.slice(0, 4),
    clozeText: undefined,
    importance,
    sourceExcerpt: raw.source ? stripMarkdown(String(raw.source)) : undefined,
    objective: raw.objective ? stripMarkdown(String(raw.objective)) : undefined,
  };
}

export interface AiGenerationParams {
  course: FlashcardSourceCourse;
  mode: "objectives" | "relevance";
  customNode: string;
  count: number;
  existingForCourse: CalibratedFlashcard[];
  studyLevel?: string;
}

/**
 * Appelle l'IA et renvoie uniquement des cartes NOUVELLES (déduplication stricte).
 * Lève une erreur si l'IA est indisponible : l'appelant bascule alors sur le moteur local.
 */
export async function generateAiFlashcards({
  course,
  mode,
  customNode,
  count,
  existingForCourse,
  studyLevel,
}: AiGenerationParams): Promise<CalibratedFlashcard[]> {
  const fullText = cleanCourseText(course.content);
  if (fullText.length < 200) throw new Error("Cours trop court pour une génération IA.");

  const { text, nextOffset } = nextContentWindow(course.id, fullText, mode);
  const instructedText = `[CONSIGNE IMPÉRATIVE DE RÉDACTION : N'utilise JAMAIS la syntaxe Anki {{c1::...}} ni {{c2::...}} ni de texte à trous "cloze". Écris toutes les unités et valeurs normalement et lisiblement (ex. 13 g/dL, 12 g/dL, 95 g/dL). Au Recto ("question"), pose une question médicale claire et bien formulée, ou une affirmation clinique ciblée à argumenter selon le cours. Au Verso ("answer" et "details"), donne une réponse claire, précise, sans débordement et 100 % fidèle au cours.]\n\n${text}`;
  const excludeQuestions = existingForCourse
    .slice(0, 80)
    .map((c) => c.question.slice(0, 140));

  let data: { cards?: unknown; flashcards?: unknown; error?: string } | null = null;

  try {
    const res = await supabase.functions.invoke("generate-flashcards-openai", {
      body: {
        content: instructedText,
        courseTitle: course.title,
        mode,
        count,
        excludeQuestions,
        studyLevel,
      },
    });
    if (res.data && !res.error) {
      data = res.data;
    } else if (res.error) {
      throw res.error;
    }
  } catch (invokeErr: unknown) {
    console.warn("[aiGenerator] invoke error, bascule sur fetch direct:", getErrorMessage(invokeErr, ""));
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    try {
      const directRes = await fetch(`${supabaseUrl}/functions/v1/generate-flashcards-openai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          content: instructedText,
          courseTitle: course.title,
          mode,
          count,
          excludeQuestions,
          studyLevel,
        }),
      });
      if (!directRes.ok) {
        const errJson = await directRes.json().catch(() => null);
        throw new Error(errJson?.error || `Erreur serveur IA (${directRes.status})`);
      }
      data = await directRes.json();
    } catch (fetchErr: unknown) {
      // Relais via le moteur Gemini / Académique direct avec consignes strictes Recto / Verso
      try {
        const sysPrompt = `Tu es un professeur agrégé de médecine. Génère exactement ${count} flashcards médicales à partir du cours fourni, au format JSON strict : {"cards":[{"format":"qa","question":"...","answer":"...","details":["..."],"importance":5}]}.
RÈGLES IMPÉRATIVES :
1. RECTO ("question") : Pose une question médicale claire, bien formulée et précise, OU une affirmation clinique issue du cours demandant de justifier/préciser le mécanisme, le critère diagnostique ou la conduite à tenir. INTERDICTION des textes à trous aléatoires "[…]".
2. VERSO ("answer" et "details") : Réponse claire, précise, concise (1 phrase directe dans "answer" <= 200 caractères, et 2 à 3 puces courtes dans "details" <= 140 caractères chacune), SANS DÉBORDEMENT, SANS HORS-SUJET, 100 % conforme au cours.`;
        const usrPrompt = `Titre du cours : ${course.title}\nMode : ${mode === "objectives" ? "Basé sur les objectifs du cours" : "Notions cliniques clés du cours"}\nQuestions déjà existantes à ne pas répéter : ${excludeQuestions.slice(0, 20).join(" | ")}\n\nTexte du cours :\n${text.slice(0, 14000)}`;
        const rawJsonText = await callGeminiAcademicEngine(sysPrompt, usrPrompt, 0.3);
        if (rawJsonText) {
          const jsonMatch = rawJsonText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            data = Array.isArray(parsed) ? { cards: parsed } : parsed;
          }
        }
      } catch {
        // Bascule sur le moteur local déterministe
      }
      if (!data) {
        throw new Error(getErrorMessage(fetchErr, "") || getErrorMessage(invokeErr, "") || "Service IA indisponible.");
      }
    }
  }

  if (data?.error) throw new Error(data.error);

  const rawList: unknown[] = Array.isArray(data?.cards)
    ? data.cards
    : Array.isArray(data?.flashcards)
    ? data.flashcards
    : [];
  if (rawList.length === 0) throw new Error("L'IA n'a renvoyé aucune carte.");

  writeCoverage(course.id, nextOffset);

  const accepted: CalibratedFlashcard[] = [];
  rawList.forEach((r) => {
    const card = normalizeAiCard(r);
    if (!card) return;
    if (isDuplicateOf(card, [...existingForCourse, ...accepted])) return;
    accepted.push(
      rawToFlashcard(card, {
        course,
        mode,
        customNode,
        rank: existingForCourse.length + accepted.length + 1,
        generator: "ai",
      })
    );
  });

  return accepted;
}
