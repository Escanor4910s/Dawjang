import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { lazy, Suspense, useState, useEffect } from "react";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "./components/ThemeProvider";
import { UserPreferencesProvider } from "./hooks/useUserPreferences";
import { PlanGuard } from "./components/PlanGuard";
import { registerSW } from 'virtual:pwa-register';
import { toast } from "sonner";
import { SplashScreen } from "./components/SplashScreen";
import "./lib/i18n";

// Register PWA with notification
registerSW({
  onOfflineReady() {
    toast.info("DawJang est prêt pour une utilisation hors-ligne ! 🚀", {
      description: "Vous pouvez continuer à réviser même sans connexion internet.",
      duration: 5000,
    });
  },
});

// Lazy loaded pages
const AddCourse = lazy(() => import("./pages/AddCourse"));
const Admin = lazy(() => import("./pages/Admin"));
const QuizLibrary = lazy(() => import("./pages/QuizLibrary"));
const Library = lazy(() => import("./pages/Library"));
const Quiz = lazy(() => import("./pages/Quiz"));
const QuizWorkspace = lazy(() => import("./components/quiz/QuizWorkspace"));
const QcmMasterStudio = lazy(() => import("./pages/QcmMasterStudio"));
const Exams = lazy(() => import("./pages/Exams"));
const ExamMode = lazy(() => import("./pages/ExamMode"));
const Community = lazy(() => import("./pages/Community"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Review = lazy(() => import("./pages/Review"));
const Flashcards = lazy(() => import("./pages/Flashcards"));
const SmartFlashcardsPage = lazy(() => import("./pages/SmartFlashcardsPage"));
const Statistics = lazy(() => import("./pages/Statistics"));
const Stats = lazy(() => import("./pages/Stats"));
const GenerateSummary = lazy(() => import("./pages/GenerateSummary"));
const Summaries = lazy(() => import("./pages/Summaries"));
const SummaryView = lazy(() => import("./pages/SummaryView"));
const Settings = lazy(() => import("./pages/Settings"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Collection = lazy(() => import("./pages/Collection"));
const Install = lazy(() => import("./pages/Install"));
const About = lazy(() => import("./pages/About"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const DuelPage = lazy(() => import("./pages/Duel"));
const Duels = lazy(() => import("./pages/Duels"));
const DuelGame = lazy(() => import("./pages/DuelGame"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Refund = lazy(() => import("./pages/Refund"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const MyPlan = lazy(() => import("./pages/MyPlan"));
const QuizInfini = lazy(() => import("./pages/QuizInfini"));
const Infini = lazy(() => import("./pages/Infini"));
const ReviewPlanner = lazy(() => import("./pages/ReviewPlanner"));
const Planning = lazy(() => import("./pages/Planning"));
const Ecos = lazy(() => import("./pages/Ecos"));
const DailyCase = lazy(() => import("./pages/DailyCase"));
const GapsReport = lazy(() => import("./pages/GapsReport"));
const Predictions = lazy(() => import("./pages/Predictions"));

const PageLoader = () => (
  <div className="min-h-screen bg-transparent flex items-center justify-center flex-1 w-full">
    <div className="animate-pulse text-primary text-lg font-bold">Chargement...</div>
  </div>
);

const queryClient = new QueryClient();

import { ErrorBoundary } from "./components/ErrorBoundary";

const LayoutWrapper = () => (
  <Layout>
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  </Layout>
);

const PublicWrapper = () => (
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  </ErrorBoundary>
);

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  // Pour s'assurer qu'il ne se lance qu'une fois par session complète
  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('hippocampus_splash_seen');
    if (hasSeenSplash) {
      setShowSplash(false);
    }
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
    sessionStorage.setItem('hippocampus_splash_seen', 'true');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="quizmed-ui-theme">
        <UserPreferencesProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              {/* Public pages — no Layout (sidebar) */}
              <Route element={<PublicWrapper />}>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/login" element={<Auth />} />
                <Route path="/register" element={<Auth />} />
                <Route path="/install" element={<Install />} />
                <Route path="/about" element={<About />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/conditions" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/confidentialite" element={<Privacy />} />
                <Route path="/pricing" element={<Navigate to="/tarifs" replace />} />
                <Route path="/tarifs" element={<Pricing />} />
                <Route path="/refund" element={<Refund />} />
              </Route>

              {/* App pages — wrapped in Layout */}
              <Route element={<LayoutWrapper />}>
                <Route path="/smart-flashcards" element={<SmartFlashcardsPage />} />
                <Route path="/smart-flashcards/:courseId" element={<SmartFlashcardsPage />} />
                <Route path="/add-course" element={<Navigate to="/qcm" replace />} />
                <Route path="/quiz-library" element={<Library />} />
                <Route path="/library" element={<Library />} />
                <Route path="/courses" element={<Library />} />
                <Route path="/quiz" element={<Quiz />} />
                <Route path="/quizzes" element={<Navigate to="/qcm" replace />} />
                <Route path="/qcm" element={<QcmMasterStudio />} />
                <Route path="/quiz-workspace" element={<QuizWorkspace />} />
                <Route path="/qcm-v2" element={<QuizWorkspace />} />
                <Route path="/qcm-studio" element={<QcmMasterStudio />} />
                <Route path="/constructeur-qcm" element={<QcmMasterStudio />} />
                <Route path="/qcm-builder" element={<QcmMasterStudio />} />
                <Route path="/create-quiz" element={<QcmMasterStudio />} />
                <Route path="/community" element={<Community />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/collection" element={<Collection />} />
                <Route path="/review" element={<PlanGuard requiredPlan="premium" featureName="Flashcards"><Flashcards /></PlanGuard>} />
                <Route path="/flashcards" element={<PlanGuard requiredPlan="premium" featureName="Flashcards"><Flashcards /></PlanGuard>} />
                <Route path="/predictions" element={<Predictions />} />
                <Route path="/statistics" element={<Statistics />} />
                <Route path="/stats" element={<Statistics />} />
                <Route path="/quiz/:courseId" element={<Quiz />} />
                <Route path="/quiz-infini/:courseId" element={<QuizInfini />} />
                <Route path="/infini" element={<Infini />} />
                <Route path="/exam" element={<PlanGuard requiredPlan="premium" featureName="Mode Examen"><Exams /></PlanGuard>} />
                <Route path="/exams" element={<PlanGuard requiredPlan="premium" featureName="Mode Examen"><Exams /></PlanGuard>} />
                <Route path="/exam/:courseId" element={<PlanGuard requiredPlan="premium" featureName="Mode Examen"><Exams /></PlanGuard>} />
                <Route path="/generate-summary" element={<GenerateSummary />} />
                <Route path="/summaries/new" element={<GenerateSummary />} />
                <Route path="/summaries" element={<Summaries />} />
                <Route path="/summary" element={<Navigate to="/summaries" replace />} />
                <Route path="/summary/:id" element={<SummaryView />} />
                <Route path="/summaries/:id" element={<SummaryView />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/subscription" element={<Subscription />} />
                <Route path="/my-plan" element={<MyPlan />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/diagnostics" element={<Diagnostics />} />
                <Route path="/review-planner" element={<PlanGuard requiredPlan="premium" featureName="Planificateur de révisions"><Planning /></PlanGuard>} />
                <Route path="/planning" element={<PlanGuard requiredPlan="premium" featureName="Planificateur de révisions"><Planning /></PlanGuard>} />
                <Route path="/duel" element={<PlanGuard requiredPlan="premium" featureName="Mode Duel"><Duels /></PlanGuard>} />
                <Route path="/duels" element={<PlanGuard requiredPlan="premium" featureName="Mode Duel"><Duels /></PlanGuard>} />
                <Route path="/ecos" element={<PlanGuard requiredPlan="premium" featureName="Simulateur ECOS"><Ecos /></PlanGuard>} />
                <Route path="/duel/:duelId" element={<PlanGuard requiredPlan="premium" featureName="Mode Duel"><DuelGame /></PlanGuard>} />
                <Route path="/daily-case" element={<DailyCase />} />
                <Route path="/gaps-report" element={<GapsReport />} />
                
                {/* Fallback */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
          {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
        </TooltipProvider>
      </UserPreferencesProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;