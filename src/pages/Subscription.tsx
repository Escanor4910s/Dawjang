// src/pages/Subscription.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ShieldCheck,
  CreditCard,
  Clock,
  Zap,
  AlertTriangle,
  Sparkles,
  Calendar,
  Download,
  TrendingUp,
  RefreshCw,
  PauseCircle,
  XCircle,
  ArrowRight,
  Receipt,
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
  DialogFooter,
} from "@/components/ui/dialog";
import { getSavedStudentProfile, saveStudentProfile } from "./Settings";
import {
  getStoredUserStats,
  USER_GAMIFICATION_KEY,
  PlanBadgeTier,
  PlanTierIconBadge,
} from "@/components/UserAvatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface UnifiedPlanDefinition {
  id: string;
  tier: PlanBadgeTier;
  name: string;
  philosophyTag: string;
  subtitle: string;
  monthlyFCFA: string;
  semesterFCFA: string;
  monthlyDurationDays: number;
  cycleDurationDays: number;
  interestBonusDays: number; // Jours d'intérêts offerts sur le cycle
  creditsIncluded: number;
  featured?: boolean;
  imperialDark?: boolean;
  perks: string[];
}

export const UNIFIED_DAWJANG_PLANS: UnifiedPlanDefinition[] = [
  {
    id: "offer-napoleon",
    tier: "MAJOR",
    name: "Plan Napoléon",
    philosophyTag: "STRATÉGIE IMPÉRIALE • ANNUEL",
    subtitle:
      "Conçu pour les stratèges qui planifient la conquête intégrale des deux semestres et des concours d'Internat.",
    monthlyFCFA: "3 000 FCFA / mois",
    semesterFCFA: "35 000 FCFA / an",
    monthlyDurationDays: 30,
    cycleDurationDays: 365,
    interestBonusDays: 35,
    creditsIncluded: 2500,
    imperialDark: true,
    perks: [
      "Sceau Étoile Impériale ciselé sur votre profil et Carte Membre",
      "Durée : 365 jours + 35 jours d'intérêts de fidélité offerts",
      "2 500 crédits d'analyse IA haute capacité sur 12 mois",
      "Mimétisme d'Annales & Calculateur de Probabilités illimités",
      "Le Rédacteur IA (3 paliers) + Téléchargement illimité",
      "Sauvegarde Cloud automatique & Carte Membre Or (30 médailles)",
    ],
  },
  {
    id: "offer-taoiste",
    tier: "PRO",
    name: "Plan Taoïste",
    philosophyTag: "MAÎTRISE DU FLUX • SEMESTRIEL",
    subtitle:
      "La voie de l'efficacité pure : concentrez votre énergie uniquement sur les leçons qui tombent à l'examen.",
    monthlyFCFA: "4 500 FCFA / mois",
    semesterFCFA: "20 000 FCFA / sem.",
    monthlyDurationDays: 30,
    cycleDurationDays: 180,
    interestBonusDays: 15,
    creditsIncluded: 600,
    featured: true,
    perks: [
      "Emblème Diamant Terracotta sur votre profil et dans l'Arène",
      "Durée : 180 jours + 15 jours d'intérêts de régularité offerts",
      "Upload de masse illimité (Cours & anciens sujets d'examen)",
      "Constructeur QCM IA (Classique, Censure, Groupage, Jumelage, Association)",
      "Calculateur de Probabilités & Ciblage des leçons vitales",
      "Professeur MOR connecté au Web & Duels en ligne temps réel",
    ],
  },
  {
    id: "offer-initie",
    tier: "STD",
    name: "Plan Initié",
    philosophyTag: "FONDATION & ANCRAGE • LIBRE",
    subtitle:
      "Pour structurer vos premiers polycopiés, construire vos cartes mémoire et explorer l'atelier.",
    monthlyFCFA: "0 FCFA",
    semesterFCFA: "0 FCFA",
    monthlyDurationDays: 30,
    cycleDurationDays: 30,
    interestBonusDays: 3,
    creditsIncluded: 100,
    perks: [
      "Emblème Boussole d'Argent sur votre profil",
      "Durée : Cycle renouvelable de 30 jours (+3 jours d'intérêts)",
      "Importation unitaire de cours dans la Bibliothèque",
      "Constructeur manuel de QCM & Flashcards",
      "Accès au Simulateur d'Examen chronométré",
      "Progression d'expérience LV. & 5 premières médailles",
    ],
  },
];

interface InvoiceHistoryItem {
  id: string;
  date: string;
  planName: string;
  tier: PlanBadgeTier;
  amount: string;
  durationCredited: string;
  interestDays: number;
  method: string;
  status: "Payé" | "Actif" | "Résilié";
}

const SUBSCRIPTION_HISTORY_KEY = "dawjang_billing_history_v1";
const AUTO_RENEW_STORAGE_KEY = "dawjang_subscription_autorenew_v1";

export default function Subscription() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stats, setStats] = useState(getStoredUserStats);
  const [activeTier, setActiveTier] = useState<PlanBadgeTier>(
    () =>
      (localStorage.getItem("dawjang_active_plan_tier") as PlanBadgeTier) ||
      "PRO"
  );
  const [billingCycle, setBillingCycle] = useState<"monthly" | "semester">(
    "semester"
  );
  const [autoRenew, setAutoRenew] = useState<boolean>(() => {
    const saved = localStorage.getItem(AUTO_RENEW_STORAGE_KEY);
    return saved !== null ? saved === "true" : true;
  });

  // États des Modals (Activation, Changement de paiement, Résiliation)
  const [selectedPlan, setSelectedPlan] =
    useState<UnifiedPlanDefinition | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelMode, setCancelMode] = useState<"end_of_cycle" | "immediate">(
    "end_of_cycle"
  );
  const [paymentMethod, setPaymentMethod] = useState<"wave" | "om" | "card">(
    "wave"
  );

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("+221 77 ");

  const [invoices, setInvoices] = useState<InvoiceHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(SUBSCRIPTION_HISTORY_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [
      {
        id: "INV-2026-089",
        date: "24 Oct. 2026",
        planName: "Plan Taoïste",
        tier: "PRO",
        amount: "20 000 FCFA",
        durationCredited: "180 jours",
        interestDays: 15,
        method: "Wave Sénégal",
        status: "Payé",
      },
    ];
  });

  useEffect(() => {
    const profile = getSavedStudentProfile();
    setBuyerName(profile.fullName || "");
    setBuyerEmail(profile.email || "");
    setBuyerPhone(profile.phone || "+221 77 ");

    const syncStats = () => {
      setStats(getStoredUserStats());
      setActiveTier(
        (localStorage.getItem("dawjang_active_plan_tier") as PlanBadgeTier) ||
          "PRO"
      );
    };

    window.addEventListener("hippocampus-stats-updated", syncStats);
    return () =>
      window.removeEventListener("hippocampus-stats-updated", syncStats);
  }, [checkoutOpen]);

  // Plan actif complet
  const currentPlanMeta = useMemo(
    () =>
      UNIFIED_DAWJANG_PLANS.find((p) => p.tier === activeTier) ||
      UNIFIED_DAWJANG_PLANS[1],
    [activeTier]
  );

  // Calcul précis de la durée, des jours d'intérêts gagnés et de la date d'échéance
  const telemetry = useMemo(() => {
    const totalDays = Math.max(0, stats.daysRemaining);
    const baseCycle = currentPlanMeta.cycleDurationDays;
    const streak = typeof stats.streak === "number" ? stats.streak : 0;
    // Les jours d'intérêts correspondent au bonus de fidélité + régularité (streak)
    const interestDaysEarned =
      activeTier === "STD"
        ? Math.min(10, Math.round(streak * 0.5))
        : currentPlanMeta.interestBonusDays + Math.round(streak * 0.8);

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + totalDays);
    const formattedExpiry = expirationDate.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const progressPercent = Math.min(
      100,
      Math.max(8, Math.round((totalDays / Math.max(baseCycle, totalDays)) * 100))
    );

    return {
      totalDays,
      baseCycle,
      interestDaysEarned,
      formattedExpiry,
      progressPercent,
    };
  }, [stats.daysRemaining, stats.streak, currentPlanMeta, activeTier]);

  const toggleAutoRenew = () => {
    const next = !autoRenew;
    setAutoRenew(next);
    localStorage.setItem(AUTO_RENEW_STORAGE_KEY, String(next));
    toast({
      title: next
        ? "Renouvellement automatique activé"
        : "Renouvellement automatique mis en pause",
      description: next
        ? "Votre souscription sera reconduite à la fin de votre période."
        : `Votre ${currentPlanMeta.name} restera actif jusqu'au ${telemetry.formattedExpiry} sans prélèvement.`,
    });
  };

  // Recalibrer la durée sur le cycle standard si le compteur de test était monté à 1305 jours
  const handleNormalizeDurationToCycle = () => {
    const targetDays =
      currentPlanMeta.cycleDurationDays + currentPlanMeta.interestBonusDays;
    const updatedStats = {
      ...stats,
      daysRemaining: targetDays,
      credits: currentPlanMeta.creditsIncluded,
    };
    localStorage.setItem(USER_GAMIFICATION_KEY, JSON.stringify(updatedStats));
    setStats(updatedStats);
    window.dispatchEvent(new CustomEvent("hippocampus-stats-updated"));
    toast({
      title: "Durée recalibrée sur le cycle officiel",
      description: `${currentPlanMeta.cycleDurationDays} jours de forfait + ${currentPlanMeta.interestBonusDays} jours d'intérêts (${targetDays} jours au total).`,
    });
  };

  const handleOpenPlanCheckout = (plan: UnifiedPlanDefinition) => {
    if (plan.tier === "STD") {
      localStorage.setItem("dawjang_active_plan_tier", "STD");
      const updated = {
        ...stats,
        isPremium: false,
        daysRemaining: 30 + plan.interestBonusDays,
        credits: Math.max(100, stats.credits),
      };
      setStats(updated);
      setActiveTier("STD");
      localStorage.setItem(USER_GAMIFICATION_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("hippocampus-stats-updated"));
      toast({
        title: "Plan Initié activé",
        description: "Votre emblème Boussole est synchronisé sur votre profil.",
      });
      return;
    }
    setSelectedPlan(plan);
    setCheckoutOpen(true);
  };

  const handleConfirmSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    const currentProfile = getSavedStudentProfile();
    saveStudentProfile({
      ...currentProfile,
      fullName: buyerName.trim() || currentProfile.fullName,
      email: buyerEmail.trim() || currentProfile.email,
      phone: buyerPhone.trim() || currentProfile.phone,
    });

    const durationToAdd =
      billingCycle === "monthly"
        ? selectedPlan.monthlyDurationDays
        : selectedPlan.cycleDurationDays;
    const bonusDays =
      billingCycle === "monthly"
        ? Math.round(selectedPlan.interestBonusDays / 3)
        : selectedPlan.interestBonusDays;

    const updatedStats = {
      ...stats,
      isPremium: true,
      credits: stats.credits + selectedPlan.creditsIncluded,
      daysRemaining: durationToAdd + bonusDays,
    };

    localStorage.setItem("dawjang_active_plan_tier", selectedPlan.tier);
    localStorage.setItem(USER_GAMIFICATION_KEY, JSON.stringify(updatedStats));
    localStorage.setItem(AUTO_RENEW_STORAGE_KEY, "true");
    setAutoRenew(true);
    setStats(updatedStats);
    setActiveTier(selectedPlan.tier);

    // Ajout d'une facture dans l'historique
    const newInvoice: InvoiceHistoryItem = {
      id: `INV-2026-${Math.floor(100 + Math.random() * 899)}`,
      date: new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      planName: selectedPlan.name,
      tier: selectedPlan.tier,
      amount:
        billingCycle === "monthly"
          ? selectedPlan.monthlyFCFA
          : selectedPlan.semesterFCFA,
      durationCredited: `${durationToAdd} jours`,
      interestDays: bonusDays,
      method:
        paymentMethod === "wave"
          ? "Wave Sénégal"
          : paymentMethod === "om"
          ? "Orange Money"
          : "Carte Bancaire",
      status: "Payé",
    };
    const nextInvoices = [newInvoice, ...invoices];
    setInvoices(nextInvoices);
    localStorage.setItem(
      SUBSCRIPTION_HISTORY_KEY,
      JSON.stringify(nextInvoices)
    );

    setCheckoutOpen(false);
    window.dispatchEvent(new CustomEvent("hippocampus-stats-updated"));
    window.dispatchEvent(new CustomEvent("hippocampus-profile-updated"));

    toast({
      title: `${selectedPlan.name} activé !`,
      description: `${durationToAdd} jours + ${bonusDays} jours d'intérêts offerts et +${selectedPlan.creditsIncluded} crédits IA crédités.`,
    });
  };

  const handleConfirmCancellation = () => {
    if (cancelMode === "end_of_cycle") {
      setAutoRenew(false);
      localStorage.setItem(AUTO_RENEW_STORAGE_KEY, "false");
      setCancelModalOpen(false);
      toast({
        title: "Résiliation programmée à l'échéance",
        description: `Votre ${currentPlanMeta.name} et vos ${telemetry.interestDaysEarned} jours d'intérêts restent actifs jusqu'au ${telemetry.formattedExpiry}.`,
      });
      return;
    }

    // Résiliation immédiate : bascule sur le Plan Initié (Boussole)
    const updatedStats = {
      ...stats,
      isPremium: false,
      daysRemaining: 30,
    };
    localStorage.setItem("dawjang_active_plan_tier", "STD");
    localStorage.setItem(AUTO_RENEW_STORAGE_KEY, "false");
    localStorage.setItem(USER_GAMIFICATION_KEY, JSON.stringify(updatedStats));
    setAutoRenew(false);
    setStats(updatedStats);
    setActiveTier("STD");
    setCancelModalOpen(false);
    window.dispatchEvent(new CustomEvent("hippocampus-stats-updated"));

    toast({
      title: "Abonnement résilié immédiatement",
      description:
        "Votre compte repasse sur le Plan Initié (Boussole). Vos cours et QCM restent intégralement conservés.",
    });
  };

  const handleDownloadInvoice = (inv: InvoiceHistoryItem) => {
    const content = [
      "==================================================",
      "          REÇU OFFICIEL DAWJANG STUDIO            ",
      "==================================================",
      `Référence facture : ${inv.id}`,
      `Date d'émission   : ${inv.date}`,
      `Titulaire         : ${buyerName || "Étudiant DawJang"}`,
      `Formule souscrite : ${inv.planName}`,
      `Durée créditée    : ${inv.durationCredited} (+${inv.interestDays} jours d'intérêts offerts)`,
      `Montant réglé     : ${inv.amount}`,
      `Moyen de paiement : ${inv.method}`,
      `Statut            : ${inv.status}`,
      "==================================================",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.id}-DawJang.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Reçu téléchargé",
      description: `Le justificatif ${inv.id} a été enregistré sur votre appareil.`,
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      {/* =====================================================================
          1. EN-TÊTE DU TABLEAU DE BORD (SANS DOUBLON DE HEADER)
         ===================================================================== */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-border/80 pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-primary font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>GESTION DE SOUSCRIPTION, DURÉE & JOURS D'INTÉRÊTS</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl text-foreground tracking-tight">
            Souscription & Plans DawJang
          </h1>
          <p className="text-[14.5px] text-muted-foreground max-w-2xl leading-relaxed">
            Pilotez la durée de votre forfait, consultez vos{" "}
            <strong className="text-foreground">
              jours d'intérêts cumulés
            </strong>
            , téléchargez vos reçus ou résiliez votre abonnement en toute
            liberté.
          </p>
        </div>

        {/* Sélecteur de cycle synchronisé avec la page /tarifs */}
        <div className="inline-flex items-center rounded-2xl border border-border bg-card p-1.5 shadow-2xs self-start lg:self-end">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              "rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition-all",
              billingCycle === "monthly"
                ? "bg-foreground text-background shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Cadence mensuelle
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("semester")}
            className={cn(
              "rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition-all flex items-center gap-2",
              billingCycle === "semester"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Forfait Semestriel / Annuel</span>
            <span className="rounded-full bg-white/20 px-2 py-0.2 font-mono text-[10px]">
              -25%
            </span>
          </button>
        </div>
      </header>

      {/* =====================================================================
          2. COCKPIT DE L'ABONNEMENT ACTIF (DURÉE, JOURS D'INTÉRÊTS, CRÉDITS & RÉSILIATION)
         ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Carte Gauche (7 col) : Durée du Plan, Jours Restants & Jours d'Intérêts */}
        <Card className="lg:col-span-7 border-border/90 bg-card flex flex-col justify-between p-6 sm:p-7 space-y-6 shadow-2xs">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-5">
            <div className="flex items-center gap-4">
              <PlanTierIconBadge tier={activeTier} size="lg" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-primary">
                    {currentPlanMeta.philosophyTag}
                  </span>
                  <Badge
                    variant={autoRenew ? "default" : "secondary"}
                    className="font-mono text-[10px]"
                  >
                    {autoRenew
                      ? "RENOUVELLEMENT AUTO ACTIF"
                      : "FIN PROGRAMMÉE À L'ÉCHÉANCE"}
                  </Badge>
                </div>
                <h2 className="font-serif text-2xl sm:text-3xl text-foreground mt-0.5">
                  {currentPlanMeta.name}
                </h2>
              </div>
            </div>

            {telemetry.totalDays > 400 && (
              <button
                type="button"
                onClick={handleNormalizeDurationToCycle}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/60 hover:bg-secondary px-3 py-1.5 font-mono text-[11px] font-semibold text-foreground transition-colors"
                title="Réinitialiser le compteur de test sur la durée normale du forfait"
              >
                <RefreshCw className="h-3 w-3 text-primary" />
                <span>Calibrer sur {currentPlanMeta.cycleDurationDays}j</span>
              </button>
            )}
          </div>

          {/* Les 3 Compteurs Temporels : Durée du Cycle | Jours d'Intérêts Gagnés | Validité Totale */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-2xl border border-border/80 bg-background/60 p-4 space-y-1">
              <span className="font-mono text-[10px] uppercase text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Durée du forfait
              </span>
              <span className="font-serif text-2xl font-normal text-foreground block">
                {currentPlanMeta.cycleDurationDays} jours
              </span>
              <span className="text-[11.5px] text-muted-foreground block">
                {activeTier === "MAJOR"
                  ? "Cycle annuel complet"
                  : activeTier === "PRO"
                  ? "Cycle semestriel (6 mois)"
                  : "Cycle mensuel libre"}
              </span>
            </div>

            <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.06] p-4 space-y-1">
              <span className="font-mono text-[10px] uppercase text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Jours d'intérêts
              </span>
              <span className="font-serif text-2xl font-normal text-emerald-700 dark:text-emerald-400 block">
                +{telemetry.interestDaysEarned} jours
              </span>
              <span className="text-[11.5px] text-muted-foreground block">
                Bonus fidélité & cadence ({stats.streak}j)
              </span>
            </div>

            <div className="rounded-2xl border border-primary/35 bg-primary/[0.06] p-4 space-y-1">
              <span className="font-mono text-[10px] uppercase text-primary font-bold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Validité restante
              </span>
              <span className="font-serif text-2xl font-normal text-foreground block">
                {telemetry.totalDays} jours
              </span>
              <span className="text-[11.5px] text-muted-foreground block">
                Échéance : {telemetry.formattedExpiry}
              </span>
            </div>
          </div>

          {/* Barre de progression temporelle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px] font-mono">
              <span className="text-muted-foreground">
                Réserve temporelle active (Forfait + Jours d'intérêts)
              </span>
              <span className="font-bold text-primary">
                Jusqu'au {telemetry.formattedExpiry}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500 transition-all duration-500"
                style={{ width: `${telemetry.progressPercent}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Carte Droite (5 col) : Crédits IA, Règlement & Contrôle de Résiliation */}
        <Card className="lg:col-span-5 border-border/90 bg-card flex flex-col justify-between p-6 sm:p-7 space-y-5 shadow-2xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/70 pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                  SOLDE D'ANALYSE IA DISPONIBLE
                </span>
                <span className="font-serif text-3xl text-foreground">
                  {stats.credits.toLocaleString("fr-FR")} crédits
                </span>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Zap className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/50 p-4 space-y-2.5 text-[12.5px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Mode de règlement associé
                </span>
                <span className="font-semibold text-foreground">
                  Wave Sénégal / Mobile
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Palier d'expérience actuel
                </span>
                <span className="font-mono font-bold text-primary">
                  LV. {stats.level} ({stats.rankTitle})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Reconduction automatique
                </span>
                <button
                  type="button"
                  onClick={toggleAutoRenew}
                  className="font-mono text-[11.5px] font-semibold text-primary hover:underline"
                >
                  {autoRenew ? "Activée (Modifier)" : "En pause (Réactiver)"}
                </button>
              </div>
            </div>
          </div>

          {/* Boutons de contrôle d'abonnement : Pause & Résiliation accessibles à tout moment */}
          <div className="pt-3 border-t border-border/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleAutoRenew}
              className="flex-1 rounded-xl text-[12px]"
            >
              <PauseCircle className="h-3.5 w-3.5 text-primary" />
              <span>
                {autoRenew ? "Suspendre le renouvellement" : "Réactiver l'auto-renouvellement"}
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCancelModalOpen(true)}
              className="rounded-xl text-[12px] border-destructive/35 text-destructive hover:bg-destructive/10"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Résilier l'abonnement</span>
            </Button>
          </div>
        </Card>
      </section>

      {/* =====================================================================
          3. LES 3 PLANS SYNCHRONISÉS AVEC LA LANDING PAGE (/tarifs)
             (1. Plan Napoléon | 2. Plan Taoïste | 3. Plan Initié)
         ===================================================================== */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
              Changer de Plan ou prolonger ma période
            </h2>
            <p className="text-[13.5px] text-muted-foreground">
              Chaque souscription ajoute immédiatement la durée du forfait ainsi
              que ses jours d'intérêts offerts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/tarifs")}
            className="text-[12.5px] font-semibold text-primary hover:underline self-start sm:self-end"
          >
            Voir la matrice comparative complète sur /tarifs →
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {UNIFIED_DAWJANG_PLANS.map((plan) => {
            const isCurrent = activeTier === plan.tier;
            const displayedDuration =
              billingCycle === "monthly"
                ? plan.monthlyDurationDays
                : plan.cycleDurationDays;
            const displayedBonus =
              billingCycle === "monthly"
                ? Math.max(1, Math.round(plan.interestBonusDays / 3))
                : plan.interestBonusDays;

            return (
              <div
                key={plan.id}
                className={cn(
                  "rounded-[28px] border p-7 flex flex-col justify-between space-y-6 transition-all duration-300",
                  plan.imperialDark
                    ? "border-amber-500/45 bg-[#141312] text-[#FAF9F5] shadow-[0_24px_55px_-15px_rgba(0,0,0,0.45)]"
                    : plan.featured
                    ? "border-primary bg-card shadow-[0_24px_55px_-15px_rgba(201,100,66,0.2)]"
                    : "border-border/85 bg-card"
                )}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <PlanTierIconBadge tier={plan.tier} size="lg" />
                      <div>
                        <span
                          className={cn(
                            "font-mono text-[9.5px] font-bold uppercase tracking-wider block",
                            plan.imperialDark
                              ? "text-amber-400"
                              : "text-primary"
                          )}
                        >
                          {plan.philosophyTag}
                        </span>
                        <h3 className="font-serif text-2xl">{plan.name}</h3>
                      </div>
                    </div>

                    {isCurrent && (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                          plan.imperialDark
                            ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                            : "bg-primary/15 text-primary border border-primary/30"
                        )}
                      >
                        ACTUEL
                      </span>
                    )}
                  </div>

                  <p
                    className={cn(
                      "text-[13px] leading-relaxed",
                      plan.imperialDark
                        ? "text-white/75"
                        : "text-muted-foreground"
                    )}
                  >
                    {plan.subtitle}
                  </p>

                  {/* Prix + Encart Durée & Jours d'intérêts */}
                  <div
                    className={cn(
                      "pt-3 border-t space-y-2",
                      plan.imperialDark ? "border-white/10" : "border-border/60"
                    )}
                  >
                    <span className="font-serif text-3xl sm:text-4xl block">
                      {billingCycle === "monthly"
                        ? plan.monthlyFCFA
                        : plan.semesterFCFA}
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span
                        className={cn(
                          "rounded-lg px-2 py-0.5 font-mono text-[10.5px] font-semibold",
                          plan.imperialDark
                            ? "bg-white/10 text-white"
                            : "bg-secondary text-foreground"
                        )}
                      >
                        Durée : {displayedDuration} jours
                      </span>
                      <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10.5px] font-bold text-emerald-500">
                        +{displayedBonus} j d'intérêts
                      </span>
                    </div>
                  </div>

                  <ul
                    className={cn(
                      "space-y-2.5 pt-3 border-t text-[13px]",
                      plan.imperialDark ? "border-white/10" : "border-border/60"
                    )}
                  >
                    {plan.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-2.5">
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0 mt-0.5",
                            plan.imperialDark
                              ? "text-amber-400"
                              : "text-primary"
                          )}
                        />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  onClick={() => handleOpenPlanCheckout(plan)}
                  variant={plan.featured ? "default" : "outline"}
                  className={cn(
                    "w-full h-11 rounded-xl text-[13.5px] font-semibold transition-all flex items-center justify-center gap-2",
                    plan.imperialDark
                      ? "bg-gradient-to-r from-amber-500 to-[#C96442] text-white hover:brightness-110 shadow-[0_4px_20px_rgba(201,100,66,0.35)] border-0 cursor-pointer"
                      : plan.featured
                      ? "bg-foreground text-background hover:bg-foreground/90 shadow-sm cursor-pointer"
                      : "border-border bg-card hover:bg-secondary/70 text-foreground cursor-pointer"
                  )}
                >
                  <span>
                    {isCurrent
                      ? `Prolonger le ${plan.name}`
                      : `Adopter le ${plan.name}`}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          4. HISTORIQUE DES REÇUS & GARANTIE DE RÉSILIATION À TOUT MOMENT
         ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Historique des transactions */}
        <Card className="lg:col-span-8 border-border/85 bg-card overflow-hidden">
          <CardHeader className="border-b border-border/70 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg">
                  Historique de facturation & Jours crédités
                </CardTitle>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                Justificatifs téléchargeables
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border/70 bg-secondary/35 font-mono text-[10.5px] uppercase text-muted-foreground">
                    <th className="py-3 px-4">Réf / Date</th>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4">Durée + Intérêts</th>
                    <th className="py-3 px-4">Montant</th>
                    <th className="py-3 px-4 text-right">Reçu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-secondary/20 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-semibold text-foreground block">
                          {inv.id}
                        </span>
                        <span className="text-[11.5px] text-muted-foreground">
                          {inv.date}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <PlanTierIconBadge tier={inv.tier} size="xs" />
                          <span className="font-semibold text-foreground">
                            {inv.planName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[12px]">
                        <span>{inv.durationCredited}</span>{" "}
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          (+{inv.interestDays}j)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold">
                        {inv.amount}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoice(inv)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background hover:border-primary hover:text-primary px-2.5 py-1 text-[11.5px] font-semibold transition-colors"
                        >
                          <Download className="h-3 w-3" />
                          <span>Reçu</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Encadré de Résiliation transparente */}
        <Card className="lg:col-span-4 border-border/85 bg-secondary/25 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <h3 className="text-[15px] font-semibold text-foreground">
              Politique de résiliation sans engagement
            </h3>
          </div>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            Chez DawJang, vous gardez le contrôle total sur votre abonnement :
            vous pouvez arrêter le renouvellement automatique tout en profitant
            de vos{" "}
            <strong className="text-foreground">
              {telemetry.totalDays} jours restants
            </strong>{" "}
            (incluant vos{" "}
            <strong className="text-emerald-600 dark:text-emerald-400">
              +{telemetry.interestDaysEarned} jours d'intérêts
            </strong>
            ), ou résilier immédiatement.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCancelModalOpen(true)}
            className="w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 font-semibold"
          >
            Gérer ou résilier mon abonnement
          </Button>
        </Card>
      </section>

      {/* =====================================================================
          MODAL 1 : ACTIVATION / PROLONGATION DE PLAN (WAVE, ORANGE MONEY, CARTE)
         ===================================================================== */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              {selectedPlan && (
                <PlanTierIconBadge tier={selectedPlan.tier} size="md" />
              )}
              <span className="font-mono text-xs text-primary font-bold">
                {selectedPlan?.philosophyTag}
              </span>
            </div>
            <DialogTitle className="font-serif text-2xl font-normal">
              Activer le {selectedPlan?.name}
            </DialogTitle>
            <DialogDescription>
              Durée créditée :{" "}
              <strong>
                {billingCycle === "monthly"
                  ? selectedPlan?.monthlyDurationDays
                  : selectedPlan?.cycleDurationDays}{" "}
                jours
              </strong>{" "}
              +{" "}
              <strong className="text-emerald-600">
                {billingCycle === "monthly"
                  ? Math.max(
                      1,
                      Math.round((selectedPlan?.interestBonusDays || 3) / 3)
                    )
                  : selectedPlan?.interestBonusDays}{" "}
                jours d'intérêts offerts
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmSubscription} className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "wave" as const, label: "Wave Sénégal" },
                { id: "om" as const, label: "Orange Money" },
                { id: "card" as const, label: "Carte Bancaire" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={cn(
                    "rounded-xl border py-2.5 px-2 text-center text-[12px] font-semibold transition-all",
                    paymentMethod === m.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-foreground">
                  Nom complet
                </label>
                <Input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-foreground">
                  Adresse e-mail
                </label>
                <Input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-foreground">
                  Téléphone {paymentMethod === "wave" ? "Wave" : "Mobile"}
                </label>
                <Input
                  type="tel"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCheckoutOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit">
                Confirmer & Activer le {selectedPlan?.name}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =====================================================================
          MODAL 2 : RÉSILIATION GRANULAIRE (À L'ÉCHÉANCE OU IMMÉDIATE)
         ===================================================================== */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-serif text-2xl font-normal">
              <AlertTriangle className="h-5 w-5" />
              Résilier mon abonnement ({currentPlanMeta.name})
            </DialogTitle>
            <DialogDescription>
              Choisissez comment vous souhaitez appliquer la résiliation de
              votre souscription :
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <button
              type="button"
              onClick={() => setCancelMode("end_of_cycle")}
              className={cn(
                "w-full rounded-2xl border p-4 text-left transition-all space-y-1",
                cancelMode === "end_of_cycle"
                  ? "border-primary bg-primary/[0.06]"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-semibold text-foreground">
                  1. Résilier à l'échéance (Recommandé)
                </span>
                <Badge variant="default" className="font-mono text-[10px]">
                  CONSERVE VOS JOURS
                </Badge>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Désactive tout futur prélèvement, mais vous conservez votre{" "}
                <strong>{currentPlanMeta.name}</strong>, vos{" "}
                <strong>{telemetry.totalDays} jours restants</strong> et vos{" "}
                <strong>+{telemetry.interestDaysEarned} jours d'intérêts</strong>{" "}
                jusqu'au {telemetry.formattedExpiry}.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setCancelMode("immediate")}
              className={cn(
                "w-full rounded-2xl border p-4 text-left transition-all space-y-1",
                cancelMode === "immediate"
                  ? "border-destructive bg-destructive/[0.06]"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-semibold text-foreground">
                  2. Résilier immédiatement et repasser au Plan Initié
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Votre profil repasse immédiatement sur l'emblème Boussole (Plan
                Initié). Vos cours, résumés, QCM et flashcards restent
                intégralement sauvegardés.
              </p>
            </button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelModalOpen(false)}>
              Conserver mon abonnement
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancellation}
            >
              {cancelMode === "end_of_cycle"
                ? "Confirmer l'arrêt à l'échéance"
                : "Résilier immédiatement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
