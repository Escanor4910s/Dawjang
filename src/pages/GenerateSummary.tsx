import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Upload, FileText, Sparkles, BookOpen, FileSearch, Zap, AlertCircle, Lock, FolderOpen, Search, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFileReader } from "@/hooks/useFileReader";
import { useUserRole } from "@/hooks/useUserRole";
import { PremiumBadge } from "@/components/PremiumBadge";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { invokeWithRetry } from "@/lib/edgeRetry";

type SummaryType = "complete" | "structured" | "concise";

interface ExistingCourse { id: string; title: string; content: string; file_name: string | null; created_at: string; }

const SUMMARY_PLAN_REQUIREMENTS: Record<SummaryType, "gratuit" | "premium"> = {
  concise: "gratuit", structured: "premium", complete: "premium",
};

const summaryTypes = [
  { id: "complete" as SummaryType, title: "Résumé COMPLET", subtitle: "Long & Détaillé", description: "Version détaillée — idéal pour revoir le cours en profondeur",
    details: ["Définitions complètes", "Contexte et physiopathologie", "Clinique détaillée", "Traitements complets"],
    size: "2 à 10 pages", icon: BookOpen, requiredPlan: "premium" as const },
  { id: "structured" as SummaryType, title: "Résumé STRUCTURÉ", subtitle: "Intermédiaire", description: "Version équilibrée — clair, organisé, essentiel",
    details: ["Titres et sous-titres", "Points essentiels", "Tableaux résumés", "Arbres diagnostiques"],
    size: "1 à 3 pages", icon: FileText, requiredPlan: "premium" as const },
  { id: "concise" as SummaryType, title: "Résumé COURT", subtitle: "Fiche Examen", description: "Fiche rapide — résumé ultra concis pour retenir l'essentiel",
    details: ["Points clés uniquement", "Listes à puces", "Diagnostic rapide", "Traitement résumé"],
    size: "5 à 15 lignes", icon: Zap, requiredPlan: "gratuit" as const },
];

const GenerateSummary = () => {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [summaryType, setSummaryType] = useState<SummaryType>("concise");
  const [isGenerating, setIsGenerating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [processingStep, setProcessingStep] = useState("");
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [sourceMode, setSourceMode] = useState<"upload" | "existing">("upload");
  const [existingCourses, setExistingCourses] = useState<ExistingCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseSearchText, setCourseSearchText] = useState("");
  const [coursePopoverOpen, setCoursePopoverOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { readFile, isReading } = useFileReader();
  const { isAdmin, hasAccess } = useUserRole();

  const canAccessType = (type: SummaryType): boolean => {
    if (isAdmin) return true;
    if (SUMMARY_PLAN_REQUIREMENTS[type] === "gratuit") return true;
    return hasAccess("premium");
  };

  const handleTypeChange = (value: string) => {
    const type = value as SummaryType;
    if (!canAccessType(type)) { setShowUpgradePrompt(true); return; }
    setSummaryType(type);
  };

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
    return existingCourses.filter(c => c.title.toLowerCase().includes(courseSearchText.toLowerCase()));
  }, [existingCourses, courseSearchText]);

  const selectedCourse = existingCourses.find(c => c.id === selectedCourseId);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  };

  const handleGenerateSummary = async () => {
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
        courseTitle = title.trim() || selectedCourse.title;
        courseId = selectedCourse.id;
      } else {
        setProcessingStep("Analyse du fichier...");
        const fileResult = await readFile(file!);
        if (!fileResult.success || !fileResult.content) throw new Error(fileResult.error || "Impossible de lire le fichier");
        courseContent = fileResult.content;
        courseTitle = title;
        setProcessingStep("Sauvegarde du cours...");
        const { data: courseData, error: courseError } = await supabase.from("courses").insert({ user_id: user.id, title: courseTitle, content: courseContent, file_name: file!.name }).select().single();
        if (courseError) throw courseError;
        courseId = courseData.id;
      }

      setProcessingStep("Génération du résumé avec l'IA...");
      const { data, error } = await invokeWithRetry<{ summary: string }>("generate-summary", {
        body: { content: courseContent, type: summaryType, title: courseTitle },
        retries: 2,
        onRetry: (attempt, status) => {
          setProcessingStep(`Service IA temporairement indisponible (${status ?? "?"}) — nouvelle tentative ${attempt}/2...`);
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.summary) throw new Error("Aucune réponse de l'IA. Réessayez.");

      setProcessingStep("Sauvegarde du résumé...");
      const { data: summaryData, error: summaryError } = await supabase
        .from("summaries" as any)
        .insert({ user_id: user.id, course_id: courseId, title: courseTitle, content: data.summary, summary_type: summaryType,
          metadata: { generatedAt: new Date().toISOString(), contentLength: courseContent.length },
        }).select().single();
      if (summaryError) throw summaryError;

      toast({ title: "✅ Résumé généré avec succès !", description: `"${courseTitle}" a été créé` });
      navigate(`/summary/${(summaryData as any).id}`);
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Erreur inconnue", variant: "destructive" });
    } finally { setIsGenerating(false); setProcessingStep(""); }
  };

  const isReady = sourceMode === "upload" ? (title.trim() && file) : (selectedCourseId);
  const selectedType = summaryTypes.find((t) => t.id === summaryType);

  return (
    <div className="min-h-screen bg-dashboard bg-doodle-watermark py-6 sm:py-8 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <UpgradePrompt isOpen={showUpgradePrompt} onClose={() => setShowUpgradePrompt(false)} requiredPlan="premium" featureName="Résumés complets et structurés" />
      <div className="container mx-auto px-3 sm:px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6 sm:mb-8 pt-8 sm:pt-0">
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 flex items-center justify-center gap-3">
              <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /><span>Générer un Résumé</span>
            </h1>
            <p className="text-muted-foreground text-sm sm:text-lg">Transformez vos cours en résumés intelligents</p>
          </div>

          <div className="grid gap-4 sm:gap-6">
            {/* Source Card */}
            <Card className="bg-white dark:bg-slate-900 shadow-card border-0">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Upload className="h-5 w-5 text-foreground" /><span>Source du cours</span></CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={sourceMode} onValueChange={(v) => setSourceMode(v as "upload" | "existing")}>
                  <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                    <TabsTrigger value="upload" className="text-xs sm:text-sm"><Upload className="h-4 w-4 mr-1 sm:mr-2" />Nouveau fichier</TabsTrigger>
                    <TabsTrigger value="existing" className="text-xs sm:text-sm"><FolderOpen className="h-4 w-4 mr-1 sm:mr-2" />Cours existant</TabsTrigger>
                  </TabsList>
                </Tabs>

                {sourceMode === "upload" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="title">Titre du résumé</Label>
                      <Input id="title" placeholder="Ex: Cardiologie - Insuffisance cardiaque" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Document de cours</Label>
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 sm:p-6 text-center hover:border-primary/50 transition-all cursor-pointer bg-muted/10">
                        <input id="file-upload-summary" type="file" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,*/*" onChange={handleFileChange} className="hidden" />
                        <label htmlFor="file-upload-summary" className="cursor-pointer block w-full">
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
                  <div className="space-y-3">
                    <Label>Sélectionner un cours uploadé</Label>
                    <Popover open={coursePopoverOpen} onOpenChange={setCoursePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between h-11 border-foreground/30 text-foreground">
                          <span className="truncate">{selectedCourse ? selectedCourse.title : "Choisir un cours..."}</span>
                          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <div className="p-2 border-b"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Rechercher..." value={courseSearchText} onChange={(e) => setCourseSearchText(e.target.value)} className="pl-8 h-9" /></div></div>
                        <div className="max-h-60 overflow-y-auto p-1">
                          {filteredExistingCourses.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Aucun cours trouvé</p> : (
                            filteredExistingCourses.map((course) => (
                              <button key={course.id} onClick={() => { setSelectedCourseId(course.id); setCoursePopoverOpen(false); if (!title.trim()) setTitle(course.title); }}
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
                    <div className="space-y-2">
                      <Label htmlFor="summary-title">Titre du résumé</Label>
                      <Input id="summary-title" placeholder="Titre personnalisé (optionnel)" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary Type Selection */}
            <Card className="bg-white dark:bg-slate-900 shadow-card border-0">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><FileSearch className="h-5 w-5 text-foreground" /><span>Type de Résumé</span></CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={summaryType} onValueChange={handleTypeChange} className="grid gap-3">
                  {summaryTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = summaryType === type.id;
                    const isLocked = !canAccessType(type.id);
                    return (
                      <label key={type.id}
                        className={`relative flex cursor-pointer rounded-xl border-2 p-3 sm:p-4 transition-all hover:shadow-md ${
                          isSelected ? "border-foreground/30 bg-foreground/5 shadow-md" : "border-border hover:border-muted-foreground/50"
                        } ${isLocked ? "opacity-80" : ""}`}
                        onClick={(e) => { if (isLocked) { e.preventDefault(); setShowUpgradePrompt(true); } }}>
                        <RadioGroupItem value={type.id} className="sr-only" disabled={isLocked} />
                        <div className="flex gap-3 sm:gap-4 w-full">
                          <div className="p-2 sm:p-3 rounded-lg bg-foreground/10 self-start">
                            <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-foreground text-sm sm:text-base">{type.title}</h3>
                                  {type.requiredPlan === "premium" && !isAdmin && <PremiumBadge type="premium" size="sm" />}
                                </div>
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{type.subtitle}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
                                <span className="text-[10px] sm:text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{type.size}</span>
                              </div>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{type.description}</p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {type.details.map((detail, i) => (
                                <span key={i} className="text-[10px] sm:text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">✓ {detail}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button onClick={handleGenerateSummary} disabled={isGenerating || isReading || !isReady} size="lg" className="w-full bg-foreground text-background hover:bg-foreground/90 h-12 sm:h-14 text-base sm:text-lg">
              {isGenerating || isReading ? (
                <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 animate-spin" /><span className="truncate">{processingStep || "Analyse..."}</span></div>
              ) : (
                <div className="flex items-center gap-2"><Sparkles className="h-5 w-5" /><span className="truncate">Générer le Résumé {selectedType?.subtitle}</span></div>
              )}
            </Button>

            {(isGenerating || isReading) && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="h-4 w-4" /><span>{processingStep || "Traitement..."}</span></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateSummary;
