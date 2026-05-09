import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import {
  LayoutDashboard, Plus, Brain, FileText, History, BookOpen, Sparkles, Share2, Crown, Settings, LogOut,
  ChevronDown, ChevronRight, Menu, GraduationCap, PenTool, FileSearch, Search, Swords, Lock, PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import logoImg from "@/assets/logo-hippocampus.jpeg";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { PremiumBadge } from "@/components/PremiumBadge";
import { GamificationWidget } from "@/components/gamification/GamificationWidget";
import { useGamificationContext } from "@/components/gamification/GamificationProvider";
import { BADGES } from "@/hooks/useGamification";

interface AppSidebarProps { 
  user: User | null; 
  isCollapsed?: boolean;
  onToggle?: () => void;
}
interface NavItem { title: string; icon: React.ElementType; path: string; requiredPlan?: "premium" | "pro"; }
interface NavSection { title: string; icon: React.ElementType; items: NavItem[]; }

const navSections: NavSection[] = [
  {
    title: "Espace Étudiant", icon: GraduationCap,
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
      { title: "Révision", icon: Brain, path: "/review" },
      { title: "Flashcards", icon: BookOpen, path: "/flashcards", requiredPlan: "premium" },
      { title: "Mes QCM", icon: FileText, path: "/quiz-library" },
      { title: "Mes Résumés", icon: FileSearch, path: "/summaries" },
      { title: "Statistiques", icon: History, path: "/statistics" },
      { title: "Mode Duel", icon: Swords, path: "/duel", requiredPlan: "premium" },
    ],
  },
  {
    title: "Espace Création", icon: PenTool,
    items: [
      { title: "Générer un QCM", icon: Plus, path: "/add-course" },
      { title: "Générer Résumé", icon: Sparkles, path: "/generate-summary", requiredPlan: "premium" },
      { title: "Communauté", icon: Share2, path: "/community" },
    ],
  },
];

const accountItems: NavItem[] = [
  { title: "Mon abonnement", icon: Crown, path: "/subscription" },
  { title: "Paramètres", icon: Settings, path: "/settings" },
];

const adminItems: NavItem[] = [
  { title: "Administration", icon: Search, path: "/admin" },
];

const AppSidebar = ({ user, isCollapsed = false, onToggle }: AppSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(["Espace Étudiant", "Espace Création"]);
  const { isAdmin, hasAccess, plan } = useUserRole();
  const [reviewCount, setReviewCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const { data: gamData } = useGamificationContext();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    const fetchReviewCount = async () => {
      if (!user) return;
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", user.id).lte("next_review", today);
      setReviewCount(count || 0);
    };
    fetchReviewCount();
    const interval = setInterval(fetchReviewCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Close sidebar on click outside (mobile)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const canAccessFeature = (requiredPlan?: "premium" | "pro"): boolean => {
    if (!requiredPlan) return true;
    if (isAdmin) return true;
    return hasAccess(requiredPlan);
  };

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections((prev) => prev.includes(sectionTitle) ? prev.filter((s) => s !== sectionTitle) : [...prev, sectionTitle]);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); toast.success("Déconnexion réussie"); navigate("/"); };
  const isActive = (path: string) => location.pathname === path;

  const lastBadge = gamData?.earnedBadges?.length ? BADGES[gamData.earnedBadges[gamData.earnedBadges.length - 1]] : null;

  const planBadgeConfig: Record<string, { label: string; className: string }> = {
    gratuit: { label: "Free", className: "bg-muted text-muted-foreground" },
    premium: { label: "Premium", className: "bg-warning/20 text-warning border-warning/30" },
    pro: { label: "Pro", className: "bg-purple-500/20 text-purple-500 border-purple-500/30" },
    admin: { label: "Admin", className: "bg-destructive/20 text-destructive border-destructive/30" },
  };

  const currentPlan = isAdmin ? "admin" : (plan || "gratuit");
  const planBadge = planBadgeConfig[currentPlan] || planBadgeConfig.gratuit;

  if (!user) return null;

  return (
    <>
      {/* Mobile toggle - hidden when sidebar is open */}
      {!isOpen && (
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 left-4 z-50 md:hidden bg-background/80 backdrop-blur-md border-border shadow-sm rounded-xl"
          onClick={() => setIsOpen(true)}
        >
          <Menu className="h-5 w-5 text-foreground" />
        </Button>
      )}

      {/* Overlay for mobile - click to close */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden transition-opacity" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed z-40 transition-all duration-300 ease-in-out flex flex-col",
          isCollapsed ? "w-[80px]" : "w-[270px]",
          "md:translate-x-0 bg-card text-card-foreground",
          "md:left-3 md:top-3 md:bottom-3 md:h-[calc(100vh-24px)] md:rounded-[1.5rem] md:border md:border-border/60 md:shadow-[0_8px_30px_rgba(0,0,0,0.06)]",
          "left-0 top-0 h-screen",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo and Collapse Button */}
        <div className={cn("p-5 pb-2 flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
          <button onClick={() => navigate("/")} className="flex items-center space-x-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden shrink-0">
              <img src={logoImg} alt="Hippocampus" className="h-full w-full object-cover" />
            </div>
            {!isCollapsed && <span className="text-lg font-bold tracking-tight text-foreground">Hippocampus.</span>}
          </button>
          {/* Mobile close button only */}
          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 text-muted-foreground hover:bg-muted rounded-xl" onClick={() => setIsOpen(false)}>
            <ChevronDown className="h-4 w-4 rotate-90" />
          </Button>
        </div>
          
        {/* Collapse toggle (Always visible in this position) */}
        <div className={cn("px-4 py-4 flex", isCollapsed ? "justify-center" : "justify-end")}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 text-muted-foreground hover:bg-muted rounded-xl transition-all duration-300"
            onClick={onToggle}
            title={isCollapsed ? "Développer" : "Réduire"}
          >
            {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
        </div>



        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-5 pb-4 scrollbar-none">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-2">
              <div 
                className="px-2 flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSection(section.title)}
              >
                <p className={cn("text-[11px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em]", isCollapsed && "hidden")}>{section.title}</p>
                {!isCollapsed && (
                  expandedSections.includes(section.title) ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                  )
                )}
              </div>

              {expandedSections.includes(section.title) && (
                <div className="space-y-1 mt-2">
                  {section.items.map((item) => {
                    const locked = item.requiredPlan && !canAccessFeature(item.requiredPlan);
                    const showBadge = item.requiredPlan && !isAdmin && !canAccessFeature(item.requiredPlan);
                    const active = isActive(item.path);
                    
                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          if (locked) {
                            toast.error(`Fonctionnalité réservée aux abonnés ${item.requiredPlan === "pro" ? "Pro" : "Premium / Pro"}`);
                            navigate("/subscription");
                            setIsOpen(false);
                            return;
                          }
                          navigate(item.path);
                          setIsOpen(false);
                        }}
                        className={cn(
                          "flex items-center w-full rounded-xl transition-all duration-200 group relative overflow-hidden text-sm font-medium",
                          isCollapsed ? "justify-center py-3" : "justify-between px-3 py-2.5",
                          active
                            ? "bg-primary/10 text-primary dark:bg-primary/20"
                            : locked
                            ? "text-muted-foreground/50 hover:bg-muted/30"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                        title={isCollapsed ? item.title : undefined}
                      >
                        <div className="flex items-center gap-3 relative z-10">
                          <item.icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground", locked && "opacity-50")} />
                          {!isCollapsed && <span>{item.title}</span>}
                        </div>
                        {!isCollapsed && (
                          <div className="flex items-center gap-1.5 relative z-10">
                            {item.path === "/review" && reviewCount > 0 && (
                              <Badge variant="destructive" className="bg-destructive/10 text-destructive border-0 hover:bg-destructive/20 text-[10px] px-1.5 py-0 h-5 min-w-[20px] flex items-center justify-center font-bold">
                                {reviewCount}
                              </Badge>
                            )}
                            {locked && <Lock className="h-3 w-3 text-muted-foreground/50" />}
                            {showBadge && <PremiumBadge type={item.requiredPlan!} size="sm" />}
                          </div>
                        )}
                        {isCollapsed && item.path === "/review" && reviewCount > 0 && (
                          <div className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full shadow-sm" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          <div className="space-y-2">
            {!isCollapsed && <p className="px-2 text-[11px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em]">Paramètres</p>}
            <div className="space-y-1 mt-2">
              {isAdmin && adminItems.map((item) => (
                <button key={item.path} onClick={() => { navigate(item.path); setIsOpen(false); }}
                  className={cn("flex items-center gap-3 w-full font-medium rounded-xl transition-all duration-200 group",
                    isCollapsed ? "justify-center py-3" : "px-3 py-2.5 text-sm",
                    isActive(item.path) ? "bg-primary/10 text-primary dark:bg-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  title={isCollapsed ? item.title : undefined}>
                  <item.icon className={cn("h-4 w-4", isActive(item.path) ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {!isCollapsed && <span>{item.title}</span>}
                </button>
              ))}
              
              {accountItems.map((item) => (
                <button key={item.path} onClick={() => { navigate(item.path); setIsOpen(false); }}
                  className={cn("flex items-center gap-3 w-full font-medium rounded-xl transition-all duration-200 group",
                    isCollapsed ? "justify-center py-3" : "px-3 py-2.5 text-sm",
                    isActive(item.path) ? "bg-primary/10 text-primary dark:bg-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  title={isCollapsed ? item.title : undefined}>
                  <item.icon className={cn("h-4 w-4", isActive(item.path) ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {!isCollapsed && <span>{item.title}</span>}
                </button>
              ))}

              <button onClick={handleLogout} 
                className={cn("flex items-center gap-3 w-full font-medium rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors group mt-4",
                  isCollapsed ? "justify-center py-3" : "px-3 py-2.5 text-sm"
                )}
                title={isCollapsed ? "Se déconnecter" : undefined}>
                <LogOut className="h-4 w-4 group-hover:text-destructive" />
                {!isCollapsed && <span>Se déconnecter</span>}
              </button>
            </div>
          </div>
          
          {!isCollapsed && (
            <div className="mt-6 mb-2">
              <GamificationWidget variant="sidebar" />
            </div>
          )}
        </nav>

        {/* User info */}
        <div className={cn("mx-3 my-3 mt-auto rounded-2xl bg-muted/30 border border-border/40 transition-all duration-300", isCollapsed ? "p-2" : "p-3")}>
          <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
            <div className="relative shrink-0">
              <Avatar className="w-9 h-9 border-2 border-background shadow-sm">
                <AvatarImage src={avatarUrl || user.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              {lastBadge && !isCollapsed && <span className="absolute -top-1 -right-1 text-[10px] bg-background rounded-full w-[20px] h-[20px] flex items-center justify-center shadow-sm border border-border">{lastBadge.icon}</span>}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{user.user_metadata?.name || user.email?.split("@")[0]}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
