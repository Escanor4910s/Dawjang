import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSearch, Plus, Trash2, Eye, BookOpen, FileText, Zap, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Summary { id: string; title: string; summary_type: string; content: string; created_at: string; }

const typeConfig: Record<string, { icon: React.ElementType; label: string }> = {
  complete: { icon: BookOpen, label: "Complet" },
  structured: { icon: FileText, label: "Structuré" },
  concise: { icon: Zap, label: "Concis" },
};

const Summaries = () => {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const fetchSummaries = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data, error } = await supabase.from("summaries" as any).select("id, title, summary_type, content, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      setSummaries((data as unknown as Summary[]) || []);
    } catch { toast.error("Erreur lors du chargement"); }
    finally { setLoading(false); setRefreshing(false); }
  }, [navigate]);

  useEffect(() => { fetchSummaries(); }, [fetchSummaries]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("summaries" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Résumé supprimé");
      fetchSummaries();
    } catch { toast.error("Erreur lors de la suppression"); }
  };

  const handleRefresh = async () => { setRefreshing(true); await fetchSummaries(); toast.success("Actualisé !"); };

  if (loading) {
    return (<div className="container mx-auto p-6"><div className="animate-pulse space-y-4"><div className="h-32 bg-muted rounded-lg"></div><div className="h-64 bg-muted rounded-lg"></div></div></div>);
  }

  return (
    <div className="min-h-screen text-foreground font-sans px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-8 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6 relative z-10">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-foreground">Mes Résumés</h1>
            <p className="text-sm font-medium text-muted-foreground mt-2">Vos résumés générés par l'IA</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto justify-center sm:justify-end mt-4 sm:mt-0">
            <Button onClick={() => navigate("/generate-summary")} className="h-12 px-6 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-md flex-1 sm:flex-none">
              <Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Nouveau résumé</span><span className="sm:hidden">Nouveau</span>
            </Button>
            <Button onClick={handleRefresh} variant="outline" disabled={refreshing} className="h-12 w-12 rounded-full border-border hover:bg-muted text-foreground flex-shrink-0">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

      {summaries.length === 0 ? (
        <Card className="bg-card/40 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] p-8 mt-12">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="bg-card/60 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center border border-border">
              <FileSearch className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-light text-foreground mb-2">Aucun résumé</h3>
            <p className="text-sm font-medium text-muted-foreground mb-8 text-center max-w-md">Créez votre premier résumé intelligent</p>
            <Button onClick={() => navigate("/generate-summary")} className="h-14 px-8 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-md">
              <Plus className="h-5 w-5 mr-2" />Créer un résumé
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {summaries.map((summary, index) => {
            const config = typeConfig[summary.summary_type] || typeConfig.structured;
            const Icon = config.icon;
            return (
              <Card key={summary.id} className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] hover:shadow-md transition-all duration-300 animate-fade-in overflow-hidden" style={{ animationDelay: `${index * 80}ms` }}>
                <CardHeader className="p-6 border-b border-border">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="p-2.5 rounded-xl bg-muted flex-shrink-0"><Icon className="h-5 w-5 text-muted-foreground" /></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-muted text-muted-foreground">{config.label}</span>
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-medium leading-tight line-clamp-2">{summary.title}</CardTitle>
                  <CardDescription className="text-xs font-medium text-muted-foreground/80 mt-1">{new Date(summary.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-6 bg-card/30">
                  <p className="text-sm font-medium text-muted-foreground line-clamp-2 mb-6">{summary.content.substring(0, 100)}...</p>
                  <div className="flex gap-3">
                    <Button className="flex-1 h-11 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-md" onClick={() => navigate(`/summary/${summary.id}`)}>
                      <Eye className="h-4 w-4 mr-2" />Voir
                    </Button>
                    <Button variant="outline" onClick={() => handleDelete(summary.id)} className="h-11 w-11 rounded-full border-destructive/20 text-destructive hover:bg-destructive/10 p-0 flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};

export default Summaries;
