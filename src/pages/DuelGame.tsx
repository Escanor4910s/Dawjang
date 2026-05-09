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
      <div className="min-h-screen p-4 bg-doodle-watermark">
        <div className="max-w-lg mx-auto space-y-4 pt-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Swords className="h-5 w-5 animate-pulse" />
            <span className="text-sm">Chargement du duel...</span>
          </div>
          <div className="h-2 bg-muted rounded animate-pulse" />
          <div className="h-32 bg-muted rounded-2xl animate-pulse" />
          <div className="space-y-2">
            {[0,1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}
          </div>
          <p className="text-xs text-muted-foreground text-center">État: <span className="font-mono">loading</span></p>
        </div>
      </div>
    );
  }

  // Waiting for opponent
  if (duel.status === "waiting") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-doodle-watermark">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <Swords className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
            <p className="text-lg font-medium">En attente de l'adversaire...</p>
            <p className="text-sm text-muted-foreground">Code: <span className="font-mono font-bold">{duel.invite_code}</span></p>
            <Badge variant="outline" className="text-xs">État: waiting</Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error: no valid questions
  if (duel.status === "active" && (!duel.questions || duel.questions.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-doodle-watermark">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <Swords className="h-12 w-12 mx-auto text-destructive" />
            <p className="text-lg font-medium text-foreground">Erreur de duel</p>
            <p className="text-sm text-muted-foreground">
              Aucune question valide n'a été chargée pour ce duel. Cela peut arriver si le QCM source était dans un format incompatible.
            </p>
            <Button onClick={() => navigate("/duel")} className="w-full bg-foreground text-background hover:bg-foreground/90">
              Retour aux duels
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Countdown
  if (countdown !== null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-doodle-watermark">
        <motion.div
          key={countdown}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          className="text-7xl font-black text-foreground"
        >
          {countdown === 0 ? "⚔️ GO!" : countdown}
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
      <div className="min-h-screen p-4 flex items-center justify-center bg-doodle-watermark">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full space-y-4"
        >
          <Card className="border-2 border-foreground/20 overflow-hidden">
            <CardContent className="p-6 text-center space-y-6 relative">
              {/* Battle result animation */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                className="h-20 w-20 mx-auto rounded-full bg-foreground flex items-center justify-center"
              >
                <Trophy className="h-10 w-10 text-background" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h2 className="text-2xl font-bold text-foreground">
                  {won ? "🎉 Victoire !" : tied ? "🤝 Égalité !" : "😤 Défaite !"}
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {won ? `+50 XP bonus !` : tied ? "+20 XP" : "+10 XP de participation"}
                </p>
              </motion.div>

              {/* Score comparison with battle animation */}
              <div className="grid grid-cols-2 gap-4 relative">
                <AnimatePresence>
                  {showClash && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1.5, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center z-10"
                    >
                      <Swords className="h-12 w-12 text-warning" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.div
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className={`p-4 rounded-xl ${won || tied ? "bg-primary/20 ring-2 ring-primary/30" : "bg-muted"}`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Shield className="h-4 w-4" />
                    <span className="text-xs font-medium">Vous</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{myScore}</p>
                  <p className="text-xs text-muted-foreground">{myCorrect}/{duel.question_count} correct</p>
                </motion.div>
                <motion.div
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className={`p-4 rounded-xl ${!won && !tied ? "bg-destructive/10 ring-2 ring-destructive/30" : "bg-muted"}`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <User className="h-4 w-4" />
                    <span className="text-xs font-medium">Adversaire</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{theirScore}</p>
                  <p className="text-xs text-muted-foreground">{theirCorrect}/{duel.question_count} correct</p>
                </motion.div>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={() => navigate("/duel")} className="bg-foreground text-background hover:bg-foreground/90">
                  Nouveau duel
                </Button>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  Retour au Dashboard
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-doodle-watermark">
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

  return (
    <div className="min-h-screen p-4 bg-doodle-watermark">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            <Swords className="h-3 w-3 mr-1" />
            Q{duel.current_question_index + 1}/{duel.question_count}
          </Badge>
          
          {comboCount >= 2 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1"
            >
              <Flame className="h-4 w-4 text-warning" />
              <span className="text-xs font-bold text-warning">x{comboCount} combo!</span>
            </motion.div>
          )}

          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-foreground">
              {isCreator ? duel.creator_score : duel.opponent_score}
            </span>
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-muted-foreground font-bold"
            >
              ⚔️
            </motion.span>
            <span className="font-medium text-foreground">
              {isCreator ? duel.opponent_score : duel.creator_score}
            </span>
          </div>
        </div>

        <Progress value={progress} className="h-1.5" />

        {/* Clash animation overlay */}
        <AnimatePresence>
          {showClash && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1.5 }}
              exit={{ opacity: 0, scale: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div className="text-6xl">⚔️</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={duel.current_question_index}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <Card className="border-2 border-foreground/10">
              <CardContent className="p-5 space-y-4">
                <p className="font-medium text-foreground leading-relaxed text-sm md:text-base">
                  {currentQuestion.question}
                </p>

                <div className="space-y-2">
                  {currentQuestion.options.map((option, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const isSelected = selectedAnswer === option;
                    const isCorrect = option === currentQuestion.correct_answer;
                    const showFeedback = hasAnsweredCurrent;

                    return (
                      <motion.button
                        key={idx}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleAnswer(option)}
                        disabled={hasAnsweredCurrent}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${
                          showFeedback && isCorrect
                            ? "border-green-500 bg-green-500/10"
                            : showFeedback && isSelected && !isCorrect
                            ? "border-red-500 bg-red-500/10"
                            : isSelected
                            ? "border-foreground bg-foreground/5"
                            : "border-foreground/10 hover:border-foreground/30"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            showFeedback && isCorrect
                              ? "bg-green-500 text-background"
                              : showFeedback && isSelected && !isCorrect
                              ? "bg-red-500 text-background"
                              : isSelected
                              ? "bg-foreground text-background"
                              : "bg-foreground/10 text-foreground"
                          }`}>
                            {showFeedback && isCorrect ? <CheckCircle className="h-4 w-4" /> :
                             showFeedback && isSelected && !isCorrect ? <XCircle className="h-4 w-4" /> : letter}
                          </span>
                          <span className="text-foreground pt-0.5">{option}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Status indicators */}
                {hasAnsweredCurrent && !opponentAnsweredCurrent && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
                    <Clock className="h-4 w-4 animate-pulse" />
                    En attente de l'adversaire...
                  </div>
                )}

                {showResult && currentQuestion.explanation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-3 rounded-lg bg-muted text-sm text-muted-foreground"
                  >
                    💡 {currentQuestion.explanation}
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
