// src/pages/Pricing.tsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Clock,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  UserAvatar,
  PlanTierIconBadge,
  getStoredUserStats,
  USER_GAMIFICATION_KEY,
} from "@/components/UserAvatar";
import {
  DawJangDragonIcon,
  DawJangWordmark,
} from "@/components/landing/HippocampusLogo";
import {
  UNIFIED_DAWJANG_PLANS,
  UnifiedPlanDefinition,
} from "./Subscription";
import { getSavedStudentProfile, saveStudentProfile } from "./Settings";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const COMPARISON_ROWS = [
  {
    feature: "Sceau distinctif sur le profil et la Carte Membre",
    napoleon: "Étoile Impériale",
    taoiste: "Diamant",
    initie: "Boussole",
  },
  {
    feature: "Durée du forfait & Jours d'intérêts offerts",
    napoleon: "365 jours (+35 j d'intérêts)",
    taoiste: "180 jours (+15 j d'intérêts)",
    initie: "30 jours (+3 j d'intérêts)",
  },
  {
    feature: "Importation de cours et d'annales en masse",
    napoleon: "Illimitée + Prioritaire",
    taoiste: "Illimitée",
    initie: "Unitaire",
  },
  {
    feature: "Génération QCM IA (Censure, Groupage, Jumelage, Association)",
    napoleon: "Les 6 formats IA",
    taoiste: "Les 6 formats IA",
    initie: "Manuel",
  },
  {
    feature: "Mimétisme du style des professeurs (Banque d'annales)",
    napoleon: "Haute capacité (2 500 cr.)",
    taoiste: "Inclus (600 cr.)",
    initie: "—",
  },
  {
    feature: "Calculateur de Probabilités & Ciblage de fin de semestre",
    napoleon: "Complet",
    taoiste: "Complet",
    initie: "Aperçu",
  },
  {
    feature: "Liberté de résiliation ou pause d'abonnement",
    napoleon: "En 1 clic (jours conservés)",
    taoiste: "En 1 clic (jours conservés)",
    initie: "Sans engagement",
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "semester">(
    "semester"
  );
  const [selectedOffer, setSelectedOffer] =
    useState<UnifiedPlanDefinition | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"wave" | "om" | "card">("wave");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+221 77 ");

  useEffect(() => {
    window.scrollTo(0, 0);
    const prof = getSavedStudentProfile();
    setFullName(prof.fullName || "");
    setEmail(prof.email || "");
    setPhone(prof.phone || "+221 77 ");
  }, []);

  const handleChooseOffer = (offer: UnifiedPlanDefinition) => {
    if (offer.tier === "STD") {
      localStorage.setItem("dawjang_active_plan_tier", "STD");
      window.dispatchEvent(new CustomEvent("hippocampus-stats-updated"));
      toast({
        title: "Plan Initié activé",
        description: "Votre emblème Boussole est actif sur votre profil.",
      });
      navigate("/dashboard");
      return;
    }
    setSelectedOffer(offer);
    setModalOpen(true);
  };

  const handleActivateOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffer) return;

    const currentProf = getSavedStudentProfile();
    saveStudentProfile({
      ...currentProf,
      fullName: fullName.trim() || currentProf.fullName,
      email: email.trim() || currentProf.email,
      phone: phone.trim() || currentProf.phone,
    });

    const durationToAdd =
      billingCycle === "monthly"
        ? selectedOffer.monthlyDurationDays
        : selectedOffer.cycleDurationDays;
    const bonusDays =
      billingCycle === "monthly"
        ? Math.max(1, Math.round(selectedOffer.interestBonusDays / 3))
        : selectedOffer.interestBonusDays;

    const stats = getStoredUserStats();
    const nextStats = {
      ...stats,
      isPremium: true,
      credits: stats.credits + selectedOffer.creditsIncluded,
      daysRemaining: durationToAdd + bonusDays,
    };

    localStorage.setItem("dawjang_active_plan_tier", selectedOffer.tier);
    localStorage.setItem(USER_GAMIFICATION_KEY, JSON.stringify(nextStats));
    window.dispatchEvent(new CustomEvent("hippocampus-stats-updated"));
    window.dispatchEvent(new CustomEvent("hippocampus-profile-updated"));

    setModalOpen(false);
    toast({
      title: `${selectedOffer.name} activé !`,
      description: `${durationToAdd} jours + ${bonusDays} jours d'intérêts offerts et +${selectedOffer.creditsIncluded} crédits IA synchronisés.`,
    });
    navigate("/subscription");
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF9F5] dark:bg-[#111110] text-[#141413] dark:text-[#F5F3EE] selection:bg-primary/20 selection:text-primary">
      <header className="sticky top-0 z-50 border-b border-[#E5E2DC] dark:border-white/10 bg-[#FAF9F5]/90 dark:bg-[#111110]/90 backdrop-blur-xl py-3.5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="group inline-flex items-center gap-2.5 focus:outline-none"
          >
            <DawJangDragonIcon className="h-9 w-9 text-foreground transition-transform duration-300 group-hover:scale-105" />
            <div className="flex flex-col">
              <DawJangWordmark size="md" />
              <span className="text-[10.5px] font-medium text-muted-foreground leading-none mt-0.5">
                Studio Académique
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 rounded-full border border-border bg-card/80 px-2 py-1">
            <Link
              to="/"
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Page d'accueil
            </Link>
            <span className="rounded-full bg-primary/12 px-3.5 py-1.5 text-[13px] font-semibold text-primary">
              Plans & Emblèmes
            </span>
            <Link
              to="/subscription"
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Gérer mon abonnement
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <UserAvatar inHeader={true} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-16 space-y-20">
        <section className="text-center max-w-3xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3.5 py-1.5 text-[12px] font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>TROIS PHILOSOPHIES DE TRAVAIL • DURÉE & JOURS D'INTÉRÊTS GARANTIS</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-6xl text-foreground tracking-tight leading-[1.06]">
            Plan Napoléon, Plan Taoïste ou Plan Initié.
          </h1>

          <p className="text-[16px] text-muted-foreground leading-relaxed">
            Choisissez votre doctrine d'étude. L'icône de votre plan s'inscrit
            instantanément sur votre profil et sur votre{" "}
            <strong className="text-foreground">Carte Membre</strong>, avec
            possibilité de résilier en un clic à tout moment.
          </p>

          <div className="inline-flex items-center rounded-2xl border border-border bg-card p-1.5 shadow-2xs mt-2">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "rounded-xl px-4 py-2 text-[13px] font-semibold transition-all",
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
                "rounded-xl px-4 py-2 text-[13px] font-semibold transition-all flex items-center gap-2",
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
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-7 items-stretch">
          {UNIFIED_DAWJANG_PLANS.map((offer) => {
            const displayedDuration =
              billingCycle === "monthly"
                ? offer.monthlyDurationDays
                : offer.cycleDurationDays;
            const displayedBonus =
              billingCycle === "monthly"
                ? Math.max(1, Math.round(offer.interestBonusDays / 3))
                : offer.interestBonusDays;

            return (
              <div
                key={offer.id}
                className={cn(
                  "rounded-[28px] border p-8 flex flex-col justify-between space-y-7 transition-all duration-300",
                  offer.imperialDark
                    ? "border-amber-500/45 bg-[#141312] text-[#FAF9F5] shadow-[0_28px_65px_-15px_rgba(0,0,0,0.45)]"
                    : offer.featured
                    ? "border-primary bg-card shadow-[0_28px_65px_-15px_rgba(201,100,66,0.22)] lg:-translate-y-2"
                    : "border-border/85 bg-card/80 hover:border-foreground/30"
                )}
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3.5">
                      <PlanTierIconBadge tier={offer.tier} size="lg" />
                      <div>
                        <span
                          className={cn(
                            "font-mono text-[10px] font-bold uppercase tracking-wider block",
                            offer.imperialDark
                              ? "text-amber-400"
                              : "text-primary"
                          )}
                        >
                          {offer.philosophyTag}
                        </span>
                        <h2 className="font-serif text-2xl sm:text-3xl">
                          {offer.name}
                        </h2>
                      </div>
                    </div>
                  </div>

                  <p
                    className={cn(
                      "text-[13.5px] leading-relaxed",
                      offer.imperialDark
                        ? "text-white/75"
                        : "text-muted-foreground"
                    )}
                  >
                    {offer.subtitle}
                  </p>

                  <div
                    className={cn(
                      "pt-3 border-t space-y-2.5",
                      offer.imperialDark
                        ? "border-white/10"
                        : "border-border/60"
                    )}
                  >
                    <span className="font-serif text-4xl sm:text-5xl block">
                      {billingCycle === "monthly"
                        ? offer.monthlyFCFA
                        : offer.semesterFCFA}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold",
                          offer.imperialDark
                            ? "bg-white/10 text-white"
                            : "bg-secondary text-foreground"
                        )}
                      >
                        <Clock className="h-3 w-3 text-primary" />
                        Durée : {displayedDuration} j
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-500">
                        <TrendingUp className="h-3 w-3" />+{displayedBonus} j
                        d'intérêts
                      </span>
                    </div>
                  </div>

                  <ul
                    className={cn(
                      "space-y-3 pt-3 border-t text-[13.5px]",
                      offer.imperialDark
                        ? "border-white/10"
                        : "border-border/60"
                    )}
                  >
                    {offer.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-2.5">
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0 mt-0.5",
                            offer.imperialDark
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
                  onClick={() => handleChooseOffer(offer)}
                  variant={offer.featured ? "default" : "outline"}
                  className={cn(
                    "w-full h-12 rounded-2xl text-[14px] font-semibold transition-all flex items-center justify-center gap-2",
                    offer.imperialDark
                      ? "bg-gradient-to-r from-amber-500 to-[#C96442] text-white hover:brightness-110 shadow-[0_4px_20px_rgba(201,100,66,0.35)] border-0 cursor-pointer"
                      : offer.featured
                      ? "bg-foreground text-background hover:bg-foreground/90 shadow-sm cursor-pointer"
                      : "border-border bg-card hover:bg-secondary/70 text-foreground cursor-pointer"
                  )}
                >
                  <span>Adopter le {offer.name}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </section>

        <section className="rounded-[28px] border border-border bg-card overflow-hidden shadow-xs">
          <div className="p-6 sm:p-8 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-2xl sm:text-3xl text-foreground">
                Matrice comparative des 3 Plans
              </h3>
              <p className="text-[13.5px] text-muted-foreground">
                Comparez les capacités, la durée et les jours d'intérêts du Plan
                Napoléon, du Plan Taoïste et du Plan Initié.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <PlanTierIconBadge tier="MAJOR" size="md" />
              <PlanTierIconBadge tier="PRO" size="md" />
              <PlanTierIconBadge tier="STD" size="md" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-secondary/40 font-mono text-[11px] uppercase text-muted-foreground">
                  <th className="py-4 px-6">Instrument</th>
                  <th className="py-4 px-6 text-center text-amber-600 dark:text-amber-400 font-bold">
                    Plan Napoléon
                  </th>
                  <th className="py-4 px-4 text-center text-primary font-bold">
                    Plan Taoïste
                  </th>
                  <th className="py-4 px-4 text-center">Plan Initié</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-[13.5px]">
                {COMPARISON_ROWS.map((row) => (
                  <tr
                    key={row.feature}
                    className="hover:bg-secondary/25 transition-colors"
                  >
                    <td className="py-4 px-6 font-medium text-foreground">
                      {row.feature}
                    </td>
                    <td className="py-4 px-6 text-center font-semibold text-foreground">
                      {row.napoleon}
                    </td>
                    <td className="py-4 px-4 text-center font-semibold text-primary">
                      {row.taoiste}
                    </td>
                    <td className="py-4 px-4 text-center text-muted-foreground">
                      {row.initie}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              {selectedOffer && (
                <PlanTierIconBadge tier={selectedOffer.tier} size="md" />
              )}
              <span className="font-mono text-xs text-primary font-bold">
                ACTIVATION INSTANTANÉE
              </span>
            </div>
            <DialogTitle className="font-serif text-2xl font-normal">
              Activer le {selectedOffer?.name}
            </DialogTitle>
            <DialogDescription>
              Paiement sécurisé par Wave, Orange Money ou Carte bancaire.
              Résiliable en 1 clic depuis votre espace.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleActivateOffer} className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "wave" as const, label: "Wave" },
                { id: "om" as const, label: "Orange Money" },
                { id: "card" as const, label: "Carte" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPayMethod(m.id)}
                  className={cn(
                    "rounded-xl border py-2.5 text-[12.5px] font-semibold transition-all",
                    payMethod === m.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nom complet"
                required
              />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Adresse e-mail"
                required
              />
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+221 77 123 45 67"
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit">Activer mon {selectedOffer?.name}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
