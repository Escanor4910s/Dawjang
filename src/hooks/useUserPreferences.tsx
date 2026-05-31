import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/ThemeProvider";
import i18n from "@/lib/i18n";

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  text_size: "small" | "medium" | "large";
  font_family: "sans-serif" | "serif" | "open-sans" | "monospace";
  summary_display: "compact" | "standard" | "extended";
  language: "fr" | "en";
  notify_weekly_results: boolean;
  notify_revision_reminders: boolean;
  notify_new_qcm: boolean;
  notify_flashcard_alerts: boolean;
  notify_subscription_alerts: boolean;
}

const defaultPreferences: UserPreferences = {
  theme: "light",
  text_size: "medium",
  font_family: "sans-serif",
  summary_display: "standard",
  language: "fr",
  notify_weekly_results: true,
  notify_revision_reminders: true,
  notify_new_qcm: true,
  notify_flashcard_alerts: true,
  notify_subscription_alerts: true,
};

interface UserPreferencesContextType {
  preferences: UserPreferences;
  loading: boolean;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error("useUserPreferences must be used within a UserPreferencesProvider");
  }
  return context;
};

// Apply preferences to document
const applyPreferencesToDocument = (prefs: UserPreferences) => {
  const root = document.documentElement;
  
  // Apply text size
  root.classList.remove("text-size-small", "text-size-medium", "text-size-large");
  root.classList.add(`text-size-${prefs.text_size}`);
  
  // Apply font family
  root.classList.remove("font-sans-serif", "font-serif", "font-open-sans", "font-monospace");
  root.classList.add(`font-${prefs.font_family}`);
  
  // Store language preference and sync i18n
  root.setAttribute("lang", prefs.language);
  i18n.changeLanguage(prefs.language);
  localStorage.setItem('hippocampus-language', prefs.language);
};

export const UserPreferencesProvider = ({ children }: { children: React.ReactNode }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const { setTheme } = useTheme();

  const fetchPreferences = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: prefsData, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching preferences:", error);
      }

      if (prefsData) {
        // 🔑 FIX: localStorage is the SINGLE source of truth for theme.
        // The key MUST match what ThemeProvider uses ("quizmed-ui-theme").
        const THEME_STORAGE_KEY = "quizmed-ui-theme";
        const localStorageTheme = localStorage.getItem(THEME_STORAGE_KEY) as UserPreferences["theme"] | null;
        
        const FONT_STORAGE_KEY = "hippocampus-font-family";
        const localStorageFont = localStorage.getItem(FONT_STORAGE_KEY) as UserPreferences["font_family"] | null;

        const newPrefs: UserPreferences = {
          // Use localStorage theme if explicitly set, otherwise fall back to DB value
          theme: localStorageTheme || (prefsData.theme as UserPreferences["theme"]) || defaultPreferences.theme,
          text_size: (prefsData.text_size as UserPreferences["text_size"]) || defaultPreferences.text_size,
          font_family: localStorageFont || (prefsData.font_family as UserPreferences["font_family"]) || defaultPreferences.font_family,
          summary_display: (prefsData.summary_display as UserPreferences["summary_display"]) || defaultPreferences.summary_display,
          language: (prefsData.language as UserPreferences["language"]) || defaultPreferences.language,
          notify_weekly_results: prefsData.notify_weekly_results ?? defaultPreferences.notify_weekly_results,
          notify_revision_reminders: prefsData.notify_revision_reminders ?? defaultPreferences.notify_revision_reminders,
          notify_new_qcm: prefsData.notify_new_qcm ?? defaultPreferences.notify_new_qcm,
          notify_flashcard_alerts: prefsData.notify_flashcard_alerts ?? defaultPreferences.notify_flashcard_alerts,
          notify_subscription_alerts: prefsData.notify_subscription_alerts ?? defaultPreferences.notify_subscription_alerts,
        };
        
        setPreferences(newPrefs);
        // Only sync theme if localStorage didn't already have a value.
        // If localStorage already has the theme, ThemeProvider already applied it,
        // so calling setTheme again would cause a redundant flash.
        if (!localStorageTheme && prefsData.theme) {
          setTheme(prefsData.theme as UserPreferences["theme"]);
        }
        applyPreferencesToDocument(newPrefs);
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setLoading(false);
    }
  }, [setTheme]);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const newPrefs = { ...preferences, ...updates };
      
      // The database has a CHECK constraint: font_family IN ('sans-serif', 'serif'). 
      // We map advanced typography to 'sans-serif' for DB storage, while keeping the real value in localStorage.
      const safeDbFont = ["sans-serif", "serif"].includes(newPrefs.font_family) ? newPrefs.font_family : "sans-serif";

      // Update database
      const { error } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          theme: newPrefs.theme,
          text_size: newPrefs.text_size,
          font_family: safeDbFont,
          summary_display: newPrefs.summary_display,
          language: newPrefs.language,
          notify_weekly_results: newPrefs.notify_weekly_results,
          notify_revision_reminders: newPrefs.notify_revision_reminders,
          notify_new_qcm: newPrefs.notify_new_qcm,
          notify_flashcard_alerts: newPrefs.notify_flashcard_alerts,
          notify_subscription_alerts: newPrefs.notify_subscription_alerts,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      // Apply changes locally
      setPreferences(newPrefs);
      if (updates.theme) {
        setTheme(updates.theme);
      }
      if (updates.font_family) {
        localStorage.setItem("hippocampus-font-family", newPrefs.font_family);
      }
      applyPreferencesToDocument(newPrefs);
    } catch (error) {
      console.error("Error updating preferences:", error);
      throw error;
    }
  }, [preferences, setTheme]);

  // Listen for auth changes
  useEffect(() => {
    fetchPreferences();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        fetchPreferences();
      } else if (event === "SIGNED_OUT") {
        setPreferences(defaultPreferences);
        applyPreferencesToDocument(defaultPreferences);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchPreferences]);

  return (
    <UserPreferencesContext.Provider value={{ preferences, loading, updatePreferences, refreshPreferences: fetchPreferences }}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export { UserPreferencesContext };
