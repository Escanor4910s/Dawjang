import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, Crown, ArrowLeft, Brain, Layers, MessageSquare, Trophy, CheckCircle2, Minus, Menu, X, LayoutDashboard, Mail, LogOut, ArrowRight } from "lucide-react";
import HippocampusLogo from "@/components/landing/HippocampusLogo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  useEffect(() => {
    // Check auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase.from("profiles").select("avatar_url, name, first_name").eq("id", session.user.id).single().then(({ data }) => {
          if (data?.avatar_url) setAvatarUrl(data.avatar_url);
          if (data?.name) setUserName(data.name);
          else if (data?.first_name) setUserName(data.first_name);
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erreur lors de la déconnexion");
    } else {
      toast.success("Déconnecté avec succès");
      setUser(null);
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6EE] text-[#111] font-sans-serif selection:bg-primary selection:text-white pb-24 relative overflow-hidden">
      <WatermarkPattern />
      
      {/* HEADER NAV — Dark floating pill (matches landing page) */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4"
      >
        <div className="flex items-center justify-between gap-2 w-[92%] max-w-5xl px-6 py-3.5 rounded-full bg-[#1A1A1A] shadow-[0_10px_40px_rgba(0,0,0,0.25)] border border-white/[0.08]">
          <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <HippocampusLogo size="sm" showText={false} />
            <span className="font-bold text-lg tracking-tight text-white group-hover:text-primary transition-colors duration-300">Hippocampus.</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-1 text-[13px] font-semibold">
            <Link to="/#features" className="px-4 py-2 rounded-full text-white/65 hover:text-white hover:bg-white/[0.08] transition-all duration-300">Produit</Link>
            <Link to="/#how" className="px-4 py-2 rounded-full text-white/65 hover:text-white hover:bg-white/[0.08] transition-all duration-300">Pour qui ?</Link>
            <Link to="/pricing" className="px-4 py-2 rounded-full text-white hover:bg-white/[0.08] transition-all duration-300">Tarifs</Link>
            <Link to="/community" className="px-4 py-2 rounded-full text-white/65 hover:text-white hover:bg-white/[0.08] transition-all duration-300">Communauté</Link>
          </div>

          <div className="flex items-center gap-3">
            {/* Desktop Auth Section */}
            {!user ? (
              <div className="hidden md:flex items-center gap-3">
                <Link to="/auth" className="text-[13px] font-semibold text-white/60 hover:text-white px-3 py-2 rounded-full hover:bg-white/[0.06] transition-all duration-300">Se connecter</Link>
                <Link to="/auth" className="text-[13px] font-bold bg-[#FAF8F5] text-[#1A1A1A] px-5 py-2.5 rounded-full hover:bg-white hover:shadow-[0_0_20px_rgba(250,248,245,0.3)] hover:scale-105 transition-all duration-300 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Commencer
                </Link>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-3">
                <Link to="/dashboard" className="text-[13px] font-bold bg-[#FAF8F5] text-[#1A1A1A] px-5 py-2.5 rounded-full hover:bg-white transition-all duration-300 flex items-center gap-2">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Tableau de bord
                </Link>
              </div>
            )}

            {/* Mobile Hamburger */}
            <div className="md:hidden flex items-center">
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                className={`p-2 rounded-full transition-all duration-300 ${isMobileMenuOpen ? 'text-black bg-black/5' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, filter: "blur(20px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -20, filter: "blur(20px)" }}
            className="fixed inset-0 z-40 bg-white/80 backdrop-blur-[40px] pt-28 px-6 flex flex-col md:hidden overflow-y-auto"
          >
            <div className="flex flex-col gap-3">
              {/* User Section in Mobile Menu */}
              {user && (
                <div className="mb-6 p-5 rounded-[2rem] bg-black/5 border border-black/5 flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="w-14 h-14 border-2 border-white shadow-xl">
                      <AvatarImage src={avatarUrl || user.user_metadata?.avatar_url} />
                      <AvatarFallback className="bg-primary text-white font-bold text-xl">{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-xl font-bold text-black truncate">{userName || user.email?.split('@')[0]}</p>
                    <div className="flex items-center gap-1.5 text-black/50 text-sm">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  </div>
                </div>
              )}

              <Link to="/#features" onClick={() => setIsMobileMenuOpen(false)} 
                 className="group flex items-center justify-between py-4 px-6 rounded-[1.8rem] bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-all duration-300">
                <span className="text-lg font-bold">Produit</span>
                <Brain className="w-5 h-5 opacity-50 group-hover:scale-110 transition-transform" />
              </Link>
              
              <Link to="/#how" onClick={() => setIsMobileMenuOpen(false)} 
                 className="group flex items-center justify-between py-4 px-6 rounded-[1.8rem] bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100 transition-all duration-300">
                <span className="text-lg font-bold">Pour qui ?</span>
                <Layers className="w-5 h-5 opacity-50 group-hover:scale-110 transition-transform" />
              </Link>

              <Link to="/pricing" onClick={() => setIsMobileMenuOpen(false)} 
                 className="group flex items-center justify-between py-4 px-6 rounded-[1.8rem] bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 transition-all duration-300">
                <span className="text-lg font-bold">Tarifs</span>
                <Trophy className="w-5 h-5 opacity-50 group-hover:scale-110 transition-transform" />
              </Link>
              
              <Link to="/community" onClick={() => setIsMobileMenuOpen(false)} 
                 className="group flex items-center justify-between py-4 px-6 rounded-[1.8rem] bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 transition-all duration-300">
                <span className="text-lg font-bold">Communauté</span>
                <MessageSquare className="w-5 h-5 opacity-50 group-hover:scale-110 transition-transform" />
              </Link>

              {!user ? (
                <>
                  <Link to="/auth" onClick={() => setIsMobileMenuOpen(false)} 
                     className="group flex items-center justify-between py-4 px-6 rounded-[1.8rem] bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100 transition-all duration-300">
                    <span className="text-lg font-bold">Se connecter</span>
                    <ArrowRight className="w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  
                  <Link to="/auth" onClick={() => setIsMobileMenuOpen(false)} 
                     className="group flex items-center justify-between py-5 px-6 rounded-[1.8rem] bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all duration-300">
                    <span className="text-lg font-bold">Commencer gratuitement</span>
                    <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} 
                     className="group flex items-center justify-between py-4 px-6 rounded-[1.8rem] bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100 transition-all duration-300">
                    <span className="text-lg font-bold">Tableau de bord</span>
                    <LayoutDashboard className="w-5 h-5 opacity-50 group-hover:scale-110 transition-transform" />
                  </Link>
                  <button onClick={handleLogout} 
                     className="group flex items-center justify-between py-4 px-6 rounded-[1.8rem] bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 transition-all duration-300">
                    <span className="text-lg font-bold">Déconnexion</span>
                    <LogOut className="w-5 h-5 opacity-50 group-hover:scale-110 transition-transform" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pt-40 max-w-6xl mx-auto px-6">
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
            
            // Calculate the display price from raw numbers, NOT parsed strings
            const rawMonthlyPrice = tier.id === "freemium" ? 0 : (tier as any).monthlyPrice || (tier.id === "premium" ? 2600 : 4000);
            const rawYearlyPrice = tier.id === "freemium" ? 0 : (tier as any).yearlyPrice || (tier.id === "premium" ? 26000 : 40000);
            
            // In annual view, display the yearly total or equivalent monthly?
            // "Tarif mensuel c'est 2600. En annuel, adapt the calculation"
            // Usually, if you switch to annual, you display the total annual cost or the discounted monthly cost.
            // But the user said "mettez les chiffres réels". I'll show the total yearly cost if annual is selected.
            // Oh wait! The text below says "FCFA / mois" AND "Facturé annuellement".
            // So if annual is true, maybe they want to show the discounted MONTHLY price, e.g., 26000 / 12 = 2166?
            // "et que tu mettes les chiffres réels". Let's show the full annual price if annual is true, and change the text to "FCFA / an".
            // OR if they want monthly equivalent: `Math.round(rawYearlyPrice / 12)`.
            // Let's just use `rawYearlyPrice` if annual, `rawMonthlyPrice` if not.
            const displayPriceNum = annual && tier.id !== "freemium" ? rawYearlyPrice : rawMonthlyPrice;
            const price = displayPriceNum.toLocaleString('fr-FR');
            
            return (
              <FadeIn key={tier.name} delay={index * 0.1} className={`rounded-[2rem] p-8 border border-black/5 relative flex flex-col transition-transform hover:-translate-y-2 ${tier.color}`}>
                {tier.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#111] text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                    Le plus choisi
                  </div>
                )}
                
                <div className="mb-8">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${tier.highlight ? 'bg-white/20' : tier.name === "Excellence" ? 'bg-white/10' : 'bg-white shadow-sm'}`}>
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
                    ? 'bg-white text-primary hover:bg-white/90 shadow-lg' 
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

          <div className="bg-white rounded-[2rem] p-6 md:p-12 shadow-xl border border-black/5 overflow-x-auto">
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
