import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import AppSidebar from "./AppSidebar";
import MorChatWidget from "./MorChatWidget";
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const showSidebar = user && location.pathname !== "/" && location.pathname !== "/auth";
  const isCommunityPage = location.pathname === "/community";

  useRevisionReminder(!!user);

  return (
    <div className="min-h-screen bg-background bg-doodle-watermark overflow-x-hidden">
      <OfflineIndicator />
      <GamificationProvider>
        <OnboardingProvider>
          {showSidebar && (
            <AppSidebar 
              user={user} 
              isCollapsed={isSidebarCollapsed} 
              onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
            />
          )}
          <main className={cn(
            "transition-all duration-300 min-w-0",
            showSidebar ? (isSidebarCollapsed ? "md:ml-[100px]" : "md:ml-[282px]") : "min-w-0"
          )}>
            {children}
          </main>
          
          {/* Mor widget: hidden on community page to avoid overlap with Telegram */}
          {user && !isCommunityPage && <MorChatWidget />}
          
          {/* Telegram widget: only on community page */}
          {user && isCommunityPage && <TelegramWidget />}
          
          {user && <GlobalSearch />}
        </OnboardingProvider>
      </GamificationProvider>
    </div>
  );
};

export default Layout;
