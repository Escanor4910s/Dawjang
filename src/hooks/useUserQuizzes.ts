// src/hooks/useUserQuizzes.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UserQuizRecord {
  id: string;
  user_id?: string | null;
  title: string;
  subject: string;
  quiz: any;
  unique_hash?: string;
  created_at: string;
  updated_at?: string;
}

const STORAGE_KEY = "dawjang_user_quizzes_v1";

/**
 * Calcule un hash déterministe pour éviter les doublons stricts de quiz
 */
function computeQuizHash(quizData: any): string {
  try {
    const questions = quizData?.questions || [];
    if (!questions || questions.length === 0) return `empty_${Date.now()}`;
    const raw = questions
      .map((q: any) => {
        const text = q.question || "";
        const choices = (q.choices || q.options || [])
          .map((c: any) => (typeof c === "string" ? c : c.text || c.label))
          .sort()
          .join("|");
        return `${text}::${choices}`;
      })
      .join("##");

    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `hash_${Math.abs(hash).toString(36)}_${questions.length}`;
  } catch {
    return `hash_${Date.now()}`;
  }
}

function getLocalQuizzes(): UserQuizRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Erreur lecture local user_quizzes:", e);
    return [];
  }
}

function saveLocalQuizzes(quizzes: UserQuizRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quizzes));
  } catch (e) {
    console.error("Erreur écriture local user_quizzes:", e);
  }
}

export function useUserQuizzes(explicitUserId?: string) {
  const [quizzes, setQuizzes] = useState<UserQuizRecord[]>(() => getLocalQuizzes());
  const [loading, setLoading] = useState(false);
  const [activeUserId, setActiveUserId] = useState<string | null>(explicitUserId || null);
  const { toast } = useToast();

  // Résoudre l'utilisateur authentifié
  useEffect(() => {
    if (explicitUserId) {
      setActiveUserId(explicitUserId);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) {
        setActiveUserId(data.user.id);
      }
    });
  }, [explicitUserId]);

  /**
   * Récupère la liste de tous les quiz de l'utilisateur
   */
  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const local = getLocalQuizzes();

      // 1. Essai via Supabase Edge Function
      try {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke(
          "qcm-session",
          {
            body: {
              action: "getQuizzes",
              userId: activeUserId,
            },
          }
        );

        if (!edgeErr && Array.isArray(edgeData)) {
          // Fusionner avec le cache local en dédoublonnant par ID
          const mergedMap = new Map<string, UserQuizRecord>();
          for (const item of edgeData) {
            mergedMap.set(item.id, item);
          }
          for (const item of local) {
            if (!mergedMap.has(item.id)) {
              mergedMap.set(item.id, item);
            }
          }
          const merged = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setQuizzes(merged);
          saveLocalQuizzes(merged);
          return;
        }
      } catch (edgeError) {
        // Fallback discret vers la base de données directe
      }

      // 2. Fallback direct via table Supabase 'user_quizzes'
      try {
        let query: any = (supabase as any)
          .from("user_quizzes")
          .select("*")
          .order("created_at", { ascending: false });

        if (activeUserId) {
          query = query.eq("user_id", activeUserId);
        }

        const { data: dbData, error: dbErr } = await query;
        if (!dbErr && dbData && Array.isArray(dbData)) {
          const mergedMap = new Map<string, UserQuizRecord>();
          for (const item of (dbData as UserQuizRecord[])) {
            mergedMap.set(item.id, item);
          }
          for (const item of local) {
            if (!mergedMap.has(item.id)) {
              mergedMap.set(item.id, item);
            }
          }
          const merged = Array.from(mergedMap.values());
          setQuizzes(merged);
          saveLocalQuizzes(merged);
          return;
        }
      } catch (dbError) {
        // Fallback final : cache local
      }

      // 3. Fallback sur le cache local
      setQuizzes(local);
    } catch (e) {
      console.error("Erreur lors de la récupération des quiz:", e);
      setQuizzes(getLocalQuizzes());
    } finally {
      setLoading(false);
    }
  }, [activeUserId]);

  /**
   * Sauvegarde un nouveau quiz avec détection d'unicité
   */
  const saveQuiz = useCallback(
    async (
      quizData: any,
      metadata?: { title?: string; subject?: string }
    ): Promise<UserQuizRecord | null> => {
      if (!quizData) return null;

      const title =
        metadata?.title ||
        quizData.title ||
        `Quiz de Médecine • ${new Date().toLocaleDateString()}`;
      const subject = metadata?.subject || quizData.subject || "Médecine";
      const hash = computeQuizHash(quizData);
      const id = quizData.id || `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const newRecord: UserQuizRecord = {
        id,
        user_id: activeUserId,
        title,
        subject,
        quiz: quizData,
        unique_hash: hash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Sauvegarde locale optimiste immédiate
      const currentLocal = getLocalQuizzes();
      const existingIdx = currentLocal.findIndex(
        (q) => q.id === id || (q.unique_hash && q.unique_hash === hash)
      );

      let updatedList: UserQuizRecord[];
      if (existingIdx >= 0) {
        updatedList = [...currentLocal];
        updatedList[existingIdx] = newRecord;
      } else {
        updatedList = [newRecord, ...currentLocal];
      }
      setQuizzes(updatedList);
      saveLocalQuizzes(updatedList);

      // 2. Synchronisation distante via Edge Function
      try {
        const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke(
          "qcm-session",
          {
            body: {
              action: "saveQuiz",
              userId: activeUserId,
              quizData,
              title,
              subject,
              quizId: id,
            },
          }
        );

        if (!edgeErr && edgeRes) {
          toast({
            title: "Quiz sauvegardé en ligne ✨",
            description: `« ${title} » est disponible dans votre espace personnel.`,
          });
          return edgeRes;
        }
      } catch {
        // Fallback base de données directe
      }

      // 3. Fallback direct table 'user_quizzes'
      try {
        await supabase.from("user_quizzes" as any).insert({
          id,
          user_id: activeUserId,
          title,
          subject,
          quiz: quizData,
          unique_hash: hash,
          created_at: newRecord.created_at,
          updated_at: newRecord.updated_at,
        });
      } catch (e) {
        console.warn("Synchronisation distante différée (stocké localement):", e);
      }

      toast({
        title: "Quiz sauvegardé localement",
        description: `« ${title} » a été ajouté à votre banque de révision.`,
      });

      return newRecord;
    },
    [activeUserId, toast]
  );

  /**
   * Récupère un quiz spécifique par son ID
   */
  const getQuizById = useCallback(
    async (quizId: string): Promise<UserQuizRecord | null> => {
      // Vérifier d'abord dans l'état local
      const inState = quizzes.find((q) => q.id === quizId);
      if (inState) return inState;

      // Essayer via Edge function
      try {
        const { data } = await supabase.functions.invoke("qcm-session", {
          body: { action: "getQuizById", quizId },
        });
        if (data) return data;
      } catch {
        // Ignorer
      }

      // Essayer via DB
      try {
        const { data } = await (supabase as any)
          .from("user_quizzes")
          .select("*")
          .eq("id", quizId)
          .single();
        if (data) return data as UserQuizRecord;
      } catch {
        // Ignorer
      }

      return null;
    },
    [quizzes]
  );

  /**
   * Supprime un quiz
   */
  const deleteQuiz = useCallback(
    async (quizId: string) => {
      // 1. Retirer localement
      const updated = quizzes.filter((q) => q.id !== quizId);
      setQuizzes(updated);
      saveLocalQuizzes(updated);

      // 2. Supprimer via Edge function
      try {
        await supabase.functions.invoke("qcm-session", {
          body: { action: "deleteQuiz", quizId },
        });
      } catch {
        // Ignorer
      }

      // 3. Supprimer via DB
      try {
        await supabase.from("user_quizzes" as any).delete().eq("id", quizId);
      } catch {
        // Ignorer
      }

      toast({
        title: "Quiz supprimé",
        description: "Le quiz a été retiré de votre historique.",
      });
    },
    [quizzes, toast]
  );

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  return {
    quizzes,
    loading,
    quizzesCount: quizzes.length,
    saveQuiz,
    fetchQuizzes,
    getQuizById,
    deleteQuiz,
  };
}
