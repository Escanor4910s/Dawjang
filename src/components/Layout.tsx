import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import AppSidebar from "./AppSidebar";
import AgentMor from "./AgentMor";
import TelegramWidget from "./TelegramWidget";
import OfflineIndicator from "./OfflineIndicator";
import GlobalSearch from "./GlobalSearch";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingProvider } from "./onboarding/OnboardingProvider";
import { GamificationProvider } from "./gamification/GamificationProvider";
import { useRevisionReminder } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

interface LayoutProps { children: React.ReactNode; }

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const showSidebar = user && location.pathname !== "/" && location.pathname !== "/auth";
  const isCommunityPage = location.pathname === "/community";

  useRevisionReminder(!!user);

  return (
    <div className="min-h-screen bg-transparent bg-doodle-watermark flex flex-col lg:flex-row relative z-10">
      <OfflineIndicator />
      <GamificationProvider>
        <OnboardingProvider>
          {showSidebar && (
            <div className="lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:z-40">
              <AppSidebar 
                user={user} 
                isCollapsed={isSidebarCollapsed} 
                onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
              />
            </div>
          )}
          <main className="flex-1 min-w-0 flex flex-col relative z-0 w-full">
            {children}
          </main>
          
          {/* Mor widget: hidden on community page to avoid overlap with Telegram */}
          {user && !isCommunityPage && <AgentMor />}
          
          {/* Telegram widget: only on community page */}
          {user && isCommunityPage && <TelegramWidget />}
          
          {user && <GlobalSearch />}
        </OnboardingProvider>
      </GamificationProvider>
    </div>
  );
};

export default Layout;
