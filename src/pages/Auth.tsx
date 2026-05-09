import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Mail, Lock, GraduationCap, Eye, EyeOff, KeyRound,
  Brain, FileText, Layers, Trophy, ShieldCheck, Zap, Sparkles
} from "lucide-react";
import HippocampusLogo from "@/components/landing/HippocampusLogo";
import { supabase } from "@/integrations/supabase/client";

const studyLevels = [
  { value: "L1", label: "1ère année (L1)" },
  { value: "L2", label: "2ème année (L2)" },
  { value: "L3", label: "3ème année (L3)" },
  { value: "M1", label: "4ème année (M1)" },
  { value: "M2", label: "5ème année (M2)" },
  { value: "M3", label: "6ème année (M3)" },
  { value: "Interne", label: "Interne" },
  { value: "Resident", label: "Résident" },
  { value: "Other", label: "Autre" },
];

function scorePassword(pwd: string) {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return s;
}

const FloatingCard = ({ icon: Icon, title, delay, x, y, rotate }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.8, type: "spring" }}
    className={`absolute ${x} ${y} bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-2xl flex items-center gap-3 w-48`}
    style={{ rotate }}
    whileHover={{ scale: 1.05, rotate: 0, backgroundColor: "rgba(255,255,255,0.2)" }}
  >
    <div className="bg-white/20 p-2 rounded-xl text-white">
      <Icon className="w-5 h-5" />
    </div>
    <span className="text-white font-medium text-sm">{title}</span>
  </motion.div>
);

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [formData, setFormData] = useState({ email: "", password: "", confirmPassword: "", studyLevel: "" });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) navigate("/dashboard");
    });
  }, [navigate]);

  const pwdScore = scorePassword(formData.password);
  const pwdLabel = ["", "Faible", "Correct", "Bon", "Excellent"][pwdScore];
  const pwdColor = ["bg-muted", "bg-red-500", "bg-orange-500", "bg-blue-500", "bg-green-500"][pwdScore];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
      if (error) {
        let msg = error.message;
        if (error.message.includes("Invalid login")) msg = "Email ou mot de passe incorrect.";
        if (error.message.includes("Email not confirmed")) msg = "Email non confirmé. Vérifiez votre boîte de réception.";
        toast({ title: "Connexion impossible", description: msg, variant: "destructive" });
      } else {
        toast({ title: "Bienvenue 👋", description: "Connexion réussie." });
        navigate("/dashboard");
      }
    } finally { setIsLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas.", variant: "destructive" }); return;
    }
    if (formData.password.length < 6) {
      toast({ title: "Erreur", description: "Mot de passe : 6 caractères minimum.", variant: "destructive" }); return;
    }
    if (!formData.studyLevel) {
      toast({ title: "Erreur", description: "Sélectionnez votre niveau d'études.", variant: "destructive" }); return;
    }
    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { emailRedirectTo: redirectUrl, data: { study_level: formData.studyLevel } },
      });
      if (error) {
        let msg = error.message;
        if (error.message.includes("already registered")) msg = "Cet email est déjà utilisé. Connectez-vous.";
        toast({ title: "Inscription impossible", description: msg, variant: "destructive" });
      } else {
        toast({ title: "Compte créé 🎉", description: "Vérifiez votre email pour confirmer." });
        navigate("/dashboard");
      }
    } finally { setIsLoading(false); }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) { toast({ title: "Email requis", variant: "destructive" }); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: `${window.location.origin}/settings` });
      if (error) throw error;
      toast({ title: "Email envoyé ✅", description: "Vérifiez votre boîte de réception." });
      setShowResetForm(false);
    } catch {
      toast({ title: "Erreur", description: "Impossible d'envoyer l'email.", variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) throw error;
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de se connecter avec Google.", variant: "destructive" });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2 overflow-hidden">
      {/* Left Pane - Dark/Primary Theme with Widgets */}
      <div className="hidden lg:flex flex-col justify-center p-12 lg:p-24 bg-gradient-to-br from-section-dark to-section-dark/95 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div 
            animate={{ rotate: 360 }} transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
            className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px]"
          />
          <motion.div 
            animate={{ rotate: -360 }} transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[100px]"
          />
        </div>

        <div className="z-10 relative h-full flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <h2 className="text-5xl lg:text-7xl font-serif text-white leading-[1.1] mb-6">
              Ne tape pas,<br />
              <span className="text-primary-glow font-bold">parle simplement.</span>
            </h2>
            <p className="text-xl text-white/70 max-w-md font-light">
              L'IA médicale qui comprend votre façon de travailler et révolutionne vos révisions.
            </p>
          </motion.div>

          <div className="relative h-[400px] w-full">
            {/* Center mockup / abstract shape */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 1 }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-tr from-primary to-accent rounded-full opacity-20 blur-2xl animate-pulse-glow"
            />
            
            {/* Floating Widgets */}
            <FloatingCard icon={Brain} title="QCMs Générés" delay={0.4} x="left-[5%]" y="top-[10%]" rotate="-10deg" />
            <FloatingCard icon={Sparkles} title="Résumés IA" delay={0.6} x="right-[10%]" y="top-[20%]" rotate="15deg" />
            <FloatingCard icon={Layers} title="Flashcards" delay={0.8} x="left-[15%]" y="bottom-[30%]" rotate="5deg" />
            <FloatingCard icon={Trophy} title="Mode Duel" delay={1} x="right-[5%]" y="bottom-[10%]" rotate="-8deg" />
          </div>
        </div>
      </div>

      {/* Right Pane - Form */}
      <div className="flex flex-col justify-center px-8 sm:px-16 lg:px-24 bg-card min-h-screen relative">
        <div className="w-full max-w-md mx-auto relative z-10">
          <AnimatePresence mode="wait">
            {showResetForm ? (
              <motion.div key="reset" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-12 flex justify-center">
                  <Link to="/" className="hover:scale-105 transition-transform block">
                    <HippocampusLogo size="lg" showText={false} />
                  </Link>
                </div>
                <h1 className="text-4xl font-serif text-foreground mb-3 text-center">Récupération</h1>
                <p className="text-muted-foreground text-sm mb-8 text-center">Un lien magique sera envoyé à votre adresse.</p>
                <form onSubmit={handlePasswordReset} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Adresse email <span className="text-destructive">*</span></Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input type="email" placeholder="nom@exemple.com" className="pl-12 h-14 rounded-2xl border-border bg-background focus:ring-primary focus:border-primary transition-all" 
                        value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-14 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 transition-all hover:translate-y-[-2px]" disabled={isLoading}>
                    {isLoading ? "Envoi en cours..." : "Envoyer le lien"}
                  </Button>
                  <div className="text-center">
                    <button type="button" onClick={() => setShowResetForm(false)} className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors">
                      ← Retour à la connexion
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div key="auth" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                
                <div className="mb-10 flex flex-col items-center justify-center text-center">
                  <Link to="/" className="mb-8 hover:scale-105 transition-transform block">
                    <HippocampusLogo size="lg" showText={false} />
                  </Link>
                  
                  <h1 className="text-2xl font-serif text-foreground mb-2">
                    {tab === "login" ? "Nouveau ici ?" : "Déjà membre ?"}
                  </h1>
                  <button 
                    onClick={() => setTab(tab === "login" ? "signup" : "login")} 
                    className="text-primary font-bold hover:underline text-lg transition-colors"
                  >
                    {tab === "login" ? "Créer un compte" : "Se connecter"}
                  </button>
                </div>

                <Button 
                  onClick={handleGoogleAuth}
                  disabled={isLoading}
                  variant="outline" 
                  className="w-full h-14 rounded-2xl border-border bg-background hover:bg-muted text-foreground font-medium mb-8 flex items-center justify-center gap-3 transition-all hover:shadow-md"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continuer avec Google
                </Button>

                <div className="relative flex items-center py-2 mb-8">
                  <div className="flex-grow border-t border-border"></div>
                  <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs font-medium uppercase tracking-wider">Ou via email</span>
                  <div className="flex-grow border-t border-border"></div>
                </div>

                <form onSubmit={tab === "login" ? handleLogin : handleSignup} className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Adresse email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input 
                        type="email" 
                        placeholder="nom@exemple.com"
                        className="pl-12 h-14 rounded-2xl border-border bg-background focus:ring-primary focus:border-primary transition-all" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-medium text-foreground">Mot de passe</Label>
                      {tab === "login" && (
                        <button type="button" onClick={() => setShowResetForm(true)} className="text-xs text-primary hover:underline font-medium">
                          Oublié ?
                        </button>
                      )}
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input 
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-12 pr-12 h-14 rounded-2xl border-border bg-background focus:ring-primary focus:border-primary transition-all" 
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        required
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {tab === "signup" && formData.password && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-1.5 mt-3">
                        <div className="flex gap-1 h-1.5">
                          {[0, 1, 2, 3].map((i) => (
                            <div key={i} className={`flex-1 rounded-full transition-colors duration-300 ${i < pwdScore ? pwdColor : "bg-muted"}`} />
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground text-right font-medium">{pwdLabel || "—"}</p>
                      </motion.div>
                    )}
                  </div>

                  {tab === "signup" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Confirmer le mot de passe</Label>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input 
                            type="password"
                            placeholder="••••••••"
                            className="pl-12 h-14 rounded-2xl border-border bg-background focus:ring-primary focus:border-primary transition-all" 
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Niveau d'études</Label>
                        <div className="relative group">
                          <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                          <Select onValueChange={(v) => setFormData({ ...formData, studyLevel: v })}>
                            <SelectTrigger className="pl-12 h-14 rounded-2xl border-border bg-background focus:ring-primary focus:border-primary transition-all">
                              <SelectValue placeholder="Sélectionnez..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border">
                              {studyLevels.map((l) => <SelectItem key={l.value} value={l.value} className="rounded-lg">{l.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <Button type="submit" className="w-full h-14 mt-6 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-base shadow-lg shadow-primary/20 transition-all hover:translate-y-[-2px]" disabled={isLoading}>
                    {isLoading ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      tab === "login" ? "Accéder à l'espace" : "Créer mon espace"
                    )}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Auth;

