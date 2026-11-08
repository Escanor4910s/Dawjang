// src/lib/flashcards/smartAiGenerator.ts
// Service unifié de génération IA pour les Smart Flashcards (8 modalités)
// Architecture résiliente multi-niveaux :
// 1. Tente l'Edge Function dédiée generate-smart-flashcards
// 2. Bascule immédiatement et sans erreur sur le backend académique certifié (mor-chat / Gemini)
// 3. Répare et valide le JSON avec normalisation 100 % garantie sans crash

import { supabase } from "@/integrations/supabase/client";
import { callGeminiAcademicEngine } from "@/lib/syncEngine";
import { repairAndParseQuizJson } from "@/lib/jsonRepair";
import { SmartFlashcard, normalizeSmartDeck } from "@/types/smartFlashcards";

export interface GenerateSmartParams {
  courseTitle?: string;
  title?: string;
  content: string;
  count?: number;
  objectives?: string[];
  previousQuestions?: string[];
  targetDifficulty?: number;
}

export async function generateSmartFlashcards({
  courseTitle,
  title,
  content,
  count = 8,
  objectives = [],
  previousQuestions = [],
  targetDifficulty = 2,
}: GenerateSmartParams): Promise<SmartFlashcard[]> {
  const realTitle = courseTitle || title || "Cours Universitaire";
  const cleanText = content.trim();
  if (cleanText.length < 30) {
    throw new Error(
      "Contenu du cours insuffisant pour la génération IA (minimum 30 caractères requis)."
    );
  }

  // ==========================================================================
  // NIVEAU 1 : TENTATIVE VIA EDGE FUNCTION DÉDIÉE
  // ==========================================================================
  try {
    const edgeRes = await supabase.functions.invoke("generate-smart-flashcards", {
      body: {
        title: realTitle,
        content: cleanText.slice(0, 35000),
        count,
        objectives,
        previousQuestions,
        targetDifficulty,
      },
    });

    if (edgeRes.data && !edgeRes.error) {
      const rawCards =
        edgeRes.data.cards || edgeRes.data.flashcards || edgeRes.data;
      if (Array.isArray(rawCards) && rawCards.length > 0) {
        return normalizeSmartDeck(
          rawCards,
          edgeRes.data.detectedSubject || realTitle
        );
      }
    }
  } catch (err) {
    console.warn(
      "[smartAiGenerator] Edge function non disponible. Bascule transparente sur le backend académique (mor-chat) :",
      err
    );
  }

  // ==========================================================================
  // NIVEAU 2 : RELAIS VIA LE MOTEUR ACADÉMIQUE MOR-CHAT / GEMINI
  // ==========================================================================
  const antiRepetitionText =
    previousQuestions.length > 0
      ? `INTERDICTION de reposer ces questions déjà posées :\n${previousQuestions.slice(0, 15).map((q) => `- ${q}`).join("\n")}\n`
      : "";

  const systemInstruction = `Tu es un professeur d'université concevant des évaluations de haut niveau pour des concours et examens.
Tu dois transformer le cours fourni en un tableau JSON STRICT de Smart Flashcards réparties sur 8 modalités interactives couvrant tout le cours du début à la fin.

RÈGLES DE CONCEPTION STRICTES :
1. Génère exactement ${count} cartes riches, précises et sans hallucination.
2. Évite tout placeholder générique ("Catégorie A", "Élément 1"). Les catégories et items de "categorize" doivent être de vrais termes cliniques ou académiques.
3. Chaque carte doit comporter les 3 variantes de reformulation (level1Prompt, level2Prompt, level3Prompt).
${antiRepetitionText}
Structure JSON attendue :
{
  "detectedSubject": "NOM_MATIERE",
  "cards": [
    {
      "id": "card-1",
      "subjectTag": "NOM_MATIERE",
      "courseSection": "Titre du chapitre",
      "objectiveTitle": "Objectif pédagogique",
      "difficulty": ${targetDifficulty},
      "prompt": "Question analytique ou cas clinique",
      "variants": {
        "level1Prompt": "Formulation niveau 1 mécanismes",
        "level2Prompt": "Formulation niveau 2 clinique",
        "level3Prompt": "Formulation niveau 3 piège examen"
      },
      "answer": "Réponse rigoureuse et complète",
      "keywords": ["mot1", "mot2", "mot3"],
      "mcq": {
        "question": "Question QCM",
        "options": [
          { "id": "A", "text": "Option A", "isCorrect": false },
          { "id": "B", "text": "Option B", "isCorrect": true },
          { "id": "C", "text": "Option C", "isCorrect": false },
          { "id": "D", "text": "Option D", "isCorrect": false }
        ]
      },
      "trueFalse": {
        "statement": "Affirmation clinique",
        "isTrue": true
      },
      "cloze": {
        "sentenceBefore": "Texte avant le terme ",
        "missingTerm": "terme exact",
        "sentenceAfter": " suite du texte.",
        "distractors": ["distracteur1", "distracteur2", "distracteur3"]
      },
      "categorize": {
        "instruction": "Classe ces éléments dans les catégories correspondantes",
        "categoryA": "Vraie Catégorie A",
        "categoryB": "Vraie Catégorie B",
        "items": [
          { "id": "1", "label": "Vrai terme 1", "target": "A" },
          { "id": "2", "label": "Vrai terme 2", "target": "B" },
          { "id": "3", "label": "Vrai terme 3", "target": "A" },
          { "id": "4", "label": "Vrai terme 4", "target": "B" }
        ]
      },
      "matching": {
        "instruction": "Associe chaque élément à sa définition",
        "pairs": [
          { "id": "p1", "left": "Concept 1", "right": "Définition 1" },
          { "id": "p2", "left": "Concept 2", "right": "Définition 2" },
          { "id": "p3", "left": "Concept 3", "right": "Définition 3" }
        ]
      },
      "deepDive": {
        "expectedSummary": "Synthèse de la réponse attendue",
        "coreExplanation": "Explication avec **mots-clés en gras**",
        "distinctionOrCounterExample": "Distinction avec les notions proches",
        "commonPitfall": "Piège fréquent à éviter",
        "causalChainProTip": "A -> B -> C"
      }
    }
  ]
}`;

  try {
    const rawAiText = await callGeminiAcademicEngine(
      `Cours : "${realTitle}"\nObjectifs : ${objectives.join(", ")}\n\nTexte du cours :\n${cleanText.slice(0, 28000)}`,
      systemInstruction
    );

    const parsed = repairAndParseQuizJson(rawAiText);
    const rawCards = parsed?.cards || parsed?.flashcards || parsed;

    if (Array.isArray(rawCards) && rawCards.length > 0) {
      return normalizeSmartDeck(rawCards, parsed?.detectedSubject || realTitle);
    }
  } catch (morErr) {
    console.error("[smartAiGenerator] Erreur relais mor-chat :", morErr);
  }

  // ==========================================================================
  // NIVEAU 3 : REPLI SÉCURISÉ SUR LE DECK PRÉ-CALIBRÉ DU COURS
  // ==========================================================================
  return normalizeSmartDeck([], realTitle);
}
