import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, Crown, Brain, MessageSquare, Trophy, CheckCircle2, Minus } from "lucide-react";
import LandingHeader from "@/components/landing/LandingHeader";

import { PRICING_TIERS } from "@/config/pricing";

const tiers = PRICING_TIERS.map(tier => ({
  ...tier,
  price: tier.monthlyPrice.toLocaleString('fr-FR'),
  icon: tier.id === "freemium" ? Sparkles : tier.id === "premium" ? Zap : Crown,
  tagline: tier.description,
  color: tier.id === "premium" 
    ? "bg-primary text-white shadow-[0_0_40px_rgba(30,200,120,0.3)]" 
    : tier.id === "pro" 
      ? "bg-[#111] text-white" 
      : "bg-black/5"
}));

const featureComparison = [
  {
    category: "Apprentissage Actif",
    icon: Brain,
    items: [
      { name: "Génération de QCM par IA", discovery: "5 / jour", premium: "Illimité", excellence: "Illimité" },
      { name: "Génération de Résumés", discovery: "1 / jour", premium: "Illimité", excellence: "Illimité" },
      { name: "Flashcards (Spaced Repetition)", discovery: false, premium: true, excellence: true },
      { name: "Cas Cliniques Complexes", discovery: false, premium: false, excellence: true },
    ]
  },
  {
    category: "Entraînement & Évaluation",
    icon: Trophy,
    items: [
      { name: "Mode Examen", discovery: false, premium: true, excellence: true },
      { name: "Mode Duel Multijoueur", discovery: false, premium: true, excellence: true },
      { name: "Statistiques d'évolution", discovery: "Basiques", premium: "Détaillées", excellence: "Prédictives" },
    ]
  },
  {
    category: "Accompagnement",
    icon: MessageSquare,
    items: [
      { name: "Assistant MOR (Explications IA)", discovery: false, premium: "Standard", excellence: "Prioritaire" },
      { name: "Support Client", discovery: "Standard", premium: "Rapide", excellence: "Prioritaire 7j/7" },
    ]
  }
];

const FadeIn = ({ children, delay = 0, className = "" }: any) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay }} className={className}>
    {children}
  </motion.div>
);

const WatermarkPattern = () => (
  <div className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none overflow-hidden flex flex-wrap justify-center items-center gap-20 p-10">
    {Array.from({ length: 40 }).map((_, i) => (
      <Brain key={i} className="w-24 h-24 text-[#111]" />
    ))}
  </div>
);

const Pricing = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans-serif selection:bg-primary selection:text-white pb-24 relative overflow-hidden">
      <WatermarkPattern />
      
      {/* Use the shared LandingHeader for consistent navigation */}
      <LandingHeader forceSolid />
      <main className="pt-28 max-w-6xl mx-auto px-6">
        <FadeIn className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-5xl md:text-7xl font-serif leading-[1.05] tracking-tight mb-6">
            Investissez dans votre <span className="italic text-primary">réussite</span>.
          </h1>
          <p className="text-lg md:text-xl text-black/60 font-light mb-10">
            Des forfaits transparents conçus pour s'adapter à votre rythme d'apprentissage. Sans engagement.
          </p>
          
          <div className="inline-flex bg-black/5 p-1.5 rounded-full relative">
            <div className={`absolute inset-y-1.5 w-[calc(50%-6px)] bg-white rounded-full shadow-sm transition-all duration-300 ${annual ? 'left-1.5' : 'left-[calc(50%+4px)]'}`} />
            <button onClick={() => setAnnual(true)} className={`relative z-10 px-6 py-2 rounded-full text-sm font-semibold transition-colors ${annual ? 'text-black' : 'text-black/50 hover:text-black'}`}>
              Annuel (-20%)
            </button>
            <button onClick={() => setAnnual(false)} className={`relative z-10 px-6 py-2 rounded-full text-sm font-semibold transition-colors ${!annual ? 'text-black' : 'text-black/50 hover:text-black'}`}>
              Mensuel
            </button>
          </div>
        </FadeIn>

        {/* PRICING CARDS */}
        <div className="grid md:grid-cols-3 gap-6 mb-32">
          {tiers.map((tier, index) => {
            const Icon = tier.icon;
            const displayPrice = annual && tier.monthlyPrice > 0 ? tier.yearlyPrice : tier.monthlyPrice;
            const price = displayPrice.toLocaleString('fr-FR');
            
            return (
              <FadeIn key={tier.name} delay={index * 0.1} className={`rounded-[2rem] p-8 border border-black/5 relative flex flex-col transition-transform hover:-translate-y-2 ${tier.color}`}>
                {tier.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#111] text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                    Le plus choisi
                  </div>
                )}
                
                <div className="mb-8">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${tier.highlight ? 'bg-white/20' : tier.name === "Excellence" ? 'bg-white/10' : 'bg-card shadow-sm'}`}>
                    <Icon className={`w-6 h-6 ${tier.highlight ? 'text-white' : tier.name === "Excellence" ? 'text-primary' : 'text-[#111]'}`} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                  <p className={`text-sm ${tier.highlight || tier.name === "Excellence" ? 'text-white/70' : 'text-black/60'}`}>{tier.tagline}</p>
                </div>

                <div className="mb-8">
                  <span className="text-5xl font-black">{price}</span>
                  <span className={`text-sm font-medium ${tier.highlight || tier.name === "Excellence" ? 'text-white/70' : 'text-black/60'}`}>
                    {annual && tier.id !== "freemium" ? " FCFA / an" : " FCFA / mois"}
                  </span>
                  {annual && tier.id !== "freemium" && <p className={`text-xs mt-2 ${tier.highlight ? 'text-white/90 font-medium' : 'text-primary font-medium'}`}>-20% inclus !</p>}
                </div>

                <ul className="space-y-4 mb-10 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${tier.highlight ? 'text-white' : 'text-primary'}`} />
                      <span className={tier.highlight || tier.name === "Excellence" ? 'text-white/90' : 'text-black/80'}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild className={`w-full rounded-full h-14 text-base font-semibold border-0 ${
                  tier.highlight 
                    ? 'bg-card text-primary hover:bg-card/90 shadow-lg' 
                    : tier.name === "Excellence"
                      ? 'bg-primary text-white hover:bg-primary-hover shadow-lg'
                      : 'bg-[#111] text-white hover:bg-black shadow-lg'
                }`}>
                  <Link to="/auth">{tier.cta}</Link>
                </Button>
              </FadeIn>
            );
          })}
        </div>

        {/* DETAILED COMPARISON */}
        <FadeIn delay={0.4}>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-serif mb-6">Comparez en détail</h2>
            <p className="text-black/60">Toutes les fonctionnalités dont vous avez besoin pour exceller.</p>
          </div>

          <div className="bg-card rounded-[2rem] p-6 md:p-12 shadow-xl border border-black/5 overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="border-b border-black/10">
                  <th className="pb-6 font-semibold w-2/5">Fonctionnalité</th>
                  <th className="pb-6 font-semibold text-center w-1/5 text-black/60">Découverte</th>
                  <th className="pb-6 font-bold text-center w-1/5 text-primary">Premium</th>
                  <th className="pb-6 font-semibold text-center w-1/5">Excellence</th>
                </tr>
              </thead>
              <tbody>
                {featureComparison.map((category, idx) => (
                  <React.Fragment key={category.category}>
                    <tr>
                      <td colSpan={4} className="py-6">
                        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-black/40">
                          <category.icon className="w-4 h-4" /> {category.category}
                        </div>
                      </td>
                    </tr>
                    {category.items.map((item, itemIdx) => (
                      <tr key={item.name} className={itemIdx !== category.items.length - 1 ? "border-b border-black/5" : ""}>
                        <td className="py-4 text-sm font-medium">{item.name}</td>
                        <td className="py-4 text-center">
                          {typeof item.discovery === 'boolean' ? (
                            item.discovery ? <Check className="w-5 h-5 mx-auto text-black/40" /> : <Minus className="w-5 h-5 mx-auto text-black/20" />
                          ) : (
                            <span className="text-sm text-black/60">{item.discovery}</span>
                          )}
                        </td>
                        <td className="py-4 text-center bg-primary/5">
                          {typeof item.premium === 'boolean' ? (
                            item.premium ? <Check className="w-5 h-5 mx-auto text-primary" /> : <Minus className="w-5 h-5 mx-auto text-black/20" />
                          ) : (
                            <span className="text-sm font-semibold text-primary">{item.premium}</span>
                          )}
                        </td>
                        <td className="py-4 text-center">
                          {typeof item.excellence === 'boolean' ? (
                            item.excellence ? <Check className="w-5 h-5 mx-auto text-[#111]" /> : <Minus className="w-5 h-5 mx-auto text-black/20" />
                          ) : (
                            <span className="text-sm font-semibold">{item.excellence}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>

        <div className="mt-20 text-center text-sm text-black/50">
          <p>Besoin d'une offre pour votre université ou association étudiante ? <Link to="/contact" className="underline hover:text-black">Contactez-nous</Link>.</p>
        </div>
      </main>
    </div>
  );
};

export default Pricing;
