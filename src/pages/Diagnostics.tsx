import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ChevronDown, ChevronRight, Activity, Swords } from "lucide-react";

interface DiagnosticRow {
  id: string;
  function_name: string;
  user_id: string | null;
  status: number | null;
  request_payload: any;
  response_payload: any;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

interface DuelRow {
  id: string;
  invite_code: string;
  status: string;
  current_question_index: number;
  question_count: number;
  questions: any;
  creator_score: number;
  opponent_score: number;
  created_at: string;
}

const Diagnostics = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [diagnostics, setDiagnostics] = useState<DiagnosticRow[]>([]);
  const [duels, setDuels] = useState<DuelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    const [diag, du] = await Promise.all([
      (supabase as any).from("edge_diagnostics").select("*").order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("duels").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setDiagnostics(diag.data || []);
    setDuels(du.data || []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin]);

  if (roleLoading) return <div className="p-6 text-muted-foreground">Chargement...</div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Activity className="h-7 w-7" /> Diagnostics interne
            </h1>
            <p className="text-sm text-muted-foreground">Logs des edge functions IA + état des duels (admin uniquement)</p>
          </div>
          <Button onClick={fetchData} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Rafraîchir
          </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5" /> Edge function logs ({diagnostics.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {diagnostics.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun log enregistré pour le moment.</p>
            ) : diagnostics.map((d) => (
              <div key={d.id} className="border border-border rounded-lg p-3 text-sm">
                <button onClick={() => toggle(d.id)} className="w-full flex items-center justify-between gap-2 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    {expanded[d.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Badge variant={d.status && d.status >= 400 ? "destructive" : "outline"} className="font-mono text-xs">
                      {d.status ?? "?"}
                    </Badge>
                    <span className="font-mono font-medium">{d.function_name}</span>
                    {d.error && <span className="text-destructive text-xs truncate max-w-[200px]">{d.error}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString("fr-FR")}</span>
                </button>
                {expanded[d.id] && (
                  <div className="mt-3 grid gap-3">
                    {d.error && <div className="text-xs text-destructive bg-destructive/10 rounded p-2"><strong>Erreur:</strong> {d.error}</div>}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Request payload</p>
                      <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto max-h-40">{JSON.stringify(d.request_payload, null, 2)}</pre>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Response payload</p>
                      <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto max-h-60">{JSON.stringify(d.response_payload, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Swords className="h-5 w-5" /> Duels récents ({duels.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {duels.map((d) => {
              const qCount = Array.isArray(d.questions) ? d.questions.length : 0;
              return (
                <div key={d.id} className="border border-border rounded-lg p-3 text-sm">
                  <button onClick={() => toggle("duel-" + d.id)} className="w-full flex items-center justify-between gap-2 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      {expanded["duel-" + d.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Badge variant="outline" className="font-mono text-xs">{d.invite_code}</Badge>
                      <Badge>{d.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Q {d.current_question_index + 1}/{d.question_count} · stored: {qCount} · scores {d.creator_score}/{d.opponent_score}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString("fr-FR")}</span>
                  </button>
                  {expanded["duel-" + d.id] && (
                    <pre className="mt-3 text-xs bg-muted/50 rounded p-2 overflow-auto max-h-60">{JSON.stringify(d.questions, null, 2)}</pre>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Diagnostics;
