import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Play, Calendar, Plus, Trash2, Download, FileDown, CheckCircle, Timer } from "lucide-react";
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
  created_at: string;
  courses?: {
    id: string;
    title: string;
    content?: string;
    file_name?: string;
  };
}

export const QuizLibrary = () => {
  const [sessions, setSessions] = useState<QCMSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    fetchSessions();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("qcm_sessions")
        .select(`
          *,
          courses (
            id,
            title,
            content,
            file_name
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les QCM",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      // Archive l'examen sous le statut 'deleted_memory' au lieu de détruire son empreinte :
      // il disparaît de la bibliothèque mais l'IA garde la trace des questions pour ne jamais les reposer !
      const { error } = await supabase
        .from("qcm_sessions")
        .update({ status: "deleted_memory" })
        .eq("id", sessionId);

      if (error) throw error;

      setSessions(sessions.filter(session => session.id !== sessionId));
      toast({
        title: "QCM supprimé",
        description: "Le QCM a été supprimé avec succès",
      });
    } catch (error) {
      console.error("Error deleting session:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le QCM",
        variant: "destructive",
      });
    }
  };

  // Real-time subscription for QCM updates
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
      });
      toast({
        title: "PDF généré",
        description: "Le QCM a été exporté avec succès",
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
      const quizData = sessions.map(session => ({
        title: session.title,
        questions: Array.isArray(session.questions) ? session.questions.map((q: any) => ({
          question: q.question || "",
          choices: q.choices || [],
          correct: q.correct || [],
          explanation: q.explanation,
        })) : [],
      }));
      exportQuizListToPDF(quizData);
      toast({
        title: "PDF généré",
        description: "Le récapitulatif a été exporté avec succès",
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded-lg"></div>
            <div className="h-64 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-foreground mb-4 flex items-center justify-center space-x-2">
                <FileText className="h-8 w-8 text-primary" />
                <span>Mes QCM</span>
              </h1>
              <p className="text-muted-foreground text-lg">
                Retrouvez tous vos questionnaires générés
              </p>
            </div>

            <Card className="bg-gradient-card shadow-card border-0 p-8">
              <CardContent className="text-center">
                <div className="bg-muted/50 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-4">
                  Aucun QCM créé pour l'instant
                </h3>
                <p className="text-muted-foreground mb-6">
                  Ajoutez votre premier cours pour commencer à générer des questionnaires
                </p>
                <Button size="lg" asChild className="shadow-medical">
                  <Link to="/add-course" className="flex items-center space-x-2">
                    <Plus className="h-5 w-5" />
                    <span>Créer mon premier QCM</span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-4 sm:py-8 bg-doodle-watermark">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header - Mobile optimized */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8 animate-fade-in">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-4xl font-bold text-foreground flex items-center gap-2">
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
                <span>Mes QCM</span>
              </h1>
              <p className="text-sm sm:text-lg text-muted-foreground">
                {sessions.length} questionnaire{sessions.length > 1 ? 's' : ''} disponible{sessions.length > 1 ? 's' : ''}
              </p>
            </div>
            
            {/* Buttons - Stack on mobile, row on desktop */}
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={handleExportAllPDF} 
                className="flex-1 sm:flex-none"
                size="sm"
              >
                <FileDown className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Exporter tout</span>
              </Button>
              <Button asChild className="shadow-medical flex-1 sm:flex-none" size="sm">
                <Link to="/add-course" className="flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Nouveau</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Quiz Cards - Improved mobile layout */}
          <div className="grid gap-4 sm:gap-6">
            {sessions.map((session, index) => (
              <Card 
                key={session.id} 
                className="bg-gradient-card shadow-card border-0 card-hover animate-slide-up overflow-hidden"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
                  {/* Title row with delete button */}
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base sm:text-xl line-clamp-2 flex-1">
                      {session.title}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSession(session.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Meta info - wrap on mobile */}
                  <CardDescription className="text-xs sm:text-sm mt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="truncate">{formatDate(session.created_at)}</span>
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {session.question_count} Q
                      </Badge>
                      {session.courses?.file_name && (
                        <Badge variant="outline" className="text-xs max-w-[120px] truncate hidden sm:inline-flex">
                          {session.courses.file_name}
                        </Badge>
                      )}
                    </div>
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="p-4 sm:p-6 pt-0">
                  {/* Content preview - hidden on mobile for cleaner look */}
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-4 hidden sm:block">
                    {session.courses?.content ? session.courses.content.substring(0, 150) : "Contenu non disponible"}...
                  </p>
                  
                  {/* Status and actions - mobile optimized */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-success text-success-foreground text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {session.status === "completed" ? "Complété" : "En cours"}
                      </Badge>
                      {session.ai_model && (
                        <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
                          {session.ai_model}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Action buttons - full width on mobile */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportPDF(session)}
                        className="flex-1 sm:flex-none"
                      >
                        <Download className="h-4 w-4 sm:mr-1" />
                        <span className="sm:inline">PDF</span>
                      </Button>
                      <Button asChild className="shadow-medical flex-1 sm:flex-none">
                        <Link to={`/quiz/${session.id}`} className="flex items-center justify-center gap-1">
                          <Play className="h-4 w-4" />
                          <span>Commencer</span>
                        </Link>
                      </Button>
                      <Button asChild variant="secondary" className="flex-1 sm:flex-none">
                        <Link to={`/exam/${session.id}`} className="flex items-center justify-center gap-1">
                          <Timer className="h-4 w-4" />
                          <span>Examen</span>
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizLibrary;
