// src/pages/QuizLibrary.tsx
import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Play,
  Calendar,
  Plus,
  Trash2,
  Download,
  FileDown,
  CheckCircle,
  Timer,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Search,
  BookOpen,
  Sparkles,
  Award,
  FolderOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportQuizToPDF, exportQuizListToPDF } from "@/utils/pdfExport";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

interface QCMSession {
  id: string;
  title: string;
  questions: any;
  question_count: number;
  question_type?: string;
  ai_model?: string;
  status: string;
  score?: number;
  total_questions?: number;
  metadata?: any;
  created_at: string;
  courses?: {
    id: string;
    title: string;
    content?: string;
    file_name?: string;
  };
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  election: "Élection (QCU)",
  censure: "Censure (Sauf un)",
  groupage: "Compléments Groupés",
  jumelage: "Jumelage (Cause à effet)",
  association: "Association",
  classique: "Choix Multiples",
  "cas-cliniques": "Cas Cliniques",
  mixte: "Mix Docimologique",
};

export const QuizLibrary = () => {
  const [sessions, setSessions] = useState<QCMSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewLayout, setViewLayout] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");

  // Modal d'édition d'une session (accessible depuis le menu "..." à 3 points)
  const [editingSession, setEditingSession] = useState<QCMSession | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    fetchSessions();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchSessions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("qcm_sessions")
        .select(
          `
          *,
          courses (
            id,
            title,
            content,
            file_name
          )
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger votre bibliothèque de QCM",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("qcm_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast({
        title: "QCM supprimé",
        description:
          "La session a été retirée de votre bibliothèque (le Registre Fantôme conserve l'empreinte pour ne jamais répéter ces questions).",
      });
    } catch (error) {
      console.error("Error deleting session:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer ce QCM",
        variant: "destructive",
      });
    }
  };

  const openEditModal = (session: QCMSession) => {
    setEditingSession(session);
    setEditedTitle(session.title);
  };

  const handleSaveEdit = async () => {
    if (!editingSession || !editedTitle.trim()) return;
    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from("qcm_sessions")
        .update({ title: editedTitle.trim() })
        .eq("id", editingSession.id);

      if (error) throw error;

      setSessions((prev) =>
        prev.map((s) =>
          s.id === editingSession.id ? { ...s, title: editedTitle.trim() } : s
        )
      );
      toast({
        title: "Titre mis à jour",
        description: "Les modifications ont été enregistrées.",
      });
      setEditingSession(null);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le titre",
        variant: "destructive",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  useRealtimeSubscription({
    table: "qcm_sessions",
    event: "*",
    onUpdate: fetchSessions,
  });

  const handleExportPDF = (session: QCMSession) => {
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
        score: session.score,
        totalQuestions: session.total_questions || session.question_count,
      });
      toast({
        title: "PDF téléchargé",
        description: `Le cahier d'épreuve "${session.title}" a été exporté.`,
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le PDF",
        variant: "destructive",
      });
    }
  };

  const handleExportAllPDF = () => {
    try {
      const quizData = filteredSessions.map((session) => ({
        title: session.title,
        score: session.score,
        totalQuestions: session.total_questions || session.question_count,
        questions: Array.isArray(session.questions)
          ? session.questions.map((q: any) => ({
              question: q.question || "",
              choices: q.choices || [],
              correct: q.correct || [],
              explanation: q.explanation,
            }))
          : [],
      }));
      exportQuizListToPDF(quizData);
      toast({
        title: "Récapitulatif PDF généré",
        description: "L'ensemble de votre bibliothèque a été exporté.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de générer le PDF global",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        !searchQuery.trim() ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.courses?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.courses?.file_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        selectedTypeFilter === "all" ||
        (s.question_type || "classique") === selectedTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [sessions, searchQuery, selectedTypeFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-8 bg-doodle-watermark">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="animate-pulse space-y-4">
            <div className="h-28 bg-muted rounded-2xl"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="h-52 bg-muted rounded-2xl"></div>
              <div className="h-52 bg-muted rounded-2xl"></div>
              <div className="h-52 bg-muted rounded-2xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-4 sm:py-8 bg-doodle-watermark">
      <div className="container mx-auto px-3 sm:px-6 max-w-6xl space-y-6">
        {/* EN-TÊTE ÉDITORIAL DE LA BIBLIOTHÈQUE */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-in pt-8 md:pt-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center shadow-button">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  Bibliothèque & Cours QCM
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {sessions.length} série{sessions.length > 1 ? "s" : ""} d'entraînement et d'examen enregistrée{sessions.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Actions principales */}
          <div className="flex flex-wrap items-center gap-2">
            {sessions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAllPDF}
                className="border-foreground/25 hover:bg-foreground/5 h-9"
              >
                <FileDown className="h-4 w-4 mr-1.5" />
                <span>Exporter tout (PDF)</span>
              </Button>
            )}
            <Button
              asChild
              size="sm"
              className="bg-foreground text-background hover:bg-foreground/90 shadow-button h-9 px-4"
            >
              <Link to="/qcm" className="flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                <span>Générer un nouveau QCM</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* BARRE D'OUTILS : RECHERCHE + FILTRES + COMMUTATEUR VUE MOSAÏQUE / VUE ALIGNÉE */}
        {sessions.length > 0 && (
          <Card className="bg-card/90 backdrop-blur border border-border/80 shadow-sm p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Recherche instantanée */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un cours, une série (#1, #2), un fichier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-background/70 border-border"
                />
              </div>

              {/* Filtres de format + Switch Mosaïque (Grid) / Liste Alignée (List) */}
              <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                  {[
                    { id: "all", label: "Tous" },
                    { id: "mixte", label: "Mix FMPOS" },
                    { id: "election", label: "Élection" },
                    { id: "censure", label: "Censure" },
                    { id: "groupage", label: "Groupage" },
                    { id: "jumelage", label: "Jumelage" },
                    { id: "association", label: "Association" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedTypeFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        selectedTypeFilter === tab.id
                          ? "bg-foreground text-background shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Commutateur Mosaïque / Liste Alignée */}
                <div className="flex items-center rounded-lg border border-border bg-background/60 p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewLayout("grid")}
                    className={`p-1.5 rounded-md transition-all ${
                      viewLayout === "grid"
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Affichage en Mosaïque (Cartes)"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewLayout("list")}
                    className={`p-1.5 rounded-md transition-all ${
                      viewLayout === "list"
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Affichage en Liste Alignée"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ÉTAT VIDE */}
        {sessions.length === 0 ? (
          <Card className="bg-gradient-card shadow-card border border-border p-10 text-center">
            <CardContent className="space-y-4 pt-4">
              <div className="bg-muted/60 p-5 rounded-2xl w-20 h-20 mx-auto flex items-center justify-center">
                <FileText className="h-10 w-10 text-foreground/70" />
              </div>
              <h3 className="text-xl font-bold text-foreground">
                Votre bibliothèque de QCM est vide
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Importez votre premier cours (PDF, DOCX ou texte) pour générer une feuille d'examen
                interactive aux normes de la FMPOS.
              </p>
              <Button
                size="lg"
                asChild
                className="bg-foreground text-background hover:bg-foreground/90 shadow-button"
              >
                <Link to="/qcm" className="inline-flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  <span>Créer mon premier QCM</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : filteredSessions.length === 0 ? (
          <Card className="bg-card p-8 text-center">
            <p className="text-muted-foreground text-sm">
              Aucun QCM ne correspond à votre recherche « {searchQuery} ».
            </p>
          </Card>
        ) : viewLayout === "grid" ? (
          /* =================================================================
             1. VUE MOSAÏQUE (CARTES ÉDITORIALES AVEC MENU "..." À 3 POINTS)
             ================================================================= */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredSessions.map((session, index) => {
              const qTypeLabel =
                QUESTION_TYPE_LABELS[session.question_type || ""] ||
                session.question_type ||
                "Série QCM";
              const hasScore =
                session.score !== undefined &&
                session.score !== null &&
                (session.total_questions || session.question_count) > 0;
              const scorePct = hasScore
                ? Math.round(
                    ((session.score || 0) /
                      (session.total_questions || session.question_count)) *
                      100
                  )
                : null;

              return (
                <Card
                  key={session.id}
                  className="bg-gradient-card shadow-card border border-border/80 card-hover flex flex-col justify-between overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}
                >
                  <CardHeader className="p-5 pb-3 space-y-3">
                    {/* Ligne supérieure : Badge de type + Menu 3 points "..." */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <Badge
                        variant="secondary"
                        className="text-[11px] font-semibold px-2.5 py-0.5 bg-foreground/10 text-foreground border border-foreground/15 truncate max-w-[200px]"
                      >
                        {qTypeLabel}
                      </Badge>

                      {/* MENU CONTEXTUEL À TROIS POINTS ("...") */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-foreground/10 text-foreground shrink-0"
                            title="Options du QCM"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel className="text-xs text-muted-foreground truncate">
                            {session.title}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => navigate(`/quiz/${session.id}`)}
                            className="cursor-pointer gap-2"
                          >
                            <BookOpen className="h-4 w-4 text-primary" />
                            <span>Lecture & Feuille QCM</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => navigate(`/exam/${session.id}`)}
                            className="cursor-pointer gap-2"
                          >
                            <Timer className="h-4 w-4 text-warning" />
                            <span>Lancer en Mode Examen</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openEditModal(session)}
                            className="cursor-pointer gap-2"
                          >
                            <Pencil className="h-4 w-4 text-foreground" />
                            <span>Éditer le titre</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleExportPDF(session)}
                            className="cursor-pointer gap-2"
                          >
                            <Download className="h-4 w-4 text-foreground" />
                            <span>Télécharger en PDF</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteSession(session.id)}
                            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Supprimer la session</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Titre de la session */}
                    <CardTitle
                      onClick={() => navigate(`/quiz/${session.id}`)}
                      className="text-base sm:text-lg font-bold leading-snug line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                    >
                      {session.title}
                    </CardTitle>

                    {/* Métadonnées : Date, Nombre de QCM, Score */}
                    <CardDescription className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(session.created_at)}
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-foreground">
                        {session.question_count} Questions
                      </span>
                      {scorePct !== null && (
                        <>
                          <span>•</span>
                          <span
                            className={`font-bold ${
                              scorePct >= 70
                                ? "text-success"
                                : scorePct >= 50
                                ? "text-warning"
                                : "text-destructive"
                            }`}
                          >
                            Score : {scorePct}%
                          </span>
                        </>
                      )}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-4">
                    {/* Aperçu du cours rattaché */}
                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                      {session.courses?.content
                        ? session.courses.content.substring(0, 120) + "..."
                        : session.courses?.file_name
                        ? `Source : ${session.courses.file_name}`
                        : "Feuille d'évaluation docimologique générée à partir de votre cours."}
                    </p>

                    {/* Pied de carte : Actions directes Lecture + Examen */}
                    <div className="pt-3 border-t border-border/60 flex items-center gap-2">
                      <Button
                        asChild
                        size="sm"
                        className="flex-1 bg-foreground text-background hover:bg-foreground/90 h-9 text-xs font-semibold"
                      >
                        <Link
                          to={`/quiz/${session.id}`}
                          className="flex items-center justify-center gap-1.5"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>Ouvrir la feuille</span>
                        </Link>
                      </Button>

                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 border-foreground/25 hover:bg-foreground/10 text-xs"
                        title="Passer en mode Examen chronométré"
                      >
                        <Link
                          to={`/exam/${session.id}`}
                          className="flex items-center justify-center gap-1"
                        >
                          <Timer className="h-3.5 w-3.5" />
                          <span>Examen</span>
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* =================================================================
             2. VUE LISTE ALIGNÉE (TABLEAU COMPACT AVEC MENU "..." À 3 POINTS)
             ================================================================= */
          <div className="space-y-2.5">
            {filteredSessions.map((session, index) => {
              const qTypeLabel =
                QUESTION_TYPE_LABELS[session.question_type || ""] ||
                session.question_type ||
                "Série QCM";
              const hasScore =
                session.score !== undefined &&
                session.score !== null &&
                (session.total_questions || session.question_count) > 0;
              const scorePct = hasScore
                ? Math.round(
                    ((session.score || 0) /
                      (session.total_questions || session.question_count)) *
                      100
                  )
                : null;

              return (
                <Card
                  key={session.id}
                  className="bg-gradient-card shadow-sm border border-border/80 hover:border-foreground/30 transition-all p-3.5 sm:px-5 animate-fade-in"
                  style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-xl bg-foreground/10 text-foreground flex items-center justify-center font-bold text-xs shrink-0">
                        {session.question_count}Q
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            onClick={() => navigate(`/quiz/${session.id}`)}
                            className="font-bold text-sm sm:text-base text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                          >
                            {session.title}
                          </h3>
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-2 py-0 bg-foreground/10 text-foreground"
                          >
                            {qTypeLabel}
                          </Badge>
                          {scorePct !== null && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-success/40 text-success"
                            >
                              <Award className="h-3 w-3 mr-1" />
                              {scorePct}%
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(session.created_at)}
                          </span>
                          {session.courses?.file_name && (
                            <span className="truncate max-w-[220px]">
                              • {session.courses.file_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions alignées à droite + Menu "..." */}
                    <div className="flex items-center justify-end gap-2 shrink-0">
                      <Button
                        asChild
                        size="sm"
                        className="bg-foreground text-background hover:bg-foreground/90 h-8 text-xs px-3"
                      >
                        <Link to={`/quiz/${session.id}`} className="flex items-center gap-1.5">
                          <Play className="h-3.5 w-3.5" />
                          <span>Lecture</span>
                        </Link>
                      </Button>

                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs px-3 border-foreground/25"
                      >
                        <Link to={`/exam/${session.id}`} className="flex items-center gap-1">
                          <Timer className="h-3.5 w-3.5" />
                          <span>Examen</span>
                        </Link>
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-foreground/10"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem
                            onClick={() => navigate(`/quiz/${session.id}`)}
                            className="cursor-pointer gap-2"
                          >
                            <BookOpen className="h-4 w-4 text-primary" />
                            <span>Lecture & Feuille QCM</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => navigate(`/exam/${session.id}`)}
                            className="cursor-pointer gap-2"
                          >
                            <Timer className="h-4 w-4 text-warning" />
                            <span>Mode Examen</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openEditModal(session)}
                            className="cursor-pointer gap-2"
                          >
                            <Pencil className="h-4 w-4" />
                            <span>Éditer le titre</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleExportPDF(session)}
                            className="cursor-pointer gap-2"
                          >
                            <Download className="h-4 w-4" />
                            <span>Télécharger en PDF</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteSession(session.id)}
                            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Supprimer</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL D'ÉDITION DU TITRE DE LA SESSION */}
      <Dialog
        open={Boolean(editingSession)}
        onOpenChange={(open) => !open && setEditingSession(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Éditer la série de QCM</DialogTitle>
            <DialogDescription>
              Modifiez le nom de votre feuille d'évaluation dans la bibliothèque.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder="Titre de la série..."
              onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingSession(null)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSavingEdit || !editedTitle.trim()}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {isSavingEdit ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuizLibrary;
