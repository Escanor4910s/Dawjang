import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeDuelQuestions } from "@/lib/duelQuestion";

export interface DuelQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
}

export interface Duel {
  id: string;
  creator_id: string;
  opponent_id: string | null;
  invite_code: string;
  status: string;
  question_count: number;
  questions: DuelQuestion[];
  source_type: string;
  qcm_session_id: string | null;
  creator_score: number;
  opponent_score: number;
  current_question_index: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface DuelAnswer {
  id: string;
  duel_id: string;
  user_id: string;
  question_index: number;
  answer: string;
  is_correct: boolean;
  time_taken_ms: number;
  created_at: string;
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function useDuel(duelId?: string) {
  const [duel, setDuel] = useState<Duel | null>(null);
  const [answers, setAnswers] = useState<DuelAnswer[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
      console.log("[useDuel] userId initialisé:", user?.id ?? "non connecté");
    });
  }, []);

  const fetchDuel = useCallback(async () => {
    if (!duelId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("duels").select("*").eq("id", duelId).single();
    if (error) { console.error("[useDuel] Error fetching duel:", error); return; }
    if (data) {
      const rawQs = Array.isArray(data.questions) ? data.questions : [];
      const normalized = normalizeDuelQuestions(rawQs);
      if (rawQs.length > 0 && normalized.length === 0) {
        console.error("[useDuel] Invalid questions JSONB; falling back to []", rawQs);
      }
      setDuel({ ...data, questions: normalized } as Duel);
    }
  }, [duelId]);

  const fetchAnswers = useCallback(async () => {
    if (!duelId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("duel_answers").select("*").eq("duel_id", duelId).order("question_index", { ascending: true });
    if (!error && data) setAnswers(data as DuelAnswer[]);
  }, [duelId]);

  useEffect(() => {
    if (!duelId) return;
    fetchDuel();
    fetchAnswers();
    const channel = supabase
      .channel(`duel-${duelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "duels", filter: `id=eq.${duelId}` }, () => fetchDuel())
      .on("postgres_changes", { event: "*", schema: "public", table: "duel_answers", filter: `duel_id=eq.${duelId}` }, () => fetchAnswers())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [duelId, fetchDuel, fetchAnswers]);

  const createDuel = useCallback(async (
    questionCount: number, questions: DuelQuestion[], sourceType: string, qcmSessionId?: string
  ): Promise<string | null> => {
    console.log("[createDuel] === DÉBUT DE CRÉATION ===");
    console.log("[createDuel] questionCount:", questionCount);
    console.log("[createDuel] questions count:", questions?.length);
    console.log("[createDuel] sourceType:", sourceType);
    console.log("[createDuel] qcmSessionId:", qcmSessionId);
    console.log("[createDuel] userId courant:", userId);

    let currentUserId = userId;
    if (!currentUserId) {
      console.log("[createDuel] userId est null, tentative getUser()...");
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) {
          console.error("[createDuel] Erreur auth.getUser():", authError);
          toast.error("Erreur d'authentification. Reconnectez-vous.");
          return null;
        }
        if (user) {
          currentUserId = user.id;
          setUserId(user.id);
          console.log("[createDuel] userId récupéré via getUser():", user.id);
        } else {
          console.error("[createDuel] Pas d'utilisateur connecté");
          toast.error("Vous n'êtes pas authentifié. Reconnectez-vous.");
          return null;
        }
      } catch (e) {
        console.error("[createDuel] Exception dans getUser():", e);
        toast.error("Erreur d'authentification inattendue.");
        return null;
      }
    }

    const inviteCode = generateInviteCode();
    console.log("[createDuel] inviteCode généré:", inviteCode);

    // Extraire le sourceType propre (sans le timeLimit qui y était collé)
    const cleanSourceType = sourceType.includes("|") ? sourceType.split("|")[0] : sourceType;

    const payload = {
      creator_id: currentUserId,
      invite_code: inviteCode,
      question_count: questionCount,
      questions: questions,
      source_type: cleanSourceType,
      qcm_session_id: qcmSessionId || null,
    };

    console.log("[createDuel] Payload d'insertion:", JSON.stringify(payload, null, 2).substring(0, 500));

    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("duels")
        .insert(payload)
        .select("id")
        .single();

      setLoading(false);

      if (error) {
        console.error("[createDuel] ❌ Erreur Supabase:", JSON.stringify(error, null, 2));
        console.error("[createDuel] code:", error.code);
        console.error("[createDuel] message:", error.message);
        console.error("[createDuel] details:", error.details);
        console.error("[createDuel] hint:", error.hint);
        toast.error(`Échec création duel: ${error.message || error.code || "Erreur inconnue"}`);
        return null;
      }

      if (!data || !data.id) {
        console.error("[createDuel] ❌ Pas de data.id retourné:", data);
        toast.error("Le serveur n'a pas retourné l'identifiant du duel.");
        return null;
      }

      console.log("[createDuel] ✅ Duel créé avec succès! ID:", data.id);
      toast.success("Arène créée avec succès !");
      return data.id as string;
    } catch (e) {
      setLoading(false);
      console.error("[createDuel] ❌ Exception inattendue:", e);
      toast.error("Erreur inattendue lors de la création du duel.");
      return null;
    }
  }, [userId]);

  const joinDuel = useCallback(async (inviteCode: string): Promise<string | null> => {
    if (!userId) { toast.error("Vous devez être connecté"); return null; }
    setLoading(true);
    const code = inviteCode.toUpperCase().trim();
    // Use SECURITY DEFINER RPC because RLS hides the row before we are the opponent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("join_duel_by_invite_code", { p_code: code });
    setLoading(false);
    if (error) {
      console.error("[joinDuel] RPC error:", error);
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("not found")) toast.error("Code introuvable ou duel déjà commencé");
      else if (msg.includes("already joined")) toast.error("Ce duel est déjà rejoint par un autre joueur");
      else if (msg.includes("not authenticated")) toast.error("Vous devez être connecté");
      else toast.error(`Impossible de rejoindre: ${error.message}`);
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const duelRow: any = Array.isArray(data) ? data[0] : data;
    if (!duelRow) { toast.error("Le duel n'est plus disponible"); return null; }
    if (duelRow.creator_id === userId) { toast.error("Vous ne pouvez pas rejoindre votre propre duel"); return null; }
    toast.success("Duel rejoint !");
    return duelRow.id as string;
  }, [userId]);

  const cancelDuel = useCallback(async (id: string): Promise<boolean> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("duels").delete().eq("id", id).eq("status", "waiting");
    if (error) { toast.error("Impossible d'annuler"); return false; }
    toast.success("Duel annulé");
    return true;
  }, []);

  const submitAnswer = useCallback(async (questionIndex: number, answer: string, _isCorrect: boolean, timeTakenMs: number) => {
    if (!userId || !duelId || !duel) return;
    // Server-side validation: the RPC verifies correctness against duels.questions and updates the score.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("submit_duel_answer", {
      p_duel_id: duelId,
      p_question_index: questionIndex,
      p_answer: answer,
      p_time_taken_ms: timeTakenMs,
    });
    if (error) { console.error("Error submitting answer:", error); }
  }, [userId, duelId, duel]);

  const advanceQuestion = useCallback(async () => {
    if (!duel || !duelId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("advance_duel_question", { p_duel_id: duelId });
    if (error) console.error("Error advancing question:", error);
  }, [duel, duelId]);

  const myAnswers = answers.filter((a) => a.user_id === userId);
  const opponentAnswers = answers.filter((a) => a.user_id !== userId);
  const hasAnsweredCurrent = duel ? myAnswers.some((a) => a.question_index === duel.current_question_index) : false;
  const opponentAnsweredCurrent = duel ? opponentAnswers.some((a) => a.question_index === duel.current_question_index) : false;
  const isCreator = userId === duel?.creator_id;

  return {
    duel, answers, myAnswers, opponentAnswers, loading, userId, isCreator,
    hasAnsweredCurrent, opponentAnsweredCurrent,
    createDuel, joinDuel, cancelDuel, submitAnswer, advanceQuestion, fetchDuel,
  };
}
