import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Brain, TrendingUp, Flame, Target, Clock, 
  ChevronDown, Activity, AlertCircle, Sparkles
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, Cell
} from "recharts";
import { AnimatedBanner } from "@/components/AnimatedBanner";

// --- Données Simulées pour le design ---
const progressionData = [
  { name: "Lun", score: 65, cards: 120 },
  { name: "Mar", score: 70, cards: 150 },
  { name: "Mer", score: 68, cards: 140 },
  { name: "Jeu", score: 75, cards: 180 },
  { name: "Ven", score: 82, cards: 210 },
  { name: "Sam", score: 85, cards: 250 },
  { name: "Dim", score: 88, cards: 200 },
];

const specialtyData = [
  { subject: "Cardiologie", A: 90, fullMark: 100 },
  { subject: "Neurologie", A: 45, fullMark: 100 },
  { subject: "Pneumologie", A: 75, fullMark: 100 },
  { subject: "Gastro", A: 85, fullMark: 100 },
  { subject: "Endocrino", A: 60, fullMark: 100 },
  { subject: "Néphrologie", A: 70, fullMark: 100 },
];

// Génération de la Heatmap (7 jours x 12 semaines)
const generateHeatmap = () => {
  const data = [];
  for (let i = 0; i < 84; i++) {
    const intensity = Math.random() > 0.3 ? Math.floor(Math.random() * 4) + 1 : 0;
    data.push(intensity);
  }
  return data;
};
const heatmapData = generateHeatmap();

export const Statistics = () => {
  const [timeframe, setTimeframe] = useState("7j");

  // --- Animations ---
  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } } };

  // Custom Tooltip pour Recharts (Éditorial et net)
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111111] text-white p-4 rounded-xl shadow-xl border border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">{label}</p>
          <p className="text-xl font-light">{payload[0].value}% <span className="text-xs text-white/70">Rétention</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#0E0E0C] text-[#111111] dark:text-[#F4F4F2] bg-doodle-watermark font-sans pt-8 pb-20">
      <div className="max-w-[1400px] mx-auto px-6 space-y-8">
        
        {/* LA BANDEROLE ANIMÉE */}
        <AnimatedBanner 
          title="Statistiques."
          subtitle="Analysez vos performances cognitives et votre endurance clinique."
          rightWidgets={
            <div className="flex bg-white/10 backdrop-blur-md p-1.5 rounded-full border border-white/20">
              {["7j", "30j", "All"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                    timeframe === t ? "bg-white text-[#111111] shadow-sm" : "text-white/70 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          }
        />

        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LIGNE 1 : KPIs Rapides (3 colonnes) */}
          <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <motion.div variants={itemVariants} className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2rem] p-8 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
              <div className="flex justify-between items-start mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888] dark:text-[#666660] group-hover:text-[#5B21B6] transition-colors">Taux de Rétention</span>
                <Brain className="h-4 w-4 text-[#111111] dark:text-[#F4F4F2]" />
              </div>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-light tracking-tighter">88</span>
                <span className="text-lg text-[#666666] dark:text-[#A0A09A] font-medium mb-1">%</span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-green-500 mt-4 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +4% ce mois
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2rem] p-8 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
              <div className="flex justify-between items-start mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888] dark:text-[#666660] group-hover:text-amber-500 transition-colors">Série en cours</span>
                <Flame className="h-4 w-4 text-[#111111] dark:text-[#F4F4F2]" />
              </div>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-light tracking-tighter">14</span>
                <span className="text-lg text-[#666666] dark:text-[#A0A09A] font-medium mb-1">jours</span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] dark:text-[#666660] mt-4">
                Record : 32 jours
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2rem] p-8 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
              <div className="flex justify-between items-start mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888] dark:text-[#666660] group-hover:text-[#5B21B6] transition-colors">Cartes Maîtrisées</span>
                <Target className="h-4 w-4 text-[#111111] dark:text-[#F4F4F2]" />
              </div>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-light tracking-tighter text-[#5B21B6]">1,240</span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] dark:text-[#666660] mt-4">
                Mémoire à long terme (SM-2)
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-[#111111] text-white border border-[#111111] rounded-[2rem] p-8 shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full group-hover:scale-150 transition-transform duration-700" />
              <div className="flex justify-between items-start mb-6 relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Temps de Focus</span>
                <Clock className="h-4 w-4 text-white" />
              </div>
              <div className="flex items-end gap-2 relative z-10">
                <span className="text-5xl font-light tracking-tighter">42</span>
                <span className="text-lg text-white/70 font-medium mb-1">heures</span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5B21B6] mt-4 relative z-10 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Top 5% des étudiants
              </p>
            </motion.div>
          </div>

          {/* LIGNE 2 : Graphique de Progression & Radar des Spécialités */}
          <motion.div variants={itemVariants} className="lg:col-span-8 bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2rem] p-8 md:p-10 shadow-sm flex flex-col group">
            <div className="flex justify-between items-center mb-10 pb-4 border-b border-black/5 dark:border-white/5">
              <div>
                <h3 className="text-xl font-medium text-[#111111] dark:text-[#F4F4F2]">Courbe d'Apprentissage</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] dark:text-[#666660] mt-1">Évolution de la rétention</p>
              </div>
              <button className="h-10 px-4 rounded-full border border-black/10 dark:border-white/10 text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-[#111111] transition-colors">
                Détails <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            
            <div className="flex-1 min-h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={progressionData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5B21B6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#5B21B6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#111111', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#5B21B6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorScore)" 
                    activeDot={{ r: 6, fill: "#111111", stroke: "#white", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="lg:col-span-4 bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2rem] p-8 md:p-10 shadow-sm flex flex-col">
            <div className="mb-8">
              <h3 className="text-xl font-medium text-[#111111] dark:text-[#F4F4F2]">Audit par Spécialité</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] dark:text-[#666660] mt-1">Analyse Radar</p>
            </div>
            
            <div className="flex-1 min-h-[250px] w-full relative">
              {/* Insight IA par-dessus le radar */}
              <div className="absolute -top-4 right-0 z-10 bg-red-50 border border-red-200 text-red-600 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-sm animate-pulse">
                <AlertCircle className="h-3 w-3" /> Faiblesse : Neurologie
              </div>

              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={specialtyData}>
                  <PolarGrid stroke="#e5e5e5" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#888888', fontSize: 10, fontWeight: 'bold' }} />
                  <Radar name="Score" dataKey="A" stroke="#5B21B6" strokeWidth={2} fill="#5B21B6" fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* LIGNE 3 : Habit Tracker (La Heatmap) */}
          <motion.div variants={itemVariants} className="lg:col-span-12 bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2rem] p-8 md:p-10 shadow-sm flex flex-col lg:flex-row items-center gap-10">
            <div className="lg:w-1/4">
              <h3 className="text-xl font-medium text-[#111111] dark:text-[#F4F4F2]">Constance</h3>
              <p className="text-sm text-[#666666] dark:text-[#A0A09A] mt-2 mb-6">La médecine est un marathon. Votre régularité est votre meilleure arme pour les ECNi.</p>
              <div className="flex gap-2 items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888] dark:text-[#666660]">Moins</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-sm bg-[#FAFAF8] dark:bg-[#111110] border border-black/5 dark:border-white/5" />
                  <div className="w-3 h-3 rounded-sm bg-[#5B21B6]/20" />
                  <div className="w-3 h-3 rounded-sm bg-[#5B21B6]/50" />
                  <div className="w-3 h-3 rounded-sm bg-[#5B21B6]/80" />
                  <div className="w-3 h-3 rounded-sm bg-[#5B21B6]" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888] dark:text-[#666660]">Plus</span>
              </div>
            </div>

            <div className="lg:w-3/4 overflow-x-auto editorial-scrollbar pb-4">
              <div className="grid grid-flow-col gap-1.5" style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))' }}>
                {heatmapData.map((intensity, idx) => {
                  let bgColor = "bg-[#FAFAF8] dark:bg-[#111110] border border-black/5 dark:border-white/5"; // 0
                  if (intensity === 1) bgColor = "bg-[#5B21B6]/20";
                  if (intensity === 2) bgColor = "bg-[#5B21B6]/50";
                  if (intensity === 3) bgColor = "bg-[#5B21B6]/80";
                  if (intensity >= 4) bgColor = "bg-[#5B21B6] shadow-[0_0_8px_rgba(91,33,182,0.4)]";

                  return (
                    <div 
                      key={idx} 
                      className={`w-4 h-4 rounded-sm ${bgColor} hover:scale-125 transition-transform duration-200 cursor-pointer`}
                      title={`${intensity * 25} cartes révisées`}
                    />
                  );
                })}
              </div>
            </div>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
};

export default Statistics;
