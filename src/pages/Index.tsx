import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
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

// --- REUSABLE ANIMATION COMPONENTS ---

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

const FloatingElement = ({ children, delay = 0, yOffset = 20, duration = 4, className = "" }: any) => (
  <motion.div
    initial={{ y: 0 }}
    animate={{ y: [-yOffset, yOffset, -yOffset] }}
    transition={{ repeat: Infinity, duration, ease: "easeInOut", delay }}
    className={`absolute ${className}`}
  >
    {children}
  </motion.div>
);

// Hand-drawn SVG Arrow
const DrawnArrow = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={`overflow-visible ${className}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <motion.path
      initial={{ pathLength: 0, opacity: 0 }}
      whileInView={{ pathLength: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1, delay: 0.5, ease: "easeInOut" }}
      d="M10,50 Q40,10 90,80 M70,80 L90,80 L90,60"
    />
  </svg>
);

// Hand-drawn Underline
const DrawnUnderline = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 20" className={`overflow-visible absolute w-full left-0 bottom-[-5px] ${className}`} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
    <motion.path
      initial={{ pathLength: 0, opacity: 0 }}
      whileInView={{ pathLength: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
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
  
  // Parallax Scroll Effects
  const { scrollY } = useScroll();
  const yHeroText = useTransform(scrollY, [0, 1000], [0, 150]);
  const yFloating1 = useTransform(scrollY, [0, 1000], [0, -150]);
  const yFloating2 = useTransform(scrollY, [0, 1000], [0, -250]);
  const yBentoMockup = useTransform(scrollY, [0, 1500], [100, -100]);

  useEffect(() => {
    document.title = "Hippocampus - Révise plus intelligemment";
    
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    
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
      window.removeEventListener("scroll", handleScroll);
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
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1A1A1A] selection:bg-[#0F3B2E]/20 font-sans overflow-x-hidden">
      
      {/* HEADER — Preserved layout with color matching */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-500 ${scrolled ? 'pt-2' : 'pt-4'}`}
      >
        <div className={`flex items-center justify-between gap-2 transition-all duration-500 ${scrolled ? 'w-[95%] max-w-6xl px-4 py-2.5 rounded-full bg-[#1A1A1A]/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] border border-white/[0.06]' : 'w-[92%] max-w-5xl px-6 py-3.5 rounded-full bg-[#1A1A1A] shadow-[0_10px_40px_rgba(0,0,0,0.25)] border border-white/[0.08]'}`}>
          
          <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <img src="/favicon.png" alt="Hippocampus Logo" className="w-8 h-8 object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-md" />
            <span className="font-bold text-lg tracking-tight text-white group-hover:text-emerald-400 transition-colors duration-300">Hippocampus</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-1 text-[13px] font-semibold">
            <a href="#features" className="px-4 py-2 rounded-full text-white/65 hover:text-white hover:bg-white/[0.08] transition-all duration-300">Produit</a>
            <a href="#mor" className="px-4 py-2 rounded-full text-white/65 hover:text-white hover:bg-white/[0.08] transition-all duration-300">Agent MOR</a>
            <Link to="/pricing" className="px-4 py-2 rounded-full text-white/65 hover:text-white hover:bg-white/[0.08] transition-all duration-300">Tarifs</Link>
          </div>
          
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/dashboard" className="text-[13px] font-bold bg-[#FDFBF7] text-[#1A1A1A] px-5 py-2.5 rounded-full hover:bg-white hover:shadow-[0_0_20px_rgba(253,251,247,0.5)] hover:scale-105 transition-all duration-300 flex items-center gap-2">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Dashboard
                </Link>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 outline-none">
                      <div className="relative">
                        <Avatar className="w-9 h-9 border-2 border-white/20 hover:border-emerald-400/50 transition-colors">
                          <AvatarImage src={avatarUrl || user.user_metadata?.avatar_url} />
                          <AvatarFallback className="bg-[#0F3B2E]/20 text-white text-xs font-bold">{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#1A1A1A] rounded-full"></div>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-[#1A1A1A] border-white/10 text-white p-2 rounded-2xl shadow-2xl backdrop-blur-xl">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-bold leading-none">{userName || user.email?.split('@')[0]}</p>
                        <p className="text-xs leading-none text-white/50 truncate">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem className="focus:bg-white/10 focus:text-white rounded-xl cursor-pointer py-2">
                      <div className="flex items-center gap-2 w-full">
                        <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                        <span className="text-xs font-medium">Statut: Connecté</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={handleLogout} className="focus:bg-destructive/20 focus:text-destructive rounded-xl cursor-pointer py-2 text-rose-500">
                      <div className="flex items-center gap-2 w-full">
                        <LogOut className="w-4 h-4" />
                        <span>Déconnexion</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <>
                <Link to="/auth" className="text-[13px] font-semibold text-white/60 hover:text-white px-3 py-2 rounded-full hover:bg-white/[0.06] transition-all duration-300">Se connecter</Link>
                <Link to="/auth" className="text-[13px] font-bold bg-[#FDFBF7] text-[#1A1A1A] px-5 py-2.5 rounded-full hover:bg-white hover:shadow-[0_0_20px_rgba(253,251,247,0.5)] hover:scale-105 transition-all duration-300 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Commencer gratuitement
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className={`p-2 rounded-full transition-all duration-300 ${isMobileMenuOpen ? 'text-white bg-white/20' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
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
            className="fixed inset-0 z-40 bg-[#FDFBF7]/90 backdrop-blur-[40px] pt-28 px-6 flex flex-col md:hidden overflow-y-auto"
          >
            <div className="flex flex-col gap-3">
              <a href="#features" onClick={() => setIsMobileMenuOpen(false)} 
                 className="group flex items-center justify-between py-4 px-6 rounded-[1.8rem] bg-white text-[#1A1A1A] border border-[#E5E5E5] shadow-sm">
                <span className="text-lg font-bold">Produit</span>
                <Brain className="w-5 h-5 opacity-50" />
              </a>
              <a href="#mor" onClick={() => setIsMobileMenuOpen(false)} 
                 className="group flex items-center justify-between py-4 px-6 rounded-[1.8rem] bg-white text-[#1A1A1A] border border-[#E5E5E5] shadow-sm">
                <span className="text-lg font-bold">Agent MOR</span>
                <Zap className="w-5 h-5 opacity-50" />
              </a>
              <Link to="/pricing" onClick={() => setIsMobileMenuOpen(false)} 
                 className="group flex items-center justify-between py-4 px-6 rounded-[1.8rem] bg-white text-[#1A1A1A] border border-[#E5E5E5] shadow-sm">
                <span className="text-lg font-bold">Tarifs</span>
                <Trophy className="w-5 h-5 opacity-50" />
              </Link>

              {!user ? (
                <div className="mt-4 flex flex-col gap-3">
                  <Link to="/auth" onClick={() => setIsMobileMenuOpen(false)} 
                     className="py-4 px-6 rounded-[1.8rem] bg-[#1A1A1A] text-white flex justify-center items-center font-bold">
                    Se connecter
                  </Link>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-3">
                  <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} 
                     className="py-4 px-6 rounded-[1.8rem] bg-[#0F3B2E] text-white flex justify-center items-center font-bold">
                    Mon Dashboard
                  </Link>
                  <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} 
                     className="py-4 px-6 rounded-[1.8rem] border border-rose-200 text-rose-600 font-bold bg-rose-50">
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10">
        
        {/* HERO SECTION - Wispr Flow Inspired */}
        <section className="relative pt-40 pb-32 px-6 overflow-hidden min-h-[90vh] flex flex-col items-center justify-center text-center bg-doodle-watermark">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-overlay pointer-events-none" />
          
          {/* Abstract Hand-drawn SVG Wires */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
            <svg viewBox="0 0 1400 800" className="w-full h-full text-[#0F3B2E]" preserveAspectRatio="xMidYMid slice">
              <motion.path 
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 3, ease: "easeInOut" }}
                d="M -100,200 C 300,100 400,600 800,400 C 1100,200 1300,500 1500,300" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeDasharray="4,8"
              />
              <motion.path 
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 4, ease: "easeInOut", delay: 0.5 }}
                d="M 1500,600 C 1000,700 900,200 500,400 C 200,500 0,300 -100,400" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              />
            </svg>
          </div>

          <motion.div style={{ y: yHeroText }} className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
            
            <FadeIn scale={0.9} duration={1}>
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-[#0F3B2E]/10 bg-white/50 backdrop-blur-md mb-8 shadow-sm">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-bold text-[#1A1A1A]/80 tracking-wide uppercase">L'excellence académique</span>
              </div>
            </FadeIn>

            <FadeIn delay={0.1} yOffset={40}>
              <h1 className="text-6xl md:text-[5.5rem] lg:text-[7rem] font-serif tracking-tighter leading-[0.95] mb-8 text-[#0F3B2E] relative">
                Apprenez avec le <br/>
                <span className="relative inline-block">
                  premier cerveau
                  <DrawnUnderline className="text-emerald-400" />
                </span> artificiel.
              </h1>
            </FadeIn>
            
            <FadeIn delay={0.2}>
              <p className="text-xl md:text-2xl text-[#1A1A1A]/60 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
                Importez vos cours de médecine. L'IA génère vos QCM, vos flashcards et vos résumés pour un ancrage mémoriel absolu.
              </p>
            </FadeIn>
            
            <FadeIn delay={0.3} className="flex flex-col sm:flex-row items-center gap-4 relative z-20">
              <Button asChild size="lg" className="rounded-full h-16 px-10 text-lg bg-[#0F3B2E] text-white hover:bg-black font-bold shadow-[0_15px_30px_rgba(15,59,46,0.3)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-500 hover:scale-[1.03]">
                <Link to="/auth">Créer mon espace de travail</Link>
              </Button>
              <div className="absolute -right-24 -top-8 w-20 h-20 hidden md:block text-[#1A1A1A]/30">
                <DrawnArrow />
              </div>
            </FadeIn>

          </motion.div>

          {/* Floating UI Mockups to show the product instead of abstract blobs */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden hidden lg:block">
            <motion.div style={{ y: yFloating1 }} className="absolute top-1/4 left-10">
               <FloatingElement delay={0} yOffset={15} duration={5}>
                 <div className="p-4 bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] border border-white rotate-[-8deg] flex items-center gap-4">
                   <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600"><CheckCircle2 /></div>
                   <div>
                     <div className="text-xs font-bold text-[#1A1A1A]/50 uppercase">Résultat QCM</div>
                     <div className="font-serif font-bold text-2xl text-[#0F3B2E]">18 / 20</div>
                   </div>
                 </div>
               </FloatingElement>
            </motion.div>
            
            <motion.div style={{ y: yFloating2 }} className="absolute top-1/3 right-10">
               <FloatingElement delay={1} yOffset={25} duration={6}>
                 <div className="p-5 bg-[#0F3B2E] text-white rounded-[2rem] shadow-[0_20px_40px_rgba(15,59,46,0.2)] rotate-[6deg] max-w-[250px]">
                   <div className="flex items-center gap-3 mb-3">
                     <Sparkles className="text-amber-400 w-5 h-5" />
                     <span className="text-xs font-bold uppercase tracking-widest text-white/50">Tuteur MOR</span>
                   </div>
                   <p className="text-sm font-medium leading-relaxed">"L'artère radiale est la bonne réponse car elle chemine dans la gouttière..."</p>
                 </div>
               </FloatingElement>
            </motion.div>
          </div>

        </section>

        {/* BENTO BOX FEATURES - Asymmetrical premium layout */}
        <section id="features" className="py-24 px-6 max-w-7xl mx-auto relative z-20">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-serif text-[#0F3B2E] mb-4">La quintessence de l'apprentissage.</h2>
              <p className="text-lg text-[#1A1A1A]/60 max-w-2xl mx-auto">Une suite d'outils interconnectés, conçus obsessionnellement pour les études médicales.</p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
            
            {/* Bento 1: Large Box */}
            <FadeIn delay={0.1} className="md:col-span-2 bg-white rounded-[2.5rem] p-10 shadow-sm border border-[#E5E5E5] relative overflow-hidden group hover:shadow-xl transition-all duration-500">
              <div className="relative z-10 max-w-sm">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6"><Brain className="w-6 h-6" /></div>
                <h3 className="text-2xl font-bold font-serif text-[#0F3B2E] mb-3">Génération de QCM sur-mesure</h3>
                <p className="text-[#1A1A1A]/70 leading-relaxed">Importez vos propres cours en PDF. Notre moteur d'IA lit, analyse et crée des centaines de QCM calibrés selon vos exigences académiques.</p>
              </div>
              
              {/* Animated Mockup inside Bento */}
              <motion.div 
                className="absolute right-[-20%] bottom-[-20%] w-[60%] h-[120%] bg-[#FDFBF7] rounded-tl-[3rem] border-t border-l border-[#E5E5E5] shadow-2xl p-8 flex flex-col gap-4 group-hover:-translate-x-4 group-hover:-translate-y-4 transition-transform duration-700"
              >
                <div className="w-full h-8 bg-white rounded-lg border border-[#E5E5E5] flex items-center px-4"><div className="w-3 h-3 rounded-full bg-emerald-400" /></div>
                <div className="w-3/4 h-8 bg-white rounded-lg border border-[#E5E5E5]" />
                <div className="w-5/6 h-8 bg-white rounded-lg border border-[#E5E5E5]" />
              </motion.div>
            </FadeIn>

            {/* Bento 2: Tall Box */}
            <FadeIn delay={0.2} className="md:col-span-1 md:row-span-2 bg-[#0F3B2E] text-white rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
              <div className="relative z-10 h-full flex flex-col">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6"><Layers className="w-6 h-6" /></div>
                <h3 className="text-2xl font-bold font-serif mb-3">Répétition Espacée</h3>
                <p className="text-white/70 leading-relaxed mb-auto">Les flashcards s'adaptent à votre courbe de l'oubli. Révisez ce que vous oubliez, ignorez ce que vous maîtrisez.</p>
                
                {/* Visual */}
                <div className="mt-8 relative h-40">
                  <div className="absolute bottom-0 left-0 w-full h-full flex items-end gap-2">
                    {[40, 70, 30, 90, 50, 100].map((h, i) => (
                      <motion.div 
                        key={i}
                        initial={{ height: 0 }}
                        whileInView={{ height: `${h}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                        className="flex-1 bg-white/20 rounded-t-lg group-hover:bg-emerald-400/80 transition-colors"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Bento 3: Square Box */}
            <FadeIn delay={0.3} className="md:col-span-1 bg-white rounded-[2.5rem] p-10 shadow-sm border border-[#E5E5E5] relative overflow-hidden group hover:shadow-xl transition-all duration-500">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6"><Stethoscope className="w-6 h-6" /></div>
              <h3 className="text-2xl font-bold font-serif text-[#0F3B2E] mb-3">Cas Cliniques</h3>
              <p className="text-[#1A1A1A]/70 leading-relaxed">Résolvez des situations cliniques complexes (ECNi) générées dynamiquement.</p>
            </FadeIn>

            {/* Bento 4: Square Box */}
            <FadeIn delay={0.4} className="md:col-span-1 bg-white rounded-[2.5rem] p-10 shadow-sm border border-[#E5E5E5] relative overflow-hidden group hover:shadow-xl transition-all duration-500">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-6"><Fingerprint className="w-6 h-6" /></div>
              <h3 className="text-2xl font-bold font-serif text-[#0F3B2E] mb-3">Synthèses IA</h3>
              <p className="text-[#1A1A1A]/70 leading-relaxed">Transformez 50 pages de polycopiés en une fiche de révision ultra-dense de 2 pages.</p>
            </FadeIn>

          </div>
        </section>

        {/* VIDEO EXPLAINER SECTION */}
        <section id="demo" className="py-24 px-6 max-w-5xl mx-auto relative z-20">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif text-[#0F3B2E] mb-4">Découvrez Hippocampus en action</h2>
              <p className="text-[#1A1A1A]/60 text-lg">Une plateforme conçue pour révolutionner votre mémorisation.</p>
            </div>
            <div className="w-full aspect-video bg-[#1A1A1A] rounded-[2rem] shadow-2xl border-4 border-white overflow-hidden relative group cursor-pointer flex items-center justify-center">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80')] opacity-50 bg-cover bg-center mix-blend-overlay transition-transform duration-700 group-hover:scale-105" />
              <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500 transition-all duration-300 z-10">
                <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-2" />
              </div>
            </div>
          </FadeIn>
        </section>

        {/* MOR AGENT SECTION - Dark, Neural, Glowing */}
        <section id="mor" className="py-32 px-6 relative overflow-hidden bg-[#1A1A1A] text-white mt-12 rounded-[3rem] md:rounded-[4rem] mx-4 md:mx-8 shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
          {/* Abstract Synapse Glows */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none">
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }} transition={{ repeat: Infinity, duration: 6 }} className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-emerald-500/20 rounded-full blur-[100px]" />
            <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ repeat: Infinity, duration: 8, delay: 2 }} className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px]" />
          </div>

          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center relative z-10">
            <FadeIn>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8 text-emerald-400 text-sm font-bold tracking-widest uppercase">
                <Cpu className="w-4 h-4" /> Le Tuteur Socratique
              </div>
              <h2 className="text-5xl md:text-6xl font-serif leading-[1.1] mb-6">
                Rencontrez MOR. <br />
                <span className="text-white/40">Votre mentor personnel.</span>
              </h2>
              <p className="text-xl text-white/60 mb-10 leading-relaxed font-light">
                MOR ne se contente pas de vous donner la réponse. Il analyse votre raisonnement, identifie vos failles logiques, et vous guide vers la solution comme un véritable professeur de CHU.
              </p>
              
              <ul className="space-y-4 mb-10">
                {["Disponibilité 24/7", "Bienveillance absolue", "Maîtrise de toute la littérature médicale"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/80">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">✓</div>
                    {item}
                  </li>
                ))}
              </ul>
            </FadeIn>

            <FadeIn delay={0.3} className="relative">
              <div className="bg-[#2A2A2A]/50 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-2xl relative z-10">
                {/* Chat Mockup */}
                <div className="space-y-6">
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">Vous</div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-white/80 text-sm">
                      Pourquoi n'est-ce pas un syndrome de Guillain-Barré dans ce cas clinique ?
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="bg-[#0F3B2E]/40 border border-emerald-500/20 rounded-2xl p-4 text-white text-sm leading-relaxed">
                      C'est une excellente hypothèse. Cependant, regardez les réflexes ostéotendineux dans l'énoncé. Dans un Guillain-Barré classique, on s'attend à une aréflexie. Ici, ils sont conservés. Que pensez-vous plutôt d'une atteinte centrale ?
                    </div>
                  </div>
                </div>
              </div>
              {/* Decorative Wires behind mockup */}
              <div className="absolute -inset-10 -z-10 opacity-30">
                <DrawnArrow className="w-32 h-32 text-emerald-500 absolute -top-10 -left-10 -rotate-45" />
              </div>
            </FadeIn>
          </div>
        </section>

        {/* TESTIMONIALS - Elegant Cards Marquee */}
        <section className="py-32 px-0 relative overflow-hidden bg-doodle-watermark bg-[#FDFBF7]">
          <style dangerouslySetInnerHTML={{__html: `
            .marquee-container { display: flex; width: max-content; animation: marquee 40s linear infinite; }
            .marquee-container:hover { animation-play-state: paused; }
            @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          `}} />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-overlay pointer-events-none w-full" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#FDFBF7] via-transparent to-[#FDFBF7] z-10 pointer-events-none w-full" />
          
          <div className="text-center mb-16 px-6 relative z-20">
            <h2 className="text-4xl md:text-5xl font-serif text-[#0F3B2E] mb-6">Ils ont transformé leurs études</h2>
            <p className="text-[#1A1A1A]/60 text-lg">Rejoignez des centaines d'étudiants en santé vers l'excellence.</p>
          </div>

          <div className="overflow-hidden relative z-20 py-8">
            <div className="marquee-container flex gap-8 px-4">
              {[
                { name: "Fatou N.", role: "Externat D2 - UCAD", text: "Je ne passe plus des heures à faire des fiches. L'IA génère les flashcards instantanément. Un gain de temps énorme." },
                { name: "Amadou C.", role: "PACES - UGB", text: "La fonction tuteur est bluffante. Quand je me trompe, l'explication est claire et me permet de comprendre mon erreur." },
                { name: "Aïssatou D.", role: "Interne des hôpitaux", text: "Idéal pour réviser rapidement entre deux gardes. Les questions sont pointues et correspondent au niveau d'exigence." },
                // Duplicate for seamless loop
                { name: "Fatou N.", role: "Externat D2 - UCAD", text: "Je ne passe plus des heures à faire des fiches. L'IA génère les flashcards instantanément. Un gain de temps énorme." },
                { name: "Amadou C.", role: "PACES - UGB", text: "La fonction tuteur est bluffante. Quand je me trompe, l'explication est claire et me permet de comprendre mon erreur." },
                { name: "Aïssatou D.", role: "Interne des hôpitaux", text: "Idéal pour réviser rapidement entre deux gardes. Les questions sont pointues et correspondent au niveau d'exigence." }
              ].map((t, i) => (
                <div key={i} className="bg-white border border-[#E5E5E5] p-8 rounded-[2rem] hover:-translate-y-4 transition-all duration-500 shadow-sm hover:shadow-2xl relative group w-[400px] flex-shrink-0 cursor-pointer">
                  <div className="absolute top-8 right-8 text-[#E5E5E5] group-hover:text-emerald-200 transition-colors">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/></svg>
                  </div>
                  <p className="text-lg font-medium mb-10 leading-relaxed text-[#1A1A1A]/80 group-hover:text-emerald-700 transition-colors duration-300 relative z-10 pt-4">"{t.text}"</p>
                  <div className="flex items-center gap-4 border-t border-[#E5E5E5] pt-6 relative z-10">
                    <div className="w-12 h-12 bg-[#0F3B2E] rounded-full flex items-center justify-center text-white font-serif font-bold text-lg group-hover:bg-emerald-600 transition-colors">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-[#1A1A1A] group-hover:text-emerald-900 transition-colors">{t.name}</div>
                      <div className="text-sm text-[#1A1A1A]/50 font-medium">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER & MASSIVE CTA */}
      <footer className="bg-[#0F3B2E] pt-32 pb-12 px-6 relative z-20 text-[#FDFBF7] overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-32 gap-16 border-b border-white/10 pb-20">
            <div className="max-w-2xl">
              <h2 className="text-6xl md:text-[7rem] font-serif tracking-tighter mb-10 leading-[0.9]">
                Passez à la <br />vitesse <span className="italic text-emerald-400">supérieure.</span>
              </h2>
              <Button asChild size="lg" className="rounded-full h-16 px-10 text-lg bg-[#FDFBF7] text-[#0F3B2E] hover:bg-white font-bold shadow-none hover:scale-105 transition-transform">
                <Link to="/auth">Démarrer gratuitement <ArrowRight className="ml-3 w-5 h-5" /></Link>
              </Button>
            </div>
            
            <div className="flex gap-16 text-lg font-medium">
              <div className="flex flex-col gap-5">
                <span className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Produit</span>
                <Link to="/" className="hover:text-emerald-400 transition-colors">Accueil</Link>
                <Link to="/pricing" className="hover:text-emerald-400 transition-colors">Tarifs</Link>
                <Link to="/auth" className="hover:text-emerald-400 transition-colors">Se connecter</Link>
              </div>
              <div className="flex flex-col gap-5">
                <span className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Légal</span>
                <Link to="/privacy" className="hover:text-emerald-400 transition-colors">Confidentialité</Link>
                <Link to="/terms" className="hover:text-emerald-400 transition-colors">Conditions</Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between text-white/50 text-sm font-medium">
            <div className="flex items-center gap-6 text-[#FDFBF7] mb-6 md:mb-0">
               <span className="text-3xl font-bold tracking-tighter">Hippocampus</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" /> © 2026 Hippocampus Inc. L'IA au service de la médecine.
            </div>
          </div>
          
        </div>
      </footer>

    </div>
  );
};

export default Index;
