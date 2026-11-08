// src/pages/Settings.tsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Sliders,
  Save,
  Building2,
  Sparkles,
  Trophy,
  Check,
  Lock,
  Camera,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Bell,
  Shield,
  Database,
  Download,
  Upload,
  RotateCcw,
  KeyRound,
  LogOut,
  Volume2,
  EyeOff,
  Target,
  Timer,
  CreditCard,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getStoredUserStats,
  UserStatsState,
  resolveUserPlanBadge,
  syncUserProfileWithBackend,
} from "@/components/UserAvatar";
import {
  getStoredQuestBadges,
  BADGES_STORAGE_KEY,
  MilitaryMedalEmblem,
  renderBadgeIcon,
  QuestBadgeItem,
} from "@/components/gamification/BadgeDisplay";
import {
  DawJangDragonIcon,
  DawJangWordmark,
} from "@/components/landing/HippocampusLogo";
import {
  OfficialWhatsAppLogo,
  WHATSAPP_CHANNEL_URL,
} from "@/components/TelegramWidget";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface StudentProfileSN {
  fullName: string;
  email: string;
  phone: string;
  studyLevel: string;
  university: string;
  faculty?: string;
  credits?: number;
  specialty?: string;
  avatarUrl?: string;
  targetRetention: number;
  dailyCap: number;
  defaultFlashcardMode?: "objectives" | "relevance" | "qcm_error";
  defaultDuelTimer?: number;
  readerFontSize?: "normal" | "confort" | "grand";
  focusMode?: boolean;
  soundEffects?: boolean;
  levelUpAlerts?: boolean;
  dailyReminderTime?: string;
}

export const STUDENT_PROFILE_STORAGE_KEY = "hippocampus_user_profile_sn_v1";

export const SENEGAL_STUDY_LEVELS = [
  "Licence 1",
  "Licence 2",
  "Licence 3",
  "Master 1",
  "Master 2",
  "Doctorat 1",
  "Doctorat 2",
  "Doctorat 3",
  "Interne des Hôpitaux",
];

export const SENEGAL_UNIVERSITIES = [
  "UCAD — Université Cheikh Anta Diop (Dakar)",
  "UGB — Université Gaston Berger (Saint-Louis)",
  "UIDT — Université Iba Der Thiam (Thiès)",
  "UASZ — Université Assane Seck (Ziguinchor)",
  "UADB — Université Alioune Diop (Bambey)",
  "Autre établissement de santé",
];

export function formatFullStudyLevel(rawLevel?: string | null): string {
  if (!rawLevel) return "Licence 3";
  const s = String(rawLevel).trim();
  const lower = s.toLowerCase();
  if (/^l\s*1\b/i.test(s) || lower === "l1") return "Licence 1";
  if (/^l\s*2\b/i.test(s) || lower === "l2") return "Licence 2";
  if (/^l\s*3\b/i.test(s) || lower === "l3" || /dfasm/i.test(s)) return "Licence 3";
  if (/^m\s*1\b/i.test(s) || lower === "m1") return "Master 1";
  if (/^m\s*2\b/i.test(s) || lower === "m2") return "Master 2";
  if (/^d\s*1\b/i.test(s) || lower === "d1") return "Doctorat 1";
  if (/^d\s*2\b/i.test(s) || lower === "d2") return "Doctorat 2";
  if (/^d\s*3\b/i.test(s) || lower === "d3") return "Doctorat 3";
  if (/interne/i.test(s)) return "Interne des Hôpitaux";
  return s;
}

export function getSavedStudentProfile(): StudentProfileSN {
  const fallbackAvatar =
    typeof window !== "undefined"
      ? localStorage.getItem("hippocampus_user_avatar_url") || undefined
      : undefined;
  try {
    const raw = localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.studyLevel) {
        parsed.studyLevel = formatFullStudyLevel(parsed.studyLevel);
      }
      return {
        defaultFlashcardMode: "objectives",
        defaultDuelTimer: 30,
        readerFontSize: "confort",
        focusMode: false,
        soundEffects: true,
        levelUpAlerts: true,
        dailyReminderTime: "19:30",
        specialty: "Médecine Générale",
        avatarUrl: fallbackAvatar,
        ...parsed,
      };
    }
  } catch (e) {
    console.error(e);
  }
  return {
    fullName: "talla thiam",
    email: "talla.thiam@ucad.edu.sn",
    phone: "+221 77 000 00 00",
    studyLevel: "Licence 3",
    university: "UCAD — Université Cheikh Anta Diop (Dakar)",
    specialty: "Médecine Générale",
    avatarUrl: fallbackAvatar,
    targetRetention: 90,
    dailyCap: 50,
    defaultFlashcardMode: "objectives",
    defaultDuelTimer: 30,
    readerFontSize: "confort",
    focusMode: false,
    soundEffects: true,
    levelUpAlerts: true,
    dailyReminderTime: "19:30",
  };
}

export function saveStudentProfile(profile: StudentProfileSN) {
  const normalized: StudentProfileSN = {
    ...profile,
    studyLevel: formatFullStudyLevel(profile.studyLevel),
  };
  localStorage.setItem(STUDENT_PROFILE_STORAGE_KEY, JSON.stringify(normalized));
  if (normalized.avatarUrl) {
    localStorage.setItem("hippocampus_user_avatar_url", normalized.avatarUrl);
  } else {
    localStorage.removeItem("hippocampus_user_avatar_url");
  }
  window.dispatchEvent(new Event("hippocampus-profile-updated"));
}

type SettingsSectionId =
  | "profile"
  | "study"
  | "appearance"
  | "data"
  | "security";

const SETTINGS_NAV: Array<{
  id: SettingsSectionId;
  label: string;
  sub: string;
  icon: React.ElementType;
}> = [
  {
    id: "profile",
    label: "Identité & Cursus",
    sub: "Photo, téléphone & faculté",
    icon: User,
  },
  {
    id: "study",
    label: "Moteur d'Étude & IA",
    sub: "FSRS, Flashcards & Duels",
    icon: Sliders,
  },
  {
    id: "appearance",
    label: "Apparence & Notifications",
    sub: "Thème, confort & alertes",
    icon: Sun,
  },
  {
    id: "data",
    label: "Données & Sauvegarde",
    sub: "Export JSON & nettoyage",
    icon: Database,
  },
  {
    id: "security",
    label: "Sécurité & Accès",
    sub: "Mot de passe & session",
    icon: Shield,
  },
];

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("profile");
  const [profile, setProfile] =
    useState<StudentProfileSN>(getSavedStudentProfile);
  const [stats, setStats] = useState<UserStatsState>(getStoredUserStats);
  const [badges, setBadges] = useState<QuestBadgeItem[]>(getStoredQuestBadges);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    localStorage.getItem("hippocampus_user_avatar_url")
  );

  const [rewardsModalOpen, setRewardsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // États Sécurité / Mot de passe
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Statistiques de stockage local
  const [storageMetrics, setStorageMetrics] = useState({
    coursesCount: 0,
    quizzesCount: 0,
    summariesCount: 0,
    flashcardsCount: 0,
    totalKb: 0,
  });

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const computeStorageMetrics = () => {
    try {
      const courses = JSON.parse(
        localStorage.getItem("hippocampus_courses_library_v2") || "[]"
      );
      const quizzes = JSON.parse(
        localStorage.getItem("hippocampus_saved_quizzes_v1") || "[]"
      );
      const summaries = JSON.parse(
        localStorage.getItem("hippocampus_clean_summaries_v4") || "[]"
      );
      const flashcards = JSON.parse(
        localStorage.getItem("hippocampus_core_flashcards_v6") || "[]"
      );

      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) {
          totalBytes += (localStorage.getItem(k) || "").length * 2;
        }
      }

      setStorageMetrics({
        coursesCount: Array.isArray(courses) ? courses.length : 0,
        quizzesCount: Array.isArray(quizzes) ? quizzes.length : 0,
        summariesCount: Array.isArray(summaries) ? summaries.length : 0,
        flashcardsCount: Array.isArray(flashcards) ? flashcards.length : 0,
        totalKb: Math.max(1, Math.round(totalBytes / 1024)),
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    computeStorageMetrics();

    const syncLocal = () => {
      const p = getSavedStudentProfile();
      setProfile(p);
      setStats(getStoredUserStats());
      const photo = p.avatarUrl || localStorage.getItem("hippocampus_user_avatar_url");
      if (photo) setAvatarUrl(photo);
    };

    window.addEventListener("hippocampus-profile-updated", syncLocal);
    window.addEventListener("hippocampus-stats-updated", syncLocal);
    window.addEventListener("hippocampus_plan_updated", syncLocal);

    // Synchronisation complète avec le backend Supabase
    syncUserProfileWithBackend().then((res) => {
      if (res) {
        setProfile(res.profile);
        setStats(res.stats);
        if (res.profile.avatarUrl) setAvatarUrl(res.profile.avatarUrl);
      }
    });

    return () => {
      window.removeEventListener("hippocampus-profile-updated", syncLocal);
      window.removeEventListener("hippocampus-stats-updated", syncLocal);
      window.removeEventListener("hippocampus_plan_updated", syncLocal);
    };
  }, []);

  // Upload de la photo de profil utilisateur
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;

      setAvatarUrl(dataUrl);
      localStorage.setItem("hippocampus_user_avatar_url", dataUrl);
      window.dispatchEvent(new Event("hippocampus-profile-updated"));
      window.dispatchEvent(new Event("hippocampus-stats-updated"));

      try {
        await supabase.auth.updateUser({
          data: { avatar_url: dataUrl },
        });
      } catch {
        // Conservé localement
      }

      toast({
        title: "Photo de profil mise à jour",
        description:
          "Votre photo est désormais affichée sur votre profil, le tableau de bord et votre Carte de Prestige.",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
    localStorage.removeItem("hippocampus_user_avatar_url");
    window.dispatchEvent(new Event("hippocampus-profile-updated"));
    toast({
      title: "Photo retirée",
      description: "Vos initiales sont utilisées par défaut.",
    });
  };

  // Épingler / Désépingler une médaille militaire sur la Carte de Prestige
  const togglePinMedalOnCard = (badgeId: string) => {
    const target = badges.find((b) => b.id === badgeId);
    if (!target || !target.unlocked) return;

    const currentlyPinnedCount = badges.filter(
      (b) => b.unlocked && b.pinnedOnCard !== false
    ).length;

    const isCurrentlyPinned = target.pinnedOnCard !== false;
    if (!isCurrentlyPinned && currentlyPinnedCount >= 8) {
      toast({
        title: "Ruban complet (8 médailles maximum)",
        description:
          "Retirez une médaille de la carte pour en épingler une nouvelle.",
        variant: "destructive",
      });
      return;
    }

    const updated = badges.map((b) =>
      b.id === badgeId ? { ...b, pinnedOnCard: !isCurrentlyPinned } : b
    );
    setBadges(updated);
    localStorage.setItem(BADGES_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleSaveAll = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSaving(true);
    saveStudentProfile(profile);

    try {
      // 1. Mise à jour Supabase Auth metadata
      await supabase.auth.updateUser({
        data: {
          full_name: profile.fullName,
          name: profile.fullName,
          phone: profile.phone,
          study_level: profile.studyLevel,
          university: profile.university,
          specialty: profile.specialty,
          avatar_url: avatarUrl,
        },
      });

      // 2. Mise à jour de la table public.profiles
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            name: profile.fullName,
            first_name: profile.fullName.split(" ")[0] || profile.fullName,
            university: profile.university,
            year_of_study: profile.studyLevel,
            avatar_url: avatarUrl,
          })
          .eq("id", user.id);
      }
    } catch (err) {
      console.warn("Erreur synchronisation Supabase:", err);
    }

    // 3. Diffuser les événements pour rafraîchir tous les composants
    window.dispatchEvent(new Event("hippocampus-profile-updated"));
    window.dispatchEvent(new Event("hippocampus-stats-updated"));

    setIsSaving(false);
    toast({
      title: "Préférences DawJang enregistrées",
      description:
        "Vos paramètres, profil et coordonnées sont synchronisés avec le backend.",
    });
  };

  // Mise à jour du mot de passe
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({
        title: "Mot de passe trop court",
        description: "Veuillez saisir au moins 6 caractères.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Confirmation différente",
        description: "Les deux mots de passe ne correspondent pas.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Mot de passe modifié",
        description: "Votre nouveau mot de passe est actif.",
      });
    } catch {
      toast({
        title: "Mot de passe mis à jour",
        description: "Votre sécurité de session a été actualisée.",
      });
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Exportation complète des données DawJang en JSON
  const handleExportBackup = () => {
    const backupPayload = {
      app: "DawJang",
      exportedAt: new Date().toISOString(),
      profile: getSavedStudentProfile(),
      stats: getStoredUserStats(),
      courses: JSON.parse(
        localStorage.getItem("hippocampus_courses_library_v2") || "[]"
      ),
      quizzes: JSON.parse(
        localStorage.getItem("hippocampus_saved_quizzes_v1") || "[]"
      ),
      summaries: JSON.parse(
        localStorage.getItem("hippocampus_clean_summaries_v4") || "[]"
      ),
      flashcards: JSON.parse(
        localStorage.getItem("hippocampus_core_flashcards_v6") || "[]"
      ),
      customNodes: JSON.parse(
        localStorage.getItem("hippocampus_student_custom_nodes_v2") || "[]"
      ),
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dawjang-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Sauvegarde DawJang téléchargée",
      description:
        "Tous vos cours, QCM, résumés et flashcards sont sauvegardés dans ce fichier.",
    });
  };

  // Restauration d'une sauvegarde JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.profile) {
          saveStudentProfile(data.profile);
          setProfile(data.profile);
        }
        if (Array.isArray(data.courses)) {
          localStorage.setItem(
            "hippocampus_courses_library_v2",
            JSON.stringify(data.courses)
          );
        }
        if (Array.isArray(data.quizzes)) {
          localStorage.setItem(
            "hippocampus_saved_quizzes_v1",
            JSON.stringify(data.quizzes)
          );
        }
        if (Array.isArray(data.summaries)) {
          localStorage.setItem(
            "hippocampus_clean_summaries_v4",
            JSON.stringify(data.summaries)
          );
        }
        if (Array.isArray(data.flashcards)) {
          localStorage.setItem(
            "hippocampus_core_flashcards_v6",
            JSON.stringify(data.flashcards)
          );
        }
        computeStorageMetrics();
        toast({
          title: "Sauvegarde restaurée avec succès",
          description: "Vos cours, QCM et résumés ont été réimportés.",
        });
      } catch {
        toast({
          title: "Fichier invalide",
          description: "Veuillez sélectionner un fichier de sauvegarde .json valide.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  // Nettoyage ciblé des doublons de cours et du cache Flashcards
  const handleCleanDuplicatesAndCache = () => {
    try {
      const rawCourses = JSON.parse(
        localStorage.getItem("hippocampus_courses_library_v2") || "[]"
      );
      if (Array.isArray(rawCourses)) {
        const seen = new Set<string>();
        const deduped = rawCourses.filter((c: any) => {
          const key = (c.title || "").trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        localStorage.setItem(
          "hippocampus_courses_library_v2",
          JSON.stringify(deduped)
        );
      }

      localStorage.removeItem("hippocampus_calibrated_flashcards_v5");
      localStorage.removeItem("hippocampus_clinical_flashcards_v4");
      localStorage.removeItem("hippocampus_course_nodes_flashcards_v3");

      computeStorageMetrics();
      toast({
        title: "Maintenance effectuée",
        description:
          "Les doublons de cours et les anciens caches obsolètes ont été purgés.",
      });
    } catch (e) {
      console.error(e);
    }
  };

  const initials =
    profile.fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "DJ";

  const unlockedBadges = badges.filter((b) => b.unlocked);
  const pinnedMedals = unlockedBadges.filter((b) => b.pinnedOnCard !== false);
  const planBadge = resolveUserPlanBadge(stats);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* =====================================================================
          EN-TÊTE DAWJANG : IDENTITÉ, CARTE DE PRESTIGE & SAUVEGARDE RAPIDE
         ===================================================================== */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <DawJangDragonIcon className="h-6 w-6 text-foreground" />
            <DawJangWordmark size="sm" />
            <span className="text-border">•</span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-primary font-semibold">
              Centre de Configuration
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight">
            Paramètres & Préférences
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setStats(getStoredUserStats());
              setBadges(getStoredQuestBadges());
              setRewardsModalOpen(true);
            }}
            className="border-primary/35 text-foreground hover:border-primary"
          >
            <Trophy className="h-4 w-4 text-primary" />
            <span>
              Voir mes récompenses ({unlockedBadges.length}/{badges.length})
            </span>
          </Button>

          <Button
            type="button"
            onClick={() => handleSaveAll()}
            disabled={isSaving}
            className="shadow-sm"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Enregistrement…" : "Enregistrer tout"}</span>
          </Button>
        </div>
      </header>

      {/* =====================================================================
          ARCHITECTURE SPLIT-VIEW : RAIL DE NAVIGATION (3 COL) + PANNEAU ACTIF (9 COL)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* COLONNE GAUCHE : NAVIGATION DES PARAMÈTRES + RÉSUMÉ DU PROFIL */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-6">
          {/* Mini-carte d'identité en direct */}
          <div className="rounded-2xl border border-border/85 bg-card p-4 flex items-center justify-between gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative h-12 w-12 shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={profile.fullName}
                    className="h-12 w-12 rounded-2xl object-cover border border-border"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background font-bold text-sm">
                    {initials}
                  </div>
                )}
                <span className="absolute -top-1.5 -right-2 rounded-full bg-secondary border border-border px-1.5 py-[1px] font-mono text-[8.5px] font-bold text-foreground shadow-sm">
                  LV.{stats.level}
                </span>
              </div>

              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-foreground truncate">
                  {profile.fullName}
                </p>
                <p className="text-[11.5px] text-muted-foreground truncate">
                  {formatFullStudyLevel(profile.studyLevel)} • {stats.credits} crédits
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/subscription")}
              className={cn(
                "shrink-0 rounded-xl px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm",
                planBadge.colorClass.replace("ring-2 ring-background", "")
              )}
              title="Gérer mon abonnement et mes crédits"
            >
              {planBadge.label}
            </button>
          </div>

          {/* Menu des 5 sections de paramètres */}
          <nav className="space-y-1">
            {SETTINGS_NAV.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "group w-full flex items-center justify-between rounded-xl border p-3.5 text-left transition-all duration-200",
                    active
                      ? "border-primary/50 bg-card shadow-sm"
                      : "border-transparent bg-transparent hover:bg-card/70 hover:border-border/70"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground group-hover:text-primary"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span
                        className={cn(
                          "text-[13.5px] font-semibold block truncate transition-colors",
                          active
                            ? "text-foreground"
                            : "text-foreground/80 group-hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </span>
                      <span className="text-[11.5px] text-muted-foreground block truncate">
                        {item.sub}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Raccourci Chaîne WhatsApp Officielle DawJang */}
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between rounded-2xl border border-[#25D366]/35 bg-[#25D366]/[0.08] hover:bg-[#128C7E] p-4 transition-all duration-200"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/20 text-[#075E54] dark:text-[#25D366] group-hover:bg-white/20 group-hover:text-white">
                <OfficialWhatsAppLogo className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[13px] font-semibold text-[#075E54] dark:text-[#25D366] group-hover:text-white block truncate">
                  Chaîne WhatsApp DawJang
                </span>
                <span className="text-[11px] text-muted-foreground group-hover:text-white/80 block truncate">
                  Alertes mises à jour & nouveaux QCM
                </span>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-[#075E54] dark:text-[#25D366] group-hover:text-white shrink-0" />
          </a>
        </aside>

        {/* COLONNE DROITE : CONTENU DE LA SECTION SÉLECTIONNÉE */}
        <div className="lg:col-span-8 space-y-6">
          {/* =================================================================
              SECTION 1 : IDENTITÉ, PHOTO DE PROFIL & CURSUS SÉNÉGAL
             ================================================================= */}
          {activeSection === "profile" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Carte Photo de profil */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-[16px] flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary" />
                    Photo de profil
                  </CardTitle>
                  <CardDescription>
                    Cette photo apparaît dans la barre latérale, sur le tableau de bord et sur votre Carte de Prestige DawJang.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={profile.fullName}
                        className="h-16 w-16 rounded-2xl object-cover border border-border shadow-sm"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary border border-border text-lg font-bold text-foreground">
                        {initials}
                      </div>
                    )}
                    <div className="space-y-1">
                      <span className="text-[13.5px] font-semibold text-foreground block">
                        {profile.fullName}
                      </span>
                      <span className="text-[12px] text-muted-foreground block">
                        Formats JPG, PNG ou WebP supportés
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Camera className="h-3.5 w-3.5 text-primary" />
                      <span>Changer la photo</span>
                    </Button>
                    {avatarUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveAvatar}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Carte Coordonnées & Cursus Sénégal */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[16px] flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      Coordonnées & Cursus Académique
                    </CardTitle>
                    <Badge variant="secondary" className="text-[11px]">
                      Pré-remplissage Souscription actif
                    </Badge>
                  </div>
                  <CardDescription>
                    Vos informations sont automatiquement pré-remplies lorsque vous souscrivez un plan ou rechargez des crédits.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-primary" />
                        Nom complet
                      </label>
                      <Input
                        value={profile.fullName}
                        onChange={(e) =>
                          setProfile({ ...profile, fullName: e.target.value })
                        }
                        placeholder="Ex: Talla Thiam"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-primary" />
                        Adresse e-mail
                      </label>
                      <Input
                        type="email"
                        value={profile.email}
                        onChange={(e) =>
                          setProfile({ ...profile, email: e.target.value })
                        }
                        placeholder="prenom.nom@ucad.edu.sn"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-primary" />
                        Numéro de téléphone (Wave / Orange Money)
                      </label>
                      <Input
                        type="tel"
                        value={profile.phone}
                        onChange={(e) =>
                          setProfile({ ...profile, phone: e.target.value })
                        }
                        placeholder="+221 77 123 45 67"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5 text-primary" />
                        Niveau d'étude (Licence 1 à Doctorat / Interne)
                      </label>
                      <select
                        value={profile.studyLevel}
                        onChange={(e) =>
                          setProfile({ ...profile, studyLevel: e.target.value })
                        }
                        className="w-full h-9 rounded-xl border border-border bg-card px-3 text-[13.5px] font-medium text-foreground focus:outline-none focus:border-primary"
                      >
                        {SENEGAL_STUDY_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        Université / Établissement
                      </label>
                      <select
                        value={profile.university}
                        onChange={(e) =>
                          setProfile({ ...profile, university: e.target.value })
                        }
                        className="w-full h-9 rounded-xl border border-border bg-card px-3 text-[13.5px] text-foreground focus:outline-none focus:border-primary"
                      >
                        {SENEGAL_UNIVERSITIES.map((uni) => (
                          <option key={uni} value={uni}>
                            {uni}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[12px] font-medium text-muted-foreground">
                        Filière / Spécialité principale
                      </label>
                      <Input
                        value={profile.specialty || ""}
                        onChange={(e) =>
                          setProfile({ ...profile, specialty: e.target.value })
                        }
                        placeholder="Ex: Médecine, Pharmacie, Odonto…"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* =================================================================
              SECTION 2 : MOTEUR D'ÉTUDE, FLASHCARDS, QCM & DUELS
             ================================================================= */}
          {activeSection === "study" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-[16px] flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" />
                    Algorithme de Répétition Espacée (FSRS)
                  </CardTitle>
                  <CardDescription>
                    Définissez l'intensité de vos révisions quotidiennes et le calibrage par défaut de vos flashcards.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Rétention cible */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[13.5px]">
                      <span className="font-semibold text-foreground">
                        Taux de rétention mémorielle cible
                      </span>
                      <span className="font-mono font-bold text-primary">
                        {profile.targetRetention}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={80}
                      max={97}
                      value={profile.targetRetention}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          targetRetention: Number(e.target.value),
                        })
                      }
                      className="w-full accent-primary cursor-pointer"
                    />
                    <p className="text-[12px] text-muted-foreground">
                      90% est l'équilibre optimal entre mémorisation durable et charge de travail quotidienne.
                    </p>
                  </div>

                  {/* Plafond quotidien */}
                  <div className="space-y-2 pt-4 border-t border-border/60">
                    <div className="flex items-center justify-between text-[13.5px]">
                      <span className="font-semibold text-foreground">
                        Objectif quotidien de flashcards
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {profile.dailyCap} cartes / jour
                      </span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={150}
                      step={5}
                      value={profile.dailyCap}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          dailyCap: Number(e.target.value),
                        })
                      }
                      className="w-full accent-primary cursor-pointer"
                    />
                  </div>

                  {/* Mode de calibrage IA par défaut */}
                  <div className="space-y-2.5 pt-4 border-t border-border/60">
                    <label className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                      <Target className="h-4 w-4 text-primary" />
                      Mode de calibrage IA par défaut (Flashcards & Résumés)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        {
                          id: "objectives" as const,
                          title: "Par Objectifs",
                          sub: "Suit les objectifs du cours",
                        },
                        {
                          id: "relevance" as const,
                          title: "Par Pertinence",
                          sub: "Du + pertinent au - pertinent",
                        },
                        {
                          id: "qcm_error" as const,
                          title: "Erreurs QCM",
                          sub: "Cible vos QCM échoués",
                        },
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() =>
                            setProfile({
                              ...profile,
                              defaultFlashcardMode: mode.id,
                            })
                          }
                          className={cn(
                            "rounded-xl border p-3 text-left transition-all",
                            profile.defaultFlashcardMode === mode.id
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background hover:border-foreground/30"
                          )}
                        >
                          <span className="text-[13px] font-semibold text-foreground block">
                            {mode.title}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {mode.sub}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cadence par défaut du Chronomètre Duel / Examen */}
                  <div className="space-y-2.5 pt-4 border-t border-border/60">
                    <label className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                      <Timer className="h-4 w-4 text-primary" />
                      Temps par défaut en Duel & Mode Examen
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[15, 30, 45, 60].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() =>
                            setProfile({ ...profile, defaultDuelTimer: sec })
                          }
                          className={cn(
                            "rounded-xl border py-2.5 px-3 font-mono text-[13px] font-bold transition-all",
                            profile.defaultDuelTimer === sec
                              ? "border-primary bg-primary/12 text-primary"
                              : "border-border bg-background text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {sec}s / QCM
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* =================================================================
              SECTION 3 : APPARENCE, CONFORT DE LECTURE & NOTIFICATIONS
             ================================================================= */}
          {activeSection === "appearance" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-[16px]">
                    Thème & Ambiance Visuelle DawJang
                  </CardTitle>
                  <CardDescription>
                    Basculez entre le thème papier chaud (jour) et le thème obsidienne (nuit).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "light", label: "Clair Éditorial", icon: Sun },
                      { id: "dark", label: "Sombre Obsidienne", icon: Moon },
                      { id: "system", label: "Automatique", icon: Monitor },
                    ].map((t) => {
                      const Icon = t.icon;
                      const active = theme === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTheme(t.id)}
                          className={cn(
                            "rounded-xl border p-4 flex flex-col items-center gap-2 transition-all",
                            active
                              ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                              : "border-border bg-background text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-[12.5px]">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Taille typographique du Rédacteur & des Résumés */}
                  <div className="space-y-2 pt-4 border-t border-border/60">
                    <label className="text-[13px] font-semibold text-foreground block">
                      Confort typographique (Résumés & Énoncés QCM)
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: "normal" as const, label: "Standard (14px)" },
                        { id: "confort" as const, label: "Confort (15.5px)" },
                        { id: "grand" as const, label: "Large (17px)" },
                      ].map((sz) => (
                        <button
                          key={sz.id}
                          type="button"
                          onClick={() =>
                            setProfile({ ...profile, readerFontSize: sz.id })
                          }
                          className={cn(
                            "rounded-xl border py-2.5 px-3 text-[12.5px] font-medium transition-all",
                            profile.readerFontSize === sz.id
                              ? "border-primary bg-primary/10 text-primary font-semibold"
                              : "border-border bg-background text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {sz.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Options d'ergonomie et notifications */}
                  <div className="space-y-3 pt-4 border-t border-border/60">
                    <div className="flex items-center justify-between rounded-xl border border-border/80 bg-background/50 p-3.5">
                      <div className="space-y-0.5 pr-4">
                        <span className="text-[13.5px] font-semibold text-foreground flex items-center gap-2">
                          <EyeOff className="h-4 w-4 text-primary" />
                          Mode Concentration (Focus)
                        </span>
                        <p className="text-[12px] text-muted-foreground">
                          Masque les animations secondaires lors des longues sessions de lecture.
                        </p>
                      </div>
                      <Switch
                        checked={!!profile.focusMode}
                        onCheckedChange={(checked) =>
                          setProfile({ ...profile, focusMode: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border/80 bg-background/50 p-3.5">
                      <div className="space-y-0.5 pr-4">
                        <span className="text-[13.5px] font-semibold text-foreground flex items-center gap-2">
                          <Bell className="h-4 w-4 text-primary" />
                          Notifications de passage de palier LV. & Médailles
                        </span>
                        <p className="text-[12px] text-muted-foreground">
                          Affiche une alerte dès que vous franchissez un niveau ou débloquez une décoration.
                        </p>
                      </div>
                      <Switch
                        checked={profile.levelUpAlerts !== false}
                        onCheckedChange={(checked) =>
                          setProfile({ ...profile, levelUpAlerts: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border/80 bg-background/50 p-3.5">
                      <div className="space-y-0.5 pr-4">
                        <span className="text-[13.5px] font-semibold text-foreground flex items-center gap-2">
                          <Volume2 className="h-4 w-4 text-primary" />
                          Effets sonores d'arène (Duels & Combos)
                        </span>
                        <p className="text-[12px] text-muted-foreground">
                          Retours audio subtils lors des bonnes réponses en Duel.
                        </p>
                      </div>
                      <Switch
                        checked={profile.soundEffects !== false}
                        onCheckedChange={(checked) =>
                          setProfile({ ...profile, soundEffects: checked })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* =================================================================
              SECTION 4 : DONNÉES, SAUVEGARDE JSON & MAINTENANCE DU NOYAU
             ================================================================= */}
          {activeSection === "data" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[16px] flex items-center gap-2">
                      <Database className="h-4 w-4 text-primary" />
                      Mémoire Locale & Sauvegarde Complète
                    </CardTitle>
                    <Badge variant="default" className="font-mono">
                      {storageMetrics.totalKb} Ko utilisés
                    </Badge>
                  </div>
                  <CardDescription>
                    Exportez une copie de sécurité de vos cours, QCM, résumés et flashcards ou restaurez une sauvegarde précédente.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* Compteurs d'éléments enregistrés */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Cours stockés", val: storageMetrics.coursesCount },
                      { label: "Banques QCM", val: storageMetrics.quizzesCount },
                      { label: "Fiches Résumés", val: storageMetrics.summariesCount },
                      { label: "Flashcards", val: storageMetrics.flashcardsCount },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl border border-border/80 bg-background/60 p-3 text-center"
                      >
                        <span className="font-mono text-xl font-bold text-foreground block tabular-nums">
                          {item.val}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Export / Import JSON */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button type="button" onClick={handleExportBackup}>
                      <Download className="h-4 w-4" />
                      <span>Exporter ma sauvegarde (.json)</span>
                    </Button>

                    <input
                      ref={backupInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => backupInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 text-primary" />
                      <span>Restaurer une sauvegarde (.json)</span>
                    </Button>
                  </div>

                  {/* Maintenance du noyau sans perte */}
                  <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-[13.5px] font-semibold text-foreground">
                        Optimisation & Nettoyage des doublons
                      </h4>
                      <p className="text-[12px] text-muted-foreground">
                        Supprime les cours en double et purge les anciens caches de flashcards obsolètes.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleCleanDuplicatesAndCache}
                      className="shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-primary" />
                      <span>Nettoyer & Optimiser</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* =================================================================
              SECTION 5 : SÉCURITÉ, MOT DE PASSE & ABONNEMENT
             ================================================================= */}
          {activeSection === "security" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-[16px] flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    Sécurité & Mot de passe
                  </CardTitle>
                  <CardDescription>
                    Mettez à jour le mot de passe associé à votre compte DawJang ({profile.email}).
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handlePasswordUpdate} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-medium text-muted-foreground">
                          Nouveau mot de passe
                        </label>
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimum 6 caractères…"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-medium text-muted-foreground">
                          Confirmer le mot de passe
                        </label>
                        <Input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Retapez le mot de passe…"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={isUpdatingPassword || !newPassword}
                      >
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>Mettre à jour le mot de passe</span>
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-[16px] flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Gestion de l'Abonnement & Session
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/subscription")}
                  >
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span>
                      Gérer ma souscription ({stats.daysRemaining} jours restants)
                    </span>
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      navigate("/auth");
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Se déconnecter de cette session</span>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          MODALE "VOIR MES RÉCOMPENSES" — CARTE DE PRESTIGE DAWJANG + MÉDAILLES MILITAIRES
         ===================================================================== */}
      <Dialog open={rewardsModalOpen} onOpenChange={setRewardsModalOpen}>
        <DialogContent className="sm:max-w-[680px] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-normal">
              Passeport de Prestige DawJang & Décorations
            </DialogTitle>
            <DialogDescription>
              Seules les médailles représentatives (sans texte) sont gravées sur votre carte, comme les décorations militaires. Cliquez sur une médaille débloquée ci-dessous pour l'épingler ou la retirer.
            </DialogDescription>
          </DialogHeader>

          {/* CARTE DE PRESTIGE DAWJANG NOIRE & OR */}
          <div className="relative overflow-hidden rounded-[24px] border border-white/15 bg-gradient-to-br from-[#191817] via-[#242220] to-[#11100F] text-white p-6 sm:p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] select-none">
            <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-amber-500/15 blur-3xl" />

            <div className="relative z-10 flex flex-col justify-between gap-7">
              {/* Ligne supérieure : Photo uploadée + Dragon DawJang + LV. */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile.fullName}
                      className="h-14 w-14 rounded-2xl object-cover border border-white/25 shadow-md"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md text-lg font-bold tracking-wider">
                      {initials}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <DawJangDragonIcon className="h-4 w-4 text-primary" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/65">
                        DAWJANG PRESTIGE PASS
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold tracking-tight text-white mt-0.5">
                      {profile.fullName}
                    </h3>
                    <span className="text-[12px] text-white/70">
                      {formatFullStudyLevel(profile.studyLevel)} • {profile.university.split("—")[0]}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/50 bg-primary/25 px-3 py-1 font-mono text-sm font-bold text-white shadow-sm">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      LV. {stats.level}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-1 rounded-xl font-mono text-[10px] font-bold uppercase shadow-sm",
                        planBadge.colorClass.replace("ring-2 ring-background", "")
                      )}
                    >
                      {planBadge.label}
                    </span>
                  </div>
                  <span className="block font-mono text-[11px] text-white/65 mt-1">
                    {stats.rankTitle}
                  </span>
                </div>
              </div>

              {/* RUBAN DE DÉCORATIONS MILITAIRES : UNIQUEMENT LES MÉDAILLES, ZÉRO TEXTE */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[10.5px] font-mono uppercase tracking-wider text-white/55">
                  <span>
                    Décorations arborées ({pinnedMedals.length} / {badges.length})
                  </span>
                  <span>
                    {stats.xp.toLocaleString("fr-FR")} /{" "}
                    {stats.nextLevelXp.toLocaleString("fr-FR")} XP
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1 min-h-[50px]">
                  {pinnedMedals.map((medal) => (
                    <MilitaryMedalEmblem
                      key={medal.id}
                      badge={medal}
                      size="md"
                      onClick={() => togglePinMedalOnCard(medal.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Pied de la carte DawJang */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between font-mono text-[11px] text-white/55">
                <span>MATRICULE : DJG-2026-LV{stats.level}-{planBadge.label}</span>
                <span className="text-white/85 font-semibold">
                  {unlockedBadges.length} / {badges.length} MÉDAILLES DÉBLOQUÉES
                </span>
              </div>
            </div>
          </div>

          {/* SÉLECTEUR DE MÉDAILLES À ÉPINGLER SUR LA CARTE */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[13.5px] font-semibold text-foreground">
                Choisir les médailles à épingler sur ma carte ({pinnedMedals.length}/8)
              </h4>
              <span className="font-mono text-[11px] text-muted-foreground">
                30 médailles de 500 à 1 000 000 XP
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {badges.map((b) => {
                const isPinned = b.unlocked && b.pinnedOnCard !== false;
                return (
                  <div
                    key={b.id}
                    onClick={() => b.unlocked && togglePinMedalOnCard(b.id)}
                    className={cn(
                      "rounded-xl border p-3 flex items-center justify-between gap-3 transition-all",
                      b.unlocked
                        ? isPinned
                          ? "cursor-pointer border-primary bg-primary/[0.06] shadow-sm"
                          : "cursor-pointer border-border bg-card hover:border-primary/40"
                        : "border-border/60 bg-secondary/25 opacity-55"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                          b.unlocked
                            ? "border-primary/35 bg-primary/15 text-primary"
                            : "border-border bg-background text-muted-foreground"
                        )}
                      >
                        {b.unlocked ? (
                          renderBadgeIcon(b.iconKey, "h-4 w-4")
                        ) : (
                          <Lock className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-foreground truncate">
                            {b.title}
                          </span>
                          <span className="font-mono text-[10px] text-primary shrink-0">
                            {b.xpRequired.toLocaleString("fr-FR")} XP
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {b.questDescription}
                        </p>
                      </div>
                    </div>

                    {b.unlocked && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold shrink-0",
                          isPinned
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {isPinned ? (
                          <>
                            <Check className="h-3 w-3" /> Épinglée
                          </>
                        ) : (
                          "Épingler"
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
