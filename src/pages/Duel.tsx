import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Swords, Trophy, Users, Zap, Shield, 
  ArrowRight, KeySquare, PlusCircle, LogIn, Crosshair, X, CheckCircle2, Copy, Crown
} from "lucide-react";
import { AnimatedBanner } from "@/components/AnimatedBanner";
import confetti from "canvas-confetti";
import { uiAudio } from "@/utils/audio";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// --- Types & Fake Data ---
type DuelState = "lobby" | "playing" | "results";
type ActionState = "idle" | "creating" | "joining";

const MOCK_QUESTION = {
  text: "Quelle est la durée maximale d'ischémie chaude tolérée pour un rein avant transplantation ?",
  options: ["30 minutes", "60 minutes", "120 minutes", "24 heures"],
  correct: 0,
};

export const DuelMode = () => {
  const [gameState, setGameState] = useState<DuelState>("lobby");
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [joinCode, setJoinCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [leaderboard, setLeaderboard] = useState<{ rank: number; name: string; elo: number; winRate: string; status: string }[]>([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', { limit_count: 5 });
      if (!error && data) {
        setLeaderboard(
          data.map((player, idx) => ({
            rank: idx + 1,
            name: player.display_name,
            elo: player.xp || player.total_quizzes_completed * 10,
            winRate: "N/A",
            status: "online"
          }))
        );
      }
    };
    fetchLeaderboard();
  }, []);
  
  const [score, setScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // --- Moteurs d'actions simplifiés ---
  const handleCreateMatch = () => {
    uiAudio.playSoftClick();
    setActionState("creating");
    setGeneratedCode("MED-" + Math.random().toString(36).substring(2, 6).toUpperCase());
    
    // Simulation qu'un joueur rejoint après 4 secondes
    setTimeout(() => {
      if (gameState === "lobby") { // S'il n'a pas annulé
        uiAudio.playSuccess();
        toast.success("Adversaire trouvé ! Préparation de l'arène...");
        setTimeout(() => startMatch(), 1500);
      }
    }, 4000);
  };

  const handleJoinMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.length < 4) return toast.error("Code invalide.");
    
    uiAudio.playSoftClick();
    toast.success("Connexion à l'arène " + joinCode.toUpperCase() + "...");
    setTimeout(() => startMatch(), 1500);
  };

  const startMatch = () => {
    setGameState("playing");
    setActionState("idle");
    setTimeLeft(15);
    setScore(0);
    setOpponentScore(0);
    setSelectedAnswer(null);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    toast.success("Code copié dans le presse-papier !");
  };

  const handleAnswer = (idx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    
    if (idx === MOCK_QUESTION.correct) {
      setScore(prev => prev + 1);
      uiAudio.playSuccess();
    } else {
      uiAudio.playSoftClick(); 
    }

    // Simulation réponse adversaire
    setTimeout(() => {
      if (Math.random() > 0.4) setOpponentScore(prev => prev + 1);
      setTimeout(() => {
        setGameState("results");
        if (idx === MOCK_QUESTION.correct) confetti({ particleCount: 150, spread: 80, colors: ['#5B21B6', '#111111'] });
      }, 1500);
    }, 1000);
  };

  // Timer de l'arène
  useEffect(() => {
    if (gameState === "playing" && timeLeft > 0 && selectedAnswer === null) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [gameState, timeLeft, selectedAnswer]);

  // --- Animations ---
  const fadeVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#0E0E0C] text-[#111111] dark:text-[#F4F4F2] bg-doodle-watermark font-sans pt-8 pb-24">
      <style dangerouslySetInnerHTML={{__html: `
        .editorial-scrollbar::-webkit-scrollbar { width: 4px; }
        .editorial-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .editorial-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .editorial-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.25); }
      `}} />

      <div className="max-w-[1400px] mx-auto px-6 space-y-10">
        
        {/* LA BANDEROLE ANIMÉE */}
        <AnimatedBanner 
          title="Mode Duel."
          subtitle="Créez une salle, invitez un confrère, et testez vos réflexes cliniques."
          rightWidgets={
            gameState === "lobby" && actionState === "idle" && (
              <button 
                onClick={() => setActionState("joining")}
                className="h-12 px-8 rounded-full bg-white text-[#111111] font-bold uppercase tracking-widest text-xs flex items-center gap-3 hover:bg-[#111111] hover:text-white transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                <LogIn className="h-4 w-4" /> Rejoindre
              </button>
            )
          }
        />

        <AnimatePresence mode="wait">
          
          {/* =========================================
              VUE 1 : LE LOBBY (Avec Créer / Rejoindre)
              ========================================= */}
          {gameState === "lobby" && (
            <motion.div key="lobby" initial="hidden" animate="show" exit={{ opacity: 0, scale: 0.98 }} variants={fadeVariants} className="grid lg:grid-cols-12 gap-8">
              
              {/* Colonne Gauche : Actions & Profil (5/12) */}
              <div className="lg:col-span-5 space-y-8">
                
                {/* Carte Identité */}
                <div className="bg-[#111111] text-white border border-[#111111] rounded-[2.5rem] p-10 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                    <Shield className="w-48 h-48" />
                  </div>
                  
                  <div className="relative z-10 flex items-start justify-between mb-12">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-2">Médecin Titulaire</span>
                      <h2 className="text-3xl font-light tracking-tight">Dr. Utilisateur</h2>
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-md mt-3 border border-white/10">
                        <Trophy className="h-3 w-3 text-amber-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Ligue Or</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 grid grid-cols-2 gap-8 pt-8 border-t border-white/10">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">Score ELO</span>
                      <span className="text-5xl font-light tracking-tighter">1840</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">Victoires</span>
                      <span className="text-5xl font-light tracking-tighter text-[#5B21B6]">64<span className="text-2xl">%</span></span>
                    </div>
                  </div>
                </div>

                {/* ZONE D'ACTIONS DYNAMIQUES (Créer / Rejoindre) */}
                <div className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2.5rem] p-8 shadow-sm overflow-hidden min-h-[200px] flex flex-col justify-center">
                  <AnimatePresence mode="wait">
                    
                    {/* État par défaut : Choix de l'action */}
                    {actionState === "idle" && (
                      <motion.div key="idle" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="grid grid-cols-2 gap-4">
                        <button onClick={handleCreateMatch} className="p-6 rounded-[1.5rem] border border-black/10 dark:border-white/10 flex flex-col items-center justify-center gap-4 hover:border-[#111111] hover:bg-[#111111] hover:text-white transition-all duration-300 group">
                          <div className="h-12 w-12 rounded-full bg-[#FAFAF8] dark:bg-[#111110] flex items-center justify-center group-hover:bg-white/20 transition-colors">
                            <PlusCircle className="h-5 w-5" />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-widest text-center">Créer Match</span>
                        </button>

                        <button onClick={() => setActionState("joining")} className="p-6 rounded-[1.5rem] border border-black/10 dark:border-white/10 flex flex-col items-center justify-center gap-4 hover:border-[#5B21B6] hover:bg-[#5B21B6] hover:text-white transition-all duration-300 group">
                          <div className="h-12 w-12 rounded-full bg-[#FAFAF8] dark:bg-[#111110] flex items-center justify-center group-hover:bg-white/20 transition-colors">
                            <KeySquare className="h-5 w-5" />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-widest text-center">Rejoindre</span>
                        </button>
                      </motion.div>
                    )}

                    {/* État : Création de Match (Salle d'attente) */}
                    {actionState === "creating" && (
                      <motion.div key="creating" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full border-[3px] border-black/5 dark:border-white/5 border-t-[#5B21B6] animate-spin mb-6" />
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mb-2">Salle d'attente ouverte</h3>
                        <p className="text-sm font-medium mb-6">Partagez ce code avec votre adversaire :</p>
                        
                        <div className="flex items-center gap-2 mb-6">
                          <div className="bg-[#FAFAF8] dark:bg-[#111110] border border-black/10 dark:border-white/10 px-8 py-4 rounded-2xl text-3xl font-mono tracking-[0.2em] font-bold text-[#111111] dark:text-[#F4F4F2]">
                            {generatedCode}
                          </div>
                          <button onClick={copyCode} className="h-16 w-16 rounded-2xl bg-[#111111] text-white flex items-center justify-center hover:bg-[#5B21B6] transition-colors" title="Copier le code">
                            <Copy className="h-5 w-5" />
                          </button>
                        </div>
                        
                        <button onClick={() => setActionState("idle")} className="text-[10px] font-bold uppercase tracking-widest text-[#888888] hover:text-[#DC2626] transition-colors">
                          Annuler la création
                        </button>
                      </motion.div>
                    )}

                    {/* État : Rejoindre un Match */}
                    {actionState === "joining" && (
                      <motion.div key="joining" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-lg font-bold text-[#111111]">Rejoindre une arène</h3>
                          <button onClick={() => setActionState("idle")} className="p-2 rounded-full hover:bg-[#FAFAF8] dark:hover:bg-[#111110] transition-colors">
                            <X className="h-4 w-4 text-[#888888]" />
                          </button>
                        </div>
                        
                        <form onSubmit={handleJoinMatch} className="space-y-4">
                          <div className="relative">
                            <KeySquare className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#888888]" />
                            <input 
                              type="text" 
                              value={joinCode}
                              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                              placeholder="Entrez le code (ex: MED-789X)" 
                              className="w-full bg-[#FAFAF8] dark:bg-[#111110] border border-black/10 dark:border-white/10 focus:border-[#5B21B6] focus:ring-1 focus:ring-[#5B21B6] rounded-2xl pl-12 pr-4 py-5 text-lg font-mono font-bold tracking-wider outline-none uppercase transition-all dark:text-[#F4F4F2] dark:placeholder:text-[#666]"
                              autoFocus
                            />
                          </div>
                          <button type="submit" disabled={joinCode.length < 4} className="w-full py-5 rounded-2xl bg-[#111111] text-white font-bold uppercase tracking-widest text-xs hover:bg-[#5B21B6] disabled:opacity-50 disabled:hover:bg-[#111111] transition-all duration-300">
                            Entrer dans l'arène
                          </button>
                        </form>
                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>
              </div>

              {/* Colonne Droite : Le Hall of Fame (7/12) */}
              <div className="lg:col-span-7 bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2.5rem] p-10 shadow-sm flex flex-col h-full">
                <div className="flex justify-between items-center mb-8 pb-6 border-b border-black/5 dark:border-white/5">
                  <div>
                    <h3 className="text-2xl font-medium tracking-tight text-[#111111] flex items-center gap-3">
                      <Crown className="h-6 w-6 text-amber-500" /> Top 50 National
                    </h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mt-2">Saison 4 • Concours Blanc</p>
                  </div>
                  <button className="h-10 px-6 rounded-full bg-[#FAFAF8] dark:bg-[#111110] border border-black/5 dark:border-white/5 text-[10px] font-bold uppercase tracking-widest hover:border-black/20 hover:text-[#111111] dark:hover:text-[#F4F4F2] transition-colors text-[#888888]">
                    Voir Tout
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto editorial-scrollbar pr-2">
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-[#888888]">
                      <div className="col-span-1 text-center">#</div>
                      <div className="col-span-6">Médecin</div>
                      <div className="col-span-3 text-right">ELO</div>
                      <div className="col-span-2 text-right">Win</div>
                    </div>
                    
                    {leaderboard.map((player) => (
                      <div key={player.rank} className="grid grid-cols-12 gap-4 px-4 py-4 rounded-2xl border border-transparent hover:border-black/5 dark:hover:border-white/5 hover:bg-[#FAFAF8] dark:hover:bg-[#111110] transition-colors items-center">
                        <div className="col-span-1 text-center">
                          <span className={`text-sm font-bold ${player.rank === 1 ? "text-amber-500" : player.rank === 2 ? "text-slate-400" : player.rank === 3 ? "text-amber-700" : "text-[#111111]"}`}>
                            {player.rank}
                          </span>
                        </div>
                        <div className="col-span-6 flex items-center gap-3">
                          <div className="relative">
                            <div className="h-8 w-8 rounded-full bg-[#111111] text-white flex items-center justify-center text-xs font-bold">
                              {player.name.charAt(0)}
                            </div>
                            {player.status === "online" && <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 border-2 border-white dark:border-[#161614] rounded-full" />}
                            {player.status === "in-match" && <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-red-500 border-2 border-white dark:border-[#161614] rounded-full animate-pulse" />}
                          </div>
                          <span className="text-sm font-medium text-[#111111]">{player.name}</span>
                        </div>
                        <div className="col-span-3 text-right font-mono text-sm tracking-tighter text-[#5B21B6] font-medium">
                          {player.elo}
                        </div>
                        <div className="col-span-2 text-right font-mono text-xs text-[#888888]">
                          {player.winRate}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* =========================================
              VUE 2 : L'ARÈNE (Le Duel Actif)
              ========================================= */}
          {gameState === "playing" && (
            <motion.div key="playing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl mx-auto flex flex-col h-[70vh] min-h-[600px]">
              
              <div className="flex justify-between items-center bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-full p-3 shadow-sm mb-12 shrink-0">
                <div className="flex items-center gap-4 bg-[#FAFAF8] dark:bg-[#111110] rounded-full pr-6 pl-2 py-2 border border-black/5 dark:border-white/5">
                  <div className="h-10 w-10 bg-[#5B21B6] rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm">
                    TOI
                  </div>
                  <span className="text-2xl font-light tracking-tighter w-8 text-center">{score}</span>
                </div>

                <div className="flex flex-col items-center justify-center px-8">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mb-1">Question 1/5</span>
                  <div className={`text-3xl font-mono tracking-tighter ${timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-[#111111]"}`}>
                    00:{timeLeft.toString().padStart(2, '0')}
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-[#FAFAF8] dark:bg-[#111110] rounded-full pl-6 pr-2 py-2 border border-black/5 dark:border-white/5">
                  <span className="text-2xl font-light tracking-tighter w-8 text-center">{opponentScore}</span>
                  <div className="h-10 w-10 bg-[#111111] rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm">
                    ADV
                  </div>
                </div>
              </div>

              <div className="w-full h-1 bg-black/5 dark:bg-white/5 rounded-full mb-12 overflow-hidden shrink-0">
                <motion.div 
                  className={`h-full ${timeLeft <= 5 ? "bg-red-500" : "bg-[#5B21B6]"}`}
                  initial={{ width: "100%" }}
                  animate={{ width: `${(timeLeft / 15) * 100}%` }}
                  transition={{ ease: "linear", duration: 1 }}
                />
              </div>

              <div className="text-center mb-16 shrink-0 px-4">
                <h3 className="text-3xl md:text-4xl font-serif text-[#111111] leading-relaxed">
                  {MOCK_QUESTION.text}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow content-start">
                {MOCK_QUESTION.options.map((opt, idx) => {
                  let btnStyle = "bg-white dark:bg-[#161614] border-black/10 dark:border-white/10 text-[#111111] dark:text-[#F4F4F2] hover:border-[#5B21B6] hover:bg-[#5B21B6] hover:text-white shadow-sm";
                  
                  if (selectedAnswer !== null) {
                    if (idx === MOCK_QUESTION.correct) btnStyle = "bg-green-500 border-green-500 text-white shadow-lg";
                    else if (selectedAnswer === idx) btnStyle = "bg-red-500 border-red-500 text-white";
                    else btnStyle = "bg-[#FAFAF8] dark:bg-[#111110] border-black/5 dark:border-white/5 text-[#888888] opacity-50";
                  }

                  return (
                    <button 
                      key={idx} 
                      disabled={selectedAnswer !== null}
                      onClick={() => handleAnswer(idx)}
                      className={`p-6 rounded-2xl border transition-all duration-300 text-left flex items-start gap-4 ${btnStyle}`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-lg font-medium leading-snug">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* =========================================
              VUE 3 : RÉSULTATS (Bilan du Duel)
              ========================================= */}
          {gameState === "results" && (
            <motion.div key="results" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto pt-10">
              <div className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2.5rem] p-14 text-center shadow-sm relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-3 ${score >= opponentScore ? "bg-[#5B21B6]" : "bg-[#111111]"}`} />
                
                <div className={`h-24 w-24 rounded-full flex items-center justify-center mx-auto mb-8 ${score >= opponentScore ? "bg-[#5B21B6]/10" : "bg-black/5"}`}>
                  {score >= opponentScore ? <Trophy className="h-12 w-12 text-[#5B21B6]" /> : <X className="h-12 w-12 text-[#111111]" />}
                </div>
                
                <h2 className="text-5xl font-light tracking-tighter mb-4 text-[#111111]">
                  {score > opponentScore ? "Victoire Clinique." : score === opponentScore ? "Égalité." : "Défaite."}
                </h2>
                <p className="text-[#666666] mb-10 font-medium">Les connaissances ont tranché.</p>
                
                <div className="flex justify-center items-center gap-8 mb-12">
                  <div className="text-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888] block mb-2">Toi</span>
                    <span className="text-6xl font-light tracking-tighter text-[#5B21B6]">{score}</span>
                  </div>
                  <div className="text-2xl font-light text-[#888888]">-</div>
                  <div className="text-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888] block mb-2">Adversaire</span>
                    <span className="text-6xl font-light tracking-tighter text-[#111111]">{opponentScore}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={() => setGameState("lobby")} className="flex-1 py-5 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-[#161614] text-[#111111] dark:text-[#F4F4F2] font-bold uppercase tracking-widest text-xs hover:bg-[#111111] hover:text-white transition-all duration-300">
                    Retour au Lobby
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default DuelMode;
