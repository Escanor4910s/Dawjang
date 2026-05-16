import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Mail, Lock, GraduationCap, Eye, EyeOff, User, Building, Hash,
  Brain, FileText, Sparkles, ArrowRight, CheckCircle2, Shield
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

const FeatureItem = ({ icon: Icon, title, desc, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.8, type: "spring" }}
    className="flex items-start gap-4 p-4 rounded-2xl hover:bg-white/5 transition-colors cursor-default"
  >
    <div className="bg-gradient-to-br from-primary/20 to-accent/20 p-3 rounded-xl ring-1 ring-white/10 shadow-inner">
      <Icon className="w-6 h-6 text-primary-glow" />
    </div>
    <div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
    </div>
  </motion.div>
);

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [tab, setTab] = useState<"login" | "signup">("login");
  
  const [formData, setFormData] = useState({ 
    email: "", password: "", confirmPassword: "", 
    studyLevel: "", firstName: "", lastName: "", studentNumber: "", university: ""
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) navigate("/dashboard");
    });
  }, [navigate]);

  const pwdScore = scorePassword(formData.password);
  const pwdColors = ["bg-muted", "bg-rose-500", "bg-amber-500", "bg-emerald-400", "bg-emerald-500"];
  const pwdLabels = ["", "Très faible", "Moyen", "Bon", "Excellent"];

  const handleAuthError = (error: any, isSignup: boolean) => {
    let msg = error.message;
    if (msg.includes("Invalid login")) msg = "Identifiants incorrects.";
    if (msg.includes("Email not confirmed")) msg = "Veuillez confirmer votre adresse email.";
    if (msg.includes("already registered")) msg = "Cet email est déjà utilisé.";
    toast({ title: isSignup ? "Inscription impossible" : "Connexion impossible", description: msg, variant: "destructive" });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
      if (error) throw error;
      toast({ title: "Bienvenue de retour 👋", description: "Connexion réussie." });
      navigate("/dashboard");
    } catch (err) {
      handleAuthError(err, false);
    } finally { setIsLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas.", variant: "destructive" });
    }
    if (formData.password.length < 8) {
      return toast({ title: "Erreur", description: "Le mot de passe doit contenir au moins 8 caractères.", variant: "destructive" });
    }
    if (!formData.studyLevel || !formData.firstName || !formData.lastName || !formData.university) {
      return toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires.", variant: "destructive" });
    }
    
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { 
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { 
            first_name: formData.firstName,
            name: formData.lastName,
            study_level: formData.studyLevel,
            year_of_study: formData.studyLevel,
            student_number: formData.studentNumber,
            university: formData.university
          } 
        },
      });
      if (error) throw error;
      toast({ title: "Compte créé avec succès 🎉", description: "Vérifiez votre boîte mail pour confirmer votre inscription." });
      setTab("login"); // Switch to login view
    } catch (err) {
      handleAuthError(err, true);
    } finally { setIsLoading(false); }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/dashboard` } });
      if (error) throw error;
    } catch {
      toast({ title: "Erreur", description: "Impossible de se connecter avec Google.", variant: "destructive" });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-[1.1fr_1fr] overflow-hidden selection:bg-primary/30">
      {/* ─── LEFT PANE (Visuals) ────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col p-12 lg:p-20 bg-[#0B0F19] relative overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-primary/30 rounded-full blur-[120px]"
          />
          <motion.div 
            animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-600/30 rounded-full blur-[120px]"
          />
        </div>

        {/* Logo */}
        <div className="relative z-10 mb-16">
          <Link to="/" className="inline-block">
            <HippocampusLogo size="xl" variant="white" />
          </Link>
        </div>

        {/* Main Value Prop */}
        <div className="relative z-10 flex-grow flex flex-col justify-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="mb-12">
            <h1 className="text-5xl lg:text-6xl font-serif text-white leading-[1.1] mb-6">
              Mémorisez plus vite,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-glow to-violet-400">réussissez mieux.</span>
            </h1>
            <p className="text-xl text-white/70 font-light leading-relaxed max-w-md">
              La plateforme d'apprentissage intelligente conçue spécifiquement pour les étudiants en médecine.
            </p>
          </motion.div>

          {/* Floating Animated Cards Container */}
          <div className="relative h-[300px] w-full max-w-lg mt-8 perspective-1000">
            {/* Center glowing orb */}
            <motion.div 
              animate={{ opacity: [0.5, 0.8, 0.5], scale: [0.9, 1.1, 0.9] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gradient-to-tr from-primary to-accent rounded-full opacity-40 blur-3xl"
            />

            {/* Card 1 */}
            <motion.div
              initial={{ opacity: 0, x: -50, y: 50 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8, type: "spring" }}
              animate={{ y: [0, -15, 0] }}
              transition={{ y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0 } }}
              className="absolute top-0 left-0 bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-2xl shadow-2xl flex items-center gap-4 w-64 transform -rotate-6 hover:rotate-0 hover:scale-105 hover:bg-white/15 transition-all cursor-default z-20"
            >
              <div className="bg-primary/20 p-3 rounded-xl ring-1 ring-white/20">
                <Brain className="w-6 h-6 text-primary-glow" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Agent MOR</h4>
                <p className="text-white/60 text-xs mt-1">Tuteur IA disponible 24/7</p>
              </div>
            </motion.div>

            {/* Card 2 */}
            <motion.div
              initial={{ opacity: 0, x: 50, y: 50 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8, type: "spring" }}
              animate={{ y: [0, 15, 0] }}
              transition={{ y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 } }}
              className="absolute top-16 right-0 bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-2xl shadow-2xl flex items-center gap-4 w-64 transform rotate-6 hover:rotate-0 hover:scale-105 hover:bg-white/15 transition-all cursor-default z-10"
            >
              <div className="bg-violet-500/20 p-3 rounded-xl ring-1 ring-white/20">
                <FileText className="w-6 h-6 text-violet-300" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">QCMs Infinis</h4>
                <p className="text-white/60 text-xs mt-1">Générés sur-mesure</p>
              </div>
            </motion.div>

            {/* Card 3 */}
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8, type: "spring" }}
              animate={{ y: [0, -10, 0] }}
              transition={{ y: { duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 } }}
              className="absolute bottom-4 left-16 bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-2xl shadow-2xl flex items-center gap-4 w-64 transform hover:scale-105 hover:bg-white/15 transition-all cursor-default z-30"
            >
              <div className="bg-emerald-500/20 p-3 rounded-xl ring-1 ring-white/20">
                <Sparkles className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Répétition Espacée</h4>
                <p className="text-white/60 text-xs mt-1">Mémoire à long terme (SM-2)</p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Testimonial / Trust Badge */}
        <div className="relative z-10 flex items-center gap-4 pt-10 mt-auto">
          <div className="flex -space-x-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`w-10 h-10 rounded-full border-2 border-[#0B0F19] bg-gradient-to-br ${["from-amber-400 to-orange-500", "from-blue-400 to-blue-600", "from-green-400 to-emerald-600", "from-purple-400 to-violet-600"][i-1]} flex items-center justify-center`}>
                <User className="w-5 h-5 text-white/80" />
              </div>
            ))}
          </div>
          <div className="text-sm">
            <div className="flex text-amber-400 mb-0.5">★★★★★</div>
            <span className="text-white/60 font-medium">+5,000 étudiants nous font confiance</span>
          </div>
        </div>
      </div>

      {/* ─── RIGHT PANE (Form) ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-card relative min-h-screen overflow-y-auto">
        <div className="w-full max-w-[440px] relative z-10 py-12">
          
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-10">
            <Link to="/" className="inline-block hover:scale-105 transition-transform duration-300">
              <HippocampusLogo size="xl" />
            </Link>
          </div>

          <AnimatePresence mode="wait">
            {/* RESET PASSWORD FORM */}
            {showResetForm ? (
              <motion.div key="reset" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary">
                    <Shield className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight mb-2">Mot de passe oublié ?</h2>
                  <p className="text-muted-foreground">Entrez votre email pour recevoir un lien de réinitialisation.</p>
                </div>

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setIsLoading(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: `${window.location.origin}/settings` });
                  setIsLoading(false);
                  if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
                  else { toast({ title: "Email envoyé", description: "Vérifiez votre boîte de réception." }); setShowResetForm(false); }
                }} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">Email</Label>
                    <Input type="email" placeholder="nom@universite.fr" className="h-12 bg-muted/50 border-transparent focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20" disabled={isLoading}>
                    {isLoading ? "Envoi..." : "Envoyer le lien"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowResetForm(false)} className="w-full h-12 text-muted-foreground">
                    Retour à la connexion
                  </Button>
                </form>
              </motion.div>
            ) : (
              
              /* LOGIN / SIGNUP FORM */
              <motion.div key="auth" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                
                <div className="mb-10">
                  <h2 className="text-3xl font-bold tracking-tight mb-2 text-foreground">
                    {tab === "login" ? "Bon retour 👋" : "Créer un compte"}
                  </h2>
                  <p className="text-muted-foreground flex items-center gap-2">
                    {tab === "login" ? "Nouveau sur Hippocampus ?" : "Vous avez déjà un compte ?"}
                    <button onClick={() => setTab(tab === "login" ? "signup" : "login")} className="text-primary font-semibold hover:underline decoration-2 underline-offset-4 transition-all">
                      {tab === "login" ? "S'inscrire" : "Se connecter"}
                    </button>
                  </p>
                </div>

                <Button 
                  onClick={handleGoogleAuth} disabled={isLoading} variant="outline" 
                  className="w-full h-12 mb-6 font-semibold border-border bg-background hover:bg-muted/50 transition-all duration-300"
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continuer avec Google
                </Button>

                <div className="relative flex items-center py-2 mb-6">
                  <div className="flex-grow border-t border-border"></div>
                  <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs font-semibold uppercase tracking-wider">Ou avec votre email</span>
                  <div className="flex-grow border-t border-border"></div>
                </div>

                <form onSubmit={tab === "login" ? handleLogin : handleSignup} className="space-y-4">
                  
                  {/* Email & Password (Common) */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="email" placeholder="nom@exemple.com" className="pl-10 h-12 bg-muted/50 border-transparent focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm font-semibold">Mot de passe</Label>
                        {tab === "login" && (
                          <button type="button" onClick={() => setShowResetForm(true)} className="text-xs text-primary font-medium hover:underline">
                            Oublié ?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type={showPassword ? "text" : "password"} placeholder="••••••••" className="pl-10 pr-10 h-12 bg-muted/50 border-transparent focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      
                      {tab === "signup" && formData.password && (
                        <div className="pt-2">
                          <div className="flex gap-1 h-1.5 mb-1.5">
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} className={`flex-1 rounded-full transition-all duration-500 ${i <= pwdScore ? pwdColors[pwdScore] : "bg-border"}`} />
                            ))}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium flex justify-between">
                            <span>Sécurité du mot de passe</span>
                            <span className={pwdScore >= 3 ? "text-emerald-500" : "text-amber-500"}>{pwdLabels[pwdScore]}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Signup Specific Fields */}
                  {tab === "signup" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 pt-2 border-t border-border/50 mt-6">
                      
                      <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Confirmer le mot de passe</Label>
                        <div className="relative">
                          <CheckCircle2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type="password" placeholder="••••••••" className="pl-10 h-12 bg-muted/50 border-transparent focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} required />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold">Prénom</Label>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Jean" className="pl-10 h-12 bg-muted/50 border-transparent focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} required />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold">Nom</Label>
                          <Input placeholder="Dupont" className="h-12 bg-muted/50 border-transparent focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} required />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Université / Faculté</Label>
                        <div className="relative">
                          <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Ex: Sorbonne Université" className="pl-10 h-12 bg-muted/50 border-transparent focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20" value={formData.university} onChange={e => setFormData({...formData, university: e.target.value})} required />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold">Niveau d'études</Label>
                          <Select onValueChange={(v) => setFormData({ ...formData, studyLevel: v })}>
                            <SelectTrigger className="h-12 bg-muted/50 border-transparent focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20">
                              <GraduationCap className="h-4 w-4 text-muted-foreground mr-2" />
                              <SelectValue placeholder="Niveau" />
                            </SelectTrigger>
                            <SelectContent>
                              {studyLevels.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold">N° Étudiant <span className="text-muted-foreground font-normal">(Optionnel)</span></Label>
                          <div className="relative">
                            <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Ex: 221045" className="pl-10 h-12 bg-muted/50 border-transparent focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20" value={formData.studentNumber} onChange={e => setFormData({...formData, studentNumber: e.target.value})} />
                          </div>
                        </div>
                      </div>

                    </motion.div>
                  )}

                  <Button type="submit" className="w-full h-12 mt-4 text-base font-bold bg-primary hover:bg-primary-hover text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:-translate-y-0.5 active:translate-y-0" disabled={isLoading}>
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span className="flex items-center gap-2">
                        {tab === "login" ? "Accéder à l'espace" : "Créer mon espace"}
                        <ArrowRight className="w-5 h-5" />
                      </span>
                    )}
                  </Button>
                  
                  {tab === "signup" && (
                    <p className="text-center text-xs text-muted-foreground mt-4">
                      En créant un compte, vous acceptez nos <Link to="/terms" className="underline hover:text-primary">Conditions d'utilisation</Link> et notre <Link to="/privacy" className="underline hover:text-primary">Politique de confidentialité</Link>.
                    </p>
                  )}
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

