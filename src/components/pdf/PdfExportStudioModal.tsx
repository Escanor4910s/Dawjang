import React, { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Printer,
  FileText,
  Sparkles,
  Check,
  BookOpen,
  Layers,
  Stamp,
  Palette,
  Type,
  FileSpreadsheet,
} from "lucide-react";
import {
  PDF_THEMES,
  PdfFontMode,
  PdfThemeKey,
  parseMedicalDocumentToSections,
  sanitizePdfText,
} from "@/utils/MedicalDocumentPDF";
import { exportSummaryToPDF } from "@/utils/pdfEngine";
import { exportQuizToPDF } from "@/utils/pdfExport";
import { exportSummaryToWord } from "@/utils/wordEngine";
import { exportArgonSummaryToPDF } from "@/utils/argonPdfExport";
import type { QuizData } from "@/utils/QuizPDF";
import { getSavedStudentProfile } from "@/pages/Settings";
import { cn } from "@/lib/utils";

export interface PdfExportStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "summary" | "quiz";
  title: string;
  subject?: string;
  // Pour mode === "summary"
  htmlOrMarkdownContent?: string;
  resolutionLabel?: string;
  architectureLabel?: string;
  // Pour mode === "quiz"
  quizData?: QuizData;
}

export const PdfExportStudioModal: React.FC<PdfExportStudioModalProps> = ({
  open,
  onOpenChange,
  mode,
  title,
  subject = "Médecine & Sciences Cliniques",
  htmlOrMarkdownContent = "",
  resolutionLabel = "Calibrage Standard",
  architectureLabel = "Édition Structurée",
  quizData,
}) => {
  const [theme, setTheme] = useState<PdfThemeKey>("dawjang");
  const [fontMode, setFontMode] = useState<PdfFontMode>("serif");
  const [includeToc, setIncludeToc] = useState<boolean>(true);
  const [includeRevisionBox, setIncludeRevisionBox] = useState<boolean>(true);
  const [includeAnswerGrid, setIncludeAnswerGrid] = useState<boolean>(true);
  const [includeAnswerKey, setIncludeAnswerKey] = useState<boolean>(true);
  const [authorName, setAuthorName] = useState<string>("Édition Magistrale DawJang");
  const [facultyName, setFacultyName] = useState<string>(
    "Faculté de Médecine • Cursus Hospitalo-Universitaire"
  );
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingWord, setIsExportingWord] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      try {
        const profile = getSavedStudentProfile();
        if (profile?.fullName) setAuthorName(profile.fullName);
        if (profile?.faculty) {
          setFacultyName(
            `${profile.faculty}${profile.studyLevel ? ` • ${profile.studyLevel}` : ""}`
          );
        }
      } catch {
        // Garde les valeurs par défaut
      }
    }
  }, [open]);

  const palette = PDF_THEMES[theme] || PDF_THEMES.dawjang;

  const parsedSections = useMemo(() => {
    if (mode !== "summary") return [];
    return parseMedicalDocumentToSections(htmlOrMarkdownContent);
  }, [mode, htmlOrMarkdownContent]);

  const estimatedReadingMin = useMemo(() => {
    if (mode === "quiz" && quizData) {
      return Math.max(5, Math.round(quizData.questions.length * 1.5));
    }
    const words = sanitizePdfText(htmlOrMarkdownContent.replace(/<[^>]+>/g, " "))
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(2, Math.round(words / 190));
  }, [mode, htmlOrMarkdownContent, quizData]);

  const refCode = useMemo(() => {
    const clean = sanitizePdfText(title || "Document");
    return `DWJ-${new Date().getFullYear()}-${String(
      (clean.length * 37 + (parsedSections.length || 5) * 13) % 9000 + 1000
    )}`;
  }, [title, parsedSections.length]);

  const formattedDate = useMemo(
    () =>
      new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    []
  );

  const handleDownloadVectorPdf = async () => {
    setIsExportingPdf(true);
    try {
      if (mode === "summary") {
        const isArgon =
          architectureLabel?.toLowerCase().includes("argon") ||
          architectureLabel?.toLowerCase().includes("audit") ||
          htmlOrMarkdownContent.includes("PROTOCOLE ARGON") ||
          htmlOrMarkdownContent.includes("VOLET 1") ||
          htmlOrMarkdownContent.includes("VOLET 2");

        if (isArgon) {
          exportArgonSummaryToPDF({
            title,
            content: htmlOrMarkdownContent,
            summaryType: "objectives_audit",
            createdAt: new Date().toISOString(),
          });
        } else {
          await exportSummaryToPDF(title, htmlOrMarkdownContent, {
            subject,
            type: "Monographie de Synthèse",
            resolutionLabel,
            architectureLabel,
            authorName,
            facultyName,
            theme,
            fontMode,
            includeToc,
            includeRevisionBox,
          });
        }
      } else if (mode === "quiz" && quizData) {
        await exportQuizToPDF(quizData, {
          theme,
          fontMode,
          includeAnswerGrid,
          includeAnswerKey,
          authorName,
          facultyName,
        });
      }
      onOpenChange(false);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadWord = async () => {
    if (mode !== "summary") return;
    setIsExportingWord(true);
    try {
      const plainOrMd = htmlOrMarkdownContent
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n")
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n")
        .replace(/<li[^>]*>(.*?)<\/li>/gi, "\n- $1")
        .replace(/<p[^>]*>(.*?)<\/p>/gi, "\n$1\n")
        .replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, "**$2**")
        .replace(/<[^>]+>/g, "");
      await exportSummaryToWord(title, plainOrMd);
    } finally {
      setIsExportingWord(false);
    }
  };

  const handlePrintA4 = () => {
    const printWin = window.open("", "_blank", "width=960,height=800");
    if (!printWin) return;

    const fontStack =
      fontMode === "serif"
        ? "'Georgia', 'Times New Roman', serif"
        : "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const tocHtml =
      mode === "summary" && includeToc && parsedSections.length >= 2
        ? `<div class="toc-box">
            <div class="toc-header">
              <span>SOMMAIRE EXÉCUTIF & PLAN DIRECTEUR DU COURS</span>
              <span>${String(parsedSections.length).padStart(2, "0")} SECTIONS</span>
            </div>
            <div class="toc-grid">
              ${parsedSections
                .map(
                  (sec) =>
                    `<div class="toc-item"><span class="toc-idx">${String(sec.index).padStart(2, "0")}.</span><span>${sec.title}</span></div>`
                )
                .join("")}
            </div>
          </div>`
        : "";

    const revisionHtml =
      mode === "summary" && includeRevisionBox
        ? `<div class="revision-box">
            <div class="toc-header">
              <span>VISA DE RÉVISION & ANNOTATIONS PERSONNELLES</span>
              <span>TITULAIRE : ${authorName.toUpperCase()}</span>
            </div>
            <div class="checks-row">
              <span>□ 1re Lecture (Compréhension)</span>
              <span>□ 2e Lecture (Ancrage des seuils)</span>
              <span>□ 3e Lecture (Validation QCM)</span>
            </div>
            <div class="note-line"></div>
            <div class="note-line"></div>
          </div>`
        : "";

    const bodyHtml =
      mode === "summary"
        ? htmlOrMarkdownContent
        : (quizData?.questions || [])
            .map((q, idx) => {
              const opts = q.options || q.choices || [];
              return `<div class="q-block">
                <h2>Question ${String(idx + 1).padStart(2, "0")}</h2>
                <p><strong>${q.question.replace(/\n/g, "<br/>")}</strong></p>
                <ul>
                  ${opts
                    .map((o, oIdx) => {
                      const txt = typeof o === "string" ? o : o.text;
                      const lbl =
                        typeof o === "string"
                          ? String.fromCharCode(65 + oIdx)
                          : o.label || String.fromCharCode(65 + oIdx);
                      return `<li><strong>□ ${lbl}.</strong> ${txt}</li>`;
                    })
                    .join("")}
                </ul>
              </div>`;
            })
            .join("");

    printWin.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 16mm 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: ${fontStack};
      color: ${palette.textMain};
      background: #FFFFFF;
      line-height: 1.62;
      font-size: 10.5pt;
      margin: 0;
      padding: 0;
    }
    .masthead {
      border: 1px solid ${palette.border};
      background: ${palette.surface};
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 18px;
    }
    .bar-primary { height: 5px; background: ${palette.primary}; }
    .bar-accent { height: 2.5px; background: ${palette.accent}; }
    .masthead-inner { padding: 16px 20px; }
    .super-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .pill {
      background: ${palette.accent};
      color: #FFF;
      font-family: sans-serif;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 3px;
    }
    .ref { font-family: monospace; font-size: 8.5pt; font-weight: 700; color: ${palette.primary}; }
    h1 {
      font-family: 'Georgia', serif;
      font-size: 21pt;
      color: ${palette.primary};
      margin: 0 0 6px 0;
      line-height: 1.2;
    }
    .subtitle { font-family: sans-serif; font-size: 8.5pt; color: ${palette.textMuted}; margin-bottom: 12px; }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      border-top: 1px solid ${palette.border};
      padding-top: 10px;
      font-family: sans-serif;
    }
    .meta-label { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; color: ${palette.textMuted}; letter-spacing: 0.08em; }
    .meta-val { font-size: 8.5pt; font-weight: 700; color: ${palette.primary}; margin-top: 2px; }
    .toc-box {
      border: 1px solid ${palette.accentBorder};
      background: ${palette.accentSoft};
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-family: sans-serif;
    }
    .toc-header {
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      font-weight: 700;
      color: ${palette.primary};
      letter-spacing: 0.08em;
      border-bottom: 1px solid ${palette.accentBorder};
      padding-bottom: 5px;
      margin-bottom: 8px;
    }
    .toc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px 14px; font-size: 8.5pt; }
    .toc-idx { font-family: monospace; font-weight: 700; color: ${palette.accent}; margin-right: 6px; }
    h2 {
      font-family: 'Georgia', serif;
      font-size: 13.5pt;
      color: ${palette.primary};
      background: ${palette.accentSoft};
      border-left: 4px solid ${palette.accent};
      padding: 7px 12px;
      margin: 18px 0 10px 0;
      page-break-after: avoid;
    }
    h3 {
      font-family: sans-serif;
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: ${palette.accent};
      border-bottom: 1px solid ${palette.border};
      padding-bottom: 3px;
      margin: 12px 0 6px 0;
      page-break-after: avoid;
    }
    p { margin: 0 0 8px 0; text-align: justify; }
    ul, ol { margin: 4px 0 10px 0; padding-left: 20px; }
    li { margin-bottom: 5px; text-align: justify; }
    strong, b { color: ${palette.primary}; }
    .revision-box {
      margin-top: 22px;
      border: 1px solid ${palette.border};
      background: ${palette.surface};
      border-radius: 6px;
      padding: 12px 16px;
      font-family: sans-serif;
      page-break-inside: avoid;
    }
    .checks-row { display: flex; justify-content: space-between; font-size: 8.5pt; margin-bottom: 10px; }
    .note-line { border-bottom: 1px solid ${palette.border}; height: 20px; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="masthead">
    <div class="bar-primary"></div>
    <div class="bar-accent"></div>
    <div class="masthead-inner">
      <div class="super-row">
        <span class="pill">${mode === "summary" ? "MONOGRAPHIE DE SYNTHÈSE" : "CAHIER D'ÉPREUVE QCM"} • ${subject}</span>
        <span class="ref">RÉF. ${refCode}</span>
      </div>
      <h1>${title}</h1>
      <div class="subtitle">${facultyName} • Édition Haute Lisibilité (~${estimatedReadingMin} min)</div>
      <div class="meta-grid">
        <div><div class="meta-label">DISCIPLINE</div><div class="meta-val">${subject}</div></div>
        <div><div class="meta-label">ARCHITECTURE</div><div class="meta-val">${architectureLabel}</div></div>
        <div><div class="meta-label">CALIBRAGE</div><div class="meta-val">${resolutionLabel}</div></div>
        <div><div class="meta-label">DATE D'ÉDITION</div><div class="meta-val">${formattedDate}</div></div>
      </div>
    </div>
  </div>
  ${tocHtml}
  <div>${bodyHtml}</div>
  ${revisionHtml}
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 250); };</script>
</body>
</html>`);
    printWin.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-[940px] max-h-[92vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-4 py-4 sm:px-6 sm:pt-5 sm:pb-4 border-b border-border/80 bg-secondary/35">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="font-mono uppercase">
                STUDIO D'ÉDITION VECTORIELLE PDF HD
              </Badge>
              <Badge variant="secondary" className="font-mono text-[11px]">
                {refCode}
              </Badge>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              Mise en page certifiée A4 • 300 DPI Vectoriel
            </span>
          </div>
          <DialogTitle className="font-serif text-2xl text-foreground mt-1.5">
            Maquette & Export PDF — {title}
          </DialogTitle>
          <DialogDescription>
            Personnalisez la griffe éditoriale, la typographie et les cartouches de secrétariat avant d'exporter votre document PDF vectoriel haute définition.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 bg-card">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLONNE GAUCHE : CONTRÔLES DE SECRÉTARIAT & TYPOGRAPHIE */}
            <div className="lg:col-span-6 space-y-5">
              {/* 1. PALETTE ÉDITORIALE */}
              <div className="space-y-2">
                <label className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-primary" />
                  1. Griffe chromatique & Palette d'impression
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(
                    [
                      {
                        id: "dawjang" as const,
                        title: "Signature DawJang",
                        sub: "Bleu Nuit & Terracotta",
                        swatches: ["#0F172A", "#C96442", "#FAF5F0"],
                      },
                      {
                        id: "prestige" as const,
                        title: "Édition Prestige",
                        sub: "Ébène & Or Académique",
                        swatches: ["#181715", "#92400E", "#FEFCE8"],
                      },
                      {
                        id: "hospital" as const,
                        title: "Clinique CHU",
                        sub: "Bleu Oxford & Émeraude",
                        swatches: ["#0F172A", "#0F766E", "#F0FDFA"],
                      },
                      {
                        id: "monochrome" as const,
                        title: "Imprimerie Laser",
                        sub: "Noir Pur & Acier (Éco-encre)",
                        swatches: ["#09090B", "#52525B", "#F4F4F5"],
                      },
                    ]
                  ).map((item) => {
                    const active = theme === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTheme(item.id)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-all flex items-center justify-between gap-2",
                          active
                            ? "border-primary bg-primary/10 shadow-xs"
                            : "border-border bg-background/60 hover:border-foreground/30"
                        )}
                      >
                        <div>
                          <span className="text-[12.5px] font-semibold text-foreground block">
                            {item.title}
                          </span>
                          <span className="text-[11px] text-muted-foreground block">
                            {item.sub}
                          </span>
                        </div>
                        <div className="flex items-center -space-x-1 shrink-0">
                          {item.swatches.map((color, idx) => (
                            <span
                              key={idx}
                              style={{ backgroundColor: color }}
                              className="h-4 w-4 rounded-full border border-white/80 shadow-xs"
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. POLICE DU CORPS */}
              <div className="space-y-2">
                <label className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5">
                  <Type className="h-3.5 w-3.5 text-primary" />
                  2. Typographie du corps de texte
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    {
                      id: "serif" as const,
                      title: "Serif Académique",
                      desc: "Times-Roman • Style revue médicale & traité",
                    },
                    {
                      id: "sans" as const,
                      title: "Sans-Serif Clinique",
                      desc: "Helvetica • Style polycopié moderne",
                    },
                  ].map((f) => {
                    const active = fontMode === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFontMode(f.id)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-all",
                          active
                            ? "border-primary bg-primary/10 shadow-xs"
                            : "border-border bg-background/60 hover:border-foreground/30"
                        )}
                      >
                        <span
                          className={cn(
                            "text-[13px] font-semibold text-foreground block",
                            f.id === "serif" ? "font-serif" : "font-sans"
                          )}
                        >
                          {f.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground block mt-0.5">
                          {f.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. OPTIONS DE SECRÉTARIAT */}
              <div className="space-y-2">
                <label className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  3. Composants de secrétariat & structure
                </label>

                {mode === "summary" ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setIncludeToc((v) => !v)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition-all flex items-center justify-between gap-3",
                        includeToc
                          ? "border-primary/60 bg-primary/[0.06]"
                          : "border-border bg-background/50"
                      )}
                    >
                      <div>
                        <span className="text-[12.5px] font-semibold text-foreground block">
                          Sommaire Exécutif & Plan Directeur numéroté
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Table synoptique des {parsedSections.length} sections en tête de la 1re page.
                        </span>
                      </div>
                      <div
                        className={cn(
                          "h-5 w-5 rounded-md flex items-center justify-center shrink-0 border",
                          includeToc
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-card"
                        )}
                      >
                        {includeToc && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeRevisionBox((v) => !v)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition-all flex items-center justify-between gap-3",
                        includeRevisionBox
                          ? "border-primary/60 bg-primary/[0.06]"
                          : "border-border bg-background/50"
                      )}
                    >
                      <div>
                        <span className="text-[12.5px] font-semibold text-foreground block">
                          Visa de Révision (3 Lectures) & Lignes d'annotations
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Encadré final de suivi d'apprentissage et prise de notes manuscrites.
                        </span>
                      </div>
                      <div
                        className={cn(
                          "h-5 w-5 rounded-md flex items-center justify-center shrink-0 border",
                          includeRevisionBox
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-card"
                        )}
                      >
                        {includeRevisionBox && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setIncludeAnswerGrid((v) => !v)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition-all flex items-center justify-between gap-3",
                        includeAnswerGrid
                          ? "border-primary/60 bg-primary/[0.06]"
                          : "border-border bg-background/50"
                      )}
                    >
                      <div>
                        <span className="text-[12.5px] font-semibold text-foreground block">
                          Feuille de Coche Rapide (Grille Optique A-B-C-D-E)
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Grille officielle de cases à noircir en tête du sujet d'examen.
                        </span>
                      </div>
                      <div
                        className={cn(
                          "h-5 w-5 rounded-md flex items-center justify-center shrink-0 border",
                          includeAnswerGrid
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-card"
                        )}
                      >
                        {includeAnswerGrid && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeAnswerKey((v) => !v)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition-all flex items-center justify-between gap-3",
                        includeAnswerKey
                          ? "border-primary/60 bg-primary/[0.06]"
                          : "border-border bg-background/50"
                      )}
                    >
                      <div>
                        <span className="text-[12.5px] font-semibold text-foreground block">
                          Cahier de Corrigé Officiel & Justifications séparé
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Ajoute les pages de corrigé détaillé et la grille récapitulative en fin de PDF.
                        </span>
                      </div>
                      <div
                        className={cn(
                          "h-5 w-5 rounded-md flex items-center justify-center shrink-0 border",
                          includeAnswerKey
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-card"
                        )}
                      >
                        {includeAnswerKey && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* 4. CARTOUCHE D'IDENTIFICATION */}
              <div className="space-y-2">
                <label className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5">
                  <Stamp className="h-3.5 w-3.5 text-primary" />
                  4. Cartouche d'identification & Titulaire
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">
                      Titulaire / Étudiant
                    </span>
                    <Input
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="Nom de l'étudiant…"
                      className="h-9 text-[12.5px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">
                      Faculté / Institution
                    </span>
                    <Input
                      value={facultyName}
                      onChange={(e) => setFacultyName(e.target.value)}
                      placeholder="Faculté de Médecine…"
                      className="h-9 text-[12.5px]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* COLONNE DROITE : APERÇU HAUTE-COUTURE EN TEMPS RÉEL DE LA FEUILLE A4 */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-border/90 bg-secondary/45 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                    APERÇU MAQUETTE A4 EN DIRECT
                  </span>
                  <span className="font-mono text-[10.5px] font-semibold text-primary">
                    {palette.label}
                  </span>
                </div>

                {/* FEUILLE A4 SIMULÉE */}
                <div
                  className="mx-auto w-full max-w-[400px] rounded-md bg-white shadow-xl border border-slate-200 p-5 text-slate-900 space-y-3 transition-all"
                  style={{
                    fontFamily:
                      fontMode === "serif"
                        ? "Georgia, 'Times New Roman', serif"
                        : "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  {/* Running Header */}
                  <div
                    className="flex items-center justify-between pb-1.5 border-b text-[8px] font-sans tracking-wider uppercase"
                    style={{ borderColor: palette.border }}
                  >
                    <div className="flex items-center gap-1 font-bold">
                      <span style={{ color: palette.primary }}>DAWJANG PRESS</span>
                      <span style={{ color: palette.accent }}>•</span>
                      <span style={{ color: palette.accent }}>{subject}</span>
                    </div>
                    <span className="font-mono text-slate-400">{refCode}</span>
                  </div>

                  {/* Masthead Box */}
                  <div
                    className="rounded border overflow-hidden"
                    style={{
                      borderColor: palette.border,
                      backgroundColor: palette.surface,
                    }}
                  >
                    <div
                      className="h-1"
                      style={{ backgroundColor: palette.primary }}
                    />
                    <div
                      className="h-0.5"
                      style={{ backgroundColor: palette.accent }}
                    />
                    <div className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span
                          className="px-1.5 py-0.5 rounded-[2px] text-[7px] font-sans font-bold uppercase tracking-wider text-white"
                          style={{ backgroundColor: palette.accent }}
                        >
                          {mode === "summary"
                            ? "MONOGRAPHIE DE SYNTHÈSE"
                            : "CAHIER D'ÉPREUVE QCM"}
                        </span>
                        <span
                          className="font-mono text-[7.5px] font-bold"
                          style={{ color: palette.primary }}
                        >
                          {formattedDate}
                        </span>
                      </div>

                      <h4
                        className="font-serif font-bold text-[14px] leading-snug"
                        style={{ color: palette.primary }}
                      >
                        {title}
                      </h4>

                      <p className="text-[8px] font-sans text-slate-500">
                        {facultyName} • Titulaire : {authorName}
                      </p>

                      <div
                        className="grid grid-cols-3 gap-2 pt-1.5 border-t text-[7.5px] font-sans"
                        style={{ borderColor: palette.border }}
                      >
                        <div>
                          <span className="text-slate-400 block uppercase text-[6.5px] font-bold">
                            DISCIPLINE
                          </span>
                          <span
                            className="font-bold truncate block"
                            style={{ color: palette.primary }}
                          >
                            {subject}
                          </span>
                        </div>
                        <div
                          className="border-l pl-2"
                          style={{ borderColor: palette.border }}
                        >
                          <span className="text-slate-400 block uppercase text-[6.5px] font-bold">
                            ARCHITECTURE
                          </span>
                          <span
                            className="font-bold truncate block"
                            style={{ color: palette.primary }}
                          >
                            {mode === "summary"
                              ? architectureLabel
                              : `${quizData?.questions.length || 0} QCM`}
                          </span>
                        </div>
                        <div
                          className="border-l pl-2"
                          style={{ borderColor: palette.border }}
                        >
                          <span className="text-slate-400 block uppercase text-[6.5px] font-bold">
                            VOLUME
                          </span>
                          <span
                            className="font-bold truncate block"
                            style={{ color: palette.primary }}
                          >
                            ~{estimatedReadingMin} min
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sommaire Exécutif ou Grille Optique */}
                  {mode === "summary" && includeToc && parsedSections.length >= 2 && (
                    <div
                      className="rounded border p-2.5 space-y-1 font-sans"
                      style={{
                        borderColor: palette.accentBorder,
                        backgroundColor: palette.accentSoft,
                      }}
                    >
                      <div
                        className="flex items-center justify-between text-[7px] font-bold uppercase tracking-wider pb-1 border-b"
                        style={{
                          color: palette.primary,
                          borderColor: palette.accentBorder,
                        }}
                      >
                        <span>SOMMAIRE EXÉCUTIF DU COURS</span>
                        <span style={{ color: palette.accent }}>
                          {String(parsedSections.length).padStart(2, "0")} SECTIONS
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[7.5px]">
                        {parsedSections.slice(0, 6).map((sec) => (
                          <div key={sec.index} className="truncate">
                            <span
                              className="font-mono font-bold mr-1"
                              style={{ color: palette.accent }}
                            >
                              {String(sec.index).padStart(2, "0")}.
                            </span>
                            <span style={{ color: palette.primary }}>
                              {sec.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {mode === "quiz" && includeAnswerGrid && (
                    <div
                      className="rounded border p-2.5 space-y-1.5 font-sans"
                      style={{
                        borderColor: palette.accentBorder,
                        backgroundColor: palette.accentSoft,
                      }}
                    >
                      <div
                        className="flex items-center justify-between text-[7px] font-bold uppercase tracking-wider pb-1 border-b"
                        style={{
                          color: palette.primary,
                          borderColor: palette.accentBorder,
                        }}
                      >
                        <span>FEUILLE DE COCHE RAPIDE (A - B - C - D - E)</span>
                        <span style={{ color: palette.accent }}>OPTIQUE</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-[7px] font-mono">
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <div key={n} className="flex items-center gap-1">
                            <span className="font-bold">Q0{n}</span>
                            <span className="px-1 border border-slate-400 bg-white rounded-[1px]">
                              A
                            </span>
                            <span className="px-1 border border-slate-400 bg-white rounded-[1px]">
                              B
                            </span>
                            <span className="px-1 border border-slate-400 bg-white rounded-[1px]">
                              C
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Aperçu de la 1re section ou question */}
                  <div className="space-y-1.5">
                    <div
                      className="flex items-center gap-2 px-2.5 py-1.5 border-l-4"
                      style={{
                        backgroundColor: palette.accentSoft,
                        borderLeftColor: palette.accent,
                      }}
                    >
                      <span
                        className="px-1.5 py-0.5 rounded-[2px] font-mono text-[6.5px] font-bold text-white"
                        style={{ backgroundColor: palette.primary }}
                      >
                        {mode === "summary"
                          ? parsedSections[0]?.badge || "OBJECTIF 01"
                          : "QUESTION 01"}
                      </span>
                      <span
                        className="font-serif font-bold text-[10px] truncate"
                        style={{ color: palette.primary }}
                      >
                        {mode === "summary"
                          ? parsedSections[0]?.title || "Développement clinique"
                          : quizData?.questions[0]?.question || "Énoncé clinique"}
                      </span>
                    </div>

                    <p className="text-[8.5px] leading-relaxed text-slate-700 text-justify line-clamp-3">
                      {mode === "summary"
                        ? sanitizePdfText(
                            htmlOrMarkdownContent.replace(/<[^>]+>/g, " ")
                          ).slice(0, 260)
                        : "A. Proposition clinique A   •   B. Proposition clinique B   •   C. Proposition clinique C"}
                    </p>
                  </div>

                  {/* Running Footer */}
                  <div
                    className="flex items-center justify-between pt-2 border-t text-[7px] font-sans text-slate-400"
                    style={{ borderColor: palette.border }}
                  >
                    <span>DawJang Studio • Édition Certifiée</span>
                    <span
                      className="px-1.5 py-0.5 rounded-[2px] font-mono text-[6.5px] font-bold text-white"
                      style={{ backgroundColor: palette.primary }}
                    >
                      FOLIO 01 / 03
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-4 py-3 sm:px-6 sm:py-4 border-t border-border/80 bg-secondary/35 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintA4}
              className="gap-1.5"
            >
              <Printer className="h-3.5 w-3.5 text-primary" />
              <span>Imprimer A4</span>
            </Button>

            {mode === "summary" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadWord}
                disabled={isExportingWord}
                className="gap-1.5"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                <span>{isExportingWord ? "Export Word…" : "Word (.docx)"}</span>
              </Button>
            )}
          </div>

          <Button
            type="button"
            size="lg"
            onClick={handleDownloadVectorPdf}
            disabled={isExportingPdf}
            className="gap-2 shadow-md"
          >
            <Download className="h-4 w-4" />
            <span>
              {isExportingPdf
                ? "Compilation Vectorielle HD…"
                : "Télécharger le PDF Vectoriel HD (.pdf)"}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
