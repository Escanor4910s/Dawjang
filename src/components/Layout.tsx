import React, { useState, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { MorChatWidget } from "@/components/MorChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import { DawJangDragonIcon, DawJangWordmark } from "@/components/landing/HippocampusLogo";
import { FocusProvider } from "@/hooks/useFocusMode";
import { GamificationProvider } from "./gamification/GamificationProvider";
import { useRevisionReminder } from "@/hooks/useNotifications";
import { usePresence } from "@/hooks/usePresence";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children?: React.ReactNode;
}

function LayoutContent({ children }: LayoutProps) {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Services d'arrière-plan essentiels
  useRevisionReminder(!!user);
  usePresence(user?.id || null);

  // Détection de défilement pour la barre discrète auto-masquante
  const handleScroll = () => {
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 850);
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // La Landing page (Index) reste 100% intouchée sans châssis interne
  const isLandingPage = location.pathname === "/";
  if (isLandingPage) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground">
        {children ?? <Outlet />}
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground selection:bg-primary/15 selection:text-primary">
        {/* Sidebar latérale gauche unifiée */}
        <AppSidebar />

        {/* Zone de travail principale — Sans marge, sans creux de 0,5cm, contact direct avec les bords du navigateur */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <main
            ref={mainRef}
            onScroll={handleScroll}
            className={cn(
              "relative flex-1 flex flex-col bg-[#FAF8F5] dark:bg-[#11100F] overflow-y-auto overflow-x-hidden w-full transition-colors",
              isScrolling && "is-scrolling"
            )}
          >
            {/* Header mobile adaptatif unifié (md:hidden) avec Drawer Trigger, Titre et profil */}
            <header className="sticky top-0 z-30 flex items-center justify-between px-3.5 py-2.5 bg-[#FAF8F5]/95 dark:bg-[#141312]/95 backdrop-blur-md border-b border-[#EAE4DC] dark:border-stone-800 md:hidden">
              <div className="flex items-center gap-2.5 min-w-0">
                <SidebarTrigger className="h-8 w-8 rounded-lg bg-white dark:bg-stone-900 border border-[#E5DEC9] dark:border-stone-800 shadow-2xs text-foreground" />
                <div className="flex items-center gap-2 min-w-0">
                  <DawJangDragonIcon className="h-6 w-6 text-foreground shrink-0" />
                  <DawJangWordmark size="sm" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <ThemeToggle />
                <UserAvatar inHeader />
              </div>
            </header>

            {/* Indicateur hors-ligne */}
            <OfflineIndicator />

            {/* Conteneur de page pleine largeur sans triple cadre ni marges blanches parasites */}
            <div
              className={cn(
                "flex-1 w-full",
                location.pathname.startsWith("/dashboard") ||
                  location.pathname.startsWith("/summaries") ||
                  location.pathname.startsWith("/summary/") ||
                  location.pathname.startsWith("/library") ||
                  location.pathname.startsWith("/smart-flashcards") ||
                  location.pathname.startsWith("/quiz") ||
                  location.pathname.startsWith("/infini")
                  ? "p-0 max-w-none"
                  : "max-w-[1600px] mx-auto px-3.5 py-4 sm:px-6 sm:py-6 md:px-8 md:py-6"
              )}
            >
              {children ?? <Outlet />}
            </div>
          </main>
        </div>

        {/* Assistant clinique flottant MOR */}
        <MorChatWidget />
      </div>
    </SidebarProvider>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <FocusProvider>
      <GamificationProvider>
        <LayoutContent>{children}</LayoutContent>
      </GamificationProvider>
    </FocusProvider>
  );
}

export default Layout;