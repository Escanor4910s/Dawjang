import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, BookOpen, FileText, Zap, Copy, Check, Eye, Code, Network, Info, Lightbulb, Move, MousePointerClick, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import MedicalSummaryCard from "@/components/MedicalSummaryCard";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import CourseMindMap from "@/components/CourseMindMap";
import { motion, AnimatePresence } from "framer-motion";

interface Summary {
  id: string;
  title: string;
  summary_type: string;
  content: string;
  created_at: string;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string; bgColor: string }> = {
  complete: { icon: BookOpen, color: "text-blue-600", label: "Résumé Complet", bgColor: "bg-blue-500/10" },
  structured: { icon: FileText, color: "text-emerald-600", label: "Résumé Structuré", bgColor: "bg-emerald-500/10" },
  concise: { icon: Zap, color: "text-amber-500", label: "Fiche Concise", bgColor: "bg-amber-500/10" },
};

const SummaryView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "text" | "mindmap">("card");
  const [showMindmapGuide, setShowMindmapGuide] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from("summaries")
          .select("id, title, summary_type, content, created_at")
          .eq("id", id)
          .single();
        if (error) throw error;
        setSummary(data as unknown as Summary);
      } catch (error) {
        console.error("Error fetching summary:", error);
        toast.error("Résumé introuvable");
        navigate("/summaries");
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [id, navigate]);

  const handleCopy = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary.content);
    setCopied(true);
    toast.success("Copié dans le presse-papiers");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = async () => {
    if (!summary) return;

    toast.loading("Génération du PDF en cours...", { id: "pdf-toast" });

    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 25;
      const contentW = pageW - margin * 2;
      const footerY = pageH - 12;
      let pageNum = 1;
      let cursorY = margin;

      // ── Helpers ──────────────────────────────────────────────────
      const addPageHeaderFooter = (isFirst: boolean) => {
        // Header line
        pdf.setDrawColor(44, 62, 80);
        pdf.setLineWidth(0.3);
        pdf.line(margin, margin - 5, pageW - margin, margin - 5);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(127, 140, 141);
        if (!isFirst) {
          pdf.text("HIPPOCAMPUS", margin, margin - 7);
          pdf.text(summary.title.substring(0, 60), pageW - margin, margin - 7, { align: "right" });
        }
        // Footer
        pdf.setDrawColor(44, 62, 80);
        pdf.setLineWidth(0.2);
        pdf.line(margin, footerY, pageW - margin, footerY);
        pdf.setFontSize(7);
        pdf.setTextColor(149, 165, 166);
        pdf.text("HIPPOCAMPUS — Faculté de Médecine", margin, footerY + 4);
        pdf.text(`Page ${pageNum}`, pageW - margin, footerY + 4, { align: "right" });
      };

      const ensureSpace = (needed: number) => {
        if (cursorY + needed > footerY - 4) {
          pdf.addPage();
          pageNum++;
          cursorY = margin;
          addPageHeaderFooter(false);
        }
      };

      const wrapAndRender = (
        text: string,
        fontSize: number,
        fontFamily: string,
        fontStyle: string,
        textColor: [number, number, number],
        xOffset: number,
        lineSpacing: number,
        bulletPrefix?: string,
      ) => {
        pdf.setFont(fontFamily, fontStyle);
        pdf.setFontSize(fontSize);
        pdf.setTextColor(...textColor);
        const effectiveW = contentW - xOffset;
        const normalizedText = text.replace(/[\u00A0\u200B\u202F\uFEFF]/g, " ").replace(/\s+/g, " ");
        const lines: string[] = pdf.splitTextToSize(normalizedText, effectiveW);
        for (let li = 0; li < lines.length; li++) {
          ensureSpace(lineSpacing);
          if (li === 0 && bulletPrefix) {
            pdf.setFont("helvetica", "normal");
            pdf.text(bulletPrefix, margin + xOffset - 5, cursorY);
            pdf.setFont(fontFamily, fontStyle);
          }
          pdf.text(lines[li], margin + xOffset, cursorY);
          cursorY += lineSpacing;
        }
      };

      /** Render a line that may contain **bold** segments mixed with normal text. */
      const renderMixedBoldLine = (
        rawText: string,
        fontSize: number,
        fontFamily: string,
        textColor: [number, number, number],
        xOffset: number,
        lineSpacing: number,
        bulletPrefix?: string,
      ) => {
        // Safe robust rendering: avoid character mapping bugs with jsPDF splitTextToSize
        const isFullyBold = rawText.trim().startsWith("**") && rawText.trim().endsWith("**");
        const cleanText = rawText.replace(/\*\*/g, "");
        wrapAndRender(cleanText, fontSize, fontFamily, isFullyBold ? "bold" : "normal", isFullyBold ? [26, 37, 47] : textColor, xOffset, lineSpacing, bulletPrefix);
      };

      // ── First-page Header & Footer ──────────────────────────────
      addPageHeaderFooter(true);

      // ── Elegant Title Block (first page) ────────────────────────
      cursorY = margin + 8;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(127, 140, 141);
      pdf.text("FACULTÉ DE MÉDECINE — NOTE DE SYNTHÈSE", pageW / 2, cursorY, { align: "center" });
      cursorY += 12;

      // Title
      pdf.setFont("times", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(26, 37, 47);
      const titleLines: string[] = pdf.splitTextToSize(summary.title, contentW - 10);
      for (const tl of titleLines) {
        pdf.text(tl, pageW / 2, cursorY, { align: "center" });
        cursorY += 9;
      }
      cursorY += 2;

      // Meta line
      const typeLabel = typeConfig[summary.summary_type]?.label || "Résumé";
      const dateStr = new Date(summary.created_at).toLocaleDateString("fr-FR", { year: "numeric", month: "long" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(52, 73, 94);
      pdf.text(`${typeLabel}  •  ${dateStr}  •  Rév. 1.0`, pageW / 2, cursorY, { align: "center" });
      cursorY += 6;

      // Decorative separator
      pdf.setDrawColor(44, 62, 80);
      pdf.setLineWidth(0.5);
      pdf.line(margin + 30, cursorY, pageW - margin - 30, cursorY);
      cursorY += 12;

      // ── Content Rendering ───────────────────────────────────────
      const lines = summary.content.split("\n");
      const bodyColor: [number, number, number] = [52, 73, 94];
      const headingColor: [number, number, number] = [26, 37, 47];

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        // Empty line → small vertical gap
        if (!trimmed) {
          cursorY += 3;
          continue;
        }

        // ── Main Heading (=== TITLE === or # TITLE) ──
        if (/^===\s*(.+?)\s*===$/.test(trimmed) || /^#\s+(.+)$/.test(trimmed)) {
          const text = trimmed.replace(/^===\s*/, "").replace(/\s*===$/, "").replace(/^#\s+/, "");
          cursorY += 6;
          ensureSpace(14);
          wrapAndRender(text, 20, "times", "bold", headingColor, 0, 8);
          // Underline
          pdf.setDrawColor(52, 73, 94);
          pdf.setLineWidth(0.3);
          pdf.line(margin, cursorY - 2, margin + Math.min(pdf.getTextWidth(text) * 0.6 + 10, contentW), cursorY - 2);
          cursorY += 3;
          continue;
        }

        // ── Subheading (-- TITLE -- or ## TITLE) ──
        if (/^--\s*(.+?)\s*--$/.test(trimmed) || /^##\s+(.+)$/.test(trimmed)) {
          const text = trimmed.replace(/^--\s*/, "").replace(/\s*--$/, "").replace(/^##\s+/, "");
          cursorY += 4;
          ensureSpace(12);
          wrapAndRender(text, 16, "times", "bolditalic", [44, 62, 80], 0, 7);
          cursorY += 2;
          continue;
        }

        // ── Bullet Point (- or *) ──
        if (/^[-*]\s/.test(trimmed)) {
          const text = trimmed.replace(/^[-*]\s/, "");
          ensureSpace(6);
          renderMixedBoldLine(text, 11, "helvetica", bodyColor, 10, 5.5, "•");
          cursorY += 1;
          continue;
        }

        // ── Regular Paragraph ──
        ensureSpace(6);
        renderMixedBoldLine(trimmed, 11, "helvetica", bodyColor, 0, 5.5);
        cursorY += 1.5;
      }

      // ── Save ────────────────────────────────────────────────────
      const cleanFileName = summary.title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_").substring(0, 30);
      pdf.save(`Polycopie_${cleanFileName}.pdf`);
      toast.success("PDF téléchargé avec succès !", { id: "pdf-toast" });
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la génération du PDF.", { id: "pdf-toast" });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-5xl">
        <div className="animate-pulse space-y-6 mt-4">
          <div className="flex gap-4">
            <div className="h-10 w-10 bg-muted rounded-xl" />
            <div className="flex-1 space-y-3">
              <div className="h-8 bg-muted rounded-lg w-1/2" />
              <div className="h-4 bg-muted rounded-lg w-1/4" />
            </div>
          </div>
          <div className="h-[600px] bg-muted/50 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const config = typeConfig[summary.summary_type] || typeConfig.structured;
  const Icon = config.icon;

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-6xl min-h-screen">
      
      {/* ─── HEADER COMMAND BAR ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-4 md:p-6 rounded-[2rem] shadow-sm border border-border/50">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/summaries")} className="flex-shrink-0 h-12 w-12 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 pt-1">
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight leading-tight mb-2">
              {summary.title}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${config.bgColor} ${config.color}`}>
                <Icon className="h-3.5 w-3.5" />
                {config.label}
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-muted-foreground font-medium text-sm">
                Rédigé le {new Date(summary.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto bg-black/5 dark:bg-white/5 p-1.5 rounded-[1.5rem]">
          <Button 
            variant={viewMode === "card" ? "default" : "ghost"} 
            onClick={() => setViewMode("card")}
            className={`flex-1 lg:flex-none h-11 px-4 rounded-xl transition-all ${viewMode === "card" ? "shadow-md bg-white dark:bg-slate-800 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Eye className="h-4 w-4 mr-2" /> Fiche
          </Button>
          <Button 
            variant={viewMode === "text" ? "default" : "ghost"} 
            onClick={() => setViewMode("text")}
            className={`flex-1 lg:flex-none h-11 px-4 rounded-xl transition-all ${viewMode === "text" ? "shadow-md bg-white dark:bg-slate-800 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <FileText className="h-4 w-4 mr-2" /> Texte
          </Button>
          <Button 
            variant={viewMode === "mindmap" ? "default" : "ghost"} 
            onClick={() => setViewMode("mindmap")}
            className={`flex-1 lg:flex-none h-11 px-4 rounded-xl transition-all ${viewMode === "mindmap" ? "shadow-md bg-white dark:bg-slate-800 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Network className="h-4 w-4 mr-2" /> Carte
          </Button>
          
          <div className="w-px h-8 bg-border mx-1 hidden lg:block" />
          
          <Button variant="ghost" size="icon" onClick={handleCopy} className="h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5">
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button onClick={handleDownloadPDF} size="icon" className="h-11 w-11 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ─── CONTENT AREA ─── */}
      <div id="pdf-content-area" className="w-full">
        {viewMode === "card" ? (
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <MedicalSummaryCard
              content={summary.content}
              title={summary.title}
              summaryType={summary.summary_type as "complete" | "structured" | "concise"}
            />
          </motion.div>
          
        ) : viewMode === "mindmap" ? (
          
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="space-y-4">
            
            {/* Mindmap Guide Banner */}
            <AnimatePresence>
              {showMindmapGuide && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: "auto" }} 
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 md:p-5 relative overflow-hidden"
                >
                  <Button 
                    variant="ghost" size="sm" 
                    onClick={() => setShowMindmapGuide(false)}
                    className="absolute top-2 right-2 h-8 px-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                  >
                    Masquer le guide
                  </Button>
                  
                  <div className="flex items-start gap-4">
                    <div className="bg-indigo-500/20 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Lightbulb className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-indigo-900 dark:text-indigo-200 mb-1">Mode d'emploi de la Carte Mentale</h3>
                      <p className="text-indigo-800/70 dark:text-indigo-300/70 text-sm mb-4">Gérez vos idées visuellement avec des interactions simples :</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2.5 text-sm font-medium text-indigo-900/80 dark:text-indigo-200/80 bg-white/40 dark:bg-black/20 p-2.5 rounded-xl border border-indigo-500/10">
                          <Move className="h-4 w-4 text-indigo-500 shrink-0" />
                          <span>Glissez pour déplacer l'espace</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm font-medium text-indigo-900/80 dark:text-indigo-200/80 bg-white/40 dark:bg-black/20 p-2.5 rounded-xl border border-indigo-500/10">
                          <MousePointerClick className="h-4 w-4 text-indigo-500 shrink-0" />
                          <span>Double-clic pour modifier</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm font-medium text-indigo-900/80 dark:text-indigo-200/80 bg-white/40 dark:bg-black/20 p-2.5 rounded-xl border border-indigo-500/10">
                          <Plus className="h-4 w-4 text-indigo-500 shrink-0" />
                          <span>Bouton + pour ajouter un nœud</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm font-medium text-indigo-900/80 dark:text-indigo-200/80 bg-white/40 dark:bg-black/20 p-2.5 rounded-xl border border-indigo-500/10">
                          <Trash2 className="h-4 w-4 text-rose-500 shrink-0" />
                          <span>Touche Suppr pour effacer</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="rounded-[2rem] overflow-hidden border border-border/50 shadow-2xl bg-white dark:bg-slate-950">
              <CourseMindMap content={summary.content} title={summary.title} />
            </div>
          </motion.div>

        ) : (
          
          /* ─── HIGH-END TEXT VIEW (Academic/Professorial Style) ─── */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="bg-[#FCFBF8] dark:bg-[#0D1117] text-[#2c3e50] dark:text-[#C9D1D9] max-w-[850px] mx-auto p-10 sm:p-16 lg:p-24 shadow-2xl rounded-[2rem] border border-[#EBE8DF] dark:border-white/10 print:shadow-none print:border-none relative overflow-hidden">
              
              {/* Paper texture overlay */}
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.015] dark:opacity-[0.03] mix-blend-overlay pointer-events-none" />
              
              {/* Elegant header */}
              <div className="border-b-[1.5px] border-[#2c3e50]/20 dark:border-white/20 pb-10 mb-12 text-center relative z-10">
                <div className="w-16 h-16 mx-auto mb-6 opacity-20 dark:opacity-30">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  </svg>
                </div>
                
                <h4 className="text-[11px] font-bold tracking-[0.3em] text-[#7f8c8d] dark:text-[#8b949e] uppercase mb-5">
                  Faculté de Médecine — Note de Synthèse
                </h4>
                
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif leading-[1.15] text-[#1a252f] dark:text-white mb-6">
                  {summary.title}
                </h1>
                
                <div className="flex items-center justify-center gap-4 text-xs font-medium uppercase tracking-[0.15em] text-[#34495e]/80 dark:text-[#8b949e]">
                  <span>{typeConfig[summary.summary_type]?.label || "Résumé"}</span>
                  <span>•</span>
                  <span>{new Date(summary.created_at).toLocaleDateString("fr-FR", { year: "numeric", month: "long" })}</span>
                  <span>•</span>
                  <span>Rév. 1.0</span>
                </div>
              </div>
              
              {/* Refined Academic Content Typography */}
              <div className="font-serif text-[16px] sm:text-[17px] leading-[1.85] text-[#34495e] dark:text-[#C9D1D9] space-y-5 relative z-10">
                {summary.content.split("\n").map((line, i) => {
                  const trimmed = line.trim();
                  if (!trimmed) return <div key={i} className="h-3" />;
                  
                  // Main Title (=== TITRE === or # TITRE)
                  if (/^===\s*(.+?)\s*===$/.test(trimmed) || /^#\s+(.+)$/.test(trimmed)) {
                    const text = trimmed.replace(/^===\s*/, "").replace(/\s*===$/, "").replace(/^#\s+/, "");
                    return (
                      <h2 key={i} className="text-2xl font-bold text-[#1a252f] dark:text-white mt-14 mb-6 pb-3 border-b border-[#EBE8DF] dark:border-white/10 font-serif tracking-tight">
                        {text}
                      </h2>
                    );
                  }
                  
                  // Subtitle (-- TITRE -- or ## TITRE)
                  if (/^--\s*(.+?)\s*--$/.test(trimmed) || /^##\s+(.+)$/.test(trimmed)) {
                    const text = trimmed.replace(/^--\s*/, "").replace(/\s*--$/, "").replace(/^##\s+/, "");
                    return (
                      <h3 key={i} className="text-xl font-semibold text-[#2c3e50] dark:text-gray-200 mt-10 mb-4 font-serif italic">
                        {text}
                      </h3>
                    );
                  }
                  
                  // Bullet Points
                  if (/^[\-\*]\s/.test(trimmed)) {
                    const text = trimmed.replace(/^[\-\*]\s/, "");
                    const formattedText = text.replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-[#1a252f] dark:text-white'>$1</strong>").replace(/__(.*?)__/g, "<strong>$1</strong>");
                    return (
                      <div key={i} className="flex gap-4 my-2.5 pl-6 relative">
                        <span className="absolute left-1 top-[0.6em] w-1.5 h-1.5 rounded-full bg-[#3498db]/70 dark:bg-[#58a6ff]/70" />
                        <span dangerouslySetInnerHTML={{ __html: formattedText }} className="text-justify" />
                      </div>
                    );
                  }
                  
                  // Paragraph formatting (handling **bold**)
                  const formattedText = trimmed.replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-[#1a252f] dark:text-white'>$1</strong>").replace(/__(.*?)__/g, "<strong>$1</strong>");
                  
                  return (
                    <p key={i} className="my-4 text-justify font-serif" dangerouslySetInnerHTML={{ __html: formattedText }} />
                  );
                })}
              </div>
            </div>
          </motion.div>

        )}
      </div>
    </div>
  );
};

export default SummaryView;
