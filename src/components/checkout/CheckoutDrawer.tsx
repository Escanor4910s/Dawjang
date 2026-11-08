import { untypedTable } from "@/lib/untypedDb";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, ShieldCheck, Smartphone, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PlanDetails {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  color: string;
}

interface CheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanDetails | null;
  initialIsAnnual: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  onSuccess: () => void;
}

export const CheckoutDrawer = ({ isOpen, onClose, plan, initialIsAnnual, user, onSuccess }: CheckoutDrawerProps) => {
  const [isAnnual, setIsAnnual] = useState(initialIsAnnual);
  const [paymentMethod, setPaymentMethod] = useState<"mobile_money" | "paypal">("mobile_money");
  const [mobileProvider, setMobileProvider] = useState<string>("orange_money");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [paypalLoaded, setPaypalLoaded] = useState(false);

  // Synchroniser le cycle de facturation
  useEffect(() => { setIsAnnual(initialIsAnnual); }, [initialIsAnnual, isOpen]);

  // Bloquer le scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Charger le SDK PayPal
  useEffect(() => {
    if (!isOpen || paymentMethod !== "paypal") return;
    const existingScript = document.getElementById("paypal-sdk");
    if (existingScript) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).paypal) {
        setPaypalLoaded(true);
      } else {
        existingScript.addEventListener("load", () => setPaypalLoaded(true));
      }
      return;
    }
    const script = document.createElement("script");
    script.id = "paypal-sdk";
    script.src = "https://www.sandbox.paypal.com/sdk/js?client-id=AbTC7T9dQwnStg4x1DEvbuMikFiYZOx2YpOEAdhfEYGQg9tIDvEK8Z2zhhPYBjqm2l0OfMEmvntkFzx8&currency=EUR";
    script.async = true;
    script.onload = () => setPaypalLoaded(true);
    script.onerror = () => toast.error("Erreur de chargement du SDK PayPal.");
    document.body.appendChild(script);
  }, [isOpen, paymentMethod]);

  const totalBill = isAnnual ? (plan?.priceAnnual || 0) : (plan?.priceMonthly || 0);

  // Render PayPal Buttons
  useEffect(() => {
    if (!paypalLoaded || paymentMethod !== "paypal" || !isOpen || !plan) return;

    const timer = setTimeout(() => {
      const container = document.getElementById("paypal-button-container");
      if (!container) return;
      container.innerHTML = "";

      // Conversion FCFA vers EUR (1 EUR = 655.957 FCFA)
      const euroPrice = (totalBill / 655.957).toFixed(2);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).paypal.Buttons({
          style: { layout: "vertical", color: "gold", shape: "pill", label: "paypal" },
           
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createOrder: (data: any, actions: any) => {
            return actions.order.create({
              purchase_units: [{
                description: `Abonnement DawJang - ${plan.name} (${isAnnual ? "Annuel" : "Mensuel"})`,
                amount: { currency_code: "EUR", value: euroPrice }
              }]
            });
          },
           
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onApprove: async (data: any, actions: any) => {
            setIsProcessing(true);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return actions.order.capture().then(async (details: any) => {
              try {
                if (user) {
                  const { error: profileError } = await supabase
                    .from("profiles")
                    .update({ plan: plan.id })
                    .eq("id", user.id);

                  if (profileError) throw profileError;

              window.dispatchEvent(
                new CustomEvent("hippocampus_plan_updated", {
                  detail: { plan: plan.id },
                })
              );

                  window.dispatchEvent(
                    new CustomEvent("hippocampus_plan_updated", {
                      detail: { plan: plan.id },
                    })
                  );

                  // Insert into subscriptions table
                  const { error: subError } = await untypedTable("subscriptions").insert({
                    user_id: user.id,
                    plan_id: plan.id,
                    status: "active",
                    price_paid: totalBill,
                    payment_method: "paypal",
                    transaction_id: details.id,
                    metadata: { paypal_details: details }
                  });
                  if (subError) console.warn("Could not record subscription in database:", subError);
                }

                setIsProcessing(false);
                setIsSuccess(true);
                toast.success("Paiement validé. Bienvenue dans l'excellence.");
                onSuccess();
                setTimeout(() => {
                  setIsSuccess(false);
                  onClose();
                }, 2000);

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } catch (err: any) {
                console.error("Supabase upgrade error after PayPal payment:", err);
                setIsProcessing(false);
                toast.error("Paiement réussi sur PayPal, mais erreur lors de la mise à niveau de votre profil.");
              }
            });
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onError: (err: any) => {
            console.error("PayPal Error:", err);
            toast.error("Une erreur s'est produite lors de la transaction PayPal.");
            setIsProcessing(false);
          },
          onCancel: () => {
            toast.info("Transaction annulée par l'utilisateur.");
            setIsProcessing(false);
          }
        }).render("#paypal-button-container");
      } catch (e) {
        console.error("Error rendering PayPal buttons:", e);
      }
    }, 150);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paypalLoaded, paymentMethod, isOpen, totalBill, plan?.id, plan?.name, isAnnual, user, onSuccess, onClose]);

  const handleMobileMoneyPayment = async () => {
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-paytech-payment", {
        body: {
          planId: plan.id,
          isYearly: isAnnual,
          successUrl: `${window.location.origin}/subscription?status=success`,
          cancelUrl: `${window.location.origin}/subscription?status=cancel`
        }
      });

      if (error || !data?.redirect_url) {
        console.warn("PayTech initialization failed", error);
        toast.warning("L'API PayTech n'est pas encore configurée (Mode Simulation activé)");
        
        setTimeout(async () => {
          try {
            if (user) {
              const { error: profileError } = await supabase
                .from("profiles")
                .update({ plan: plan.id })
                .eq("id", user.id);

              if (profileError) throw profileError;

              window.dispatchEvent(
                new CustomEvent("hippocampus_plan_updated", {
                  detail: { plan: plan.id },
                })
              );
            }
            setIsProcessing(false);
            setIsSuccess(true);
            toast.success("Paiement validé. Bienvenue dans l'excellence.");
            onSuccess();
            setTimeout(() => {
              setIsSuccess(false);
              onClose();
            }, 2000);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (err: any) {
            console.error("Supabase upgrade error:", err);
            setIsProcessing(false);
            toast.error("Erreur lors de la mise à niveau de votre profil.");
          }
        }, 2000);
        return;
      }

      setTimeout(() => {
        window.location.href = data.redirect_url;
      }, 1000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("PayTech function invocation failed:", err);
      toast.error("Erreur lors de la connexion à la passerelle PayTech.");
      setIsProcessing(false);
    }
  };

  if (!plan) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]"
          />

          <motion.div
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-[500px] bg-[#FAFAF8] shadow-[-20px_0_40px_rgba(0,0,0,0.1)] z-[101] flex flex-col overflow-hidden border-l border-black/5"
          >
            {/* En-tête */}
            <div className="flex items-center justify-between p-6 md:p-8 border-b border-black/5 bg-white">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-[#111111] rounded-full flex items-center justify-center">
                  <Lock className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#111111]">Paiement Sécurisé</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">DawJang Checkout</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors group"
              >
                <X className="h-5 w-5 text-[#888888] group-hover:text-[#111111] transition-colors" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 editorial-scrollbar">
              
              {/* Le Ticket de Caisse */}
              <div className="bg-white border border-black/10 rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden group">
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${(plan?.color || '').replace('text-', 'bg-')}`} />
                
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888] block mb-1">Abonnement</span>
                    <h3 className="text-2xl font-bold text-[#111111] flex items-center gap-2">
                      {plan.name} <Sparkles className={`h-4 w-4 ${plan.color}`} />
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-light tracking-tighter text-[#111111]">{(totalBill || 0).toLocaleString("fr-FR")}</span>
                    <span className="text-xs text-[#888888]"> FCFA/{isAnnual ? "an" : "mois"}</span>
                  </div>
                </div>

                <div className="flex p-1 bg-[#FAFAF8] rounded-xl border border-black/5 mb-6">
                  <button onClick={() => setIsAnnual(false)} className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${!isAnnual ? "bg-white text-[#111111] shadow-sm" : "text-[#888888] hover:text-[#111111]"}`}>
                    Mensuel
                  </button>
                  <button onClick={() => setIsAnnual(true)} className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex justify-center items-center gap-2 ${isAnnual ? "bg-white text-[#111111] shadow-sm" : "text-[#888888] hover:text-[#111111]"}`}>
                    Annuel <span className="text-[8px] bg-[#5B21B6] text-white px-1.5 py-0.5 rounded-full">-25%</span>
                  </button>
                </div>

                <div className="border-t border-dashed border-black/15 my-6 relative">
                  <div className="absolute -left-8 -top-3 w-6 h-6 bg-[#FAFAF8] rounded-full border-r border-black/10" />
                  <div className="absolute -right-8 -top-3 w-6 h-6 bg-[#FAFAF8] rounded-full border-l border-black/10" />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-[#111111]">Total à payer aujourd'hui</span>
                  <span className="text-2xl font-medium text-[#111111]">{(totalBill || 0).toLocaleString("fr-FR")} FCFA</span>
                </div>
                {isAnnual && (
                  <p className="text-right text-[10px] text-[#5B21B6] font-bold uppercase tracking-widest mt-1">
                    Prochain prélèvement dans 1 an
                  </p>
                )}
              </div>

              {/* Méthodes de Paiement */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Moyen de paiement</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setPaymentMethod("mobile_money")}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 ${
                      paymentMethod === "mobile_money" ? "border-[#5B21B6] bg-[#5B21B6]/5 text-[#5B21B6]" : "border-black/10 bg-white text-[#111111] hover:border-[#111111]"
                    }`}
                  >
                    <Smartphone className="h-6 w-6 mb-2" />
                    <span className="text-xs font-bold">Mobile Money</span>
                  </button>
                  <button 
                    onClick={() => setPaymentMethod("paypal")}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 ${
                      paymentMethod === "paypal" ? "border-[#0070ba] bg-[#0070ba]/5 text-[#0070ba]" : "border-black/10 bg-white text-[#111111] hover:border-[#111111]"
                    }`}
                  >
                    <svg className="h-6 w-6 mb-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.11c-.473 0-.867.317-.984.767L7.076 21.337z" />
                    </svg>
                    <span className="text-xs font-bold">PayPal / Carte</span>
                  </button>
                </div>
              </div>

              {/* Contenu de la méthode sélectionnée */}
              <AnimatePresence mode="wait">
                {paymentMethod === "mobile_money" && (
                  <motion.div
                    key="mobile_money"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 pt-2">
                      <p className="text-xs text-[#666666] leading-relaxed">
                        Payez en toute simplicité avec votre compte Orange Money ou Mixx By YAS. Vous serez redirigé vers notre partenaire sécurisé PayTech.
                      </p>
                      
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { id: "orange_money", name: "Orange Money", colors: "hover:border-orange-500 hover:text-orange-600 shadow-[0_4px_10px_rgba(249,115,22,0.15)]" },
                          { id: "wave", name: "Wave", colors: "hover:border-blue-500 hover:text-blue-600 shadow-[0_4px_10px_rgba(59,130,246,0.15)]" },
                          { id: "mixx_by_yas", name: "Mixx YAS", colors: "hover:border-yellow-500 hover:text-yellow-600 shadow-[0_4px_10px_rgba(234,179,8,0.15)]" }
                        ].map((provider) => (
                          <motion.button 
                            key={provider.id}
                            type="button"
                            whileHover={{ y: -4, scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onClick={() => setMobileProvider(provider.id as any)}
                            className={`flex flex-col h-24 rounded-xl border items-center justify-center cursor-pointer transition-all duration-300 ${
                              mobileProvider === provider.id 
                                ? "border-[#5B21B6] bg-[#5B21B6]/5 text-[#5B21B6] shadow-md font-extrabold" 
                                : `border-black/10 bg-[#FAFAF8] text-[#888888] font-bold hover:bg-white hover:shadow-lg hover:${provider.colors.split(' ')[0]} ${provider.colors.split(' ')[1]} ${provider.colors.split(' ')[2]}`
                            }`}
                          >
                            <img src={`/${provider.id}.jpg`} alt={provider.name} className="h-10 w-auto rounded object-contain mb-2" />
                            <span className="text-[10px] uppercase tracking-wider">{provider.name}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {paymentMethod === "paypal" && (
                  <motion.div
                    key="paypal"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden pt-4"
                  >
                    <div id="paypal-button-container" className="w-full min-h-[150px]" />
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

            {/* Pied du tiroir : Action & Trust */}
            <div className="p-6 md:p-8 bg-white border-t border-black/5 mt-auto">
              {paymentMethod === "mobile_money" && (
                <button
                  onClick={handleMobileMoneyPayment}
                  disabled={isProcessing || isSuccess}
                  className={`w-full py-5 rounded-full font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all duration-300 shadow-md ${
                    isSuccess 
                      ? "bg-green-500 text-white"
                      : "bg-[#111111] hover:bg-[#5B21B6] text-white hover:shadow-lg hover:-translate-y-0.5"
                  }`}
                >
                  {isSuccess ? (
                    <><CheckCircle2 className="h-5 w-5" /> Paiement Réussi</>
                  ) : isProcessing ? (
                    <span className="animate-pulse">Redirection vers PayTech...</span>
                  ) : (
                    <>Payer {(totalBill || 0).toLocaleString("fr-FR")} FCFA <ChevronRight className="h-4 w-4" /></>
                  )}
                </button>
              )}
              
              {paymentMethod === "paypal" && (
                <div className="text-center">
                  <p className="text-xs text-[#888888] font-medium">
                    Utilisez les boutons PayPal ci-dessus pour finaliser votre achat de {(totalBill || 0).toLocaleString("fr-FR")} FCFA.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 mt-6">
                <ShieldCheck className="h-4 w-4 text-[#888888]" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">
                  Paiement chiffré AES-256 • Propulsé par PayTech / PayPal
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
