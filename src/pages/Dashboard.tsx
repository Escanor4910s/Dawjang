import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, ResponsiveContainer, Cell } from "recharts";
import { BookOpen, TrendingUp, Award, Target, Sun, Moon, Sparkles, ChevronDown, ChevronUp, Clock, Monitor, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useOnboardingContext } from "@/components/onboarding/OnboardingProvider";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";

interface QuizResult {
  id: string;
  course_id: string;
  score: number;
  total_questions: number;
  created_at: string;
  courses: { title: string; };
}

const Dashboard = () => {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [firstName, setFirstName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [openAccordions, setOpenAccordions] = useState<{ [key: string]: boolean }>({
    "recent": true,
    "devices": false,
    "benefits": false
  });
  
  const navigate = useNavigate();
  const { steps, completionPercentage, isComplete, refreshState } = useOnboardingContext();

  const toggleAccordion = (key: string) => {
    setOpenAccordions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hour = new Date().getHours();
  const GreetingIcon = hour < 18 ? Sun : Moon;

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/auth");
  };

  const fetchResults = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("first_name, name, avatar_url, university").eq("id", user.id).single();
      if (profile) {
        setFirstName(profile.first_name || profile.name || user.email?.split("@")[0] || "");
        if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
      }

      const { data, error } = await supabase.from("quiz_results").select(`id, course_id, score, total_questions, created_at, courses(title)`).eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error("Error fetching results:", error);
      toast.error("Erreur lors du chargement");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useRealtimeSubscription({ table: 'quiz_results', event: '*', onUpdate: fetchResults });
  
  useEffect(() => { 
    checkAuth(); 
    fetchResults(); 
    refreshState();
  }, [fetchResults, refreshState]);

  const averageScore = results.length > 0 ? Math.round((results.reduce((acc, r) => acc + (r.score / r.total_questions) * 100, 0) / results.length)) : 0;
  const successRate = results.length > 0 ? Math.round((results.filter(r => (r.score / r.total_questions) * 100 >= 60).length / results.length) * 100) : 0;

  const themeStats = results.reduce((acc, r) => {
    const title = r.courses?.title || "Sans titre";
    if (!acc[title]) acc[title] = { total: 0, correct: 0, count: 0 };
    acc[title].total += r.total_questions;
    acc[title].correct += r.score;
    acc[title].count += 1;
    return acc;
  }, {} as Record<string, { total: number; correct: number; count: number }>);

  const themePerformance = Object.entries(themeStats).map(([theme, stats]) => ({
    theme, score: Math.round((stats.correct / stats.total) * 100), count: stats.count,
  })).sort((a, b) => b.score - a.score);

  const bestTheme = themePerformance[0];
  const chartData = results.slice(0, 5).reverse().map((r, i) => ({ name: `Quiz ${results.length - 4 + i}`, score: Math.round((r.score / r.total_questions) * 100) }));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  const cardHover = {
    y: -5,
    boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
    transition: { duration: 0.3, ease: "sharp" },
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-dashboard text-foreground bg-doodle-watermark font-sans overflow-x-hidden px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-8">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-[1600px] mx-auto space-y-8 relative"
      >
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-warning/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Header Section */}
        <motion.div variants={itemVariants} className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 relative z-10">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-foreground">
              Bienvenue, {firstName || "Dr."}
            </h1>
            <div className="flex gap-4 mt-6 text-sm text-muted-foreground items-center">
               <div className="flex flex-col gap-1 w-24">
                 <span className="font-medium text-foreground">Score</span>
                 <div className="h-8 rounded-full bg-foreground relative overflow-hidden flex items-center px-2 text-background text-xs">
                   {averageScore}%
                 </div>
               </div>
               <div className="flex flex-col gap-1 w-24">
                 <span className="font-medium">Réussite</span>
                 <div className="h-8 rounded-full bg-warning relative overflow-hidden flex items-center px-2 text-warning-foreground font-medium text-xs">
                   {successRate}%
                 </div>
               </div>
            </div>
          </div>
          
          <div className="flex gap-8 sm:gap-12 lg:pb-2">
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1"><BookOpen className="w-3 h-3"/> QCM</span>
              <span className="text-4xl sm:text-5xl lg:text-6xl font-light text-foreground leading-none">{results.length}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1"><Target className="w-3 h-3"/> Séries</span>
              <span className="text-4xl sm:text-5xl lg:text-6xl font-light text-foreground leading-none">{Math.floor(results.length / 10)}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1"><Monitor className="w-3 h-3"/> Cours</span>
              <span className="text-4xl sm:text-5xl lg:text-6xl font-light text-foreground leading-none">{Object.keys(themeStats).length}</span>
            </div>
          </div>
        </motion.div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 relative z-10">
          
          {/* LEFT COLUMN */}
          <motion.div variants={itemVariants} className="lg:col-span-3 space-y-6">
            <motion.div whileHover={cardHover} className="bg-card/40 backdrop-blur-xl border border-border rounded-[2rem] p-6 shadow-sm overflow-hidden relative group">
              <div className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url('${avatarUrl || "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80"}')` }} />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
              
              <div className="relative pt-32 pb-4">
                <h2 className="text-2xl font-medium text-foreground mb-1">{firstName || "Utilisateur"}</h2>
                <p className="text-muted-foreground text-sm font-medium">Étudiant(e) en médecine</p>
                <div className="mt-4 inline-flex items-center gap-2 border border-border rounded-full px-4 py-1.5 backdrop-blur-md bg-muted/50 text-foreground text-sm font-medium">
                  Meilleur thème : {bestTheme?.theme || "-"}
                </div>
              </div>
            </motion.div>

            <div className="space-y-2">
              {['recent', 'devices', 'benefits'].map((key) => (
                <div key={key} className="bg-card/50 backdrop-blur-md rounded-3xl border border-border shadow-sm overflow-hidden transition-all">
                  <button onClick={() => toggleAccordion(key)} className="w-full flex items-center justify-between p-5 text-left focus:outline-none hover:bg-muted/30 transition-colors">
                    <span className="font-medium text-[15px] text-foreground">
                      {key === 'recent' ? 'Thèmes récents' : key === 'devices' ? 'Appareils actifs' : 'Abonnement'}
                    </span>
                    {openAccordions[key] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <AnimatePresence>
                    {openAccordions[key] && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 text-sm text-muted-foreground space-y-3 pt-2 border-t border-border border-dashed">
                          {key === 'recent' ? (
                            themePerformance.slice(0,3).map((t, i) => (
                              <div key={i} className="flex justify-between items-center">
                                <span className="truncate pr-4">{t.theme}</span>
                                <span className="font-medium text-foreground">{t.score}%</span>
                              </div>
                            ))
                          ) : key === 'devices' ? (
                            <div className="flex items-center gap-3">
                              <Monitor className="w-8 h-8 text-foreground/70 p-1.5 bg-muted rounded-lg" />
                              <div>
                                <p className="text-sm font-medium text-foreground">Cet Appareil</p>
                                <p className="text-xs text-muted-foreground">Connecté</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs font-bold uppercase tracking-wider text-primary">Plan Premium Actif</span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>

          {/* MIDDLE COLUMN */}
          <div className="lg:col-span-6 space-y-6 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div variants={itemVariants} whileHover={cardHover}>
                <Card className="bg-card/60 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-border shadow-sm flex flex-col justify-between h-full">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-lg font-medium text-foreground">Progression</h3>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-4xl font-light text-foreground">{averageScore}</span>
                        <span className="text-lg text-muted-foreground font-medium">%</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium block mt-1">Score moyen global</span>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center border border-border shadow-sm">
                      <TrendingUp className="w-4 h-4 text-foreground/70" />
                    </div>
                  </div>
                  {results.length > 0 ? (
                    <div className="h-32 w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <Bar dataKey="score" radius={[4, 4, 4, 4]} barSize={8}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} className={index === chartData.length - 1 ? "fill-warning" : "fill-foreground"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-32 w-full mt-4 bg-muted/50 rounded-xl flex items-center justify-center text-sm text-muted-foreground">Pas de données</div>
                  )}
                </Card>
              </motion.div>

              <motion.div variants={itemVariants} whileHover={cardHover}>
                <Card className="bg-card/60 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-border shadow-sm flex flex-col justify-between h-full relative overflow-hidden">
                  <div className="flex justify-between items-start z-10 relative">
                    <h3 className="text-lg font-medium text-foreground">Régularité</h3>
                    <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center border border-border shadow-sm">
                      <Clock className="w-4 h-4 text-foreground/70" />
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-4">
                    <div className="relative w-36 h-36 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" className="stroke-muted" strokeWidth="8" strokeLinecap="round" />
                        <motion.circle 
                          cx="50" cy="50" r="45" fill="none" className="stroke-warning" strokeWidth="8" strokeLinecap="round" 
                          initial={{ strokeDasharray: "0 280" }}
                          animate={{ strokeDasharray: `${successRate * 2.8} 280` }}
                          transition={{ duration: 1.5, ease: "easeInOut" }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-light tracking-tighter text-foreground">{successRate}%</span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Réussite</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>

            <motion.div variants={itemVariants} whileHover={cardHover} className="bg-card/60 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-border shadow-sm flex-1">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-foreground">Historique Récent</h3>
              </div>
              <div className="space-y-4 relative">
                <div className="absolute left-[39px] top-4 bottom-4 w-px bg-border border-dashed" />
                {results.slice(0,3).map((r, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-6 relative z-10">
                    <div className="w-20 text-right shrink-0">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className={`w-[20px] h-[20px] rounded-full border-4 border-background flex-shrink-0 ${i === 0 ? 'bg-primary' : 'bg-foreground'} shadow-sm`} />
                    <div className={`flex-1 p-4 rounded-2xl flex justify-between items-center ${i === 0 ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-background border border-border'}`}>
                       <div className="flex flex-col">
                         <span className={`font-medium text-sm truncate max-w-[150px] sm:max-w-[200px] ${i === 0 ? 'text-primary-foreground' : 'text-foreground'}`}>{r.courses?.title || "Sujet non défini"}</span>
                       </div>
                       <div className={`h-8 px-3 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-background/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
                         {Math.round((r.score / r.total_questions)*100)}%
                       </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* RIGHT COLUMN */}
          <motion.div variants={itemVariants} className="lg:col-span-3 h-full">
            <div className="bg-slate-950 text-white rounded-[2rem] p-6 sm:p-8 shadow-2xl h-full border border-white/5 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div>
                  <h3 className="text-xl font-medium text-white mb-1">Objectifs</h3>
                  <span className="text-xs text-white/80 uppercase tracking-widest font-bold">À compléter</span>
                </div>
                <div className="text-3xl font-light text-white tracking-tighter">
                  {Math.round(completionPercentage)}<span className="text-lg text-white/80">%</span>
                </div>
              </div>
              <div className="bg-white/10 rounded-3xl p-5 relative z-10 flex-1 flex flex-col gap-4">
                <div className="space-y-1 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  {steps.map((step, idx) => (
                    <motion.div 
                      key={step.id} 
                      whileHover={{ x: 5 }}
                      onClick={() => !step.completed && step.route && navigate(step.route)}
                      className={`flex items-center gap-4 p-3 rounded-2xl transition-colors cursor-pointer ${step.completed ? 'bg-white/5 opacity-90' : 'hover:bg-white/10'}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${step.completed ? 'bg-success text-success-foreground' : 'bg-white/20 text-white'}`}>
                        {step.completed ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-xs font-bold">{idx+1}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${step.completed ? 'text-white/90 line-through' : 'text-white'}`}>{step.title}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
