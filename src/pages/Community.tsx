import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Heart, MessageCircle, Share, Star, Trophy, Activity, TrendingUp, Sparkles, Brain, CheckCircle2 } from "lucide-react";
import CommunityChat from "@/components/CommunityChat";
import { Leaderboard } from "@/components/gamification/Leaderboard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { motion } from "framer-motion";

interface SharedQuiz {
  id: string;
  user_id: string;
  title: string;
  question_count: number;
  category: string | null;
  likes_count: number;
  created_at: string;
  author_name?: string;
  user_liked?: boolean;
}

const Community = () => {
  const [sharedQuizzes, setSharedQuizzes] = useState<SharedQuiz[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userSessions, setUserSessions] = useState<any[]>([]);
  const [stats, setStats] = useState({ members: 0, quizzes: 0, likes: 0 });

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const [quizzesRes, likesRes, sessionsRes, profilesCountRes] = await Promise.all([
      supabase.from("shared_quizzes").select("*").order("likes_count", { ascending: false }).limit(20),
      supabase.from("quiz_likes").select("shared_quiz_id").eq("user_id", user.id),
      supabase.from("qcm_sessions").select("id, title, question_count, courses(title)").eq("user_id", user.id).eq("status", "completed"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    const likedIds = new Set((likesRes.data || []).map((l) => l.shared_quiz_id));
    const quizzes = quizzesRes.data || [];

    const authorIds = [...new Set(quizzes.map((q) => q.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, first_name, name").in("id", authorIds);
    const nameMap = new Map((profiles || []).map((p) => [p.id, p.first_name || p.name || "Étudiant"]));

    setSharedQuizzes(
      quizzes.map((q) => ({
        ...q,
        author_name: nameMap.get(q.user_id) || "Étudiant",
        user_liked: likedIds.has(q.id),
      }))
    );

    setUserSessions(sessionsRes.data || []);
    setStats({
      members: profilesCountRes.count || 0,
      quizzes: quizzes.length,
      likes: quizzes.reduce((sum, q) => sum + q.likes_count, 0),
    });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useRealtimeSubscription({ table: "shared_quizzes", event: "*", onUpdate: fetchData });

  const handleShare = async (sessionId: string, title: string, questionCount: number) => {
    if (!currentUserId) return;
    const { error } = await supabase.from("shared_quizzes").insert({
      user_id: currentUserId,
      qcm_session_id: sessionId,
      title,
      question_count: questionCount,
    });
    if (error) {
      if (error.code === "23505") toast.info("Ce QCM est déjà partagé");
      else toast.error("Erreur lors du partage");
    } else {
      toast.success("QCM partagé avec la communauté !");
      fetchData();
    }
  };

  const handleLike = async (quizId: string, liked: boolean) => {
    if (!currentUserId) return;
    if (liked) {
      await supabase.from("quiz_likes").delete().eq("user_id", currentUserId).eq("shared_quiz_id", quizId);
    } else {
      await supabase.from("quiz_likes").insert({ user_id: currentUserId, shared_quiz_id: quizId });
    }
    fetchData();
  };

  return (
    <div className="min-h-screen py-4 sm:py-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-[1600px] mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          
          {/* Beautiful Hero Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-card border border-border/50 shadow-sm p-6 sm:p-10 lg:p-14 mb-6 sm:mb-10"
          >
            {/* Inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-[80px]" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="text-center md:text-left flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
                  <Sparkles className="w-4 h-4" /> La ruche Hippocampus
                </div>
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif font-bold text-foreground mb-4 leading-tight">
                  Apprenez ensemble, <br/><span className="text-primary italic">Réussissez</span> ensemble.
                </h1>
                <p className="text-muted-foreground text-lg max-w-xl mx-auto md:mx-0">
                  Échangez vos meilleurs QCM, discutez des cas cliniques complexes et montez dans le classement de la communauté.
                </p>
                
                <div className="flex items-center justify-center md:justify-start gap-4 mt-8 flex-wrap">
                  <Badge variant="secondary" className="px-4 py-2 text-sm bg-background border-border/50">
                    <Users className="w-4 h-4 text-primary mr-2" /> {stats.members} Membres actifs
                  </Badge>
                  <Badge variant="secondary" className="px-4 py-2 text-sm bg-background border-border/50">
                    <Brain className="w-4 h-4 text-accent mr-2" /> {stats.quizzes} QCM Partagés
                  </Badge>
                </div>
              </div>
              
              <div className="hidden lg:flex shrink-0 w-[350px] flex-col gap-4">
                <Card className="bg-background/80 backdrop-blur border-border/50 shadow-lg transform rotate-2 hover:rotate-0 transition-transform cursor-default">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Top Semaine</p>
                      <p className="font-bold text-foreground">Dr. Sarah a partagé "Cardio L3"</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-background/80 backdrop-blur border-border/50 shadow-lg transform -rotate-2 hover:rotate-0 transition-transform cursor-default">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Activité</p>
                      <p className="font-bold text-foreground">32 nouveaux messages</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>

          <Tabs defaultValue="chat" className="w-full">
            <div className="flex justify-center mb-6 sm:mb-8 overflow-x-auto pb-2 scrollbar-none">
              <TabsList className="bg-card border border-border/50 shadow-sm p-1 rounded-2xl inline-flex w-max sm:w-auto">
                <TabsTrigger value="chat" className="rounded-xl px-4 sm:px-8 py-2.5 sm:py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all text-sm sm:text-base">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Forum
                </TabsTrigger>
                <TabsTrigger value="leaderboard" className="rounded-xl px-4 sm:px-8 py-2.5 sm:py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all text-sm sm:text-base">
                  <Trophy className="h-4 w-4 mr-2" />
                  Classement
                </TabsTrigger>
                <TabsTrigger value="quizzes" className="rounded-xl px-4 sm:px-8 py-2.5 sm:py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all text-sm sm:text-base">
                  <Star className="h-4 w-4 mr-2" />
                  QCM
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="chat" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-border/50 shadow-sm overflow-hidden rounded-2xl">
                <CommunityChat />
              </Card>
            </TabsContent>

            <TabsContent value="leaderboard" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Leaderboard />
            </TabsContent>

            <TabsContent value="quizzes" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { title: "Membres", value: stats.members, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
                  { title: "QCM Partagés", value: stats.quizzes, icon: Star, color: "text-amber-500", bg: "bg-amber-500/10" },
                  { title: "J'aime distribués", value: stats.likes, icon: Heart, color: "text-rose-500", bg: "bg-rose-500/10" },
                ].map((s, i) => (
                  <Card key={i} className="border-border/50 shadow-sm bg-card hover:shadow-md transition-shadow">
                    <CardContent className="p-6 flex items-center gap-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${s.bg}`}>
                        <s.icon className={`w-7 h-7 ${s.color}`} />
                      </div>
                      <div>
                        <p className="text-3xl font-black text-foreground">{s.value}</p>
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{s.title}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Share Section */}
              {userSessions.length > 0 && (
                <Card className="border-border/50 shadow-sm bg-gradient-to-r from-card to-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Share className="h-5 w-5 text-primary" />
                      Contribuez à la banque commune
                    </CardTitle>
                    <CardDescription>Partagez vos meilleurs QCM avec la communauté et gagnez des points.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {userSessions.slice(0, 8).map((session: any) => (
                        <Button
                          key={session.id}
                          variant="secondary"
                          className="rounded-xl border border-border/50 shadow-sm hover:bg-primary hover:text-background transition-all group"
                          onClick={() => handleShare(session.id, session.title, session.question_count)}
                        >
                          <Share className="h-4 w-4 mr-2 group-hover:animate-pulse" />
                          <span className="truncate max-w-[200px]">{session.title}</span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Shared Quizzes Grid */}
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-serif font-bold flex items-center gap-2 text-foreground">
                  <Activity className="w-6 h-6 text-primary" /> QCM Récents & Populaires
                </h2>
              </div>

              {sharedQuizzes.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-3xl border border-border/50">
                  <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Brain className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">La bibliothèque est vide</h3>
                  <p className="text-muted-foreground">Soyez le pionnier, partagez le premier QCM !</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sharedQuizzes.map((quiz, i) => (
                    <motion.div key={quiz.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className="h-full border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col relative overflow-hidden group">
                        {i < 3 && (
                          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-accent/20 to-transparent pointer-events-none" />
                        )}
                        <CardHeader className="pb-4">
                          <div className="flex justify-between items-start gap-4">
                            <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
                              {quiz.title}
                            </CardTitle>
                            {i === 0 && <Badge className="bg-amber-500 flex-shrink-0">Top 1</Badge>}
                          </div>
                          <CardDescription className="flex items-center gap-2 mt-2">
                            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                              {quiz.author_name?.[0]?.toUpperCase()}
                            </span>
                            <span className="truncate">Par {quiz.author_name}</span>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="mt-auto pt-4 flex items-center justify-between border-t border-border/30">
                          <div className="flex gap-3">
                            <Badge variant="outline" className="bg-background/50">
                              <CheckCircle2 className="w-3 h-3 mr-1 text-primary" /> {quiz.question_count} Qs
                            </Badge>
                            {quiz.category && (
                              <Badge variant="outline" className="bg-background/50">
                                {quiz.category}
                              </Badge>
                            )}
                          </div>
                          
                          <Button
                            variant={quiz.user_liked ? "default" : "ghost"}
                            size="sm"
                            onClick={() => handleLike(quiz.id, !!quiz.user_liked)}
                            className={`rounded-full px-3 transition-all ${quiz.user_liked ? 'bg-rose-500 hover:bg-rose-600 text-background shadow-md shadow-rose-500/20' : 'hover:bg-rose-50 hover:text-rose-500'}`}
                          >
                            <Heart className={`h-4 w-4 mr-1.5 ${quiz.user_liked ? "fill-current" : ""}`} />
                            <span className="font-bold">{quiz.likes_count}</span>
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Community;
