import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard, BookOpen, Layers, RotateCcw,
  Calendar, CheckSquare, Activity, Crown, LogOut,
  Sparkles, User, BarChart3, Swords, Menu, PanelLeftClose, PanelLeftOpen, Shield, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";

interface AppSidebarProps {
  user: any;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const navGroups = [
  {
    title: "Général",
    items: [
      { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
      { name: "Statistiques", path: "/statistics", icon: BarChart3 },
      { name: "Mon Plan", path: "/my-plan", icon: Crown }, // NOTE: fixed path to match App.tsx
    ]
  },
  {
    title: "Apprentissage",
    items: [
      { name: "Mes Résumés", path: "/summaries", icon: BookOpen },
      { name: "Mes QCM", path: "/quiz-library", icon: CheckSquare },
      { name: "Flashcards", path: "/flashcards", icon: Layers },
    ]
  },
  {
    title: "Entraînement Clinique",
    items: [
      { name: "Révision", path: "/review", icon: RotateCcw },
      { name: "Planificateur", path: "/review-planner", icon: Calendar },
      { name: "Mode Duel", path: "/duel", icon: Swords },
      { name: "Simulateur ECOS", path: "/ecos", icon: Activity },
    ]
  }
];

const AppSidebar = ({ user, isCollapsed = false, onToggle }: AppSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();

  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user?.id) {
      supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
        if (data) setProfile(data);
      });
    }
  }, [user?.id]);

  const activeNavGroups = [...navGroups];
  if (isAdmin) {
    activeNavGroups.push({
      title: "Supervision",
      items: [
        { name: "Administration", path: "/admin", icon: Shield }
      ]
    });
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Déconnexion réussie");
      navigate("/auth");
    } catch (error) {
      toast.error("Erreur lors de la déconnexion");
    }
  };

  return (
    <>
      {/* Mobile toggle button */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-white/80 dark:bg-[#161614]/80 backdrop-blur-md border-black/5 dark:border-white/5 shadow-sm rounded-xl"
        onClick={onToggle}
      >
        <Menu className="h-5 w-5 text-[#111111] dark:text-white" />
      </Button>

      {/* Sidebar background overlay for mobile */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity" 
          onClick={onToggle} 
        />
      )}

      {/* ─── INJECTION DU MOTEUR D'ANIMATION CSS ─── */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes sidebar-wave {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .bg-hippo-wave {
          background: linear-gradient(135deg, #050505 0%, #1e1b4b 25%, #4c1d95 50%, #831843 75%, #050505 100%);
          background-size: 300% 300%;
          animation: sidebar-wave 18s ease-in-out infinite;
        }
        .sidebar-scroll::-webkit-scrollbar { width: 0px; }
      `}} />

      {/* Main Sidebar */}
      <aside className={cn(
        "flex flex-col bg-hippo-wave border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] z-50 overflow-hidden transition-all duration-300 ease-in-out group/sidebar relative",
        // Mobile positioning
        "fixed top-0 left-0 h-full",
        // Desktop positioning
        "lg:static lg:h-[calc(100vh-32px)] lg:my-4 lg:ml-4",
        // Mobile rounding
        "rounded-r-[2rem] lg:rounded-[2.5rem]",
        // Width and mobile slide animation
        isCollapsed ? "-translate-x-full lg:translate-x-0 w-[280px] lg:w-[80px]" : "translate-x-0 w-[280px] lg:w-[320px]"
      )}>
        
        {/* Le Verre Fumé : Réduit l'intensité des couleurs pour une lisibilité absolue */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[40px] pointer-events-none z-0" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] pointer-events-none mix-blend-overlay z-0" />

        {/* ─── EN-TÊTE : LOGO DE LA LANDING PAGE ─── */}
        <Link 
          to="/" 
          className={cn("relative z-10 p-10 pb-6 flex items-center gap-3 group outline-none", isCollapsed ? "lg:p-6 lg:justify-center" : "")}
        >
          <img src="/favicon.png" alt="Hippocampus Logo" className={cn("shrink-0 object-contain transition-transform duration-500 group-hover:rotate-12", isCollapsed ? "w-8 h-8" : "w-7 h-7")} />
          <span className={cn("font-serif font-bold tracking-tight text-white transition-all duration-300 whitespace-nowrap", isCollapsed ? "lg:hidden lg:opacity-0 lg:w-0 text-lg" : "opacity-100 w-auto text-2xl")}>
            Hippocampus
          </span>
        </Link>

        {/* Toggle button has been moved to the Affichage section below */}

        {/* ─── NAVIGATION (Typographie Affirmée et Espacée) ─── */}
        <div className="relative z-10 flex-1 overflow-y-auto sidebar-scroll px-6 pb-6 mt-4 overflow-x-hidden">
          <div className="space-y-10">
            {activeNavGroups.map((group, groupIndex) => (
              <div key={group.title} className="space-y-4">
                <h3 className={cn("px-4 text-xs font-black uppercase tracking-[0.2em] text-white/40 transition-all", isCollapsed ? "lg:opacity-0 lg:h-0 lg:mb-0 lg:overflow-hidden" : "opacity-100 mb-4")}>
                  {group.title}
                </h3>
                <ul className="space-y-2">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                    const Icon = item.icon;

                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          title={isCollapsed ? item.name : undefined}
                          onClick={() => { if (window.innerWidth < 1024) onToggle?.() }}
                          className={cn(
                            "group relative flex items-center gap-5 py-4 rounded-2xl transition-all duration-300 outline-none",
                            isCollapsed ? "px-0 lg:justify-center" : "px-5",
                            isActive 
                              ? "bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]" 
                              : "text-white/60 hover:text-white hover:bg-white/5"
                          )}
                        >
                          {/* Indicateur actif lumineux */}
                          {isActive && !isCollapsed && (
                            <motion.div layoutId="sidebar-active" className="absolute left-0 top-1/4 bottom-1/4 w-1.5 bg-pink-500 rounded-r-full shadow-[0_0_15px_rgba(236,72,153,0.6)]" />
                          )}
                          {isActive && isCollapsed && (
                            <motion.div layoutId="sidebar-active-col" className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-pink-500 rounded-r-full shadow-[0_0_15px_rgba(236,72,153,0.6)]" />
                          )}
                          
                          <Icon className={cn("shrink-0 transition-transform duration-300", 
                            isActive ? "h-6 w-6 text-pink-400" : "h-6 w-6 group-hover:scale-110",
                            isCollapsed ? "lg:mx-auto" : ""
                          )} />
                          
                          <span className={cn("text-base font-bold tracking-wide whitespace-nowrap transition-all duration-300", isCollapsed ? "lg:hidden lg:opacity-0 lg:w-0" : "opacity-100 w-auto")}>
                            {item.name}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ─── PIED DE SIDEBAR : PROFIL & RÉGLAGES ─── */}
        <div className="relative z-10 p-6 mt-auto border-t border-white/10 bg-black/20 flex flex-col gap-4">
          
          {/* Section Affichage & Réduction (Desktop) */}
          <div className={cn("flex items-center justify-between rounded-2xl bg-white/5 border border-white/5 transition-all overflow-hidden", isCollapsed ? "lg:p-2 lg:flex-col lg:gap-4 lg:bg-transparent lg:border-transparent" : "px-5 py-4")}>
            <span className={cn("text-sm font-bold text-white/60 uppercase tracking-widest whitespace-nowrap transition-all", isCollapsed ? "hidden lg:hidden" : "block")}>Affichage</span>
            
            <div className={cn("flex items-center gap-3", isCollapsed ? "flex-col" : "flex-row")}>
              {/* Le bouton pour réduire/agrandir la sidebar */}
              <button 
                onClick={onToggle}
                className="hidden lg:flex h-8 w-8 rounded-full bg-black/50 border border-white/10 items-center justify-center text-white/60 hover:text-white hover:bg-black/70 transition-all outline-none shrink-0"
                title={isCollapsed ? "Agrandir" : "Réduire"}
              >
                {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>

              <ThemeToggle />
            </div>
          </div>

          <div className={cn("flex flex-col gap-2 transition-all", isCollapsed ? "lg:bg-transparent lg:border-transparent lg:p-0" : "")}>
            {/* Carte Profil Utilisateur */}
            <div className={cn("flex items-center gap-4 rounded-2xl hover:bg-white/10 transition-colors group", isCollapsed ? "lg:justify-center p-2" : "p-4")}>
              <Link 
                to="/settings" 
                title={isCollapsed ? (profile?.first_name || profile?.name || "Profil") : undefined}
                className="flex items-center justify-center shrink-0 outline-none"
              >
                <div className="relative h-12 w-12 rounded-full bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-white border-2 border-white/20 shadow-md group-hover:scale-105 transition-transform overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold">{profile?.first_name?.charAt(0)?.toUpperCase() || profile?.name?.charAt(0)?.toUpperCase() || <User className="h-6 w-6" />}</span>
                  )}
                </div>
              </Link>
              <Link 
                to="/settings"
                className={cn("flex-1 min-w-0 transition-all outline-none", isCollapsed ? "lg:hidden lg:opacity-0 lg:w-0" : "opacity-100 w-auto")}
              >
                <p className="text-base font-bold text-white truncate">{profile?.first_name || profile?.name || "Étudiant"}</p>
                <p className="text-xs font-medium text-emerald-400 flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                  {profile?.plan === 'excellence' ? <Crown className="h-3.5 w-3.5 text-amber-400" /> : profile?.plan === 'premium' ? <Zap className="h-3.5 w-3.5 text-emerald-400" /> : <Sparkles className="h-3.5 w-3.5 text-emerald-400" />} 
                  <span className={profile?.plan === 'excellence' ? "text-amber-400" : ""}>
                    {profile?.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : "Gratuit"}
                  </span>
                </p>
              </Link>
              {!isCollapsed && (
                <button onClick={handleLogout} className="shrink-0 outline-none" title="Déconnexion">
                  <LogOut className="h-5 w-5 text-white/40 hover:text-rose-400 transition-colors" />
                </button>
              )}
            </div>
            
            {isCollapsed && (
              <button 
                onClick={handleLogout}
                className="hidden lg:flex items-center justify-center p-4 rounded-2xl hover:bg-[#DC2626] hover:text-white transition-all duration-200 text-white/40 group mx-auto outline-none"
                title="Déconnexion"
              >
                <LogOut className="h-6 w-6 group-hover:scale-110 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
