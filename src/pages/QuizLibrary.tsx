import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Play, Plus, Trash2, Download, FileDown, Timer, Layers, RefreshCw, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportQuizToPDF, exportQuizListToPDF } from "@/utils/pdfExport";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedBanner } from "@/components/AnimatedBanner";

interface QCMSession {
  id: string;
  title: string;
  questions: any;
  question_count: number;
  question_type?: string;
  ai_model?: string;
  status: string;
  created_at: string;
  courses?: {
    id: string;
    title: string;
    content?: string;
    file_name?: string;
  };
}

// --- Animations ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 15 } }
};

const QuizLibrary = () => {
  const [sessions, setSessions] = useState<QCMSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchSessions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { data, error } = await supabase
        .from("qcm_sessions")
        .select(`
          *,
          courses (
            id,
            title,
            content,
            file_name
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de charger les QCM", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate, toast]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useRealtimeSubscription({ table: "qcm_sessions", event: "*", onUpdate: fetchSessions });

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from("qcm_sessions").delete().eq("id", sessionId);
      if (error) throw error;
      setSessions(prev => prev.filter(session => session.id !== sessionId));
      toast({ title: "QCM supprimé", description: "Le dossier a été archivé avec succès" });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer le QCM", variant: "destructive" });
    }
  };

  const handleRefresh = async () => { 
    setRefreshing(true); 
    await fetchSessions(); 
    toast({ title: "Bibliothèque synchronisée", description: "Vos QCM sont à jour." }); 
  };

  const handleExportPDF = (session: QCMSession, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const questions = Array.isArray(session.questions) ? session.questions : [];
      exportQuizToPDF({
        title: session.title,
        questions: questions.map((q: any) => ({
          question: q.question || "",
          choices: q.choices || [],
          correct: q.correct || [],
          explanation: q.explanation,
        })),
      });
      toast({ title: "Export réussi", description: "Le document PDF a été généré." });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de générer le PDF", variant: "destructive" });
    }
  };

  const handleExportAllPDF = () => {
    try {
      const quizData = sessions.map(session => ({
        title: session.title,
        questions: Array.isArray(session.questions) ? session.questions.map((q: any) => ({
          question: q.question || "",
          choices: q.choices || [],
          correct: q.correct || [],
          explanation: q.explanation,
        })) : [],
      }));
      exportQuizListToPDF(quizData);
      toast({ title: "Livre généré", description: "L'ensemble de vos QCM a été compilé." });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de compiler le PDF", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#0E0E0C] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-6 w-6 animate-spin text-[#111111] dark:text-white" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Synchronisation...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#0E0E0C] text-[#111111] dark:text-[#F4F4F2] bg-doodle-watermark font-sans">
      <div className="max-w-[1400px] mx-auto px-6 py-12 md:py-20 space-y-16 relative z-10">
        
        {/* LA BANDEROLE ANIMÉE */}
        <AnimatedBanner 
          title="Mes QCM."
          subtitle={`${sessions.length} questionnaire${sessions.length > 1 ? 's' : ''} d'évaluation généré${sessions.length > 1 ? 's' : ''}.`}
          rightWidgets={
            <>
              {sessions.length > 0 && (
                <button 
                  onClick={handleExportAllPDF} 
                  className="h-12 w-12 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all duration-300"
                  title="Exporter le livre"
                >
                  <FileDown className="h-4 w-4" />
                </button>
              )}
              <button 
                onClick={handleRefresh} 
                disabled={refreshing} 
                className="h-12 w-12 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all duration-300"
                aria-label="Actualiser"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button 
                onClick={() => navigate("/add-course")} 
                className="h-12 px-6 rounded-full bg-white text-black transition-all duration-300 font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-white/90 group"
              >
                Nouveau QCM 
                <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </>
          }
        />

        {/* Grille de Contenu */}
        {sessions.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl mx-auto relative z-10"
          >
            <div className="bg-white dark:bg-[#161614] border-2 border-dashed border-black/10 dark:border-white/10 rounded-[2rem] p-20 flex flex-col items-center justify-center text-center transition-colors hover:border-[#5B21B6]/30">
              <div className="w-20 h-20 bg-[#FAFAF8] dark:bg-[#0E0E0C] rounded-full flex items-center justify-center mb-8 border border-black/5 dark:border-white/5">
                <Layers className="h-8 w-8 text-[#111111] dark:text-white" />
              </div>
              <h3 className="text-3xl font-light text-[#111111] dark:text-white mb-4">Bibliothèque vierge</h3>
              <p className="text-base text-[#666666] dark:text-[#8E8E8A] mb-10 max-w-md mx-auto">
                Transformez vos cours en entraînements interactifs et générez vos premiers QCM.
              </p>
              <button 
                onClick={() => navigate("/add-course")} 
                className="px-8 py-4 bg-[#111111] dark:bg-white text-white dark:text-[#111111] rounded-full font-medium hover:bg-[#5B21B6] dark:hover:bg-[#5B21B6] dark:hover:text-white transition-colors duration-200 shadow-xl shadow-black/10 flex items-center gap-2 group"
              >
                Créer mon premier QCM <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid gap-8 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 relative z-10"
          >
            <AnimatePresence>
              {sessions.map((session) => (
                <motion.div
                  key={session.id}
                  variants={itemVariants}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  layout
                >
                  <div 
                    onClick={() => navigate(`/quiz/${session.id}`)}
                    className="group bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2rem] flex flex-col h-[320px] cursor-pointer hover:border-[#5B21B6] hover:shadow-[0_12px_40px_-12px_rgba(91,33,182,0.15)] hover:-translate-y-1 transition-all duration-300 ease-out overflow-hidden relative z-10"
                  >
                    {/* En-tête de la carte */}
                    <div className="p-8 pb-0">
                      <div className="flex items-start justify-between gap-4 mb-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#FAFAF8] dark:bg-[#0E0E0C] border border-black/5 dark:border-white/5 text-[#111111] dark:text-[#F4F4F2] group-hover:bg-[#5B21B6] group-hover:text-white group-hover:border-[#5B21B6] transition-colors duration-300">
                          <Layers className="h-3.5 w-3.5" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">{session.question_count} QCM</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider mt-1">
                          {new Date(session.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      
                      <h2 className="text-2xl font-medium tracking-tight leading-snug line-clamp-2 text-[#111111] dark:text-white mb-4">
                        {session.title}
                      </h2>
                      
                      <div className="text-sm text-[#666666] dark:text-[#8E8E8A] leading-relaxed line-clamp-2 flex items-center gap-2">
                         <FileText className="h-4 w-4 shrink-0" /> 
                         <span className="truncate">{session.courses?.file_name || "Source non spécifiée"}</span>
                      </div>
                    </div>
                    
                    {/* Pied de carte avec ligne pointillée médicale/éditoriale */}
                    <div className="mt-auto p-8 pt-6 border-t border-dashed border-black/10 dark:border-white/10 flex items-center justify-between">
                      
                      <div className="flex gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/exam/${session.id}`); }}
                            className="h-10 px-4 rounded-full bg-[#FAFAF8] dark:bg-[#0E0E0C] text-[#111111] dark:text-[#F4F4F2] text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-[#5B21B6] hover:text-white transition-colors duration-200"
                          >
                            <Timer className="h-3.5 w-3.5" /> Examen
                          </button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => handleExportPDF(session, e)} 
                            className="h-10 w-10 rounded-full bg-[#FAFAF8] dark:bg-[#0E0E0C] text-[#888888] flex items-center justify-center hover:bg-[#111111] dark:hover:bg-white hover:text-white dark:hover:text-[#111111] transition-colors duration-200"
                            title="Exporter le PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={(e) => deleteSession(session.id, e)} 
                            className="h-10 w-10 rounded-full bg-[#FAFAF8] dark:bg-[#0E0E0C] text-[#888888] flex items-center justify-center hover:bg-[#DC2626] hover:text-white transition-colors duration-200"
                            title="Supprimer la session"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                      </div>

                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default QuizLibrary;