import { supabase } from "@/integrations/supabase/client";

/**
 * Génération de Résumé via Lovable AI (Edge Function Supabase)
 */
export async function generateSummaryWithLovable(
  content: string, 
  type: string, 
  title?: string, 
  template: string = "standard"
): Promise<string> {
  console.log(`[Lovable AI] Generating summary of type: ${type}`);
  
  const { data, error } = await supabase.functions.invoke('generate-summary', {
    body: { content, type, title, template }
  });

  if (error) {
    console.error("[Lovable AI] Error generating summary:", error);
    throw new Error(error.message || "Erreur lors de la génération du résumé.");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data.summary || "";
}

/**
 * Shuffles QCM options intelligently to avoid repeating the same correct answer position (e.g. avoiding A, A, A).
 */
function smartShuffleQCM(qcmArray: any[]): any[] {
  const result = [];
  let lastCorrectIndex = -1;

  for (const q of qcmArray) {
    let options = q.options || q.choices || [];
    if (!options || options.length === 0) {
      result.push(q);
      continue;
    }
    
    let bestShuffled = [...options];
    for (let attempt = 0; attempt < 10; attempt++) {
      // Fisher-Yates shuffle
      const shuffled = [...options];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      // Find the index of the first correct answer in this permutation
      let firstCorrectIdx = -1;
      for (let i = 0; i < shuffled.length; i++) {
        if (q.correct && q.correct.includes(shuffled[i])) {
          firstCorrectIdx = i;
          break;
        }
      }
      
      bestShuffled = shuffled;
      // Accept this permutation if it doesn't repeat the last correct position
      if (firstCorrectIdx !== lastCorrectIndex) {
        lastCorrectIndex = firstCorrectIdx;
        break;
      }
    }
    
    // Assign the smartly shuffled options back
    if (q.options) q.options = bestShuffled;
    if (q.choices) q.choices = bestShuffled;
    
    result.push(q);
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
  return smartShuffleQCM(rawQcm);
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
