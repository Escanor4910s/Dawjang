import React, { useState, useRef } from "react";
import {
  Upload,
  FileText,
  X,
  Sparkles,
  CheckCircle2,
  Loader2,
  FolderPlus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export interface LibraryCourseMinimal {
  id: string;
  title: string;
  subject: string;
  wordCount: number;
  content: string;
}

export interface BatchExamSummaryModalProps {
  onGenerateComplete: (
    courseFile: File | null,
    examFiles: File[],
    options?: {
      libraryCourse?: LibraryCourseMinimal | null;
      customTitle?: string;
      customSubject?: string;
    }
  ) => Promise<void>;
  isGenerating: boolean;
  progressLabel?: string;
  defaultCourseFile?: File | null;
  title?: string;
  onTitleChange?: (val: string) => void;
  subject?: string;
  onSubjectChange?: (val: string) => void;
  subjectFilters?: string[];
  libraryCourses?: LibraryCourseMinimal[];
}

export const ObjectiveExamBatchUploader: React.FC<BatchExamSummaryModalProps> = ({
  onGenerateComplete,
  isGenerating,
  progressLabel,
  defaultCourseFile = null,
  title = "",
  onTitleChange,
  subject = "Hématologie",
  onSubjectChange,
  subjectFilters = [
    "Hématologie",
    "Cardiologie",
    "Neurologie",
    "Pneumologie",
    "Gastro-entérologie",
    "Néphrologie",
    "Infectiologie",
    "Endocrinologie",
    "Pédiatrie",
    "Chirurgie",
    "Gynécologie",
    "Pharmacologie",
  ],
  libraryCourses = [],
}) => {
  const [sourceMode, setSourceMode] = useState<"upload" | "library">("upload");
  const [courseFile, setCourseFile] = useState<File | null>(defaultCourseFile);
  const [selectedLibCourse, setSelectedLibCourse] = useState<LibraryCourseMinimal | null>(null);
  const [examFiles, setExamFiles] = useState<File[]>([]);
  const [isDraggingCourse, setIsDraggingCourse] = useState(false);
  const [isDraggingExams, setIsDraggingExams] = useState(false);

  const courseInputRef = useRef<HTMLInputElement>(null);
  const examsInputRef = useRef<HTMLInputElement>(null);

  const hasCourseReady =
    (sourceMode === "upload" && Boolean(courseFile)) ||
    (sourceMode === "library" && Boolean(selectedLibCourse));

  const handleCourseSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setCourseFile(f);
      if (onTitleChange && !title.trim()) {
        onTitleChange(f.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " "));
      }
    }
  };

  const handleBatchExamsSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const incomingFiles = Array.from(e.target.files);
      setExamFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        const uniqueNew = incomingFiles.filter((f) => !existingNames.has(f.name));
        return [...prev, ...uniqueNew];
      });
      e.target.value = "";
    }
  };

  const removeExamFile = (fileName: string) => {
    setExamFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const clearAllExams = () => {
    setExamFiles([]);
  };

  const handleLaunchGeneration = () => {
    if (!hasCourseReady) return;
    onGenerateComplete(courseFile, examFiles, {
      libraryCourse: sourceMode === "library" ? selectedLibCourse : null,
      customTitle: title,
      customSubject: subject,
    });
  };

  return (
    <Card className="bg-card border-border/80 shadow-sm rounded-3xl overflow-hidden">
      <CardContent className="p-6 sm:p-8 space-y-6">
        {/* En-tête épuré aligné sur le Studio QCM */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-wider uppercase">
              MODE 3 • OBJECTIFS &amp; AUDIT DOCIMOLOGIQUE D&apos;ANNALES
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              Volet 1 (Cours complet) • Volet 2 (Incidence, Pièges &amp; Marche à suivre)
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-foreground">
            Double Studio : Cours &amp; Évaluations en Masse
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Importez votre support de cours (Pôle A) et vos sujets d&apos;examens ou annales (Pôle B) pour générer la synthèse par objectifs suivie du rapport d&apos;audit docimologique profond.
          </p>
        </div>

        {/* Identification rapide : Titre & Discipline */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs font-bold text-foreground block">
              Intitulé de la synthèse
            </label>
            <Input
              value={title}
              onChange={(e) => onTitleChange?.(e.target.value)}
              placeholder="Ex : Hémoglobinopathies — Drépanocytose & Thalassémies"
              className="h-10 text-xs sm:text-sm rounded-xl bg-background border-border"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground block">
              Discipline médicale
            </label>
            <select
              value={subject}
              onChange={(e) => onSubjectChange?.(e.target.value)}
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs sm:text-sm font-semibold text-foreground"
            >
              {subjectFilters
                .filter((s) => s !== "Tous")
                .map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* DOUBLE STUDIO PÔLE A (COURS) & PÔLE B (ANNALES) — STYLE STUDIO QCM */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* PÔLE A : SUPPORT DE COURS */}
          <div className="p-5 rounded-3xl bg-background border border-border space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-primary/15 text-primary text-xs font-extrabold flex items-center justify-center">
                    A
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      Pôle A — Support de Cours
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Polycopié officiel (PDF, DOCX, PPTX, TXT) ou cours pré-enregistré.
                    </p>
                  </div>
                </div>

                {libraryCourses.length > 0 && (
                  <div className="inline-flex rounded-xl bg-muted p-0.5 border border-border">
                    <button
                      type="button"
                      onClick={() => setSourceMode("upload")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        sourceMode === "upload"
                          ? "bg-card text-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Fichier
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceMode("library")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        sourceMode === "library"
                          ? "bg-card text-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Bibliothèque ({libraryCourses.length})
                    </button>
                  </div>
                )}
              </div>

              {sourceMode === "upload" ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingCourse(true);
                  }}
                  onDragLeave={() => setIsDraggingCourse(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingCourse(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) {
                      setCourseFile(f);
                      if (onTitleChange && !title.trim()) {
                        onTitleChange(f.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " "));
                      }
                    }
                  }}
                  onClick={() => courseInputRef.current?.click()}
                  className={`group rounded-2xl border-2 border-dashed p-5 text-center cursor-pointer transition-all space-y-2 ${
                    isDraggingCourse
                      ? "border-primary bg-primary/10"
                      : courseFile
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-primary/60 bg-card hover:bg-primary/5"
                  }`}
                >
                  <input
                    ref={courseInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.pptx,.ppt,.odt,.rtf"
                    className="hidden"
                    onChange={handleCourseSelect}
                  />
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                    {courseFile ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-foreground">
                    {courseFile
                      ? courseFile.name
                      : "Cliquez ou glissez votre support de cours"}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {courseFile
                      ? "✓ Leçon prête pour l'extraction des objectifs • Cliquez pour remplacer"
                      : "Tous formats supportés : PDF, Word (.docx/.doc), PowerPoint (.pptx), Texte"}
                  </p>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {libraryCourses.map((c) => {
                    const active = selectedLibCourse?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedLibCourse(c);
                          if (onTitleChange) onTitleChange(c.title);
                          if (onSubjectChange && c.subject) onSubjectChange(c.subject);
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">
                            {c.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {c.subject} • {c.wordCount.toLocaleString("fr-FR")} mots
                          </p>
                        </div>
                        {active && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {courseFile && sourceMode === "upload" && (
              <div className="pt-3 border-t border-border/70 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold text-foreground shadow-2xs">
                  <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate max-w-[220px]">{courseFile.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCourseFile(null);
                    }}
                    className="w-5 h-5 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
                    title="Retirer le fichier"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* PÔLE B : UPLOAD DE MASSE DES ANNALES & ÉVALUATIONS */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingExams(true);
            }}
            onDragLeave={() => setIsDraggingExams(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingExams(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const incoming = Array.from(e.dataTransfer.files);
                setExamFiles((prev) => {
                  const existingNames = new Set(prev.map((f) => f.name));
                  return [...prev, ...incoming.filter((f) => !existingNames.has(f.name))];
                });
              }
            }}
            className="p-5 rounded-3xl bg-primary/5 border border-primary/25 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold flex items-center justify-center">
                    B
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      Pôle B — Annales &amp; Examens (Upload de masse)
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Scanne 100 % des QCM, cas cliniques et diagnostics différentiels.
                    </p>
                  </div>
                </div>
                {examFiles.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Badge className="text-[10px] font-bold">
                      {examFiles.length} annale{examFiles.length > 1 ? "s" : ""}
                    </Badge>
                    <button
                      type="button"
                      onClick={clearAllExams}
                      className="p-1 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                      title="Vider toutes les annales"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div
                onClick={() => examsInputRef.current?.click()}
                className={`group rounded-2xl border-2 border-dashed p-5 text-center cursor-pointer transition-all space-y-2 ${
                  isDraggingExams
                    ? "border-primary bg-primary/15"
                    : "border-primary/40 hover:border-primary bg-card hover:bg-primary/10"
                }`}
              >
                <input
                  ref={examsInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.pptx,.odt,.rtf"
                  multiple
                  className="hidden"
                  onChange={handleBatchExamsSelect}
                />
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-foreground">
                  Cliquez pour uploader plusieurs annales en même temps
                </div>
                <p className="text-[11px] text-muted-foreground">
                  PDF, Word (.docx/.doc), Texte — Lecture intégrale et détection de toutes les pathologies du cours.
                </p>
              </div>
            </div>

            {examFiles.length > 0 && (
              <div className="pt-3 border-t border-primary/20 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Évaluations sélectionnées ({examFiles.length}) :
                </div>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                  {examFiles.map((file) => (
                    <span
                      key={file.name}
                      className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl bg-card border border-primary/30 text-xs font-semibold text-foreground shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate max-w-[180px]">{file.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeExamFile(file.name);
                        }}
                        className="w-5 h-5 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
                        title={`Retirer ${file.name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bouton de lancement pleine largeur (identique au Générateur IA QCM) */}
        <Button
          type="button"
          size="lg"
          disabled={!hasCourseReady || isGenerating}
          onClick={handleLaunchGeneration}
          className="w-full rounded-2xl h-12 font-bold text-sm gap-2 shadow-md"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{progressLabel || "Analyse docimologique et rédaction chirurgicale en cours..."}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>
                Lancer la Synthèse par Objectifs &amp; l&apos;Audit Docimologique ({examFiles.length} évaluation{examFiles.length > 1 ? "s" : ""})
              </span>
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ObjectiveExamBatchUploader;
