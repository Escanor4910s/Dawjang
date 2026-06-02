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

  return data.qcm || [];
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
