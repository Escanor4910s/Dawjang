import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "./components/ThemeProvider";
import { UserPreferencesProvider } from "./hooks/useUserPreferences";
import { PlanGuard } from "./components/PlanGuard";
import { registerSW } from 'virtual:pwa-register';
import { toast } from "sonner";
import { LivingCanvas } from "./components/LivingCanvas";
import "./lib/i18n";
// Register PWA with notification
registerSW({
  onOfflineReady() {
    toast.info("Hippocampus est prêt pour une utilisation hors-ligne ! 🚀", {
      description: "Vous pouvez continuer à réviser même sans connexion internet.",
      duration: 5000,
    });
  },
});

// Lazy loaded pages
const AddCourse = lazy(() => import("./pages/AddCourse"));
const Admin = lazy(() => import("./pages/Admin"));
const QuizLibrary = lazy(() => import("./pages/QuizLibrary"));
const Quiz = lazy(() => import("./pages/Quiz"));
const ExamMode = lazy(() => import("./pages/ExamMode"));
const Community = lazy(() => import("./pages/Community"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Review = lazy(() => import("./pages/Review"));
const Flashcards = lazy(() => import("./pages/Flashcards"));
const Statistics = lazy(() => import("./pages/Statistics"));
const GenerateSummary = lazy(() => import("./pages/GenerateSummary"));
const Summaries = lazy(() => import("./pages/Summaries"));
const SummaryView = lazy(() => import("./pages/SummaryView"));
const Settings = lazy(() => import("./pages/Settings"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Install = lazy(() => import("./pages/Install"));
const About = lazy(() => import("./pages/About"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const DuelPage = lazy(() => import("./pages/Duel"));
const DuelGame = lazy(() => import("./pages/DuelGame"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Refund = lazy(() => import("./pages/Refund"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const MyPlan = lazy(() => import("./pages/MyPlan"));
const QuizInfini = lazy(() => import("./pages/QuizInfini"));
const ReviewPlanner = lazy(() => import("./pages/ReviewPlanner"));
const Ecos = lazy(() => import("./pages/Ecos"));

const PageLoader = () => (
  <div className="min-h-screen bg-transparent flex items-center justify-center flex-1 w-full">
    <div className="animate-pulse text-primary text-lg font-bold">Chargement...</div>
  </div>
);

const queryClient = new QueryClient();

const LayoutWrapper = () => (
  <Layout>
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  </Layout>
);

const PublicWrapper = () => (
  <Suspense fallback={<PageLoader />}>
    <Outlet />
  </Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="quizmed-ui-theme">
      <UserPreferencesProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <LivingCanvas />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              {/* Public pages — no Layout (sidebar) */}
              <Route element={<PublicWrapper />}>
                <Route path="/auth" element={<Auth />} />
                <Route path="/install" element={<Install />} />
                <Route path="/about" element={<About />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/refund" element={<Refund />} />
              </Route>

              {/* App pages — wrapped in Layout */}
              <Route element={<LayoutWrapper />}>
                <Route path="/" element={<Index />} />
                <Route path="/add-course" element={<AddCourse />} />
                <Route path="/quiz-library" element={<QuizLibrary />} />
                <Route path="/community" element={<Community />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/review" element={<Review />} />
                <Route path="/flashcards" element={<PlanGuard requiredPlan="premium" featureName="Flashcards"><Flashcards /></PlanGuard>} />
                <Route path="/statistics" element={<Statistics />} />
                <Route path="/quiz/:courseId" element={<Quiz />} />
                <Route path="/quiz-infini/:courseId" element={<QuizInfini />} />
                <Route path="/exam/:courseId" element={<PlanGuard requiredPlan="premium" featureName="Mode Examen"><ExamMode /></PlanGuard>} />
                <Route path="/generate-summary" element={<PlanGuard requiredPlan="premium" featureName="Génération de résumés"><GenerateSummary /></PlanGuard>} />
                <Route path="/summaries" element={<Summaries />} />
                <Route path="/summary/:id" element={<SummaryView />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/subscription" element={<Subscription />} />
                <Route path="/my-plan" element={<MyPlan />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/diagnostics" element={<Diagnostics />} />
                <Route path="/review-planner" element={<PlanGuard requiredPlan="premium" featureName="Planificateur de révisions"><ReviewPlanner /></PlanGuard>} />
                <Route path="/duel" element={<PlanGuard requiredPlan="premium" featureName="Mode Duel"><DuelPage /></PlanGuard>} />
                <Route path="/ecos" element={<PlanGuard requiredPlan="premium" featureName="Simulateur ECOS"><Ecos /></PlanGuard>} />
                <Route path="/duel/:duelId" element={<PlanGuard requiredPlan="premium" featureName="Mode Duel"><DuelGame /></PlanGuard>} />
                
                {/* Fallback */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </UserPreferencesProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

