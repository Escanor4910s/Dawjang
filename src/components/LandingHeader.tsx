import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Menu, X, LogIn, LayoutDashboard, LogOut, ArrowRight, Brain, Sparkles } from "lucide-react";
import HippocampusLogo from "./HippocampusLogo";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";

const navLinks = [
  { label: "Le Produit", href: "#features" },
  { label: "Agent MOR", href: "#mor" },
  { label: "Tarification", href: "/pricing", route: true },
  { label: "Témoignages", href: "#testimonials" },
];

// --- ANIMATIONS CONFIGURATION ---
const menuVariants = {
  closed: { opacity: 0, y: "-100%", transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  open: { opacity: 1, y: "0%", transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.1, delayChildren: 0.2 } }
};

const itemVariants = {
  closed: { opacity: 0, y: 20 },
  open: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

const LandingHeader = ({ forceSolid = false }: { forceSolid?: boolean }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  // Bloquer le scroll de la page quand le menu mobile est ouvert
  useEffect(() => {
    if (isMobileMenuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isMobileMenuOpen]);

  const handleNavClick = (href: string, route?: boolean) => {
    setIsMobileMenuOpen(false);
    if (route) {
      navigate(href);
      return;
    }
    if (href.startsWith("#")) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      } else {
        navigate("/" + href);
      }
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Erreur lors de la déconnexion");
    else { 
      toast.success("Déconnexion réussie"); 
      setIsMobileMenuOpen(false);
      navigate("/");
    }
  };

  return (
    <>
      {/* ─── HEADER DESKTOP & BARRE DE NAVIGATION ─── */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
          isScrolled || forceSolid
            ? "bg-[#FDFBF7]/90 backdrop-blur-xl border-b border-[#0F3B2E]/10 shadow-[0_4px_30px_rgba(0,0,0,0.03)] py-2"
            : "bg-transparent py-4"
        }`}
      >
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex items-center justify-between h-14">
            
            {/* Logo */}
            <Link to="/" className="flex-shrink-0 group relative z-50">
              <HippocampusLogo size="sm" variant="default" className="group-hover:scale-105 transition-transform" />
            </Link>

            {/* Desktop Nav Links */}
            <nav className="hidden md:flex items-center gap-8 bg-white/50 backdrop-blur-md px-6 py-2 rounded-full border border-black/5 shadow-sm">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href, link.route)}
                  className="text-[13px] font-bold uppercase tracking-wider text-[#1A1A1A]/60 hover:text-[#0F3B2E] transition-colors relative group"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-1/2 w-0 h-0.5 bg-[#10B981] group-hover:w-full group-hover:left-0 transition-all duration-300 rounded-full" />
                </button>
              ))}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <Button onClick={() => navigate("/dashboard")} className="bg-[#0F3B2E] text-white hover:bg-[#1A1A1A] rounded-full px-6 h-11 text-xs font-bold uppercase tracking-widest shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
                  <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate("/auth")} className="text-xs font-bold uppercase tracking-widest h-11 px-4 hover:bg-black/5 text-[#1A1A1A]/70 hover:text-[#1A1A1A] rounded-full">
                    <LogIn className="h-4 w-4 mr-2" /> Connexion
                  </Button>
                  <Button onClick={() => navigate("/auth")} className="bg-[#0F3B2E] text-white hover:bg-[#1A1A1A] rounded-full px-6 h-11 text-xs font-bold uppercase tracking-widest shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
                    Démarrer
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle Button */}
            <button
              className="md:hidden relative z-50 p-2.5 bg-white border border-black/5 shadow-sm rounded-full text-[#1A1A1A] hover:bg-gray-50 transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <AnimatePresence mode="wait">
                {isMobileMenuOpen ? (
                  <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                    <X className="h-5 w-5" />
                  </motion.div>
                ) : (
                  <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                    <Menu className="h-5 w-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.header>

      {/* ─── MOBILE MENU OVERLAY (Le Niveau 60/60 Fait Main) ─── */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            variants={menuVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="fixed inset-0 z-40 bg-[#FDFBF7]/95 backdrop-blur-2xl md:hidden flex flex-col justify-between overflow-hidden"
          >
            {/* TEXTURES & FILIGRANES (Le "Student Canvas") */}
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none z-0" />
            
            {/* Le grand filigrane en arrière-plan */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: -5 }}
              transition={{ delay: 0.3, duration: 1 }}
              className="absolute -right-20 top-20 opacity-[0.02] pointer-events-none z-0"
            >
              <Brain className="w-[400px] h-[400px] text-[#0F3B2E]" />
            </motion.div>

            {/* HEADER DU MENU MOBILE */}
            <div className="pt-24 px-8 pb-4 relative z-10 flex flex-col h-full">
              
              {/* LIENS DE NAVIGATION (Typographie Cinétique) */}
              <nav className="flex flex-col gap-8 mt-10">
                {navLinks.map((link) => (
                  <motion.button
                    key={link.href}
                    variants={itemVariants}
                    onClick={() => handleNavClick(link.href, link.route)}
                    className="text-left text-4xl sm:text-5xl font-serif font-black text-[#0F3B2E] tracking-tight hover:text-[#10B981] hover:translate-x-4 transition-all duration-300 group flex items-center gap-4"
                  >
                    {link.label}
                    <ArrowRight className="w-8 h-8 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-[#10B981]" />
                  </motion.button>
                ))}
              </nav>

              {/* ZONE D'ACTION BASSE (Les Pilules Tactiles) */}
              <div className="mt-auto pb-12 w-full space-y-4 relative z-10">
                
                {/* Ligne de séparation douce */}
                <div className="w-full h-px bg-gradient-to-r from-transparent via-[#0F3B2E]/10 to-transparent mb-8" />

                {user ? (
                  <motion.div variants={itemVariants} className="flex flex-col gap-3">
                    <Button
                      onClick={() => { handleNavClick("/dashboard", true); }}
                      className="w-full bg-[#0F3B2E] text-white hover:bg-[#1A1A1A] h-16 rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-[#0F3B2E]/20"
                    >
                      <LayoutDashboard className="h-5 w-5 mr-3" /> Mon Dashboard
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleLogout}
                      className="w-full h-16 rounded-2xl border-rose-500/20 text-rose-600 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/40 font-bold uppercase tracking-widest text-xs transition-all"
                    >
                      <LogOut className="h-4 w-4 mr-2" /> Déconnexion
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div variants={itemVariants} className="flex flex-col gap-3">
                    <Button
                      onClick={() => handleNavClick("/auth", true)}
                      className="w-full bg-[#0F3B2E] text-white hover:bg-[#1A1A1A] h-16 rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-[#0F3B2E]/20 group"
                    >
                      <Sparkles className="h-5 w-5 mr-3 text-emerald-400 group-hover:animate-pulse" /> Commencer l'aventure
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleNavClick("/auth", true)}
                      className="w-full h-16 rounded-2xl border-[#0F3B2E]/10 text-[#0F3B2E] bg-white hover:bg-gray-50 font-bold uppercase tracking-widest text-xs shadow-sm"
                    >
                      Se connecter
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LandingHeader;
