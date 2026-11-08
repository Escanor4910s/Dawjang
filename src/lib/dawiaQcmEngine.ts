// src/lib/dawiaQcmEngine.ts
/**
 * MOTEURS DOCIMOLOGIQUES DAWJANG (DAWIA)
 * - DAWIA 1 : Moteur Standard (Google Gemini 2.5 Flash) — génération fluide, rapide et fidèle au cours.
 * - DAWIA 2 : Moteur Haute Docimologie (Claude Sonnet 4.6) — raisonnement approfondi, assertions subtiles qui sèment le doute et pièges docimologiques.
 *
 * RÈGLE FONDAMENTALE : Les dénominations techniques de modèles (Gemini, Sonnet, Claude, etc.)
 * sont STRICTEMENT confidentielles et ne doivent JAMAIS apparaître dans l'interface de l'étudiant.
 */

import { callGeminiAcademicEngine } from "@/lib/syncEngine";
import { getActivePoliceApiKey } from "@/lib/aiPolicePipeline";

export type DawiaEngine = "dawia1" | "dawia2";

export interface DawiaEngineMeta {
  id: DawiaEngine;
  name: string;
  shortTag: string;
  subtitle: string;
  description: string;
  badge: string;
  badgeColor: string;
  accentColor: string;
}

export const DAWIA_ENGINES: Record<DawiaEngine, DawiaEngineMeta> = {
  dawia1: {
    id: "dawia1",
    name: "DAWIA 1",
    shortTag: "Standard",
    subtitle: "Moteur Docimologique Standard",
    description:
      "Génération fluide, équilibrée et rapide. Idéal pour l'apprentissage régulier, les entraînements quotidiens et les révisions de cours structurées.",
    badge: "Fluide & Rapide",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    accentColor: "border-emerald-500/40 text-emerald-600",
  },
  dawia2: {
    id: "dawia2",
    name: "DAWIA 2",
    shortTag: "Haute Docimologie",
    subtitle: "Moteur Haute Docimologie & Litige Clinique",
    description:
      "Raisonnement clinique approfondi, pièges docimologiques d'examen sélectif et assertions subtiles conçues pour semer le doute et tester la maîtrise réelle.",
    badge: "Haute Précision",
    badgeColor: "bg-[#D96B43]/10 text-[#D96B43] dark:text-[#E8825C] border-[#D96B43]/25",
    accentColor: "border-[#D96B43]/50 text-[#D96B43]",
  },
};

/**
 * DIRECTIVE OFFICIELLE DAWJANG : DOCTRINE DOCIMOLOGIQUE FACULTÉ DE MÉDECINE
 * Règle d'or : chaque proposition A à E doit être une affirmation médicale grammaticalement complète,
 * avec alternance rythmée entre phrases simples (percutantes) et phrases complexes (qui sèment le doute).
 */
export const DAWIA_ASSERTION_DIVERSIFICATION_DIRECTIVE = `
=== DOCTRINE DOCIMOLOGIQUE OFFICIELLE DE FACULTÉ DE MÉDECINE (UCAD / UFRSS) ===
Tu es membre du Jury d'Évaluation de la Faculté de Médecine. Tu conçois des épreuves officielles de QCM d'une rigueur clinique absolue.

1. FORMULATION RIGOUREUSE DES ÉNONCÉS DOCIMOLOGIQUES :
   - ÉLECTION (QCU Médical) : « Parmi les propositions suivantes relatives aux caractéristiques diagnostiques et physiopathologiques de [Sujet], une seule est exacte : laquelle ? »
   - CENSURE MÉDICALE (« SAUF UNE ») : « Concernant les aspects cliniques, étiologiques et thérapeutiques de [Sujet], une seule proposition est INEXACTE (FAUSSE) : laquelle ? »
   - GROUPAGE DOCIMOLOGIQUE (Compléments groupés) :
     Cinq assertions médicales numérotées 1 à 5 dans "groupStatements", puis options A à E selon le barème officiel :
     * A = Les propositions 1, 2 et 3 sont exactes uniquement
     * B = Les propositions 1 et 3 sont exactes uniquement
     * C = Les propositions 2 et 4 sont exactes uniquement
     * D = La proposition 4 seule est exacte
     * E = Toute autre combinaison de propositions exactes
   - JUMELAGE CAUSAL : Deux assertions complètes (statement1 et statement2) reliées par « PARCE QUE » avec code docimologique A à E (A = Vrai-Vrai avec cause, B = Vrai-Vrai sans cause, C = Vrai-Faux, D = Faux-Vrai, E = Faux-Faux).
   - ASSOCIATION MÉDICALE : 4 éléments cliniques à apparier rigoureusement avec 4 mécanismes ou entités correspondantes.

2. GRAMMAIRE ET QUALITÉ ABSOLUE DES ASSERTIONS (RÈGLES INVIOLABLES) :
   - PHRASES COMPLÈTES OBLIGATOIRES : Chaque proposition (A à E) doit être une phrase médicale autonome et complète avec son sujet, son verbe conjugué et son complément clinique ou biologique.
   - INTERDICTION FORMELLE DE FRAGMENTS ISOLÉS : Ne JAMAIS produire de groupe nominal sans verbe (ex: INTERDIT : « Hémorragies aiguës et abondantes », « Affinité de l'Hb pour l'O2 »). Rédige toujours une vraie proposition (ex: « Une hémorragie aiguë abondante induit une anémie normocytaire initialement arégénérative. »).
   - INTERDICTION FORMELLE DE TITRES DE DIAPOSITIVES : Ne JAMAIS recopier de puces, de listes ou de titres se terminant par deux-points (ex: INTERDIT : « Trouble de la différenciation : Myélodysplasies », « Systèmes de compensation : »). Rédige des phrases continues.

3. DIVERSIFICATION SYNTAXIQUE : ALTERNANCE PHRASES SIMPLES / COMPLEXES DANS CHAQUE QCM :
   - Tu DOIS diversifier la structure des propositions pour éviter toute monotonie :
     * Option A : Phrase simple (8 à 14 mots) — directe, percutante, énonçant un seuil ou une règle claire.
     * Option B : Phrase complexe (18 à 30 mots) — phrase élaborée avec subordonnée de condition, nuance physiopathologique ou contexte clinique qui SÈME LE DOUTE.
     * Option C : Phrase simple (8 à 14 mots).
     * Option D : Phrase complexe (18 à 30 mots) qui met en tension deux diagnostics frontières ou deux valeurs biologiques.
     * Option E : Phrase simple ou moyenne (10 à 16 mots) portant sur la conduite thérapeutique.

4. RÉALISME DES DISTRACTEURS (PIÈGES CHIRURGICAUX DE PROFESSEURS) :
   - Les fausses propositions (distracteurs) doivent être d'authentiques pièges d'examen de faculté :
     * Inversion de seuil (ex: VGM > 100 fL au lieu de < 80 fL ; ferritinémie normale en contexte inflammatoire).
     * Inversion de mécanisme (attribuer une origine centrale arégénérative à une hémolyse périphérique régénératrice).
     * Confusion étiologique ou contre-indication médicamenteuse oubliée.
   - Ne JAMAIS ajouter de formules artificielles, de commentaires méta ou de suffixes explicatifs dans le texte de la proposition.
`;

/**
 * Appelle le moteur DAWIA choisi (DAWIA 1 = Gemini 2.5, DAWIA 2 = Sonnet 4.6)
 * avec bascule de sécurité automatique en cas d'indisponibilité réseau.
 */
export async function callDawiaEngine(
  engine: DawiaEngine,
  systemInstruction: string,
  userPrompt: string,
  temperature = 0.35
): Promise<string | null> {
  const enrichedSystemInstruction = `${systemInstruction}\n\n${DAWIA_ASSERTION_DIVERSIFICATION_DIRECTIVE}`;

  // 1. MOTEUR DAWIA 1 (Gemini 2.5 Flash)
  if (engine === "dawia1") {
    return await callGeminiAcademicEngine(
      enrichedSystemInstruction,
      userPrompt,
      temperature
    );
  }

  // 2. MOTEUR DAWIA 2 (Claude Sonnet 4.6)
  try {
    const sonnetResult = await callClaudeSonnet46Engine(
      enrichedSystemInstruction,
      userPrompt,
      temperature
    );
    if (sonnetResult && sonnetResult.trim().length > 0) {
      return sonnetResult;
    }
  } catch (sonnetErr) {
    console.warn(
      "[dawiaQcmEngine] Relais DAWIA 2 -> DAWIA 1 suite à une indisponibilité temporaire :",
      sonnetErr
    );
  }

  // Bascule automatique et transparente vers DAWIA 1 si DAWIA 2 n'a pas répondu
  return await callGeminiAcademicEngine(
    enrichedSystemInstruction,
    userPrompt,
    temperature
  );
}

/**
 * Appel spécialisé Claude Sonnet 4.6 (supporte OpenRouter et Anthropic directe)
 */
async function callClaudeSonnet46Engine(
  systemInstruction: string,
  userPrompt: string,
  temperature: number
): Promise<string | null> {
  const apiKey = getActivePoliceApiKey();

  // A. Clé OpenRouter
  if (apiKey.startsWith("sk-or-")) {
    const modelsToTry = [
      "anthropic/claude-sonnet-4.6",
      "anthropic/claude-3.7-sonnet",
      "anthropic/claude-sonnet-5.5",
      "anthropic/claude-3.5-sonnet",
    ];

    for (const modelName of modelsToTry) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://dawjang.app",
            "X-Title": "DawJang Academic Studio — DAWIA 2",
          },
          body: JSON.stringify({
            model: modelName,
            temperature,
            max_tokens: 8192,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            return content.trim();
          }
        }
      } catch {
        // Essai du modèle suivant
      }
    }
  }

  // B. Clé Anthropic API Directe
  if (apiKey.startsWith("sk-ant-")) {
    const modelsToTry = [
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
      "claude-sonnet-4-6",
    ];

    for (const modelName of modelsToTry) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: modelName,
            max_tokens: 8192,
            temperature,
            system: systemInstruction,
            messages: [{ role: "user", content: userPrompt }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data?.content?.[0]?.text;
          if (typeof text === "string" && text.trim().length > 0) {
            return text.trim();
          }
        }
      } catch {
        // Essai du modèle suivant
      }
    }
  }

  return null;
}
