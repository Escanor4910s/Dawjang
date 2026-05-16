import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, Trophy, MessageSquare, CheckCircle2, Shield, PlayCircle, Menu, X, ArrowRight, Zap, BookOpen, FileText, Target, Activity, Microscope, HeartPulse, Stethoscope, LayoutDashboard, LogOut, Mail, Circle, User as UserIcon } from "lucide-react";
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

// Enhanced FadeIn with framer-motion
const FadeIn = ({ children, delay = 0, className = "", yOffset = 30, scale = 1 }: any) => (
  <motion.div
    initial={{ opacity: 0, y: yOffset, scale: scale }}
    whileInView={{ opacity: 1, y: 0, scale: 1 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

// Floating element for decorative icons
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

const Index = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  
  // Parallax scroll effect for hero background
  const { scrollY } = useScroll();
  const yHeroWire = useTransform(scrollY, [0, 1000], [0, 300]);
  const yFloating1 = useTransform(scrollY, [0, 1000], [0, -150]);
  const yFloating2 = useTransform(scrollY, [0, 1000], [0, -250]);

  useEffect(() => {
    document.title = "Hippocampus - Révise plus intelligemment";
    
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    
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
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground font-sans overflow-x-hidden">
      
      {/* HEADER — Floating dark pill navbar */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-500 ${scrolled ? 'pt-2' : 'pt-4'}`}
      >
        <div className={`flex items-center justify-between gap-2 transition-all duration-500 ${scrolled ? 'w-[95%] max-w-6xl px-4 py-2.5 rounded-full bg-[#1A1A1A]/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.35)] border border-white/[0.06]' : 'w-[92%] max-w-5xl px-6 py-3.5 rounded-full bg-[#1A1A1A] shadow-[0_10px_40px_rgba(0,0,0,0.25)] border border-white/[0.08]'}`}>
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <img src="/favicon.png" alt="Hippocampus Logo" className="w-8 h-8 object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-md" />
            <span className="font-bold text-lg tracking-tight text-white group-hover:text-primary transition-colors duration-300">Hippocampus</span>
          </Link>
          
          {/* Center Navigation */}
          <div className="hidden md:flex items-center gap-1 text-[13px] font-semibold">
            <a href="#features" className="px-4 py-2 rounded-full text-white/65 hover:text-white hover:bg-white/[0.08] transition-all duration-300">Produit</a>
            <a href="#how" className="px-4 py-2 rounded-full text-white/65 hover:text-white hover:bg-white/[0.08] transition-all duration-300">Pour qui ?</a>
            <Link to="/pricing" className="px-4 py-2 rounded-full text-white/65 hover:text-white hover:bg-white/[0.08] transition-all duration-300">Tarifs</Link>
            <Link to="/community" className="px-4 py-2 rounded-full text-white/65 hover:text-white hover:bg-white/[0.08] transition-all duration-300">Communauté</Link>
          </div>
          
          {/* Right side CTA */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/dashboard" className="text-[13px] font-bold bg-[#FAF8F5] text-[#1A1A1A] px-5 py-2.5 rounded-full hover:bg-white hover:shadow-[0_0_20px_rgba(250,248,245,0.3)] hover:scale-105 transition-all duration-300 flex items-center gap-2">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Dashboard
                </Link>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 outline-none">
                      <div className="relative">
                        <Avatar className="w-9 h-9 border-2 border-white/20 hover:border-primary/50 transition-colors">
                          <AvatarImage src={avatarUrl || user.user_metadata?.avatar_url} />
                          <AvatarFallback className="bg-primary/20 text-white text-xs font-bold">{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
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
                    <DropdownMenuItem asChild className="focus:bg-white/10 focus:text-white rounded-xl cursor-pointer py-2">
                      <Link to="/dashboard" className="flex items-center gap-2 w-full">
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Tableau de bord</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={handleLogout} className="focus:bg-destructive/20 focus:text-destructive rounded-xl cursor-pointer py-2 text-destructive">
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
                <Link to="/auth" className="text-[13px] font-bold bg-[#FAF8F5] text-[#1A1A1A] px-5 py-2.5 rounded-full hover:bg-white hover:shadow-[0_0_20px_rgba(250,248,245,0.3)] hover:scale-105 transition-all duration-300 flex items-center gap-2">
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
              className={`p-2 rounded-full transition-all duration-300 ${isMobileMenuOpen ? 'text-black bg-black/5' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
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

              <a href="#features" onClick={() => setIsMobileMenuOpen(false)} 
                 className="group flex items-center justify-between py-4 px-6 rounded-[1.8rem] bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-all duration-300">
                <span className="text-lg font-bold">Produit</span>
                <Brain className="w-5 h-5 opacity-50 group-hover:scale-110 transition-transform" />
              </a>
              
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
                     className="group flex items-center justify-between py-5 px-6 rounded-[1.8rem] bg-black text-white shadow-xl shadow-black/20 hover:scale-[1.02] transition-all duration-300 mt-2">
                    <span className="text-lg font-bold">Aller au Dashboard</span>
                    <LayoutDashboard className="w-5 h-5" />
                  </Link>
                  
                  <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} 
                     className="flex items-center justify-center gap-2 py-4 px-6 rounded-[1.8rem] border border-red-200 text-red-600 hover:bg-red-50 transition-all duration-300 mt-4">
                    <LogOut className="w-5 h-5" />
                    <span className="font-bold">Déconnexion</span>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 bg-[#FCFBF7]">
        
        {/* HERO SECTION - WisprFlow Style */}
        <section className="px-6 flex flex-col items-center text-center max-w-5xl mx-auto relative pt-32 pb-32">
          {/* WisprFlow style watermark / squiggly line */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[120%] max-w-[1400px] h-[600px] opacity-[0.06] pointer-events-none z-0">
            <svg viewBox="0 0 1440 600" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <path d="M-100 400 C 200 400, 300 100, 700 200 S 1000 500, 1500 300" stroke="#1A1C1B" strokeWidth="6" strokeDasharray="12 12" fill="none"/>
              <path d="M-50 150 C 400 0, 500 500, 900 400 S 1200 100, 1550 200" stroke="#1A1C1B" strokeWidth="3" fill="none"/>
            </svg>
          </div>

          <FadeIn scale={0.95} className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 bg-white/50 backdrop-blur-md mb-8 shadow-sm">
              <Sparkles className="w-4 h-4 text-[#FF8A65]" />
              <span className="text-sm font-semibold text-[#1A1C1B]">L'IA de révision médicale par excellence</span>
            </div>
          </FadeIn>

          <FadeIn delay={0.1} yOffset={40} className="relative z-10">
            <h1 className="text-6xl md:text-[5.5rem] lg:text-[7.5rem] font-serif font-medium tracking-tighter leading-[1.0] mb-6 text-[#1A1C1B]">
              Ne bachotez plus,<br />
              <span className="italic font-light text-primary">assimilez simplement.</span>
            </h1>
          </FadeIn>
          
          <FadeIn delay={0.2} className="relative z-10">
            <p className="text-xl md:text-2xl text-[#1A1C1B]/60 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
              La plateforme d'apprentissage qui transforme vos cours en 
              connaissances à vie. <br className="hidden md:block" /> Conçue pour les étudiants exigeants.
            </p>
          </FadeIn>
          
          <FadeIn delay={0.3} className="relative z-10 flex w-full max-w-md mx-auto">
            <div className="w-full p-2 bg-white rounded-full border border-black/10 shadow-xl flex items-center justify-between pl-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300">
              <span className="text-[#1A1C1B]/50 font-medium">Commencer avec Hippocampus...</span>
              <Button asChild className="rounded-full bg-[#1A1C1B] text-white hover:bg-black px-8 h-12 text-base font-bold shadow-md hover:scale-105 transition-transform">
                <Link to="/auth">Démarrer</Link>
              </Button>
            </div>
          </FadeIn>

          {/* Hero App Mockup */}
          <FadeIn delay={0.4} yOffset={60} className="mt-20 relative w-full max-w-4xl mx-auto z-20">
            <div className="rounded-[2rem] p-4 bg-white border border-black/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.15)] relative">
              {/* Fake UI */}
              <div className="bg-[#FCFBF7] rounded-[1.5rem] p-12 min-h-[350px] flex items-center justify-center border border-black/5">
                <div className="flex flex-col items-center gap-6">
                  <div className="flex gap-3 mb-4 h-16 items-center">
                    {[0,1,2,3,4].map((i) => (
                      <motion.div 
                        key={i}
                        animate={{ height: ['20%', '100%', '20%'] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                        className={`w-3 rounded-full ${i === 2 ? 'bg-primary' : 'bg-[#1A1C1B]'}`}
                      />
                    ))}
                  </div>
                  <h3 className="font-serif text-3xl font-bold text-[#1A1C1B]">L'Agent MOR analyse vos cours...</h3>
                </div>
              </div>
            </div>
            
            {/* Floating Badges */}
            <motion.div style={{ y: yFloating1 }} className="absolute -left-12 top-20 bg-white p-4 rounded-2xl shadow-xl border border-black/5 rotate-[-12deg]">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg"><CheckCircle2 className="w-6 h-6 text-green-600" /></div>
                <div><p className="font-bold text-[#1A1C1B] text-sm">Anatomie validée</p><p className="text-xs text-[#1A1C1B]/50">Score: 19/20</p></div>
              </div>
            </motion.div>
            <motion.div style={{ y: yFloating2 }} className="absolute -right-8 bottom-10 bg-white p-4 rounded-2xl shadow-xl border border-black/5 rotate-[12deg]">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg"><Zap className="w-6 h-6 text-blue-600" /></div>
                <div><p className="font-bold text-[#1A1C1B] text-sm">Cas Clinique prêt</p><p className="text-xs text-[#1A1C1B]/50">Généré en 2s</p></div>
              </div>
            </motion.div>
          </FadeIn>
        </section>

        {/* DARK BLACK SECTION - Features (Wispr Style) */}
        <section id="features" className="bg-[#151515] text-[#FCFBF7] mx-4 md:mx-8 px-6 py-32 rounded-[3rem] md:rounded-[4rem] relative overflow-hidden mt-6">
          {/* Subtle watermark in dark section */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxIiBmaWxsPSJub25lIj48cGF0aCBkPSJNMCA0MGw0MCAtNDBNMCAwbDQwIDQwIiBvcGFjaXR5PSIwIi8+PHBhdGggZD0iTTQwIDB2NDBoLTQwdi00MHoiLz48L2c+PC9zdmc+')] [mask-image:radial-gradient(ellipse_at_center,black,transparent)]" />
          
          <div className="max-w-6xl mx-auto">
            <FadeIn className="text-center mb-24">
              <h2 className="text-5xl md:text-[5.5rem] font-serif mb-6 leading-tight font-medium">
                Conçu pour votre <br /><i className="font-light text-primary-glow">façon de réviser</i>
              </h2>
              <p className="text-xl text-[#FCFBF7]/60 max-w-2xl mx-auto">
                Des QCMs sur mesure, un algorithme de répétition espacée redoutable et un tuteur IA toujours à l'écoute.
              </p>
            </FadeIn>

            <div className="grid md:grid-cols-2 gap-8">
               <FadeIn yOffset={30} className="bg-[#1C1C1C] border border-white/5 rounded-[2.5rem] p-12 hover:bg-[#202020] transition-colors relative group overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] group-hover:bg-primary/20 transition-all" />
                 <h3 className="text-4xl font-serif mb-4 relative z-10">Mémoire infinie</h3>
                 <p className="text-lg text-white/60 mb-12 relative z-10">L'algorithme SM-2 vous interroge au moment exact où vous alliez oublier.</p>
                 <div className="bg-[#151515] p-6 rounded-3xl border border-white/10 mt-auto relative z-10 shadow-2xl group-hover:-translate-y-4 transition-transform duration-500">
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-center"><span className="text-sm font-bold text-white/50">Prochaine révision</span><span className="text-primary font-bold">Dans 3 jours</span></div>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-primary w-2/3" /></div>
                    </div>
                 </div>
               </FadeIn>

               <FadeIn yOffset={30} delay={0.2} className="bg-[#1C1C1C] border border-white/5 rounded-[2.5rem] p-12 hover:bg-[#202020] transition-colors relative group overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-[80px] group-hover:bg-rose-500/20 transition-all" />
                 <h3 className="text-4xl font-serif mb-4 relative z-10">Annales générées</h3>
                 <p className="text-lg text-white/60 mb-12 relative z-10">Des milliers de cas cliniques et de QCM générés à partir de vos supports.</p>
                 <div className="bg-[#151515] p-6 rounded-3xl border border-white/10 mt-auto relative z-10 shadow-2xl group-hover:-translate-y-4 transition-transform duration-500">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-rose-500/20 rounded-2xl flex items-center justify-center"><BookOpen className="text-rose-400 w-6 h-6" /></div>
                      <div>
                        <div className="font-bold">Cas clinique Cardiologie</div>
                        <div className="text-white/40 text-sm">Généré en 2s</div>
                      </div>
                    </div>
                 </div>
               </FadeIn>
            </div>
          </div>
        </section>

        {/* GREEN SECTION - Video (Kept exactly as requested, adapted to Wispr colors) */}
        <section className="bg-[#0D382B] text-[#FCFBF7] mx-4 md:mx-8 px-6 py-32 rounded-[3rem] md:rounded-[4rem] relative overflow-hidden mt-6">
          {/* Subtle noise/texture overlay for the green section */}
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJub2lzZUZpbHRlciI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuNjUiIG51bU9jdGF2ZXM9IjMiIHN0aXRjaFRpbGVzPSJzdGl0Y2giLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWx0ZXI9InVybCgibm9pc2VGaWx0ZXIpIi8+PC9zdmc+')]"></div>
          
          <div className="max-w-4xl mx-auto text-center mb-16 relative z-10">
            <FadeIn>
              <h2 className="text-5xl md:text-[5.5rem] font-serif mb-6 leading-tight">
                4 fois plus rapide<br /><span className="italic font-light">que la lecture</span>
              </h2>
              <p className="text-xl md:text-2xl text-white/70 max-w-2xl mx-auto font-medium">
                Découvrez comment l'IA change drastiquement la manière dont les étudiants assimilent leurs cours.
              </p>
            </FadeIn>
          </div>

          <FadeIn delay={0.3} yOffset={50} className="max-w-5xl mx-auto relative z-10 mt-16">
            <motion.div 
              whileHover={{ y: -10 }}
              className="aspect-video bg-black/60 rounded-[2.5rem] overflow-hidden border border-white/20 backdrop-blur-md flex items-center justify-center relative shadow-2xl"
            >
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center opacity-30 mix-blend-overlay transition-opacity duration-700 hover:opacity-50" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D382B] to-transparent opacity-80" />
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="w-24 h-24 bg-[#FCFBF7] backdrop-blur-sm rounded-full flex items-center justify-center text-[#0D382B] shadow-[0_0_40px_rgba(255,255,255,0.2)] relative z-20"
              >
                <PlayCircle className="w-12 h-12 ml-1" />
              </motion.button>
            </motion.div>
          </FadeIn>
        </section>

        {/* POUR QUI SECTION (How/Who) */}
        <section id="how" className="py-32 px-6 max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-[1fr_1.5fr] gap-16 items-center">
            <FadeIn>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 bg-white/50 backdrop-blur-md mb-8 shadow-sm">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-[#1A1C1B]">Pour qui ?</span>
              </div>
              <h2 className="text-5xl md:text-6xl font-serif leading-tight mb-6 text-[#1A1C1B]">
                Conçu pour les <br /><span className="italic text-primary">générations futures</span>
              </h2>
              <p className="text-xl text-[#1A1C1B]/60 font-medium max-w-md">
                Peu importe votre année, Hippocampus s'adapte à votre programme et à vos lacunes pour vous propulser vers la réussite.
              </p>
            </FadeIn>

            <div className="grid sm:grid-cols-2 gap-6">
              <FadeIn delay={0.1} className="bg-white p-8 rounded-[2rem] border border-black/5 shadow-xl hover:-translate-y-2 transition-transform duration-300">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-[#1A1C1B]">PASS / L.A.S</h3>
                <p className="text-[#1A1C1B]/60 font-medium">Générez des QCMs à l'infini sur des détails précis. Le par cœur n'aura jamais été aussi rapide et efficace.</p>
              </FadeIn>
              
              <FadeIn delay={0.2} className="bg-white p-8 rounded-[2rem] border border-black/5 shadow-xl hover:-translate-y-2 transition-transform duration-300">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-[#1A1C1B]">Externat (EDN)</h3>
                <p className="text-[#1A1C1B]/60 font-medium">L'IA génère des cas cliniques complexes avec une correction détaillée. Révisez entre deux gardes.</p>
              </FadeIn>

              <FadeIn delay={0.3} className="bg-white p-8 rounded-[2rem] border border-black/5 shadow-xl hover:-translate-y-2 transition-transform duration-300">
                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                  <Microscope className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-[#1A1C1B]">Pharmacie</h3>
                <p className="text-[#1A1C1B]/60 font-medium">Pharmacologie, chimie, biochimie. L'IA maîtrise toutes vos matières scientifiques complexes.</p>
              </FadeIn>

              <FadeIn delay={0.4} className="bg-white p-8 rounded-[2rem] border border-black/5 shadow-xl hover:-translate-y-2 transition-transform duration-300">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                  <Brain className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-[#1A1C1B]">Professeurs</h3>
                <p className="text-[#1A1C1B]/60 font-medium">Transformez un PDF de cours en un test blanc complet en quelques secondes pour vos étudiants.</p>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* WISPR LOVE LETTERS (Testimonials) */}
        <section className="py-40 bg-[#FCFBF7] relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1000px] h-full opacity-[0.05] pointer-events-none z-0">
            <svg viewBox="0 0 1000 600" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <path d="M-100 300 C 300 0, 700 600, 1100 300" stroke="#1A1C1B" strokeWidth="8" strokeDasharray="15 15" fill="none"/>
            </svg>
          </div>

          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <FadeIn className="text-center mb-24">
              <h2 className="text-5xl md:text-[6rem] font-serif text-[#1A1C1B] leading-tight mb-6">
                Love letters to <br /><span className="italic">Hippocampus</span>
              </h2>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { name: "Julie M.", role: "Externat D2", text: "Je ne passe plus des heures à faire des fiches. L'IA génère les flashcards instantanément. Un gain de temps énorme pour mes gardes." },
                { name: "Thomas L.", role: "PACES", text: "La fonction tuteur est bluffante. Quand je me trompe, l'explication est claire et me permet de comprendre mon erreur." },
                { name: "Sarah K.", role: "Interne", text: "Idéal pour réviser rapidement. Les questions sont du niveau exigé aux ECNi et s'adaptent à mes lacunes." }
              ].map((t, i) => (
                <FadeIn key={i} delay={0.1 * i} yOffset={40} className="bg-white border border-black/5 p-10 rounded-[2rem] hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-[#1A1C1B] rounded-full flex items-center justify-center text-white font-serif font-bold text-lg">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-[#1A1C1B]">{t.name}</div>
                      <div className="text-sm text-[#1A1C1B]/50 font-medium">{t.role}</div>
                    </div>
                  </div>
                  <p className="text-lg text-[#1A1C1B]/80 font-medium leading-relaxed">"{t.text}"</p>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* WISPR FOOTER */}
        <footer className="bg-[#1A1C1B] text-[#FCFBF7] pt-40 pb-20 px-6 rounded-t-[4rem] md:rounded-t-[5rem] mt-[-50px] relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.2)]">
          <div className="max-w-7xl mx-auto">
            
            <FadeIn className="flex flex-col items-center text-center mb-40">
              <h2 className="text-6xl md:text-[7rem] lg:text-[8.5rem] font-serif font-medium tracking-tighter leading-[1.0] mb-12">
                Commencez à <br /><span className="italic font-light text-primary-glow">réussir...</span>
              </h2>
              <div className="w-full max-w-lg bg-white/10 p-3 rounded-full border border-white/20 flex items-center justify-between pl-8 backdrop-blur-md">
                <span className="text-white/60 font-medium text-lg">Rejoindre l'aventure</span>
                <Button asChild className="rounded-full bg-white text-[#1A1C1B] hover:bg-gray-200 px-10 h-14 text-lg font-bold shadow-xl hover:scale-105 transition-transform">
                  <Link to="/auth">Créer un compte</Link>
                </Button>
              </div>
            </FadeIn>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-16 border-b border-white/10 pb-16 mb-12">
              {/* Massive Logo Animation (Audio wave) */}
              <div className="flex flex-col md:flex-row md:items-end gap-6">
                <div className="flex gap-2.5 h-20 items-end pb-2">
                  {[...Array(5)].map((_, i) => (
                    <motion.div 
                      key={i} 
                      animate={{ height: ["20%", "100%", "20%"] }}
                      transition={{ 
                        duration: 1.2, 
                        repeat: Infinity, 
                        delay: i * 0.15,
                        ease: "easeInOut"
                      }}
                      className={`w-5 rounded-full ${i === 2 ? 'bg-primary' : 'bg-[#FCFBF7]'}`} 
                    />
                  ))}
                </div>
                <span className="text-5xl md:text-[7rem] font-serif font-bold tracking-tighter leading-none">
                  Hippocampus
                </span>
              </div>
              
              <div className="flex gap-16 text-lg font-medium">
                <div className="flex flex-col gap-4">
                  <span className="text-white/30 text-sm font-bold uppercase tracking-widest mb-2">Produit</span>
                  <Link to="/" className="hover:text-primary transition-colors">Accueil</Link>
                  <Link to="/pricing" className="hover:text-primary transition-colors">Tarifs</Link>
                </div>
                <div className="flex flex-col gap-4">
                  <span className="text-white/30 text-sm font-bold uppercase tracking-widest mb-2">Légal</span>
                  <Link to="/privacy" className="hover:text-primary transition-colors">Confidentialité</Link>
                  <Link to="/terms" className="hover:text-primary transition-colors">Conditions</Link>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between text-white/30 font-medium">
              <div>© 2026 Hippocampus Inc. Tous droits réservés.</div>
              <div className="flex gap-6 mt-4 md:mt-0">
                <a href="#" className="hover:text-white transition-colors">Twitter</a>
                <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
                <a href="#" className="hover:text-white transition-colors">Instagram</a>
              </div>
            </div>
            
          </div>
        </footer>

      </main>
    </div>
  );
};

export default Index;
