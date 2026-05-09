import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, BookOpen, FileText, Zap, Copy, Check, Eye, Code } from "lucide-react";
import { toast } from "sonner";
import MedicalSummaryCard from "@/components/MedicalSummaryCard";
import jsPDF from "jspdf";

interface Summary {
  id: string;
  title: string;
  summary_type: string;
  content: string;
  created_at: string;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string; bgColor: string }> = {
  complete: { icon: BookOpen, color: "text-blue-500", label: "Resume Complet", bgColor: "bg-blue-500/10" },
  structured: { icon: FileText, color: "text-green-500", label: "Resume Structure", bgColor: "bg-green-500/10" },
  concise: { icon: Zap, color: "text-orange-500", label: "Resume Concis", bgColor: "bg-orange-500/10" },
};

// Clean text for PDF - remove emojis and special chars that jsPDF can't render
const cleanForPDF = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/[\u{1F600}-\u{1F9FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FEFF}]/gu, "")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[✓→•📌📚🔬💊🫀🧠📋📊⚖️⚠️💡🛡️🎯🩺🧬]/g, "")
    .replace(/[^\x00-\x7F\xC0-\xFF\u0100-\u017F]/g, "") // keep only latin chars
    .trim();
};

const SummaryView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "text">("card");

  useEffect(() => {
    const fetchSummary = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from("summaries" as any)
          .select("id, title, summary_type, content, created_at")
          .eq("id", id)
          .single();
        if (error) throw error;
        setSummary(data as unknown as Summary);
      } catch (error) {
        console.error("Error fetching summary:", error);
        toast.error("Resume non trouve");
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
    toast.success("Copie dans le presse-papiers");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = () => {
    if (!summary) return;
    
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 18;
    const contentWidth = pageWidth - 2 * margin;
    let yPos = margin;
    let pageNum = 1;

    const addFooter = () => {
      pdf.setFontSize(7);
      pdf.setTextColor(180, 170, 160);
      pdf.setFont("helvetica", "italic");
      pdf.text("HIPPOCAMPUS", pageWidth / 2, pageHeight - 8, { align: "center" });
      pdf.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    };

    const checkPageBreak = (neededHeight: number) => {
      if (yPos + neededHeight > pageHeight - 20) {
        addFooter();
        pdf.addPage();
        pageNum++;
        yPos = margin;
      }
    };
    
    // Header
    pdf.setFillColor(45, 42, 38);
    pdf.rect(0, 0, pageWidth, 42, "F");
    
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    const titleText = cleanForPDF(summary.title).toUpperCase();
    const titleLines = pdf.splitTextToSize(titleText, contentWidth - 10);
    const titleStartY = titleLines.length > 1 ? 16 : 20;
    titleLines.forEach((line: string, idx: number) => {
      pdf.text(line, pageWidth / 2, titleStartY + idx * 7, { align: "center" });
    });
    
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    const typeLabel = typeConfig[summary.summary_type]?.label || "Resume";
    pdf.text(`Fiche de revision - ${typeLabel}`, pageWidth / 2, 36, { align: "center" });
    
    yPos = 52;

    // Parse and render content line by line with proper font handling
    const lines = summary.content.split("\n");
    
    lines.forEach((rawLine) => {
      const line = cleanForPDF(rawLine);
      if (!line) {
        yPos += 3; // empty line spacing
        return;
      }

      // Detect section headers
      const isSectionHeader = /^===\s*(.+?)\s*===/.test(rawLine) || /^--\s*(.+?)\s*--/.test(rawLine);
      const headerMatch = rawLine.match(/^===\s*(.+?)\s*===/) || rawLine.match(/^--\s*(.+?)\s*--/);
      
      if (isSectionHeader && headerMatch) {
        const headerText = cleanForPDF(headerMatch[1]);
        checkPageBreak(18);
        
        // Section header bar
        pdf.setFillColor(45, 42, 38);
        pdf.roundedRect(margin, yPos, contentWidth, 10, 1.5, 1.5, "F");
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.text(headerText, margin + 6, yPos + 7);
        yPos += 14;
        return;
      }

      // Detect bullet points
      const isBullet = /^[\-\*]\s/.test(line) || /^[0-9]+[\.\)]\s/.test(line);
      
      checkPageBreak(8);
      
      if (isBullet) {
        pdf.setFontSize(9);
        pdf.setTextColor(40, 40, 40);
        pdf.setFont("helvetica", "normal");
        const bulletText = line.replace(/^[\-\*]\s/, "- ").replace(/^([0-9]+[\.\)])\s/, "$1 ");
        const wrapped = pdf.splitTextToSize(bulletText, contentWidth - 10);
        wrapped.forEach((wl: string) => {
          checkPageBreak(5);
          pdf.text(wl, margin + 6, yPos);
          yPos += 4.5;
        });
        yPos += 1;
      } else {
        // Regular text
        pdf.setFontSize(9);
        pdf.setTextColor(40, 40, 40);
        pdf.setFont("helvetica", "normal");
        const wrapped = pdf.splitTextToSize(line, contentWidth - 4);
        wrapped.forEach((wl: string) => {
          checkPageBreak(5);
          pdf.text(wl, margin + 2, yPos);
          yPos += 4.5;
        });
        yPos += 1.5;
      }
    });

    addFooter();

    const cleanFileName = cleanForPDF(summary.title)
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 30);
    pdf.save(`Resume_${cleanFileName}.pdf`);
    toast.success("PDF telecharge !");
  };

  const handleDownloadText = () => {
    if (!summary) return;
    const blob = new Blob([summary.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${summary.title.replace(/[^a-z0-9]/gi, "_")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Resume telecharge");
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-muted rounded-lg w-1/3"></div>
          <div className="h-96 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const config = typeConfig[summary.summary_type] || typeConfig.structured;
  const Icon = config.icon;

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-5xl">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-start gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/summaries")} className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground break-words">{summary.title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`flex items-center gap-1 text-xs sm:text-sm ${config.color}`}>
                <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                {config.label}
              </span>
              <span className="text-muted-foreground text-xs sm:text-sm">•</span>
              <span className="text-muted-foreground text-xs sm:text-sm">
                {new Date(summary.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full">
          <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "card" ? "text" : "card")}
            className="flex-1 sm:flex-none h-8 text-xs sm:text-sm">
            {viewMode === "card" ? <Code className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" /> : <Eye className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />}
            <span className="ml-1">{viewMode === "card" ? "Texte" : "Fiche"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} className="flex-1 sm:flex-none h-8 text-xs sm:text-sm">
            {copied ? <Check className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" /> : <Copy className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />}
            <span className="ml-1">{copied ? "Copie" : "Copier"}</span>
          </Button>
          <Button onClick={handleDownloadPDF} size="sm" className="shadow-medical flex-1 sm:flex-none h-8 text-xs sm:text-sm">
            <Download className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
            <span className="ml-1">PDF</span>
          </Button>
        </div>
      </div>

      {viewMode === "card" ? (
        <MedicalSummaryCard
          content={summary.content}
          title={summary.title}
          summaryType={summary.summary_type as "complete" | "structured" | "concise"}
        />
      ) : (
        <Card className={`bg-gradient-card shadow-card border-l-4 ${config.color.replace("text-", "border-")}`}>
          <CardHeader className={`${config.bgColor} rounded-t-lg`}>
            <CardTitle className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${config.color}`} />
              <span>Contenu du resume</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                {summary.content}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4">
        <Button variant="outline" onClick={() => navigate("/summaries")} className="w-full sm:w-auto text-sm">
          Retour aux resumes
        </Button>
        <Button onClick={() => navigate("/generate-summary")} className="shadow-medical w-full sm:w-auto text-sm">
          Generer un autre resume
        </Button>
      </div>
    </div>
  );
};

export default SummaryView;
