import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Menu, X, LogIn } from "lucide-react";
import HippocampusLogo from "./HippocampusLogo";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

const navLinks = [
  { label: "Fonctionnalités", href: "#features" },
  { label: "Comment ça marche", href: "#how-it-works" },
  { label: "Tarifs", href: "/pricing", route: true },
  { label: "FAQ", href: "#faq" },
];

const LandingHeader = () => {
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

  const handleNavClick = (href: string, route?: boolean) => {
    setIsMobileMenuOpen(false);
    if (route) {
      navigate(href);
      return;
    }
    if (href.startsWith("#")) {
      const element = document.querySelector(href);
      element?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-background/95 backdrop-blur-md border-b border-border shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14 md:h-16">
            <Link to="/" className="flex-shrink-0">
              <HippocampusLogo size="sm" variant="default" />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href, link.route)}
                  className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <Button
                  onClick={() => navigate("/dashboard")}
                  className="bg-foreground text-background hover:bg-foreground/90 text-sm h-9 px-4"
                >
                  Dashboard
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => navigate("/auth")}
                    className="text-sm h-9"
                  >
                    <LogIn className="h-4 w-4 mr-1" />
                    Connexion
                  </Button>
                  <Button
                    onClick={() => navigate("/auth")}
                    className="bg-foreground text-background hover:bg-foreground/90 text-sm h-9 px-4"
                  >
                    Commencer
                  </Button>
                </>
              )}
            </div>

            <button
              className="md:hidden p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5 text-foreground" />
              ) : (
                <Menu className="h-5 w-5 text-foreground" />
              )}
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-background pt-16 md:hidden"
          >
            <nav className="flex flex-col items-center gap-5 p-6">
              {navLinks.map((link, index) => (
                <motion.button
                  key={link.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                  onClick={() => handleNavClick(link.href, link.route)}
                  className="text-lg font-medium text-foreground"
                >
                  {link.label}
                </motion.button>
              ))}
              <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
                {user ? (
                  <Button
                    onClick={() => navigate("/dashboard")}
                    className="w-full bg-foreground text-background"
                  >
                    Dashboard
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/auth")}
                      className="w-full"
                    >
                      Connexion
                    </Button>
                    <Button
                      onClick={() => navigate("/auth")}
                      className="w-full bg-foreground text-background"
                    >
                      Commencer gratuitement
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LandingHeader;
