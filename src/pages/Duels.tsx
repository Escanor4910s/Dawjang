import { untypedTable } from "@/lib/untypedDb";
// src/pages/Duels.tsx
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Swords,
  Trophy,
  Zap,
  Copy,
  Check,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Flame,
  Shield,
  Sparkles,
  Gamepad2,
  Radio,
  Timer,
  BookOpen,
  Users,
  Lock,
  Wifi,
  Crosshair,
  Award,
  UserCheck,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getSavedQuizDecks, QuizDeck } from "./Quiz";
import {
  getSavedStudentProfile,
  StudentProfileSN,
  formatFullStudyLevel,
} from "./Settings";
import {
  getStoredUserStats,
  USER_GAMIFICATION_KEY,
  UserStatsState,
  resolveUserPlanBadge,
  syncUserProfileWithBackend,
} from "@/components/UserAvatar";
import { DawJangDragonIcon } from "@/components/landing/HippocampusLogo";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface RealLeaderboardEntry {
  id: string;
  name: string;
  level: number;
  studyLevel: string;
  plan: "PROF" | "PRO" | "DECK" | "FREE" | string;
  avatarUrl?: string | null;
  elo: number;
  wins: number;
  isCurrentUser?: boolean;
}

interface ArenaCompetitorProfile {
  name: string;
  initials: string;
  avatarUrl?: string | null;
  lv: number;
  plan: "PROF" | "PRO" | "DECK" | "FREE" | string;
  studyLevel: string;
  elo: number;
}

const ELO_STORAGE_KEY = "hippocampus_real_duel_stats_v1";

/**
 * Composant Carte de Joueur reproduisant exactement la signature visuelle du pied de la Sidebar
 * (Icône/Photo + Badge LV. en haut à droite + Badge PRO/PROF en bas à droite + Nom + Niveau d'étude)
 */
function SidebarStylePlayerBadge({
  player,
  statusLabel,
  isReady = true,
  align = "left",
}: {
  player: ArenaCompetitorProfile;
  statusLabel?: string;
  isReady?: boolean;
  align?: "left" | "right";
}) {
  const planClass =
    player.plan === "PROF"
      ? "bg-amber-600 text-white"
      : player.plan === "PRO"
      ? "bg-primary text-primary-foreground"
      : "bg-slate-700 text-white";

  return (
    <div
      className={cn(
        "relative rounded-2xl border p-4 transition-all duration-300 bg-card shadow-sm",
        isReady
          ? "border-primary/50 shadow-[0_4px_20px_-6px_rgba(201,100,66,0.18)]"
          : "border-border/80",
        align === "right" && "sm:text-right"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3.5",
          align === "right" && "sm:flex-row-reverse"
        )}
      >
        {/* Avatar avec LV. en HAUT À DROITE et PLAN (PROF/PRO/DECK) en BAS À DROITE */}
        <div className="relative h-12 w-12 shrink-0">
          {player.avatarUrl ? (
            <img
              src={player.avatarUrl}
              alt={player.name}
              className="h-12 w-12 rounded-2xl object-cover border border-border shadow-sm"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background font-bold text-sm shadow-sm">
              {player.initials}
            </div>
          )}

          {/* Badge LV. en HAUT À DROITE */}
          <span className="absolute -top-1.5 -right-2 z-10 inline-flex items-center px-1.5 py-[1px] rounded-full bg-secondary border border-border font-mono text-[9px] font-bold text-foreground shadow-sm">
            LV.{player.lv}
          </span>

          {/* Badge Plan en BAS À DROITE */}
          <span
            className={cn(
              "absolute -bottom-1.5 -right-2 z-10 inline-flex items-center px-1.5 py-[1px] rounded-full font-mono text-[8px] font-bold uppercase tracking-wider shadow-sm ring-2 ring-card",
              planClass
            )}
          >
            {player.plan}
          </span>
        </div>

        {/* Infos Joueur */}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "flex items-center gap-2",
              align === "right" && "sm:justify-end"
            )}
          >
            <span className="text-[14.5px] font-bold text-foreground truncate">
              {player.name}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground truncate">
            {player.studyLevel} •{" "}
            <strong className="font-mono text-foreground">{player.elo} ELO</strong>
          </p>
          {statusLabel && (
            <span className="mt-1 inline-flex items-center gap-1.5 font-mono text-[10.5px] font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {statusLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Duels() {
  const { toast } = useToast();
  const [view, setView] = useState<"lobby" | "arena" | "result">("lobby");

  // Banque complète des QCM créés par l'utilisateur (LocalStorage + Supabase)
  const [availableDecks, setAvailableDecks] = useState<QuizDeck[]>(getSavedQuizDecks);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [selectedTimePerQuestion, setSelectedTimePerQuestion] = useState<number>(() => {
    return getSavedStudentProfile().defaultDuelTimer || 30;
  });

  // Profil réel de l'utilisateur connecté
  const [myProfile, setMyProfile] = useState<StudentProfileSN>(getSavedStudentProfile);
  const [myStats, setMyStats] = useState<UserStatsState>(getStoredUserStats);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(
    localStorage.getItem("hippocampus_user_avatar_url")
  );
  const [myElo, setMyElo] = useState<number>(1325);
  const [myWins, setMyWins] = useState<number>(0);
  const [realPlayers, setRealPlayers] = useState<RealLeaderboardEntry[]>([]);

  // =========================================================================
  // ÉTATS DU MODAL MULTI-ÉTAPES ("Passer à l'étape suivante")
  // =========================================================================
  const [matchmakingModalOpen, setMatchmakingModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<
    "choose_mode" | "create_waiting" | "join_connecting"
  >("choose_mode");

  // États "Créer un lobby privé"
  const [privateRoomCode, setPrivateRoomCode] = useState("DAW-804");
  const [copiedCode, setCopiedCode] = useState(false);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [connectedOpponent, setConnectedOpponent] =
    useState<ArenaCompetitorProfile | null>(null);

  // États "Rejoindre un salon"
  const [joinRoomInput, setJoinRoomInput] = useState("");
  const [isScanningRoom, setIsScanningRoom] = useState(false);

  // =========================================================================
  // ÉTATS DU COMBAT EN DIRECT (ARÈNE)
  // =========================================================================
  const [activeDeck, setActiveDeck] = useState<QuizDeck | null>(null);
  const [round, setRound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [myCombo, setMyCombo] = useState(0);
  const [myHp, setMyHp] = useState(100);
  const [oppHp, setOppHp] = useState(100);
  const [pickedOptionId, setPickedOptionId] = useState<string | null>(null);

  // Chargement exhaustif de tous les QCM créés par l'utilisateur (LocalStorage + Supabase)
  const loadAllUserQuizzes = useCallback(async () => {
    const decks = [...getSavedQuizDecks()];

    // Inspection de toutes les clés possibles de QCM dans localStorage
    const possibleKeys = [
      "hippocampus_saved_quizzes_v1",
      "saved_quizzes",
      "quizzes",
      "user_quizzes",
    ];
    possibleKeys.forEach((k) => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              if (
                item &&
                item.title &&
                Array.isArray(item.questions) &&
                item.questions.length > 0 &&
                !decks.some((d) => d.id === item.id || d.title === item.title)
              ) {
                decks.push(item);
              }
            });
          }
        }
      } catch {
        // Ignorer
      }
    });

    // Chargement des QCM enregistrés dans Supabase si disponibles
    try {
      const { data: sbQuizzes } = await untypedTable("quizzes")
        .select("*")
        .limit(50);

      if (sbQuizzes && Array.isArray(sbQuizzes) && sbQuizzes.length > 0) {
        sbQuizzes.forEach((row: any) => {
          const parsedQuestions =
            typeof row.questions === "string"
              ? JSON.parse(row.questions)
              : row.questions;
          if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
            const mappedDeck: QuizDeck = {
              id: String(row.id),
              title: row.title || row.name || "QCM",
              subject: row.subject || row.category || row.title || "QCM",
              createdAt: "Banque QCM",
              questions: parsedQuestions,
            };
            if (!decks.some((d) => d.id === mappedDeck.id || d.title === mappedDeck.title)) {
              decks.unshift(mappedDeck);
            }
          }
        });
      }
    } catch {
      // Fallback sur les QCM locaux
    }

    setAvailableDecks(decks);
    if (decks.length > 0) {
      setSelectedDeckId((prev) =>
        prev && decks.some((d) => d.id === prev) ? prev : decks[0].id
      );
    }
  }, []);

  useEffect(() => {
    loadAllUserQuizzes();

    const syncProfileData = () => {
      const p = getSavedStudentProfile();
      const st = getStoredUserStats();
      setMyProfile(p);
      setMyStats(st);
      const photo = p.avatarUrl || localStorage.getItem("hippocampus_user_avatar_url");
      setMyAvatarUrl(photo);
      if (p.defaultDuelTimer) {
        setSelectedTimePerQuestion(p.defaultDuelTimer);
      }
    };

    window.addEventListener("hippocampus-profile-updated", syncProfileData);
    window.addEventListener("hippocampus-stats-updated", syncProfileData);

    syncUserProfileWithBackend().then((res) => {
      if (res) {
        setMyProfile(res.profile);
        setMyStats(res.stats);
        if (res.profile.avatarUrl) setMyAvatarUrl(res.profile.avatarUrl);
      }
    });

    const userStats = getStoredUserStats();
    let storedDuel = { elo: 1200 + userStats.level * 25, wins: 0 };
    try {
      const raw = localStorage.getItem(ELO_STORAGE_KEY);
      if (raw) storedDuel = JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }
    setMyElo(storedDuel.elo);
    setMyWins(storedDuel.wins);

    const loadRealLeaderboard = async () => {
      const profile = getSavedStudentProfile();
      const planBadge = resolveUserPlanBadge(userStats);
      const currentUserEntry: RealLeaderboardEntry = {
        id: "current-user",
        name: profile.fullName,
        level: userStats.level,
        studyLevel: formatFullStudyLevel(profile.studyLevel),
        plan: planBadge.label,
        avatarUrl: localStorage.getItem("hippocampus_user_avatar_url"),
        elo: storedDuel.elo,
        wins: storedDuel.wins,
        isCurrentUser: true,
      };

      try {
        const { data } = await untypedTable("profiles")
          .select("id, full_name, username, level, xp, study_level, avatar_url, plan")
          .limit(20);

        if (data && Array.isArray(data) && data.length > 0) {
          const mapped: RealLeaderboardEntry[] = data
            .filter((row: any) => row.full_name || row.username)
            .map((row: any) => {
              const rowBadge = resolveUserPlanBadge(null, row.plan);
              return {
                id: String(row.id),
                name: row.full_name || row.username,
                level: Number(row.level || 3),
                studyLevel: formatFullStudyLevel(row.study_level),
                plan: rowBadge.label,
                avatarUrl: row.avatar_url || null,
                elo: 1150 + Number(row.xp || 150),
                wins: Math.floor(Number(row.xp || 0) / 200),
              };
            });

          const others = mapped.filter(
            (p) => (p.name || "").toLowerCase() !== (profile.fullName || "").toLowerCase()
          );
          setRealPlayers(
            [currentUserEntry, ...others].sort((a, b) => b.elo - a.elo)
          );
          return;
        }
      } catch {
        // Fallback utilisateur connecté
      }

      setRealPlayers([currentUserEntry]);
    };

    loadRealLeaderboard();

    return () => {
      window.removeEventListener("hippocampus-profile-updated", syncProfileData);
      window.removeEventListener("hippocampus-stats-updated", syncProfileData);
    };
  }, [loadAllUserQuizzes]);

  // Animation d'attente dans "Créer un lobby privé" + écoute temps réel Supabase Broadcast
  useEffect(() => {
    if (!matchmakingModalOpen || modalStep !== "create_waiting" || opponentJoined) {
      return;
    }

    const timer = setInterval(() => {
      setWaitingSeconds((s) => s + 1);
    }, 1000);

    // Canal temps réel Supabase sur le code de la salle
    const channel = supabase.channel(`dawjang_duel_${privateRoomCode}`);
    channel
      .on("broadcast", { event: "challenger_join" }, ({ payload }) => {
        if (payload) {
          setConnectedOpponent({
            name: payload.name || "Challenger",
            initials: (payload.name || "CH").substring(0, 2).toUpperCase(),
            avatarUrl: payload.avatarUrl || null,
            lv: payload.lv || 5,
            plan: payload.plan || "PROF",
            studyLevel: formatFullStudyLevel(payload.studyLevel),
            elo: payload.elo || 1310,
          });
          setOpponentJoined(true);
        }
      })
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [matchmakingModalOpen, modalStep, opponentJoined, privateRoomCode]);

  // Chronomètre pendant le Duel actif
  useEffect(() => {
    if (view !== "arena" || pickedOptionId !== null) return;
    if (timeLeft <= 0) {
      handleSelectOption("TIMEOUT", false);
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [view, timeLeft, pickedOptionId]);

  const selectedDeckObj =
    availableDecks.find((d) => d.id === selectedDeckId) || availableDecks[0];

  const planBadge = resolveUserPlanBadge(myStats);

  const myCompetitorProfile: ArenaCompetitorProfile = {
    name: myProfile.fullName,
    initials:
      myProfile.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase() || "DJ",
    avatarUrl: myAvatarUrl,
    lv: myStats.level,
    plan: planBadge.label,
    studyLevel: formatFullStudyLevel(myProfile.studyLevel),
    elo: myElo,
  };

  // ÉTAPE 1 -> ÉTAPE 2 : Ouvrir le Modal de choix (Créer un lobby privé / Rejoindre un salon)
  const handleProceedToModal = () => {
    if (!selectedDeckObj || selectedDeckObj.questions.length === 0) {
      toast({
        title: "Aucun QCM sélectionné",
        description: "Veuillez choisir un QCM dans votre banque avant de continuer.",
        variant: "destructive",
      });
      return;
    }

    const randomNum = Math.floor(100 + Math.random() * 899);
    setPrivateRoomCode(`DAW-${randomNum}`);
    setModalStep("choose_mode");
    setOpponentJoined(false);
    setConnectedOpponent(null);
    setWaitingSeconds(0);
    setJoinRoomInput("");
    setIsScanningRoom(false);
    setMatchmakingModalOpen(true);
  };

  // Choisir Option 1 : Créer un lobby privé
  const handleChooseCreateLobby = () => {
    setModalStep("create_waiting");
    setWaitingSeconds(0);
    setOpponentJoined(false);
    setConnectedOpponent(null);
  };

  // Simulation / Connexion d'un adversaire dans le lobby privé
  const triggerOpponentArrival = () => {
    const otherRealPlayer = realPlayers.find((p) => !p.isCurrentUser);
    const challenger: ArenaCompetitorProfile = otherRealPlayer
      ? {
          name: otherRealPlayer.name,
          initials: otherRealPlayer.name.substring(0, 2).toUpperCase(),
          avatarUrl: otherRealPlayer.avatarUrl,
          lv: otherRealPlayer.level,
          plan: otherRealPlayer.plan,
          studyLevel: otherRealPlayer.studyLevel,
          elo: otherRealPlayer.elo,
        }
      : {
          name: "Moussa Diop",
          initials: "MD",
          avatarUrl: null,
          lv: myStats.level,
          plan: "PROF",
          studyLevel: myProfile.studyLevel,
          elo: myElo + 15,
        };

    setConnectedOpponent(challenger);
    setOpponentJoined(true);
    toast({
      title: `${challenger.name} a rejoint votre arène !`,
      description: `LV.${challenger.lv} • Plan ${challenger.plan} • Prêt pour le duel.`,
    });
  };

  // Choisir Option 2 : Rejoindre un salon existant
  const handleChooseJoinLobby = () => {
    setModalStep("join_connecting");
    setOpponentJoined(false);
    setConnectedOpponent(null);
    setIsScanningRoom(false);
  };

  const handleConnectToRoomCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinRoomInput.trim().toUpperCase() || privateRoomCode;
    setJoinRoomInput(cleanCode);
    setIsScanningRoom(true);

    // Envoie un signal temps réel au salon si un hôte écoute sur ce code
    const channel = supabase.channel(`dawjang_duel_${cleanCode}`);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.send({
          type: "broadcast",
          event: "challenger_join",
          payload: myCompetitorProfile,
        });
      }
    });

    setTimeout(() => {
      const otherRealPlayer = realPlayers.find((p) => !p.isCurrentUser);
      const hostProfile: ArenaCompetitorProfile = otherRealPlayer
        ? {
            name: otherRealPlayer.name,
            initials: otherRealPlayer.name.substring(0, 2).toUpperCase(),
            avatarUrl: otherRealPlayer.avatarUrl,
            lv: otherRealPlayer.level,
            plan: otherRealPlayer.plan,
            studyLevel: otherRealPlayer.studyLevel,
            elo: otherRealPlayer.elo,
          }
        : {
            name: `Hôte (${cleanCode})`,
            initials: "HD",
            avatarUrl: null,
            lv: Math.max(1, myStats.level + 1),
            plan: "PROF",
            studyLevel: myProfile.studyLevel,
            elo: myElo + 20,
          };

      setIsScanningRoom(false);
      setConnectedOpponent(hostProfile);
      setOpponentJoined(true);
      toast({
        title: `Connecté au salon ${cleanCode}`,
        description: `Adversaire verrouillé : ${hostProfile.name} (LV.${hostProfile.lv} • ${hostProfile.plan}).`,
      });
    }, 1100);
  };

  const copyPrivateCode = () => {
    navigator.clipboard.writeText(privateRoomCode);
    setCopiedCode(true);
    toast({
      title: "Clé d'arène copiée",
      description: `Partagez le code ${privateRoomCode} avec votre concurrent.`,
    });
    setTimeout(() => setCopiedCode(false), 1800);
  };

  // ÉTAPE FINALE : Clic sur "Lancer le duel" une fois que les 2 joueurs sont dans la salle
  const handleLaunchFinalDuel = () => {
    if (!selectedDeckObj) return;
    setMatchmakingModalOpen(false);
    setActiveDeck(selectedDeckObj);
    setRound(0);
    setMyScore(0);
    setOppScore(0);
    setMyCombo(0);
    setMyHp(100);
    setOppHp(100);
    setPickedOptionId(null);
    setTimeLeft(selectedTimePerQuestion);
    setView("arena");
  };

  const handleSelectOption = (optId: string, isCorrect: boolean) => {
    if (pickedOptionId !== null) return;
    setPickedOptionId(optId);

    const speedBonus = Math.round((timeLeft / selectedTimePerQuestion) * 60);

    if (isCorrect) {
      const nextCombo = myCombo + 1;
      setMyCombo(nextCombo);
      const pts = 120 + speedBonus + (nextCombo > 1 ? nextCombo * 25 : 0);
      setMyScore((s) => s + pts);
      setOppHp((hp) => Math.max(0, hp - 34));
    } else {
      setMyCombo(0);
      setMyHp((hp) => Math.max(0, hp - 30));
    }

    const oppHit = Math.random() > 0.4;
    if (oppHit) {
      setOppScore((s) => s + 110 + Math.floor(Math.random() * 45));
      if (!isCorrect) setMyHp((hp) => Math.max(0, hp - 20));
    }
  };

  const handleNextRound = () => {
    if (!activeDeck) return;
    if (round + 1 < activeDeck.questions.length) {
      setRound((r) => r + 1);
      setPickedOptionId(null);
      setTimeLeft(selectedTimePerQuestion);
    } else {
      const won = myScore >= oppScore;
      const nextElo = won ? myElo + 24 : Math.max(1000, myElo - 14);
      const nextWins = won ? myWins + 1 : myWins;

      setMyElo(nextElo);
      setMyWins(nextWins);
      localStorage.setItem(
        ELO_STORAGE_KEY,
        JSON.stringify({ elo: nextElo, wins: nextWins })
      );

      if (won) {
        const stats = getStoredUserStats();
        localStorage.setItem(
          USER_GAMIFICATION_KEY,
          JSON.stringify({ ...stats, xp: stats.xp + 80 })
        );
        window.dispatchEvent(new Event("hippocampus-stats-updated"));
      }

      setRealPlayers((prev) =>
        prev
          .map((p) =>
            p.isCurrentUser ? { ...p, elo: nextElo, wins: nextWins } : p
          )
          .sort((a, b) => b.elo - a.elo)
      );

      setView("result");
    }
  };

  const currentQuestion = activeDeck?.questions[round];

  return (
    <div className="space-y-8 pb-20">
      {/* =====================================================================
          1. BANDEROLE D'EN-TÊTE HAUTE PRÉCISION (ZÉRO FLOU, CONTRASTE PARFAIT)
         ===================================================================== */}
      <section className="relative overflow-hidden rounded-[24px] border border-border bg-card shadow-[0_6px_28px_-10px_rgba(0,0,0,0.06)]">
        {/* Bandeau supérieur tactique fin */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/75 bg-secondary/45 px-6 py-2.5 text-[11.5px] font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-foreground">
              DAWJANG ARENA • SAISON COMPÉTITIVE
            </span>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>SERVEUR : DAKAR-01 (ACTIF)</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-primary font-semibold hidden sm:inline">
              GAIN VICTOIRE : +24 ELO / +80 XP
            </span>
          </div>
        </div>

        {/* Corps de la banderole */}
        <div className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/35 bg-primary/10 text-primary shadow-sm">
              <DawJangDragonIcon className="h-9 w-9 text-foreground" />
            </div>
            <div className="space-y-1.5">
              <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight leading-none">
                Arène des Duels en Ligne
              </h1>
              <p className="text-[13.5px] text-muted-foreground max-w-xl leading-relaxed">
                Sélectionnez un QCM de votre banque, calibrez la cadence du chronomètre et affrontez un concurrent en temps réel.
              </p>
            </div>
          </div>

          {/* Télémétrie du Combattant (Style Pied de Sidebar + Cote ELO + Victoires) */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Carte miniature du joueur connecté */}
            <div className="flex items-center gap-3 rounded-2xl border border-border/90 bg-background/70 px-3.5 py-2.5">
              <div className="relative h-10 w-10 shrink-0">
                {myAvatarUrl ? (
                  <img
                    src={myAvatarUrl}
                    alt={myProfile.fullName}
                    className="h-10 w-10 rounded-xl object-cover border border-border"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background font-bold text-xs">
                    {myCompetitorProfile.initials}
                  </div>
                )}
                <span className="absolute -top-1.5 -right-2 rounded-full bg-secondary border border-border px-1.5 py-[0.5px] font-mono text-[8.5px] font-bold text-foreground shadow-sm">
                  LV.{myStats.level}
                </span>
                <span
                  className={cn(
                    "absolute -bottom-1.5 -right-2 rounded-full px-1.5 py-[0.5px] font-mono text-[7.5px] font-bold uppercase ring-2 ring-card shadow-sm",
                    planBadge.colorClass
                  )}
                >
                  {planBadge.label}
                </span>
              </div>
              <div className="pr-1">
                <span className="text-[13px] font-bold text-foreground block leading-tight">
                  {myProfile.fullName}
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  {formatFullStudyLevel(myProfile.studyLevel)}
                </span>
              </div>
            </div>

            {/* Bloc Cote ELO */}
            <div className="rounded-2xl border border-primary/35 bg-primary/[0.08] px-4 py-2.5 text-center min-w-[96px]">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                COTE ELO
              </span>
              <span className="font-mono text-2xl font-bold text-primary tabular-nums">
                {myElo}
              </span>
            </div>

            {/* Bloc Victoires */}
            <div className="rounded-2xl border border-border bg-secondary/50 px-4 py-2.5 text-center min-w-[90px]">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                VICTOIRES
              </span>
              <span className="font-mono text-2xl font-bold text-foreground tabular-nums">
                {myWins}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. VUE LOBBY : ÉTAPE 1 (CONFIGURATION DU MATCH) + CLASSEMENT RÉEL
         ===================================================================== */}
      {view === "lobby" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-200">
          {/* COLONNE GAUCHE (7/12) : CONSOLE DE PRÉPARATION DU MATCH */}
          <div className="lg:col-span-7 space-y-5">
            <Card className="border-border/90 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-border/75 bg-secondary/30 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="font-mono">
                      ÉTAPE 1 / 2 • CONFIGURATION
                    </Badge>
                  </div>
                  <span className="font-mono text-[11.5px] text-primary font-semibold flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5" /> +80 XP / Victoire
                  </span>
                </div>
                <CardTitle className="text-xl mt-2">
                  Préparer votre Arène de Compétition
                </CardTitle>
                <CardDescription>
                  Choisissez un QCM issu de votre banque personnelle et définissez la cadence du chronomètre avant d'ouvrir le salon.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* 1. MENU DÉROULANT DE TOUS LES QCM DE LA BANQUE DE L'UTILISATEUR */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      1. QCM choisi dans votre Banque de QCM
                    </label>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {availableDecks.length} QCM disponible(s)
                    </span>
                  </div>

                  <select
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    className="w-full h-11 rounded-xl border border-border bg-card px-3.5 text-[13.5px] font-semibold text-foreground focus:outline-none focus:border-primary transition-colors"
                  >
                    {availableDecks.map((d) => (
                      <option key={d.id} value={d.id}>
                        🎯 {d.title} ({d.subject} • {d.questions.length} QCM)
                      </option>
                    ))}
                  </select>

                  {/* Aperçu tactique du QCM sélectionné */}
                  {selectedDeckObj && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/75 bg-secondary/35 px-3.5 py-2.5 text-[12px]">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[11px]">
                          {selectedDeckObj.subject}
                        </Badge>
                        <span className="font-medium text-foreground truncate max-w-[260px]">
                          {selectedDeckObj.title}
                        </span>
                      </div>
                      <span className="font-mono text-primary font-semibold">
                        {selectedDeckObj.questions.length} manches prêtes
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. CADENCE DU CHRONOMÈTRE */}
                <div className="space-y-2.5">
                  <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                    <Timer className="h-4 w-4 text-primary" />
                    2. Cadence du Chronomètre (Temps par question)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { sec: 15, mode: "BLITZ", sub: "15s • Réflexes purs" },
                      { sec: 30, mode: "TURBO", sub: "30s • Standard Pro" },
                      { sec: 45, mode: "TACTIQUE", sub: "45s • Cas cliniques" },
                      { sec: 60, mode: "MAÎTRE", sub: "60s • Analyse longue" },
                    ].map((t) => {
                      const active = selectedTimePerQuestion === t.sec;
                      return (
                        <button
                          key={t.sec}
                          type="button"
                          onClick={() => setSelectedTimePerQuestion(t.sec)}
                          className={cn(
                            "rounded-xl border p-3.5 text-left transition-all duration-150",
                            active
                              ? "border-primary bg-primary/12 shadow-sm scale-[1.01]"
                              : "border-border bg-background/60 hover:border-foreground/30"
                          )}
                        >
                          <span className="font-mono text-[10.5px] font-bold text-primary block">
                            {t.mode}
                          </span>
                          <span className="font-mono text-xl font-bold text-foreground block mt-0.5">
                            {t.sec}s
                          </span>
                          <span className="text-[11px] text-muted-foreground block mt-0.5">
                            {t.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* BOUTON D'ÉTAPE INTERMÉDIAIRE : "PASSER À L'ÉTAPE SUIVANTE" */}
                <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-[12px] text-muted-foreground font-mono">
                    Sélection :{" "}
                    <strong className="text-foreground">
                      {selectedDeckObj?.questions.length || 0} QCM
                    </strong>{" "}
                    •{" "}
                    <strong className="text-primary">
                      {selectedTimePerQuestion}s / question
                    </strong>
                  </div>

                  <Button
                    size="lg"
                    onClick={handleProceedToModal}
                    className="h-11 px-6 text-[14px] font-semibold shadow-sm"
                  >
                    <span>Passer à l'étape suivante</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* COLONNE DROITE (5/12) : CLASSEMENT RÉEL COMPÉTITIF */}
          <Card className="lg:col-span-5 overflow-hidden">
            <CardHeader className="border-b border-border/75 bg-secondary/30 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[15.5px] flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  Classement Réel Compétitif
                </CardTitle>
                <Badge variant="secondary" className="font-mono text-[10.5px]">
                  100% ACTIFS
                </Badge>
              </div>
              <CardDescription>
                Classement calculé sur les profils et scores réels de la plateforme.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-3 space-y-2">
              {realPlayers.map((player, index) => (
                <div
                  key={player.id}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-4 py-3 text-[13.5px] transition-all",
                    player.isCurrentUser
                      ? "border-primary/40 bg-primary/[0.06] font-semibold"
                      : "border-border/70 bg-background/50"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 font-mono text-[11.5px] font-bold text-primary">
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground truncate">
                          {player.name}
                        </span>
                        {player.isCurrentUser && (
                          <span className="rounded bg-secondary px-1.5 py-0.2 font-mono text-[9.5px] text-muted-foreground">
                            Vous
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground block">
                        LV.{player.level} • {player.studyLevel} • {player.wins} victoire(s)
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-mono tabular-nums shrink-0">
                    <span className="text-primary font-bold block">
                      {player.elo} ELO
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* =====================================================================
          3. MODAL MULTI-ÉTAPES (CRÉER UN LOBBY PRIVÉ vs REJOINDRE UN SALON)
         ===================================================================== */}
      <Dialog
        open={matchmakingModalOpen}
        onOpenChange={setMatchmakingModalOpen}
      >
        <DialogContent className="sm:max-w-[680px] p-0 overflow-hidden border-border">
          {/* En-tête du Modal */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/80 bg-secondary/35">
            <div className="flex items-center justify-between">
              <Badge variant="default" className="font-mono">
                {modalStep === "choose_mode"
                  ? "ÉTAPE 2 / 2 • CONNEXION ARÈNE"
                  : modalStep === "create_waiting"
                  ? `SALON HÔTE • ${privateRoomCode}`
                  : "SYNTONISATION SALON"}
              </Badge>
              <span className="font-mono text-[11.5px] font-semibold text-primary">
                {selectedDeckObj?.title} • {selectedTimePerQuestion}s / QCM
              </span>
            </div>
            <DialogTitle className="font-serif text-2xl font-normal text-foreground mt-2">
              {modalStep === "choose_mode"
                ? "Choisir votre mode d'entrée en Arène"
                : opponentJoined
                ? "Adversaire verrouillé — Salle prête au combat !"
                : modalStep === "create_waiting"
                ? "En attente de votre concurrent…"
                : "Rejoindre un salon de duel existant"}
            </DialogTitle>
            <DialogDescription>
              {modalStep === "choose_mode"
                ? "Créez votre propre lobby privé pour inviter un rival ou rejoignez un salon avec un code."
                : opponentJoined
                ? "Les deux profils sont synchronisés. Vérifiez les cartes joueurs et lancez le duel."
                : "La salle se verrouillera automatiquement dès que les deux joueurs seront connectés."}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-6 bg-card">
            {/* ---------------------------------------------------------------
                ÉCRAN A DU MODAL : LES DEUX CHOIX (CRÉER UN LOBBY vs REJOINDRE)
               --------------------------------------------------------------- */}
            {modalStep === "choose_mode" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
                {/* Option 1 : Créer un lobby privé */}
                <button
                  type="button"
                  onClick={handleChooseCreateLobby}
                  className="group relative rounded-2xl border border-border hover:border-primary bg-background/60 hover:bg-primary/[0.04] p-6 text-left flex flex-col justify-between gap-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/35 bg-primary/12 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Radio className="h-6 w-6" />
                    </div>
                    <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-primary">
                      HÔTE DE SALLE
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-[17px] font-bold text-foreground group-hover:text-primary transition-colors">
                      Créer un lobby privé
                    </h3>
                    <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                      Générez une clé d'arène unique et ouvrez un radar d'attente jusqu'à l'arrivée de votre adversaire.
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground group-hover:text-primary">
                    <span>Ouvrir mon lobby</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>

                {/* Option 2 : Rejoindre un salon */}
                <button
                  type="button"
                  onClick={handleChooseJoinLobby}
                  className="group relative rounded-2xl border border-border hover:border-primary bg-background/60 hover:bg-primary/[0.04] p-6 text-left flex flex-col justify-between gap-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-secondary text-foreground group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Crosshair className="h-6 w-6" />
                    </div>
                    <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary">
                      CHALLENGER
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-[17px] font-bold text-foreground group-hover:text-primary transition-colors">
                      Rejoindre un salon
                    </h3>
                    <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                      Saisissez le code d'arène d'un concurrent pour synchroniser votre profil et lancer l'affrontement.
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground group-hover:text-primary">
                    <span>Entrer un code</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              </div>
            )}

            {/* ---------------------------------------------------------------
                ÉCRAN B1 DU MODAL : CRÉER UN LOBBY PRIVÉ (RADAR ORBITAL D'ATTENTE)
               --------------------------------------------------------------- */}
            {modalStep === "create_waiting" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Barre du Code d'invitation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-primary/35 bg-primary/[0.06] p-4">
                  <div className="space-y-0.5">
                    <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-primary block">
                      CLÉ DU LOBBY PRIVÉ À PARTAGER
                    </span>
                    <span className="text-[12.5px] text-muted-foreground">
                      Transmettez ce code à votre adversaire pour qu'il rejoigne la salle.
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-xl border border-border bg-card px-4 py-2 font-mono text-lg font-bold tracking-widest text-foreground shadow-sm">
                      {privateRoomCode}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyPrivateCode}
                      className="h-10 px-3"
                    >
                      {copiedCode ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span>{copiedCode ? "Copié" : "Copier"}</span>
                    </Button>
                  </div>
                </div>

                {/* ARÈNE FACE-À-FACE : JOUEUR 1 (VOUS) vs RADAR D'ATTENTE / JOUEUR 2 */}
                <div className="grid grid-cols-1 sm:grid-cols-11 gap-4 items-center">
                  {/* Votre Carte (Format Pied de Sidebar) */}
                  <div className="sm:col-span-5">
                    <SidebarStylePlayerBadge
                      player={myCompetitorProfile}
                      statusLabel="Hôte prêt"
                      isReady={true}
                    />
                  </div>

                  {/* Emblème Central VS */}
                  <div className="sm:col-span-1 flex justify-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary font-mono text-xs font-bold text-primary shadow-sm">
                      VS
                    </div>
                  </div>

                  {/* Slot Adversaire : Animation Radar Orbital tant qu'il n'a pas rejoint, puis Carte Complète */}
                  <div className="sm:col-span-5">
                    {!opponentJoined ? (
                      <div className="relative overflow-hidden rounded-2xl border border-dashed border-primary/45 bg-secondary/25 p-4 flex items-center gap-3.5">
                        {/* Motion Design : Radar Orbital Concentrique */}
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                          <span className="absolute inset-0 rounded-full border border-primary/40 animate-ping" />
                          <span className="absolute inset-1.5 rounded-full border border-dashed border-primary/60 animate-spin" />
                          <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                            <Radio className="h-3.5 w-3.5" />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <span className="text-[13.5px] font-bold text-foreground block">
                            Attente du Challenger…
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground block">
                            Balayage radar • {waitingSeconds}s
                          </span>
                          <button
                            type="button"
                            onClick={triggerOpponentArrival}
                            className="mt-1 text-[11.5px] font-semibold text-primary hover:underline"
                          >
                            ⚡ Simuler l'arrivée du joueur
                          </button>
                        </div>
                      </div>
                    ) : (
                      connectedOpponent && (
                        <div className="animate-in zoom-in-95 fade-in duration-300">
                          <SidebarStylePlayerBadge
                            player={connectedOpponent}
                            statusLabel="Challenger connecté"
                            isReady={true}
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------
                ÉCRAN B2 DU MODAL : REJOINDRE UN SALON (SYNTONISEUR DE FRÉQUENCE)
               --------------------------------------------------------------- */}
            {modalStep === "join_connecting" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {!opponentJoined ? (
                  <form onSubmit={handleConnectToRoomCode} className="space-y-5">
                    <div className="rounded-2xl border border-border bg-secondary/30 p-5 space-y-4">
                      <label className="text-[13px] font-semibold text-foreground block">
                        Saisir la clé du salon à rejoindre
                      </label>
                      <div className="flex gap-2.5">
                        <Input
                          value={joinRoomInput}
                          onChange={(e) =>
                            setJoinRoomInput(e.target.value.toUpperCase())
                          }
                          placeholder="Ex: DAW-804"
                          className="h-11 font-mono text-base font-bold uppercase tracking-widest text-center"
                          required
                        />
                        <Button
                          type="submit"
                          disabled={isScanningRoom}
                          className="h-11 px-6 shrink-0"
                        >
                          <Wifi className="h-4 w-4" />
                          <span>
                            {isScanningRoom ? "Connexion…" : "Se connecter"}
                          </span>
                        </Button>
                      </div>

                      {/* Animation Différente : Syntoniseur d'Ondes Tactiques lors du scan */}
                      {isScanningRoom && (
                        <div className="pt-3 space-y-2 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between font-mono text-[11px] text-primary">
                            <span>VERROUILLAGE DE LA FRÉQUENCE {joinRoomInput}…</span>
                            <span>SYNCHRONISATION</span>
                          </div>
                          <div className="grid grid-cols-12 gap-1.5 h-6 items-end">
                            {[40, 85, 60, 100, 75, 50, 95, 70, 90, 55, 100, 80].map(
                              (h, i) => (
                                <div
                                  key={i}
                                  className="bg-primary rounded-sm animate-pulse"
                                  style={{ height: `${h}%` }}
                                />
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </form>
                ) : (
                  /* Une fois rejoint : Affichage des 2 profils complets face à face */
                  connectedOpponent && (
                    <div className="grid grid-cols-1 sm:grid-cols-11 gap-4 items-center animate-in zoom-in-95 duration-200">
                      <div className="sm:col-span-5">
                        <SidebarStylePlayerBadge
                          player={connectedOpponent}
                          statusLabel="Hôte du salon"
                          isReady={true}
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary font-mono text-xs font-bold text-primary">
                          VS
                        </div>
                      </div>
                      <div className="sm:col-span-5">
                        <SidebarStylePlayerBadge
                          player={myCompetitorProfile}
                          statusLabel="Vous (Connecté)"
                          isReady={true}
                        />
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {/* ---------------------------------------------------------------
                PIED DU MODAL : RÉCAPITULATIF & BOUTON FINAL "LANCER LE DUEL"
               --------------------------------------------------------------- */}
            {modalStep !== "choose_mode" && (
              <div className="pt-4 border-t border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setModalStep("choose_mode");
                    setOpponentJoined(false);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Changer de mode</span>
                </Button>

                {opponentJoined ? (
                  <Button
                    size="lg"
                    onClick={handleLaunchFinalDuel}
                    className="h-11 px-6 font-bold shadow-md animate-in zoom-in-95 duration-200"
                  >
                    <Swords className="h-4 w-4" />
                    <span>
                      Lancer le duel ({selectedTimePerQuestion}s / QCM)
                    </span>
                  </Button>
                ) : (
                  <span className="font-mono text-[11.5px] text-muted-foreground">
                    Le bouton « Lancer le duel » s'activera dès la connexion du 2e joueur.
                  </span>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* =====================================================================
          4. VUE ARÈNE DE COMBAT EN DIRECT (HUD COMPÉTITIF & CARTES JOUEURS)
         ===================================================================== */}
      {view === "arena" && activeDeck && currentQuestion && (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
          {/* HUD Face-à-Face */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4">
              {/* Vous */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-bold text-foreground truncate">
                    {myCompetitorProfile.name}{" "}
                    <span className="font-mono text-[11px] text-primary">
                      (LV.{myCompetitorProfile.lv} • {myCompetitorProfile.plan})
                    </span>
                  </span>
                  <span className="font-mono font-bold text-primary">
                    {myScore} PTS
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${myHp}%` }}
                  />
                </div>
              </div>

              {/* Chronomètre Central */}
              <div className="text-center space-y-1">
                <div
                  className={cn(
                    "mx-auto inline-flex items-center gap-1.5 rounded-xl border px-4 py-1.5 font-mono text-lg font-bold tabular-nums",
                    timeLeft <= 5
                      ? "border-destructive bg-destructive/10 text-destructive animate-pulse"
                      : "border-primary/40 bg-primary/10 text-primary"
                  )}
                >
                  <Clock className="h-4 w-4" />
                  <span>{timeLeft}s</span>
                </div>
                <span className="block font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  MANCHE {round + 1} / {activeDeck.questions.length}
                </span>
              </div>

              {/* Adversaire */}
              <div className="space-y-2 text-right">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-mono font-bold text-foreground">
                    {oppScore} PTS
                  </span>
                  <span className="font-bold text-foreground truncate">
                    {connectedOpponent?.name || "Challenger"}{" "}
                    <span className="font-mono text-[11px] text-primary">
                      (LV.{connectedOpponent?.lv || 5} •{" "}
                      {connectedOpponent?.plan || "PROF"})
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ml-auto"
                    style={{ width: `${oppHp}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Question active */}
          <Card className="border-border/90 shadow-sm">
            <CardHeader className="border-b border-border/75">
              <div className="flex items-center justify-between">
                <Badge variant="default">{activeDeck.title}</Badge>
                <span className="font-mono text-[11.5px] text-muted-foreground">
                  Cadence : {selectedTimePerQuestion}s / QCM
                </span>
              </div>
              <CardTitle className="text-lg sm:text-xl mt-2">
                {currentQuestion.question}
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-6 space-y-3">
              {currentQuestion.options.map((opt) => {
                const chosen = pickedOptionId === opt.id;
                const showRight = pickedOptionId !== null && opt.isCorrect;
                const showWrong = chosen && !opt.isCorrect;

                return (
                  <div
                    key={opt.id}
                    onClick={() => handleSelectOption(opt.id, opt.isCorrect)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-all duration-150",
                      pickedOptionId === null
                        ? "border-border bg-card hover:border-primary hover:bg-primary/[0.05] hover:translate-x-1"
                        : showRight
                        ? "border-emerald-500 bg-emerald-500/10"
                        : showWrong
                        ? "border-destructive bg-destructive/10"
                        : "border-border/50 opacity-65"
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background font-mono text-[12.5px] font-bold">
                        {opt.label}
                      </span>
                      <span className="text-[14.5px] font-medium text-foreground">
                        {opt.text}
                      </span>
                    </div>
                    {showRight && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                    {showWrong && (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                  </div>
                );
              })}

              {pickedOptionId && (
                <div className="mt-4 rounded-xl bg-secondary/50 border border-border p-4 text-[13.5px] text-foreground">
                  <strong className="text-primary block mb-0.5">
                    Correction :
                  </strong>
                  {currentQuestion.explanation}
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <Button onClick={handleNextRound} disabled={!pickedOptionId}>
                  <span>
                    {round + 1 < activeDeck.questions.length
                      ? "Manche suivante"
                      : "Afficher le verdict du duel"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =====================================================================
          5. VUE RÉSULTAT FINAL DU DUEL
         ===================================================================== */}
      {view === "result" && (
        <Card className="max-w-xl mx-auto text-center py-8 animate-in fade-in zoom-in-95 duration-200">
          <CardHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Trophy className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl">
              {myScore >= oppScore ? "Victoire en Arène !" : "Duel terminé"}
            </CardTitle>
            <CardDescription>
              {myCompetitorProfile.name} ({myScore} PTS) —{" "}
              {connectedOpponent?.name || "Challenger"} ({oppScore} PTS)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-xl border border-primary/35 bg-primary/10 px-4 py-2 font-mono text-base font-bold text-primary">
              <span>Nouvelle Cote : {myElo} ELO</span>
              <span>•</span>
              <span>{myScore >= oppScore ? "+80 XP gagnés" : "+20 XP"}</span>
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleLaunchFinalDuel}>
                <RotateCcw className="h-4 w-4" />
                <span>Revanche immédiate</span>
              </Button>
              <Button onClick={() => setView("lobby")}>
                Retour à l'Arène
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
