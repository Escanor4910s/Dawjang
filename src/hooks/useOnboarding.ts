import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action?: string;
  route?: string;
}

export interface OnboardingState {
  isNewUser: boolean;
  hasSeenWelcome: boolean;
  currentStep: number;
  completedSteps: string[];
  tourActive: boolean;
}

const ONBOARDING_STEPS: Omit<OnboardingStep, "completed">[] = [
  { id: "upload_course", title: "Télécharger un cours", description: "Importez votre premier cours", action: "Ajouter", route: "/add-course" },
  { id: "create_qcm", title: "Générer un QCM", description: "Créez des questions automatiquement", action: "Créer", route: "/add-course" },
  { id: "complete_quiz", title: "Compléter un quiz", description: "Testez vos connaissances", action: "Quiz", route: "/quiz-library" },
  { id: "review_flashcards", title: "Réviser avec flashcards", description: "Répétition espacée", action: "Flashcards", route: "/flashcards" },
  { id: "check_stats", title: "Voir vos statistiques", description: "Suivez votre progression", action: "Stats", route: "/statistics" },
  { id: "focus_session", title: "Lancer un Focus", description: "Concentrez-vous avec le Focus Pod", action: "Focus", route: "/" },
  { id: "setup_profile", title: "Configurer le profil", description: "Personnalisez votre expérience", action: "Profil", route: "/settings" },
  { id: "plan_review", title: "Planifier vos révisions", description: "Organisez votre emploi du temps", action: "Agenda", route: "/review-planner" },
];

const STORAGE_KEY = "hippocampus_onboarding";

export const useOnboarding = () => {
  const [state, setState] = useState<OnboardingState>({
    isNewUser: false, hasSeenWelcome: true, currentStep: 0, completedSteps: [], tourActive: false,
  });
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase.from("profiles").select("first_name, name").eq("id", user.id).single();
      if (profile) setUserName(profile.first_name || profile.name || null);

      // Check actual data for step completion
      const [coursesRes, quizRes, qcmRes, flashcardsRes] = await Promise.all([
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("quiz_results").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("qcm_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      const hasCourses = (coursesRes.count ?? 0) > 0;
      const hasQuizResults = (quizRes.count ?? 0) > 0;
      const hasQcmSessions = (qcmRes.count ?? 0) > 0;
      const hasFlashcards = (flashcardsRes.count ?? 0) > 0;
      const isNewUser = !hasCourses && !hasQuizResults;

      const savedState = localStorage.getItem(`${STORAGE_KEY}_${user.id}`);
      let parsedState: Partial<OnboardingState> = {};
      // eslint-disable-next-line no-empty
      if (savedState) { try { parsedState = JSON.parse(savedState); } catch {} }

      const completedSteps: string[] = [...(parsedState.completedSteps || [])];
      
      // Auto-detect completed steps from real data
      if (hasCourses && !completedSteps.includes("upload_course")) completedSteps.push("upload_course");
      if (hasQcmSessions && !completedSteps.includes("create_qcm")) completedSteps.push("create_qcm");
      if (hasQuizResults && !completedSteps.includes("complete_quiz")) completedSteps.push("complete_quiz");
      if (hasFlashcards && !completedSteps.includes("review_flashcards")) completedSteps.push("review_flashcards");

      setState({
        isNewUser,
        hasSeenWelcome: parsedState.hasSeenWelcome ?? !isNewUser,
        currentStep: parsedState.currentStep ?? 0,
        completedSteps,
        tourActive: parsedState.tourActive ?? false,
      });
    } catch (error) {
      console.error("Onboarding error:", error);
    } finally { setLoading(false); }
  }, []);

  const saveState = useCallback(async (newState: OnboardingState) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) localStorage.setItem(`${STORAGE_KEY}_${user.id}`, JSON.stringify(newState));
  }, []);

  const markWelcomeSeen = useCallback(() => {
    const newState = { ...state, hasSeenWelcome: true };
    setState(newState); saveState(newState);
  }, [state, saveState]);

  const completeStep = useCallback((stepId: string) => {
    if (state.completedSteps.includes(stepId)) return;
    const newCompletedSteps = [...state.completedSteps, stepId];
    const newState = { ...state, completedSteps: newCompletedSteps, currentStep: Math.min(state.currentStep + 1, ONBOARDING_STEPS.length - 1) };
    setState(newState); saveState(newState);
  }, [state, saveState]);

  const toggleTour = useCallback((active: boolean) => {
    const newState = { ...state, tourActive: active };
    setState(newState); saveState(newState);
  }, [state, saveState]);

  const resetOnboarding = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) localStorage.removeItem(`${STORAGE_KEY}_${user.id}`);
    setState({ isNewUser: true, hasSeenWelcome: false, currentStep: 0, completedSteps: [], tourActive: false });
  }, []);

  const steps: OnboardingStep[] = ONBOARDING_STEPS.map(step => ({
    ...step, completed: state.completedSteps.includes(step.id),
  }));

  const completionPercentage = Math.round((state.completedSteps.length / ONBOARDING_STEPS.length) * 100);
  const isComplete = state.completedSteps.length >= ONBOARDING_STEPS.length;

  useEffect(() => { loadState(); }, [loadState]);

  return {
    ...state, loading, userName, steps, completionPercentage, isComplete,
    markWelcomeSeen, completeStep, toggleTour, resetOnboarding, refreshState: loadState,
  };
};