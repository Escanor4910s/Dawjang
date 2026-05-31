import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Zap, Crown, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { AnimatedBanner } from "@/components/AnimatedBanner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { CheckoutDrawer } from "@/components/checkout/CheckoutDrawer";

interface PlanDetails {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  color: string;
}
import { PRICING_TIERS } from "@/config/pricing";

// --- Données des offres basées sur le modèle PRICING_TIERS (prix en FCFA) ---
const PLANS = PRICING_TIERS.map((tier) => {
  const isPremium = tier.id === "premium";
  const isPro = tier.id === "pro";

  return {
    id: tier.id,
    name: tier.name,
    badge: tier.id === "freemium" ? "Gratuit" : isPremium ? "Le plus choisi" : "Excellence",
    monthlyPrice: tier.monthlyPrice,
    yearlyPrice: tier.yearlyPrice,
    description: tier.description,
    icon: tier.id === "freemium" ? Sparkles : isPremium ? Zap : Crown,
    color: tier.id === "freemium" ? "text-[#888888]" : isPremium ? "text-[#5B21B6]" : "text-amber-500",
    bgColor: tier.id === "freemium" ? "bg-[#FAFAF8] dark:bg-[#161614]" : "bg-white dark:bg-[#161614]",
    borderColor: isPremium
      ? "border-[#5B21B6] shadow-[0_20px_40px_-15px_rgba(91,33,182,0.15)]"
      : isPro
        ? "border-black/10 dark:border-white/10 hover:border-amber-500/50 transition-colors duration-300"
        : "border-black/10 dark:border-white/10",
    buttonText: tier.cta,
    buttonClass: tier.id === "freemium"
      ? "bg-[#FAFAF8] dark:bg-[#161614] text-[#888888] border border-black/10 dark:border-white/10 cursor-default"
      : isPremium
        ? "bg-[#5B21B6] text-white hover:bg-[#4C1D95] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
        : "bg-[#111111] text-white hover:bg-amber-500 hover:shadow-lg transition-all duration-300",
    features: tier.features,
    // Features missing from lower tiers (shown as greyed out)
    missingFeatures: tier.id === "freemium"
      ? [
          "Génération de QCM illimitée",
          "Résumés structurés & complets",
          "Simulateur ECOS complet",
          "Tuteur IA (Agent MOR)",
          "Mode Duel Multijoueur",
        ]
      : isPremium
        ? ["Analyse prédictive de réussite", "Support prioritaire 7j/7"]
        : [],
  };
});

const Subscription = () => {
  const [isAnnual, setIsAnnual] = useState(true);
  const navigate = useNavigate();
  const { plan: userPlan, isAdmin, loading: roleLoading } = useUserRole();

  // User & checkout state
  const [user, setUser] = useState<any>(null);
  const [currentPlan, setCurrentPlan] = useState<string>("gratuit");
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanDetails | null>(null);

  // Cancellation state
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    const fetchUserPlan = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();

      if (profile?.plan) {
        setCurrentPlan(profile.plan);
      }
      setLoading(false);

      // Auto-open checkout if arriving from Pricing with ?plan= parameter
      const queryParams = new URLSearchParams(window.location.search);
      const requestedPlan = queryParams.get("plan");
      if (requestedPlan && requestedPlan !== "freemium") {
        const targetTier = PRICING_TIERS.find((t) => t.id === requestedPlan);
        if (targetTier) {
          setSelectedPlan({
            id: targetTier.id,
            name: targetTier.name,
            priceMonthly: targetTier.monthlyPrice,
            priceAnnual: targetTier.yearlyPrice,
            color: targetTier.id === "premium" ? "text-[#5B21B6]" : targetTier.id === "pro" ? "text-amber-500" : "text-[#888888]"
          });
          setIsDrawerOpen(true);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };

    // Handle return from PayTech
    const queryParams = new URLSearchParams(window.location.search);
    const status = queryParams.get("status");
    if (status === "success") {
      toast.success("Paiement réussi ! 🎉 Votre abonnement a été mis à jour.");
      window.history.replaceState({}, document.title, window.location.pathname);
      // Reload to refresh plan state
      setTimeout(() => window.location.reload(), 1500);
    } else if (status === "cancel") {
      toast.error("Paiement annulé. Vous pouvez réessayer quand vous le souhaitez.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    fetchUserPlan();
  }, [navigate, isAnnual]);

  const handleSubscribe = (plan: typeof PLANS[0]) => {
    if (plan.id === "freemium") return;
    
    setSelectedPlan({
      id: plan.id,
      name: plan.name,
      priceMonthly: plan.monthlyPrice,
      priceAnnual: plan.yearlyPrice,
      color: plan.color
    });
    
    setIsDrawerOpen(true);
  };

  const handleCancelSubscription = async () => {
    try {
      setIsCancelling(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Vous devez être connecté pour résilier votre abonnement.");
        setIsCancelling(false);
        return;
      }

      console.log("[CANCEL] User ID:", session.user.id);

      // Read current plan BEFORE any attempt
      const { data: beforeProfile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", session.user.id)
        .single();
      console.log("[CANCEL] Plan AVANT résiliation:", beforeProfile?.plan);

      // If already on free plan, no need to cancel
      if (!beforeProfile?.plan || beforeProfile.plan === "gratuit" || beforeProfile.plan === "freemium") {
        toast.info("Vous êtes déjà sur le plan gratuit.");
        setCurrentPlan("gratuit");
        setIsCancelling(false);
        setIsConfirmingCancel(false);
        setTimeout(() => window.location.reload(), 1000);
        return;
      }

      let cancelled = false;

      // Strategy 1: RPC function (SECURITY DEFINER — bypasses RLS)
      console.log("[CANCEL] Tentative 1: RPC cancel_user_subscription...");
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "cancel_user_subscription" as any
      );
      console.log("[CANCEL] RPC résultat:", rpcResult, "erreur:", rpcError);
      if (!rpcError && rpcResult?.success) {
        cancelled = true;
        console.log("[CANCEL] ✅ RPC a réussi !");
      }

      // Strategy 2: Direct update (most straightforward)
      if (!cancelled) {
        console.log("[CANCEL] Tentative 2: Update direct du profil...");
        const { data: updateData, error: updateError, count, status, statusText } = await supabase
          .from("profiles")
          .update({ plan: "gratuit" } as any)
          .eq("id", session.user.id)
          .select();
        console.log("[CANCEL] Update résultat:", { updateData, updateError, count, status, statusText });
        if (!updateError) {
          cancelled = true;
          console.log("[CANCEL] ✅ Update direct a réussi !");
        }
      }

      // Strategy 3: Edge function (fallback)
      if (!cancelled) {
        console.log("[CANCEL] Tentative 3: Edge function...");
        try {
          const { data, error } = await supabase.functions.invoke("cancel-subscription", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          console.log("[CANCEL] Edge fn résultat:", data, "erreur:", error);
          if (!error && !data?.error) {
            cancelled = true;
            console.log("[CANCEL] ✅ Edge function a réussi !");
          }
        } catch (edgeErr) {
          console.log("[CANCEL] Edge function exception:", edgeErr);
        }
      }

      // Read plan AFTER all attempts
      const { data: afterProfile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", session.user.id)
        .single();
      console.log("[CANCEL] Plan APRÈS résiliation:", afterProfile?.plan);

      if (afterProfile?.plan && afterProfile.plan !== "gratuit" && afterProfile.plan !== "freemium") {
        console.error("[CANCEL] ❌ ÉCHEC: le plan n'a pas changé !", {
          before: beforeProfile?.plan,
          after: afterProfile?.plan,
          cancelledFlag: cancelled,
        });
        toast.error(
          `Résiliation échouée (plan actuel: ${afterProfile.plan}). Ouvrez la console (F12) et partagez les logs.`,
          { duration: 12000 }
        );
        setIsCancelling(false);
        setIsConfirmingCancel(false);
        return;
      }

      setCurrentPlan("gratuit");
      toast.success("Abonnement résilié avec succès ! Vous êtes sur le plan Gratuit. 🎉");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      console.error("[CANCEL] Exception globale:", err);
      toast.error(err.message || "Erreur. Veuillez réessayer.");
      setIsCancelling(false);
      setIsConfirmingCancel(false);
    }
  };

  const effectivePlan = isAdmin ? "admin" : currentPlan || userPlan || "gratuit";
  const isPremiumUser = effectivePlan === "premium" || effectivePlan === "pro" || effectivePlan === "admin";

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#0E0E0C] flex items-center justify-center">
        <div className="animate-pulse text-[#5B21B6] text-lg font-medium">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#0E0E0C] text-[#111111] dark:text-[#F4F4F2] bg-doodle-watermark font-sans pt-8 pb-24 transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto px-6 space-y-12">
        {/* En-tête : La Banderole Animée */}
        <AnimatedBanner
          title="Débloquez votre potentiel."
          subtitle="Investissez dans votre réussite médicale avec l'intelligence clinique d'Hippocampus."
          rightWidgets={
            <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md p-1.5 rounded-full border border-white/10">
              <button
                onClick={() => setIsAnnual(false)}
                className={`px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
                  !isAnnual
                    ? "bg-white text-black shadow-sm"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${
                  isAnnual
                    ? "bg-white text-black shadow-sm"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Annuel{" "}
                <span className="bg-[#5B21B6] text-white px-2 py-0.5 rounded-full text-[8px]">
                  -20%
                </span>
              </button>
            </div>
          }
        />

        {/* Grille des Prix (Bento Éditorial) */}
        <div className="grid lg:grid-cols-3 gap-8 max-w-[1200px] mx-auto mt-12">
          {PLANS.map((plan, idx) => {
            const Icon = plan.icon;
            const isPremium = plan.id === "premium";
            const isCurrentPlan = effectivePlan === plan.id || (isAdmin && plan.id === "pro");
            const displayPrice = isAnnual ? plan.yearlyPrice : plan.monthlyPrice;
            const formattedPrice = displayPrice.toLocaleString("fr-FR");

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.5, ease: "easeOut" }}
                className={`relative flex flex-col p-8 md:p-10 rounded-[2.5rem] border ${plan.borderColor} ${
                  plan.id === 'freemium' ? 'bg-[#FAFAF8] dark:bg-[#111110]' : 'bg-white dark:bg-[#161614]'
                } ${isPremium ? "z-10 scale-100 lg:scale-105" : "z-0"}`}
              >
                {/* Badge Flottant pour l'offre mise en avant */}
                {isPremium && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#5B21B6] text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-md flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" /> {plan.badge}
                  </div>
                )}

                {/* Badge "Plan Actuel" */}
                {isCurrentPlan && (
                  <div className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border border-emerald-500/20">
                    ✓ Plan actuel
                  </div>
                )}

                {/* En-tête de la carte */}
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`p-3 rounded-2xl bg-[#FAFAF8] dark:bg-[#0E0E0C] border border-black/5 dark:border-white/5 ${plan.color}`}>

                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#111111] dark:text-[#F4F4F2]">{plan.name}</h3>
                      {!isPremium && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888] dark:text-[#A0A09C]">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-5xl font-light tracking-tighter text-[#111111] dark:text-[#F4F4F2]">
                      {formattedPrice}
                    </span>
                    <span className="text-sm font-medium text-[#888888] dark:text-[#A0A09C] mb-2">
                      FCFA / {isAnnual && plan.id !== "freemium" ? "an" : "mois"}
                    </span>
                  </div>
                  {isAnnual && plan.id !== "freemium" && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5B21B6] mt-2">
                      Soit {Math.round(plan.yearlyPrice / 12).toLocaleString("fr-FR")} FCFA/mois
                      — Économisez{" "}
                      {(plan.monthlyPrice * 12 - plan.yearlyPrice).toLocaleString("fr-FR")} FCFA
                    </p>
                  )}
                  <p className="text-sm text-[#666666] dark:text-[#A0A09C] mt-4 leading-relaxed h-10">
                    {plan.description}
                  </p>
                </div>

                {/* Bouton d'Action */}
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={isCurrentPlan || plan.id === "freemium"}
                  className={`w-full py-4 rounded-full font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 mb-10 disabled:opacity-50 disabled:cursor-not-allowed ${plan.buttonClass}`}
                >
                  {isCurrentPlan ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Plan actuel
                    </>
                  ) : (
                    <>
                      {plan.buttonText}
                      {plan.id !== "freemium" && <ArrowRight className="h-4 w-4" />}
                    </>
                  )}
                </button>

                {/* Liste des Fonctionnalités */}
                <div className="space-y-4 flex-grow">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#111111] dark:text-[#F4F4F2] mb-6">
                    Inclus dans ce plan :
                  </p>

                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2
                        className={`h-5 w-5 shrink-0 ${isPremium ? "text-[#5B21B6]" : "text-[#111111] dark:text-[#F4F4F2]"}`}
                      />
                      <span className="text-sm font-medium text-[#111111] dark:text-[#F4F4F2]">{feature}</span>
                    </div>
                  ))}

                  {plan.missingFeatures.map((feature, i) => (
                    <div key={`missing-${i}`} className="flex items-start gap-3 opacity-40">
                      <div className="h-5 w-5 shrink-0 flex items-center justify-center">
                        <div className="h-0.5 w-3 bg-[#111111] dark:bg-[#F4F4F2] rounded-full" />
                      </div>
                      <span className="text-sm font-medium text-[#111111] dark:text-[#F4F4F2] line-through">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Section Résiliation (visible uniquement pour les abonnés) */}
        {isPremiumUser && effectivePlan !== "admin" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-[600px] mx-auto mt-8"
          >
            {isConfirmingCancel ? (
              <div className="p-6 rounded-[2rem] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 space-y-4 text-center">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                  ⚠️ Êtes-vous sûr de vouloir résilier votre abonnement{" "}
                  {effectivePlan === "premium" ? "Premium" : "Excellence"} ? Vous perdrez
                  instantanément vos avantages.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleCancelSubscription}
                    disabled={isCancelling}
                    className="px-6 py-3 rounded-full bg-red-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    {isCancelling ? "Résiliation..." : "Oui, résilier"}
                  </button>
                  <button
                    onClick={() => setIsConfirmingCancel(false)}
                    className="px-6 py-3 rounded-full bg-white dark:bg-[#161614] text-[#111111] dark:text-[#F4F4F2] border border-black/10 dark:border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  >
                    Conserver mon plan
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsConfirmingCancel(true)}
                className="w-full py-3 rounded-full border border-red-200 text-red-500 text-xs font-bold uppercase tracking-widest hover:bg-red-50 hover:border-red-300 transition-all"
              >
                Résilier mon abonnement
              </button>
            )}
          </motion.div>
        )}

        {/* Section Réassurance & Sécurité */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-[800px] mx-auto mt-20 pt-10 border-t border-black/10 dark:border-white/10 text-center flex flex-col items-center"
        >
          <ShieldCheck className="h-10 w-10 text-[#888888] mb-4" />
          <h4 className="text-lg font-bold text-[#111111] dark:text-[#F4F4F2] mb-2">Paiement 100% Sécurisé</h4>
          <p className="text-sm text-[#666666] dark:text-[#A0A09C] max-w-md mx-auto">
            Vos transactions sont chiffrées de bout en bout par PayTech. Annulez votre
            abonnement à tout moment d'un simple clic depuis votre espace « Mon Plan ». Aucun
            engagement de durée.
          </p>
        </motion.div>
      </div>

      {/* Checkout Drawer (Facture de Luxe) */}
      <CheckoutDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        plan={selectedPlan} 
        initialIsAnnual={isAnnual}
        user={user}
        onSuccess={() => {
          if (selectedPlan) setCurrentPlan(selectedPlan.id);
        }}
      />
    </div>
  );
};

export default Subscription;
