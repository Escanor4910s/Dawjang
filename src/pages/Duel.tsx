import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Copy, Users, Zap, Trophy, ArrowRight, Hash, BookOpen, History, Clock, Medal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDuel, DuelQuestion } from "@/hooks/useDuel";
import { normalizeDuelQuestions } from "@/lib/duelQuestion";

interface DuelHistoryItem {
  id: string;
  status: string;
  creator_id: string;
  creator_score: number;
  opponent_score: number;
  question_count: number;
  created_at: string;
  completed_at: string | null;
}

const Duel = () => {
  const navigate = useNavigate();
  const { createDuel, joinDuel, cancelDuel, loading, userId } = useDuel();
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [questionCount, setQuestionCount] = useState("5");
  const [sourceType, setSourceType] = useState<"existing" | "ai">("existing");
  const [selectedQcmId, setSelectedQcmId] = useState<string>("");
  const [qcmSessions, setQcmSessions] = useState<{ id: string; title: string; questions: unknown[] }[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [createdDuelId, setCreatedDuelId] = useState("");
  const [duelHistory, setDuelHistory] = useState<DuelHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("qcm_sessions")
      .select("id, title, questions")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          setQcmSessions(
            data.map((s) => ({
              id: s.id,
              title: s.title,
              questions: Array.isArray(s.questions) ? s.questions : [],
            }))
          );
        }
      });

    // Fetch duel history
    setHistoryLoading(true);
    (supabase as any)
      .from("duels")
      .select("id, status, creator_id, creator_score, opponent_score, question_count, created_at, completed_at")
      .or(`creator_id.eq.${userId},opponent_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }: any) => {
        if (data) setDuelHistory(data as DuelHistoryItem[]);
        setHistoryLoading(false);
      });
  }, [userId]);

  // Subscribe to created duel to detect opponent joining
  useEffect(() => {
    if (!createdDuelId) return;
    const channel = supabase
      .channel(`waiting-duel-${createdDuelId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "duels",
        filter: `id=eq.${createdDuelId}`,
      }, (payload) => {
        const updated = payload.new as { status: string };
        if (updated.status === "active") {
          toast.success("Adversaire trouvé ! Le duel commence !");
          navigate(`/duel/${createdDuelId}`);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [createdDuelId, navigate]);

  const handleCreate = async () => {
    const count = parseInt(questionCount);
    let questions: DuelQuestion[] = [];

    if (sourceType === "existing" && selectedQcmId) {
      const session = qcmSessions.find((s) => s.id === selectedQcmId);
      if (!session) return toast.error("QCM introuvable");
      const allQuestions = normalizeDuelQuestions(session.questions);
      if (allQuestions.length === 0) {
        return toast.error("Ce QCM ne contient aucune question valide");
      }
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      questions = shuffled.slice(0, count);
    } else if (sourceType === "existing" && !selectedQcmId) {
      return toast.error("Sélectionnez un QCM");
    }

    if (questions.length < count) {
      return toast.error(`Pas assez de questions valides (${questions.length} disponibles)`);
    }

    const duelId = await createDuel(count, questions, sourceType, selectedQcmId || undefined);
    if (duelId) {
      const { data } = await (supabase as any).from("duels").select("invite_code").eq("id", duelId).single();
      if (data) {
        setCreatedCode((data as any).invite_code);
        setCreatedDuelId(duelId);
      }
    }
  };

  const handleJoin = async () => {
    if (inviteCode.length < 4) return toast.error("Code invalide");
    const duelId = await joinDuel(inviteCode);
    if (duelId) {
      navigate(`/duel/${duelId}`);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(createdCode);
    toast.success("Code copié !");
  };

  const handleCancelWaiting = async () => {
    if (!createdDuelId) return;
    const ok = await cancelDuel(createdDuelId);
    if (ok) {
      setCreatedCode("");
      setCreatedDuelId("");
      setMode("menu");
    }
  };

  const handleDeleteHistoryItem = async (id: string, status: string) => {
    if (status !== "waiting") {
      toast.error("Seuls les duels en attente peuvent être supprimés (les terminés sont archivés)");
      return;
    }
    const { error } = await (supabase as any).from("duels").delete().eq("id", id);
    if (error) { toast.error("Suppression impossible"); return; }
    setDuelHistory((prev) => prev.filter((d) => d.id !== id));
    toast.success("Duel supprimé");
  };

  const handleClearWaitingHistory = async () => {
    if (!userId) return;
    const waitingIds = duelHistory.filter((d) => d.status === "waiting" && d.creator_id === userId).map((d) => d.id);
    if (waitingIds.length === 0) { toast.info("Aucun duel en attente à supprimer"); return; }
    const { error } = await (supabase as any).from("duels").delete().in("id", waitingIds);
    if (error) { toast.error("Erreur"); return; }
    setDuelHistory((prev) => prev.filter((d) => !waitingIds.includes(d.id)));
    toast.success(`${waitingIds.length} duel(s) en attente supprimé(s)`);
  };

  const getDuelResult = (d: DuelHistoryItem) => {
    if (d.status !== "completed") return { label: d.status === "waiting" ? "En attente" : "En cours", color: "text-warning" };
    const myScore = d.creator_id === userId ? d.creator_score : d.opponent_score;
    const theirScore = d.creator_id === userId ? d.opponent_score : d.creator_score;
    if (myScore > theirScore) return { label: "Victoire", color: "text-green-600" };
    if (myScore < theirScore) return { label: "Défaite", color: "text-destructive" };
    return { label: "Égalité", color: "text-muted-foreground" };
  };

  return (
    <div className="min-h-screen bg-dashboard text-foreground bg-doodle-watermark font-sans px-4 pt-1 pb-6 sm:px-8 sm:pt-4 sm:pb-8 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[1400px] mx-auto space-y-6 relative z-10"
      >
        {/* Header */}
        <div className="text-center space-y-2 pt-8 sm:pt-0">
          <div className="flex items-center justify-center gap-3">
            <Swords className="h-10 w-10 text-primary" />
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-foreground">Mode Duel</h1>
          </div>
          <p className="text-sm font-medium text-muted-foreground mt-2">
            Défiez un ami sur des QCM en temps réel !
          </p>
        </div>

        <AnimatePresence mode="wait">
          {/* Main Menu */}
          {mode === "menu" && (
            <motion.div
              key="menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <Card className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] hover:shadow-md transition-all duration-300 cursor-pointer"
                    onClick={() => setMode("create")}>
                <CardContent className="p-6 sm:p-8 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Zap className="h-6 w-6 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-medium text-foreground mb-1">Créer un duel</h3>
                    <p className="text-sm text-muted-foreground truncate">Générez un code et invitez un ami</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>

              <Card className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] hover:shadow-md transition-all duration-300 cursor-pointer"
                    onClick={() => setMode("join")}>
                <CardContent className="p-6 sm:p-8 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Users className="h-6 w-6 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-medium text-foreground mb-1">Rejoindre un duel</h3>
                    <p className="text-sm text-muted-foreground truncate">Entrez le code d'invitation</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>

              {/* Duel History */}
              <Card className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] overflow-hidden">
                <CardHeader className="p-6 border-b border-border flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" /> Historique
                  </CardTitle>
                  {duelHistory.some((d) => d.status === "waiting" && d.creator_id === userId) && (
                    <Button variant="ghost" size="sm" onClick={handleClearWaitingHistory} className="h-8 rounded-full text-xs text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3 w-3 mr-1" /> Vider l'attente
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-6">
                  {historyLoading ? (
                    <div className="animate-pulse space-y-3">
                      {[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-xl" />)}
                    </div>
                  ) : duelHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Aucun duel joué. Lancez votre premier défi !</p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                      {duelHistory.map((d, idx) => {
                        const result = getDuelResult(d);
                        const myScore = d.creator_id === userId ? d.creator_score : d.opponent_score;
                        const theirScore = d.creator_id === userId ? d.opponent_score : d.creator_score;
                        const canDelete = d.status === "waiting" && d.creator_id === userId;
                        return (
                          <motion.div
                            key={d.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border hover:bg-background transition-colors group shadow-sm"
                          >
                            <div
                              className="flex items-center gap-4 flex-1 cursor-pointer min-w-0"
                              onClick={() => d.status !== "waiting" && navigate(`/duel/${d.id}`)}
                            >
                              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                {result.label === "Victoire" ? <Trophy className="h-5 w-5 text-success" /> :
                                 result.label === "Défaite" ? <Swords className="h-5 w-5 text-destructive" /> :
                                 <Clock className="h-5 w-5 text-warning" />}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-sm font-semibold truncate ${result.color}`}>{result.label}</p>
                                <p className="text-xs font-medium text-muted-foreground/80 truncate mt-0.5">
                                  {new Date(d.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                                  {" · "}{d.question_count}Q
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                              {d.status === "completed" && (
                                <Badge variant="outline" className="text-xs font-bold font-mono px-2 py-1 bg-muted border-0">
                                  {myScore} - {theirScore}
                                </Badge>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 opacity-60 group-hover:opacity-100"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteHistoryItem(d.id, d.status); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* How it works */}
              <Card className="bg-card/40 backdrop-blur-xl border border-border shadow-sm rounded-[2rem]">
                <CardHeader className="p-6 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Medal className="h-4 w-4" /> Comment ça marche ?
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 text-sm font-medium text-muted-foreground space-y-3">
                  <p className="flex gap-2"><span className="text-foreground font-bold">1.</span> Créez un duel et choisissez vos questions</p>
                  <p className="flex gap-2"><span className="text-foreground font-bold">2.</span> Partagez le code à votre adversaire</p>
                  <p className="flex gap-2"><span className="text-foreground font-bold">3.</span> Répondez aux mêmes questions en même temps</p>
                  <p className="flex gap-2"><span className="text-foreground font-bold">4.</span> Le plus rapide et précis gagne ! ⚡</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Create Duel */}
          {mode === "create" && !createdCode && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <Button variant="ghost" onClick={() => setMode("menu")} className="text-sm font-medium h-12 px-6 rounded-full hover:bg-muted text-foreground">
                ← Retour
              </Button>

              <Card className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] overflow-hidden">
                <CardHeader className="p-6 border-b border-border">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Zap className="h-5 w-5 text-primary" /> Configurer le duel
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Nombre de questions</label>
                    <Select value={questionCount} onValueChange={setQuestionCount}>
                      <SelectTrigger className="h-12 rounded-xl border-border bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 questions (~3 min)</SelectItem>
                        <SelectItem value="10">10 questions (~5 min)</SelectItem>
                        <SelectItem value="15">15 questions (~8 min)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Source des questions</label>
                    <Select value={selectedQcmId} onValueChange={(v) => { setSelectedQcmId(v); setSourceType("existing"); }}>
                      <SelectTrigger className="h-12 rounded-xl border-border bg-background">
                        <SelectValue placeholder="Choisir un QCM existant..." />
                      </SelectTrigger>
                      <SelectContent>
                        {qcmSessions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-primary" />
                              <span className="truncate max-w-[200px]">{s.title}</span>
                              <Badge variant="outline" className="text-xs ml-2 bg-muted border-0 font-bold">{s.questions.length}Q</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleCreate}
                    disabled={loading || !selectedQcmId}
                    className="w-full h-14 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-md mt-4 text-lg"
                  >
                    {loading ? "Création..." : "Créer le duel"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Invite Code Created */}
          {mode === "create" && createdCode && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <Card className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] overflow-hidden">
                <CardContent className="p-8 text-center space-y-6">
                  <div className="h-20 w-20 mx-auto rounded-full bg-muted flex items-center justify-center border border-border">
                    <Hash className="h-10 w-10 text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Code d'invitation</p>
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-4xl font-mono font-bold tracking-[0.3em] text-foreground">
                        {createdCode}
                      </span>
                      <Button variant="ghost" size="icon" onClick={copyCode} className="h-10 w-10 rounded-full hover:bg-muted">
                        <Copy className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground max-w-[250px] mx-auto leading-relaxed">
                    Partagez ce code à votre adversaire.<br />
                    Le duel commencera dès qu'il rejoindra.
                  </p>
                  <div className="flex items-center justify-center gap-3 py-4">
                    <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm font-medium text-muted-foreground">En attente d'un adversaire...</span>
                  </div>
                  <Button variant="outline" onClick={handleCancelWaiting} className="w-full h-12 rounded-full text-destructive border-destructive/20 hover:bg-destructive/10 font-medium">
                    <X className="h-4 w-4 mr-2" /> Annuler le duel
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Join Duel */}
          {mode === "join" && (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <Button variant="ghost" onClick={() => setMode("menu")} className="text-sm font-medium h-12 px-6 rounded-full hover:bg-muted text-foreground">
                ← Retour
              </Button>

              <Card className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] overflow-hidden">
                <CardHeader className="p-6 border-b border-border">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Users className="h-5 w-5 text-primary" /> Rejoindre un duel
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Code d'invitation</label>
                    <Input
                      placeholder="Ex: ABC123"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      className="text-center text-2xl h-16 font-mono tracking-[0.3em] uppercase rounded-xl border-border bg-background shadow-inner"
                      maxLength={6}
                    />
                  </div>
                  <Button
                    onClick={handleJoin}
                    disabled={loading || inviteCode.length < 4}
                    className="w-full h-14 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-md text-lg"
                  >
                    {loading ? "Recherche..." : "Rejoindre"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Duel;
