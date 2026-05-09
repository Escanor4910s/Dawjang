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
            <span className="font-bold text-lg tracking-tight text-white group-hover:text-primary transition-colors duration-300">Hippocampus.</span>
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

      <main className="relative z-10 pt-32 pb-20 bg-doodle-watermark">
        
        {/* HERO SECTION */}
        <section className="px-6 flex flex-col items-center text-center max-w-5xl mx-auto relative pt-10 pb-20 rounded-[3rem]">
          {/* Decorative floating icons */}
          <motion.div style={{ y: yFloating1 }} className="absolute hidden md:block top-10 left-10 text-primary opacity-60">
             <FloatingElement delay={0} yOffset={15} duration={5}>
               <div className="p-4 bg-background rounded-2xl shadow-xl border border-border rotate-[-12deg]"><Stethoscope className="w-8 h-8" /></div>
             </FloatingElement>
          </motion.div>
          <motion.div style={{ y: yFloating2 }} className="absolute hidden md:block top-32 right-10 text-[#FF8A65] opacity-60">
             <FloatingElement delay={1} yOffset={20} duration={6}>
               <div className="p-4 bg-background rounded-2xl shadow-xl border border-border rotate-[15deg]"><HeartPulse className="w-8 h-8" /></div>
             </FloatingElement>
          </motion.div>
          
          <FadeIn scale={0.95}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-foreground/10 bg-background/50 backdrop-blur-md mb-8 shadow-sm">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
              <span className="text-sm font-semibold text-foreground/80">L'IA médicale nouvelle génération</span>
            </div>
          </FadeIn>

          <FadeIn delay={0.1} yOffset={40}>
            <h1 className="text-6xl md:text-[5.5rem] lg:text-[6.5rem] font-serif font-medium tracking-tight leading-[1.02] mb-6 text-foreground">
              L'intelligence artificielle au service de votre <span className="text-transparent bg-clip-text bg-gradient-text italic">réussite</span> médicale.
            </h1>
          </FadeIn>
          
          <FadeIn delay={0.2}>
            <p className="text-lg md:text-xl text-foreground/60 max-w-2xl mx-auto mb-10 font-medium">
              Générez vos propres QCM, analysez vos cas cliniques et ancrer vos connaissances à long terme, le tout à partir de vos propres documents.
            </p>
          </FadeIn>
          
          <FadeIn delay={0.3} className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto z-10">
            <Button asChild size="lg" className="w-full sm:w-auto rounded-full h-14 px-10 text-lg bg-primary text-primary-foreground hover:bg-foreground hover:text-background font-bold shadow-[0_10px_30px_rgba(235,223,255,0.6)] hover:shadow-[0_10px_35px_rgba(0,0,0,0.2)] transition-all duration-300 hover:scale-105 hover:-translate-y-1">
              <Link to="/auth">Propulser mes révisions <ArrowRight className="ml-2 w-5 h-5" /></Link>
            </Button>
          </FadeIn>

          {/* Abstract Wire/Line Decoration */}
          <motion.div style={{ y: yHeroWire }} className="absolute top-[60%] left-0 w-full h-[2px] -z-10 opacity-[0.08] pointer-events-none">
            <svg viewBox="0 0 1000 200" className="w-full h-[300px]" preserveAspectRatio="none">
              <path d="M0,100 C200,300 800,-100 1000,100" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="10,10" />
              <path d="M0,150 C300,50 700,250 1000,150" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5,15" />
            </svg>
          </motion.div>
        </section>

        {/* DARK SECTION 1 (Black) */}
        <section id="features" className="mt-10 bg-section-dark text-section-dark-foreground rounded-[2.5rem] md:rounded-[4rem] mx-4 md:mx-8 px-6 py-24 md:py-32 relative overflow-hidden group">
          {/* Subtle animated background gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(235,223,255,0.05),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          
          <div className="max-w-5xl mx-auto relative z-10 flex flex-col md:flex-row items-center justify-between gap-16">
            <FadeIn className="md:w-1/2">
              <h2 className="text-4xl md:text-6xl font-serif mb-8 leading-tight">
                Révise plus vite,<br />dans toutes<br />tes matières.
              </h2>
              <ul className="space-y-5 text-section-dark-foreground/70 text-lg md:text-xl font-medium">
                <motion.li whileHover={{ x: 10 }} className="flex items-center gap-4 cursor-default">
                  <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(235,223,255,0.5)]" /> Anatomie & Physiologie
                </motion.li>
                <motion.li whileHover={{ x: 10 }} className="flex items-center gap-4 cursor-default">
                  <div className="w-3 h-3 rounded-full bg-[#FFD4A3] shadow-[0_0_10px_rgba(255,212,163,0.5)]" /> Pharmacologie
                </motion.li>
                <motion.li whileHover={{ x: 10 }} className="flex items-center gap-4 cursor-default">
                  <div className="w-3 h-3 rounded-full bg-[#A3FFD4] shadow-[0_0_10px_rgba(163,255,212,0.5)]" /> Cas cliniques ECNi
                </motion.li>
              </ul>
            </FadeIn>
            <FadeIn delay={0.2} scale={0.9} className="md:w-1/2 relative">
              {/* Main Mockup visual */}
              <motion.div 
                whileHover={{ rotate: 0, scale: 1.05 }}
                className="bg-[#1A1A1A] border border-white/10 rounded-3xl p-6 shadow-2xl rotate-3 transition-all duration-500 relative z-10"
              >
                 <div className="flex items-center gap-4 mb-6 border-b border-white/10 pb-5">
                   <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                     <Brain className="w-6 h-6 text-primary" />
                   </div>
                   <div>
                     <div className="font-bold text-lg">Génération en cours...</div>
                     <div className="text-sm text-white/50">Cardiologie - Chapitre 4</div>
                   </div>
                 </div>
                 <div className="space-y-4">
                   <div className="h-5 bg-white/5 rounded-lg w-3/4 animate-pulse" />
                   <div className="h-5 bg-white/5 rounded-lg w-1/2 animate-pulse" />
                   <div className="h-5 bg-white/5 rounded-lg w-5/6 animate-pulse" />
                 </div>
              </motion.div>
              
              {/* Floating icons with Framer Motion */}
              <FloatingElement delay={0} yOffset={15} duration={4} className="-top-10 -right-10 z-20">
                <div className="w-16 h-16 bg-blue-500 rounded-3xl flex items-center justify-center shadow-2xl rotate-12 backdrop-blur-md bg-opacity-90 border border-white/20">
                  <FileText className="text-white w-7 h-7" />
                </div>
              </FloatingElement>
              
              <FloatingElement delay={1.5} yOffset={20} duration={5} className="-bottom-8 -left-8 z-20">
                <div className="w-16 h-16 bg-rose-500 rounded-3xl flex items-center justify-center shadow-2xl -rotate-12 backdrop-blur-md bg-opacity-90 border border-white/20">
                  <BookOpen className="text-white w-7 h-7" />
                </div>
              </FloatingElement>
              
              <FloatingElement delay={0.8} yOffset={10} duration={3} className="bottom-20 -right-12 z-0 opacity-50">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-2xl rotate-45 backdrop-blur-md bg-opacity-90">
                  <Activity className="text-primary-foreground w-6 h-6" />
                </div>
              </FloatingElement>
            </FadeIn>
          </div>
        </section>

        {/* GREEN SECTION */}
        <section className="bg-secondary text-secondary-foreground mt-6 rounded-[2.5rem] md:rounded-[4rem] mx-4 md:mx-8 px-6 py-24 md:py-32 relative overflow-hidden group">
          {/* Subtle noise/texture overlay for the green section */}
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJub2lzZUZpbHRlciI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuNjUiIG51bU9jdGF2ZXM9IjMiIHN0aXRjaFRpbGVzPSJzdGl0Y2giLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWx0ZXI9InVybCgibm9pc2VGaWx0ZXIpIi8+PC9zdmc+')]"></div>
          
          <div className="max-w-4xl mx-auto text-center mb-16 relative z-10">
            <FadeIn>
              <h2 className="text-5xl md:text-[5rem] font-serif mb-6 leading-tight text-white drop-shadow-md">
                4 fois plus rapide<br />pour retenir
              </h2>
              <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto font-medium">
                L'IA analyse tes documents et génère instantanément des questions adaptées à ton niveau.
              </p>
            </FadeIn>
            <FadeIn delay={0.2} className="mt-10">
              <Button asChild className="rounded-full bg-primary text-primary-foreground hover:bg-white hover:text-black font-bold shadow-[0_10px_30px_rgba(0,0,0,0.2)] px-10 h-14 text-lg hover:scale-105 transition-all">
                <Link to="/auth">Voir comment ça marche</Link>
              </Button>
            </FadeIn>
          </div>

          <FadeIn delay={0.3} yOffset={50} className="max-w-5xl mx-auto relative z-10 mt-20">
            <motion.div 
              whileHover={{ y: -10 }}
              className="aspect-video bg-black/40 rounded-[2.5rem] overflow-hidden border border-white/20 backdrop-blur-md flex items-center justify-center relative shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
            >
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center opacity-40 mix-blend-overlay transition-opacity duration-700 hover:opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-t from-secondary/80 to-transparent" />
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="w-24 h-24 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-secondary shadow-2xl relative z-20 border border-white/50"
              >
                <PlayCircle className="w-10 h-10 ml-1" />
              </motion.button>
            </motion.div>
          </FadeIn>
        </section>

        {/* DARK BENTO BOX SECTION */}
        <section className="mt-6 bg-section-dark text-section-dark-foreground rounded-[2.5rem] md:rounded-[4rem] mx-4 md:mx-8 px-6 py-24 md:py-32 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiPjxwaGF0aCBkPSJNMCA0MGw0MCAtNDBNMCAwbDQwIDQwIiBvcGFjaXR5PSIwIi8+PHBhdGggZD0iTTQwIDB2NDBoLTQwdi00MHoiLz48L2c+PC9zdmc+')] [mask-image:linear-gradient(to_bottom,black,transparent)]">
          <div className="max-w-6xl mx-auto">
            <FadeIn className="mb-20">
              <h2 className="text-5xl md:text-[4rem] font-serif max-w-2xl leading-tight mb-6">
                Fait pour ta façon de travailler
              </h2>
              <p className="text-section-dark-foreground/60 text-xl md:text-2xl font-medium max-w-xl">Adapte l'IA à tes besoins spécifiques en médecine et pharmacie.</p>
            </FadeIn>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Card 1 */}
              <FadeIn delay={0.1} yOffset={40} className="bg-[#1A1A1A] rounded-[2.5rem] p-10 md:p-12 flex flex-col justify-between min-h-[400px] border border-white/5 relative overflow-hidden group hover:border-primary/30 transition-colors duration-500 shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] group-hover:bg-primary/10 transition-colors duration-700" />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-bold mb-8">
                    <Zap className="w-4 h-4" /> Mode Examen
                  </div>
                  <h3 className="text-3xl font-bold mb-5">Questions précises</h3>
                  <p className="text-section-dark-foreground/60 text-lg md:text-xl leading-relaxed">
                    Choisis le type de questions : QCM à choix unique, multiples, QROC ou cas cliniques longs.
                  </p>
                </div>
                {/* Decorative element */}
                <div className="absolute bottom-0 right-0 p-8 translate-y-12 group-hover:translate-y-0 transition-all duration-500 opacity-50 group-hover:opacity-100">
                  <div className="flex gap-3">
                    <span className="px-5 py-3 bg-[#2A2A2A] rounded-2xl border border-white/10 font-bold shadow-xl">QCU</span>
                    <span className="px-5 py-3 bg-[#2A2A2A] rounded-2xl border border-white/10 font-bold shadow-xl">QCM</span>
                  </div>
                </div>
              </FadeIn>

              {/* Card 2 */}
              <FadeIn delay={0.2} yOffset={40} className="bg-[#1A1A1A] rounded-[2.5rem] p-10 md:p-12 flex flex-col justify-between min-h-[400px] border border-white/5 relative overflow-hidden group hover:border-[#FFD4A3]/30 transition-colors duration-500 shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFD4A3]/5 rounded-full blur-[80px] group-hover:bg-[#FFD4A3]/10 transition-colors duration-700" />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFD4A3]/10 text-[#FFD4A3] border border-[#FFD4A3]/20 text-sm font-bold mb-8">
                    <MessageSquare className="w-4 h-4" /> Tuteur MOR
                  </div>
                  <h3 className="text-3xl font-bold mb-5">Explications ciblées</h3>
                  <p className="text-section-dark-foreground/60 text-lg md:text-xl leading-relaxed">
                    Un doute ? Notre tuteur t'explique exactement pourquoi une réponse est fausse, avec bienveillance.
                  </p>
                </div>
                {/* Decorative element */}
                <div className="absolute -bottom-4 right-10 bg-[#2A2A2A] p-5 rounded-2xl border border-white/10 shadow-2xl group-hover:-translate-y-6 transition-all duration-500 rotate-3 group-hover:rotate-0">
                  <div className="flex gap-3 items-center">
                    <div className="w-8 h-8 rounded-full bg-[#FFD4A3]/20 flex items-center justify-center"><Sparkles className="w-4 h-4 text-[#FFD4A3]" /></div>
                    <p className="text-sm font-medium">"Ici, c'est l'artère radiale car..."</p>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* CREAM BENTO SECTION with Doodle Watermark */}
        <section id="how" className="py-32 px-6 max-w-6xl mx-auto bg-doodle-watermark relative rounded-[4rem] mt-6 overflow-hidden">
          {/* Animated background gradient to add some life to the cream background */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
          
          <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-center relative z-10">
            <FadeIn yOffset={40} scale={0.95}>
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-[2.5rem] p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] border border-border relative group"
              >
                <motion.div 
                  animate={{ rotate: [6, 10, 6] }}
                  transition={{ repeat: Infinity, duration: 4 }}
                  className="absolute -top-8 -right-8 bg-primary text-primary-foreground p-5 rounded-[1.5rem] font-serif text-3xl font-bold shadow-xl border border-primary-foreground/10"
                >
                  100% IA
                </motion.div>
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-border pb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-muted rounded-xl"><Trophy className="w-6 h-6 text-foreground/70" /></div>
                      <span className="font-semibold text-foreground/70 text-lg">Score récent</span>
                    </div>
                    <span className="font-black text-success text-3xl">18/20</span>
                  </div>
                  <div className="pt-4">
                    <div className="w-full bg-muted rounded-full h-3 mb-4 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        whileInView={{ width: "90%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                        className="bg-primary h-full rounded-full" 
                      />
                    </div>
                    <p className="text-base text-foreground/60 font-medium">Maîtrise du module de neurologie excellente.</p>
                  </div>
                </div>
              </motion.div>
            </FadeIn>
            
            <FadeIn delay={0.2} className="space-y-8">
              <div className="inline-flex p-4 bg-secondary/10 rounded-2xl text-secondary shadow-sm">
                <Target className="w-10 h-10" />
              </div>
              <h2 className="text-5xl font-serif leading-tight">Suivi de progression</h2>
              <p className="text-xl text-foreground/70 leading-relaxed font-medium">
                L'algorithme de répétition espacée repère tes points faibles et te les repropose au moment idéal pour ancrer la connaissance.
              </p>
              <Button asChild variant="link" className="text-primary font-bold px-0 text-xl hover:no-underline hover:text-primary-hover group">
                <Link to="/features" className="flex items-center">
                  Découvrir les statistiques <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-2 transition-transform" />
                </Link>
              </Button>
            </FadeIn>
          </div>
        </section>

        {/* PURPLE BANNER */}
        <section className="px-4 md:px-8 mt-6">
          <FadeIn className="bg-primary rounded-[3rem] md:rounded-[4rem] p-16 md:p-32 text-center relative overflow-hidden group">
            {/* Animated circles background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
               <motion.div 
                 animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                 transition={{ repeat: Infinity, duration: 8 }}
                 className="absolute -top-32 -left-32 w-96 h-96 bg-white rounded-full blur-3xl"
               />
               <motion.div 
                 animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
                 transition={{ repeat: Infinity, duration: 10, delay: 2 }}
                 className="absolute -bottom-32 -right-32 w-[30rem] h-[30rem] bg-white rounded-full blur-3xl"
               />
            </div>

            <div className="relative z-10">
              <h2 className="text-5xl md:text-6xl lg:text-[5rem] font-serif font-medium text-primary-foreground mb-8 leading-tight">
                Améliore ce que tu apprends
              </h2>
              <p className="text-primary-foreground/80 text-xl md:text-2xl max-w-3xl mx-auto mb-12 font-medium">
                Hippocampus s'adapte à ton rythme pour te garantir la réussite à tes examens médicaux.
              </p>
              <Button asChild size="lg" className="rounded-full h-16 px-12 text-lg bg-background text-foreground hover:bg-white font-bold shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:scale-105 hover:-translate-y-1 transition-all">
                <Link to="/auth">Créer un compte maintenant</Link>
              </Button>
            </div>
          </FadeIn>
        </section>

        {/* TESTIMONIALS (Black) */}
        <section className="mt-8 bg-section-dark text-section-dark-foreground rounded-t-[3rem] md:rounded-t-[4rem] mx-4 md:mx-8 px-6 py-32 mb-[-80px] pb-40 relative">
          <div className="max-w-7xl mx-auto relative z-10">
            <FadeIn>
              <div className="flex flex-col items-center mb-20">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm font-bold mb-6">
                  <HeartPulse className="w-4 h-4 text-rose-500" /> Ils adorent Hippocampus
                </div>
                <h2 className="text-5xl md:text-[4rem] font-serif text-center leading-tight">
                  Lettres d'amour à l'IA
                </h2>
              </div>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { name: "Julie M.", role: "Externat D2", text: "Je ne passe plus des heures à faire des fiches. L'IA génère les flashcards instantanément. Un gain de temps énorme." },
                { name: "Thomas L.", role: "PACES", text: "La fonction tuteur est bluffante. Quand je me trompe, l'explication est claire et me permet de comprendre mon erreur." },
                { name: "Sarah K.", role: "Interne", text: "Idéal pour réviser rapidement entre deux gardes. Les questions sont du niveau exigé aux ECNi." }
              ].map((t, i) => (
                <FadeIn key={i} delay={0.1 * i} yOffset={40} className="bg-white text-black p-10 rounded-[2rem] hover:-translate-y-2 transition-transform duration-300 shadow-xl relative group">
                  <div className="absolute top-8 right-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <MessageSquare className="w-12 h-12" />
                  </div>
                  <p className="text-xl font-medium mb-10 leading-relaxed relative z-10">"{t.text}"</p>
                  <div className="flex items-center gap-4 border-t border-black/5 pt-6 relative z-10">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-lg">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-lg">{t.name}</div>
                      <div className="text-sm text-foreground/60 font-medium">{t.role}</div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

      </main>

      {/* BIG FOOTER (Cream) */}
      <footer className="bg-background pt-40 pb-12 px-6 relative z-20 rounded-t-[3rem] md:rounded-t-[4rem] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-32 gap-16 border-b border-border pb-20">
            <div>
              <h2 className="text-6xl md:text-[6rem] lg:text-[7rem] font-serif font-medium tracking-tight mb-10 leading-[0.9]">
                Commence à <br /><span className="text-primary-foreground">réussir...</span>
              </h2>
              <Button asChild size="lg" className="rounded-full h-16 px-10 text-lg bg-primary text-primary-foreground hover:bg-primary-hover font-bold shadow-none hover:scale-105 transition-transform">
                <Link to="/auth">Démarrer maintenant <ArrowRight className="ml-3 w-5 h-5" /></Link>
              </Button>
            </div>
            
            <div className="flex gap-16 text-lg font-medium">
              <div className="flex flex-col gap-5">
                <span className="text-foreground/40 text-sm font-bold uppercase tracking-widest mb-2">Produit</span>
                <Link to="/" className="hover:text-primary transition-colors">Accueil</Link>
                <Link to="/pricing" className="hover:text-primary transition-colors">Tarifs</Link>
                <Link to="/auth" className="hover:text-primary transition-colors">Se connecter</Link>
              </div>
              <div className="flex flex-col gap-5">
                <span className="text-foreground/40 text-sm font-bold uppercase tracking-widest mb-2">Légal</span>
                <Link to="/privacy" className="hover:text-primary transition-colors">Confidentialité</Link>
                <Link to="/terms" className="hover:text-primary transition-colors">Conditions</Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-6">
               <div className="flex gap-2 group cursor-pointer">
                 {[...Array(5)].map((_, i) => (
                   <motion.div 
                     key={i} 
                     whileHover={{ y: -5 }}
                     transition={{ duration: 0.2 }}
                     className={`w-5 h-5 rounded-full ${i === 2 ? 'bg-primary' : 'bg-foreground'}`} 
                   />
                 ))}
               </div>
               <span className="text-4xl md:text-5xl font-bold tracking-tighter">Hippocampus</span>
            </div>
            <div className="mt-8 md:mt-0 flex items-center gap-2 text-foreground/40 font-medium">
              <Shield className="w-4 h-4" /> © 2026 Hippocampus Inc.
            </div>
          </div>
          
        </div>
      </footer>

    </div>
  );
};

export default Index;
