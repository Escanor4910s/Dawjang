import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Mail, Lock, GraduationCap, Eye, EyeOff, User, Building, Hash,
  Brain, FileText, Sparkles, ArrowRight, CheckCircle2, Shield, Zap, Flame, Infinity as InfinityIcon, Loader2
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

const FloatingTag = ({ text, delay, duration, yRange, xRange, colorClass }: any) => (
  <motion.div
    animate={{ y: yRange, x: xRange, rotate: [-2, 2, -2] }}
    transition={{ duration, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay }}
    className={`absolute hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-xl backdrop-blur-md cursor-default text-xs font-black uppercase tracking-wider ${colorClass}`}
  >
    <Hash className="w-3 h-3" /> {text}
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
      setTab("login");
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
    <div className="min-h-screen bg-[#050505] grid lg:grid-cols-[1.1fr_1fr] overflow-hidden selection:bg-primary/30 font-sans">
      
      {/* ─── LEFT PANE (Cyber-Futuristic Visuals) ───────────────────────── */}
      <div className="hidden lg:flex flex-col p-12 lg:p-20 relative overflow-hidden">
        
        {/* Dynamic Dark Gradient Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0B0F19] to-black" />
        
        {/* Glowing Orbs & Grids */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
          
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3], rotate: [0, 90, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-15%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/30 rounded-full blur-[120px] mix-blend-screen"
          />
          <motion.div 
            animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-[-15%] left-[-15%] w-[500px] h-[500px] bg-primary/40 rounded-full blur-[150px] mix-blend-screen"
          />
        </div>

        {/* Floating Tags */}
        <div className="absolute inset-0 pointer-events-none z-20">
          <FloatingTag text="PACES" delay={0} duration={4} yRange={[20, -20]} xRange={[0, 15]} colorClass="top-[15%] left-[20%] text-indigo-400 bg-indigo-500/10 border-indigo-500/30" />
          <FloatingTag text="Anatomie" delay={1} duration={5} yRange={[-30, 30]} xRange={[-10, 10]} colorClass="top-[30%] right-[15%] text-emerald-400 bg-emerald-500/10 border-emerald-500/30" />
          <FloatingTag text="Flashcards" delay={2} duration={4.5} yRange={[15, -15]} xRange={[20, -10]} colorClass="bottom-[25%] left-[10%] text-amber-400 bg-amber-500/10 border-amber-500/30" />
          <FloatingTag text="ECN" delay={1.5} duration={6} yRange={[-25, 25]} xRange={[-15, 15]} colorClass="bottom-[15%] right-[25%] text-rose-400 bg-rose-500/10 border-rose-500/30" />
        </div>

        {/* Logo */}
        <div className="relative z-30 mb-16">
          <Link to="/" className="inline-block hover:scale-105 transition-transform">
            <HippocampusLogo size="xl" variant="white" />
          </Link>
        </div>

        {/* Main Value Prop */}
        <div className="relative z-30 flex-grow flex flex-col justify-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="mb-12">
            <Badge className="bg-white/10 text-white border-white/20 px-3 py-1 mb-6 text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
              <Zap className="h-3 w-3 mr-1.5 text-primary" /> Nouvelle Ère
            </Badge>
            <h1 className="text-5xl lg:text-7xl font-black text-white leading-[1.1] mb-6 tracking-tight">
              Unlock ta<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-400 to-cyan-400">
                mémoire.
              </span>
            </h1>
            <p className="text-xl text-white/60 font-medium leading-relaxed max-w-md">
              Rejoins l'élite. Apprends 3x plus vite avec l'IA et la répétition espacée.
            </p>
          </motion.div>

          {/* Futuristic Glowing Cards */}
          <div className="relative h-[220px] w-full max-w-lg perspective-1000">
            {/* Card 1 */}
            <motion.div
              initial={{ opacity: 0, x: -50, y: 50, rotateY: 15 }}
              animate={{ opacity: 1, x: 0, y: [0, -15, 0], rotateY: 0 }}
              transition={{ x: { delay: 0.4, type: "spring" }, opacity: { delay: 0.4 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.4 } }}
              className="absolute top-0 left-0 bg-white/5 backdrop-blur-2xl border border-white/10 p-5 rounded-3xl shadow-2xl flex items-center gap-4 w-[280px] hover:bg-white/10 transition-all cursor-default z-20 group"
            >
              <div className="bg-primary/20 p-3.5 rounded-2xl ring-1 ring-primary/30 group-hover:ring-primary/60 transition-all">
                <Brain className="w-6 h-6 text-primary-glow" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm tracking-wide">Tuteur Mor (IA)</h4>
                <p className="text-white/50 text-[11px] mt-0.5 font-semibold uppercase tracking-wider">Dispo H24</p>
              </div>
            </motion.div>

            {/* Card 2 */}
            <motion.div
              initial={{ opacity: 0, x: 50, y: 50, rotateY: -15 }}
              animate={{ opacity: 1, x: 0, y: [0, 15, 0], rotateY: 0 }}
              transition={{ x: { delay: 0.6, type: "spring" }, opacity: { delay: 0.6 }, y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.6 } }}
              className="absolute top-20 right-0 bg-white/5 backdrop-blur-2xl border border-white/10 p-5 rounded-3xl shadow-2xl flex items-center gap-4 w-[280px] hover:bg-white/10 transition-all cursor-default z-10 group"
            >
              <div className="bg-cyan-500/20 p-3.5 rounded-2xl ring-1 ring-cyan-500/30 group-hover:ring-cyan-500/60 transition-all">
                <InfinityIcon className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm tracking-wide">QCM & ECOS</h4>
                <p className="text-white/50 text-[11px] mt-0.5 font-semibold uppercase tracking-wider">Génération Infinie</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      
      {/* ─── RIGHT PANE (Form with Glassmorphism) ──────────────────────── */}
      <div className="flex items-center justify-center p-6 sm:p-12 relative min-h-screen overflow-y-auto">
        
        {/* Subtle background glow for right pane */}
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50 blur-3xl" />
        
        <div className="w-full max-w-[480px] relative z-10 py-12">
          
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-10">
            <Link to="/" className="inline-block hover:scale-105 transition-transform duration-300">
              <HippocampusLogo size="xl" variant="white" />
            </Link>
          </div>

          <AnimatePresence mode="wait">
            
            {/* ─── RESET PASSWORD FORM ─── */}
            {showResetForm ? (
              <motion.div key="reset" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary ring-1 ring-primary/30">
                    <Shield className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight mb-2 text-white">Récupération</h2>
                  <p className="text-white/60 font-medium">Un lien magique sera envoyé par mail.</p>
                </div>

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setIsLoading(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: `${window.location.origin}/settings` });
                  setIsLoading(false);
                  if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
                  else { toast({ title: "Email envoyé", description: "Vérifiez votre boîte de réception." }); setShowResetForm(false); }
                }} className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-white/70">Email</Label>
                    <Input type="email" placeholder="nom@universite.fr" className="h-14 bg-black/40 border-white/10 text-white rounded-2xl focus:bg-black/60 focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full h-14 text-base font-black rounded-2xl shadow-[0_0_20px_rgba(var(--primary),0.3)] bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-white" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Envoyer le lien"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowResetForm(false)} className="w-full h-12 font-bold text-white/50 hover:text-white hover:bg-white/5 rounded-2xl">
                    Annuler
                  </Button>
                </form>
              </motion.div>
            ) : (
              
              /* ─── LOGIN / SIGNUP FORM ─── */
              <motion.div key="auth" initial="hidden" animate="visible" exit="hidden" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }} className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl relative">
                
                {/* Decorative glowing edge top */}
                <div className="absolute top-0 inset-x-10 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="mb-10 text-center">
                  <h2 className="text-3xl font-black tracking-tight mb-2 text-white">
                    {tab === "login" ? "Connexion" : "Inscription"}
                  </h2>
                  <div className="flex items-center justify-center gap-3 text-white/60 font-medium bg-black/40 w-max mx-auto p-1.5 rounded-full border border-white/5">
                    <button onClick={() => setTab("login")} className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${tab === "login" ? "bg-white/10 text-white shadow-lg" : "hover:text-white"}`}>
                      Se Connecter
                    </button>
                    <button onClick={() => setTab("signup")} className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${tab === "signup" ? "bg-white/10 text-white shadow-lg" : "hover:text-white"}`}>
                      Créer un compte
                    </button>
                  </div>
                </motion.div>

                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                  <Button 
                    onClick={handleGoogleAuth} disabled={isLoading} variant="outline" 
                    className="w-full h-14 rounded-2xl mb-6 font-bold border-white/10 bg-black/40 text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                  >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continuer avec Google
                  </Button>
                </motion.div>

                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="relative flex items-center py-2 mb-6 opacity-50">
                  <div className="flex-grow border-t border-white/20"></div>
                  <span className="flex-shrink-0 mx-4 text-white text-[10px] font-black uppercase tracking-widest">Ou email classique</span>
                  <div className="flex-grow border-t border-white/20"></div>
                </motion.div>

                <form onSubmit={tab === "login" ? handleLogin : handleSignup} className="space-y-4">
                  
                  {/* Email & Password */}
                  <div className="space-y-4">
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-white/70 ml-1">Email</Label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 group-focus-within:text-primary transition-colors" />
                        <Input type="email" placeholder="nom@exemple.com" className="pl-12 h-14 bg-black/40 border-white/10 text-white rounded-2xl hover:border-white/20 focus:bg-black/60 focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium shadow-inner" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                      </div>
                    </motion.div>
                    
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <Label className="text-xs font-bold uppercase tracking-widest text-white/70">Mot de passe</Label>
                        {tab === "login" && (
                          <button type="button" onClick={() => setShowResetForm(true)} className="text-[11px] text-primary font-bold hover:underline tracking-wider uppercase">
                            Oublié ?
                          </button>
                        )}
                      </div>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 group-focus-within:text-primary transition-colors" />
                        <Input type={showPassword ? "text" : "password"} placeholder="••••••••" className="pl-12 pr-12 h-14 bg-black/40 border-white/10 text-white rounded-2xl hover:border-white/20 focus:bg-black/60 focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium shadow-inner tracking-[0.2em]" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      
                      {tab === "signup" && formData.password && (
                        <div className="pt-2 px-1">
                          <div className="flex gap-1 h-1.5 mb-2">
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} className={`flex-1 rounded-full transition-all duration-500 ${i <= pwdScore ? pwdColors[pwdScore] : "bg-white/10"}`} />
                            ))}
                          </div>
                          <p className="text-[10px] uppercase font-bold tracking-wider flex justify-between">
                            <span className="text-white/50">Sécurité</span>
                            <span className={pwdScore >= 3 ? "text-emerald-400" : "text-amber-400"}>{pwdLabels[pwdScore]}</span>
                          </p>
                        </div>
                      )}
                    </motion.div>
                  </div>

                  {/* Signup Details */}
                  {tab === "signup" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 pt-4 mt-2">
                      
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-white/70 ml-1">Confirmation</Label>
                        <div className="relative group">
                          <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 group-focus-within:text-primary transition-colors" />
                          <Input type="password" placeholder="••••••••" className="pl-12 h-14 bg-black/40 border-white/10 text-white rounded-2xl hover:border-white/20 focus:bg-black/60 focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium tracking-[0.2em]" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} required />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-white/70 ml-1">Prénom</Label>
                          <div className="relative group">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-primary transition-colors" />
                            <Input placeholder="Jean" className="pl-9 h-12 bg-black/40 border-white/10 text-white rounded-xl focus:border-primary focus:ring-1 focus:ring-primary transition-all" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} required />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-white/70 ml-1">Nom</Label>
                          <Input placeholder="Dupont" className="h-12 bg-black/40 border-white/10 text-white rounded-xl px-4 focus:border-primary focus:ring-1 focus:ring-primary transition-all" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} required />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-white/70 ml-1">Faculté</Label>
                        <div className="relative group">
                          <Building className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-primary transition-colors" />
                          <Input placeholder="Ex: Sorbonne Université" className="pl-11 h-12 bg-black/40 border-white/10 text-white rounded-xl focus:border-primary focus:ring-1 focus:ring-primary transition-all" value={formData.university} onChange={e => setFormData({...formData, university: e.target.value})} required />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-white/70 ml-1">Niveau</Label>
                          <Select onValueChange={(v) => setFormData({ ...formData, studyLevel: v })}>
                            <SelectTrigger className="h-12 bg-black/40 border-white/10 text-white rounded-xl focus:border-primary focus:ring-1 focus:ring-primary">
                              <GraduationCap className="h-4 w-4 text-white/40 mr-2" />
                              <SelectValue placeholder="Niveau" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl">
                              {studyLevels.map((l) => <SelectItem key={l.value} value={l.value} className="focus:bg-white/10 focus:text-white cursor-pointer">{l.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-white/70 ml-1">N° Étudiant</Label>
                          <div className="relative group">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-primary transition-colors" />
                            <Input placeholder="Facultatif" className="pl-9 h-12 bg-black/40 border-white/10 text-white rounded-xl focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm" value={formData.studentNumber} onChange={e => setFormData({...formData, studentNumber: e.target.value})} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <Button type="submit" className="w-full h-14 mt-6 text-base font-black uppercase tracking-wider rounded-2xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-white shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] hover:-translate-y-1 group" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-white" />
                      ) : (
                        <span className="flex items-center justify-center gap-2 relative z-10">
                          {tab === "login" ? "Entrer" : "Rejoindre l'élite"}
                          <Flame className="w-5 h-5 text-amber-400 group-hover:scale-125 transition-transform duration-300" />
                        </span>
                      )}
                    </Button>
                  </motion.div>
                  
                  {tab === "signup" && (
                    <motion.p variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} className="text-center text-[10px] font-bold text-white/40 uppercase tracking-widest mt-6">
                      En continuant, tu acceptes nos <Link to="/terms" className="text-primary hover:underline">Conditions</Link> et <Link to="/privacy" className="text-primary hover:underline">Confidentialité</Link>.
                    </motion.p>
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
