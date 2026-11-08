import { supabase } from "@/integrations/supabase/client";
import { invokeWithRetry } from "@/lib/edgeRetry";

/**
 * Génération de Résumé via Lovable AI / Relais Académique (Haute Résilience)
 */
export async function generateSummaryWithLovable(
  content: string, 
  type: string, 
  title?: string, 
  template: string = "standard"
): Promise<string> {
  console.log(`[Lovable AI] Generating summary of type: ${type}`);
  
  const { data, error } = await invokeWithRetry<{ summary?: string; content?: string }>("generate-summary", {
    body: { content, type, title, template },
    retries: 1,
  });

  if (error || (!data?.summary && !data?.content)) {
    console.error("[Lovable AI] Error generating summary:", error);
    throw new Error(error?.message || "Erreur lors de la génération du résumé.");
  }

  return data.summary || data.content || "";
}

/**
 * Shuffles QCM options intelligently to avoid repeating the same correct answer position (e.g. avoiding A, A, A),
 * while preserving the exact mapping of 0-based `correct` indices and never shuffling Groupage A-E keys.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function smartShuffleQCM(qcmArray: any[], quizType?: string): any[] {
  if (quizType === "groupage" || quizType === "vrai-faux") {
    return qcmArray;
  }

  const result = [];
  let lastCorrectIndex = -1;

  for (const q of qcmArray) {
    const options: string[] = q.options || q.choices || [];
    const correctIndices: number[] = Array.isArray(q.correct) ? q.correct : [];
    const isGroupageChoices =
      options.length === 5 &&
      options.every((c, idx) => String(c).trim() === ["A", "B", "C", "D", "E"][idx]);

    if (!options || options.length === 0 || isGroupageChoices) {
      result.push(q);
      continue;
    }

    const indexed = options.map((text, origIdx) => ({
      text,
      isCorrect: correctIndices.includes(origIdx),
    }));

    let bestPerm = [...indexed];
    for (let attempt = 0; attempt < 10; attempt++) {
      const perm = [...indexed];
      for (let i = perm.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }

      const firstCorrectIdx = perm.findIndex((item) => item.isCorrect);
      bestPerm = perm;
      if (firstCorrectIdx !== lastCorrectIndex) {
        lastCorrectIndex = firstCorrectIdx;
        break;
      }
    }

    const newChoices = bestPerm.map((item) => item.text);
    const newCorrect = bestPerm
      .map((item, idx) => (item.isCorrect ? idx : -1))
      .filter((idx) => idx !== -1);

    const updatedQ = { ...q, correct: newCorrect };
    if (q.options) updatedQ.options = newChoices;
    if (q.choices) updatedQ.choices = newChoices;

    result.push(updatedQ);
  }
  return result;
}

/**
 * Génération de QCM via Lovable AI (Edge Function Supabase)
 */
export async function generateQuizWithLovable(
  content: string, 
  nbQuestions: number, 
  type: string, 
  difficulty: string = "facile"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  console.log(`[Lovable AI] Generating ${nbQuestions} questions (${type}, ${difficulty})`);
  
  const { data, error } = await supabase.functions.invoke('generate-quiz-openai', {
    body: { content, nbQuestions, type, difficulty }
  });

  if (error) {
    console.error("[Lovable AI] Error generating quiz:", error);
    throw new Error(error.message || "Erreur lors de la génération des QCM.");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  const rawQcm = data.qcm || [];
  return smartShuffleQCM(rawQcm, type);
}

/**
 * Génération d'un cas clinique ECOS complet via Lovable AI
 */
export async function generateEcosCaseWithLovable(
  courseId: string, 
  difficulty: string = "moyen",
  mode: string = "uploaded"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  console.log(`[Lovable AI] Generating ECOS Case for course ${courseId} (${difficulty}, ${mode})`);
  
  const { data, error } = await supabase.functions.invoke('generate-ecos-case', {
    body: { courseId, difficulty, mode }
  });

  if (error) {
    console.error("[Lovable AI] Error generating ECOS case:", error);
    throw new Error(error.message || "Erreur lors de la génération du cas clinique.");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data.case || null;
}

/**
 * Assistant Mor via Lovable AI (Edge Function Supabase)
 * Remarque : L'historique n'est pas envoyé tel quel car l'API attend juste "question" et "courseId".
 * Nous concaténons l'historique si nécessaire, mais dans un chat simple, la dernière question suffit, 
 * ou on peut joindre l'historique dans la question pour donner du contexte au LLM.
 */
export async function askMorWithLovable(
  chatHistory: {role: "user" | "assistant", content: string}[], 
  courseId?: string,
  contextMessage?: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{answer: string, sources: any[]}> {
  if (chatHistory.length === 0) throw new Error("L'historique est vide");
  
  // Extraire la dernière question posée par l'utilisateur
  const lastUserMessage = chatHistory[chatHistory.length - 1].content;
  
  // On peut éventuellement inclure un peu de contexte si nécessaire,
  // mais l'Edge Function se charge d'extraire les éléments du cours.
  let questionContext = lastUserMessage;
  if (contextMessage) {
    questionContext = `Contexte de la question en cours: "${contextMessage}"\n\nMa question: ${lastUserMessage}`;
  }

  console.log(`[Lovable AI] Calling AskMor for course: ${courseId}`);
  
  const { data, error } = await supabase.functions.invoke('ask-mor', {
    body: { 
      question: questionContext,
      courseId: courseId
    }
  });

  if (error) {
    console.error("[Lovable AI] Error asking Mor:", error);
    throw new Error(error.message || "Erreur lors de la communication avec l'Agent Mor.");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return {
    answer: data.answer || "",
    sources: data.sources || []
  };
}
