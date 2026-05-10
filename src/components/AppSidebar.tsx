import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import {
  LayoutDashboard, Plus, Brain, FileText, History, BookOpen, Sparkles, Share2, Crown, Settings, LogOut,
  ChevronDown, ChevronRight, Menu, GraduationCap, PenTool, FileSearch, Search, Swords, Lock, PanelLeftClose, PanelLeftOpen,
  Trophy, Star
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
          isCollapsed ? "w-[90px]" : "w-[280px]",
          "md:translate-x-0 bg-card/80 backdrop-blur-2xl text-card-foreground",
          "md:left-3 md:top-3 md:bottom-3 md:h-[calc(100vh-24px)] md:rounded-[2rem] md:border md:border-white/20 md:shadow-[0_12px_48px_rgba(0,0,0,0.12)]",
          "left-0 top-0 h-screen w-[280px] border-r border-border/50",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo and Collapse Button */}
        <div className={cn("px-5 pb-4 flex flex-col gap-4")}>
          <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
            <button onClick={() => navigate("/")} className="flex items-center space-x-2.5 group">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden shrink-0">
                <img src={logoImg} alt="Hippocampus" className="h-full w-full object-cover" />
              </div>
              {!isCollapsed && <span className="text-xl font-bold tracking-tight text-foreground">Hippocampus</span>}
            </button>
            <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 text-muted-foreground hover:bg-muted rounded-xl" onClick={() => setIsOpen(false)}>
              <ChevronDown className="h-5 w-5 rotate-90" />
            </Button>
          </div>

          <div className={cn("flex items-center gap-3", isCollapsed ? "flex-col" : "justify-between bg-muted/40 p-2.5 rounded-2xl border border-border/40")}>
            {/* User Icon */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative shrink-0 hover:scale-105 transition-transform">
                  <Avatar className={cn("border-2 border-background shadow-md", isCollapsed ? "h-11 w-11" : "h-12 w-12")}>
                    <AvatarImage src={avatarUrl || user.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {lastBadge && <span className="absolute -top-1 -right-1 text-[10px] bg-background rounded-full w-[22px] h-[22px] flex items-center justify-center shadow-sm border border-border">{lastBadge.icon}</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isCollapsed ? "center" : "start"} side={isCollapsed ? "right" : "bottom"} className="w-80 rounded-[2rem] p-0 border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="p-6 bg-gradient-to-br from-primary/10 via-transparent to-accent/5 border-b border-border/40">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-14 w-14 border-2 border-background shadow-lg">
                      <AvatarImage src={avatarUrl || user.user_metadata?.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-foreground truncate">{user.user_metadata?.name || user.email?.split("@")[0]}</p>
                      <p className="text-xs text-muted-foreground truncate opacity-80">{user.email}</p>
                    </div>
                  </div>

                  {/* Level & XP */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-black uppercase tracking-widest text-primary">Niveau {gamData?.level || 1}</span>
                      <span className="text-[10px] font-bold text-muted-foreground">{gamData?.xp || 0} / {((gamData?.level || 1) * 1000)} XP</span>
                    </div>
                    <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden border border-primary/5">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-700 ease-out" 
                        style={{ width: `${Math.min(((gamData?.xp || 0) % 1000) / 10, 100)}%` }} 
                      />
                    </div>
                  </div>
                </div>
                
                <div className="p-5 space-y-6">
                  {/* Detailed Stats Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col items-center p-3 rounded-2xl bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors">
                      <Trophy className="h-5 w-5 text-orange-500 mb-1.5" />
                      <span className="text-sm font-black">{gamData?.currentStreak || 0}</span>
                      <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Série</span>
                    </div>
                    <div className="flex flex-col items-center p-3 rounded-2xl bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors">
                      <Star className="h-5 w-5 text-blue-500 mb-1.5" />
                      <span className="text-sm font-black">{gamData?.earnedBadges?.length || 0}</span>
                      <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Badges</span>
                    </div>
                    <div className="flex flex-col items-center p-3 rounded-2xl bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors">
                      <Brain className="h-5 w-5 text-primary mb-1.5" />
                      <span className="text-sm font-black">{gamData?.totalQuizzesCompleted || 0}</span>
                      <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">QCM</span>
                    </div>
                  </div>

                  {/* Badges Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mes Badges Récents</h3>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {gamData?.earnedBadges && gamData.earnedBadges.length > 0 ? (
                        gamData.earnedBadges.slice(-8).reverse().map((badgeId) => {
                          const badge = BADGES[badgeId];
                          if (!badge) return null;
                          return (
                            <div key={badgeId} className="group relative">
                              <div className="h-12 w-12 rounded-xl bg-background border border-border/50 flex items-center justify-center text-xl shadow-sm hover:scale-110 hover:shadow-md transition-all cursor-help border-dashed">
                                {badge.icon}
                              </div>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-[10px] rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 font-bold">
                                {badge.name}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-4 py-4 text-center border-2 border-dashed border-border/40 rounded-2xl">
                          <p className="text-[10px] font-bold text-muted-foreground">Aucun badge pour le moment</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-2 bg-muted/20 border-t border-border/40">
                  <DropdownMenuItem onClick={() => navigate("/settings")} className="rounded-xl flex items-center justify-center gap-2 py-3 cursor-pointer hover:bg-muted/60 transition-colors">
                    <span className="text-xs font-bold text-muted-foreground">Voir le profil complet</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Collapse Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("text-muted-foreground hover:bg-muted rounded-xl transition-all duration-300", isCollapsed ? "h-11 w-11" : "h-10 w-10")}
              onClick={onToggle}
              title={isCollapsed ? "Développer" : "Réduire"}
            >
              {isCollapsed ? <PanelLeftOpen className="h-6 w-6" /> : <PanelLeftClose className="h-6 w-6" />}
            </Button>
          </div>
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


      </aside>
    </>
  );
};

export default AppSidebar;
