import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Eye, BookOpen, FileText, Zap, RefreshCw, Layers, ArrowRight, Download } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedBanner } from "@/components/AnimatedBanner";
import { exportSummaryToPDF } from "@/utils/pdfEngine";
import { exportSummaryToWord } from "@/utils/wordEngine";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Summary { id: string; title: string; summary_type: string; content: string; created_at: string; course_id?: string; }

const typeConfig: Record<string, { icon: React.ElementType; label: string }> = {
  complete: { icon: BookOpen, label: "Complet" },
  structured: { icon: FileText, label: "Structuré" },
  concise: { icon: Zap, label: "Concis" },
};

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

const Summaries = () => {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const fetchSummaries = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      
      const { data, error } = await supabase
        .from("summaries" as any)
        .select("id, title, summary_type, content, created_at, course_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      setSummaries((data as unknown as Summary[]) || []);
    } catch { 
      toast.error("Erreur lors du chargement"); 
    } finally { 
      setLoading(false); 
      setRefreshing(false); 
    }
  }, [navigate]);

  useEffect(() => { fetchSummaries(); }, [fetchSummaries]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from("summaries" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Résumé supprimé");
      setSummaries(prev => prev.filter(summary => summary.id !== id));
    } catch { 
      toast.error("Erreur lors de la suppression"); 
    }
  };

  const handleRefresh = async () => { 
    setRefreshing(true); 
    await fetchSummaries(); 
    toast.success("Actualisé !"); 
  };

  const handleDownload = async (summary: Summary, format: "pdf" | "word", e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (format === "pdf") {
        await exportSummaryToPDF(summary.title, summary.content);
      } else if (format === "word") {
        await exportSummaryToWord(summary.title, summary.content);
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-6 w-6 animate-spin text-[#111111] dark:text-white" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Synchronisation...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-[#111111] dark:text-[#F4F4F2] font-sans">
      <div className="max-w-[1400px] mx-auto px-6 py-12 md:py-20 space-y-16 relative z-10">
        
        {/* LA BANDEROLE ANIMÉE */}
        <AnimatedBanner 
          title="Mes Résumés."
          subtitle={`${summaries.length} résumé${summaries.length > 1 ? 's' : ''} généré${summaries.length > 1 ? 's' : ''} par l'IA.`}
          rightWidgets={
            <>
              <button 
                onClick={handleRefresh} 
                disabled={refreshing} 
                className="h-12 w-12 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all duration-300"
                aria-label="Actualiser"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button 
                onClick={() => navigate("/generate-summary")} 
                className="h-12 px-6 rounded-full bg-white text-black transition-all duration-300 font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-white/90 group"
              >
                Nouveau résumé 
                <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </>
          }
        />

        {/* Grille de Contenu */}
        {summaries.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl mx-auto relative z-10"
          >
            <div className="bg-white dark:bg-[#161614] border-2 border-dashed border-black/10 dark:border-white/10 rounded-[2rem] p-20 flex flex-col items-center justify-center text-center transition-colors hover:border-[#5B21B6]/30">
              <div className="w-20 h-20 bg-transparent rounded-full flex items-center justify-center mb-8 border border-black/5 dark:border-white/5">
                <FileText className="h-8 w-8 text-[#111111] dark:text-white" />
              </div>
              <h3 className="text-3xl font-light text-[#111111] dark:text-white mb-4">Bibliothèque vierge</h3>
              <p className="text-base text-[#666666] dark:text-[#8E8E8A] mb-10 max-w-md mx-auto">
                Transformez vos cours en fiches de révisions intelligentes et générez vos premiers résumés.
              </p>
              <button 
                onClick={() => navigate("/generate-summary")} 
                className="px-8 py-4 bg-[#111111] dark:bg-white text-white dark:text-[#111111] rounded-full font-medium hover:bg-[#5B21B6] dark:hover:bg-[#5B21B6] dark:hover:text-white transition-colors duration-200 shadow-xl shadow-black/10 flex items-center gap-2 group"
              >
                Créer mon premier résumé <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
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
              {summaries.map((summary) => {
                const config = typeConfig[summary.summary_type] || typeConfig.structured;
                const Icon = config.icon;
                
                return (
                  <motion.div
                    key={summary.id}
                    variants={itemVariants}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    layout
                  >
                    <div 
                      onClick={() => navigate(`/summary/${summary.id}`)}
                      className="group bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2rem] flex flex-col h-[320px] cursor-pointer hover:border-[#5B21B6] hover:shadow-[0_12px_40px_-12px_rgba(91,33,182,0.15)] hover:-translate-y-1 transition-all duration-300 ease-out overflow-hidden relative z-10"
                    >
                      {/* En-tête de la carte */}
                      <div className="p-8 pb-0">
                        <div className="flex items-start justify-between gap-4 mb-6">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-transparent border border-black/5 dark:border-white/5 text-[#111111] dark:text-[#F4F4F2] group-hover:bg-[#5B21B6] group-hover:text-white group-hover:border-[#5B21B6] transition-colors duration-300">
                            <Icon className="h-3.5 w-3.5" />
                            <span className="text-[9px] font-bold uppercase tracking-widest">{config.label}</span>
                          </div>
                          <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider mt-1">
                            {new Date(summary.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        
                        <h2 className="text-2xl font-medium tracking-tight leading-snug line-clamp-2 text-[#111111] dark:text-white mb-4">
                          {summary.title}
                        </h2>
                        
                        <p className="text-sm text-[#666666] dark:text-[#8E8E8A] leading-relaxed line-clamp-2 mb-4">
                          {summary.content.substring(0, 100)}...
                        </p>
                      </div>
                      
                      {/* Pied de carte avec ligne pointillée */}
                      <div className="mt-auto p-8 pt-6 border-t border-dashed border-black/10 dark:border-white/10 flex items-center justify-between">
                        
                        <div className="flex gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); navigate(`/summary/${summary.id}`); }}
                              className="h-10 px-4 rounded-full bg-transparent text-[#111111] dark:text-[#F4F4F2] text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-[#5B21B6] hover:text-white transition-colors duration-200"
                            >
                              <Eye className="h-3.5 w-3.5" /> Ouvrir
                            </button>
                            <DropdownMenu>
                              <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                                <DropdownMenuTrigger asChild>
                                  <button 
                                    className="h-10 w-10 rounded-full bg-transparent text-[#888888] flex items-center justify-center hover:bg-[#5B21B6] hover:text-white transition-colors duration-200"
                                    title="Télécharger (PDF)"
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                              </div>
                              <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-[#161614] border-black/10 dark:border-white/10 rounded-xl p-2 shadow-xl">
                                <DropdownMenuItem 
                                  onClick={(e) => handleDownload(summary, "pdf", e)}
                                  className="cursor-pointer text-xs font-bold uppercase tracking-widest text-[#111111] dark:text-white hover:bg-[#5B21B6] hover:text-white rounded-lg p-3 transition-colors"
                                >
                                  Format PDF (.pdf)
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => handleDownload(summary, "word", e)}
                                  className="cursor-pointer text-xs font-bold uppercase tracking-widest text-[#111111] dark:text-white hover:bg-[#5B21B6] hover:text-white rounded-lg p-3 transition-colors mt-1"
                                >
                                  Format Word (.docx)
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => handleDelete(summary.id, e)} 
                              className="h-10 w-10 rounded-full bg-transparent text-[#888888] flex items-center justify-center hover:bg-[#DC2626] hover:text-white transition-colors duration-200"
                              title="Supprimer la session"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
  
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Summaries;
