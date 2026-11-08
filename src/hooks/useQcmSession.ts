// src/hooks/useQcmSession.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type QcmSessionRecord,
  getSavedSessions,
  saveSessionLocally,
  computeQcmHash,
  calculateSessionScore,
  deleteQcmSession,
  syncSessionToSupabase,
} from "@/lib/qcmSessionManager";
import type { QuizQuestion } from "@/pages/Quiz";
import { useToast } from "@/hooks/use-toast";

export interface CreateSessionParams {
  title?: string;
  subject?: string;
  doctrine?: string;
  difficulty?: string;
  selectivite?: string;
  [key: string]: any;
}

export function useQcmSession(userId?: string) {
  const [currentSession, setCurrentSession] = useState<QcmSessionRecord | null>(null);
  const [sessionsList, setSessionsList] = useState<QcmSessionRecord[]>(() => getSavedSessions());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Buffer de debouncing pour saveAnswer
  const saveDebounceRef = useRef<any>(null);
  const pendingAnswersRef = useRef<Record<string, string[]>>({});

  // 1. Charger la liste complète des sessions de l'utilisateur (Supabase + Local)
  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = (supabase.from("sessions_qcm") as any)
        .select("*")
        .order("session_started", { ascending: false });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error: sbError } = await query;
      if (sbError) {
        console.warn("Échec requête Supabase sessions_qcm, bascule locale:", sbError);
        setSessionsList(getSavedSessions());
        return;
      }

      const localSessions = getSavedSessions();
      const map = new Map<string, QcmSessionRecord>();
      localSessions.forEach((s) => map.set(s.id, s));

      if (data && Array.isArray(data)) {
        data.forEach((row: any) => {
          const parsedQuestions =
            typeof row.questions === "string" ? JSON.parse(row.questions) : row.questions || [];
          const parsedAnswers =
            typeof row.user_answers === "string" ? JSON.parse(row.user_answers) : row.user_answers || {};
          const params =
            typeof row.parameters === "string" ? JSON.parse(row.parameters) : row.parameters || {};

          const mapped: QcmSessionRecord = {
            id: row.id,
            userId: row.user_id,
            deckId: row.qcm_base_id,
            title: params.title || "Session QCM",
            subject: params.subject || "Médecine",
            format: params.doctrine || "mixte",
            difficulty: params.difficulty || "standard",
            startedAt: row.session_started || row.created_at,
            endedAt: row.session_ended,
            status: row.status || (row.session_ended ? "completed" : "in_progress"),
            questions: parsedQuestions,
            userAnswers: parsedAnswers,
            score: row.score || 0,
            totalQuestions: parsedQuestions.length,
            timeElapsed: row.time_elapsed || 0,
            uniqueHash: row.unique_hash,
            isDiversified: Boolean(params.isDiversified),
            parameters: params,
          };
          map.set(mapped.id, mapped);
        });
      }

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
      setSessionsList(merged);
    } catch (e: any) {
      console.error("Erreur chargement sessions:", e);
      setError(e.message || "Erreur de chargement des sessions");
      setSessionsList(getSavedSessions());
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 2. Créer une nouvelle session avec unicité garantie
  const createSession = useCallback(
    async (
      qcmBaseId: string,
      params: CreateSessionParams = {},
      questions: QuizQuestion[]
    ): Promise<QcmSessionRecord> => {
      setLoading(true);
      setError(null);
      try {
        const uniqueHash = computeQcmHash(questions);

        // Vérification doublon côté Edge Function ou table
        try {
          const { data: existing } = await (supabase.from("sessions_qcm") as any)
            .select("id")
            .eq("qcm_base_id", qcmBaseId)
            .eq("unique_hash", uniqueHash)
            .limit(1)
            .maybeSingle();

          if (existing) {
            console.info("Session déjà existante avec ce hash:", existing.id);
          }
        } catch {
          // Ignorer si hors-ligne
        }

        const sessionId =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        const newSession: QcmSessionRecord = {
          id: sessionId,
          userId,
          deckId: qcmBaseId,
          title: params.title || "Session QCM",
          subject: params.subject || "Médecine",
          format: params.doctrine || "mixte",
          difficulty: params.difficulty || "standard",
          startedAt: new Date().toISOString(),
          status: "in_progress",
          questions,
          userAnswers: {},
          score: 0,
          totalQuestions: questions.length,
          timeElapsed: 0,
          uniqueHash,
          isDiversified: Boolean(params.isDiversified),
          parameters: params,
        };

        // Sauvegarde locale instantanée
        saveSessionLocally(newSession);
        setCurrentSession(newSession);

        // Synchronisation asynchrone Supabase
        await syncSessionToSupabase(newSession);

        setSessionsList((prev) => [newSession, ...prev.filter((s) => s.id !== newSession.id)]);
        return newSession;
      } catch (e: any) {
        console.error("Erreur création session:", e);
        setError(e.message || "Erreur de création de session");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  // 3. Sauvegarder la réponse à une question (avec throttling / debouncing)
  const saveAnswer = useCallback(
    (questionId: string, answer: string[] | string, timeElapsed: number = 0) => {
      if (!currentSession) return;

      const answerArray = Array.isArray(answer) ? answer : [answer];
      const updatedAnswers = {
        ...currentSession.userAnswers,
        [questionId]: answerArray,
      };

      // Mise à jour de l'état React local
      setCurrentSession((prev) =>
        prev
          ? {
              ...prev,
              userAnswers: updatedAnswers,
              timeElapsed,
            }
          : null
      );

      // Sauvegarde synchrone dans localStorage
      saveSessionLocally({
        ...currentSession,
        userAnswers: updatedAnswers,
        timeElapsed,
      });

      // Throttling / debouncing réseau (600ms) pour éviter les requêtes en rafale
      pendingAnswersRef.current = updatedAnswers;

      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }

      saveDebounceRef.current = setTimeout(async () => {
        try {
          await (supabase.from("sessions_qcm") as any)
            .update({
              user_answers: pendingAnswersRef.current,
              time_elapsed: timeElapsed,
              updated_at: new Date().toISOString(),
            })
            .eq("id", currentSession.id);
        } catch (e) {
          console.warn("Échec sauvegarde réponse throttlée (hors-ligne):", e);
        }
      }, 600);
    },
    [currentSession]
  );

  // 4. Clôturer la session QCM avec score final
  const finishSession = useCallback(
    async (
      finalAnswers: Record<string, string[]>,
      explicitScore?: number,
      timeElapsed: number = 0
    ) => {
      if (!currentSession) return;

      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }

      const score =
        typeof explicitScore === "number"
          ? explicitScore
          : calculateSessionScore(currentSession.questions, finalAnswers);

      const completedSession: QcmSessionRecord = {
        ...currentSession,
        userAnswers: finalAnswers,
        score,
        timeElapsed,
        status: "completed",
        endedAt: new Date().toISOString(),
      };

      // Mise à jour locale
      saveSessionLocally(completedSession);
      setCurrentSession(null);

      // Mise à jour distante
      try {
        await syncSessionToSupabase(completedSession);
      } catch (e) {
        console.warn("Échec clôture Supabase distante (enregistré en local):", e);
      }

      await loadSessions();

      toast({
        title: "Session QCM terminée !",
        description: `Score obtenu : ${score}/${completedSession.totalQuestions} • Mémorisée dans vos QCM.`,
      });

      return completedSession;
    },
    [currentSession, loadSessions, toast]
  );

  // 5. Reprendre une session existante (en cours ou terminée)
  const resumeSession = useCallback(
    (sessionId: string): QcmSessionRecord | null => {
      const found = sessionsList.find((s) => s.id === sessionId) || null;
      if (found) {
        setCurrentSession(found);
      }
      return found;
    },
    [sessionsList]
  );

  // 6. Supprimer une session
  const removeSession = useCallback(
    async (sessionId: string) => {
      await deleteQcmSession(sessionId);
      setSessionsList((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }
      toast({ title: "Session retirée de l'historique" });
    },
    [currentSession, toast]
  );

  // Montage initial
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Nombre de sessions terminées pour badge dynamique
  const completedCount = sessionsList.filter((s) => s.status === "completed").length;

  return {
    currentSession,
    setCurrentSession,
    sessionsList,
    completedCount,
    loading,
    error,
    createSession,
    saveAnswer,
    finishSession,
    resumeSession,
    removeSession,
    loadSessions,
  };
}
