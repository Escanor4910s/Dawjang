import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Brain, Calendar, ChevronLeft, ChevronRight, RotateCw,
  CheckCircle, XCircle, ThumbsUp, ThumbsDown, Zap,
  BookOpen, TrendingUp, Target, Sparkles,
} from "lucide-react";
import { useSpacedRepetition, type ReviewCard } from "@/hooks/useSpacedRepetition";
import { toast } from "sonner";

const QUALITY_BUTTONS = [
  { quality: 1, label: "Pas su", icon: XCircle, color: "bg-destructive hover:bg-destructive/90 text-destructive-foreground", desc: "Réponse oubliée" },
  { quality: 3, label: "Difficile", icon: ThumbsDown, color: "bg-orange-500 hover:bg-orange-600 text-white", desc: "Rappel laborieux" },
  { quality: 4, label: "Correct", icon: ThumbsUp, color: "bg-primary hover:bg-primary/90 text-primary-foreground", desc: "Après hésitation" },
  { quality: 5, label: "Facile", icon: Zap, color: "bg-emerald-500 hover:bg-emerald-600 text-white", desc: "Réponse immédiate" },
];

const ReviewPlanner = () => {
  const navigate = useNavigate();
  const { dueCards, stats, forecast, loading, reviewCard, refreshCards } = useSpacedRepetition();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);

  const currentCard: ReviewCard | undefined = dueCards[currentIndex];

  const handleRate = useCallback(async (quality: number) => {
    if (!currentCard) return;

    const success = await reviewCard(currentCard.id, quality);
    if (success) {
      setSessionCompleted(prev => prev + 1);
      setIsFlipped(false);

      if (currentIndex >= dueCards.length - 1) {
        setIsReviewing(false);
        toast.success("Session terminée ! 🎉");
      } else {
        setCurrentIndex(prev => Math.min(prev, dueCards.length - 2));
      }
    }
  }, [currentCard, currentIndex, dueCards.length, reviewCard]);

  const startSession = () => {
    setIsReviewing(true);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionCompleted(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Brain className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Chargement du planificateur...</p>
        </div>
      </div>
    );
  }

  // ─── Active review session ─────────────────────────────────
  if (isReviewing && currentCard) {
    const progress = dueCards.length > 0 ? ((sessionCompleted) / (sessionCompleted + dueCards.length)) * 100 : 100;
    return (
      <div className="min-h-screen bg-background bg-doodle-watermark py-4 sm:py-8 relative">
        <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setIsReviewing(false)}>
                <ChevronLeft className="h-4 w-4 mr-1" />Quitter
              </Button>
              <Badge variant="outline" className="text-sm">
                {sessionCompleted} révisée{sessionCompleted > 1 ? "s" : ""} · {dueCards.length} restante{dueCards.length > 1 ? "s" : ""}
              </Badge>
            </div>

            <Progress value={progress} className="h-2" />

            {/* Flashcard */}
            <Card
              className="min-h-[350px] sm:min-h-[420px] cursor-pointer bg-card/70 backdrop-blur-xl border border-border rounded-[2rem] shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <div className={`absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent transition-opacity duration-500 ${isFlipped ? "opacity-100" : "opacity-0"}`} />
              <CardContent className="flex flex-col items-center justify-center min-h-[350px] sm:min-h-[420px] p-6 sm:p-12 relative z-10">
                <Badge variant="secondary" className="mb-6 text-xs">{currentCard.courseName}</Badge>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80 mb-4">
                  {isFlipped ? "Réponse" : "Question"}
                </p>
                <p className="text-xl sm:text-3xl font-light leading-relaxed text-foreground text-center">
                  {isFlipped ? currentCard.answer : currentCard.question}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-8 flex items-center gap-1">
                  <RotateCw className="w-3 h-3 group-hover:animate-spin" /> Cliquez pour retourner
                </p>
              </CardContent>
            </Card>

            {/* Rating buttons — shown only when flipped */}
            {isFlipped && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <p className="text-center text-sm text-muted-foreground font-medium">Comment avez-vous répondu ?</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {QUALITY_BUTTONS.map(({ quality, label, icon: Icon, color, desc }) => (
                    <button
                      key={quality}
                      onClick={() => handleRate(quality)}
                      className={`flex flex-col items-center gap-1.5 p-4 rounded-xl transition-all ${color} shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95`}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="font-semibold text-sm">{label}</span>
                      <span className="text-[10px] opacity-80">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Session complete or Dashboard view ────────────────────
  return (
    <div className="min-h-screen bg-background bg-doodle-watermark text-foreground px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-8 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-[1200px] mx-auto space-y-6 relative z-10">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-foreground flex items-center gap-3">
              <Calendar className="h-10 w-10 text-primary" />
              Planificateur
            </h1>
            <p className="text-sm font-medium text-muted-foreground mt-2">
              Répétition espacée intelligente · Algorithme SM-2
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refreshCards()} className="border-foreground/30">
            <RotateCw className="h-4 w-4 mr-1" /> Actualiser
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-card/60 backdrop-blur-md border border-border rounded-2xl">
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <p className="text-3xl font-bold text-foreground">{stats.dueToday}</p>
              <p className="text-xs text-muted-foreground mt-1">À réviser aujourd'hui</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur-md border border-border rounded-2xl">
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                <Calendar className="h-6 w-6 text-amber-500" />
              </div>
              <p className="text-3xl font-bold text-foreground">{stats.dueTomorrow}</p>
              <p className="text-xs text-muted-foreground mt-1">Prévues demain</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur-md border border-border rounded-2xl">
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-3xl font-bold text-foreground">{stats.masteredCards}</p>
              <p className="text-xs text-muted-foreground mt-1">Maîtrisées (21j+)</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur-md border border-border rounded-2xl">
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="h-6 w-6 text-violet-500" />
              </div>
              <p className="text-3xl font-bold text-foreground">{stats.totalCards}</p>
              <p className="text-xs text-muted-foreground mt-1">Total flashcards</p>
            </CardContent>
          </Card>
        </div>

        {/* Session completed message */}
        {sessionCompleted > 0 && !isReviewing && (
          <Card className="bg-gradient-to-r from-emerald-500/10 to-primary/10 border-emerald-500/30 rounded-2xl">
            <CardContent className="p-6 text-center">
              <Sparkles className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-xl font-semibold mb-1">Session terminée ! 🎉</h3>
              <p className="text-sm text-muted-foreground">
                Vous avez révisé <strong>{sessionCompleted}</strong> carte{sessionCompleted > 1 ? "s" : ""} aujourd'hui.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Start Session CTA */}
        {stats.dueToday > 0 ? (
          <Card className="bg-card/70 backdrop-blur-md border border-border rounded-2xl overflow-hidden">
            <CardContent className="p-8 text-center">
              <Brain className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">
                {stats.dueToday} carte{stats.dueToday > 1 ? "s" : ""} à réviser
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                L'algorithme SM-2 a calculé le moment optimal pour réviser ces cartes.
                Ne ratez pas votre créneau !
              </p>
              <Button size="lg" onClick={startSession} className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 h-12 text-base shadow-md">
                <Zap className="h-5 w-5 mr-2" />
                Commencer la révision
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/70 backdrop-blur-md border border-border rounded-2xl">
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Tout est à jour ! ✨</h2>
              <p className="text-muted-foreground mb-6">
                Aucune carte à réviser pour le moment. Revenez {stats.dueTomorrow > 0 ? "demain" : "plus tard"} !
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => navigate("/flashcards")} className="border-foreground/30">
                  <BookOpen className="h-4 w-4 mr-2" />Mes Flashcards
                </Button>
                <Button variant="outline" onClick={() => navigate("/add-course")} className="border-foreground/30">
                  <Brain className="h-4 w-4 mr-2" />Générer un QCM
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 7-day Forecast */}
        <Card className="bg-card/60 backdrop-blur-md border border-border rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Prévisions sur 7 jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {forecast.map((day) => (
                <div
                  key={day.date}
                  className={`flex flex-col items-center p-3 rounded-xl transition-colors ${
                    day.count > 0 ? "bg-primary/10 border border-primary/20" : "bg-muted/30"
                  }`}
                >
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">{day.label}</span>
                  <span className={`text-xl font-bold mt-1 ${day.count > 0 ? "text-primary" : "text-muted-foreground/50"}`}>
                    {day.count}
                  </span>
                  <span className="text-[10px] text-muted-foreground">carte{day.count !== 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReviewPlanner;
