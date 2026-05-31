import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Mail, Lock, GraduationCap, Eye, EyeOff, User, Building, Hash,
  ArrowLeft, Loader2, ShieldCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import HippocampusLogo from "@/components/landing/HippocampusLogo"; // <-- Ton vrai logo intégré

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

// ─── COMPOSANTS GRAPHIQUES (Les "Tags" & Gribouillis) ───
const DrawnArrow = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <motion.path d="M10 90 Q 40 10 90 10 M 70 10 L 90 10 L 90 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" 
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, ease: "easeOut", delay: 0.8 }}
    />
  </svg>
);

const HighlightCircle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <motion.path d="M 50 10 C 80 10 90 40 90 50 C 90 80 40 90 30 80 C 10 60 20 10 50 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.5, ease: "easeInOut", delay: 0.4 }}
    />
  </svg>
);

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  
  const [formData, setFormData] = useState({ 
    email: "", password: "", confirmPassword: "", 
    studyLevel: "", firstName: "", lastName: "", studentNumber: "", university: ""
  });
  
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) navigate("/dashboard");
    });
  }, [navigate]);

  const pwdScore = scorePassword(formData.password);
  const pwdColors = ["bg-black/5", "bg-rose-500", "bg-amber-500", "bg-emerald-400", "bg-[#5B21B6]"];
  const pwdLabels = ["", "Vulnérable", "Moyen", "Solide", "Inviolable"];

  const handleAuthError = (error: any, isSignup: boolean) => {
    let msg = error.message;
    if (msg.includes("Invalid login")) msg = "Identifiants incorrects.";
    if (msg.includes("Email not confirmed")) msg = "Veuillez confirmer votre adresse email.";
    if (msg.includes("already registered")) msg = "Ce dossier est déjà enregistré.";
    toast.error(isSignup ? "Inscription impossible" : "Connexion refusée", { description: msg });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
      if (error) throw error;
      toast.success("Authentification réussie", { description: "Bienvenue dans Hippocampus." });
      navigate("/dashboard");
    } catch (err) { handleAuthError(err, false); } 
    finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) return toast.error("Anomalie", { description: "Les mots de passe diffèrent." });
    if (formData.password.length < 8) return toast.error("Sécurité", { description: "8 caractères minimum requis." });
    if (!formData.studyLevel || !formData.firstName || !formData.lastName || !formData.university) return toast.error("Dossier incomplet", { description: "Remplissez les champs obligatoires." });
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email, password: formData.password,
        options: { 
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { first_name: formData.firstName, name: formData.lastName, study_level: formData.studyLevel, year_of_study: formData.studyLevel, student_number: formData.studentNumber, university: formData.university } 
        },
      });
      if (error) throw error;
      toast.success("Dossier créé", { description: "Un email de confirmation vous a été envoyé." });
      setIsLogin(true);
    } catch (err) { handleAuthError(err, true); } 
    finally { setLoading(false); }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/dashboard` } });
      if (error) throw error;
    } catch { toast.error("Erreur système", { description: "Échec de la connexion Google." }); setLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: `${window.location.origin}/settings` });
    setLoading(false);
    if (error) toast.error("Erreur", { description: error.message });
    else { toast.success("Lien expédié", { description: "Consultez votre messagerie." }); setShowResetForm(false); }
  };

  // --- DESIGN SYSTEM : Inputs ---
  const inputWrapper = "relative group flex items-center";
  const inputClasses = "w-full h-14 pl-12 pr-4 rounded-[1rem] border-2 border-transparent bg-black/[0.03] text-[#111111] font-medium shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] focus:bg-white focus:border-[#5B21B6]/30 focus:shadow-[0_0_0_4px_rgba(91,33,182,0.1)] hover:bg-black/[0.05] transition-all duration-300 outline-none placeholder:text-[#888888]/60";
  const iconClasses = "absolute left-4 w-5 h-5 text-[#888888]/50 group-focus-within:text-[#5B21B6] group-hover:text-[#888888] transition-colors duration-300 z-10 pointer-events-none";

  return (
    <div className="min-h-screen w-full flex items-center justify-center font-sans selection:bg-[#5B21B6]/20 relative overflow-hidden p-4 sm:p-6 bg-mosaic-wave">
      
      {/* ==============================================================
          MOTEUR D'ANIMATION CSS (Niveau 70/70)
          ============================================================== */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes gradient-wave {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .bg-mosaic-wave {
          background: linear-gradient(-45deg, #020617, #1e3a8a, #5b21b6, #be185d, #020617);
          background-size: 400% 400%;
          animation: gradient-wave 20s ease infinite;
        }
        @keyframes border-spin {
          100% { transform: rotate(360deg); }
        }
        .animate-border-spin {
          background: conic-gradient(from 0deg at 50% 50%, #3b82f6 0%, #ec4899 33%, #5b21b6 66%, #3b82f6 100%);
          animation: border-spin 4s linear infinite;
        }
      `}} />

      {/* ==============================================================
          LES "TAGS" & LE CANVAS (Intégrés dans l'animation)
          ============================================================== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.15] mix-blend-overlay" />
        
        <motion.div initial={{ opacity: 0, rotate: -15 }} animate={{ opacity: 0.3, rotate: -10 }} transition={{ delay: 0.3 }} className="absolute top-[15%] left-[8%] text-4xl font-serif italic font-bold text-white mix-blend-overlay select-none">
          Focus.
          <HighlightCircle className="absolute -inset-4 text-white w-[150%] h-[150%]" />
        </motion.div>
        
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 0.2, x: 0 }} transition={{ delay: 0.6 }} className="absolute bottom-[20%] right-[8%] text-2xl font-black uppercase tracking-[0.4em] text-white mix-blend-overlay select-none transform rotate-90 origin-bottom-right">
          #ECNi_2026
        </motion.div>

        <DrawnArrow className="absolute top-[25%] right-[18%] w-32 h-32 text-white opacity-20 mix-blend-overlay -rotate-45" />
      </div>

      {/* Bouton Retour (Glassmorphism) */}
      <Link to="/" className="absolute top-8 left-8 text-white/70 hover:text-white transition-colors flex items-center gap-2 text-xs font-black uppercase tracking-widest z-50 group bg-black/20 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 shadow-lg">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Retour
      </Link>

      {/* ==============================================================
          LE MONOLITHE 70/70 (Bordure Animée + Ombre Abyssale)
          ============================================================== */}
      <motion.div 
        initial={{ opacity: 0, y: 40, scale: 0.95 }} 
        animate={{ opacity: 1, y: 0, scale: 1 }} 
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        // La zone d'ombre abyssale qui sépare le background de la carte
        className="relative w-full max-w-[1050px] z-20 rounded-[3rem] p-[1.5px] shadow-[0_0_100px_rgba(0,0,0,0.8)] group"
      >
        {/* LA FINE BORDURE MULTICOLORE CHANGEANTE */}
        <div className="absolute inset-0 rounded-[3rem] animate-border-spin opacity-80 group-hover:opacity-100 transition-opacity duration-700" />
        
        {/* Le Contenu de la Carte (Masque la bordure sauf sur les bords 1.5px) */}
        <div className="relative h-full w-full bg-[#FAFAF8] rounded-[calc(3rem-1.5px)] flex flex-col md:flex-row overflow-hidden">
          
          {/* --- PARTIE GAUCHE (Éditorial & Logo Hippocampus) --- */}
          <div className="hidden md:flex w-[45%] bg-[#050505] text-white p-14 flex-col justify-between relative overflow-hidden">
            {/* Texture interne */}
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none" />
            <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-[#5B21B6] blur-[130px] rounded-full opacity-40 pointer-events-none" />
            
            <div className="relative z-10 flex items-center gap-3">
               {/* INTÉGRATION DE TON VRAI LOGO ICI */}
               <HippocampusLogo variant="white" size="md" showText={true} />
            </div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 mb-8 backdrop-blur-md">
                <ShieldCheck className="w-3 h-3 text-[#5B21B6] text-violet-400" />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">Portail Sécurisé</span>
              </div>
              <h2 className="text-4xl xl:text-5xl font-serif leading-[1.1] mb-6 tracking-tight text-white">
                Façonnez <br/>
                <span className="italic text-[#3B82F6] font-medium">l'avenir</span> <br/>
                de la médecine.
              </h2>
              <p className="text-white/50 text-sm font-medium leading-relaxed max-w-[280px]">
                Rejoignez l'élite des étudiants qui redéfinissent l'apprentissage par la rigueur de l'intelligence artificielle.
              </p>
            </div>
            
            <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-8 mt-12">
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">
                © {new Date().getFullYear()} Hippocampus Inc.
              </p>
            </div>
          </div>

          {/* --- PARTIE DROITE (Le Formulaire Interactif) --- */}
          <div className="w-full md:w-[55%] p-8 sm:p-12 lg:p-14 flex flex-col justify-center bg-[#FAFAF8] relative z-10">
            
            <AnimatePresence mode="wait">
              {/* ─── RÉINITIALISATION ─── */}
              {showResetForm ? (
                <motion.div key="reset" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full">
                  <div className="mb-10 text-center lg:text-left">
                    <h1 className="text-4xl font-serif font-black text-[#111111] tracking-tight mb-3">Récupération.</h1>
                    <p className="text-[#888888] font-medium text-sm">Un protocole sécurisé vous sera transmis.</p>
                  </div>
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className={inputWrapper}>
                      <Mail className={iconClasses} />
                      <Input type="email" placeholder="nom@universite.fr" className={inputClasses} value={resetEmail} onChange={e => setResetEmail(e.target.value)} required />
                    </div>
                    <Button disabled={loading} className="w-full h-14 rounded-[1rem] bg-[#111111] hover:bg-[#5B21B6] text-white font-black uppercase tracking-[0.15em] text-xs shadow-[0_10px_20px_-10px_rgba(0,0,0,0.3)] hover:shadow-[0_15px_30px_-10px_rgba(91,33,182,0.4)] transition-all duration-300 hover:-translate-y-1">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Expédier le lien"}
                    </Button>
                    <button type="button" onClick={() => setShowResetForm(false)} className="w-full mt-6 text-xs font-bold text-[#888888] hover:text-[#111111] transition-colors uppercase tracking-widest">
                      Annuler
                    </button>
                  </form>
                </motion.div>
              ) : (
                
              /* ─── CONNEXION / INSCRIPTION ─── */
                <motion.div key="auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full">
                  <div className="mb-8 text-center lg:text-left">
                    <h1 className="text-3xl sm:text-4xl font-serif font-black text-[#111111] tracking-tight mb-2">
                      {isLogin ? "Bon retour." : "Nouveau dossier."}
                    </h1>
                    <p className="text-[#888888] font-medium text-sm">
                      {isLogin ? "Accédez à votre base de connaissances." : "Rejoignez l'institut en quelques secondes."}
                    </p>
                  </div>

                  {/* BOUTON GOOGLE (Glassmorphism Actif) */}
                  <Button 
                    onClick={handleGoogleAuth} disabled={loading} variant="outline" 
                    className="w-full h-14 rounded-[1rem] mb-8 font-bold border border-black/10 bg-white text-[#111111] hover:bg-[#F4F4F2] shadow-[0_4px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 text-sm"
                  >
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continuer avec Google
                  </Button>

                  <div className="relative flex items-center mb-8">
                    <div className="flex-grow border-t border-black/5"></div>
                    <span className="mx-4 text-[#888888]/50 text-[10px] font-black uppercase tracking-[0.2em]">Ou par email</span>
                    <div className="flex-grow border-t border-black/5"></div>
                  </div>

                  <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
                    
                    {/* CHAMPS D'INSCRIPTION DYNAMIQUES */}
                    <AnimatePresence>
                      {!isLogin && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden pb-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div className={inputWrapper}>
                              <User className={iconClasses} />
                              <Input placeholder="Prénom" className={inputClasses} value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} required={!isLogin} />
                            </div>
                            <Input placeholder="Nom" className={`${inputClasses} !pl-5`} value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} required={!isLogin} />
                          </div>
                          
                          <div className={inputWrapper}>
                            <Building className={iconClasses} />
                            <Input placeholder="Faculté (ex: Sorbonne)" className={inputClasses} value={formData.university} onChange={e => setFormData({...formData, university: e.target.value})} required={!isLogin} />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className={inputWrapper}>
                              <Select onValueChange={(v) => setFormData({ ...formData, studyLevel: v })} required={!isLogin}>
                                <SelectTrigger className={`w-full h-14 pl-12 pr-4 rounded-[1rem] border-2 border-transparent bg-black/[0.03] text-[#111111] font-medium shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] focus:bg-white focus:border-[#5B21B6]/30 focus:ring-4 focus:ring-[#5B21B6]/5 transition-all duration-300 outline-none`}>
                                  <GraduationCap className={iconClasses} />
                                  <SelectValue placeholder="Niveau" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-black/5 rounded-xl shadow-xl">
                                  {studyLevels.map((l) => <SelectItem key={l.value} value={l.value} className="font-medium cursor-pointer">{l.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className={inputWrapper}>
                              <Hash className={iconClasses} />
                              <Input placeholder="N° Étudiant" className={inputClasses} value={formData.studentNumber} onChange={e => setFormData({...formData, studentNumber: e.target.value})} />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* IDENTIFIANTS GLOBAUX */}
                    <div className={inputWrapper}>
                      <Mail className={iconClasses} />
                      <Input type="email" placeholder="adresse@institution.fr" className={inputClasses} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                    </div>
                    
                    <div className="space-y-2">
                      <div className={inputWrapper}>
                        <Lock className={iconClasses} />
                        <Input type={showPassword ? "text" : "password"} placeholder="Clé de sécurité" className={inputClasses} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 text-[#888888]/50 hover:text-[#111111] transition-colors outline-none z-10">
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {isLogin && (
                        <div className="flex justify-end pt-1">
                          <button type="button" onClick={() => setShowResetForm(true)} className="text-[10px] font-bold uppercase tracking-widest text-[#888888] hover:text-[#5B21B6] transition-colors">
                            Clé oubliée ?
                          </button>
                        </div>
                      )}
                    </div>

                    {/* MOT DE PASSE CONFIRMATION (Moniteur ECG) */}
                    <AnimatePresence>
                      {!isLogin && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 pt-2 overflow-hidden">
                          <div className={inputWrapper}>
                            <Lock className={iconClasses} />
                            <Input type="password" placeholder="Confirmer la clé" className={inputClasses} value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} required={!isLogin} />
                          </div>
                          
                          {formData.password && (
                            <div className="px-1 py-2">
                              <div className="flex gap-1.5 h-1.5 mb-2">
                                {[1, 2, 3, 4].map((i) => (
                                  <motion.div 
                                    key={i} 
                                    initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, delay: i * 0.1 }}
                                    className={`flex-1 rounded-full origin-left transition-colors duration-500 ${i <= pwdScore ? pwdColors[pwdScore] : "bg-black/5"}`} 
                                  />
                                ))}
                              </div>
                              <p className="text-[9px] uppercase font-black tracking-[0.2em] flex justify-between">
                                <span className="text-[#888888]">Vitalité du code</span>
                                <span className={pwdScore >= 3 ? "text-emerald-500" : "text-amber-500"}>{pwdLabels[pwdScore]}</span>
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* BOUTON DE SOUMISSION */}
                    <Button disabled={loading} className="w-full h-14 mt-6 rounded-[1rem] bg-[#111111] hover:bg-[#5B21B6] text-white font-black uppercase tracking-[0.15em] text-xs shadow-[0_10px_20px_-10px_rgba(0,0,0,0.3)] hover:shadow-[0_15px_30px_-10px_rgba(91,33,182,0.4)] transition-all duration-400 hover:-translate-y-1">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLogin ? "S'authentifier" : "Ouvrir le dossier"}
                    </Button>
                    
                  </form>

                  {/* TOGGLE CONNEXION / INSCRIPTION */}
                  <div className="mt-8 text-center">
                    <button 
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-[11px] font-bold text-[#888888] hover:text-[#111111] uppercase tracking-widest transition-colors"
                    >
                      {isLogin ? "Nouveau ici ? Créer un dossier" : "Dossier existant ? S'authentifier"}
                    </button>
                  </div>

                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
