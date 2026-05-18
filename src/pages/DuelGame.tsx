import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Clock, Trophy, Zap, CheckCircle, XCircle, User, Shield, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useDuel, DuelQuestion } from "@/hooks/useDuel";
import { useGamificationContext } from "@/components/gamification/GamificationProvider";
import confetti from "canvas-confetti";

// Simple sound effects using Web Audio API
const playSound = (type: "correct" | "wrong" | "tick" | "victory" | "clash") => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.15;

    switch (type) {
      case "correct":
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
        break;
      case "wrong":
        osc.frequency.value = 200;
        osc.type = "square";
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
        break;
      case "tick":
        osc.frequency.value = 600;
        osc.type = "sine";
        gain.gain.value = 0.05;
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.start(); osc.stop(ctx.currentTime + 0.08);
        break;
      case "victory":
        osc.frequency.value = 523;
        osc.type = "sine";
        setTimeout(() => {
          try {
            const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
            o2.connect(g2); g2.connect(ctx.destination);
            o2.frequency.value = 659; o2.type = "sine"; g2.gain.value = 0.15;
            g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            o2.start(); o2.stop(ctx.currentTime + 0.3);
          } catch {}
        }, 200);
        setTimeout(() => {
          try {
            const o3 = ctx.createOscillator(); const g3 = ctx.createGain();
            o3.connect(g3); g3.connect(ctx.destination);
            o3.frequency.value = 784; o3.type = "sine"; g3.gain.value = 0.15;
            g3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            o3.start(); o3.stop(ctx.currentTime + 0.5);
          } catch {}
        }, 400);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
        break;
      case "clash":
        osc.frequency.value = 150;
        osc.type = "sawtooth";
        gain.gain.value = 0.1;
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
        break;
    }
  } catch {}
};

const DuelGame = () => {
  const { duelId } = useParams<{ duelId: string }>();
  const navigate = useNavigate();
  const {
    duel, myAnswers, opponentAnswers, userId, isCreator,
    hasAnsweredCurrent, opponentAnsweredCurrent,
    submitAnswer, advanceQuestion,
  } = useDuel(duelId);
  const { addXP } = useGamificationContext();

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showClash, setShowClash] = useState(false);
  const [comboCount, setComboCount] = useState(0);
  const [xpAwarded, setXpAwarded] = useState(false);

  // Timer for each question
  useEffect(() => {
    if (!duel || duel.status !== "active") return;
    setQuestionStartTime(Date.now());
    setSelectedAnswer(null);
    setShowResult(false);
  }, [duel?.current_question_index, duel?.status]);

  // Auto-advance when both answered
  useEffect(() => {
    if (!duel || duel.status !== "active") return;
    if (hasAnsweredCurrent && opponentAnsweredCurrent) {
      setShowResult(true);
      setShowClash(true);
      playSound("clash");
      setTimeout(() => setShowClash(false), 1000);
      setTimeout(() => {
        advanceQuestion();
      }, 3000);
    }
  }, [hasAnsweredCurrent, opponentAnsweredCurrent, duel, advanceQuestion]);

  // Countdown at start
  useEffect(() => {
    if (!duel || duel.status !== "active") return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        playSound("tick");
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [duel?.status]);

  // Celebrate on win + award XP
  useEffect(() => {
    if (duel?.status === "completed" && !xpAwarded) {
      const myScore = isCreator ? duel.creator_score : duel.opponent_score;
      const theirScore = isCreator ? duel.opponent_score : duel.creator_score;
      if (myScore > theirScore) {
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        playSound("victory");
        // Award XP for duel victory
        addXP(50).catch(() => {});
      } else if (myScore === theirScore) {
        addXP(20).catch(() => {});
      } else {
        addXP(10).catch(() => {});
      }
      setXpAwarded(true);
    }
  }, [duel?.status, duel?.creator_score, duel?.opponent_score, isCreator, xpAwarded, addXP]);

  if (!duel) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-dashboard bg-doodle-watermark relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
        <Card className="max-w-md w-full bg-card/45 backdrop-blur-2xl border border-white/5 shadow-xl rounded-[2.5rem] p-8 text-center space-y-6 relative z-10">
          <div className="relative flex items-center justify-center h-24 my-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="p-4 rounded-full bg-primary/15 border border-primary/20 text-primary shadow-lg shadow-primary/5"
            >
              <Swords className="h-8 w-8 animate-pulse" />
            </motion.div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-foreground">Chargement de l'arène...</h3>
            <p className="text-xs text-muted-foreground">Vérification de l'état de la session de duel</p>
          </div>
          <div className="h-1.5 w-32 bg-muted/40 rounded-full overflow-hidden mx-auto">
            <div className="h-full bg-primary animate-[shimmer_1.5s_infinite] w-1/2 rounded-full" />
          </div>
        </Card>
      </div>
    );
  }

  // Waiting for opponent
  if (duel.status === "waiting") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-dashboard bg-doodle-watermark relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
        <Card className="max-w-md w-full bg-card/45 backdrop-blur-2xl border border-white/5 shadow-xl rounded-[2.5rem] p-8 text-center space-y-6 relative z-10">
          <div className="relative flex items-center justify-center h-32 my-2">
            {/* Radar concentric rings */}
            {[1, 2].map((ring) => (
              <motion.div
                key={ring}
                className="absolute border border-primary/20 rounded-full"
                style={{ width: 80, height: 80 }}
                animate={{
                  scale: [1, 2.5],
                  opacity: [0.6, 0],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  delay: (ring - 1) * 1.2,
                  ease: "easeOut",
                }}
              />
            ))}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="relative z-10 p-5 rounded-full bg-primary/15 border border-primary/30 text-primary shadow-lg"
            >
              <Swords className="h-9 w-9 animate-pulse" />
            </motion.div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">En attente d'un adversaire...</h3>
            <p className="text-sm font-semibold text-muted-foreground/80">
              Code de session : <span className="font-mono text-primary font-black tracking-widest bg-muted/60 px-3 py-1 rounded-xl border border-border ml-1">{duel.invite_code}</span>
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            <div className="h-2 w-2 bg-primary rounded-full animate-ping" />
            Synchronisation de l'arène
          </div>
        </Card>
      </div>
    );
  }

  // Error: no valid questions
  if (duel.status === "active" && (!duel.questions || duel.questions.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-dashboard bg-doodle-watermark relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-red-500/5 rounded-full blur-[80px] pointer-events-none" />
        <Card className="max-w-md w-full bg-card/45 backdrop-blur-2xl border border-red-500/10 shadow-xl rounded-[2.5rem] p-8 text-center space-y-6 relative z-10">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
            <Swords className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">Erreur de Duel</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Aucune question n'a pu être chargée pour cette session. Le QCM source est peut-être vide ou incompatible.
            </p>
          </div>
          <Button 
            onClick={() => navigate("/duel")} 
            className="w-full bg-primary text-primary-foreground hover:bg-primary/95 h-12 rounded-full font-bold shadow-lg shadow-primary/10 transition-all duration-300"
          >
            Retour aux duels
          </Button>
        </Card>
      </div>
    );
  }

  // Countdown
  if (countdown !== null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dashboard text-foreground bg-doodle-watermark relative overflow-hidden">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md z-40 pointer-events-none" />
        {/* Glowing blur effects */}
        <div className="absolute top-[20%] left-[20%] w-[300px] h-[300px] bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[20%] w-[300px] h-[300px] bg-violet-500/10 rounded-full blur-[80px] pointer-events-none" />

        <motion.div
          key={countdown}
          initial={{ scale: 0.3, rotate: -25, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 2.2, rotate: 25, opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="relative z-50 flex flex-col items-center justify-center gap-6"
        >
          <motion.div 
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-primary via-indigo-500 to-violet-400 select-none drop-shadow-[0_0_35px_rgba(99,102,241,0.3)] font-sans"
          >
            {countdown === 0 ? "⚔️ COMBAT!" : countdown}
          </motion.div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground animate-pulse">
            Préparez votre diagnostic...
          </p>
        </motion.div>
      </div>
    );
  }

  // Game completed
  if (duel.status === "completed") {
    const myScore = isCreator ? duel.creator_score : duel.opponent_score;
    const theirScore = isCreator ? duel.opponent_score : duel.creator_score;
    const myCorrect = myAnswers.filter((a) => a.is_correct).length;
    const theirCorrect = opponentAnswers.filter((a) => a.is_correct).length;
    const won = myScore > theirScore;
    const tied = myScore === theirScore;

    return (
      <div className="min-h-screen p-4 flex items-center justify-center bg-dashboard bg-doodle-watermark relative overflow-hidden">
        {/* Glow backgrounds */}
        <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className="max-w-[480px] w-full space-y-4 relative z-10"
        >
          <Card className="bg-card/45 backdrop-blur-2xl border border-white/5 dark:border-white/10 shadow-[0_8px_32px_0_rgba(99,102,241,0.08)] rounded-[2.5rem] overflow-hidden">
            <CardContent className="p-8 text-center space-y-6 relative">
              {/* Battle result animation */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 180, damping: 15, delay: 0.2 }}
                className="h-24 w-24 mx-auto rounded-[2rem] bg-gradient-to-tr from-primary/10 to-violet-500/20 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5 hover:scale-105 transition-transform duration-300 relative group"
              >
                <div className="absolute inset-0 bg-primary/20 rounded-[2rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none" />
                <Trophy className="h-11 w-11 text-primary drop-shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-pulse" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-1"
              >
                <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
                  {won ? "🎉 Victoire !" : tied ? "🤝 Égalité !" : "😤 Défaite !"}
                </h2>
                <p className="text-muted-foreground text-sm font-semibold">
                  Excellent combat clinique. Félicitations !
                </p>
              </motion.div>

              {/* XP Acquisition Badge */}
              <div className="py-4 border-y border-border/50">
                <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-1">XP ACQUISITION</p>
                <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary font-bold px-4 py-1.5 rounded-full text-sm animate-pulse mt-1">
                  <Flame className="h-4 w-4" />
                  {won ? `+50 XP (Victoire)` : tied ? "+20 XP (Égalité)" : "+10 XP (Participation)"}
                </div>
              </div>

              {/* Score comparison with battle animation */}
              <div className="grid grid-cols-2 gap-4 relative">
                <AnimatePresence>
                  {showClash && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1.5, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
                    >
                      <Swords className="h-12 w-12 text-warning animate-bounce" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  initial={{ x: -40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: "spring", delay: 0.3 }}
                  className={`p-4 rounded-2xl border transition-all duration-300 ${
                    won || tied 
                      ? "bg-green-500/[0.03] border-green-500/20 shadow-[0_4px_20px_rgba(34,197,94,0.05)]" 
                      : "bg-muted/40 border-border"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1.5">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Vous</span>
                  </div>
                  <p className="text-3xl font-black text-foreground font-mono">{myScore}</p>
                  <p className="text-xs font-semibold text-muted-foreground/80 mt-1">{myCorrect}/{duel.question_count} corrects</p>
                </motion.div>

                <motion.div
                  initial={{ x: 40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: "spring", delay: 0.3 }}
                  className={`p-4 rounded-2xl border transition-all duration-300 ${
                    !won && !tied 
                      ? "bg-red-500/[0.03] border-red-500/20 shadow-[0_4px_20px_rgba(239,68,68,0.05)]" 
                      : "bg-muted/40 border-border"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1.5">
                    <User className="h-4 w-4 text-violet-500" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Adversaire</span>
                  </div>
                  <p className="text-3xl font-black text-foreground font-mono">{theirScore}</p>
                  <p className="text-xs font-semibold text-muted-foreground/80 mt-1">{theirCorrect}/{duel.question_count} corrects</p>
                </motion.div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Button 
                  onClick={() => navigate("/duel")} 
                  className="bg-primary text-primary-foreground hover:bg-primary/95 h-13 rounded-full font-bold shadow-lg shadow-primary/10 transition-all duration-300 text-base"
                >
                  Nouveau combat
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate("/dashboard")}
                  className="h-13 rounded-full font-bold border-border hover:bg-muted/30 transition-all duration-300 text-base"
                >
                  Tableau de bord
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Active game
  const currentQuestion = duel.questions[duel.current_question_index] as DuelQuestion | undefined;
  if (!currentQuestion) {
    console.warn("[DuelGame] No question at index", duel.current_question_index, "questions:", duel.questions);
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-dashboard bg-doodle-watermark">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <Swords className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">Question introuvable</p>
            <p className="text-sm text-muted-foreground">
              Les questions du duel n'ont pas pu être chargées (index {duel.current_question_index} / {duel.questions?.length ?? 0}).
            </p>
            <Button onClick={() => navigate("/duel")} className="w-full bg-foreground text-background hover:bg-foreground/90">
              Retour aux duels
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAnswer = async (option: string) => {
    if (hasAnsweredCurrent || selectedAnswer) return;
    setSelectedAnswer(option);
    const timeTaken = Date.now() - questionStartTime;
    const isCorrect = option === currentQuestion.correct_answer;
    
    if (isCorrect) {
      playSound("correct");
      setComboCount(prev => prev + 1);
    } else {
      playSound("wrong");
      setComboCount(0);
    }
    
    await submitAnswer(duel.current_question_index, option, isCorrect, timeTaken);
  };

  const progress = ((duel.current_question_index + 1) / duel.question_count) * 100;
  
  const myScoreVal = isCreator ? duel.creator_score : duel.opponent_score;
  const opponentScoreVal = isCreator ? duel.opponent_score : duel.creator_score;
  const totalScoreVal = myScoreVal + opponentScoreVal || 1;
  const scoreRatio = (myScoreVal / totalScoreVal) * 100;

  return (
    <div className="min-h-screen p-4 sm:p-8 bg-dashboard bg-doodle-watermark relative overflow-hidden flex flex-col justify-center">
      {/* Background decorations */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-[760px] mx-auto w-full space-y-6 relative z-10">
        {/* Versus Match Panel */}
        <div className="grid grid-cols-3 items-center gap-4 p-4 rounded-3xl bg-card/45 backdrop-blur-2xl border border-white/5 dark:border-white/10 shadow-lg">
          {/* You */}
          <div className="flex flex-col items-center sm:flex-row gap-3 pl-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-center sm:text-left">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Vous</p>
              <p className="text-xl font-black text-foreground font-mono leading-none mt-0.5">{myScoreVal}</p>
            </div>
          </div>

          {/* VS Center */}
          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="relative h-9 w-9 flex items-center justify-center rounded-full bg-gradient-to-tr from-primary to-violet-500 text-primary-foreground font-black text-xs shadow-lg shadow-primary/20 pointer-events-none select-none">
              <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-25" />
              VS
            </div>
            <Badge variant="outline" className="text-[10px] font-bold border-border/80 uppercase px-2 py-0.5 tracking-wider bg-muted/40 text-muted-foreground select-none">
              Q{duel.current_question_index + 1}/{duel.question_count}
            </Badge>
          </div>

          {/* Opponent */}
          <div className="flex flex-col items-center sm:flex-row-reverse gap-3 pr-2 text-right">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 text-violet-500">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-center sm:text-right">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Adversaire</p>
              <p className="text-xl font-black text-foreground font-mono leading-none mt-0.5">{opponentScoreVal}</p>
            </div>
          </div>
        </div>

        {/* Versus Battle Jauge */}
        <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden flex border border-white/5">
          <motion.div 
            className="h-full bg-gradient-to-r from-cyan-500 to-primary transition-all duration-500" 
            style={{ width: `${scoreRatio}%` }}
          />
          <motion.div 
            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500" 
            style={{ width: `${100 - scoreRatio}%` }}
          />
        </div>

        {/* Question Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={duel.current_question_index}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ type: "spring", stiffness: 120, damping: 16 }}
          >
            <Card className="bg-card/45 backdrop-blur-2xl border border-white/5 dark:border-white/10 shadow-xl rounded-[2.5rem] overflow-hidden">
              <div className="h-1.5 w-full bg-muted/20">
                <motion.div 
                  className="h-full bg-primary" 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Diagnostic Clinique
                  </span>
                  
                  {comboCount >= 2 && (
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="flex items-center gap-1 bg-warning/10 text-warning px-3 py-1 rounded-full border border-warning/20 shadow-sm"
                    >
                      <Flame className="h-4 w-4 animate-bounce" />
                      <span className="text-xs font-black uppercase tracking-wider">x{comboCount} Combo!</span>
                    </motion.div>
                  )}
                </div>

                <p className="font-bold text-foreground leading-relaxed text-base md:text-lg">
                  {currentQuestion.question}
                </p>

                {/* Staggered Options list */}
                <div className="grid gap-3 pt-2">
                  {currentQuestion.options.map((option, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const isSelected = selectedAnswer === option;
                    const isCorrect = option === currentQuestion.correct_answer;
                    const showFeedback = hasAnsweredCurrent;

                    return (
                      <motion.button
                        key={idx}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: showFeedback ? 1 : 1.01 }}
                        whileTap={{ scale: showFeedback ? 1 : 0.99 }}
                        transition={{ delay: idx * 0.06, type: "spring", stiffness: 120 }}
                        animate={showFeedback && isSelected && !isCorrect ? { x: [0, -8, 8, -8, 8, 0] } : { opacity: 1, y: 0 }}
                        onClick={() => handleAnswer(option)}
                        disabled={hasAnsweredCurrent}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all text-sm font-semibold flex items-center justify-between ${
                          showFeedback && isCorrect
                            ? "border-green-500/40 bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.1)] text-green-600 dark:text-green-400"
                            : showFeedback && isSelected && !isCorrect
                            ? "border-red-500/40 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.1)] text-red-600 dark:text-red-400"
                            : isSelected
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-border-hover hover:bg-muted/30 text-foreground/90"
                        }`}
                      >
                        <div className="flex items-start gap-4 pr-2">
                          <span className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-extrabold ${
                            showFeedback && isCorrect
                              ? "bg-green-500 text-white"
                              : showFeedback && isSelected && !isCorrect
                              ? "bg-red-500 text-white"
                              : isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground group-hover:bg-muted-hover"
                          }`}>
                            {showFeedback && isCorrect ? <CheckCircle className="h-4 w-4" /> :
                             showFeedback && isSelected && !isCorrect ? <XCircle className="h-4 w-4" /> : letter}
                          </span>
                          <span className="pt-0.5 leading-relaxed">{option}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Status indicators */}
                {hasAnsweredCurrent && !opponentAnsweredCurrent && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-4 border-t border-border/50"
                  >
                    <Clock className="h-4 w-4 animate-spin" />
                    <span className="font-semibold">Diagnostic envoyé. En attente de votre confrère...</span>
                  </motion.div>
                )}

                {showResult && currentQuestion.explanation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-4 rounded-2xl bg-muted/40 border border-border/50 text-sm font-medium text-muted-foreground/90 leading-relaxed shadow-inner"
                  >
                    <div className="flex items-center gap-1.5 text-primary font-bold mb-1.5 uppercase text-xs tracking-wider">
                      <span>💡 Explication Physiopathologique</span>
                    </div>
                    {currentQuestion.explanation}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DuelGame;
