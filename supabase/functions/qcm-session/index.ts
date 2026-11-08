// supabase/functions/qcm-session/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Calculateur de score déterministe pour une épreuve QCM
 */
function calculateScore(questions: any[], answers: Record<string, string[]>): number {
  if (!questions || !Array.isArray(questions)) return 0;
  let score = 0;

  for (const q of questions) {
    const sel = answers[q.id] || [];
    const correctIds = (q.options || [])
      .filter((o: any) => o.isCorrect)
      .map((o: any) => o.id);

    const isExact =
      correctIds.length === sel.length &&
      correctIds.every((id: string) => sel.includes(id));

    if (isExact) score++;
  }
  return score;
}

/**
 * Calcul d'empreinte déterministe pour unicité
 */
function computeUniqueHash(questions: any[]): string {
  if (!questions || questions.length === 0) return "empty_0";
  const rawString = questions
    .map((q, idx) => {
      const opts = (q.options || [])
        .map((o: any) => `${o.label}:${o.text}:${Boolean(o.isCorrect)}`)
        .join(",");
      return `[${idx}]${q.id}:${q.question}:{${opts}}`;
    })
    .join("##");

  let hash = 0;
  for (let i = 0; i < rawString.length; i++) {
    hash = (hash << 5) - hash + rawString.charCodeAt(i);
    hash |= 0;
  }
  return `hash_${Math.abs(hash).toString(36)}_${questions.length}`;
}

serve(async (req) => {
  // Gestion requêtes pré-vol CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY") ??
      "";

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const {
      action,
      sessionId,
      userId,
      qcmBaseId,
      params,
      questions,
      answer,
      finalAnswers,
      timeElapsed,
      explicitScore,
    } = body;

    // ACTION : create
    if (action === "create") {
      const uniqueHash = body.uniqueHash || computeUniqueHash(questions || []);

      // Vérifier si un doublon identique existe pour cet utilisateur sur ce deck
      let query = supabase
        .from("sessions_qcm")
        .select("id")
        .eq("qcm_base_id", qcmBaseId)
        .eq("unique_hash", uniqueHash);

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({
            error: "Session déjà existante",
            id: existing.id,
            isDuplicate: true,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sessionRecordId = sessionId || crypto.randomUUID();

      const { data, error } = await supabase
        .from("sessions_qcm")
        .insert({
          id: sessionRecordId,
          user_id: userId || null,
          qcm_base_id: qcmBaseId,
          parameters: params || {},
          questions: questions || [],
          user_answers: {},
          score: 0,
          unique_hash: uniqueHash,
          status: "in_progress",
          session_started: new Date().toISOString(),
          time_elapsed: 0,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION : saveAnswer (mise à jour progressive)
    if (action === "saveAnswer") {
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: "sessionId obligatoire" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("sessions_qcm")
        .select("user_answers")
        .eq("id", sessionId)
        .single();

      if (error) throw error;

      const updatedAnswers = { ...(data.user_answers || {}), ...(answer || {}) };

      const updatePayload: Record<string, any> = {
        user_answers: updatedAnswers,
        updated_at: new Date().toISOString(),
      };
      if (typeof timeElapsed === "number") {
        updatePayload.time_elapsed = timeElapsed;
      }

      const { error: upError } = await supabase
        .from("sessions_qcm")
        .update(updatePayload)
        .eq("id", sessionId);

      if (upError) throw upError;

      return new Response(
        JSON.stringify({ success: true, user_answers: updatedAnswers }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION : finish (clôture épreuve & score)
    if (action === "finish") {
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: "sessionId obligatoire" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let score = explicitScore;
      if (typeof score !== "number") {
        const { data: sessionData } = await supabase
          .from("sessions_qcm")
          .select("questions")
          .eq("id", sessionId)
          .single();

        score = calculateScore(sessionData?.questions || [], finalAnswers || {});
      }

      const updatePayload: Record<string, any> = {
        user_answers: finalAnswers || {},
        session_ended: new Date().toISOString(),
        score,
        status: "completed",
        updated_at: new Date().toISOString(),
      };
      if (typeof timeElapsed === "number") {
        updatePayload.time_elapsed = timeElapsed;
      }

      const { error } = await supabase
        .from("sessions_qcm")
        .update(updatePayload)
        .eq("id", sessionId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, score, status: "completed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION : get (lecture d'une session pour reprise)
    if (action === "get") {
      const { data, error } = await supabase
        .from("sessions_qcm")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // ACTIONS QUIZ UTILISATEUR : saveQuiz, getQuizzes, getQuizById, deleteQuiz
    // =========================================================================

    // ACTION : saveQuiz
    if (action === "saveQuiz") {
      const { quizData, title, subject } = body;
      if (!quizData) {
        return new Response(
          JSON.stringify({ error: "quizData est requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const questionsList = quizData.questions || [];
      const uniqueHash = computeUniqueHash(questionsList);

      // Vérifier si un quiz identique existe déjà pour cet utilisateur
      if (userId) {
        const { data: existingQuiz } = await supabase
          .from("user_quizzes")
          .select("id, title, created_at")
          .eq("user_id", userId)
          .eq("unique_hash", uniqueHash)
          .maybeSingle();

        if (existingQuiz) {
          return new Response(
            JSON.stringify({
              message: "Quiz déjà enregistré",
              id: existingQuiz.id,
              isDuplicate: true,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const recordId = body.quizId || quizData.id || crypto.randomUUID();
      const finalTitle = title || quizData.title || "Quiz Sans Titre";
      const finalSubject = subject || quizData.subject || "Médecine";

      const { data, error } = await supabase
        .from("user_quizzes")
        .insert({
          id: recordId,
          user_id: userId || null,
          title: finalTitle,
          subject: finalSubject,
          quiz: quizData,
          unique_hash: uniqueHash,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION : getQuizzes
    if (action === "getQuizzes") {
      let query = supabase
        .from("user_quizzes")
        .select("*")
        .order("created_at", { ascending: false });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify(data || []), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION : getQuizById
    if (action === "getQuizById") {
      const qId = body.quizId || sessionId;
      if (!qId) {
        return new Response(
          JSON.stringify({ error: "quizId obligatoire" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("user_quizzes")
        .select("*")
        .eq("id", qId)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION : deleteQuiz
    if (action === "deleteQuiz") {
      const qId = body.quizId || sessionId;
      if (!qId) {
        return new Response(
          JSON.stringify({ error: "quizId obligatoire" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("user_quizzes")
        .delete()
        .eq("id", qId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, deletedId: qId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Action inconnue" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
