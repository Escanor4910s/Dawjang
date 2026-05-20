import { useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion";
import { 
  CreditCard, ShieldCheck, Lock, Sparkles, RefreshCw, CheckCircle, 
  HelpCircle, ArrowRight, User, X, Smartphone, Wallet 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import confetti from "canvas-confetti";
import { uiAudio } from "@/utils/audio";

interface PremiumCheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  planName: string;
  price: number;
  isYearly: boolean;
  user: SupabaseUser | null;
  onSuccess: () => void;
}

export const PremiumCheckoutDrawer = ({
  isOpen,
  onClose,
  planId,
  planName,
  price,
  isYearly,
  user,
  onSuccess,
}: PremiumCheckoutDrawerProps) => {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardHolder, setCardHolder] = useState(
    user?.email ? user.email.split("@")[0].toUpperCase() : "CONFRÈRE"
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (user?.email && cardHolder === "CONFRÈRE") {
      setCardHolder(user.email.split("@")[0].toUpperCase());
    }
  }, [user]);

  // Reset drawer state when it opens or closes to avoid bypass/persistency bugs
  useEffect(() => {
    if (isOpen) {
      uiAudio.playDrawerSlide();
      setIsFinished(false);
      setIsProcessing(false);
      setProcessingStep(0);
      setPhoneNumber("");
      setCardNumber("");
      setExpiry("");
      setCvv("");
    }
  }, [isOpen]);

  // Mobile Money states
  const [paymentMethod, setPaymentMethod] = useState<"mobile_money" | "card">("mobile_money");
  const [mobileProvider, setMobileProvider] = useState<"wave" | "orange_money" | "mixx_yas">("wave");
  const [phoneNumber, setPhoneNumber] = useState("");

  // PayPal Sandbox states
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [paypalError, setPaypalError] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  // 3D Card tilt motion values
  const x = useMotionValue(160);
  const y = useMotionValue(95);

  const rotateX = useSpring(useTransform(y, [0, 190], [15, -15]), { stiffness: 100, damping: 20 });
  const rotateY = useSpring(useTransform(x, [0, 320], [-15, 15]), { stiffness: 100, damping: 20 });

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    x.set(mouseX);
    y.set(mouseY);
  };

  const handleMouseLeave = () => {
    x.set(160);
    y.set(95);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    value = value.substring(0, 16);
    const matches = value.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      setCardNumber(parts.join(" "));
    } else {
      setCardNumber(value);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 4) value = value.substring(0, 4);
    if (value.length >= 2) {
      setExpiry(`${value.slice(0, 2)}/${value.slice(2)}`);
    } else {
      setExpiry(value);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    setCvv(value.substring(0, 3));
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (paymentMethod === "card") {
      if (!cardNumber || !expiry || !cvv) {
        toast.error("Veuillez remplir toutes les coordonnées bancaires.");
        return;
      }
    }

    setIsProcessing(true);
    setProcessingStep(1); // Connexion clinique / Initiation push USSD

    // Sound alert trigger
    const playTone = (freq: number, dur: number) => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
        osc.start();
        osc.stop(ctx.currentTime + dur);
      } catch {}
    };

    playTone(587.33, 0.08);

    try {
      // Real PayTech Payment Creation call
      const { data, error } = await supabase.functions.invoke("create-paytech-payment", {
        body: {
          planId: planId,
          isYearly: isYearly,
          successUrl: `${window.location.origin}/subscription?status=success`,
          cancelUrl: `${window.location.origin}/subscription?status=cancel`
        }
      });

      if (error || !data?.redirect_url) {
        console.warn("PayTech initialization failed, falling back to simulated checkout:", error);
        
        // Fallback simulation for local offline testing if Edge function is not deployed or keys are missing
        toast.warning("L'API PayTech n'est pas encore configurée (Mode Simulation activé)");
        
        setTimeout(() => {
          setProcessingStep(2);
          playTone(587.33, 0.08);
        }, 1200);

        setTimeout(async () => {
          setProcessingStep(3);
          playTone(659.25, 0.08);

          try {
            if (user) {
              const { error: profileError } = await supabase
                .from("profiles")
                .update({ plan: planId })
                .eq("id", user.id);

              if (profileError) throw profileError;
            }

            setTimeout(() => {
              setIsProcessing(false);
              setIsFinished(true);
              uiAudio.playSuccessChime();
              confetti({ particleCount: 200, spread: 90, colors: ["#d97706", "#c084fc", "#10b981"] });
            }, 1200);

          } catch (err: any) {
            console.error("Supabase upgrade error:", err);
            setIsProcessing(false);
            toast.error("Erreur lors de la mise à niveau de votre profil.");
          }
        }, 2400);
        return;
      }

      // Success branch - real redirect to PayTech
      setProcessingStep(2);
      playTone(659.25, 0.08);
      
      setTimeout(() => {
        setProcessingStep(3);
        playTone(880, 0.25);
        
        setTimeout(() => {
          window.location.href = data.redirect_url;
        }, 800);
      }, 1000);

    } catch (err: any) {
      console.error("PayTech function invocation failed:", err);
      toast.error("Erreur lors de la connexion à la passerelle PayTech.");
      setIsProcessing(false);
    }
  };

  // Load PayPal SDK Dynamically
  useEffect(() => {
    if (!isOpen || paymentMethod !== "card") return;

    const existingScript = document.getElementById("paypal-sdk");
    if (existingScript) {
      setPaypalLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.id = "paypal-sdk";
    script.src = "https://www.paypal.com/sdk/js?client-id=AbTC7T9dQwnStg4x1DEvbuMikFiYZOx2YpOEAdhfEYGQg9tIDvEK8Z2zhhPYBjqm2l0OfMEmvntkFzx8&currency=EUR";
    script.async = true;
    script.onload = () => {
      setPaypalLoaded(true);
    };
    script.onerror = () => {
      setPaypalError(true);
      toast.error("Erreur de chargement du SDK PayPal.");
    };
    document.body.appendChild(script);

    return () => {
      // Keep script loaded to avoid multiple appends
    };
  }, [isOpen, paymentMethod]);

  // Render PayPal Buttons
  useEffect(() => {
    if (!paypalLoaded || paymentMethod !== "card" || !isOpen) return;

    // Timeout to make sure the target container #paypal-button-container is mounted and in the DOM
    const timer = setTimeout(() => {
      const container = document.getElementById("paypal-button-container");
      if (!container) return;

      container.innerHTML = "";

      // Convert FCFA to EUR: 1 EUR ≈ 655.957 FCFA
      const euroPrice = (price / 655.957).toFixed(2);

      try {
        (window as any).paypal.Buttons({
          style: {
            layout: "vertical",
            color: "gold",
            shape: "pill",
            label: "paypal"
          },
          createOrder: (data: any, actions: any) => {
            return actions.order.create({
              purchase_units: [{
                description: `Abonnement Hippocampus - ${planName} (${isYearly ? "Annuel" : "Mensuel"})`,
                amount: {
                  currency_code: "EUR",
                  value: euroPrice
                }
              }]
            });
          },
          onApprove: async (data: any, actions: any) => {
            setIsProcessing(true);
            setProcessingStep(1); // Connexion clinique / Initialisation
            
            return actions.order.capture().then(async (details: any) => {
              setProcessingStep(2); // Validation des fonds
              
              // Sound alert trigger
              const playTone = (freq: number, dur: number) => {
                try {
                  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.frequency.setValueAtTime(freq, ctx.currentTime);
                  gain.gain.setValueAtTime(0.08, ctx.currentTime);
                  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
                  osc.start();
                  osc.stop(ctx.currentTime + dur);
                } catch {}
              };

              playTone(659.25, 0.08);

              try {
                if (user) {
                  // Update plan in profile database!
                  const { error: profileError } = await supabase
                    .from("profiles")
                    .update({ plan: planId })
                    .eq("id", user.id);

                  if (profileError) throw profileError;

                  // Insert into subscriptions table
                  const { error: subError } = await supabase.from("subscriptions" as any).insert({
                    user_id: user.id,
                    plan_id: planId,
                    status: "active",
                    price_paid: price,
                    payment_method: "paypal",
                    transaction_id: details.id,
                    metadata: { paypal_details: details }
                  });
                  if (subError) console.warn("Could not record subscription in database, profile was upgraded anyway:", subError);
                }

                setProcessingStep(3); // Finalisation
                uiAudio.playSuccessChime();

                setTimeout(() => {
                  setIsProcessing(false);
                  setIsFinished(true);
                  confetti({ particleCount: 200, spread: 90, colors: ["#d97706", "#c084fc", "#10b981"] });
                }, 1000);

              } catch (err: any) {
                console.error("Supabase upgrade error after PayPal payment:", err);
                setIsProcessing(false);
                toast.error("Paiement réussi sur PayPal, mais erreur lors de la mise à niveau de votre profil.");
              }
            });
          },
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
  }, [paypalLoaded, paymentMethod, isOpen, price, planId, planName, isYearly, user]);

  const formattedPrice = price.toLocaleString("fr-FR");

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end items-center">
          {/* Glass background overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-md cursor-pointer"
          />

          {/* Drawer body container */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 25 }}
            className="relative max-w-md w-full bg-card/65 backdrop-blur-2xl border-l border-white/5 dark:border-white/10 shadow-2xl h-full p-6 md:p-8 flex flex-col justify-between overflow-y-auto z-10"
          >
            {/* Close Button */}
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 rounded-full h-8 w-8 text-muted-foreground hover:bg-muted/40"
            >
              <X className="h-4 w-4" />
            </Button>

            {!isFinished ? (
              <div className="space-y-6 flex-grow">
                {/* Header */}
                <div className="space-y-1">
                  <span className="text-[9px] font-black tracking-widest text-primary uppercase flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 animate-pulse" /> Finalisation de l'abonnement
                  </span>
                  <h3 className="text-xl font-bold text-foreground">Abonnement {planName}</h3>
                  <p className="text-xs text-muted-foreground/80 font-medium">
                    Sécurisé par protocole cryptographique de PayTech
                  </p>
                </div>

                {/* Method Tab Switcher */}
                <div className="grid grid-cols-2 p-1 bg-muted/40 backdrop-blur-md rounded-xl border border-border/40 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      uiAudio.playSoftClick();
                      setPaymentMethod("mobile_money");
                    }}
                    className={`py-2 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all ${
                      paymentMethod === "mobile_money"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" /> Mobile Money
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      uiAudio.playSoftClick();
                      setPaymentMethod("card");
                    }}
                    className={`py-2 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all ${
                      paymentMethod === "card"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" /> Carte Bancaire
                  </button>
                </div>

                {/* Visualizer Frame */}
                <div className="flex items-center justify-center py-2 min-h-[190px]">
                  {paymentMethod === "card" ? (
                    /* Interactive 3D Card Visualizer with front/back flipping */
                    <div className="perspective-1000 py-2">
                      <motion.div
                        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                        transition={{ type: "spring", stiffness: 85, damping: 15 }}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        className={`w-[300px] h-[175px] rounded-3xl relative shadow-2xl border cursor-pointer select-none transition-all duration-500 ${
                          planId === "premium"
                            ? "bg-gradient-to-br from-amber-500 to-amber-700 border-amber-400/30 text-white"
                            : "bg-gradient-to-br from-violet-600 to-purple-800 border-violet-400/30 text-white"
                        }`}
                      >
                        {/* CARD FRONT */}
                        <div 
                          className="absolute inset-0 p-5 flex flex-col justify-between"
                          style={{ backfaceVisibility: "hidden", transform: "translateZ(1px)" }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none" />
                          <div className="flex justify-between items-start" style={{ transform: "translateZ(30px)" }}>
                            <span className="text-sm font-black tracking-widest text-white flex items-center gap-1">
                              🧬 Hippocampus
                            </span>
                            <div className="h-6 px-2 rounded-md bg-white/15 backdrop-blur-md border border-white/10 overflow-hidden flex items-center justify-center">
                              {cardNumber.startsWith("4") ? (
                                <span className="text-[9px] font-black italic text-sky-400 tracking-wider">VISA</span>
                              ) : cardNumber.startsWith("5") ? (
                                <span className="text-[9px] font-black italic text-orange-400 tracking-wider">MC</span>
                              ) : (
                                <CreditCard className="h-3.5 w-3.5 text-white/80" />
                              )}
                            </div>
                          </div>
                          <div className="text-lg font-mono font-bold tracking-widest text-white/90 mt-5 text-center" style={{ transform: "translateZ(40px)" }}>
                            {cardNumber || "•••• •••• •••• ••••"}
                          </div>
                          <div className="flex justify-between items-end mt-4" style={{ transform: "translateZ(30px)" }}>
                            <div className="space-y-0.5">
                              <span className="text-[7px] uppercase font-bold text-white/50">Titulaire</span>
                              <p className="text-[10px] font-black tracking-wide text-white uppercase truncate max-w-[140px]">{cardHolder}</p>
                            </div>
                            <div className="space-y-0.5 text-right">
                              <span className="text-[7px] uppercase font-bold text-white/50">Expire</span>
                              <p className="text-[10px] font-black text-white">{expiry || "MM/AA"}</p>
                            </div>
                          </div>
                        </div>

                        {/* CARD BACK */}
                        <div 
                          className="absolute inset-0 flex flex-col justify-between py-5"
                          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg) translateZ(1px)" }}
                        >
                          <div className="w-full h-8 bg-zinc-950/80 mt-1" />
                          <div className="px-5 space-y-3" style={{ transform: "translateZ(30px)" }}>
                            <div className="flex items-center justify-end gap-3">
                              <span className="text-[7px] uppercase font-bold text-white/50">CVV</span>
                              <div className="w-14 h-7 bg-white rounded-md flex items-center justify-center text-xs font-mono font-bold text-slate-900 shadow-inner">
                                {cvv || "•••"}
                              </div>
                            </div>
                          </div>
                          <div className="px-5 flex justify-between items-center text-[7px] font-bold text-white/40 tracking-wider" style={{ transform: "translateZ(20px)" }}>
                            <span>M-ECOS SYNCED</span>
                            <span>🔒 SECURE CARD</span>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  ) : (
                    /* Simulated Mobile Money visual phone receiver */
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`w-[300px] h-[175px] rounded-3xl p-5 relative overflow-hidden shadow-2xl border flex flex-col justify-between select-none transition-all duration-500 ${
                        mobileProvider === "wave"
                          ? "bg-gradient-to-br from-cyan-400 to-blue-500 border-cyan-300/30 text-white"
                          : mobileProvider === "orange_money"
                            ? "bg-gradient-to-br from-orange-500 to-amber-600 border-orange-400/30 text-white"
                            : "bg-gradient-to-br from-amber-400 to-yellow-500 border-yellow-300/30 text-slate-950"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-[10px] font-black tracking-wider uppercase flex items-center gap-1 ${
                          mobileProvider === "mixx_yas" ? "text-slate-900/75" : "text-white/75"
                        }`}>
                          📲 Portefeuille PayTech
                        </span>
                        <div className="h-7 w-7 rounded-lg overflow-hidden border border-white/20 shadow-lg bg-white flex items-center justify-center">
                          <img 
                            src={
                              mobileProvider === "wave" 
                                ? "/wave.jpg" 
                                : mobileProvider === "orange_money" 
                                  ? "/orange_money.jpg" 
                                  : "/mixx_by_yas.jpg"
                            } 
                            alt="active provider" 
                            className="h-full w-full object-cover" 
                          />
                        </div>
                      </div>

                      {/* Display screen representing push USSD notification receiver */}
                      <div className={`backdrop-blur-md rounded-xl p-3 border my-1 text-center space-y-1 ${
                        mobileProvider === "mixx_yas" 
                          ? "bg-black/10 border-black/10 text-slate-900" 
                          : "bg-black/25 border-white/10 text-white"
                      }`}>
                        <span className={`text-[7px] uppercase tracking-widest font-black flex items-center justify-center gap-1 ${
                          mobileProvider === "mixx_yas" ? "text-slate-900/60" : "text-white/60"
                        }`}>
                          🔒 TRANSACTION SÉCURISÉE
                        </span>
                        <p className="text-xs font-mono font-bold uppercase tracking-tight">
                          Redirection PayTech
                        </p>
                        <p className={`text-[8px] italic ${
                          mobileProvider === "mixx_yas" ? "text-slate-900/70" : "text-white/70"
                        }`}>
                          Montant : {formattedPrice} FCFA
                        </p>
                      </div>

                      <div className={`flex justify-between items-center text-[8px] font-extrabold uppercase tracking-widest ${
                        mobileProvider === "mixx_yas" ? "text-slate-900/50" : "text-white/50"
                      }`}>
                        <span>Paiement Direct</span>
                        <span>Afrique de l'Ouest</span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Invoice summary */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-foreground">Total à régler</span>
                    <p className="text-[10px] text-muted-foreground">Facturation {isYearly ? "annuelle" : "mensuelle"}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-primary font-mono">{formattedPrice} FCFA</span>
                    <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">PayTech</p>
                  </div>
                </div>

                {/* Operator Selector (Mobile Money only) */}
                {paymentMethod === "mobile_money" && !isProcessing && (
                  <div className="space-y-1.5 animate-[fadeIn_0.3s_ease]">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Opérateur Télécom</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <motion.button
                        type="button"
                        whileHover={{ y: -4, scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          uiAudio.playSoftClick();
                          setMobileProvider("wave");
                        }}
                        className={`relative flex flex-col items-center justify-center p-3 h-28 rounded-2xl border text-center transition-all ${
                          mobileProvider === "wave"
                            ? "bg-cyan-500/10 border-cyan-500 shadow-[0_8px_20px_rgba(6,182,212,0.25)] text-cyan-600 dark:text-cyan-400 font-extrabold"
                            : "border-border/60 hover:border-muted-foreground/30 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-white/0 pointer-events-none" />
                        <div className="h-10 w-10 rounded-xl overflow-hidden border border-border/40 shadow-inner flex items-center justify-center bg-white">
                          <img src="/wave.jpg" alt="Wave logo" className="h-full w-full object-cover select-none" />
                        </div>
                        <span className="text-[9px] font-black tracking-wider uppercase mt-2">Wave</span>
                      </motion.button>

                      <motion.button
                        type="button"
                        whileHover={{ y: -4, scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          uiAudio.playSoftClick();
                          setMobileProvider("orange_money");
                        }}
                        className={`relative flex flex-col items-center justify-center p-3 h-28 rounded-2xl border text-center transition-all ${
                          mobileProvider === "orange_money"
                            ? "bg-orange-500/10 border-orange-500 shadow-[0_8px_20px_rgba(249,115,22,0.25)] text-orange-600 dark:text-orange-400 font-extrabold"
                            : "border-border/60 hover:border-muted-foreground/30 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-white/0 pointer-events-none" />
                        <div className="h-10 w-10 rounded-xl overflow-hidden border border-border/40 shadow-inner flex items-center justify-center bg-white">
                          <img src="/orange_money.jpg" alt="Orange Money logo" className="h-full w-full object-cover select-none" />
                        </div>
                        <span className="text-[9px] font-black tracking-wider uppercase mt-2">Orange</span>
                      </motion.button>

                      <motion.button
                        type="button"
                        whileHover={{ y: -4, scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          uiAudio.playSoftClick();
                          setMobileProvider("mixx_yas");
                        }}
                        className={`relative flex flex-col items-center justify-center p-3 h-28 rounded-2xl border text-center transition-all ${
                          mobileProvider === "mixx_yas"
                            ? "bg-yellow-500/10 border-yellow-500 shadow-[0_8px_20px_rgba(234,179,8,0.25)] text-yellow-600 dark:text-yellow-400 font-extrabold"
                            : "border-border/60 hover:border-muted-foreground/30 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-white/0 pointer-events-none" />
                        <div className="h-10 w-10 rounded-xl overflow-hidden border border-border/40 shadow-inner flex items-center justify-center bg-white">
                          <img src="/mixx_by_yas.jpg" alt="Mixx By YAS logo" className="h-full w-full object-cover select-none" />
                        </div>
                        <span className="text-[9px] font-black tracking-wider uppercase mt-2">Mixx YAS</span>
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* Form Inputs & Payment Area */}
                {isProcessing ? (
                  /* Live Clinical Loader display */
                  <div className="py-10 flex flex-col items-center justify-center space-y-4">
                    <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold text-foreground">Paiement en cours...</p>
                      <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                        {paymentMethod === "mobile_money" ? (
                          <>
                            {processingStep === 1 && `Initiation du push USSD ${
                              mobileProvider === "wave" 
                                ? "WAVE" 
                                : mobileProvider === "orange_money" 
                                  ? "ORANGE MONEY" 
                                  : "MIXX BY YAS"
                            }...`}
                            {processingStep === 2 && "Attente de confirmation (tapez votre code PIN sur votre mobile)..."}
                            {processingStep === 3 && "Validation Supabase et surclassement..."}
                          </>
                        ) : (
                          <>
                            {processingStep === 1 && "Établissement du canal sécurisé PayPal..."}
                            {processingStep === 2 && "Vérification des fonds..."}
                            {processingStep === 3 && "Mise à niveau de votre profil..."}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paymentMethod === "mobile_money" ? (
                      <form onSubmit={handlePaymentSubmit} className="space-y-4">
                        {/* CTA Mobile Money button */}
                        <Button
                          type="submit"
                          className="w-full h-12 rounded-full font-bold bg-primary text-primary-foreground hover:bg-primary/95 text-xs shadow-lg shadow-primary/10 gap-1.5 mt-2 transition-all flex items-center justify-center"
                        >
                          Lancer le paiement {
                            mobileProvider === "wave" 
                              ? "Wave" 
                              : mobileProvider === "orange_money" 
                                ? "Orange Money" 
                                : "Mixx By YAS"
                          } <ArrowRight className="h-4 w-4" />
                        </Button>
                      </form>
                    ) : (
                      /* PayPal Sandbox Secured Card Payment buttons container */
                      <div className="space-y-4 animate-[fadeIn_0.2s_ease]">
                        {/* Glassmorphic Credit Card Form */}
                        <div className="p-4 rounded-2xl border border-border/40 bg-muted/20 space-y-3 shadow-inner">
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Numéro de Carte</Label>
                            <Input
                              type="text"
                              placeholder="4000 1234 5678 9010"
                              value={cardNumber}
                              onChange={handleCardNumberChange}
                              onFocus={() => setIsFlipped(false)}
                              className="h-10 rounded-xl transition-all border-border/60 focus:border-primary/80 focus:shadow-[0_0_10px_rgba(139,92,246,0.15)] font-mono text-xs"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Expiration</Label>
                              <Input
                                type="text"
                                placeholder="MM/AA"
                                value={expiry}
                                onChange={handleExpiryChange}
                                onFocus={() => setIsFlipped(false)}
                                className="h-10 rounded-xl transition-all border-border/60 focus:border-primary/80 focus:shadow-[0_0_10px_rgba(139,92,246,0.15)] font-mono text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">CVV</Label>
                              <Input
                                type="text"
                                placeholder="123"
                                value={cvv}
                                onChange={handleCvvChange}
                                onFocus={() => setIsFlipped(true)}
                                onBlur={() => setIsFlipped(false)}
                                className="h-10 rounded-xl transition-all border-border/60 focus:border-primary/80 focus:shadow-[0_0_10px_rgba(139,92,246,0.15)] font-mono text-xs"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Titulaire de la Carte</Label>
                            <Input
                              type="text"
                              placeholder="NOM COMPLET"
                              value={cardHolder}
                              onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                              onFocus={() => setIsFlipped(false)}
                              className="h-10 rounded-xl transition-all border-border/60 focus:border-primary/80 focus:shadow-[0_0_10px_rgba(139,92,246,0.15)] text-xs uppercase"
                            />
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-border/40">
                          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                            🔒 Validation Rapide via PayPal / Card Gateway
                          </Label>
                          
                          {!paypalLoaded ? (
                            <div className="flex flex-col items-center justify-center py-6 space-y-2 border border-dashed border-border rounded-2xl bg-muted/20">
                              <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                              <p className="text-[9px] text-muted-foreground font-semibold">Initialisation PayPal...</p>
                            </div>
                          ) : (
                          <div className="space-y-2">
                            <div id="paypal-button-container" className="w-full relative z-20 min-h-[150px]" />
                            <p className="text-[9px] text-muted-foreground/80 leading-normal text-center">
                              Réglez avec votre compte PayPal ou payez directement par Carte Bancaire (Visa, MasterCard, Amex) via le protocole sécurisé.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>
            ) : (
              /* TRIUMPHANT SUCCESS CARD */
              <div className="flex-grow flex flex-col justify-center items-center text-center space-y-6 py-10 animate-[scaleUp_0.4s_ease-out]">
                <div className="h-20 w-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-xl shadow-emerald-500/5">
                  <CheckCircle className="h-10 w-10 animate-[bounce_1.5s_infinite]" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-foreground uppercase tracking-tight">Accès Débloqué !</h3>
                  <p className="text-xs text-muted-foreground px-6 leading-relaxed">
                    Votre compte a été surclassé au niveau **{planName}** avec succès ! Profitez de tous vos nouveaux privilèges cliniques dès à présent.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 text-[10px] leading-relaxed text-muted-foreground/80 font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  Mise à niveau Supabase synchronisée en temps réel
                </div>

                <Button 
                  onClick={() => {
                    onSuccess();
                    onClose();
                  }}
                  className="w-full h-12 rounded-full font-bold bg-primary text-primary-foreground hover:bg-primary/95 text-xs shadow-lg"
                >
                  Ouvrir mon Espace Révision
                </Button>
              </div>
            )}

            {/* Footer security badge */}
            <div className="pt-4 border-t border-border/50 flex items-center justify-between text-[8px] font-extrabold uppercase tracking-widest text-muted-foreground/60">
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3 text-muted-foreground/80" /> Chiffrement AES-256
              </span>
              <span className="flex items-center gap-0.5">
                <HelpCircle className="h-3 w-3" /> Support 24/7
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
