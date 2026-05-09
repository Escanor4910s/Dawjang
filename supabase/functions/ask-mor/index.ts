import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { checkUserPlan } from "../_shared/plan-utils.ts";
import { extractCompletionText, logDiagnostic } from "../_shared/ai-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Input validation schema ---
const AskMorSchema = z.object({
  question: z.string().min(1).max(2000),
  courseId: z.string().uuid(),
  priority: z.boolean().optional(),
});

interface Course {
  id: string;
  title: string;
  content: string;
  user_id: string;
}

interface Source {
  type: "course" | "web";
  text: string;
}

const SYSTEM_PROMPT = `Tu es Mor, un tuteur virtuel en médecine expert et pédagogue. Ton rôle est d'expliquer, clarifier et enseigner.

RÈGLES :
1. Sois précis, concis et pédagogue
2. Utilise d'abord le contenu du cours fourni
3. Complète avec tes connaissances médicales générales si nécessaire
4. Cite tes sources (cours ou connaissances générales)
5. Structure tes réponses avec des points clés
6. REFUSE tout diagnostic, prescription ou conseil médical personnalisé

Pour les demandes de diagnostic/traitement : "Je peux expliquer la théorie, mais consultez un professionnel de santé pour un avis médical personnalisé."

Format de réponse : clair, aéré, avec des emojis médicaux pertinents (🩺📚💡).`;

const FORBIDDEN_PATTERNS = [
  /j'ai (mal|des douleurs|des symptômes)/i,
  /je (ressens|souffre de|présente)/i,
  /dois-je (prendre|consulter|aller)/i,
  /quel (médicament|traitement|dosage)/i,
  /combien de (mg|grammes|doses)/i,
  /diagnostic|prescription|ordonnance/i,
  /mon cas|ma situation|pour moi/i,
];

function detectForbiddenRequest(question: string): boolean {
  return FORBIDDEN_PATTERNS.some(pattern => pattern.test(question));
}

function extractRelevantExcerpts(courseContent: string, question: string, maxLength: number = 2500): string {
  const questionKeywords = question
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3);

  const sentences = courseContent.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  const scoredSentences = sentences.map(sentence => {
    const lowerSentence = sentence.toLowerCase();
    const score = questionKeywords.reduce((acc, keyword) => {
      return acc + (lowerSentence.includes(keyword) ? 1 : 0);
    }, 0);
    return { sentence: sentence.trim(), score };
  });

  const relevantSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .filter(s => s.score > 0)
    .map(s => s.sentence);

  let excerpt = relevantSentences.join(". ") + ".";
  
  if (excerpt.length > maxLength) {
    excerpt = excerpt.substring(0, maxLength) + "...";
  }

  if (excerpt.length < 100) {
    excerpt = courseContent.substring(0, maxLength) + (courseContent.length > maxLength ? "..." : "");
  }

  return excerpt;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check user plan - MOR requires Premium or higher
    const planCheck = await checkUserPlan(req, {
      requiredPlan: "premium",
      featureName: "Agent MOR",
    });

    if (planCheck.errorResponse) {
      return planCheck.errorResponse;
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY is not configured');
      throw new Error('AI service not configured');
    }

    const { question, courseId, priority } = await req.json().then(
      (body: unknown) => {
        const parsed = AskMorSchema.safeParse(body);
        if (!parsed.success) throw new Error('VALIDATION_ERROR');
        return parsed.data;
      }
    ).catch((err: Error) => {
      if (err.message === 'VALIDATION_ERROR') throw err;
      throw new Error('VALIDATION_ERROR');
    });


    // Pro users get priority access
    const isPriorityUser = planCheck.isAdmin || planCheck.plan === "pro";
    console.log('Mor request:', { 
      courseId, 
      questionLength: question.length, 
      userPlan: planCheck.plan,
      priority: isPriorityUser 
    });

    // Security check
    if (detectForbiddenRequest(question)) {
      console.log('Forbidden request detected');
      return new Response(
        JSON.stringify({
          answer: "🩺 Je peux expliquer la théorie médicale, mais je ne peux pas donner de diagnostic ni de conseil médical personnalisé. Consultez un professionnel de santé pour votre situation.",
          sources: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const user = { id: planCheck.userId };

    // Fetch course content
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, content, user_id')
      .eq('id', courseId)
      .eq('user_id', user.id)
      .single();

    if (courseError || !course) {
      console.error('Course fetch error:', courseError);
      return new Response(
        JSON.stringify({ error: 'Course not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract relevant excerpts from course
    const relevantContent = extractRelevantExcerpts(course.content, question);
    const sources: Source[] = [];

    // Build context with course content
    let contextPrompt = `📚 CONTENU DU COURS "${course.title}" :

${relevantContent}

---

Question de l'étudiant : ${question}

Instructions :
1. Réponds en t'appuyant PRIORITAIREMENT sur le contenu du cours ci-dessus
2. Complète avec tes connaissances médicales générales si le cours ne couvre pas tout
3. Indique clairement si l'info vient du cours ou de connaissances générales
4. Sois pédagogue et structure ta réponse`;

    // Add course source
    if (relevantContent.length > 100) {
      sources.push({
        type: "course",
        text: `Cours: ${course.title}`
      });
    }

    // Add web knowledge indicator if course content seems insufficient
    const courseHasRelevantContent = relevantContent.length > 200;
    if (!courseHasRelevantContent) {
      sources.push({
        type: "web",
        text: "Connaissances médicales générales"
      });
    }

    // Call Lovable AI Gateway with Gemini Flash for faster responses
    console.log('Calling Lovable AI Gateway with Gemini Flash...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: contextPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('AI Gateway error:', response.status, errorData);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Service temporairement indisponible. Réessayez dans quelques instants.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Crédits AI épuisés. Contactez le support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Service IA indisponible (${response.status}). Réessayez dans un instant.` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const answer = extractCompletionText(data);

    if (!answer || !answer.trim()) {
      console.error('Empty answer from AI. Raw:', JSON.stringify(data).slice(0, 1000));
      await logDiagnostic({
        function_name: "ask-mor",
        user_id: planCheck.userId,
        status: 502,
        request_payload: { courseId, questionLength: question.length },
        response_payload: data,
        error: "Empty AI response after parsing",
      });
      return new Response(
        JSON.stringify({ error: "L'IA n'a pas pu répondre. Reformulez votre question ou réessayez." }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Mor response generated:', {
      courseId,
      answerLength: answer.length,
      sourcesCount: sources.length,
      tokensUsed: data.usage?.total_tokens || 0,
    });

    return new Response(
      JSON.stringify({
        answer,
        sources,
        meta: {
          model: data.model || 'google/gemini-2.5-flash',
          tokens: data.usage?.total_tokens || 0,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    if (error?.message === 'VALIDATION_ERROR') {
      return new Response(
        JSON.stringify({ error: 'Requête invalide : question (max 2000 car.) et courseId (UUID) requis.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.error('Error in ask-mor function:', error);
    return new Response(
      JSON.stringify({ error: 'Une erreur est survenue. Veuillez réessayer.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});