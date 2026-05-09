import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import HippocampusLogo from "./HippocampusLogo";

const LandingFooter = () => {
  return (
    <footer className="bg-section-dark text-section-dark-foreground/70">
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <HippocampusLogo size="sm" variant="white" />

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <Link to="/about" className="hover:text-section-dark-foreground transition-colors">À propos</Link>
            <Link to="/terms" className="hover:text-section-dark-foreground transition-colors">CGU</Link>
            <Link to="/privacy" className="hover:text-section-dark-foreground transition-colors">Confidentialité</Link>
            <a href="#faq" className="hover:text-section-dark-foreground transition-colors">FAQ</a>
          </nav>
        </div>

        <div className="mt-6 pt-6 border-t border-section-dark-foreground/10 text-center text-xs text-section-dark-foreground/40">
          <span className="flex items-center justify-center gap-1">
            © 2024 Hippocampus — Fait avec <Heart className="h-3 w-3 text-heart fill-heart" /> pour les étudiants
          </span>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
