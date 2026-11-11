// src/components/AppSidebar.tsx
import React, { useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  BookOpen,
  FileText,
  CheckSquare,
  Infinity as InfinityIcon,
  Layers,
  Target,
  Swords,
  MessageSquare,
  Search,
  Flame,
  Award,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Calendar,
  BarChart3,
  FileCheck2,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import {
  DawJangDragonIcon,
  DawJangWordmark,
} from "@/components/landing/HippocampusLogo";
import { useGamification } from "@/hooks/useGamification";
import {
  BadgeDisplayModal,
  AcademicBadgeCrest,
} from "@/components/gamification/BadgeDisplay";
import { cn } from "@/lib/utils";

interface NavDeck {
  id: string;
  label: string;
  shortLabel: string;
  items: {
    title: string;
    subtitle?: string;
    url: string;
    icon: React.ElementType;
  }[];
}

const NAVIGATION_DECKS: NavDeck[] = [
  {
    id: "workspace",
    label: "ESPACE DE TRAVAIL",
    shortLabel: "1. Atelier & Cours",
    items: [
      {
        title: "Tableau de bord",
        url: "/dashboard",
        icon: LayoutGrid,
      },
      {
        title: "Bibliothèque & Cours",
        url: "/library",
        icon: BookOpen,
      },
      {
        title: "Rédacteur de Résumés",
        url: "/summaries",
        icon: FileText,
      },
      {
        title: "Constructeur de QCM",
        url: "/qcm",
        icon: CheckSquare,
      },
      {
        title: "Mode Infini",
        url: "/infini",
        icon: InfinityIcon,
      },
      {
        title: "Paramètres",
        url: "/settings",
        icon: Settings,
      },
    ],
  },
  {
    id: "memorization",
    label: "MÉMORISATION & DÉFIS",
    shortLabel: "2. Mémorisation",
    items: [
      {
        title: "Smart Flashcards",
        url: "/smart-flashcards",
        icon: Sparkles,
      },
      {
        title: "Flashcards",
        url: "/flashcards",
        icon: Layers,
      },
      {
        title: "Probabilités & Ciblage",
        url: "/predictions",
        icon: Target,
      },
      {
        title: "Duels Académiques",
        url: "/duels",
        icon: Swords,
      },
      {
        title: "Planification",
        url: "/planning",
        icon: Calendar,
      },
      {
        title: "Statistiques",
        url: "/stats",
        icon: BarChart3,
      },
      {
        title: "Examens Blancs",
        url: "/examen-blanc",
        icon: FileCheck2,
      },
      {
        title: "Communauté",
        url: "/community",
        icon: MessageSquare,
      },
    ],
  },
];

export function AppSidebar() {
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const location = useLocation();
  const {
    level,
    rankTitle,
    totalXp,
    xpInCurrentLevel,
    xpRequiredForNextLevel,
    levelProgressPercent,
    streakDays,
    badges,
    unlockedBadges,
  } = useGamification();

  // État du Carrousel des Pôles de Navigation (0 = Atelier & Cours, 1 = Mémorisation & Défis)
  const [activeNavSlide, setActiveNavSlide] = useState<number>(() => {
    const isMemRoute = [
      "/flashcards",
      "/smart-flashcards",
      "/predictions",
      "/stats",
      "/duels",
      "/planning",
      "/exams",
      "/examen-blanc",
      "/examens-blancs",
      "/community",
    ].some((p) => location.pathname.startsWith(p));
    return isMemRoute ? 1 : 0;
  });

  // Synchronisation automatique du pôle actif lors des navigations SPA
  React.useEffect(() => {
    const isMemRoute = [
      "/flashcards",
      "/smart-flashcards",
      "/predictions",
      "/stats",
      "/duels",
      "/planning",
      "/exams",
      "/examen-blanc",
      "/examens-blancs",
      "/community",
    ].some((p) => location.pathname.startsWith(p));
    setActiveNavSlide(isMemRoute ? 1 : 0);
  }, [location.pathname]);

  // État du Carrousel Tactile de Pied de Sidebar (0 = Cadence 7j, 1 = Grade & XP, 2 = Objectif 100 Badges)
  const [activeFooterSlide, setActiveFooterSlide] = useState<number>(0);
  const [isBadgeVaultOpen, setIsBadgeVaultOpen] = useState<boolean>(false);

  const currentDeck = NAVIGATION_DECKS[activeNavSlide];

  const handleMobileNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const triggerQuickSearch = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
      })
    );
  };

  return (
    <>
      <Sidebar
        collapsible="icon"
        style={
          {
            "--sidebar-width": "17.25rem",
            "--sidebar-width-icon": "3.75rem",
          } as React.CSSProperties
        }
        className="border-r border-[#DFD8CA] dark:border-stone-800/80 bg-[#F2EDE4] dark:bg-[#151413] backdrop-blur-md select-none transition-all duration-300 shadow-[2px_0_20px_-8px_rgba(24,24,27,0.06)]"
      >
        <div className={cn(collapsed ? "sr-only" : "hidden")}>
          <GlobalSearch />
        </div>

        {/* ==================================================================
            1. EN-TÊTE : IDENTITÉ DAWJANG VERROUILLÉE & RECHERCHE RAPIDE
        ================================================================== */}
        <SidebarHeader
          className={cn(
            "shrink-0 pt-3 pb-2 transition-all",
            collapsed ? "px-1.5 items-center space-y-1.5" : "px-3.5 space-y-2.5"
          )}
        >
          {!collapsed ? (
            <>
              <div className="flex items-center justify-between px-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/"
                      onClick={handleMobileNavClick}
                      className="group/brand flex items-center gap-2.5 focus:outline-none"
                    >
                      {/* Dragon noir pur sans boîte ni contour blanc (Version Verrouillée) */}
                      <DawJangDragonIcon className="h-8 w-8 text-foreground transition-transform duration-300 group-hover/brand:scale-105" />
                      <div className="flex flex-col items-center">
                        <DawJangWordmark size="md" />
                        <span className="text-[10px] font-sans font-medium text-muted-foreground leading-none mt-0.5">
                          Studio Académique
                        </span>
                      </div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[11.5px]">
                    Retourner à la page d'accueil
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleSidebar}
                      aria-label="Replier le menu latéral"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors"
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-[12px]">
                    {isMobile ? "Fermer le menu" : "Replier le menu (⌘B)"}
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="w-full [&>*]:w-full">
                <GlobalSearch />
              </div>
            </>
          ) : (
            /* RAIL COMPRESSÉ : PROPORTIONS UNIFORMES 32x32px (h-8 w-8) */
            <div className="flex flex-col items-center gap-1.5 w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/"
                    aria-label="Page d'accueil DawJang"
                    className="group/logo flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 hover:scale-105"
                  >
                    <DawJangDragonIcon className="h-7 w-7 text-foreground" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-[12px] font-medium">
                  Page d'accueil DawJang
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    aria-label="Déployer le menu latéral"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-[12px]">
                  Déployer le menu (⌘B)
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={triggerQuickSearch}
                    aria-label="Recherche rapide (⌘K)"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    <Search className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-[12px]">
                  Recherche rapide (⌘K)
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </SidebarHeader>

        {/* ==================================================================
            2. CORPS : CARROUSEL DE NAVIGATION PAR PÔLES (100% RESPONSIVE MOBILE & DESKTOP)
        ================================================================== */}
        <SidebarContent
          className={cn(
            "py-1.5 flex-1 min-h-0 flex flex-col overflow-hidden",
            collapsed ? "px-1" : "px-3"
          )}
        >
          {!collapsed ? (
            <div className="flex flex-col flex-1 min-h-0 gap-2">
              {/* Sélecteur de Carrousel de Pôles (Glissière Horizontale Épinglée en Haut) */}
              <div className="shrink-0 p-1 rounded-xl bg-[#E7E0D3]/85 dark:bg-stone-900 border border-[#DCD4C4] dark:border-stone-800 flex items-center justify-between gap-1 shadow-2xs">
                {NAVIGATION_DECKS.map((deck, idx) => {
                  const isSelected = activeNavSlide === idx;
                  return (
                    <button
                      key={deck.id}
                      type="button"
                      onClick={() => setActiveNavSlide(idx)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all duration-200 truncate ${
                        isSelected
                          ? "bg-white dark:bg-stone-800 text-[#18181B] dark:text-white font-bold shadow-[0_2px_8px_-2px_rgba(24,24,27,0.08)]"
                          : "text-[#52525B] dark:text-stone-400 hover:text-[#18181B] dark:hover:text-white hover:bg-white/60 dark:hover:bg-stone-800/60"
                      }`}
                    >
                      {deck.shortLabel}
                    </button>
                  );
                })}
              </div>

              {/* En-tête du Pôle actif avec contrôles de glissement < > (Épinglé) */}
              <div className="shrink-0 flex items-center justify-between px-2 pt-0.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#71717A] dark:text-stone-400">
                  {currentDeck.label} ({currentDeck.items.length})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveNavSlide((prev) =>
                        prev === 0 ? NAVIGATION_DECKS.length - 1 : prev - 1
                      )
                    }
                    className="w-5 h-5 rounded-md hover:bg-[#EAE4DC] dark:hover:bg-stone-800 flex items-center justify-center text-[#71717A] dark:text-stone-400 hover:text-[#18181B] dark:hover:text-white transition-all active:scale-95"
                    title="Pôle précédent"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveNavSlide(
                        (prev) => (prev + 1) % NAVIGATION_DECKS.length
                      )
                    }
                    className="w-5 h-5 rounded-md hover:bg-[#EAE4DC] dark:hover:bg-stone-800 flex items-center justify-center text-[#71717A] dark:text-stone-400 hover:text-[#18181B] dark:hover:text-white transition-all active:scale-95"
                    title="Pôle suivant"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Liste défilable fluide des entrées du Pôle actif — zéro coupure sur mobile */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-0.5">
                <SidebarMenu className="space-y-0.5 sm:space-y-1 transition-all duration-300">
                  {currentDeck.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      location.pathname === item.url ||
                      location.pathname.startsWith(`${item.url}/`);

                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <NavLink
                            to={item.url}
                            onClick={handleMobileNavClick}
                            className={`group relative flex items-center justify-between px-3 py-1.5 rounded-xl text-[12.5px] transition-all duration-200 ${
                              isActive
                                ? "bg-white dark:bg-stone-800/95 text-[#18181B] dark:text-white font-bold shadow-[0_4px_12px_-4px_rgba(24,24,27,0.08)] border border-[#E5DEC9]/90 dark:border-stone-700 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-[#D96B43]"
                                : "text-[#52525B] dark:text-stone-300 hover:bg-white/75 dark:hover:bg-stone-800/70 hover:text-[#18181B] dark:hover:text-white font-medium hover:translate-x-0.5"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon
                                className={`w-4 h-4 shrink-0 transition-all duration-200 ${
                                  isActive
                                    ? "text-[#D96B43] scale-105"
                                    : "text-[#71717A] group-hover:text-[#D96B43] group-hover:scale-110"
                                }`}
                              />
                              <span className="truncate">{item.title}</span>
                            </div>
                            {isActive && (
                              <ChevronRight className="w-3.5 h-3.5 text-[#D96B43] shrink-0 group-hover:translate-x-0.5 transition-transform duration-200" />
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>

              {/* Points de pagination du Carrousel de Pôles (Épinglés en bas du corps) */}
              <div className="shrink-0 flex items-center justify-center gap-1.5 pt-0.5">
                {NAVIGATION_DECKS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveNavSlide(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      activeNavSlide === i
                        ? "w-5 bg-[#D96B43]"
                        : "w-1.5 bg-[#DFD8CA] dark:bg-stone-700"
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* RAIL COMPRESSÉ : ICÔNES DIRECTES */
            <SidebarMenu className="items-center space-y-1 overflow-y-auto">
              {NAVIGATION_DECKS.flatMap((d) => d.items).map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.url ||
                  location.pathname.startsWith(`${item.url}/`);
                return (
                  <SidebarMenuItem
                    key={item.url}
                    className="flex w-full justify-center"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <NavLink
                          to={item.url}
                          className={cn(
                            "group/rail relative flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
                            isActive
                              ? "bg-card text-[#D96B43] border border-border/90 shadow-2xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/75"
                          )}
                        >
                          {isActive && (
                            <span className="absolute -left-[6px] top-1.5 bottom-1.5 w-[2.5px] rounded-r-full bg-[#D96B43]" />
                          )}
                          <Icon
                            className="h-4 w-4 shrink-0"
                            strokeWidth={isActive ? 2.1 : 1.8}
                          />
                        </NavLink>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        sideOffset={8}
                        className="text-[12px] font-medium"
                      >
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          )}
        </SidebarContent>

        {/* ==================================================================
            3. PIED DE SIDEBAR : CARROUSEL TACTILE 3-EN-1 + PROFIL UTILISATEUR
        ================================================================== */}
        <SidebarFooter
          className={cn(
            "shrink-0 border-t border-[#EAE4DC] dark:border-stone-800/80 transition-all",
            collapsed ? "p-1.5 items-center space-y-1.5" : "p-2.5 sm:p-3 space-y-2"
          )}
        >
          {!collapsed ? (
            <>
              {/* CARROUSEL DE PROGRESSION (CADENCE 7J / PALIER XP / 100 BADGES) */}
              <div className="rounded-2xl bg-white/90 dark:bg-stone-900 border border-[#E5DEC9]/90 dark:border-stone-800 p-2.5 sm:p-3 shadow-[0_2px_10px_-4px_rgba(24,24,27,0.05)] space-y-2 hover:border-[#D96B43]/40 transition-colors">
                {/* Barre de contrôle supérieure du mini-carrousel */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveFooterSlide(idx)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          activeFooterSlide === idx
                            ? "w-4 bg-[#D96B43]"
                            : "w-1.5 bg-[#DFD8CA] dark:bg-stone-700"
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveFooterSlide((s) => (s === 0 ? 2 : s - 1))
                      }
                      className="w-5 h-5 rounded-md hover:bg-[#FAF8F5] dark:hover:bg-stone-800 flex items-center justify-center text-[#71717A] hover:text-[#18181B] dark:hover:text-white transition-all active:scale-95"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFooterSlide((s) => (s + 1) % 3)}
                      className="w-5 h-5 rounded-md hover:bg-[#FAF8F5] dark:hover:bg-stone-800 flex items-center justify-center text-[#71717A] hover:text-[#18181B] dark:hover:text-white transition-all active:scale-95"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* SLIDE 0 : Cadence d'étude & Série */}
                {activeFooterSlide === 0 && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-[#27272A] dark:text-stone-200">
                        <Flame className="w-3.5 h-3.5 text-[#D96B43]" />
                        Cadence d'étude
                      </span>
                      <span className="font-mono text-xs font-bold text-[#18181B] dark:text-white tabular-nums">
                        {streakDays} j
                      </span>
                    </div>
                    <div className="grid grid-cols-7 gap-1 pt-0.5">
                      {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                        <div
                          key={i}
                          className="flex flex-col items-center gap-1"
                        >
                          <span
                            className={`w-full h-1.5 rounded-full ${
                              i < 6 ? "bg-[#D96B43]" : "bg-[#D96B43]/25"
                            }`}
                          />
                          <span className="text-[9px] font-mono text-[#71717A]">
                            {d}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SLIDE 1 : Grade & Seuil XP Boosté */}
                {activeFooterSlide === 1 && (
                  <div className="space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#18181B] dark:text-white truncate">
                        LV.{level} • {rankTitle}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#D96B43] tabular-nums">
                        {levelProgressPercent}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#EFECE4] dark:bg-stone-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#D96B43]"
                        style={{ width: `${levelProgressPercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-mono text-[#71717A] flex justify-between tabular-nums">
                      <span>Palier rehaussé</span>
                      <span>
                        {xpInCurrentLevel.toLocaleString("fr-FR")} /{" "}
                        {xpRequiredForNextLevel.toLocaleString("fr-FR")} XP
                      </span>
                    </p>
                  </div>
                )}

                {/* SLIDE 2 : Panthéon des 100 Badges (Ouvre la galerie au clic) */}
                {activeFooterSlide === 2 && (
                  <div
                    onClick={() => setIsBadgeVaultOpen(true)}
                    className="space-y-2 cursor-pointer group animate-in fade-in duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-[#18181B] dark:text-white group-hover:text-[#D96B43] transition-colors">
                        <Award className="w-3.5 h-3.5 text-[#D96B43]" />
                        Distinctions
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#D96B43] tabular-nums">
                        {unlockedBadges.length} / 100
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 overflow-hidden py-0.5">
                      {unlockedBadges.slice(-4).map((b) => (
                        <AcademicBadgeCrest key={b.id} badge={b} size="sm" />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Carte Profil Utilisateur + Panthéon + Thème — Sans aucun débordement */}
              <div className="flex items-center justify-between rounded-2xl bg-white/90 dark:bg-stone-900 border border-[#E5DEC9]/90 dark:border-stone-800 px-2 py-1 shadow-[0_2px_10px_-4px_rgba(24,24,27,0.05)] w-full overflow-hidden hover:border-[#D96B43]/40 transition-colors">
                <UserAvatar
                  collapsed={false}
                  extraActions={
                    <>
                      <button
                        type="button"
                        onClick={() => setIsBadgeVaultOpen(true)}
                        className="w-7 h-7 rounded-lg hover:bg-[#FAF8F5] dark:hover:bg-stone-800 flex items-center justify-center text-[#52525B] dark:text-stone-300 hover:text-[#D96B43] transition-colors shrink-0"
                        title="Ouvrir le Panthéon des 100 Badges"
                      >
                        <Award className="w-3.5 h-3.5" />
                      </button>
                      <ThemeToggle />
                    </>
                  }
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5 w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsBadgeVaultOpen(true)}
                    className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-card text-[#D96B43] hover:border-[#D96B43]/50 transition-colors"
                  >
                    <Award className="h-3.5 w-3.5" />
                    <span className="absolute -top-1 -right-1 rounded-full bg-secondary border border-border px-1 font-mono text-[8px] font-bold text-foreground">
                      {unlockedBadges.length}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-[12px]">
                  Panthéon : {unlockedBadges.length}/100 badges • {streakDays}j
                </TooltipContent>
              </Tooltip>

              <UserAvatar collapsed={true} />

              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-card/70">
                <ThemeToggle />
              </div>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>

      {/* Modale des 100 Badges accessible depuis la Sidebar */}
      <BadgeDisplayModal
        isOpen={isBadgeVaultOpen}
        onClose={() => setIsBadgeVaultOpen(false)}
        badges={badges}
        totalXp={totalXp}
        level={level}
        rankTitle={rankTitle}
      />
    </>
  );
}

export default AppSidebar;


