import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Upload, FileText, Download, Brain, Zap, AlertCircle, GraduationCap, Target, Flame, Search, FolderOpen, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFileReader } from "@/hooks/useFileReader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface ExistingCourse { id: string; title: string; content: string; file_name: string | null; created_at: string; }

const AddCourse = () => {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [questionCount, setQuestionCount] = useState("20");
  const [questionType, setQuestionType] = useState("classique");
  const [difficultyLevel, setDifficultyLevel] = useState("facile");
  const [aiModel, setAiModel] = useState("med2");
  const [isGenerating, setIsGenerating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [processingStep, setProcessingStep] = useState("");
  const [sourceMode, setSourceMode] = useState<"upload" | "existing">("upload");
  const [existingCourses, setExistingCourses] = useState<ExistingCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseSearchText, setCourseSearchText] = useState("");
  const [coursePopoverOpen, setCoursePopoverOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { readFile, isReading } = useFileReader();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast({ title: "Connexion requise", variant: "destructive" }); navigate("/auth"); return; }
      setUser(user);
    };
    checkUser();
  }, [navigate, toast]);

  const fetchExistingCourses = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("courses").select("id, title, content, file_name, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    
    const uniqueCourses: ExistingCourse[] = [];
    const seenTitles = new Set<string>();
    
    (data || []).forEach(course => {
      const baseTitle = course.title.replace(/\s*\(Session\s*\d+\)\s*$/i, '').trim();
      const baseTitleLower = baseTitle.toLowerCase();
      if (!seenTitles.has(baseTitleLower)) {
        seenTitles.add(baseTitleLower);
        uniqueCourses.push({ ...course, title: baseTitle });
      }
    });
    
    setExistingCourses(uniqueCourses);
  }, [user]);

  useEffect(() => { if (user) fetchExistingCourses(); }, [user, fetchExistingCourses]);

  const filteredExistingCourses = useMemo(() => {
    if (!courseSearchText.trim()) return existingCourses;
    const q = courseSearchText.toLowerCase();
    return existingCourses.filter(c => c.title.toLowerCase().includes(q));
  }, [existingCourses, courseSearchText]);

  const selectedCourse = existingCourses.find(c => c.id === selectedCourseId);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  };

  const getDifficultyIcon = (level: string) => {
    switch (level) {
      case "facile": return <GraduationCap className="h-4 w-4 text-success" />;
      case "intermediaire": return <Target className="h-4 w-4 text-warning" />;
      case "difficile": return <Flame className="h-4 w-4 text-destructive" />;
      default: return <GraduationCap className="h-4 w-4" />;
    }
  };

  const getDifficultyLabel = (level: string) => {
    switch (level) {
      case "facile": return "Facile"; case "intermediaire": return "Intermédiaire"; case "difficile": return "Difficile"; default: return level;
    }
  };

  const normalizeTitle = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*\(session\s*\d+\)\s*$/i, '');

  const getUniqueSessionTitle = async (baseTitle: string, userId: string): Promise<string> => {
    const normalizedBase = normalizeTitle(baseTitle);
    const { data: existingCourses } = await supabase.from("courses").select("title").eq("user_id", userId);
    if (!existingCourses || existingCourses.length === 0) return baseTitle;
    const matchingCourses = existingCourses.filter(course => { const n = normalizeTitle(course.title); return n === normalizedBase || n.startsWith(normalizedBase); });
    if (matchingCourses.length === 0) return baseTitle;
    const sessionNumbers = matchingCourses.map(course => { const match = course.title.match(/\(Session\s*(\d+)\)\s*$/i); return match ? parseInt(match[1]) : 1; });
    return `${baseTitle} (Session ${Math.max(...sessionNumbers) + 1})`;
  };

  const handleGenerateQuiz = async () => {
    // Validate based on source mode
    if (sourceMode === "upload" && (!title.trim() || !file)) {
      toast({ title: "Champs requis", description: "Remplissez le titre et sélectionnez un fichier", variant: "destructive" });
      return;
    }
    if (sourceMode === "existing" && !selectedCourseId) {
      toast({ title: "Champs requis", description: "Sélectionnez un cours existant", variant: "destructive" });
      return;
    }
    if (!user) return;

    setIsGenerating(true);
    setProcessingStep("Préparation...");

    try {
      let courseContent: string;
      let courseTitle: string;
      let courseId: string;

      if (sourceMode === "existing" && selectedCourse) {
        courseContent = selectedCourse.content;
        courseTitle = selectedCourse.title;
        courseId = selectedCourse.id;
      } else {
        setProcessingStep("Analyse du fichier...");
        const fileResult = await readFile(file!);
        if (!fileResult.success || !fileResult.content) throw new Error(fileResult.error || "Impossible de lire le fichier");

        courseContent = fileResult.content;
        setProcessingStep("Vérification des doublons...");
        courseTitle = await getUniqueSessionTitle(title, user.id);

        setProcessingStep("Sauvegarde du cours...");
        const { data: courseData, error: courseError } = await supabase.from("courses").insert({ user_id: user.id, title: courseTitle, content: courseContent, file_name: file!.name }).select().single();
        if (courseError) throw courseError;
        courseId = courseData.id;
      }

      // Mode INFINI : redirige vers la session interactive
      if (questionCount === "infini") {
        toast({ title: "♾️ Mode infini", description: "Lancement de la session interactive..." });
        navigate(`/quiz-infini/${courseId}?type=${questionType}&difficulty=${difficultyLevel}`);
        return;
      }

      setProcessingStep("Génération des QCM avec l'IA...");
      const { data, error } = await supabase.functions.invoke("generate-quiz-openai", {
        body: { content: courseContent, nbQuestions: parseInt(questionCount), type: questionType, difficulty: difficultyLevel },
      });

      if (error) throw new Error(`Erreur: ${error.message}`);
      if (!data?.qcm || !Array.isArray(data.qcm)) throw new Error("Format de réponse invalide");

      const validQuestions = data.qcm.filter((q: any) => q.question && Array.isArray(q.choices) && q.choices.length >= 2 && Array.isArray(q.correct) && q.correct.length > 0);
      if (validQuestions.length === 0) throw new Error("Aucune question valide générée");

      setProcessingStep("Sauvegarde de la session...");
      const { data: sessionData, error: sessionError } = await supabase.from("qcm_sessions").insert({
        user_id: user.id, course_id: courseId, title: courseTitle, questions: validQuestions, status: "completed",
        question_count: validQuestions.length, question_type: questionType, ai_model: "MED 2 (Gemini Flash)",
        metadata: { originalQuestionCount: parseInt(questionCount), generatedAt: new Date().toISOString(), difficulty: difficultyLevel },
      }).select().single();

      if (sessionError) throw sessionError;

      toast({ title: "✅ QCM créé !", description: `${validQuestions.length} questions ${getDifficultyLabel(difficultyLevel)}` });
      navigate(`/quiz/${sessionData.id}`);
    } catch (error) {
      console.error("Error:", error);
      setProcessingStep("");
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Erreur inconnue", variant: "destructive" });
    } finally { setIsGenerating(false); setProcessingStep(""); }
  };

  const isReady = sourceMode === "upload" ? (title.trim() && file) : selectedCourseId;

  return (
    <div className="min-h-screen bg-dashboard bg-doodle-watermark py-6 sm:py-8 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="container mx-auto px-3 sm:px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6 sm:mb-8 pt-8 sm:pt-0">
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 flex items-center justify-center space-x-2">
              <Download className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /><span>Générer un QCM</span>
            </h1>
            <p className="text-muted-foreground text-sm sm:text-lg">Créez un QCM personnalisé</p>
          </div>

          <Card className="bg-white dark:bg-slate-900 shadow-card border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2"><Upload className="h-5 w-5 text-primary" /><span>Configuration du QCM</span></CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Source mode selector */}
              <Tabs value={sourceMode} onValueChange={(v) => setSourceMode(v as "upload" | "existing")}>
                <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                  <TabsTrigger value="upload" className="text-xs sm:text-sm"><Upload className="h-4 w-4 mr-1 sm:mr-2" />Nouveau fichier</TabsTrigger>
                  <TabsTrigger value="existing" className="text-xs sm:text-sm"><FolderOpen className="h-4 w-4 mr-1 sm:mr-2" />Cours existant</TabsTrigger>
                </TabsList>
              </Tabs>

              {sourceMode === "upload" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="title">Titre du cours</Label>
                    <Input id="title" placeholder="Ex: Anatomie cardiovasculaire" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file-upload">Document de cours</Label>
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 sm:p-6 text-center hover:border-primary/50 transition-all cursor-pointer bg-muted/10">
                      <input id="file-upload" type="file" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,*/*" onChange={handleFileChange} className="hidden" capture={false as any} />
                      <label htmlFor="file-upload" className="cursor-pointer block w-full">
                        <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        {file ? (
                          <div><p className="text-foreground font-medium break-all text-sm">{file.name}</p><p className="text-muted-foreground text-xs">Fichier sélectionné</p></div>
                        ) : (
                          <div><p className="text-foreground font-medium mb-1 text-sm">Appuyez pour sélectionner</p><p className="text-muted-foreground text-xs">PDF, DOC, DOCX, PPT, PPTX ou TXT</p></div>
                        )}
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Sélectionner un cours uploadé</Label>
                  <Popover open={coursePopoverOpen} onOpenChange={setCoursePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between h-11 border-foreground/30 text-foreground">
                        <span className="truncate">{selectedCourse ? selectedCourse.title : "Choisir un cours..."}</span>
                        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="p-2 border-b">
                        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Rechercher..." value={courseSearchText} onChange={(e) => setCourseSearchText(e.target.value)} className="pl-8 h-9" /></div>
                      </div>
                      <div className="max-h-60 overflow-y-auto p-1">
                        {filteredExistingCourses.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Aucun cours trouvé</p> : (
                          filteredExistingCourses.map((course) => (
                            <button key={course.id} onClick={() => { setSelectedCourseId(course.id); setCoursePopoverOpen(false); }}
                              className={`w-full text-left px-3 py-2.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between gap-2 ${selectedCourseId === course.id ? "bg-primary/10 text-primary" : ""}`}>
                              <div className="truncate">
                                <p className="font-medium truncate">{course.title}</p>
                                <p className="text-xs text-muted-foreground">{new Date(course.created_at).toLocaleDateString("fr-FR")}</p>
                              </div>
                              {selectedCourseId === course.id && <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />}
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Difficulty */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Niveau de difficulté</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { val: "facile", icon: GraduationCap, color: "success", label: "Niveau 1 - Facile", desc: "Questions directes basées sur le cours." },
                    { val: "intermediaire", icon: Target, color: "warning", label: "Niveau 2 - Intermédiaire", desc: "Reformulation intelligente. 1-5 bonnes réponses." },
                    { val: "difficile", icon: Flame, color: "destructive", label: "Niveau 3 - Difficile", desc: "Raisonnement clinique + connaissances externes." },
                  ].map(d => (
                    <button key={d.val} type="button" onClick={() => setDifficultyLevel(d.val)}
                      className={`p-3 sm:p-4 rounded-xl border-2 transition-all text-left ${difficultyLevel === d.val ? `border-${d.color} bg-${d.color}/10 shadow-md` : "border-muted hover:border-muted-foreground/30"}`}>
                      <div className="flex items-center space-x-2 mb-1">
                        <d.icon className={`h-4 w-4 text-${d.color}`} /><span className="font-semibold text-foreground text-sm">{d.label}</span>
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
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classique"><div className="flex items-center space-x-2"><BookOpen className="h-4 w-4 text-primary" /><span>Classique</span></div></SelectItem>
                      <SelectItem value="groupage"><div className="flex items-center space-x-2"><Brain className="h-4 w-4 text-primary" /><span>Groupage</span></div></SelectItem>
                      <SelectItem value="election"><div className="flex items-center space-x-2"><CheckCircle className="h-4 w-4 text-success" /><span>Élection</span></div></SelectItem>
                      <SelectItem value="censure"><div className="flex items-center space-x-2"><XCircle className="h-4 w-4 text-destructive" /><span>Censure</span></div></SelectItem>
                      <SelectItem value="cas-cliniques"><div className="flex items-center space-x-2"><FileText className="h-4 w-4 text-primary" /><span>Cas Cliniques</span></div></SelectItem>
                      <SelectItem value="vrai-faux"><div className="flex items-center space-x-2"><Target className="h-4 w-4 text-primary" /><span>Vrai ou Faux</span></div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nombre de questions</Label>
                  <Select value={questionCount} onValueChange={setQuestionCount}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 questions</SelectItem>
                      <SelectItem value="10">10 questions</SelectItem>
                      <SelectItem value="15">15 questions</SelectItem>
                      <SelectItem value="20">20 questions</SelectItem>
                      <SelectItem value="30">30 questions</SelectItem>
                      <SelectItem value="50">50 questions</SelectItem>
                      <SelectItem value="infini">♾️ Infini (mode interactif)</SelectItem>
                    </SelectContent>
                  </Select>
                  {questionCount === "infini" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Mode interactif : l'IA génère et corrige les questions une à une jusqu'à votre arrêt.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Modèle d'IA</Label>
                  <Select value={aiModel} onValueChange={setAiModel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="med2"><div className="flex items-center space-x-2"><Zap className="h-4 w-4 text-primary" /><span>MED 2</span></div></SelectItem></SelectContent>
                  </Select>
                </div>
              </div>

              {/* Type info */}
              <div className="bg-muted/50 p-3 sm:p-4 rounded-lg space-y-2">
                {questionType === "groupage" && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-xs text-muted-foreground"><strong>QCM Groupage :</strong> 5 propositions numérotées. Réponses codées : A=1+2+3, B=1+3, C=2+4, D=4 seul, E=autre combinaison.</p>
                  </div>
                )}
                {questionType === "election" && (
                  <div className="p-3 bg-success/5 rounded-lg border border-success/20">
                    <p className="text-xs text-muted-foreground"><strong>Élection :</strong> Choisissez la seule bonne réponse parmi 5 propositions (A-E).</p>
                  </div>
                )}
                {questionType === "censure" && (
                  <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                    <p className="text-xs text-muted-foreground"><strong>Censure :</strong> Identifiez la seule mauvaise réponse parmi 5 propositions (A-E).</p>
                  </div>
                )}
                {questionType === "classique" && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-xs text-muted-foreground"><strong>Classique :</strong> 5 propositions (A-E), 1 à 5 bonnes réponses possibles.</p>
                  </div>
                )}
              </div>

              <Button onClick={handleGenerateQuiz} disabled={isGenerating || isReading || !isReady} size="lg" className="w-full shadow-medical bg-foreground text-background hover:bg-foreground/90">
                {isGenerating || isReading ? (
                  <div className="flex items-center space-x-2"><Download className="h-5 w-5 animate-spin" /><span className="truncate">{processingStep || "Analyse..."}</span></div>
                ) : (
                  <div className="flex items-center space-x-2">{getDifficultyIcon(difficultyLevel)}<span className="truncate">{questionCount === "infini" ? "Lancer le mode Infini ♾️" : `Créer le QCM (${questionCount} Q)`}</span></div>
                )}
              </Button>

              {(isGenerating || isReading) && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" /><span className="truncate">{isReading ? "Extraction du texte..." : processingStep || "Traitement..."}</span>
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
