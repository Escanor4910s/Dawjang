import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Menu, X, LogIn, LayoutDashboard, LogOut } from "lucide-react";
import HippocampusLogo from "./HippocampusLogo";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

// ─── LIENS DE NAVIGATION (Alignés sur la Landing Page Index.tsx) ───
const navLinks = [
  { label: "Produit", href: "/#features" },
  { label: "Agent MOR", href: "/#mor" },
  { label: "Tarifs", href: "/pricing", route: true },
];

const LandingHeader = ({ forceSolid = false }: { forceSolid?: boolean }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

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

  const handleNavClick = (href: string, route?: boolean) => {
    setIsMobileMenuOpen(false);
    if (route) {
      navigate(href);
      return;
    }
    // Pour les liens d'ancrage (ex: /#features)
    // Si on est déjà sur la landing page, on scrolle directement
    // Sinon, on navigue vers la landing page avec le hash
    if (href.startsWith("/#")) {
      const hash = href.substring(1); // "#features"
      if (location.pathname === "/") {
        const element = document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
          return;
        }
      }
      // On n'est pas sur la landing page, on navigue
      navigate(href);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const solid = isScrolled || forceSolid;

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          solid
            ? "bg-[#1A1A1A]/95 backdrop-blur-2xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.15)]"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-16 md:h-[4.5rem]">
            
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
              <img src="/favicon.png" alt="Hippocampus Logo" className="w-6 h-6 md:w-7 md:h-7 object-contain transition-transform duration-500 group-hover:rotate-12" />
              <span className={`font-serif font-bold text-lg md:text-xl tracking-tight transition-colors duration-300 ${solid ? 'text-white' : 'text-white'}`}>Hippocampus</span>
            </Link>

            {/* Desktop Nav — Fidèle à la Landing Page */}
            <nav className="hidden md:flex items-center gap-1.5 text-[13px] font-semibold tracking-wide">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href, link.route)}
                  className={`px-5 py-2.5 rounded-full transition-all duration-300 ${
                    solid 
                      ? 'text-white/50 hover:text-white hover:bg-white/5' 
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </nav>

            {/* Desktop Auth Buttons — Fidèles à la Landing Page */}
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

            {/* Hamburger Mobile */}
            <button
              className="md:hidden p-2 text-white/70 hover:text-white transition-colors outline-none"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Menu Mobile — Fidèle à la Landing Page */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-40 bg-[#1A1A1A]/98 backdrop-blur-2xl pt-32 px-8 flex flex-col md:hidden overflow-y-auto"
          >
            <div className="flex flex-col gap-6 text-center">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href, link.route)}
                  className="text-2xl font-serif text-white/80 hover:text-white border-b border-white/10 pb-6 transition-colors"
                >
                  {link.label}
                </button>
              ))}
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
    </>
  );
};

export default LandingHeader;
