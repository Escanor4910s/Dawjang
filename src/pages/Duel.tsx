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
    <div className="min-h-screen bg-dashboard text-foreground bg-doodle-watermark font-sans px-4 pt-1 pb-6 sm:px-8 sm:pt-4 sm:pb-8 relative overflow-hidden">
      {/* Immersive glow background decorations */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
        className="max-w-[1200px] mx-auto space-y-8 relative z-10 pt-6 sm:pt-10"
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wider uppercase mb-2"
          >
            <Swords className="h-3.5 w-3.5" />
            Arène Multijoueur
          </motion.div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground bg-gradient-to-b from-foreground to-foreground/80 bg-clip-text">
            Mode Duel
          </h1>
          <p className="text-base text-muted-foreground max-w-lg mx-auto">
            Défiez d'autres étudiants en médecine et mesurez vos connaissances cliniques en temps réel !
          </p>
        </div>

        <AnimatePresence mode="wait">
          {/* Main Menu */}
          {mode === "menu" && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Bento Grid */}
              <div className="grid sm:grid-cols-2 gap-6">
                <Card 
                  className="bg-card/45 backdrop-blur-2xl border border-white/5 dark:border-white/10 shadow-[0_8px_32px_0_rgba(99,102,241,0.02)] hover:shadow-[0_12px_40px_0_rgba(99,102,241,0.12)] transition-all duration-500 rounded-[2.5rem] p-4 cursor-pointer hover:-translate-y-1.5 group relative overflow-hidden"
                  onClick={() => setMode("create")}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors duration-500 pointer-events-none" />
                  <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-amber-500/10 to-orange-500/20 group-hover:from-amber-500/20 group-hover:to-orange-500/30 text-amber-500 flex items-center justify-center flex-shrink-0 transition-all duration-500 shadow-[0_0_15px_rgba(245,158,11,0.05)] group-hover:shadow-[0_0_25px_rgba(245,158,11,0.15)]">
                      <Zap className="h-7 w-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-foreground mb-1 group-hover:text-amber-500 transition-colors duration-300">
                        Créer un duel
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Configurez votre série de QCM, générez un code et défiez qui vous voulez.
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-muted/50 group-hover:bg-amber-500 group-hover:text-background flex items-center justify-center transition-all duration-500 flex-shrink-0">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="bg-card/45 backdrop-blur-2xl border border-white/5 dark:border-white/10 shadow-[0_8px_32px_0_rgba(99,102,241,0.02)] hover:shadow-[0_12px_40px_0_rgba(99,102,241,0.12)] transition-all duration-500 rounded-[2.5rem] p-4 cursor-pointer hover:-translate-y-1.5 group relative overflow-hidden"
                  onClick={() => setMode("join")}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-colors duration-500 pointer-events-none" />
                  <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-violet-500/10 to-purple-500/20 group-hover:from-violet-500/20 group-hover:to-purple-500/30 text-violet-500 flex items-center justify-center flex-shrink-0 transition-all duration-500 shadow-[0_0_15px_rgba(139,92,246,0.05)] group-hover:shadow-[0_0_25px_rgba(139,92,246,0.15)]">
                      <Users className="h-7 w-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-foreground mb-1 group-hover:text-violet-500 transition-colors duration-300">
                        Rejoindre un duel
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Saisissez le code fourni par votre ami pour entrer dans l'arène de combat.
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-muted/50 group-hover:bg-violet-500 group-hover:text-background flex items-center justify-center transition-all duration-500 flex-shrink-0">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* History */}
              <Card className="bg-card/45 backdrop-blur-2xl border border-white/5 dark:border-white/10 shadow-lg rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-6 border-b border-border/50 flex flex-row items-center justify-between space-y-0 bg-muted/10">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" /> Vos Derniers Combats
                  </CardTitle>
                  {duelHistory.some((d) => d.status === "waiting" && d.creator_id === userId) && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleClearWaitingHistory} 
                      className="h-8 rounded-full text-xs font-semibold text-destructive hover:bg-destructive/10 transition-all duration-300"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Vider l'attente
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-6">
                  {historyLoading ? (
                    <div className="animate-pulse space-y-3">
                      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted/50 rounded-2xl" />)}
                    </div>
                  ) : duelHistory.length === 0 ? (
                    <div className="text-center py-10 space-y-3">
                      <div className="h-12 w-12 rounded-full bg-muted mx-auto flex items-center justify-center">
                        <Swords className="h-6 w-6 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">Aucun duel joué. C'est le moment de lancer votre premier défi !</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {duelHistory.map((d, idx) => {
                        const result = getDuelResult(d);
                        const myScore = d.creator_id === userId ? d.creator_score : d.opponent_score;
                        const theirScore = d.creator_id === userId ? d.opponent_score : d.creator_score;
                        const canDelete = d.status === "waiting" && d.creator_id === userId;
                        const isWin = result.label === "Victoire";
                        const isLoss = result.label === "Défaite";
                        
                        return (
                          <motion.div
                            key={d.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`flex items-center justify-between p-4 rounded-2xl bg-card/30 border transition-all duration-300 group ${
                              isWin 
                                ? "border-green-500/20 hover:border-green-500/40 bg-green-500/[0.01] hover:bg-green-500/[0.03]" 
                                : isLoss 
                                  ? "border-red-500/20 hover:border-red-500/40 bg-red-500/[0.01] hover:bg-red-500/[0.03]" 
                                  : "border-border hover:border-border-hover hover:bg-muted/20"
                            }`}
                          >
                            <div
                              className="flex items-center gap-4 flex-1 cursor-pointer min-w-0"
                              onClick={() => d.status !== "waiting" && navigate(`/duel/${d.id}`)}
                            >
                              <div className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isWin 
                                  ? "bg-green-500/10 text-green-500" 
                                  : isLoss 
                                    ? "bg-red-500/10 text-red-500" 
                                    : "bg-muted text-muted-foreground"
                              }`}>
                                {isWin ? <Trophy className="h-5 w-5" /> :
                                 isLoss ? <Swords className="h-5 w-5" /> :
                                 <Clock className="h-5 w-5" />}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-sm font-bold truncate ${result.color}`}>{result.label}</p>
                                <p className="text-xs font-semibold text-muted-foreground/80 truncate mt-0.5">
                                  {new Date(d.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                                  {" · "}{d.question_count} Questions
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                              {d.status === "completed" && (
                                <Badge variant="outline" className={`text-xs font-extrabold font-mono px-3 py-1 border-0 ${
                                  isWin 
                                    ? "bg-green-500/10 text-green-500" 
                                    : isLoss 
                                      ? "bg-red-500/10 text-red-500" 
                                      : "bg-muted text-muted-foreground"
                                }`}>
                                  {myScore} - {theirScore}
                                </Badge>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 opacity-60 group-hover:opacity-100 transition-all duration-300"
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
              <Card className="bg-card/25 backdrop-blur-2xl border border-white/5 shadow-inner rounded-[2.5rem] overflow-hidden p-2">
                <CardHeader className="p-6 pb-2">
                  <CardTitle className="text-xs font-extrabold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Medal className="h-4 w-4 text-primary" /> RÈGLES DE COMBAT
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0 text-sm font-semibold text-muted-foreground/80 space-y-3">
                  <p className="flex items-center gap-3"><span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-extrabold">1</span> Créez une série personnalisée en choisissant un QCM existant.</p>
                  <p className="flex items-center gap-3"><span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-extrabold">2</span> Copiez le code d'accès de l'arène et envoyez-le à votre ami.</p>
                  <p className="flex items-center gap-3"><span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-extrabold">3</span> Répondez aux mêmes questions en direct. Pas de triche possible !</p>
                  <p className="flex items-center gap-3"><span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-extrabold">4</span> Le score dépend de l'exactitude et de la vitesse de réponse. Que le meilleur gagne ! ⚡</p>
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
              <Button 
                variant="ghost" 
                onClick={() => setMode("menu")} 
                className="text-sm font-bold h-11 px-5 rounded-full hover:bg-muted text-foreground transition-all duration-300"
              >
                ← Retour au Menu
              </Button>

              <Card className="bg-card/45 backdrop-blur-2xl border border-white/5 dark:border-white/10 shadow-lg rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-6 border-b border-border/50 bg-muted/10">
                  <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <Zap className="h-5 w-5 text-amber-500 animate-pulse" /> Configurer le duel
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-3">
                    <label className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Nombre de questions</label>
                    <Select value={questionCount} onValueChange={setQuestionCount}>
                      <SelectTrigger className="h-12 rounded-xl border-border bg-background/50 font-semibold focus:ring-primary"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="5" className="font-semibold">5 questions (~3 min)</SelectItem>
                        <SelectItem value="10" className="font-semibold">10 questions (~5 min)</SelectItem>
                        <SelectItem value="15" className="font-semibold">15 questions (~8 min)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Source des questions</label>
                    <Select value={selectedQcmId} onValueChange={(v) => { setSelectedQcmId(v); setSourceType("existing"); }}>
                      <SelectTrigger className="h-12 rounded-xl border-border bg-background/50 font-semibold focus:ring-primary">
                        <SelectValue placeholder="Sélectionnez un QCM..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border max-h-56">
                        {qcmSessions.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="font-semibold">
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="truncate max-w-[240px]">{s.title}</span>
                              <Badge variant="outline" className="text-xs ml-2 bg-muted/50 border-0 font-extrabold">{s.questions.length}Q</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleCreate}
                    disabled={loading || !selectedQcmId}
                    className="w-full h-14 rounded-full bg-primary text-primary-foreground hover:bg-primary/95 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300 mt-4 text-base"
                  >
                    {loading ? "Création en cours..." : "Générer l'arène de duel"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Matchmaking pulse radar */}
          {mode === "create" && createdCode && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <Card className="bg-card/45 backdrop-blur-2xl border border-white/5 dark:border-white/10 shadow-xl rounded-[2.5rem] overflow-hidden">
                <CardContent className="p-8 text-center space-y-6">
                  {/* Radar holographique */}
                  <div className="relative flex items-center justify-center h-48 my-2">
                    {[1, 2, 3].map((ring) => (
                      <motion.div
                        key={ring}
                        className="absolute border border-primary/20 rounded-full"
                        style={{ width: 100, height: 100 }}
                        animate={{
                          scale: [1, 3.6],
                          opacity: [0.7, 0],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          delay: (ring - 1) * 1,
                          ease: "easeOut",
                        }}
                      />
                    ))}
                    <motion.div
                      className="absolute h-24 w-24 bg-primary/10 rounded-full blur-xl"
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                      className="relative z-10 p-5 rounded-full bg-primary/15 border border-primary/30 text-primary shadow-lg shadow-primary/10"
                    >
                      <Swords className="h-10 w-10 animate-pulse" />
                    </motion.div>
                  </div>

                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-3">Code de l'Arène</p>
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-4xl font-mono font-black tracking-[0.25em] text-foreground bg-muted/50 pl-[0.25em] py-2.5 rounded-2xl border border-border">
                        {createdCode}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={copyCode} 
                        className="h-12 w-12 rounded-full hover:bg-muted text-primary hover:text-primary transition-all duration-300"
                      >
                        <Copy className="h-5.5 w-5.5" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-muted-foreground/80 max-w-[300px] mx-auto leading-relaxed">
                    Partagez ce code avec votre confrère.<br />
                    La session commencera instantanément dès qu'il rejoindra l'arène.
                  </p>

                  <div className="flex items-center justify-center gap-3 py-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary animate-ping" />
                    <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Recherche en cours...</span>
                  </div>

                  <Button 
                    variant="outline" 
                    onClick={handleCancelWaiting} 
                    className="w-full h-13 rounded-full text-destructive border-destructive/20 hover:bg-destructive/10 font-bold transition-all duration-300"
                  >
                    <X className="h-4 w-4 mr-2" /> Annuler et fermer l'arène
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
              <Button 
                variant="ghost" 
                onClick={() => setMode("menu")} 
                className="text-sm font-bold h-11 px-5 rounded-full hover:bg-muted text-foreground transition-all duration-300"
              >
                ← Retour au Menu
              </Button>

              <Card className="bg-card/45 backdrop-blur-2xl border border-white/5 dark:border-white/10 shadow-lg rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-6 border-b border-border/50 bg-muted/10">
                  <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <Users className="h-5 w-5 text-violet-500" /> Rejoindre un duel
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-3">
                    <label className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Code de l'Arène</label>
                    <Input
                      placeholder="Ex: ABC123"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      className="text-center text-3xl h-16 font-mono font-black tracking-[0.25em] uppercase rounded-2xl border-border bg-background shadow-inner focus-visible:ring-violet-500"
                      maxLength={6}
                    />
                  </div>
                  <Button
                    onClick={handleJoin}
                    disabled={loading || inviteCode.length < 4}
                    className="w-full h-14 rounded-full bg-violet-600 text-white hover:bg-violet-500 font-bold shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all duration-300 text-base"
                  >
                    {loading ? "Recherche de la session..." : "Rejoindre le combat"}
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
