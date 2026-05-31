import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, BookOpen, FileText, Zap, Copy, Check, Eye, Network, Shield, ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import CourseMindMap from "@/components/CourseMindMap";
import { motion, AnimatePresence } from "framer-motion";
import GlowCard from "@/components/GlowCard";

// --- Types ---
interface Summary {
  id: string;
  title: string;
  summary_type: string;
  content: string;
  created_at: string;
}

const typeConfig: Record<string, { icon: React.ElementType; label: string }> = {
  complete: { icon: BookOpen, label: "Polycopié Complet" },
  structured: { icon: FileText, label: "Résumé Structuré" },
  concise: { icon: Zap, label: "Fiche Concise" },
};

// --- Moteur de Parsing (Transformer le texte en blocs) ---
const parseSummaryToChunks = (text: string) => {
  const chunks: { title: string; content: string[]; illustrationPrompt?: string }[] = [];
  let currentChunk = { title: "Introduction Clinique", content: [] as string[], illustrationPrompt: undefined as string | undefined };
  
  const lines = text.split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Check for illustration prompt
    const illustrationMatch = trimmed.match(/^\[ILLUSTRATION:\s*(.+?)\]$/i);
    if (illustrationMatch) {
      currentChunk.illustrationPrompt = illustrationMatch[1];
      return; // Do not add to content
    }

    if (/^#/.test(trimmed) || /^===/.test(trimmed) || /^--/.test(trimmed)) {
      if (currentChunk.content.length > 0 || currentChunk.title !== "Introduction Clinique") {
        chunks.push({ ...currentChunk });
      }
      currentChunk = { title: trimmed.replace(/^[#=\-\s]+|[=\-\s]+$/g, ''), content: [], illustrationPrompt: undefined };
    } else {
      currentChunk.content.push(trimmed);
    }
  });
  if (currentChunk.content.length > 0) chunks.push(currentChunk);
  return chunks;
};

// --- Rendu Typographique Fait Main ---
const renderFormattedText = (text: string, isFirstParagraph = false) => {
  if (/^[\-\*]\s/.test(text)) {
    const cleanText = text.replace(/^[\-\*]\s/, "");
    const formatted = cleanText.replace(/\*\*(.*?)\*\*/g, "<strong class='font-black text-[#111111]'>$1</strong>");
    return (
      <div className="flex gap-4 mb-4 pl-4 relative">
        <span className="absolute left-0 top-[0.4em] w-1.5 h-1.5 rounded-full bg-[#5B21B6] print:bg-black" />
        <span dangerouslySetInnerHTML={{ __html: formatted }} className="text-justify leading-relaxed text-[#111111]" />
      </div>
    );
  }
  
  const formatted = text.replace(/\*\*(.*?)\*\*/g, "<strong class='font-black text-[#111111]'>$1</strong>");
  
  // Effet de Lettrine (Drop Cap) pour le tout premier paragraphe du document
  if (isFirstParagraph) {
    return (
      <p className="mb-6 text-justify leading-[1.9] first-letter:float-left first-letter:text-6xl first-letter:font-serif first-letter:font-black first-letter:pr-3 first-letter:text-[#5B21B6] print:first-letter:text-black text-[#111111]" dangerouslySetInnerHTML={{ __html: formatted }} />
    );
  }

  return <p className="mb-6 text-justify leading-[1.9] text-[#111111]" dangerouslySetInnerHTML={{ __html: formatted }} />;
};


export const SummaryView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"text" | "card" | "mindmap">("text");

  // État pour les images générées par Nano Banana (Puter)
  const [illustrations, setIllustrations] = useState<{ [key: number]: string }>({});
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const { data, error } = await supabase.from("summaries").select("*").eq("id", id).single();
        if (error) throw error;
        setSummary(data);
      } catch (error) {
        toast.error("Résumé introuvable");
        navigate("/summaries");
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [id, navigate]);

  const chunks = useMemo(() => summary ? parseSummaryToChunks(summary.content) : [], [summary]);

  // --- MOTEUR DE GÉNÉRATION D'IMAGES (NANO BANANA PRO) ---
  useEffect(() => {
    const generateIllustrations = async () => {
      // On ne génère que si Puter est disponible, qu'on a un résumé, et pas encore d'images générées pour ce run
      if (summary && (window as any).puter && !isGeneratingImages) {
        
        // Find chunks that need illustrations but don't have them yet
        const needsCover = !illustrations[0];
        const chunksToIllustrate = chunks.filter((chunk, idx) => chunk.illustrationPrompt && !illustrations[idx]);
        
        if (needsCover || chunksToIllustrate.length > 0) {
          setIsGeneratingImages(true);
          toast.info("L'Agent MOR dessine vos schémas cliniques...", { id: "img-gen" });
          
          try {
            const newIllustrations = { ...illustrations };
            
            // 1. Image de couverture
            if (needsCover) {
              const coverPrompt = `A vintage, highly detailed medical textbook illustration of ${summary.title}, clean white background, educational schematic, 8k resolution, anatomical accuracy`;
              const coverImg = await (window as any).puter.ai.txt2img(coverPrompt, { model: "gemini-3.1-flash-image-preview" });
              newIllustrations[0] = coverImg.src;
              setIllustrations({ ...newIllustrations });
            }

            // 2. Images contextuelles (Synergie)
            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i];
              if (chunk.illustrationPrompt && !newIllustrations[i]) {
                // Generate base image
                const basePrompt = `${chunk.illustrationPrompt}, highly detailed medical illustration, educational schematic, clean white background, 8k resolution`;
                const baseImg = await (window as any).puter.ai.txt2img(basePrompt, { model: "gemini-3.1-flash-image-preview" });
                
                // Synergistic Refinement
                let base64Image = baseImg.src;
                if (base64Image.includes("base64,")) {
                    base64Image = base64Image.split("base64,")[1];
                }
                const refinePrompt = `Enhance this medical illustration to 8k resolution, photorealistic clinical quality, sharp lines, highly professional textbook style`;
                const finalImg = await (window as any).puter.ai.txt2img(refinePrompt, {
                    model: "gemini-2.5-flash-image-preview",
                    input_image: base64Image,
                    input_image_mime_type: "image/png"
                });

                newIllustrations[i] = finalImg.src;
                setIllustrations({ ...newIllustrations });
              }
            }

            toast.success("Illustrations cliniques générées !", { id: "img-gen" });
          } catch (err) {
            console.error("Erreur Nano Banana:", err);
            toast.dismiss("img-gen");
          } finally {
            setIsGeneratingImages(false);
          }
        }
      }
    };

    generateIllustrations();
  }, [summary, chunks]);

  // --- MOTEUR D'EXPORT PDF (Natif Vectoriel via @media print) ---
  const handleDownloadPDF = () => {
    if (viewMode !== "text") {
      setViewMode("text");
      setTimeout(() => window.print(), 500);
    } else {
      window.print();
    }
  };

  const handleCopy = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary.content);
    setCopied(true);
    toast.success("Texte copié");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="min-h-screen bg-transparent flex items-center justify-center animate-pulse"><BookOpen className="h-10 w-10 text-white" /></div>;
  if (!summary) return null;

  const config = typeConfig[summary.summary_type] || typeConfig.structured;

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#0E0E0C] text-[#111111] dark:text-[#F4F4F2] bg-doodle-watermark font-sans relative overflow-hidden transition-colors duration-500">
      
      <style dangerouslySetInnerHTML={{__html: `
        /* Ombre Éditoriale */
        .editorial-shadow { box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 4px 12px -2px rgba(0,0,0,0.05); }
        
        /* Grille Fiches */
        .masonry-grid { column-count: 1; column-gap: 1.5rem; }
        @media (min-width: 768px) { .masonry-grid { column-count: 2; } }

        /* Shimmer Loader pour images */
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite linear;
        }

        /* --- STYLES D'IMPRESSION (PDF) --- */
        @media print {
          @page { size: A4; margin: 20mm 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
          .print\\:hidden { display: none !important; }
          .editorial-shadow { box-shadow: none !important; border: none !important; }
          #academic-print-area { max-width: 100% !important; padding: 0 !important; margin: 0 !important; background: white !important; }
          .break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
          .page-break-before { page-break-before: always; }
          h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
          img { max-width: 100% !important; page-break-inside: avoid; }
          * { color: black !important; }
        }
      `}} />

      {/* ─── LE BANDEAU DE CONTRÔLE (Design Ambre Éditorial) ─── */}
      <div className="px-6 pt-8 pb-12 mb-8 relative z-10 max-w-[1000px] mx-auto">
        <div className="bg-gradient-to-br from-[#D97706]/90 via-[#C2410C]/90 to-[#9A3412]/90 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-lg print:hidden overflow-hidden relative">
          <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.25] mix-blend-overlay pointer-events-none" />
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
            
            <div className="text-center md:text-left space-y-2">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
                {config.label}
              </h2>
              <h1 className="text-3xl md:text-4xl font-serif font-black text-white tracking-tight drop-shadow-sm">
                {summary.title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Sélecteur de vue (Frosted Glass) */}
              <div className="flex bg-black/30 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-inner">
                {[
                  { id: "text", label: "Manuscrit" },
                  { id: "card", label: "Fiches" },
                  { id: "mindmap", label: "Carte" }
                ].map((mode) => (
                  <button 
                    key={mode.id}
                    onClick={() => setViewMode(mode.id as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 outline-none relative ${
                      viewMode === mode.id ? "bg-white text-[#111111] shadow-sm" : "text-white/80 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              <button onClick={handleDownloadPDF} className="h-11 px-5 rounded-2xl bg-white text-[#111111] border border-white/20 flex items-center gap-2 hover:scale-105 transition-all duration-300 shadow-[0_10px_20px_rgba(0,0,0,0.2)] font-black text-xs uppercase tracking-wider">
                <Download className="h-4 w-4" /> Éditer PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ZONE DE LECTURE ─── */}
      <div className="max-w-[1400px] mx-auto px-6 relative z-10 min-h-[600px] pb-20">
        
        <div className="w-full">
          <AnimatePresence mode="wait">
            
            {/* =========================================================
                1. MODE TEXTE : LE MANUSCRIT (Avec Images Contextuelles)
                ========================================================= */}
            {viewMode === "text" && (
              <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="bg-white max-w-[850px] mx-auto p-10 sm:p-16 editorial-shadow rounded-none sm:rounded-[2.5rem] relative" id="academic-print-area">
                  {/* En-tête du Document */}
                  <div className="border-b-[1.5px] border-[#111111] pb-10 mb-14 text-center relative z-10 break-inside-avoid">
                    <div className="w-12 h-12 mx-auto mb-6 bg-black/5 rounded-full flex items-center justify-center border border-black/10 shadow-sm print:hidden">
                      <Shield className="h-5 w-5 text-[#111111]" />
                    </div>
                    <h4 className="text-[10px] font-black tracking-[0.3em] text-[#888888] uppercase mb-5">
                      Éditions Médicales — Note de Synthèse
                    </h4>
                    <h1 className="text-4xl sm:text-5xl font-serif text-[#111111] leading-[1.15] tracking-tight">
                      {summary.title}
                    </h1>
                  </div>

                  {/* Corps Typographique Fait Main */}
                  <div className="font-serif text-[#111111] relative z-10">
                    
                    {/* Cover Image (if generated) */}
                    {illustrations[0] && (
                       <div className="my-10 flex flex-col items-center break-inside-avoid">
                         <div className="p-2 bg-white border border-black/10 shadow-lg inline-block print:border-none print:shadow-none">
                           <img 
                             src={illustrations[0]} 
                             alt="Illustration de couverture" 
                             className="max-h-[400px] w-auto object-contain"
                           />
                         </div>
                         <p className="text-[10px] font-sans font-bold text-[#888888] uppercase tracking-widest mt-4 flex items-center gap-1.5">
                           <ImageIcon className="h-3 w-3" /> Fig 1. — Illustration Générale
                         </p>
                       </div>
                    )}

                    {chunks.map((chunk, idx) => (
                      <div key={idx} id={`section-${idx}`} className={`mb-16 ${idx > 0 && chunk.title.length < 30 ? 'page-break-before' : ''}`}>
                        
                        <h2 className="text-2xl font-sans font-black text-[#111111] mb-8 pb-2 border-b-2 border-black/[0.05] uppercase tracking-tight break-after-avoid">
                          {idx + 1}. {chunk.title}
                        </h2>

                        {/* Intégration Dynamique de l'Image Contextuelle si demandée */}
                        {chunk.illustrationPrompt && (
                          <div className="my-10 flex flex-col items-center break-inside-avoid">
                            {illustrations[idx] ? (
                              <>
                                <div className="p-3 bg-white border border-black/10 shadow-md rounded-xl inline-block print:border-none print:shadow-none print:p-0">
                                  <img 
                                    src={illustrations[idx]} 
                                    alt={`Illustration pour ${chunk.title}`} 
                                    className="max-h-[350px] w-auto rounded-lg object-contain"
                                  />
                                </div>
                                <p className="text-[10px] font-sans font-bold text-[#888888] uppercase tracking-widest mt-3 flex items-center gap-1.5">
                                  <ImageIcon className="h-3 w-3" /> Fig {idx + 2}. — Modélisation Synaptik-1
                                </p>
                              </>
                            ) : (
                              <div className="w-full max-w-[400px] h-[250px] bg-black/5 rounded-xl border border-black/10 relative overflow-hidden flex flex-col items-center justify-center print:hidden">
                                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                                <Sparkles className="h-6 w-6 text-[#5B21B6]/50 mb-3" />
                                <p className="text-[10px] font-sans font-black uppercase tracking-widest text-[#888888]">Génération de l'image clinique...</p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="text-[16px] sm:text-[17px]">
                          {chunk.content.map((text, i) => (
                            <div key={i}>{renderFormattedText(text, idx === 0 && i === 0 && !illustrations[0] && !chunk.illustrationPrompt)}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* =========================================================
                2. MODE FICHES : LA GRILLE NEO-BRUTALISTE (Inspiration Canva)
                ========================================================= */}
            {viewMode === "card" && (
              <motion.div key="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="masonry-grid">
                  {chunks.map((chunk, idx) => (
                    <div key={idx} className="break-inside-avoid mb-6 bg-white border-2 border-[#111111] rounded-xl overflow-hidden shadow-[6px_6px_0px_rgba(17,17,17,1)] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_rgba(17,17,17,1)] transition-all duration-300">
                      
                      {/* L'image de couverture s'il y en a une sur la fiche */}
                      {illustrations[idx] && (
                        <div className="w-full h-48 bg-gray-100 border-b-2 border-[#111111] overflow-hidden">
                          <img src={illustrations[idx]} className="w-full h-full object-cover" alt="Illu" />
                        </div>
                      )}

                      <div className="bg-[#FFD166] px-5 py-4 border-b-2 border-[#111111] flex items-center justify-center text-center">
                        <h4 className="text-xs font-black uppercase tracking-wider text-[#111111]">
                          {idx + 1}. {chunk.title}
                        </h4>
                      </div>
                      
                      <div className="p-6 text-sm text-[#111111] font-medium leading-relaxed bg-[#FAFAF8]">
                        {chunk.content.map((text, i) => {
                          if (/^[\-\*]\s/.test(text)) {
                            const clean = text.replace(/^[\-\*]\s/, "");
                            const formatted = clean.replace(/\*\*(.*?)\*\*/g, "<strong class='font-black'>$1</strong>");
                            return (
                              <div key={i} className="flex gap-3 mb-3 pl-2">
                                <span className="text-xl leading-none mt-[-2px] text-[#5B21B6]">•</span>
                                <span dangerouslySetInnerHTML={{ __html: formatted }} className="text-justify" />
                              </div>
                            );
                          }
                          const formatted = text.replace(/\*\*(.*?)\*\*/g, "<strong class='font-black'>$1</strong>");
                          return <p key={i} className="mb-4 text-justify" dangerouslySetInnerHTML={{ __html: formatted }} />;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* =========================================================
                3. MODE CARTE (Mindmap)
                ========================================================= */}
            {viewMode === "mindmap" && (
              <motion.div key="mindmap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <GlowCard innerClassName="bg-white min-h-[650px] overflow-hidden p-0 border-2 border-[#111111] shadow-[8px_8px_0px_rgba(17,17,17,1)]">
                  <CourseMindMap content={summary.content} title={summary.title} />
                </GlowCard>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default SummaryView;
