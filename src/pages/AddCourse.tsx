import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen, Upload, FileText, Download, AlertCircle,
  GraduationCap, Target, Flame, Search, FolderOpen, CheckCircle,
  Sparkles, ShieldAlert, FolderPlus, X, ClipboardPaste,
  SlidersHorizontal, Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFileReader } from "@/hooks/useFileReader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { invokeWithRetry } from "@/lib/edgeRetry";

interface ExistingCourse {
  id: string;
  title: string;
  content: string;
  file_name: string | null;
  created_at: string;
}

type SourceMode = "exam_clone" | "upload" | "existing" | "paste";

const OFFICIAL_EXAM_TYPES = [
  {
    id: "election",
    label: "Élection",
    desc: "1 seule proposition juste parmi A-E",
  },
  {
    id: "censure",
    label: "Censure",
    desc: "1 seule proposition fausse (sauf un)",
  },
  {
    id: "groupage",
    label: "Groupage",
    desc: "Code A=1+2+3, B=1+3, C=2+4, D=4, E=autre",
  },
  {
    id: "jumelage",
    label: "Jumelage / Cause à effet",
    desc: "2 phrases liées (Vrai-Vrai lié/non lié, Vrai-Faux...)",
  },
  {
    id: "association",
    label: "Association",
    desc: "Appariement d'éléments avec A, B, C, D, E",
  },
  {
    id: "cas-cliniques",
    label: "Cas Cliniques",
    desc: "Dossiers progressifs en cascade",
  },
  {
    id: "complements-multiples",
    label: "Compléments Multiples",
    desc: "1 à 5 propositions justes (style Physiologie)",
  },
];

const LOCAL_MEMORY_KEY = "hippocampus_permanent_qcm_memory_v1";

function getLocalMemoryForCourse(courseKey: string): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_MEMORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed[courseKey]) ? parsed[courseKey] : [];
  } catch {
    return [];
  }
}

function saveQuestionsToLocalMemory(courseKey: string, questions: any[]) {
  try {
    const raw = localStorage.getItem(LOCAL_MEMORY_KEY);
    const store = raw ? JSON.parse(raw) : {};
    const existing: string[] = Array.isArray(store[courseKey]) ? store[courseKey] : [];
    const incoming = questions
      .map((q) => (typeof q?.question === "string" ? q.question.replace(/\s+/g, " ").trim().slice(0, 160) : ""))
      .filter(Boolean);
    const merged = Array.from(new Set([...incoming, ...existing])).slice(0, 120);
    store[courseKey] = merged;
    localStorage.setItem(LOCAL_MEMORY_KEY, JSON.stringify(store));
  } catch {
    // ignore storage quota errors
  }
}

export const AddCourse = () => {
  const [sourceMode, setSourceMode] = useState<SourceMode>("exam_clone");
  const [title, setTitle] = useState("");

  // Mode 1 : Clonage d'Examen Officiel (Upload en masse Pôle A Cours + Pôle B Annales)
  const [batchCourseFiles, setBatchCourseFiles] = useState<File[]>([]);
  const [batchExamFiles, setBatchExamFiles] = useState<File[]>([]);

  // Personnalisation optionnelle des types de QCM en mode Examen Officiel
  const [customizeCloneTypes, setCustomizeCloneTypes] = useState(false);
  const [selectedCloneTypes, setSelectedCloneTypes] = useState<string[]>([]);

  // Mode 2 : Upload classique d'un fichier
  const [file, setFile] = useState<File | null>(null);

  // Mode 3 : Bibliothèque locale
  const [existingCourses, setExistingCourses] = useState<ExistingCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseSearchText, setCourseSearchText] = useState("");
  const [coursePopoverOpen, setCoursePopoverOpen] = useState(false);

  // Mode 4 : Copier-coller de texte
  const [pastedText, setPastedText] = useState("");

  // Paramètres de génération
  const [questionCount, setQuestionCount] = useState("25");
  const [questionType, setQuestionType] = useState("classique");
  const [difficultyLevel, setDifficultyLevel] = useState("intermediaire");
  const [aiModel, setAiModel] = useState("med2");

  const [isGenerating, setIsGenerating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [processingStep, setProcessingStep] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();
  const { readFile, isReading } = useFileReader();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Connexion requise", variant: "destructive" });
        navigate("/auth");
        return;
      }
      setUser(user);
    };
    checkUser();
  }, [navigate, toast]);

  const fetchExistingCourses = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("courses")
      .select("id, title, content, file_name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setExistingCourses(data || []);
  }, [user]);

  useEffect(() => {
    if (user) fetchExistingCourses();
  }, [user, fetchExistingCourses]);

  const filteredExistingCourses = useMemo(() => {
    if (!courseSearchText.trim()) return existingCourses;
    const q = courseSearchText.toLowerCase();
    return existingCourses.filter((c) => c.title.toLowerCase().includes(q));
  }, [existingCourses, courseSearchText]);

  const selectedCourse = existingCourses.find((c) => c.id === selectedCourseId);

  const toggleCloneType = (typeId: string) => {
    setSelectedCloneTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    );
  };

  const handleBatchCoursesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const incoming = Array.from(e.target.files);
      setBatchCourseFiles((prev) => {
        const names = new Set(prev.map((f) => f.name));
        const unique = incoming.filter((f) => !names.has(f.name));
        const next = [...prev, ...unique];
        if (!title.trim() && next.length > 0) {
          setTitle(
            next.length === 1
              ? next[0].name.replace(/\.[^/.]+$/, "")
              : `${next[0].name.replace(/\.[^/.]+$/, "")} (+${next.length - 1} cours)`
          );
        }
        return next;
      });
      e.target.value = "";
    }
  };

  const removeBatchCourseFile = (name: string) => {
    setBatchCourseFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleBatchExamsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const incoming = Array.from(e.target.files);
      setBatchExamFiles((prev) => {
        const names = new Set(prev.map((f) => f.name));
        const unique = incoming.filter((f) => !names.has(f.name));
        return [...prev, ...unique];
      });
      e.target.value = "";
    }
  };

  const removeBatchExamFile = (name: string) => {
    setBatchExamFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!title.trim()) setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const getDifficultyIcon = (level: string) => {
    switch (level) {
      case "facile":
        return <GraduationCap className="h-4 w-4 text-success" />;
      case "intermediaire":
        return <Target className="h-4 w-4 text-warning" />;
      case "difficile":
        return <Flame className="h-4 w-4 text-destructive" />;
      default:
        return <GraduationCap className="h-4 w-4" />;
    }
  };

  const normalizeTitle = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\s*\(session\s*\d+\)\s*$/i, "");

  const getUniqueSessionTitle = async (baseTitle: string, userId: string): Promise<string> => {
    const normalizedBase = normalizeTitle(baseTitle);
    const { data: existing } = await supabase
      .from("courses")
      .select("title")
      .eq("user_id", userId);
    if (!existing || existing.length === 0) return baseTitle;
    const matching = existing.filter((c) => {
      const n = normalizeTitle(c.title);
      return n === normalizedBase || n.startsWith(normalizedBase);
    });
    if (matching.length === 0) return baseTitle;
    const nums = matching.map((c) => {
      const m = c.title.match(/\(Session\s*(\d+)\)\s*$/i);
      return m ? parseInt(m[1]) : 1;
    });
    return `${baseTitle} (Session ${Math.max(...nums) + 1})`;
  };

  const handleGenerateQuiz = async () => {
    if (!user) return;

    if (sourceMode === "exam_clone") {
      if (batchCourseFiles.length === 0) {
        toast({
          title: "Cours requis",
          description: "Uploadez au moins un fichier de cours dans le Pôle A.",
          variant: "destructive",
        });
        return;
      }
      if (batchExamFiles.length === 0) {
        toast({
          title: "Évaluations requises",
          description: "Uploadez vos examens d'inspiration dans le Pôle B.",
          variant: "destructive",
        });
        return;
      }
    } else if (sourceMode === "upload" && (!title.trim() || !file)) {
      toast({
        title: "Champs requis",
        description: "Remplissez le titre et sélectionnez un fichier",
        variant: "destructive",
      });
      return;
    } else if (sourceMode === "existing" && !selectedCourseId) {
      toast({
        title: "Champs requis",
        description: "Sélectionnez un cours existant",
        variant: "destructive",
      });
      return;
    } else if (sourceMode === "paste" && (!title.trim() || pastedText.trim().length < 50)) {
      toast({
        title: "Texte insuffisant",
        description: "Donnez un titre et collez le texte du cours (min. 50 caractères).",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setProcessingStep("Préparation...");

    try {
      let courseContent = "";
      let courseTitle = title.trim();
      let courseId = "";
      const parsedExamFiles: Array<{ fileName: string; content: string }> = [];

      if (sourceMode === "exam_clone") {
        const extractedCourses: string[] = [];
        for (let i = 0; i < batchCourseFiles.length; i++) {
          const cf = batchCourseFiles[i];
          setProcessingStep(
            `Analyse à la loupe du cours (${i + 1}/${batchCourseFiles.length}) : ${cf.name}...`
          );
          const res = await readFile(cf);
          if (res.success && res.content) {
            extractedCourses.push(`=== COURS : ${cf.name} ===\n${res.content}`);
          }
        }
        if (extractedCourses.length === 0) {
          throw new Error("Impossible d'extraire le texte des cours sélectionnés.");
        }
        courseContent = extractedCourses.join("\n\n====================\n\n");
        const baseName =
          courseTitle ||
          batchCourseFiles.map((f) => f.name.replace(/\.[^/.]+$/, "")).join(" + ");
        courseTitle = await getUniqueSessionTitle(baseName, user.id);

        setProcessingStep("Enregistrement du pôle de cours...");
        const { data: courseData, error: courseError } = await supabase
          .from("courses")
          .insert({
            user_id: user.id,
            title: courseTitle,
            content: courseContent,
            file_name: batchCourseFiles.map((f) => f.name).join(", "),
          })
          .select()
          .single();
        if (courseError) throw courseError;
        courseId = courseData.id;

        for (let j = 0; j < batchExamFiles.length; j++) {
          const ef = batchExamFiles[j];
          setProcessingStep(
            `Assimilation du style des annales (${j + 1}/${batchExamFiles.length}) : ${ef.name}...`
          );
          const exRes = await readFile(ef);
          if (exRes.success && exRes.content) {
            parsedExamFiles.push({
              fileName: ef.name,
              content: exRes.content,
            });
          }
        }
      } else if (sourceMode === "existing" && selectedCourse) {
        courseContent = selectedCourse.content;
        courseTitle = selectedCourse.title;
        courseId = selectedCourse.id;
      } else if (sourceMode === "paste") {
        courseContent = pastedText.trim();
        courseTitle = await getUniqueSessionTitle(title.trim(), user.id);
        setProcessingStep("Sauvegarde du texte de cours...");
        const { data: courseData, error: courseError } = await supabase
          .from("courses")
          .insert({
            user_id: user.id,
            title: courseTitle,
            content: courseContent,
            file_name: "Texte collé",
          })
          .select()
          .single();
        if (courseError) throw courseError;
        courseId = courseData.id;
      } else {
        setProcessingStep("Analyse du fichier...");
        const fileResult = await readFile(file!);
        if (!fileResult.success || !fileResult.content) {
          throw new Error(fileResult.error || "Impossible de lire le fichier");
        }
        courseContent = fileResult.content;
        courseTitle = await getUniqueSessionTitle(title.trim(), user.id);

        setProcessingStep("Sauvegarde du cours...");
        const { data: courseData, error: courseError } = await supabase
          .from("courses")
          .insert({
            user_id: user.id,
            title: courseTitle,
            content: courseContent,
            file_name: file!.name,
          })
          .select()
          .single();
        if (courseError) throw courseError;
        courseId = courseData.id;
      }

      const effectiveType = sourceMode === "exam_clone" ? "clonage_examen" : questionType;
      const effectiveDifficulty =
        sourceMode === "exam_clone" ? "calibré_annales" : difficultyLevel;

      if (questionCount === "infini" && sourceMode !== "exam_clone") {
        toast({ title: "Mode infini", description: "Lancement de la session interactive..." });
        navigate(`/quiz-infini/${courseId}?type=${effectiveType}&difficulty=${effectiveDifficulty}`);
        return;
      }

      const targetNb = parseInt(questionCount) || 25;
      const memoryKey = normalizeTitle(courseTitle);
      const localPastQuestions = getLocalMemoryForCourse(memoryKey);

      setProcessingStep(
        sourceMode === "exam_clone"
          ? `Clonage Docimologique en cours (${targetNb} QCM sans doublon calqués sur vos ${parsedExamFiles.length} épreuves)...`
          : "Génération des QCM avec l'IA..."
      );

      const { data, error } = await invokeWithRetry<{ qcm: any[] }>("generate-quiz-openai", {
        body: {
          content: courseContent,
          nbQuestions: targetNb,
          type: effectiveType,
          difficulty: effectiveDifficulty,
          examFiles: parsedExamFiles,
          courseTitle,
          selectedCustomTypes:
            sourceMode === "exam_clone" && customizeCloneTypes ? selectedCloneTypes : [],
          pastQuestionsMemory: localPastQuestions,
        },
        retries: 2,
        onRetry: (attempt, status) => {
          setProcessingStep(
            `Service IA occupé (${status ?? "?"}) — nouvelle tentative ${attempt}/2...`
          );
        },
      });

      if (error) throw new Error(`Erreur: ${error.message}`);
      if (!data?.qcm || !Array.isArray(data.qcm)) throw new Error("Format de réponse invalide");

      const validQuestions = data.qcm.filter(
        (q: any) =>
          q.question &&
          Array.isArray(q.choices) &&
          q.choices.length >= 2 &&
          Array.isArray(q.correct) &&
          q.correct.length > 0
      );

      if (validQuestions.length === 0) throw new Error("Aucune question valide générée");

      // Sauvegarder immédiatement dans la mémoire permanente locale (survit même à une suppression)
      saveQuestionsToLocalMemory(memoryKey, validQuestions);

      setProcessingStep("Sauvegarde de l'épreuve...");
      const { data: sessionData, error: sessionError } = await supabase
        .from("qcm_sessions")
        .insert({
          user_id: user.id,
          course_id: courseId,
          title: courseTitle,
          questions: validQuestions,
          status: "completed",
          question_count: validQuestions.length,
          question_type: effectiveType,
          ai_model:
            sourceMode === "exam_clone"
              ? "Clonage Docimologique (Sonnet 4.6)"
              : "MED 2 (Gemini Flash)",
          metadata: {
            originalQuestionCount: targetNb,
            generatedAt: new Date().toISOString(),
            difficulty: effectiveDifficulty,
            mode: sourceMode,
            clonedFromExams: parsedExamFiles.map((e) => e.fileName),
            customTypesSelected:
              sourceMode === "exam_clone" && customizeCloneTypes ? selectedCloneTypes : "auto_annales",
          },
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      toast({
        title: "Épreuve QCM générée avec succès !",
        description:
          sourceMode === "exam_clone"
            ? `${validQuestions.length} QCM inédits clonés sur le style officiel de vos annales.`
            : `${validQuestions.length} questions créées.`,
      });
      navigate(`/quiz/${sessionData.id}`);
    } catch (error) {
      console.error("Error:", error);
      setProcessingStep("");
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setProcessingStep("");
    }
  };

  const isReady = useMemo(() => {
    if (sourceMode === "exam_clone") {
      return batchCourseFiles.length > 0 && batchExamFiles.length > 0;
    }
    if (sourceMode === "upload") return Boolean(title.trim() && file);
    if (sourceMode === "existing") return Boolean(selectedCourseId);
    if (sourceMode === "paste") return Boolean(title.trim() && pastedText.trim().length >= 50);
    return false;
  }, [sourceMode, batchCourseFiles, batchExamFiles, title, file, selectedCourseId, pastedText]);

  return (
    <div className="min-h-screen bg-background bg-doodle-watermark py-6 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6 sm:mb-8 pt-10 sm:pt-0">
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 flex items-center justify-center gap-2.5">
              <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              <span>Générer un QCM</span>
            </h1>
            <p className="text-muted-foreground text-sm sm:text-lg">
              Conditionnement chirurgical calqué sur les évaluations de votre université
            </p>
          </div>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <Upload className="h-5 w-5 text-primary" />
                  <span>Mode de création du QCM</span>
                </div>
                {sourceMode === "exam_clone" && (
                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                    Clonage Docimologique & Régénération Infinie
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Sélecteur des 4 Modes sur une seule ligne ergonomique */}
              <Tabs value={sourceMode} onValueChange={(v) => setSourceMode(v as SourceMode)}>
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-muted/50 h-auto p-1 gap-1">
                  <TabsTrigger value="exam_clone" className="text-xs py-2 gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">Examen Officiel (Lot)</span>
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="text-xs py-2 gap-1.5">
                    <Upload className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Fichier unique</span>
                  </TabsTrigger>
                  <TabsTrigger value="existing" className="text-xs py-2 gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Bibliothèque</span>
                  </TabsTrigger>
                  <TabsTrigger value="paste" className="text-xs py-2 gap-1.5">
                    <ClipboardPaste className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Copier-Coller</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* =============================================================== */}
              {/* MODE 1 : CLONAGE D'EXAMEN OFFICIEL (PÔLE A + PÔLE B)            */}
              {/* =============================================================== */}
              {sourceMode === "exam_clone" && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="clone-title">Intitulé de l'épreuve (optionnel)</Label>
                    <Input
                      id="clone-title"
                      placeholder="Ex: Anatomie L1 — Le Duodénum & Le Diaphragme"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  {/* PÔLE A : Upload en masse des Cours */}
                  <div className="rounded-xl border-2 border-primary/25 bg-primary/5 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <span>
                            Pôle A — Vos Cours ({batchCourseFiles.length} fichier
                            {batchCourseFiles.length > 1 ? "s" : ""})
                          </span>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Les données médicales et les réponses exactes seront strictement limitées à ces cours.
                        </p>
                      </div>
                      <div>
                        <input
                          id="batch-courses-qcm"
                          type="file"
                          multiple
                          accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,*/*"
                          onChange={handleBatchCoursesChange}
                          className="hidden"
                        />
                        <label htmlFor="batch-courses-qcm">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cursor-pointer gap-1.5"
                            asChild
                          >
                            <span>
                              <FolderPlus className="h-4 w-4 text-primary" />
                              Ajouter des cours
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>

                    {batchCourseFiles.length === 0 ? (
                      <label
                        htmlFor="batch-courses-qcm"
                        className="block border-2 border-dashed border-primary/30 rounded-lg p-4 text-center hover:bg-primary/5 transition-all cursor-pointer"
                      >
                        <Upload className="h-7 w-7 text-primary mx-auto mb-1.5" />
                        <p className="text-xs sm:text-sm font-medium text-foreground">
                          Sélectionnez 1 ou plusieurs fichiers de cours (PDF, PPTX, DOCX)
                        </p>
                      </label>
                    ) : (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {batchCourseFiles.map((cf) => (
                          <div
                            key={cf.name}
                            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm"
                          >
                            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="max-w-[210px] truncate">{cf.name}</span>
                            <button
                              type="button"
                              onClick={() => removeBatchCourseFile(cf.name)}
                              className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                              title="Retirer ce cours"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* PÔLE B : Upload en masse des Évaluations & Examens */}
                  <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-amber-500" />
                          <span>
                            Pôle B — Évaluations & Examens d'Inspiration ({batchExamFiles.length} fichier
                            {batchExamFiles.length > 1 ? "s" : ""})
                          </span>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          L'IA analyse ces annales à la loupe pour cloner la syntaxe, le niveau exact et les pièges du professeur.
                        </p>
                      </div>
                      <div>
                        <input
                          id="batch-exams-qcm"
                          type="file"
                          multiple
                          accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,*/*"
                          onChange={handleBatchExamsChange}
                          className="hidden"
                        />
                        <label htmlFor="batch-exams-qcm">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cursor-pointer gap-1.5 border-amber-500/40"
                            asChild
                          >
                            <span>
                              <FolderPlus className="h-4 w-4 text-amber-500" />
                              Ajouter des examens
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>

                    {batchExamFiles.length === 0 ? (
                      <label
                        htmlFor="batch-exams-qcm"
                        className="block border-2 border-dashed border-amber-500/30 rounded-lg p-4 text-center hover:bg-amber-500/5 transition-all cursor-pointer"
                      >
                        <FolderPlus className="h-7 w-7 text-amber-500 mx-auto mb-1.5" />
                        <p className="text-xs sm:text-sm font-medium text-foreground">
                          Sélectionnez 2, 3 ou plusieurs épreuves d'annales de l'université (PDF, DOCX)
                        </p>
                      </label>
                    ) : (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {batchExamFiles.map((ef) => (
                          <div
                            key={ef.name}
                            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm"
                          >
                            <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <span className="max-w-[210px] truncate">{ef.name}</span>
                            <button
                              type="button"
                              onClick={() => removeBatchExamFile(ef.name)}
                              className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                              title="Retirer cette évaluation"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Paramétrage : Nombre de QCM + Bouton Optionnel de Sélection Multi-Types */}
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-bold text-foreground">
                          Nombre de QCM & Format de l'épreuve
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Le niveau est automatiquement calculé sur vos annales (Pôle B). Par défaut, tous les types présents dans l'examen sont reproduits.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Select value={questionCount} onValueChange={setQuestionCount}>
                          <SelectTrigger className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10 QCM</SelectItem>
                            <SelectItem value="15">15 QCM</SelectItem>
                            <SelectItem value="20">20 QCM (M1)</SelectItem>
                            <SelectItem value="25">25 QCM (Éval)</SelectItem>
                            <SelectItem value="30">30 QCM (Physio)</SelectItem>
                            <SelectItem value="42">42 QCM (Anatomie)</SelectItem>
                            <SelectItem value="50">50 QCM (Intensif)</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          type="button"
                          variant={customizeCloneTypes ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCustomizeCloneTypes((prev) => !prev)}
                          className="gap-1.5 h-10"
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                          <span>
                            {customizeCloneTypes && selectedCloneTypes.length > 0
                              ? `Types (${selectedCloneTypes.length})`
                              : "Choisir les types (Optionnel)"}
                          </span>
                        </Button>
                      </div>
                    </div>

                    {/* Panneau dépliant optionnel pour choisir 1 ou plusieurs types spécifiques (ex: Élection + Censure, Groupage + Jumelage...) */}
                    {customizeCloneTypes && (
                      <div className="pt-3 border-t border-border/60 space-y-3 animate-fade-in">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <p className="text-xs font-medium text-foreground">
                            Sélectionnez un ou plusieurs types à combiner (ex: Élection + Censure, ou Groupage + Jumelage). Si aucun n'est coché, l'IA suit la répartition automatique des annales :
                          </p>
                          {selectedCloneTypes.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedCloneTypes([])}
                              className="h-7 text-xs text-muted-foreground"
                            >
                              Réinitialiser (Auto)
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {OFFICIAL_EXAM_TYPES.map((t) => {
                            const active = selectedCloneTypes.includes(t.id);
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => toggleCloneType(t.id)}
                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                                  active
                                    ? "border-primary bg-primary/10 shadow-sm"
                                    : "border-border bg-background hover:border-primary/40"
                                }`}
                              >
                                <div
                                  className={`mt-0.5 h-4 w-4 rounded flex items-center justify-center border shrink-0 ${
                                    active
                                      ? "bg-primary border-primary text-primary-foreground"
                                      : "border-muted-foreground/40"
                                  }`}
                                >
                                  {active && <Check className="h-3 w-3" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-foreground truncate">
                                    {t.label}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                    {t.desc}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* =============================================================== */}
              {/* MODES 2, 3, 4 : UPLOAD UNIQUE / BIBLIOTHÈQUE / COPIER-COLLER    */}
              {/* =============================================================== */}
              {sourceMode !== "exam_clone" && (
                <>
                  {sourceMode === "upload" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="title">Titre du cours</Label>
                        <Input
                          id="title"
                          placeholder="Ex: Anatomie cardiovasculaire"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="file-upload">Document de cours</Label>
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 sm:p-6 text-center hover:border-primary/50 transition-all cursor-pointer bg-muted/10">
                          <input
                            id="file-upload"
                            type="file"
                            accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,*/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <label htmlFor="file-upload" className="cursor-pointer block w-full">
                            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                            {file ? (
                              <div>
                                <p className="text-foreground font-medium break-all text-sm">
                                  {file.name}
                                </p>
                                <p className="text-muted-foreground text-xs">Fichier sélectionné</p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-foreground font-medium mb-1 text-sm">
                                  Appuyez pour sélectionner
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  PDF, DOC, DOCX, PPT, PPTX ou TXT
                                </p>
                              </div>
                            )}
                          </label>
                        </div>
                      </div>
                    </>
                  )}

                  {sourceMode === "existing" && (
                    <div className="space-y-2">
                      <Label>Sélectionner un cours dans la bibliothèque locale</Label>
                      <Popover open={coursePopoverOpen} onOpenChange={setCoursePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between h-11 border-foreground/30 text-foreground"
                          >
                            <span className="truncate">
                              {selectedCourse ? selectedCourse.title : "Choisir un cours..."}
                            </span>
                            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-0"
                          align="start"
                        >
                          <div className="p-2 border-b">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Rechercher..."
                                value={courseSearchText}
                                onChange={(e) => setCourseSearchText(e.target.value)}
                                className="pl-8 h-9"
                              />
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto p-1">
                            {filteredExistingCourses.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                Aucun cours trouvé
                              </p>
                            ) : (
                              filteredExistingCourses.map((course) => (
                                <button
                                  key={course.id}
                                  onClick={() => {
                                    setSelectedCourseId(course.id);
                                    setCoursePopoverOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between gap-2 ${
                                    selectedCourseId === course.id
                                      ? "bg-primary/10 text-primary"
                                      : ""
                                  }`}
                                >
                                  <div className="truncate">
                                    <p className="font-medium truncate">{course.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(course.created_at).toLocaleDateString("fr-FR")}
                                    </p>
                                  </div>
                                  {selectedCourseId === course.id && (
                                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {sourceMode === "paste" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="paste-title">Titre du cours</Label>
                        <Input
                          id="paste-title"
                          placeholder="Ex: Physiologie de la digestion"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paste-content">Collez le texte du cours</Label>
                        <Textarea
                          id="paste-content"
                          rows={7}
                          placeholder="Collez ici l'intégralité du texte sur lequel les QCM doivent être générés..."
                          value={pastedText}
                          onChange={(e) => setPastedText(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Paramètres manuels pour les modes classiques */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Niveau de difficulté</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        {
                          val: "facile",
                          icon: GraduationCap,
                          label: "Niveau 1 - Facile",
                          desc: "Questions directes basées sur le cours.",
                        },
                        {
                          val: "intermediaire",
                          icon: Target,
                          label: "Niveau 2 - Intermédiaire",
                          desc: "Reformulation intelligente. 1-5 bonnes réponses.",
                        },
                        {
                          val: "difficile",
                          icon: Flame,
                          label: "Niveau 3 - Difficile",
                          desc: "Raisonnement clinique avancé.",
                        },
                      ].map((d) => (
                        <button
                          key={d.val}
                          type="button"
                          onClick={() => setDifficultyLevel(d.val)}
                          className={`p-3 sm:p-4 rounded-xl border-2 transition-all text-left ${
                            difficultyLevel === d.val
                              ? "border-primary bg-primary/10 shadow-md"
                              : "border-muted hover:border-muted-foreground/30"
                          }`}
                        >
                          <div className="flex items-center space-x-2 mb-1">
                            <d.icon className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-foreground text-sm">{d.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{d.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Type de QCM</Label>
                      <Select value={questionType} onValueChange={setQuestionType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="classique">Classique</SelectItem>
                          <SelectItem value="groupage">Groupage</SelectItem>
                          <SelectItem value="election">Élection</SelectItem>
                          <SelectItem value="censure">Censure</SelectItem>
                          <SelectItem value="cas-cliniques">Cas Cliniques</SelectItem>
                          <SelectItem value="vrai-faux">Vrai ou Faux</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Nombre de questions</Label>
                      <Select value={questionCount} onValueChange={setQuestionCount}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 questions</SelectItem>
                          <SelectItem value="10">10 questions</SelectItem>
                          <SelectItem value="15">15 questions</SelectItem>
                          <SelectItem value="20">20 questions</SelectItem>
                          <SelectItem value="25">25 questions</SelectItem>
                          <SelectItem value="30">30 questions</SelectItem>
                          <SelectItem value="50">50 questions</SelectItem>
                          <SelectItem value="infini">♾️ Infini (mode interactif)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Modèle d'IA</Label>
                      <Select value={aiModel} onValueChange={setAiModel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="med2">MED 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              {/* Bouton d'action unique sur une seule ligne */}
              <Button
                onClick={handleGenerateQuiz}
                disabled={isGenerating || isReading || !isReady}
                size="lg"
                className="w-full shadow-medical bg-foreground text-background hover:bg-foreground/90 h-12 sm:h-14 text-sm sm:text-base"
              >
                {isGenerating || isReading ? (
                  <div className="flex items-center space-x-2">
                    <Download className="h-5 w-5 animate-spin" />
                    <span className="truncate">{processingStep || "Analyse..."}</span>
                  </div>
                ) : sourceMode === "exam_clone" ? (
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-amber-400" />
                    <span className="truncate">
                      Générer l'Épreuve Officielle ({questionCount} QCM
                      {customizeCloneTypes && selectedCloneTypes.length > 0
                        ? ` • ${selectedCloneTypes.length} type(s) ciblé(s)`
                        : ` calqués sur ${batchExamFiles.length} annale(s)`}
                      )
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    {getDifficultyIcon(difficultyLevel)}
                    <span className="truncate">
                      {questionCount === "infini"
                        ? "Lancer le mode Infini ♾️"
                        : `Générer le QCM (${questionCount} Q)`}
                    </span>
                  </div>
                )}
              </Button>

              {(isGenerating || isReading) && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {isReading ? "Extraction du texte..." : processingStep || "Traitement..."}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AddCourse;
