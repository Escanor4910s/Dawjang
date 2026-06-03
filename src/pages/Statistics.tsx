import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { Activity, Brain, Clock, Flame, Target, ChevronDown, AlertTriangle, TrendingUp } from "lucide-react";
import { AnimatedBanner } from "@/components/AnimatedBanner";

// ─── COMPOSANT COMPTEUR DYNAMIQUE ───
const CountUp = ({ end, duration = 1500, suffix = "" }: { end: number, duration?: number, suffix?: string }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0; const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { setCount(end); clearInterval(timer); } 
      else { setCount(start); }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);
  return <>{Math.floor(count)}{suffix}</>;
};

// ─── DONNÉES SIMULÉES (À remplacer par ton API Supabase) ───
const areaData = [
  { name: "Lun", value: 65 }, { name: "Mar", value: 68 }, { name: "Mer", value: 64 },
  { name: "Jeu", value: 72 }, { name: "Ven", value: 75 }, { name: "Sam", value: 82 }, { name: "Dim", value: 88 }
];

const radarData = [
  { subject: "Cardiologie", A: 120, fullMark: 150 },
  { subject: "Neurologie", A: 45, fullMark: 150 }, // Point faible
  { subject: "Pneumologie", A: 110, fullMark: 150 },
  { subject: "Gastro", A: 100, fullMark: 150 },
  { subject: "Endocrino", A: 90, fullMark: 150 },
  { subject: "Néphrologie", A: 85, fullMark: 150 },
];

// Générateur de la Heatmap (12 semaines x 7 jours)
const generateHeatmap = () => {
  return Array.from({ length: 84 }).map((_, i) => ({
    id: i, level: Math.random() > 0.3 ? Math.floor(Math.random() * 4) + 1 : 0
  }));
};

const Statistics = () => {
  const [timeRange, setTimeRange] = useState<"7J" | "30J" | "ALL">("7J");
  const [heatmapData, setHeatmapData] = useState<{id: number, level: number}[]>([]);

  useEffect(() => {
    setHeatmapData(generateHeatmap());
  }, []);

  // Configuration de la Heatmap selon le thème primaire
  const getHeatmapColor = (level: number) => {
    if (level === 0) return "bg-muted/30 dark:bg-white/5 border border-border/50";
    if (level === 1) return "bg-primary/20 border border-primary/10";
    if (level === 2) return "bg-primary/40 border border-primary/20";
    if (level === 3) return "bg-primary/70 border border-primary/30";
    return "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)] border border-primary";
  };

  // Animations Framer Motion
  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } } };

  return (
    <div className="min-h-screen bg-transparent text-foreground font-sans overflow-x-hidden pb-32 relative transition-colors duration-700">
      
      {/* ─── FILTRES DE LUMIÈRE EN ARRIÈRE-PLAN ─── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] left-[-5%] w-[30vw] h-[30vw] bg-violet-500/5 rounded-full blur-[150px]" />
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 pt-8 space-y-8 relative z-10">
        
        {/* =========================================================================
            LA BANDEROLE ANIMÉE (Intégration du sélecteur de période)
            ========================================================================= */}
        <div className="w-full relative z-20 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] rounded-b-[3rem]">
          <AnimatedBanner 
            title={<>Statistiques <span className="font-serif italic text-white/90">& Analyse</span></>}
            subtitle="Analysez vos performances cognitives et votre endurance clinique."
            rightWidgets={
              <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[1.5rem] p-1.5 flex shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                {(["7J", "30J", "ALL"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                      timeRange === range 
                        ? "bg-white text-[#111111] shadow-sm" 
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            }
          />
        </div>

        {/* =========================================================================
            GRILLE BENTO (Les KPIs Supérieurs)
            ========================================================================= */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
          
          {/* KPI 1 : Rétention */}
          <motion.div variants={cardVariants} className="group bg-card/60 backdrop-blur-xl border border-border rounded-[2rem] p-8 flex flex-col justify-between shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_20px_40px_-15px_rgba(255,255,255,0.02)] hover:-translate-y-1 hover:border-primary/30 transition-all duration-300">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Taux de rétention</span>
              <Brain className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-5xl font-light tracking-tighter text-foreground mb-3 flex items-baseline gap-1">
                <CountUp end={88} /> <span className="text-2xl text-muted-foreground">%</span>
              </p>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md w-max">
                <TrendingUp className="w-3 h-3" /> +4% Ce mois
              </div>
            </div>
          </motion.div>

          {/* KPI 2 : Série en cours */}
          <motion.div variants={cardVariants} className="group bg-card/60 backdrop-blur-xl border border-border rounded-[2rem] p-8 flex flex-col justify-between shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1 hover:border-amber-500/30 transition-all duration-300">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Série en cours</span>
              <Flame className="w-4 h-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
            </div>
            <div>
              <p className="text-5xl font-light tracking-tighter text-foreground mb-3 flex items-baseline gap-2">
                <CountUp end={14} /> <span className="text-lg font-medium text-muted-foreground tracking-normal uppercase">Jours</span>
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Record : 32 Jours</p>
            </div>
          </motion.div>

          {/* KPI 3 : Cartes Maîtrisées */}
          <motion.div variants={cardVariants} className="group bg-card/60 backdrop-blur-xl border border-border rounded-[2rem] p-8 flex flex-col justify-between shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1 hover:border-primary/30 transition-all duration-300">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Cartes Maîtrisées</span>
              <Target className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-5xl font-light tracking-tighter text-foreground mb-3">
                <CountUp end={1240} />
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mémoire à long terme (SM-2)</p>
            </div>
          </motion.div>

          {/* KPI 4 : Temps de Focus (Le "Dark Matter Accent") */}
          <motion.div variants={cardVariants} className="relative group bg-[#111111] dark:bg-white border border-black/5 dark:border-white/5 rounded-[2rem] p-8 flex flex-col justify-between shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
            {/* Effet lumineux interne */}
            <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-primary/20 rounded-full blur-[60px] pointer-events-none group-hover:bg-primary/30 transition-colors duration-500" />
            
            <div className="flex justify-between items-start mb-6 relative z-10">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#888888]">Temps de focus</span>
              <Clock className="w-4 h-4 text-[#888888] group-hover:text-primary transition-colors" />
            </div>
            <div className="relative z-10">
              <p className="text-5xl font-light tracking-tighter text-white dark:text-[#111111] mb-3 flex items-baseline gap-2">
                <CountUp end={42} /> <span className="text-lg font-medium text-[#888888] tracking-normal uppercase">Heures</span>
              </p>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Activity className="w-3 h-3" /> Top 5% des étudiants
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* =========================================================================
            SECTION CENTRALE (Graphiques Vectoriels Avancés)
            ========================================================================= */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* GRAPHIQUE 1 : La Courbe d'Apprentissage */}
          <motion.div variants={cardVariants} className="lg:col-span-2 bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] p-8 md:p-10 flex flex-col shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-xl font-serif font-bold text-foreground mb-1">Courbe d'Apprentissage</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Évolution de la rétention</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 hover:bg-muted text-[10px] font-bold uppercase tracking-widest transition-colors border border-border">
                Détails <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            
            <div className="flex-1 min-h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888888', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888888', fontWeight: 600 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '1rem', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                    itemStyle={{ color: '#111', fontWeight: 'bold' }}
                    cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* GRAPHIQUE 2 : Le Radar (Audit Spécialité) */}
          <motion.div variants={cardVariants} className="lg:col-span-1 bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] p-8 md:p-10 flex flex-col shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            {/* Indicateur de faiblesse injecté magnifiquement */}
            <div className="absolute top-8 right-8 z-10">
              <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm">
                <AlertTriangle className="w-3 h-3 animate-pulse" /> Faiblesse : Neurologie
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-xl font-serif font-bold text-foreground mb-1">Audit par Spécialité</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Analyse Radar Spatiale</p>
            </div>

            <div className="flex-1 w-full flex items-center justify-center relative min-h-[250px]">
              {/* Effet de lueur derrière le radar au survol */}
              <div className="absolute inset-0 bg-primary/5 rounded-full blur-[50px] scale-50 group-hover:scale-100 transition-transform duration-700 pointer-events-none" />
              
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#888888', fontSize: 9, fontWeight: 700 }} />
                  <Radar name="Compétence" dataKey="A" stroke="hsl(var(--primary))" strokeWidth={2} fill="hsl(var(--primary))" fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </motion.div>

        {/* =========================================================================
            LA HEATMAP D'ACTIVITÉ (Style GitHub Organique)
            ========================================================================= */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] p-8 md:p-10 shadow-sm flex flex-col xl:flex-row gap-8 items-center hover:shadow-md transition-shadow">
          <div className="xl:w-1/4 space-y-4 text-center xl:text-left">
            <h3 className="text-xl font-serif font-bold text-foreground mb-1">Constance</h3>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
              La médecine est un marathon. Votre régularité est votre meilleure arme pour l'excellence clinique. L'algorithme SM-2 récompense le travail journalier.
            </p>
            <div className="flex items-center justify-center xl:justify-start gap-2 pt-4">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Moins</span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map(level => (
                  <div key={level} className={`w-3 h-3 rounded-sm ${getHeatmapColor(level)}`} />
                ))}
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Plus</span>
            </div>
          </div>
          
          <div className="xl:w-3/4 w-full overflow-x-auto hide-scrollbar flex justify-center xl:justify-end">
            <div className="grid grid-rows-7 grid-flow-col gap-1.5 p-2">
              {heatmapData.map((day) => (
                <div 
                  key={day.id} 
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[3px] transition-all duration-300 hover:scale-125 cursor-pointer ${getHeatmapColor(day.level)}`}
                  title={`${day.level * 15} cartes révisées ce jour-là`}
                />
              ))}
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default Statistics;
