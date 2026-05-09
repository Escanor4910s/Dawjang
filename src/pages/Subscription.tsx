import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, Zap, Crown, ArrowRight, Brain, FileText, Download, Infinity, Target, BookOpen, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";

interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  icon: React.ReactNode;
  features: PlanFeature[];
  popular?: boolean;
  buttonText: string;
  buttonVariant: "default" | "outline" | "secondary";
  gradient?: string;
  color: string;
}

const Subscription = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, plan: userPlan } = useUserRole();
  const [isYearly, setIsYearly] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>("gratuit");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserPlan = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();
      
      if (profile?.plan) {
        setCurrentPlan(profile.plan);
      }
      
      setLoading(false);
    };
    
    fetchUserPlan();
  }, [navigate]);

  const plans: Plan[] = [
    {
      id: "freemium",
      name: "Freemium",
      description: "Découvrez QuizMed gratuitement",
      monthlyPrice: 0,
      yearlyPrice: 0,
      icon: <Sparkles className="h-6 w-6" />,
      buttonText: "Plan actuel",
      buttonVariant: "outline",
      color: "gray",
      features: [
        { text: "5 QCM par jour", included: true },
        { text: "QCM Classiques uniquement", included: true },
        { text: "Niveau Facile uniquement", included: true },
        { text: "Résumés courts", included: true },
        { text: "10 Flashcards max", included: true },
        { text: "1 cours par jour", included: true },
        { text: "Communauté publique", included: true },
        { text: "Téléchargement PDF", included: false },
        { text: "Agent MOR", included: false },
        { text: "Mode examen", included: false },
        { text: "QCM Groupage & Cas Cliniques", included: false },
      ]
    },
    {
      id: "premium",
      name: "Premium",
      description: "Pour les étudiants sérieux",
      monthlyPrice: 2500,
      yearlyPrice: 22500,
      icon: <Zap className="h-6 w-6" />,
      popular: true,
      buttonText: "Passer à Premium",
      buttonVariant: "default",
      gradient: "from-amber-500 to-orange-600",
      color: "amber",
      features: [
        { text: "QCM illimités", included: true, highlight: true },
        { text: "Tous types de QCM (Classique, Vrai/Faux)", included: true, highlight: true },
        { text: "Niveaux Facile & Intermédiaire", included: true },
        { text: "Résumés complets + structurés", included: true, highlight: true },
        { text: "Téléchargement PDF (résumés + QCM)", included: true, highlight: true },
        { text: "Flashcards illimitées", included: true },
        { text: "Upload illimité de cours", included: true },
        { text: "Historique complet", included: true },
        { text: "Agent MOR (assistant IA)", included: true, highlight: true },
        { text: "Corrections détaillées IA", included: true },
        { text: "QCM Groupage & Cas Cliniques", included: false },
        { text: "Niveau Difficile", included: false },
      ]
    },
    {
      id: "pro",
      name: "Pro",
      description: "Maîtrise totale pour réussir",
      monthlyPrice: 5000,
      yearlyPrice: 45000,
      icon: <Crown className="h-6 w-6" />,
      buttonText: "Passer à Pro",
      buttonVariant: "secondary",
      gradient: "from-violet-500 to-purple-600",
      color: "violet",
      features: [
        { text: "Tout Premium inclus", included: true, highlight: true },
        { text: "QCM Groupage médical", included: true, highlight: true },
        { text: "QCM Cas Cliniques", included: true, highlight: true },
        { text: "Niveau Difficile (raisonnement clinique)", included: true, highlight: true },
        { text: "Agent MOR prioritaire", included: true, highlight: true },
        { text: "Mode examen chronométré", included: true },
        { text: "Fusion multi-cours", included: true },
        { text: "Export PDF avancé stylé", included: true },
        { text: "IA prioritaire (réponses rapides)", included: true },
        { text: "Statistiques avancées", included: true },
        { text: "Support prioritaire", included: true },
        { text: "Accès anticipé nouvelles fonctionnalités", included: true },
      ]
    }
  ];

  const handleSelectPlan = (planId: string) => {
    if (planId === "freemium") {
      toast({
        title: "Plan Freemium",
        description: "Vous êtes déjà sur le plan gratuit"
      });
      return;
    }
    
    toast({
      title: "Bientôt disponible",
      description: `Le plan ${planId} sera disponible prochainement. Nous vous notifierons !`
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dashboard bg-doodle-watermark relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-[1600px] mx-auto px-4 py-12 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 px-4 py-1 border-primary/30 bg-primary/5">
            💰 Pricing
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground via-foreground/80 to-foreground bg-clip-text">
            Choisissez votre plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Débloquez tout le potentiel de QuizMed pour réussir vos examens
          </p>
          
          {isAdmin && (
            <Badge className="mt-4 bg-violet-600 text-background">
              <Shield className="h-3 w-3 mr-1" />
              Mode Admin - Accès illimité à toutes les fonctionnalités
            </Badge>
          )}
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <Label 
            htmlFor="billing-toggle" 
            className={`text-sm cursor-pointer transition-colors ${!isYearly ? "font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            Mensuel
          </Label>
          <Switch
            id="billing-toggle"
            checked={isYearly}
            onCheckedChange={setIsYearly}
          />
          <Label 
            htmlFor="billing-toggle" 
            className={`text-sm cursor-pointer flex items-center gap-2 transition-colors ${isYearly ? "font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            Annuel
            <Badge className="bg-emerald-500 text-background hover:bg-emerald-600">
              -25%
            </Badge>
          </Label>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-16">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id || (isAdmin && plan.id === "pro");
            
            return (
              <Card 
                key={plan.id}
                className={`relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 ${
                  plan.popular 
                    ? "border-2 border-amber-500 shadow-xl shadow-amber-500/10" 
                    : plan.id === "pro"
                      ? "border-2 border-violet-500 shadow-xl shadow-violet-500/10"
                      : "border-border/50 hover:border-border"
                } ${isCurrentPlan ? "ring-2 ring-primary ring-offset-2" : ""}`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-background text-xs font-bold py-2 text-center">
                      ⭐ LE PLUS POPULAIRE
                    </div>
                  </div>
                )}

                {/* Gradient Top Border */}
                {plan.gradient && (
                  <div className={`absolute inset-x-0 ${plan.popular ? "top-8" : "top-0"} h-1 bg-gradient-to-r ${plan.gradient}`} />
                )}

                <CardHeader className={`${plan.popular ? "pt-12" : "pt-8"} pb-4`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-xl ${
                      plan.popular 
                        ? "bg-amber-500/10 text-amber-600" 
                        : plan.id === "pro" 
                          ? "bg-violet-500/10 text-violet-600"
                          : "bg-muted text-muted-foreground"
                    }`}>
                      {plan.icon}
                    </div>
                    <div>
                      <CardTitle className="text-2xl">{plan.name}</CardTitle>
                      <CardDescription className="text-sm">{plan.description}</CardDescription>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        {(isYearly ? plan.yearlyPrice : plan.monthlyPrice).toLocaleString('fr-FR')}
                      </span>
                      <span className="text-muted-foreground text-base">
                        FCFA/{isYearly ? "an" : "mois"}
                      </span>
                    </div>
                    {isYearly && plan.monthlyPrice > 0 && (
                      <p className="text-sm text-emerald-600 mt-1 font-medium">
                        Soit {Math.round(plan.yearlyPrice / 12).toLocaleString('fr-FR')} FCFA/mois — Économisez {(plan.monthlyPrice * 12 - plan.yearlyPrice).toLocaleString('fr-FR')} FCFA
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Features List */}
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li 
                        key={index}
                        className={`flex items-start gap-3 text-sm ${
                          feature.included ? "text-foreground" : "text-muted-foreground/50"
                        }`}
                      >
                        <div className={`mt-0.5 rounded-full p-0.5 ${
                          feature.included 
                            ? feature.highlight
                              ? plan.popular 
                                ? "bg-amber-500 text-background" 
                                : plan.id === "pro"
                                  ? "bg-violet-500 text-background"
                                  : "bg-primary text-primary-foreground"
                              : plan.popular 
                                ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30" 
                                : "bg-muted text-muted-foreground"
                            : "bg-muted/50 text-muted-foreground/30"
                        }`}>
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <span className={`${!feature.included ? "line-through" : ""} ${feature.highlight ? "font-medium" : ""}`}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Button
                    className={`w-full h-12 text-base font-semibold ${
                      plan.popular 
                        ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-background shadow-lg shadow-amber-500/25" 
                        : plan.id === "pro"
                          ? "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-background shadow-lg shadow-violet-500/25"
                          : ""
                    }`}
                    variant={plan.buttonVariant}
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrentPlan}
                  >
                    {isCurrentPlan ? (
                      <>
                        <Check className="h-5 w-5 mr-2" />
                        Plan actuel
                      </>
                    ) : (
                      <>
                        {plan.buttonText}
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Feature Comparison */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Comparaison des fonctionnalités</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: Brain, title: "Agent MOR", free: "❌", premium: "✓ Standard", pro: "✓ Prioritaire" },
              { icon: FileText, title: "QCM", free: "10/jour", premium: "Illimités", pro: "Illimités + Cliniques" },
              { icon: BookOpen, title: "Résumés", free: "Courts", premium: "Complets", pro: "Complets + Fusion" },
              { icon: Download, title: "Export PDF", free: "❌", premium: "✓", pro: "✓ Avancé" },
            ].map((feature, index) => (
              <Card key={index} className="text-center p-4">
                <feature.icon className="h-8 w-8 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold mb-3">{feature.title}</h3>
                <div className="space-y-2 text-sm">
                  <div className="py-1 px-2 rounded bg-muted/50">{feature.free}</div>
                  <div className="py-1 px-2 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{feature.premium}</div>
                  <div className="py-1 px-2 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">{feature.pro}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold mb-4">Des questions ?</h2>
          <p className="text-muted-foreground mb-6">
            Consultez notre FAQ ou contactez-nous directement
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline">
              Voir la FAQ
            </Button>
            <Button variant="outline">
              Contacter le support
            </Button>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-muted-foreground border-t pt-8">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" />
            Annulation à tout moment
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" />
            Paiement sécurisé SSL
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" />
            Satisfait ou remboursé 14j
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" />
            Support réactif
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
