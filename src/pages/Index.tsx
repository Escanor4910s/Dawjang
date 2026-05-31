import { useEffect, useState, useRef, ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, Trophy, MessageSquare, Shield, Menu, X, ArrowRight, Zap, BookOpen, Target, Activity, Stethoscope, LayoutDashboard, LogOut, Mail, Circle, Fingerprint, Layers, Cpu, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- ADVANCED REUSABLE ANIMATION COMPONENTS ---

const FadeIn = ({ children, delay = 0, className = "", yOffset = 30, scale = 1, duration = 0.8 }: any) => (
  <motion.div
    initial={{ opacity: 0, y: yOffset, scale: scale }}
    whileInView={{ opacity: 1, y: 0, scale: 1 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

const FloatingElement = ({ children, delay = 0, yOffset = 15, duration = 5, className = "" }: any) => (
  <motion.div
    initial={{ y: 0 }}
    animate={{ y: [-yOffset, yOffset, -yOffset] }}
    transition={{ repeat: Infinity, duration, ease: "easeInOut", delay }}
    className={`absolute ${className}`}
  >
    {children}
  </motion.div>
);

// Composant Magique 1 : Carte avec effet d'inclinaison 3D au survol de la souris
const TiltCard = ({ children, className = "" }: { children: ReactNode, className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Springs pour lisser le mouvement
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), { damping: 30, stiffness: 200 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-5, 5]), { damping: 30, stiffness: 200 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Calcule la position de la souris de -0.5 à 0.5
    const mouseX = (e.clientX - rect.left) / width - 0.5;
    const mouseY = (e.clientY - rect.top) / height - 0.5;
    
    x.set(mouseX);
    y.set(mouseY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      style={{ rotateX, rotateY, perspective: 1000 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Composant Magique 2 : Spotlight Effect (La lueur suit la souris)
const SpotlightCard = ({ children, className = "", spotlightColor = "rgba(167, 243, 208, 0.15)" }: { children: ReactNode, className?: string, spotlightColor?: string }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current || isFocused) return;
    const div = divRef.current;
    const rect = div.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setIsFocused(true);
    setOpacity(1);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setOpacity(0);
  };

  const handleMouseEnter = () => setOpacity(1);
  const handleMouseLeave = () => setOpacity(0);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-0"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

const DrawnUnderline = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 20" className={`overflow-visible absolute w-full left-0 bottom-[-2px] ${className}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <motion.path
      initial={{ pathLength: 0, opacity: 0 }}
      whileInView={{ pathLength: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      d="M5,15 Q50,5 100,10 T195,15"
    />
  </svg>
);

const Index = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  
  const { scrollY } = useScroll();
  const yHeroText = useTransform(scrollY, [0, 1000], [0, 100]);
  const yFloating1 = useTransform(scrollY, [0, 1000], [0, -120]);
  const yFloating2 = useTransform(scrollY, [0, 1000], [0, -180]);

  useEffect(() => {
    document.title = "Hippocampus - L'excellence académique";
    
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => { window.removeEventListener("scroll", handleScroll); subscription.unsubscribe(); };
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Erreur lors de la déconnexion");
    else { toast.success("Déconnecté avec succès"); setUser(null); }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1A1A1A] selection:bg-[#0F3B2E]/20 font-sans overflow-x-hidden">
      
      {/* HEADER — Glassmorphism Ultra Premium */}
      <motion.nav
        initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-700 ease-out ${scrolled ? 'pt-4' : 'pt-6'}`}
      >
        <div className={`flex items-center justify-between gap-4 transition-all duration-700 ease-out ${scrolled ? 'w-[92%] max-w-5xl px-6 py-3 bg-[#1A1A1A]/85 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/10 rounded-full' : 'w-[96%] max-w-6xl px-8 py-4 bg-[#1A1A1A] shadow-2xl border border-white/5 rounded-full'}`}>
          
          <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
            <img src="/favicon.png" alt="Hippocampus Logo" className="w-6 h-6 md:w-7 md:h-7 object-contain transition-transform duration-500 group-hover:rotate-12" />
            <span className="font-serif font-bold text-lg md:text-xl tracking-tight text-white transition-opacity duration-300">Hippocampus</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-1.5 text-[13px] font-semibold tracking-wide">
            <a href="#features" className="px-5 py-2.5 rounded-full text-white/50 hover:text-white hover:bg-white/5 transition-all duration-300">Produit</a>
            <a href="#mor" className="px-5 py-2.5 rounded-full text-white/50 hover:text-white hover:bg-white/5 transition-all duration-300">Agent MOR</a>
            <Link to="/pricing" className="px-5 py-2.5 rounded-full text-white/50 hover:text-white hover:bg-white/5 transition-all duration-300">Tarifs</Link>
          </div>
          
          <div className="hidden md:flex items-center gap-4 flex-shrink-0">
            {user ? (
              <div className="flex items-center gap-4">
                <Link to="/dashboard" className="text-sm font-semibold bg-white text-[#1A1A1A] px-5 py-2 rounded-full hover:bg-emerald-50 hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all duration-300 flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
                <button onClick={handleLogout} className="text-white/40 hover:text-red-400 transition-colors p-2">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Link to="/auth" className="text-sm font-medium text-white/50 hover:text-white px-4 py-2 transition-colors duration-300">Connexion</Link>
                <Link to="/auth" className="text-[13px] font-bold bg-white text-[#1A1A1A] px-6 py-2.5 rounded-full hover:scale-105 transition-transform duration-300 shadow-[0_4px_14px_rgba(255,255,255,0.15)]">
                  Démarrer
                </Link>
              </>
            )}
          </div>
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-white/70 hover:text-white transition-colors outline-none">
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-40 bg-[#1A1A1A]/98 backdrop-blur-2xl pt-32 px-8 flex flex-col md:hidden overflow-y-auto"
          >
            <div className="flex flex-col gap-6 text-center">
              <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-serif text-white/80 hover:text-white border-b border-white/10 pb-6 transition-colors">Produit</a>
              <a href="#mor" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-serif text-white/80 hover:text-white border-b border-white/10 pb-6 transition-colors">Agent MOR</a>
              <Link to="/pricing" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-serif text-white/80 hover:text-white border-b border-white/10 pb-6 transition-colors">Tarifs</Link>
              {!user ? (
                <div className="mt-8 flex flex-col gap-4">
                  <Link to="/auth" onClick={() => setIsMobileMenuOpen(false)} className="py-4 px-6 rounded-full bg-white/5 text-white flex justify-center items-center font-medium border border-white/10">Se connecter</Link>
                  <Link to="/auth" onClick={() => setIsMobileMenuOpen(false)} className="py-4 px-6 rounded-full bg-white text-[#1A1A1A] flex justify-center items-center font-semibold">Commencer gratuitement</Link>
                </div>
              ) : (
                <div className="mt-8 flex flex-col gap-4">
                  <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="py-4 px-6 rounded-full bg-white text-[#1A1A1A] flex justify-center items-center font-semibold">Mon Dashboard</Link>
                  <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="py-4 px-6 rounded-full border border-red-500/20 text-red-400 font-medium bg-red-500/5">Déconnexion</button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10">
        
        <div className="relative bg-doodle-watermark overflow-hidden">
          
          <section className="relative pt-48 pb-32 px-6 min-h-[95vh] flex flex-col items-center justify-center text-center">
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.25] mix-blend-overlay pointer-events-none z-10" />
            
            <div className="absolute inset-0 pointer-events-none z-0 opacity-20">
              <svg viewBox="0 0 1400 800" className="w-full h-full text-[#0F3B2E]" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="fadeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
                    <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <motion.path 
                  initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.5 }} transition={{ duration: 6, ease: "easeInOut" }}
                  d="M -200,300 C 200,150 400,600 800,450 C 1200,300 1300,500 1600,200" 
                  fill="none" stroke="url(#fadeGrad)" strokeWidth="0.5" strokeDasharray="6,12"
                />
                <motion.path 
                  initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.3 }} transition={{ duration: 8, ease: "easeInOut", delay: 1 }}
                  d="M 1600,600 C 1100,750 900,250 500,450 C 100,650 0,300 -200,400" 
                  fill="none" stroke="currentColor" strokeWidth="0.5"
                />
              </svg>
            </div>

            <motion.div style={{ y: yHeroText }} className="relative z-20 max-w-5xl mx-auto flex flex-col items-center">
              
              <FadeIn scale={0.95} duration={1}>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-black/5 bg-white/40 backdrop-blur-md mb-10 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[11px] font-bold text-[#1A1A1A]/60 tracking-widest uppercase">Moteur IA v2.0 disponible</span>
                </div>
              </FadeIn>

              <FadeIn delay={0.1} yOffset={40}>
                <h1 className="text-[3.5rem] md:text-[5.5rem] lg:text-[7rem] font-serif tracking-tighter leading-[0.9] mb-8 text-[#0F3B2E] relative">
                  Maîtrisez l'exhaustivité <br/>
                  <span className="relative inline-block text-emerald-900/90 italic pr-4">
                    de vos cours.
                    <DrawnUnderline className="text-emerald-400/70" />
                  </span>
                </h1>
              </FadeIn>
              
              <FadeIn delay={0.2}>
                <p className="text-lg md:text-xl text-[#1A1A1A]/60 max-w-2xl mx-auto mb-14 font-medium leading-relaxed">
                  Uploadez vos propres supports. Hippocampus les transforme instantanément en QCM, flashcards et cas cliniques interactifs.
                </p>
              </FadeIn>
              
              <FadeIn delay={0.3} className="flex flex-col sm:flex-row items-center gap-6 relative z-30">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                  <Button asChild size="lg" className="relative rounded-full h-14 px-8 text-base bg-[#0F3B2E] text-white hover:bg-[#1A1A1A] font-semibold transition-all duration-300">
                    <Link to="/auth">Transformer mon premier cours <ArrowRight className="ml-2 w-4 h-4 opacity-70" /></Link>
                  </Button>
                </div>
                <Button asChild variant="ghost" size="lg" className="rounded-full h-14 px-8 text-base text-[#0F3B2E] hover:bg-black/5 font-semibold transition-all duration-300">
                  <a href="#demo">Voir la démonstration</a>
                </Button>
              </FadeIn>

            </motion.div>

            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden hidden lg:block">
              <motion.div style={{ y: yFloating1 }} className="absolute top-[25%] left-[8%]">
                 <FloatingElement delay={0} yOffset={8} duration={6}>
                   <TiltCard>
                     <div className="p-4 bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.04)] border border-white/60 rotate-[-3deg] flex items-center gap-4 cursor-default pointer-events-auto">
                       <div className="w-10 h-10 bg-[#0F3B2E]/5 rounded-xl flex items-center justify-center text-[#0F3B2E]"><Target className="w-5 h-5" /></div>
                       <div>
                         <div className="text-[10px] font-bold text-[#1A1A1A]/40 uppercase tracking-widest">Objectif du jour</div>
                         <div className="font-serif font-bold text-lg text-[#1A1A1A]">50 Flashcards</div>
                       </div>
                     </div>
                   </TiltCard>
                 </FloatingElement>
              </motion.div>
              
              <motion.div style={{ y: yFloating2 }} className="absolute top-[35%] right-[8%]">
                 <FloatingElement delay={1} yOffset={12} duration={7}>
                   <TiltCard>
                     <div className="p-5 bg-[#0F3B2E]/95 backdrop-blur-md text-white rounded-[1.5rem] shadow-[0_20px_40px_rgba(15,59,46,0.2)] rotate-[4deg] max-w-[260px] border border-white/10 cursor-default pointer-events-auto">
                       <div className="flex items-center gap-2 mb-2">
                         <Activity className="text-emerald-400 w-3.5 h-3.5" />
                         <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/80">Cas Clinique généré</span>
                       </div>
                       <p className="text-[13px] font-light leading-relaxed opacity-90">"Patient de 45 ans se présentant aux urgences pour dyspnée aiguë..."</p>
                     </div>
                   </TiltCard>
                 </FloatingElement>
              </motion.div>
            </div>
          </section>

          {/* BENTO BOX FEATURES - Mises à jour avec Spotlight effect */}
          <section id="features" className="py-24 px-6 max-w-7xl mx-auto relative z-20">
            <FadeIn>
              <div className="text-center mb-20">
                <h2 className="text-3xl md:text-4xl font-serif text-[#0F3B2E] mb-4 tracking-tight">La quintessence de l'apprentissage.</h2>
                <p className="text-lg text-[#1A1A1A]/50 max-w-2xl mx-auto font-medium">Une suite d'outils interconnectés, façonnée pour l'exigence médicale.</p>
              </div>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[340px]">
              
              <FadeIn delay={0.1} className="md:col-span-2 group relative rounded-[2rem] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-black/[0.04] transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
                <SpotlightCard className="h-full w-full p-10 rounded-[2rem]" spotlightColor="rgba(16, 185, 129, 0.08)">
                  <div className="relative z-10 max-w-md">
                    <div className="w-12 h-12 bg-white border border-black/5 text-[#0F3B2E] rounded-2xl flex items-center justify-center mb-8 shadow-sm"><Brain className="w-5 h-5" /></div>
                    <h3 className="text-2xl font-serif text-[#1A1A1A] mb-4">Génération de QCM sur-mesure</h3>
                    <p className="text-[#1A1A1A]/60 leading-relaxed text-sm">Le moteur d'IA analyse la sémantique de vos polys et crée des QCM complexes, évitant les banques de questions génériques et obsolètes.</p>
                  </div>
                  <div className="absolute right-[-5%] bottom-[-10%] w-[50%] h-[100%] bg-[#FDFBF7] rounded-tl-2xl border-t border-l border-black/5 shadow-2xl p-6 flex flex-col gap-4 transform group-hover:-translate-x-4 group-hover:-translate-y-4 transition-transform duration-700 ease-out z-10">
                    <div className="flex items-center gap-3 border-b border-black/5 pb-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                      <div className="h-2 w-16 bg-black/10 rounded-full" />
                    </div>
                    <div className="space-y-3 mt-2">
                      <div className="h-2.5 w-full bg-black/5 rounded-full" />
                      <div className="h-2.5 w-4/5 bg-black/5 rounded-full" />
                    </div>
                  </div>
                </SpotlightCard>
              </FadeIn>

              <FadeIn delay={0.2} className="md:col-span-1 md:row-span-2 group relative rounded-[2rem] bg-[#0F3B2E] text-white shadow-xl">
                <SpotlightCard className="h-full w-full p-10 rounded-[2rem]" spotlightColor="rgba(255, 255, 255, 0.1)">
                  <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none" />
                  <div className="relative z-10 h-full flex flex-col">
                    <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/10"><Layers className="w-5 h-5" /></div>
                    <h3 className="text-2xl font-serif mb-4">Répétition Espacée</h3>
                    <p className="text-white/60 leading-relaxed text-sm mb-auto">L'algorithme s'adapte mathématiquement à votre courbe de l'oubli. Révisez exactement ce qui vous échappe au moment précis où vous l'oubliez.</p>
                    
                    <div className="mt-12 relative h-32 opacity-70 group-hover:opacity-100 transition-opacity duration-500">
                      <div className="absolute bottom-0 left-0 w-full h-full flex items-end gap-2">
                        {[30, 50, 25, 75, 45, 100].map((h, i) => (
                          <div key={i} className="group-hover:animate-pulse flex-1 bg-white/20 rounded-t-sm transition-all duration-700" style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </FadeIn>

              <FadeIn delay={0.3} className="md:col-span-1 group relative rounded-[2rem] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-black/[0.04] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500">
                <SpotlightCard className="h-full w-full p-10 rounded-[2rem]" spotlightColor="rgba(59, 130, 246, 0.08)">
                  <div className="w-12 h-12 bg-white border border-black/5 text-[#0F3B2E] rounded-2xl flex items-center justify-center mb-8 shadow-sm relative z-10"><Stethoscope className="w-5 h-5" /></div>
                  <h3 className="text-2xl font-serif text-[#1A1A1A] mb-4 relative z-10">Cas Cliniques</h3>
                  <p className="text-[#1A1A1A]/60 leading-relaxed text-sm relative z-10">Générez dynamiquement des situations complexes calquées sur le format ECNi, sourcées depuis vos documents.</p>
                </SpotlightCard>
              </FadeIn>

              <FadeIn delay={0.4} className="md:col-span-1 group relative rounded-[2rem] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-black/[0.04] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500">
                <SpotlightCard className="h-full w-full p-10 rounded-[2rem]" spotlightColor="rgba(244, 63, 94, 0.08)">
                  <div className="w-12 h-12 bg-white border border-black/5 text-[#0F3B2E] rounded-2xl flex items-center justify-center mb-8 shadow-sm relative z-10"><Fingerprint className="w-5 h-5" /></div>
                  <h3 className="text-2xl font-serif text-[#1A1A1A] mb-4 relative z-10">Synthèses IA</h3>
                  <p className="text-[#1A1A1A]/60 leading-relaxed text-sm relative z-10">Condensez 50 pages de polycopiés indigestes en une fiche de révision structurée, visuelle et ultra-dense.</p>
                </SpotlightCard>
              </FadeIn>

            </div>
          </section>

          {/* VIDEO EXPLAINER avec effet Tilt */}
          <section id="demo" className="py-24 px-6 max-w-5xl mx-auto relative z-20">
            <FadeIn>
              <TiltCard className="w-full">
                <div className="w-full aspect-video bg-[#121212] rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.15)] border border-black/5 overflow-hidden relative group cursor-pointer flex items-center justify-center transform-gpu">
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80')] opacity-40 bg-cover bg-center mix-blend-overlay transition-transform duration-1000 ease-out group-hover:scale-105" />
                  
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-white transition-all duration-500 z-10 shadow-2xl">
                    <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[16px] border-l-white group-hover:border-l-[#1A1A1A] border-b-[10px] border-b-transparent ml-2 transition-colors duration-500" />
                  </div>
                </div>
              </TiltCard>
            </FadeIn>
          </section>
        </div>

        {/* MOR AGENT SECTION */}
        <section id="mor" className="py-32 px-6 relative overflow-hidden bg-[#111111] text-white mt-12 rounded-[2.5rem] md:rounded-[4rem] mx-4 md:mx-8 shadow-2xl">
          <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-15 mix-blend-overlay pointer-events-none" />
          
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-20 items-center relative z-10">
            <FadeIn>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-white/10 bg-white/5 mb-8 text-white/70 text-[10px] font-bold tracking-[0.2em] uppercase">
                <Cpu className="w-3 h-3" /> Intelligence Contextuelle
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif leading-[1.05] mb-6 tracking-tight">
                Rencontrez MOR. <br />
                <span className="text-white/30 italic">Votre mentor.</span>
              </h2>
              <p className="text-lg text-white/50 mb-10 leading-relaxed font-light max-w-md">
                MOR ne divulgue pas la réponse. Il dissèque vos failles logiques par le dialogue socratique et vous guide vers la solution par vous-même.
              </p>
              
              <ul className="space-y-5">
                {["Détection des biais cognitifs", "Analyse d'images radiologiques intégrée", "Mémoire contextuelle de vos lacunes"].map((item, i) => (
                  <li key={i} className="flex items-center gap-4 text-white/70 text-sm font-medium">
                    <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-white/50 text-[10px]">0{i+1}</div>
                    {item}
                  </li>
                ))}
              </ul>
            </FadeIn>
            <FadeIn delay={0.3} className="relative">
              <TiltCard>
                <div className="bg-[#1A1A1A] border border-white/5 rounded-3xl p-8 shadow-[0_30px_60px_rgba(0,0,0,0.5)] relative z-10 transform-gpu">
                  <div className="space-y-8">
                    <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 text-[10px] font-bold flex-shrink-0">USR</div>
                      <div className="bg-transparent border border-white/10 rounded-2xl p-5 text-white/70 text-[13px] font-light leading-relaxed">
                        Pourquoi exclure un syndrome de Guillain-Barré ici ?
                      </div>
                    </div>
                    <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-[#0F3B2E] flex items-center justify-center text-emerald-400 flex-shrink-0 shadow-[0_0_15px_rgba(15,59,46,0.5)]">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div className="bg-[#0F3B2E]/10 border border-emerald-500/10 rounded-2xl p-5 text-emerald-50/80 text-[13px] font-light leading-relaxed">
                        L'hypothèse est pertinente. Néanmoins, analysez les ROT dans l'énoncé. Dans une forme classique, on observe une aréflexie. Ici, ils sont vifs et diffusés. Vers quel type d'atteinte ce signe pathognomonique vous oriente-t-il ?
                      </div>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </FadeIn>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="py-32 px-0 relative overflow-hidden bg-[#FDFBF7]">
          {/* Marquee Animation styles moved to index.css */}
          
          <div className="text-center mb-20 px-6 relative z-20">
            <h2 className="text-3xl md:text-4xl font-serif text-[#0F3B2E] mb-4 tracking-tight">Approuvé par l'élite</h2>
            <p className="text-[#1A1A1A]/50 text-sm font-medium tracking-widest uppercase">La norme en faculté de médecine</p>
          </div>
          
          <div className="overflow-hidden relative z-20 py-4 [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
            <div className="marquee-container flex gap-6 px-4">
              {[
                { name: "Fatou N.", role: "Externat D2", text: "Je ne passe plus des heures à faire des fiches. L'IA génère les flashcards instantanément. Un gain de temps absolu." },
                { name: "Amadou C.", role: "PACES", text: "La fonction tuteur est bluffante. Quand je me trompe, l'explication me permet de comprendre la logique profonde de mon erreur." },
                { name: "Aïssatou D.", role: "Interne", text: "Idéal pour réviser rapidement entre deux gardes. Les questions sont pointues et correspondent au vrai niveau d'exigence." },
                { name: "Fatou N.", role: "Externat D2", text: "Je ne passe plus des heures à faire des fiches. L'IA génère les flashcards instantanément. Un gain de temps absolu." },
                { name: "Amadou C.", role: "PACES", text: "La fonction tuteur est bluffante. Quand je me trompe, l'explication me permet de comprendre la logique profonde de mon erreur." },
                { name: "Aïssatou D.", role: "Interne", text: "Idéal pour réviser rapidement entre deux gardes. Les questions sont pointues et correspondent au vrai niveau d'exigence." }
              ].map((t, i) => (
                <div key={i} className="bg-white border border-black/5 p-8 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] w-[360px] flex-shrink-0 hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition-all duration-300">
                  <p className="text-[14px] mb-8 leading-relaxed text-[#1A1A1A]/60 font-medium relative z-10">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-2 relative z-10">
                    <div className="w-8 h-8 bg-[#FDFBF7] border border-black/5 rounded-full flex items-center justify-center text-[#0F3B2E] font-serif font-bold text-xs">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-[#1A1A1A]">{t.name}</div>
                      <div className="text-[10px] text-[#1A1A1A]/40 font-bold uppercase tracking-wider">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-[#0F3B2E] pt-24 pb-8 px-6 relative z-20 text-[#FDFBF7] overflow-hidden">
        <div className="absolute -bottom-20 -right-20 text-[30rem] font-serif font-bold leading-none text-white opacity-[0.02] pointer-events-none select-none">
          H
        </div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-24 gap-12 border-b border-white/10 pb-16">
            <div className="max-w-xl">
              <h2 className="text-4xl md:text-6xl font-serif tracking-tight mb-8 leading-[1.05]">
                Passez à la vitesse <span className="italic text-emerald-400/80">supérieure.</span>
              </h2>
              <Button asChild size="lg" className="rounded-full h-12 px-8 text-sm bg-white text-[#0F3B2E] hover:bg-gray-100 font-semibold shadow-none transition-transform hover:-translate-y-0.5">
                <Link to="/auth">Démarrer maintenant</Link>
              </Button>
            </div>
            
            <div className="flex gap-16 text-sm font-medium">
              <div className="flex flex-col gap-4">
                <span className="text-white/30 text-[9px] font-bold uppercase tracking-[0.2em] mb-1">Produit</span>
                <Link to="/" className="text-white/60 hover:text-white transition-colors text-xs">Accueil</Link>
                <Link to="/pricing" className="text-white/60 hover:text-white transition-colors text-xs">Tarifs</Link>
                <Link to="/auth" className="text-white/60 hover:text-white transition-colors text-xs">Connexion</Link>
              </div>
              <div className="flex flex-col gap-4">
                <span className="text-white/30 text-[9px] font-bold uppercase tracking-[0.2em] mb-1">Légal</span>
                <Link to="/privacy" className="text-white/60 hover:text-white transition-colors text-xs">Confidentialité</Link>
                <Link to="/terms" className="text-white/60 hover:text-white transition-colors text-xs">Conditions</Link>
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between text-white/30 text-[11px] font-medium">
            <div className="mb-4 md:mb-0 flex items-center gap-2">
               <span className="text-lg font-serif font-bold text-white/70">Hippocampus</span>
            </div>
            <div>
              © {new Date().getFullYear()} Hippocampus Inc. L'IA au service de l'excellence médicale.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
