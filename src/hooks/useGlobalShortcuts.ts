import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const useGlobalShortcuts = (isAuthenticated: boolean) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on est dans un input ou textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const key = e.key ? e.key.toLowerCase() : "";

      // Alt + D = Dashboard
      if (e.altKey && key === 'd') {
        e.preventDefault();
        navigate('/dashboard');
        toast.info("Navigation: Dashboard");
      }
      
      // Alt + S = Summaries
      if (e.altKey && key === 's') {
        e.preventDefault();
        navigate('/summaries');
        toast.info("Navigation: Mes Résumés");
      }

      // Alt + Q = QCM / Quiz
      if (e.altKey && key === 'q') {
        e.preventDefault();
        navigate('/quiz-library');
        toast.info("Navigation: Bibliothèque QCM");
      }

      // Alt + E = ECOS
      if (e.altKey && key === 'e') {
        e.preventDefault();
        navigate('/ecos');
        toast.info("Navigation: Simulateur ECOS");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, isAuthenticated]);
};
