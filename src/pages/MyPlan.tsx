import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Sparkles, Zap, Shield, Coins, ArrowUpRight, ReceiptText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

interface ProfileLite { plan: string | null; credits: number | null; first_name: string | null; name: string | null; }

const planMeta: Record<string, { label: string; color: string; icon: JSX.Element; perks: string[] }> = {
  gratuit: { label: "Gratuit", color: "bg-muted text-foreground", icon: <Sparkles className="h-5 w-5" />, perks: ["QCM limités", "1 résumé court / jour", "Pas de mode duel"] },
  premium: { label: "Premium", color: "bg-primary/10 text-primary", icon: <Zap className="h-5 w-5" />, perks: ["QCM illimités", "Résumés intermédiaire & complet", "Mode examen & flashcards", "Mor IA"] },
  pro: { label: "Pro", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400", icon: <Crown className="h-5 w-5" />, perks: ["Tout Premium", "Mode duel multijoueur", "Crédits IA prioritaires", "Support prioritaire"] },
  admin: { label: "Admin", color: "bg-destructive/15 text-destructive", icon: <Shield className="h-5 w-5" />, perks: ["Accès complet à toutes les fonctionnalités"] },
};

const MyPlan = () => {
  const { plan: rolePlan, isAdmin, loading: roleLoading } = useUserRole();
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelSubscription = async () => {
    try {
      setIsCancelling(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Attempt to update the plan to "gratuit"
      const { error } = await supabase
        .from("profiles")
        .update({ plan: "gratuit" })
        .eq("id", user.id);

      if (error) throw error;

      // Verify the update actually persisted (RLS may silently block it)
      const { data: verifyProfile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();

      if (verifyProfile?.plan && verifyProfile.plan !== "gratuit") {
        // RLS blocked the update — the plan is still premium/pro
        toast.error(
          "La résiliation n'a pas pu être effectuée (restriction serveur). Contactez le support pour résilier votre abonnement.",
          { duration: 6000 }
        );
        setIsCancelling(false);
        setIsConfirmingCancel(false);
        return;
      }

      toast.success("Votre abonnement a été résilié avec succès. Rechargement en cours...");
      
      // Force a full page reload to sync all components (sidebar, subscription page, etc.)
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de la résiliation de l'abonnement.");
      setIsCancelling(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (active) setLoading(false); return; }
        const { data, error } = await supabase
          .from("profiles")
          .select("plan, credits, first_name, name")
          .eq("id", user.id)
          .single();
        if (error) throw error;
        if (active) setProfile(data as ProfileLite);
      } catch (e: any) {
        toast.error("Impossible de charger votre plan");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const effectivePlan = isAdmin ? "admin" : (profile?.plan || rolePlan || "gratuit");
  const meta = planMeta[effectivePlan] || planMeta.gratuit;
  const isPremium = effectivePlan === "premium" || effectivePlan === "pro" || effectivePlan === "admin";

  return (
    <div className="min-h-screen bg-background bg-doodle-watermark p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Mon plan</h1>
          <p className="text-sm text-muted-foreground">Visualisez votre abonnement et vos crédits.</p>
        </header>

        {loading || roleLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : (
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${meta.color}`}>{meta.icon}</div>
                <div>
                  <CardTitle className="text-xl">{meta.label}</CardTitle>
                  <p className="text-xs text-muted-foreground">Statut: {isPremium ? "Actif ✓" : "Aucun abonnement"}</p>
                </div>
              </div>
              <Badge className={meta.color} variant="outline">{effectivePlan.toUpperCase()}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 text-sm font-medium"><Coins className="h-4 w-4" /> Crédits IA</div>
                <span className="text-lg font-bold">{isAdmin ? "∞" : (profile?.credits ?? 0)}</span>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Avantages inclus</p>
                <ul className="text-sm text-foreground/80 space-y-1 list-disc pl-5">
                  {meta.perks.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                {!isPremium && (
                  <Button asChild className="flex-1"><Link to="/subscription">Passer Premium <ArrowUpRight className="h-4 w-4 ml-1" /></Link></Button>
                )}
                <Button asChild variant="outline" className="flex-1"><Link to="/pricing">Voir les tarifs</Link></Button>
                <Button asChild variant="ghost" className="flex-1"><Link to="/refund"><ReceiptText className="h-4 w-4 mr-1" /> Remboursement</Link></Button>
              </div>

              {isPremium && effectivePlan !== "admin" && (
                <div className="pt-4 border-t border-border mt-4">
                  {isConfirmingCancel ? (
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 space-y-3">
                      <p className="text-xs font-semibold text-destructive-foreground text-center">
                        ⚠️ Êtes-vous sûr de vouloir résilier votre abonnement Premium ? Vous perdrez instantanément vos avantages cliniques illimités.
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button 
                          onClick={handleCancelSubscription} 
                          disabled={isCancelling}
                          variant="destructive" 
                          size="sm"
                          className="font-bold text-xs"
                        >
                          {isCancelling ? "Résiliation..." : "Oui, résilier"}
                        </Button>
                        <Button 
                          onClick={() => setIsConfirmingCancel(false)} 
                          variant="outline" 
                          size="sm"
                          className="font-bold text-xs"
                        >
                          Conserver mon plan
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => setIsConfirmingCancel(true)}
                      variant="destructive" 
                      className="w-full rounded-xl font-bold text-xs hover:bg-destructive/90 gap-1.5"
                    >
                      Résilier mon abonnement Premium
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Les changements de plan ne peuvent être effectués que par un administrateur (protégé côté serveur via RLS et trigger).
        </p>
      </div>
    </div>
  );
};

export default MyPlan;
