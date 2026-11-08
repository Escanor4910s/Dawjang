// src/components/UserAvatar.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  LogOut,
  LogIn,
  CreditCard,
  Sparkles,
  Bell,
  Check,
  Trash2,
  Trophy,
  Award,
  Home,
  LayoutDashboard,
  Gem,
  Compass,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getSavedStudentProfile, StudentProfileSN } from "@/pages/Settings";
import { useNotifications } from "@/hooks/useNotifications";
import {
  getStoredUserStats,
  USER_GAMIFICATION_KEY,
  UserStatsState,
  useGamification,
} from "@/hooks/useGamification";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export { getStoredUserStats, USER_GAMIFICATION_KEY };
export type { UserStatsState };

export type PlanBadgeTier = "STD" | "PRO" | "MAJOR";

export interface PlanBadgeInfo {
  label: string;
  tier: PlanBadgeTier;
  colorClass: string;
}

const PUBLIC_LANDING_PATHS = [
  "/",
  "/tarifs",
  "/confidentialite",
  "/conditions",
];

const AUTH_STATUS_STORAGE_KEY = "dawjang_is_authenticated";

/**
 * Sceau Impérial Ciselé sur mesure pour le Plan Napoléon
 */
function NapoleonImperialSealSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 1.5 L14.3 7.4 L20.2 3.8 L16.6 9.7 L22.5 12 L16.6 14.3 L20.2 20.2 L14.3 16.6 L12 22.5 L9.7 16.6 L3.8 20.2 L7.4 14.3 L1.5 12 L7.4 9.7 L3.8 3.8 L9.7 7.4 Z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="3.4" fill="#141312" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

/**
 * Emblème par Icône pure représentant le Plan choisi :
 * - STD   (Plan Initié)   : Boussole d'Argent
 * - PRO   (Plan Taoïste)  : Diamant Terracotta
 * - MAJOR (Plan Napoléon) : Sceau Étoile Impériale d'Or & Obsidienne
 */
export function PlanTierIconBadge({
  tier,
  size = "sm",
  className,
}: {
  tier: PlanBadgeTier;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const boxSize =
    size === "xs"
      ? "h-4 w-4"
      : size === "md"
      ? "h-7 w-7"
      : size === "lg"
      ? "h-9 w-9"
      : "h-5 w-5";

  const iconSize =
    size === "xs"
      ? "h-2.5 w-2.5"
      : size === "md"
      ? "h-4 w-4"
      : size === "lg"
      ? "h-5 w-5"
      : "h-3 w-3";

  if (tier === "MAJOR") {
    return (
      <span
        title="Plan Napoléon (Sceau Impérial)"
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-amber-300/60 bg-gradient-to-br from-[#1B1917] via-[#2A241E] to-[#C96442] text-amber-300 shadow-sm",
          boxSize,
          className
        )}
      >
        <NapoleonImperialSealSvg className={iconSize} />
      </span>
    );
  }

  if (tier === "PRO") {
    return (
      <span
        title="Plan Taoïste (Diamant)"
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm",
          boxSize,
          className
        )}
      >
        <Gem className={cn(iconSize, "stroke-[2.3]")} />
      </span>
    );
  }

  return (
    <span
      title="Plan Initié (Boussole)"
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-border bg-secondary text-foreground shadow-2xs",
        boxSize,
        className
      )}
    >
      <Compass className={cn(iconSize, "stroke-[2.1]")} />
    </span>
  );
}

export function getActivePlanBadge(): {
  tier: PlanBadgeTier;
  planName: string;
} {
  const savedTier =
    (localStorage.getItem("dawjang_active_plan_tier") as PlanBadgeTier) ||
    "PRO";
  const stats = getStoredUserStats();

  if (!stats.isPremium || savedTier === "STD") {
    return { tier: "STD", planName: "Plan Initié" };
  }
  if (savedTier === "MAJOR") {
    return { tier: "MAJOR", planName: "Plan Napoléon" };
  }
  return { tier: "PRO", planName: "Plan Taoïste" };
}

export function resolveUserPlanBadge(
  stats?: UserStatsState | null,
  dbPlan?: string | null
): PlanBadgeInfo {
  const savedTier =
    (localStorage.getItem("dawjang_active_plan_tier") as PlanBadgeTier) ||
    dbPlan ||
    stats?.planTier ||
    "PRO";
  const raw = String(savedTier).toUpperCase();

  if (
    raw === "MAJOR" ||
    raw === "PROF" ||
    raw.includes("MAJOR") ||
    raw.includes("NAPOLEON") ||
    raw.includes("NAPOLÉON")
  ) {
    return {
      label: "MAJOR",
      tier: "MAJOR",
      colorClass: "bg-gradient-to-r from-amber-500 to-[#C96442] text-white",
    };
  }

  if (raw === "STD" || raw === "STANDARD" || raw === "INITIE" || raw === "INITIÉ") {
    return {
      label: "STD",
      tier: "STD",
      colorClass: "bg-secondary text-foreground border border-border",
    };
  }

  return {
    label: "PRO",
    tier: "PRO",
    colorClass: "bg-primary text-primary-foreground",
  };
}

export async function syncUserProfileWithBackend(): Promise<{
  profile: StudentProfileSN;
  stats: UserStatsState;
  planBadge: PlanBadgeInfo;
} | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: dbProfile } = await supabase
      .from("profiles")
      .select("id, name, first_name, university, year_of_study, avatar_url, credits, plan")
      .eq("id", user.id)
      .maybeSingle();

    const saved = getSavedStudentProfile();
    const meta = user.user_metadata || {};
    const resolvedName =
      dbProfile?.first_name ||
      dbProfile?.name ||
      meta.name ||
      meta.full_name ||
      user.email?.split("@")[0] ||
      saved.fullName;

    const currentStats = getStoredUserStats();
    const rawPlan =
      dbProfile?.plan ||
      localStorage.getItem("dawjang_active_plan_tier") ||
      currentStats.planTier;
    const badge = resolveUserPlanBadge(currentStats, rawPlan);

    const resolvedStudyLevel =
      dbProfile?.year_of_study || meta.study_level || saved.studyLevel;

    const resolvedUniversity =
      dbProfile?.university || meta.university || saved.university;

    const resolvedAvatar =
      dbProfile?.avatar_url ||
      saved.avatarUrl ||
      localStorage.getItem("hippocampus_user_avatar_url") ||
      undefined;

    const updatedProfile: StudentProfileSN = {
      ...saved,
      fullName: resolvedName,
      email: user.email || saved.email,
      phone: meta.phone || saved.phone,
      studyLevel: resolvedStudyLevel,
      university: resolvedUniversity,
      credits: dbProfile?.credits ?? saved.credits,
      avatarUrl: resolvedAvatar,
    };

    localStorage.setItem(
      "hippocampus_user_profile_sn_v1",
      JSON.stringify(updatedProfile)
    );
    localStorage.setItem(
      "hippocampus_student_profile_sn",
      JSON.stringify(updatedProfile)
    );

    if (resolvedAvatar) {
      localStorage.setItem("hippocampus_user_avatar_url", resolvedAvatar);
    }

    const updatedStats: UserStatsState = {
      ...currentStats,
      planTier: badge.tier,
      isPremium: badge.tier !== "STD",
    };
    localStorage.setItem(USER_GAMIFICATION_KEY, JSON.stringify(updatedStats));

    window.dispatchEvent(new CustomEvent("hippocampus-profile-updated"));
    window.dispatchEvent(new CustomEvent("hippocampus-stats-updated"));

    return { profile: updatedProfile, stats: updatedStats, planBadge: badge };
  } catch (err) {
    console.error("Erreur syncUserProfileWithBackend:", err);
    return null;
  }
}

export interface UserAvatarProps {
  collapsed?: boolean;
  inHeader?: boolean;
  extraActions?: React.ReactNode;
}

export function UserAvatar({
  collapsed = false,
  inHeader = false,
  extraActions,
}: UserAvatarProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { stats, progress } = useGamification();

  const [profile, setProfile] = useState<StudentProfileSN>(getSavedStudentProfile);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    const saved = getSavedStudentProfile();
    return (
      saved.avatarUrl ||
      localStorage.getItem("hippocampus_user_avatar_url") ||
      null
    );
  });
  const [planBadge, setPlanBadge] = useState(getActivePlanBadge);
  const [justGainedXp, setJustGainedXp] = useState(false);

  // État d'authentification (permet de rester sur la Landing Page en mode déconnecté)
  const [isLoggedOut, setIsLoggedOut] = useState<boolean>(() => {
    return localStorage.getItem(AUTH_STATUS_STORAGE_KEY) === "false";
  });

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useNotifications();

  const isPublicLandingPage = PUBLIC_LANDING_PATHS.includes(location.pathname);

  // Dès que l'utilisateur entre dans une page du Dashboard, il est considéré comme connecté
  useEffect(() => {
    if (!isPublicLandingPage && location.pathname !== "/auth") {
      localStorage.setItem(AUTH_STATUS_STORAGE_KEY, "true");
      setIsLoggedOut(false);
    }
  }, [location.pathname, isPublicLandingPage]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        localStorage.setItem(AUTH_STATUS_STORAGE_KEY, "true");
        setIsLoggedOut(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        localStorage.setItem(AUTH_STATUS_STORAGE_KEY, "true");
        setIsLoggedOut(false);
      }
    });

    const syncAll = () => {
      const nextProfile = getSavedStudentProfile();
      setProfile(nextProfile);
      setAvatarUrl(
        nextProfile.avatarUrl ||
          localStorage.getItem("hippocampus_user_avatar_url") ||
          null
      );
      setPlanBadge(getActivePlanBadge());
      setIsLoggedOut(
        localStorage.getItem(AUTH_STATUS_STORAGE_KEY) === "false"
      );
    };

    const pulseXp = () => {
      setJustGainedXp(true);
      setPlanBadge(getActivePlanBadge());
      setTimeout(() => setJustGainedXp(false), 1200);
    };

    window.addEventListener("hippocampus-profile-updated", syncAll);
    window.addEventListener("hippocampus-stats-updated", syncAll);
    window.addEventListener("dawjang-auth-changed", syncAll);
    window.addEventListener("dawjang-xp-earned", pulseXp);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("hippocampus-profile-updated", syncAll);
      window.removeEventListener("hippocampus-stats-updated", syncAll);
      window.removeEventListener("dawjang-auth-changed", syncAll);
      window.removeEventListener("dawjang-xp-earned", pulseXp);
    };
  }, []);

  /**
   * DÉCONNEXION INTELLIGENTE SELON LA PAGE ACTIVE :
   * - Si on est sur la Landing Page ("/") ou une page publique ("/tarifs", "/confidentialite", "/conditions") :
   *   on déconnecte la session mais ON RESTE SUR PLACE sans rediriger vers "/auth".
   * - Si on est dans le Dashboard ou l'une de ses pages internes :
   *   on déconnecte et ON REDIRIGE VERS "/auth".
   */
  const handleSignOut = async () => {
    localStorage.setItem(AUTH_STATUS_STORAGE_KEY, "false");
    setIsLoggedOut(true);
    window.dispatchEvent(new CustomEvent("dawjang-auth-changed"));

    try {
      await supabase.auth.signOut();
    } catch {
      // Poursuit proprement même hors-ligne
    }

    if (isPublicLandingPage) {
      toast({
        title: "Session déconnectée",
        description: "Vous êtes déconnecté et restez sur cette page.",
      });
      return;
    }

    navigate("/auth", { replace: true });
  };

  // Si l'utilisateur vient de se déconnecter sur la Landing Page, affiche un bouton "Se connecter" sobre
  if (isLoggedOut && isPublicLandingPage) {
    return (
      <Link
        to="/auth"
        className="inline-flex items-center gap-2 rounded-2xl border border-border/90 bg-card/90 hover:border-primary/50 hover:text-primary px-3.5 py-2 text-[12.5px] font-semibold text-foreground shadow-2xs transition-all"
      >
        <LogIn className="h-3.5 w-3.5 text-primary" />
        <span>Se connecter</span>
      </Link>
    );
  }

  const initials =
    profile.fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "DJ";

  const isOnLanding = location.pathname === "/";

  return (
    <div
      className={cn(
        "flex items-center",
        collapsed && !inHeader
          ? "flex-col-reverse gap-1.5 w-full justify-center"
          : "justify-between w-full min-w-0 gap-1"
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={`${profile.fullName} • LV.${stats.level} (${planBadge.planName})`}
            className={cn(
              "group relative flex items-center rounded-xl text-left transition-all duration-200 focus:outline-none",
              collapsed && !inHeader
                ? "h-9 w-9 justify-center mx-auto"
                : inHeader
                ? "gap-2.5 rounded-2xl border border-border/80 bg-card/90 hover:border-foreground/30 px-2.5 py-1.5 shadow-2xs"
                : "gap-1.5 p-0.5"
            )}
          >
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background font-semibold text-[12px] shadow-xs transition-transform duration-200 group-hover:scale-[1.03]">
              {profile.avatarUrl || avatarUrl ? (
                <img
                  src={(profile.avatarUrl || avatarUrl) as string}
                  alt={profile.fullName}
                  className="h-9 w-9 rounded-xl object-cover border border-border"
                />
              ) : (
                initials
              )}

              <span
                className={cn(
                  "absolute -top-1.5 -right-2 z-10 inline-flex items-center px-1.5 py-[1px] rounded-full border font-mono text-[8.5px] font-bold shadow-2xs transition-all duration-300",
                  justGainedXp
                    ? "bg-primary border-primary text-primary-foreground scale-110"
                    : "bg-secondary border-border text-foreground"
                )}
              >
                LV.{stats.level}
              </span>

              <PlanTierIconBadge
                tier={planBadge.tier}
                size="xs"
                className="absolute -bottom-1 -right-1.5 z-10 ring-2 ring-background"
              />
            </div>

            {(!collapsed || inHeader) && (
              <div
                className={cn(
                  "flex flex-col justify-center min-w-0 py-0.5",
                  inHeader ? "hidden sm:flex max-w-[85px]" : "max-w-[74px]"
                )}
              >
                <span className="text-[12px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {profile.fullName}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {profile.studyLevel} •{" "}
                  <strong className="font-mono text-primary">
                    {stats.xp}
                  </strong>
                </span>
              </div>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side={collapsed && !inHeader ? "right" : "bottom"}
          align={inHeader ? "end" : "start"}
          sideOffset={10}
          className="w-68 rounded-2xl p-2 shadow-2xl border-border/90 bg-card/95 backdrop-blur-xl z-[80]"
        >
          <div className="rounded-xl bg-secondary/50 border border-border/70 p-3 mb-1.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate">
                  {profile.fullName}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {profile.studyLevel} • {planBadge.planName}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <PlanTierIconBadge tier={planBadge.tier} size="sm" />
                <span className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-primary/15 text-primary">
                  LV.{stats.level}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-muted-foreground">{stats.rankTitle}</span>
                <span className="text-foreground font-medium tabular-nums">
                  {stats.xp} / {stats.nextLevelXp} XP
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <DropdownMenuItem
            onClick={() => navigate("/")}
            className={cn(
              "cursor-pointer rounded-lg text-[13px] py-2 gap-2.5 font-medium",
              isOnLanding && "bg-primary/10 text-primary font-semibold"
            )}
          >
            <Home className="h-4 w-4 text-primary" />
            <span>Page d'accueil</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => navigate("/dashboard")}
            className={cn(
              "cursor-pointer rounded-lg text-[13px] py-2 gap-2.5 font-medium",
              location.pathname === "/dashboard" &&
                "bg-primary/10 text-primary font-semibold"
            )}
          >
            <LayoutDashboard className="h-4 w-4 text-primary" />
            <span>Tableau de bord (Studio)</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => navigate("/subscription")}
            className="cursor-pointer rounded-lg text-[13px] py-2 gap-2.5"
          >
            <CreditCard className="h-4 w-4 text-primary" />
            <span>Ma Souscription & Crédits ({stats.daysRemaining}j)</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => navigate("/settings")}
            className="cursor-pointer rounded-lg text-[13px] py-2 gap-2.5"
          >
            <Award className="h-4 w-4 text-primary" />
            <span>Paramètres & Carte Membre</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer rounded-lg text-[13px] py-2 gap-2.5 text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            <span>Se déconnecter</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center gap-1 shrink-0 ml-auto">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Centre de notifications"
              title="Notifications"
              className={cn(
                "group/bell relative flex items-center justify-center rounded-xl text-stone-600 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white transition-all duration-200 shrink-0",
                collapsed && !inHeader
                  ? "h-8 w-8 border border-border/70 bg-card/70 hover:bg-card"
                  : inHeader
                  ? "h-9 w-9 rounded-xl border border-border/80 bg-card/90 hover:border-foreground/30"
                  : "h-7 w-7 rounded-lg hover:bg-[#D5C9B3] dark:hover:bg-stone-800"
              )}
            >
              <Bell className="h-3.5 w-3.5 transition-transform duration-200 group-hover/bell:scale-110" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold text-primary-foreground shadow-2xs ring-2 ring-background">
                  {unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>

          <PopoverContent
            side={collapsed && !inHeader ? "right" : "bottom"}
            align={inHeader ? "end" : "start"}
            sideOffset={10}
            className="w-[min(92vw,350px)] rounded-2xl border border-border/90 bg-card/95 backdrop-blur-xl p-0 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] overflow-hidden z-[80]"
          >
            <div className="flex items-center justify-between border-b border-border/80 bg-secondary/35 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-foreground">
                  Centre d'activité
                </span>
                {unreadCount > 0 && (
                  <span className="rounded-md border border-primary/25 bg-primary/12 px-1.5 py-[1px] font-mono text-[10px] font-bold text-primary">
                    {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-card hover:text-primary transition-colors"
                  >
                    <Check className="h-3 w-3" />
                    <span>Tout lire</span>
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearNotifications}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-card rounded-lg transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[320px] overflow-y-auto divide-y divide-border/60 scrollbar-none">
              {notifications.length === 0 ? (
                <div className="py-10 px-6 text-center space-y-1.5">
                  <p className="text-[13px] font-medium text-foreground">
                    Aucune notification en attente
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">
                    Vos gains d'XP, imports de cours et passages de paliers LV.
                    s'afficheront ici.
                  </p>
                </div>
              ) : (
                notifications.map((n) => {
                  const isDel = /supprimé|retiré|vidé/.test(
                    `${n.title} ${n.message}`.toLowerCase()
                  );
                  return (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={cn(
                        "flex items-start gap-3 p-3.5 cursor-pointer transition-colors hover:bg-secondary/45",
                        !n.read && "bg-primary/[0.04]"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
                          isDel
                            ? "border-[#C96442]/30 bg-[#C96442]/12 text-[#C96442]"
                            : n.type === "level_up" || n.type === "badge"
                            ? "border-amber-500/35 bg-amber-500/12 text-amber-600 dark:text-amber-400"
                            : "border-primary/30 bg-primary/12 text-primary"
                        )}
                      >
                        {isDel ? (
                          <Trash2 className="h-3.5 w-3.5" />
                        ) : n.type === "level_up" || n.type === "badge" ? (
                          <Trophy className="h-3.5 w-3.5" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12.5px] font-semibold text-foreground truncate flex items-center gap-1.5">
                            {!n.read && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            )}
                            {n.title}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                            {n.createdAt}
                          </span>
                        </div>
                        {n.message && (
                          <p className="text-[11.5px] text-muted-foreground leading-snug line-clamp-2">
                            {n.message}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
        {extraActions}
      </div>
    </div>
  );
}

export default UserAvatar;
