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
  Shield, Loader2, BookOpen
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
  const pwdColors = ["bg-[#E5E5E5]", "bg-rose-500", "bg-amber-500", "bg-emerald-400", "bg-[#0F3B2E]"];
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
      toast({ title: "Bienvenue de retour", description: "Connexion réussie." });
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
      toast({ title: "Compte créé", description: "Vérifiez votre boîte mail pour confirmer votre inscription." });
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
    <div className="min-h-screen bg-[#FDFBF7] grid lg:grid-cols-2 selection:bg-[#0F3B2E]/20 text-[#1A1A1A] font-sans">
      
      {/* ─── LEFT PANE (Editorial Visuals) ───────────────────────── */}
      <div className="hidden lg:flex flex-col p-12 lg:p-20 relative bg-[#0F3B2E] text-[#FDFBF7]">
        
        {/* Subtle noise texture */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />

        {/* Logo */}
        <div className="relative z-30 mb-auto">
          <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
            <HippocampusLogo size="xl" variant="white" />
          </Link>
        </div>

        {/* Main Value Prop */}
        <div className="relative z-30 mb-auto mt-20">
          <h1 className="text-5xl lg:text-[4rem] font-serif leading-[1.1] mb-8 tracking-tight text-[#FDFBF7]">
            Révisez moins,<br />
            <span className="italic text-[#D4C3A3] font-light">retenez plus.</span>
          </h1>
          <p className="text-lg lg:text-xl text-[#FDFBF7]/80 font-light leading-relaxed max-w-md">
            L'outil de formation médicale le plus avancé. Des fiches, des QCM intelligents et un tuteur IA conçus pour l'excellence académique.
          </p>
        </div>

        <div className="relative z-30 flex items-center gap-4 text-sm font-medium tracking-wide text-[#FDFBF7]/60">
          <BookOpen className="w-5 h-5 opacity-80" />
          Rejoignez l'élite des étudiants en médecine.
        </div>
      </div>
      
      {/* ─── RIGHT PANE (Form) ──────────────────────── */}
      <div className="flex items-center justify-center p-6 sm:p-12 relative min-h-screen overflow-y-auto">
        <div className="w-full max-w-[420px] relative z-10 py-12">
          
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-10">
            <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
              <HippocampusLogo size="xl" />
            </Link>
          </div>

          <AnimatePresence mode="wait">
            
            {/* ─── RESET PASSWORD FORM ─── */}
            {showResetForm ? (
              <motion.div key="reset" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white rounded-3xl p-8 shadow-sm border border-[#E5E5E5]">
                <div className="mb-8">
                  <div className="w-12 h-12 bg-[#FDFBF7] rounded-full flex items-center justify-center mb-6 text-[#0F3B2E] border border-[#E5E5E5]">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-serif text-[#1A1A1A] mb-2">Réinitialisation</h2>
                  <p className="text-[#1A1A1A]/60 text-sm">Nous vous enverrons un lien sécurisé par email.</p>
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
                    <Label className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/70">Adresse e-mail</Label>
                    <Input type="email" placeholder="nom@universite.fr" className="h-12 bg-[#FDFBF7] border-[#E5E5E5] text-[#1A1A1A] rounded-xl focus:bg-white focus:border-[#0F3B2E] focus:ring-1 focus:ring-[#0F3B2E] transition-all font-medium" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full h-12 text-sm font-semibold rounded-xl bg-[#0F3B2E] hover:bg-[#0F3B2E]/90 text-white" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Envoyer le lien"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowResetForm(false)} className="w-full h-12 text-sm font-medium text-[#1A1A1A]/60 hover:text-[#1A1A1A] hover:bg-[#FDFBF7] rounded-xl">
                    Retour
                  </Button>
                </form>
              </motion.div>
            ) : (
              
              /* ─── LOGIN / SIGNUP FORM ─── */
              <motion.div key="auth" initial="hidden" animate="visible" exit="hidden" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }} className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-[#E5E5E5]">
                
                <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} className="mb-8">
                  <h2 className="text-3xl font-serif text-[#1A1A1A] mb-6">
                    {tab === "login" ? "Connexion" : "Inscription"}
                  </h2>
                  <div className="flex items-center gap-1 bg-[#FDFBF7] p-1 rounded-xl border border-[#E5E5E5] w-full">
                    <button onClick={() => setTab("login")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === "login" ? "bg-white text-[#1A1A1A] shadow-sm border border-[#E5E5E5]" : "text-[#1A1A1A]/60 hover:text-[#1A1A1A]"}`}>
                      Se Connecter
                    </button>
                    <button onClick={() => setTab("signup")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === "signup" ? "bg-white text-[#1A1A1A] shadow-sm border border-[#E5E5E5]" : "text-[#1A1A1A]/60 hover:text-[#1A1A1A]"}`}>
                      Créer un compte
                    </button>
                  </div>
                </motion.div>

                <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                  <Button 
                    onClick={handleGoogleAuth} disabled={isLoading} variant="outline" 
                    className="w-full h-12 rounded-xl mb-6 font-medium border-[#E5E5E5] bg-white text-[#1A1A1A] hover:bg-[#FDFBF7] transition-all"
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

                <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} className="relative flex items-center py-2 mb-6">
                  <div className="flex-grow border-t border-[#E5E5E5]"></div>
                  <span className="flex-shrink-0 mx-4 text-[#1A1A1A]/40 text-xs font-semibold uppercase tracking-wider">Ou avec l'email</span>
                  <div className="flex-grow border-t border-[#E5E5E5]"></div>
                </motion.div>

                <form onSubmit={tab === "login" ? handleLogin : handleSignup} className="space-y-4">
                  
                  {/* Email & Password */}
                  <div className="space-y-4">
                    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/70 ml-1">Adresse e-mail</Label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1A1A1A]/40 group-focus-within:text-[#0F3B2E] transition-colors" />
                        <Input type="email" placeholder="nom@exemple.com" className="pl-11 h-12 bg-[#FDFBF7] border-[#E5E5E5] text-[#1A1A1A] rounded-xl hover:border-[#1A1A1A]/20 focus:bg-white focus:border-[#0F3B2E] focus:ring-1 focus:ring-[#0F3B2E] transition-all font-medium" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                      </div>
                    </motion.div>
                    
                    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/70">Mot de passe</Label>
                        {tab === "login" && (
                          <button type="button" onClick={() => setShowResetForm(true)} className="text-xs text-[#0F3B2E] font-semibold hover:underline">
                            Mot de passe oublié ?
                          </button>
                        )}
                      </div>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1A1A1A]/40 group-focus-within:text-[#0F3B2E] transition-colors" />
                        <Input type={showPassword ? "text" : "password"} placeholder="••••••••" className="pl-11 pr-11 h-12 bg-[#FDFBF7] border-[#E5E5E5] text-[#1A1A1A] rounded-xl hover:border-[#1A1A1A]/20 focus:bg-white focus:border-[#0F3B2E] focus:ring-1 focus:ring-[#0F3B2E] transition-all font-medium" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      
                      {tab === "signup" && formData.password && (
                        <div className="pt-2 px-1">
                          <div className="flex gap-1 h-1 mb-2">
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} className={`flex-1 rounded-full transition-all duration-500 ${i <= pwdScore ? pwdColors[pwdScore] : "bg-[#E5E5E5]"}`} />
                            ))}
                          </div>
                          <p className="text-[10px] uppercase font-bold tracking-wider flex justify-between">
                            <span className="text-[#1A1A1A]/40">Sécurité</span>
                            <span className={pwdScore >= 3 ? "text-emerald-600" : "text-amber-600"}>{pwdLabels[pwdScore]}</span>
                          </p>
                        </div>
                      )}
                    </motion.div>
                  </div>

                  {/* Signup Details */}
                  {tab === "signup" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 pt-2">
                      
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/70 ml-1">Confirmation du mot de passe</Label>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1A1A1A]/40 group-focus-within:text-[#0F3B2E] transition-colors" />
                          <Input type="password" placeholder="••••••••" className="pl-11 h-12 bg-[#FDFBF7] border-[#E5E5E5] text-[#1A1A1A] rounded-xl hover:border-[#1A1A1A]/20 focus:bg-white focus:border-[#0F3B2E] focus:ring-1 focus:ring-[#0F3B2E] transition-all font-medium" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} required />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/70 ml-1">Prénom</Label>
                          <div className="relative group">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1A1A1A]/40 group-focus-within:text-[#0F3B2E] transition-colors" />
                            <Input placeholder="Jean" className="pl-9 h-12 bg-[#FDFBF7] border-[#E5E5E5] text-[#1A1A1A] rounded-xl focus:border-[#0F3B2E] focus:ring-1 focus:ring-[#0F3B2E] transition-all" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} required />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/70 ml-1">Nom</Label>
                          <Input placeholder="Dupont" className="h-12 bg-[#FDFBF7] border-[#E5E5E5] text-[#1A1A1A] rounded-xl px-4 focus:border-[#0F3B2E] focus:ring-1 focus:ring-[#0F3B2E] transition-all" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} required />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/70 ml-1">Faculté</Label>
                        <div className="relative group">
                          <Building className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1A1A1A]/40 group-focus-within:text-[#0F3B2E] transition-colors" />
                          <Input placeholder="Ex: Sorbonne Université" className="pl-11 h-12 bg-[#FDFBF7] border-[#E5E5E5] text-[#1A1A1A] rounded-xl focus:border-[#0F3B2E] focus:ring-1 focus:ring-[#0F3B2E] transition-all" value={formData.university} onChange={e => setFormData({...formData, university: e.target.value})} required />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/70 ml-1">Niveau d'études</Label>
                          <Select onValueChange={(v) => setFormData({ ...formData, studyLevel: v })}>
                            <SelectTrigger className="h-12 bg-[#FDFBF7] border-[#E5E5E5] text-[#1A1A1A] rounded-xl focus:border-[#0F3B2E] focus:ring-1 focus:ring-[#0F3B2E]">
                              <GraduationCap className="h-4 w-4 text-[#1A1A1A]/40 mr-2" />
                              <SelectValue placeholder="Niveau" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-[#E5E5E5] text-[#1A1A1A] rounded-xl">
                              {studyLevels.map((l) => <SelectItem key={l.value} value={l.value} className="focus:bg-[#FDFBF7] cursor-pointer">{l.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/70 ml-1">N° Étudiant</Label>
                          <div className="relative group">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1A1A1A]/40 group-focus-within:text-[#0F3B2E] transition-colors" />
                            <Input placeholder="Facultatif" className="pl-9 h-12 bg-[#FDFBF7] border-[#E5E5E5] text-[#1A1A1A] rounded-xl focus:border-[#0F3B2E] focus:ring-1 focus:ring-[#0F3B2E] transition-all" value={formData.studentNumber} onChange={e => setFormData({...formData, studentNumber: e.target.value})} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                    <Button type="submit" className="w-full h-12 mt-4 text-sm font-semibold rounded-xl bg-[#0F3B2E] hover:bg-[#0F3B2E]/90 text-white transition-all duration-300" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-white" />
                      ) : (
                        <span>{tab === "login" ? "Accéder à l'espace" : "Finaliser l'inscription"}</span>
                      )}
                    </Button>
                  </motion.div>
                  
                  {tab === "signup" && (
                    <motion.p variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} className="text-center text-xs text-[#1A1A1A]/40 mt-4">
                      En continuant, vous acceptez nos <Link to="/terms" className="text-[#0F3B2E] hover:underline">Conditions</Link> et <Link to="/privacy" className="text-[#0F3B2E] hover:underline">Confidentialité</Link>.
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
