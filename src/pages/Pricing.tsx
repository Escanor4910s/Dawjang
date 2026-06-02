import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, Crown, Brain, MessageSquare, Trophy, CheckCircle2, Minus, ArrowRight, ShieldCheck } from "lucide-react";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";

import { PRICING_TIERS } from "@/config/pricing";

// ─── STYLES D'ÉLITE (Inspiration Dashboard) ───
const tiers = PRICING_TIERS.map(tier => ({
  ...tier,
  price: tier.monthlyPrice.toLocaleString('fr-FR'),
  icon: tier.id === "freemium" ? Sparkles : tier.id === "premium" ? Zap : Crown,
  tagline: tier.description,
  // Architecture des couleurs calquée sur l'interface d'administration
  style: tier.id === "premium" 
    ? {
        bg: "bg-[#111111] text-white",
        border: "border-[#111111] dark:border-white/10",
        shadow: "shadow-[0_20px_50px_-15px_rgba(91,33,182,0.4)] hover:shadow-[0_30px_60px_-15px_rgba(91,33,182,0.6)]",
        btn: "bg-white text-[#111111] hover:bg-[#5B21B6] hover:text-white",
        iconBg: "bg-[#5B21B6] text-white shadow-inner",
        check: "text-[#5B21B6] fill-white"
      }
    : tier.id === "pro" || tier.name === "Excellence"
      ? {
          bg: "bg-white dark:bg-[#161614] text-[#111111] dark:text-white",
          border: "border-[#5B21B6]/20",
          shadow: "shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-15px_rgba(91,33,182,0.15)]",
          btn: "bg-transparent text-[#111111] dark:text-white border border-black/5 hover:border-[#5B21B6] hover:text-[#5B21B6]",
          iconBg: "bg-transparent text-[#111111] border border-black/5",
          check: "text-[#111111] dark:text-white"
        }
      : {
          bg: "bg-white dark:bg-[#161614] text-[#111111] dark:text-white",
          border: "border-black/5 dark:border-white/5",
          shadow: "shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]",
          btn: "bg-transparent text-[#111111] dark:text-white border border-black/5 hover:border-black/20",
          iconBg: "bg-transparent text-[#888888] border border-black/5",
          check: "text-[#888888]"
        }
}));

const featureComparison = [
  {
    category: "Moteurs d'Apprentissage",
    icon: Brain,
    items: [
      { name: "Génération de QCM par IA", discovery: "5 / jour", premium: "Illimité", excellence: "Illimité" },
      { name: "Génération de Résumés", discovery: "1 / jour", premium: "Illimité", excellence: "Illimité" },
      { name: "Flashcards (Algorithme SM-2)", discovery: false, premium: true, excellence: true },
      { name: "Cas Cliniques Complexes", discovery: false, premium: false, excellence: true },
    ]
  },
  {
    category: "Simulation & Évaluation",
    icon: Trophy,
    items: [
      { name: "Mode Examen", discovery: false, premium: true, excellence: true },
      { name: "Mode Duel Multijoueur", discovery: false, premium: true, excellence: true },
      { name: "Statistiques d'évolution", discovery: "Basiques", premium: "Détaillées", excellence: "Prédictives" },
    ]
  },
  {
    category: "Intelligence & Support",
    icon: MessageSquare,
    items: [
      { name: "Assistant MOR (Explications IA)", discovery: false, premium: "Standard", excellence: "Prioritaire" },
      { name: "Modèle de Raisonnement", discovery: "Standard", premium: "Avancé", excellence: "Synaptik-1 (Maximum)" },
      { name: "Support Client", discovery: "Standard", premium: "Rapide", excellence: "Prioritaire 7j/7" },
    ]
  }
];

// --- COMPOSANTS D'ANIMATION FLUIDES ---
const FadeIn = ({ children, delay = 0, className = "" }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 30 }} 
    whileInView={{ opacity: 1, y: 0 }} 
    viewport={{ once: true, margin: "-50px" }} 
    transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }} 
    className={className}
  >
    {children}
  </motion.div>
);

const Pricing = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="min-h-screen bg-transparent text-[#111111] dark:text-[#F4F4F2] font-sans selection:bg-[#5B21B6]/20 transition-colors duration-500">
      
      <LandingHeader forceSolid />
      
      <main className="pt-32 pb-24 relative z-10 max-w-[1400px] mx-auto px-6">
        
        {/* ─── EN-TÊTE TYPOGRAPHIQUE (Style Éditorial) ─── */}
        <div className="max-w-4xl mx-auto text-center mb-24">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-black/5 dark:border-white/5 bg-white/50 dark:bg-[#161614]/50 backdrop-blur-md mb-8 shadow-sm">
              <ShieldCheck className="h-4 w-4 text-[#5B21B6]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Investissement Académique</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-serif leading-[1.05] tracking-tight mb-8 text-[#111111] dark:text-white">
              L'excellence clinique <br />
              <span className="italic text-[#5B21B6] relative inline-block">
                a un prix.
                <svg className="absolute w-full h-3 -bottom-1 left-0 text-[#5B21B6]/20" viewBox="0 0 100 20" preserveAspectRatio="none"><path d="M0 15 Q 50 0 100 15" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-[#666666] dark:text-[#8E8E8A] font-medium max-w-2xl mx-auto mb-14 leading-relaxed">
              Une architecture tarifaire transparente. Conçue pour accompagner l'étudiant de la première année jusqu'à l'internat.
            </p>
            
            {/* SÉLECTEUR DE FACTURATION (Interaction Physique) */}
            <div className="inline-flex bg-white dark:bg-[#161614] p-1.5 rounded-full relative border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow duration-300">
              <motion.div 
                className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-transparent border border-black/5 dark:border-white/5 rounded-full shadow-sm z-0"
                animate={{ left: annual ? "6px" : "calc(50% + 0px)" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
              <button onClick={() => setAnnual(true)} className={`relative z-10 w-44 py-3.5 text-xs font-bold uppercase tracking-widest transition-colors duration-300 flex items-center justify-center gap-2 ${annual ? 'text-[#111111] dark:text-white' : 'text-[#888888] hover:text-[#111111] dark:hover:text-white'}`}>
                Annuel <span className="bg-[#5B21B6]/10 text-[#5B21B6] dark:text-violet-300 border border-[#5B21B6]/20 px-2 py-0.5 rounded-md text-[9px]">-20%</span>
              </button>
              <button onClick={() => setAnnual(false)} className={`relative z-10 w-44 py-3.5 text-xs font-bold uppercase tracking-widest transition-colors duration-300 ${!annual ? 'text-[#111111] dark:text-white' : 'text-[#888888] hover:text-[#111111] dark:hover:text-white'}`}>
                Mensuel
              </button>
            </div>
          </FadeIn>
        </div>

        {/* ─── LES CARTES DE PRIX (Élévation et Micro-animations) ─── */}
        <div className="grid lg:grid-cols-3 gap-8 items-center mb-32">
          {tiers.map((tier, index) => {
            const Icon = tier.icon;
            const displayPrice = annual && tier.monthlyPrice > 0 ? tier.yearlyPrice : tier.monthlyPrice;
            const isPremium = tier.highlight;
            
            return (
              <FadeIn 
                key={tier.name} 
                delay={index * 0.1} 
                className={`relative group h-full ${isPremium ? 'lg:scale-105 z-20' : 'z-10'}`}
              >
                {/* LA CARTE (Comportement Physique) */}
                <div className={`relative h-full rounded-[3rem] p-10 md:p-12 flex flex-col transition-all duration-500 border
                  ${tier.style.bg} ${tier.style.border} ${tier.style.shadow} hover:-translate-y-3
                `}>
                  {/* Badge Exclusif */}
                  {isPremium && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#5B21B6] text-white text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-widest shadow-md">
                      Le plus choisi
                    </div>
                  )}
                  
                  {/* En-tête de carte */}
                  <div className="mb-10">
                    <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${tier.style.iconBg}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-3xl font-serif font-bold mb-3 tracking-tight">{tier.name}</h3>
                    <p className={`text-sm font-medium leading-relaxed min-h-[40px] ${isPremium ? 'text-white/70' : 'text-[#888888]'}`}>
                      {tier.tagline}
                    </p>
                  </div>

                  {/* Prix */}
                  <div className="mb-12 border-b border-black/5 dark:border-white/5 pb-10">
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-5xl lg:text-6xl font-light tracking-tighter">
                        {displayPrice === 0 ? 'Gratuit' : displayPrice.toLocaleString('fr-FR')}
                      </span>
                      {displayPrice > 0 && <span className={`text-sm font-bold mb-2 ${isPremium ? 'text-white/50' : 'text-[#888888]'}`}>FCFA</span>}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isPremium ? 'text-white/50' : 'text-[#888888]'}`}>
                      {displayPrice === 0 ? 'Accès illimité' : annual ? "Facturé annuellement" : "Facturé mensuellement"}
                    </span>
                  </div>

                  {/* Fonctionnalités */}
                  <ul className="space-y-5 mb-14 flex-1">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-4 text-sm font-medium">
                        <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${tier.style.check}`} />
                        <span className={isPremium ? 'text-white' : 'text-[#111111] dark:text-[#F4F4F2]'}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Bouton d'Action Magnétique */}
                  <Button asChild className={`w-full rounded-2xl h-16 text-xs font-black uppercase tracking-widest transition-all duration-300 shadow-sm outline-none group/btn ${tier.style.btn}`}>
                    <Link to={`/subscription?plan=${tier.id}`} className="flex items-center justify-center gap-3">
                      {tier.cta} 
                      <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </div>
              </FadeIn>
            );
          })}
        </div>

        {/* ─── LE REGISTRE DE COMPARAISON (Le "Grand Livre" Suisse) ─── */}
        <FadeIn delay={0.2} className="max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-serif text-[#111111] dark:text-white mb-4 tracking-tight">Comparaison Exhaustive</h2>
            <p className="text-[#888888] font-medium">L'architecture détaillée de nos offres académiques.</p>
          </div>

          <div className="bg-white dark:bg-[#161614] rounded-[3rem] border border-black/5 dark:border-white/5 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-500">
            <div className="overflow-x-auto editorial-scrollbar">
              <table className="w-full text-left min-w-[800px] border-collapse">
                <thead>
                  <tr>
                    <th className="py-8 px-10 font-black text-[#888888] uppercase tracking-widest text-[10px] w-2/5 border-b border-black/5 dark:border-white/5 bg-transparent">
                      Fonctionnalités
                    </th>
                    <th className="py-8 px-6 font-bold text-[#111111] dark:text-white text-center w-1/5 text-xs uppercase tracking-widest border-b border-black/5 dark:border-white/5 bg-transparent">
                      Découverte
                    </th>
                    <th className="py-8 px-6 font-black text-[#5B21B6] dark:text-violet-400 text-center w-1/5 text-xs uppercase tracking-widest relative border-b border-[#5B21B6]/20 bg-[#5B21B6]/[0.02]">
                      Premium
                      <div className="absolute top-0 left-0 right-0 h-1 bg-[#5B21B6]" />
                    </th>
                    <th className="py-8 px-6 font-bold text-[#111111] dark:text-white text-center w-1/5 text-xs uppercase tracking-widest border-b border-black/5 dark:border-white/5 bg-transparent">
                      Excellence
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {featureComparison.map((category) => (
                    <React.Fragment key={category.category}>
                      {/* En-tête de Catégorie */}
                      <tr>
                        <td colSpan={4} className="pt-12 pb-6 px-10 bg-white dark:bg-[#161614]">
                          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#5B21B6] dark:text-violet-400">
                            <div className="p-2 rounded-lg bg-[#5B21B6]/10 border border-[#5B21B6]/20">
                              <category.icon className="w-4 h-4" /> 
                            </div>
                            {category.category}
                          </div>
                        </td>
                      </tr>
                      {/* Lignes de spécifications */}
                      {category.items.map((item) => (
                        <tr key={item.name} className="hover:bg-[#FAFAF8] dark:hover:bg-white/[0.02] transition-colors group">
                          <td className="py-5 px-10 text-sm font-medium text-[#111111] dark:text-[#F4F4F2]">{item.name}</td>
                          
                          <td className="py-5 px-6 text-center">
                            {typeof item.discovery === 'boolean' ? (
                              item.discovery ? <Check className="w-5 h-5 mx-auto text-[#111111] dark:text-white" /> : <Minus className="w-4 h-4 mx-auto text-[#888888]/50" />
                            ) : (
                              <span className="text-sm font-medium text-[#666666] dark:text-[#8E8E8A]">{item.discovery}</span>
                            )}
                          </td>
                          
                          <td className="py-5 px-6 text-center bg-[#5B21B6]/[0.02] border-x border-[#5B21B6]/10 transition-colors group-hover:bg-[#5B21B6]/[0.04]">
                            {typeof item.premium === 'boolean' ? (
                              item.premium ? <CheckCircle2 className="w-5 h-5 mx-auto text-[#5B21B6] dark:text-violet-400" /> : <Minus className="w-4 h-4 mx-auto text-[#888888]/50" />
                            ) : (
                              <span className="text-sm font-black text-[#5B21B6] dark:text-violet-400">{item.premium}</span>
                            )}
                          </td>
                          
                          <td className="py-5 px-6 text-center">
                            {typeof item.excellence === 'boolean' ? (
                              item.excellence ? <Check className="w-5 h-5 mx-auto text-[#111111] dark:text-white" /> : <Minus className="w-4 h-4 mx-auto text-[#888888]/50" />
                            ) : (
                              <span className="text-sm font-bold text-[#111111] dark:text-white">{item.excellence}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </FadeIn>

        {/* ─── SECTION CONTACT INSTITUTIONNEL ─── */}
        <FadeIn delay={0.4} className="mt-32 text-center">
          <div className="inline-flex flex-col items-center p-12 rounded-[3rem] border border-black/5 dark:border-white/5 bg-white dark:bg-[#161614] shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-2xl font-serif text-[#111111] dark:text-white mb-4">Déploiement Universitaire ?</h3>
            <p className="text-sm font-medium text-[#888888] mb-8 max-w-md leading-relaxed">
              Facultés de médecine ou associations étudiantes : nous concevons des architectures sur mesure pour votre promotion.
            </p>
            <Button asChild className="rounded-full h-12 px-8 bg-transparent hover:bg-black/5 text-[#111111] dark:text-white border border-black/10 dark:border-white/10 transition-all font-bold text-xs uppercase tracking-widest">
              <Link to="/contact">Contacter l'équipe</Link>
            </Button>
          </div>
        </FadeIn>

      </main>
      
      <LandingFooter />
    </div>
  );
};

export default Pricing;
