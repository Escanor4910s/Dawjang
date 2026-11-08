// ============================================================================
// src/lib/jsonRepair.ts
// RÉPARATEUR JSON AUTO-CICATRISANT ET EXTRACTION INDESTRUCTIBLE MULTI-QCM
// ============================================================================

function isQuestionLikeObject(obj: any): boolean {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const hasStem = Boolean(
    obj.stem || obj.question || obj.enonce || obj.question_text || obj.title
  );
  const hasOptions = Boolean(
    Array.isArray(obj.options) ||
      Array.isArray(obj.propositions) ||
      Array.isArray(obj.choices) ||
      Array.isArray(obj.groupStatements) ||
      obj.jumelageStatements
  );
  return hasStem && hasOptions;
}

function extractBalancedQuestionObjects(source: string): any[] {
  const questions: any[] = [];
  const startByDepth: Record<number, number> = {};
  let braceDepth = 0;
  let inStr = false;
  let esc = false;

  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\" && inStr) {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;

    if (c === "{") {
      startByDepth[braceDepth] = i;
      braceDepth++;
    } else if (c === "}") {
      if (braceDepth > 0) {
        braceDepth--;
        const startPos = startByDepth[braceDepth];
        if (startPos !== undefined && startPos >= 0) {
          const rawSlice = source.slice(startPos, i + 1);
          try {
            const parsedObj = JSON.parse(rawSlice);
            if (isQuestionLikeObject(parsedObj)) {
              questions.push(parsedObj);
            }
          } catch {
            try {
              const cleanedSlice = rawSlice.replace(/,\s*([}\]])/g, "$1");
              const parsedClean = JSON.parse(cleanedSlice);
              if (isQuestionLikeObject(parsedClean)) {
                questions.push(parsedClean);
              }
            } catch {
              // Ignorer ce bloc partiel
            }
          }
          delete startByDepth[braceDepth];
        }
      }
    }
  }

  return questions;
}

export function repairAndParseQuizJson(rawLlmOutput: string): any {
  if (!rawLlmOutput || typeof rawLlmOutput !== "string") {
    throw new Error("Réponse IA vide.");
  }

  // 1. Nettoyage des balises markdown ```json ... ```
  let text = rawLlmOutput
    .replace(/^[\s\S]*?```(?:json)?\s*/i, "")
    .replace(/\s*```[\s\S]*$/i, "")
    .trim();

  // 2. Tentative directe
  try {
    const direct = JSON.parse(text);
    if (Array.isArray(direct) && direct.length > 0) return direct;
    if (direct?.questions && Array.isArray(direct.questions)) return direct.questions;
    if (direct?.qcm && Array.isArray(direct.qcm)) return direct.qcm;
    if (isQuestionLikeObject(direct)) return [direct];
  } catch {}

  // 3. Détection de l'indice de début du JSON ([ ou {)
  const firstArr = text.indexOf("[");
  const firstObj = text.indexOf("{");
  let startIdx = -1;
  if (firstArr !== -1 && firstObj !== -1) {
    startIdx = Math.min(firstArr, firstObj);
  } else {
    startIdx = Math.max(firstArr, firstObj);
  }
  if (startIdx > 0) {
    text = text.slice(startIdx);
  }

  // 4. Détection de la fin du JSON (dernier ] ou })
  const lastArr = text.lastIndexOf("]");
  const lastObj = text.lastIndexOf("}");
  const endIdx = Math.max(lastArr, lastObj);
  if (endIdx !== -1 && endIdx < text.length - 1) {
    const candidate = text.slice(0, endIdx + 1);
    try {
      const parsedCandidate = JSON.parse(candidate);
      if (Array.isArray(parsedCandidate) && parsedCandidate.length > 0) return parsedCandidate;
      if (parsedCandidate?.questions && Array.isArray(parsedCandidate.questions))
        return parsedCandidate.questions;
      if (parsedCandidate?.qcm && Array.isArray(parsedCandidate.qcm))
        return parsedCandidate.qcm;
    } catch {}
  }

  // 5. Machine d'états : échappement des guillemets internes et équilibrage de pile
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  let repaired = "";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      repaired += ch;
      escape = false;
      continue;
    }

    if (ch === "\\" && inString) {
      escape = true;
      repaired += ch;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        repaired += ch;
      } else {
        let j = i + 1;
        while (
          j < text.length &&
          (text[j] === " " || text[j] === "\t" || text[j] === "\r" || text[j] === "\n")
        ) {
          j++;
        }
        const next = text[j];
        if (
          j >= text.length ||
          next === ":" ||
          next === "," ||
          next === "}" ||
          next === "]"
        ) {
          inString = false;
          repaired += ch;
        } else {
          repaired += '\\"';
        }
      }
      continue;
    }

    if (inString) {
      if (ch === "\n") repaired += "\\n";
      else if (ch === "\r") {
        // ignore CR
      } else if (ch === "\t") repaired += " ";
      else repaired += ch;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch);
      repaired += ch;
    } else if (ch === "}") {
      if (stack[stack.length - 1] === "{") stack.pop();
      repaired += ch;
    } else if (ch === "]") {
      if (stack[stack.length - 1] === "[") stack.pop();
      repaired += ch;
    } else {
      repaired += ch;
    }
  }

  // Extraction granulaire sur la chaîne réparée (prioritaire en cas de troncature)
  const extractedFromRepaired = extractBalancedQuestionObjects(repaired);
  const extractedFromRaw = extractBalancedQuestionObjects(text);
  const bestExtracted =
    extractedFromRepaired.length >= extractedFromRaw.length
      ? extractedFromRepaired
      : extractedFromRaw;

  if (inString) {
    repaired += '"';
  }

  repaired = repaired.replace(/,\s*([}\]])/g, "$1");
  repaired = repaired.replace(/,\s*$/, "");
  repaired = repaired.replace(/:\s*$/, ': ""');

  let closedRepaired = repaired;
  for (let k = stack.length - 1; k >= 0; k--) {
    const open = stack[k];
    if (open === "{") closedRepaired += "}";
    else if (open === "[") closedRepaired += "]";
  }

  try {
    const fullParsed = JSON.parse(closedRepaired);
    const fullArray = Array.isArray(fullParsed)
      ? fullParsed
      : fullParsed?.questions || fullParsed?.qcm || [fullParsed];
    if (Array.isArray(fullArray) && fullArray.length >= bestExtracted.length) {
      return fullArray;
    }
  } catch {}

  if (bestExtracted.length > 0) {
    return bestExtracted;
  }

  throw new Error("Impossible de décoder la structure JSON renvoyée par le modèle IA.");
}

export const STRICT_JSON_PROMPT_GUARD = `
RÈGLE DE SYNTAXE JSON CRITIQUE (ZÉRO CRASH) :
- Réponds UNIQUEMENT avec un tableau JSON valide [ { ... }, { ... } ], sans texte avant ni après.
- N'utilise JAMAIS de guillemets doubles droits (") à l'intérieur d'un texte français (énoncé, proposition ou explication). Utilise exclusivement des guillemets français (« ... ») ou des apostrophes (').
- N'insère aucun retour à la ligne brut à l'intérieur d'une valeur texte JSON.`;
