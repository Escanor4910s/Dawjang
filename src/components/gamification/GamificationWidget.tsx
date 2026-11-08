// src/components/gamification/GamificationWidget.tsx
import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Flame,
  ChevronRight,
  ShieldCheck,
  Trophy,
  User,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGamification } from "@/hooks/useGamification";
import {
  BadgeDisplay,
  getStoredQuestBadges,
} from "./BadgeDisplay";
import { cn } from "@/lib/utils";

const DAYS_HEADER = ["L", "M", "M", "J", "V", "S", "D"];

const REGULARITY_WEEKS = [
  [2, 3, 1, 4, 3, 2, 1],
  [3, 4, 2, 3, 4, 3, 2],
  [2, 3, 4, 4, 3, 2, 3],
  [4, 3, 4, 2, 4, 3, 4],
];

export function GamificationWidget() {
  const { stats, progress, lastXpGain } = useGamification();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    localStorage.getItem("hippocampus_user_avatar_url")
  );
  const [inspectOpen, setInspectOpen] = useState(false);
  const [unlockedCount, setUnlockedCount] = useState<number>(
    () => getStoredQuestBadges().filter((b) => b.unlocked).length
  );

  useEffect(() => {
    const syncAvatarAndBadges = () => {
      setAvatarUrl(localStorage.getItem("hippocampus_user_avatar_url"));
      setUnlockedCount(getStoredQuestBadges().filter((b) => b.unlocked).length);
    };

    supabase.auth.getUser().then(({ data }) => {
      const metaPhoto =
        data?.user?.user_metadata?.avatar_url ||
        data?.user?.user_metadata?.picture ||
        null;
      if (metaPhoto && !localStorage.getItem("hippocampus_user_avatar_url")) {
        setAvatarUrl(metaPhoto);
        localStorage.setItem("hippocampus_user_avatar_url", metaPhoto);
      }
    });

    window.addEventListener("hippocampus-profile-updated", syncAvatarAndBadges);
    window.addEventListener("hippocampus-stats-updated", syncAvatarAndBadges);
    window.addEventListener("hippocampus-badges-updated", syncAvatarAndBadges);
    return () => {
      window.removeEventListener("hippocampus-profile-updated", syncAvatarAndBadges);
      window.removeEventListener("hippocampus-stats-updated", syncAvatarAndBadges);
      window.removeEventListener("hippocampus-badges-updated", syncAvatarAndBadges);
    };
  }, []);

  return (
    <>
      <div className="group rounded-2xl border border-border/85 bg-card p-5 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-200 hover:border-foreground/25">
        {/* Indicateur du dernier gain d'XP en direct */}
        {lastXpGain && (
          <div className="rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2.5 flex items-center justify-between gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[12px] font-medium text-foreground truncate">
                {lastXpGain.reason}
              </span>
            </div>
            <span className="font-mono text-[11.5px] font-bold text-primary shrink-0">
              +{lastXpGain.amount} XP
            </span>
          </div>
        )}

        {/* 1. EN-TÊTE : PHOTO UPLOADÉE + LV. DYNAMIQUE */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative h-12 w-12 shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar utilisateur"
                  className="h-12 w-12 rounded-2xl object-cover border border-border shadow-sm"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/35 bg-primary/12 text-primary shadow-sm">
                  <User className="h-5 w-5" />
                </div>
              )}
              <span className="absolute -top-1.5 -right-2 rounded-full bg-secondary border border-border px-1.5 py-[1px] font-mono text-[9px] font-bold text-foreground shadow-sm">
                LV.{stats.level}
              </span>
              {stats.isPremium && (
                <span className="absolute -bottom-1.5 -right-2 rounded-full bg-primary px-1.5 py-[1px] font-mono text-[8px] font-bold uppercase text-primary-foreground ring-2 ring-card">
                  PRO
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11.5px] font-bold text-primary">
                  LV. {stats.level}
                </span>
                <span className="text-border">•</span>
                <h3 className="text-[14px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {stats.rankTitle}
                </h3>
              </div>
              <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate">
                Prochain palier dans{" "}
                <strong className="font-mono text-foreground">
                  {Math.max(0, stats.nextLevelXp - stats.xp).toLocaleString("fr-FR")} XP
                </strong>
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 rounded-xl bg-secondary/80 border border-border/70 px-2.5 py-1 font-mono text-[11.5px] font-semibold text-foreground shrink-0">
            <Flame className="h-3.5 w-3.5 text-primary" />
            {stats.streak} j
          </span>
        </div>

        {/* 2. BARRE D'EXPÉRIENCE TEMPS RÉEL */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11.5px] font-mono">
            <span className="text-muted-foreground">
              Expérience LV. {stats.level}
            </span>
            <span className="font-semibold text-foreground tabular-nums">
              {stats.xp.toLocaleString("fr-FR")} /{" "}
              {stats.nextLevelXp.toLocaleString("fr-FR")} XP ({progress}%)
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10.5px] font-mono text-muted-foreground pt-0.5">
            <span>XP totaux cumulés</span>
            <span className="text-foreground font-semibold">
              {stats.totalXp.toLocaleString("fr-FR")} XP
            </span>
          </div>
        </div>

        {/* 3. CANVAS DE RÉGULARITÉ (MATRICE COMPACTE 7 JOURS x 4 SEMAINES) */}
        <div className="rounded-xl border border-border/75 bg-background/50 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-semibold text-foreground">
              Canvas de régularité (28j)
            </span>
            <span className="font-mono text-[11px] text-primary font-semibold">
              96% actif
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center font-mono text-[10px] text-muted-foreground">
            {DAYS_HEADER.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className="space-y-1.5">
            {REGULARITY_WEEKS.map((week, wIdx) => (
              <div key={wIdx} className="grid grid-cols-7 gap-1.5">
                {week.map((intensity, dIdx) => (
                  <div
                    key={dIdx}
                    className={cn(
                      "h-5 w-full rounded-[5px] transition-all duration-150 hover:scale-105",
                      intensity === 0
                        ? "bg-secondary border border-border/50"
                        : intensity === 1
                        ? "bg-primary/25"
                        : intensity === 2
                        ? "bg-primary/50"
                        : intensity === 3
                        ? "bg-primary/75"
                        : "bg-primary shadow-[0_1px_4px_rgba(201,100,66,0.25)]"
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* 4. BOUTON QUÊTES & MÉDAILLES */}
        <div className="pt-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>{unlockedCount} / 30 médailles débloquées</span>
          </div>

          <button
            type="button"
            onClick={() => setInspectOpen(true)}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
          >
            <span>Quêtes & Badges</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <Dialog open={inspectOpen} onOpenChange={setInspectOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-normal">
              Système de Paliers LV., Quêtes & Médailles
            </DialogTitle>
          </DialogHeader>
          <BadgeDisplay />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default GamificationWidget;
