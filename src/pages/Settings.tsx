import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, Brain, Bell, Shield, Palette, 
  Camera, AlertTriangle, LogOut, Monitor, Moon, Sun, Save, 
  KeyRound, Type, Eye, EyeOff, Headphones, Sparkles
} from "lucide-react";
import { AnimatedBanner } from "@/components/AnimatedBanner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useTheme } from "@/components/ThemeProvider";

type SettingsTab = "profile" | "learning" | "appearance" | "notifications" | "security";

export const Settings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { preferences, updatePreferences } = useUserPreferences();
  const { theme, setTheme } = useTheme();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- États Sécurité & Mots de passe ---
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwords, setPasswords] = useState({ new: "", confirm: "" });
  
  // --- États Suppression de compte ---
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  // --- États des préférences ---
  const [formData, setFormData] = useState({
    firstName: "",
    email: "",
    university: "",
    targetSpecialty: "Cardiologie",
    morTone: "socratic",
    dailyCardLimit: 150,
    theme: "system",
    fontFamily: "sans-serif", // Ajout de la police de texte
    notifyReview: true,
    notifyUpdates: false,
    notifyDuels: true,
    notifyCommunity: false,
    binauralDefault: true,
  });

  // Fetch initial data
  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setUser(user);

      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (profileData) {
        setProfile(profileData);
        if (profileData.avatar_url) setAvatarPreview(profileData.avatar_url);
        
        setFormData(prev => ({
          ...prev,
          firstName: profileData.first_name || profileData.name || "",
          email: user.email || "",
          university: profileData.university || "",
        }));
      }

      setFormData(prev => ({
        ...prev,
        theme: theme || "system",
        fontFamily: preferences.font_family || "sans-serif",
        notifyReview: preferences.notify_revision_reminders ?? true,
        notifyUpdates: preferences.notify_new_qcm ?? false,
      }));

      setLoading(false);
    };
    fetchUserData();
  }, [navigate, preferences, theme]);

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
    
    // Si c'est le thème, l'appliquer immédiatement pour la preview
    if (key === "theme") {
      setTheme(value);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      if (updateError) throw updateError;
      setProfile({ ...profile, avatar_url: publicUrl });
      setAvatarPreview(publicUrl);
      toast.success("Photo de profil mise à jour");
    } catch (error) {
      console.error("Avatar upload error:", error);
      setAvatarPreview(profile?.avatar_url || null);
      toast.error("Impossible d'uploader la photo");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // 1. Update Profile (firstName, university)
      const { error: profileError } = await supabase.from("profiles").update({
        first_name: formData.firstName,
        university: formData.university,
      }).eq("id", user.id);
      
      if (profileError) throw profileError;

      // 2. Update Preferences
      await updatePreferences({
        theme: formData.theme as any,
        font_family: formData.fontFamily as any,
        notify_revision_reminders: formData.notifyReview,
        notify_new_qcm: formData.notifyUpdates,
      });

      setHasChanges(false);
      toast.success("Vos préférences ont été sauvegardées avec succès.");
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Erreur: " + (error?.message || error?.details || JSON.stringify(error)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    if (passwords.new.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) throw error;
      toast.success("Mot de passe mis à jour avec succès.");
      setIsChangingPassword(false);
      setPasswords({ new: "", confirm: "" });
    } catch (err: any) {
      toast.error("Erreur lors de la mise à jour du mot de passe.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "SUPPRIMER") {
      toast.error("Veuillez taper 'SUPPRIMER' pour confirmer.");
      return;
    }
    
    toast.loading("Suppression définitive en cours...", { id: "delete-toast" });
    try {
      // Appel RPC Supabase pour supprimer l'utilisateur (à configurer côté base de données)
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;
      
      await supabase.auth.signOut();
      toast.success("Votre compte a été supprimé définitivement.", { id: "delete-toast" });
      navigate("/auth");
    } catch (err) {
      toast.error("Erreur lors de la suppression. Veuillez réessayer.", { id: "delete-toast" });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const CustomToggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      type="button"
      onClick={onChange}
      className={`w-11 h-6 rounded-full transition-colors duration-300 relative focus:outline-none ${
        checked ? "bg-[#5B21B6]" : "bg-black/10 dark:bg-white/10"
      }`}
    >
      <motion.div
        layout
        className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm ${checked ? "left-[22px]" : "left-0.5"}`}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );

  const menuItems = [
    { id: "profile", label: "Profil Personnel", icon: User },
    { id: "learning", label: "Apprentissage & IA", icon: Brain },
    { id: "appearance", label: "Apparence & Audio", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Sécurité & Accès", icon: Shield },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B21B6]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-[#111111] dark:text-[#F4F4F2] font-sans pt-8 pb-32 w-full transition-colors duration-300">
      
      <style dangerouslySetInnerHTML={{__html: `
        .editorial-scrollbar::-webkit-scrollbar { width: 4px; }
        .editorial-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .editorial-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .dark .editorial-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
      `}} />

      <div className="max-w-[1400px] mx-auto px-6 space-y-10 relative z-10">
        
        <AnimatedBanner 
          title="Paramètres de l'Espace."
          subtitle="Configurez votre identité clinique, le comportement de l'Agent MOR et vos préférences."
        />

        <div className="grid lg:grid-cols-12 gap-10 items-start">
          
          {/* MENU LATÉRAL INTERNE */}
          <div className="lg:col-span-3 space-y-2 sticky top-8">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as SettingsTab)}
                  className={`w-full flex items-center gap-3 px-5 py-4 rounded-[1.5rem] transition-all duration-300 relative group outline-none text-left ${
                    isActive ? "text-[#111111] dark:text-white font-bold" : "text-[#888888] dark:text-[#8E8E8A] hover:text-[#111111] dark:hover:text-white"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="settings-active-tab"
                      className="absolute inset-0 bg-white dark:bg-[#161614] border border-black/5 dark:border-white/5 shadow-sm rounded-[1.5rem] z-0"
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  )}
                  <Icon className={`h-4 w-4 relative z-10 ${isActive ? "text-[#5B21B6]" : "group-hover:text-[#5B21B6] transition-colors"}`} />
                  <span className="relative z-10 text-sm tracking-wide">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* ZONE DE CONTENU */}
          <div className="lg:col-span-9">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="bg-white dark:bg-[#161614] border border-black/5 dark:border-white/5 rounded-[2.5rem] p-8 md:p-14 shadow-sm overflow-hidden"
              >
                {/* 1. PROFIL PERSONNEL */}
                {activeTab === "profile" && (
                  <div className="space-y-12">
                    <div>
                      <h2 className="text-2xl font-light tracking-tight mb-2">Identité Clinique</h2>
                      <p className="text-sm text-[#888888] dark:text-[#8E8E8A]">Ces informations apparaissent sur vos polycopiés exportés.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 text-center sm:text-left">
                      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="h-28 w-28 rounded-full bg-transparent border border-black/10 dark:border-white/10 flex items-center justify-center overflow-hidden">
                          {avatarPreview ? (
                            <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-3xl font-light text-[#5B21B6]">{formData.firstName?.charAt(0)?.toUpperCase()}</span>
                          )}
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                          {uploadingAvatar ? (
                             <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                          ) : (
                            <Camera className="h-6 w-6 text-white" />
                          )}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                      </div>
                      <div className="flex flex-col justify-center h-28">
                        <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 rounded-full bg-[#111111] dark:bg-white text-white dark:text-[#111111] text-xs font-bold uppercase tracking-widest hover:bg-[#5B21B6] dark:hover:bg-[#5B21B6] dark:hover:text-white transition-colors">
                          Modifier la photo
                        </button>
                        <p className="text-[10px] text-[#888888] dark:text-[#8E8E8A] mt-3 uppercase tracking-widest">JPG, GIF ou PNG. Max 2MB.</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Nom Complet</label>
                        <input type="text" value={formData.firstName} onChange={(e) => handleChange("firstName", e.target.value)} className="w-full bg-transparent border border-black/10 dark:border-white/10 focus:border-[#5B21B6] rounded-xl px-5 py-4 text-sm font-medium outline-none transition-colors" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Email Institutionnel</label>
                        <input type="email" value={formData.email} disabled className="w-full bg-transparent border border-black/10 dark:border-white/10 opacity-70 cursor-not-allowed rounded-xl px-5 py-4 text-sm font-medium outline-none transition-colors" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Université / C.H.U</label>
                        <input type="text" value={formData.university} onChange={(e) => handleChange("university", e.target.value)} className="w-full bg-transparent border border-black/10 dark:border-white/10 focus:border-[#5B21B6] rounded-xl px-5 py-4 text-sm font-medium outline-none transition-colors" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Objectif de Spécialité</label>
                        <input type="text" value={formData.targetSpecialty} onChange={(e) => handleChange("targetSpecialty", e.target.value)} className="w-full bg-transparent border border-black/10 dark:border-white/10 focus:border-[#5B21B6] rounded-xl px-5 py-4 text-sm font-medium outline-none transition-colors" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. APPRENTISSAGE & IA */}
                {activeTab === "learning" && (
                  <div className="space-y-12">
                    <div>
                      <h2 className="text-2xl font-light tracking-tight mb-2 flex items-center gap-3">L'Agent MOR <Sparkles className="h-5 w-5 text-[#5B21B6]" /></h2>
                      <p className="text-sm text-[#888888] dark:text-[#8E8E8A]">Définissez la personnalité de votre tuteur IA.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      {[
                        { id: "kind", label: "Bienveillant", desc: "Encourage et guide doucement." },
                        { id: "socratic", label: "Socratique", desc: "Pose des questions de réflexion." },
                        { id: "strict", label: "Chef de Clinique", desc: "Intransigeant avec les erreurs." }
                      ].map(tone => (
                        <button key={tone.id} onClick={() => handleChange("morTone", tone.id)} className={`p-6 rounded-2xl border text-left transition-all ${formData.morTone === tone.id ? "border-[#5B21B6] bg-[#5B21B6]/5 dark:bg-[#5B21B6]/20 shadow-[0_0_20px_rgba(91,33,182,0.1)]" : "border-black/10 dark:border-white/10 hover:border-[#111111] dark:hover:border-white/30"}`}>
                          <div className={`h-4 w-4 rounded-full mb-4 border ${formData.morTone === tone.id ? "border-[#5B21B6] bg-[#5B21B6]" : "border-black/20 dark:border-white/20"} flex items-center justify-center`}>
                            {formData.morTone === tone.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </div>
                          <h4 className="text-sm font-bold mb-1">{tone.label}</h4>
                          <p className="text-xs text-[#888888] dark:text-[#8E8E8A] leading-relaxed">{tone.desc}</p>
                        </button>
                      ))}
                    </div>

                    <div className="pt-8 border-t border-black/5 dark:border-white/5">
                      <h3 className="text-lg font-bold mb-6">Algorithme SM-2</h3>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-transparent rounded-2xl border border-black/5 dark:border-white/5 gap-6">
                        <div>
                          <h4 className="text-sm font-bold">Limite journalière (Flashcards)</h4>
                          <p className="text-xs text-[#888888] dark:text-[#8E8E8A] mt-1">Nombre maximum de cartes à réviser par jour.</p>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <input type="range" min="50" max="500" step="10" value={formData.dailyCardLimit || 150} onChange={(e) => handleChange("dailyCardLimit", Number(e.target.value) || 150)} className="w-full sm:w-32 accent-[#5B21B6]" />
                          <span className="text-lg font-light w-12 text-right">{formData.dailyCardLimit || 150}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. APPARENCE & AUDIO (Design Éditorial 50/50) */}
                {activeTab === "appearance" && (
                  <div className="space-y-12">
                    <div>
                      <h2 className="text-3xl font-serif text-[#111111] dark:text-white leading-[1.15] mb-2 tracking-tight">Environnement Visuel & Sonore</h2>
                      <p className="text-sm text-[#888888] dark:text-[#8E8E8A]">Sculptez l'esthétique et l'acoustique de votre espace de travail clinique.</p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-[#888888] mb-4 border-b border-black/5 dark:border-white/5 pb-2">Mode Colorimétrique</h3>
                      <div className="grid md:grid-cols-3 gap-4">
                        {[
                          { id: "light", icon: Sun, label: "Mode Éditorial", desc: "Papier mat et chaleureux" },
                          { id: "dark", icon: Moon, label: "Mode Obsidienne", desc: "Noirs profonds et contrastes" },
                          { id: "system", icon: Monitor, label: "Synchro Système", desc: "S'adapte à votre OS" }
                        ].map(themeOption => {
                          const Icon = themeOption.icon;
                          const isActive = formData.theme === themeOption.id;
                          return (
                            <button key={themeOption.id} onClick={() => handleChange("theme", themeOption.id)} className={`relative p-6 rounded-[2rem] border text-left transition-all duration-500 overflow-hidden group outline-none ${isActive ? "border-[#111111] dark:border-white bg-transparent shadow-[0_15px_40px_-15px_rgba(0,0,0,0.1)]" : "border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 bg-white dark:bg-[#161614]"}`}>
                              {isActive && <motion.div layoutId="theme-active" className="absolute inset-0 bg-gradient-to-br from-black/[0.02] to-transparent dark:from-white/[0.02] pointer-events-none" />}
                              <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-4 transition-colors duration-500 ${isActive ? "bg-[#111111] text-white dark:bg-white dark:text-[#111111] shadow-inner" : "bg-transparent text-[#888888] group-hover:text-[#111111] dark:group-hover:text-white"}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <h4 className="text-sm font-bold text-[#111111] dark:text-white">{themeOption.label}</h4>
                              <p className="text-[10px] uppercase tracking-widest text-[#888888] mt-2">{themeOption.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-[#888888] mb-4 border-b border-black/5 dark:border-white/5 pb-2">Typographie Officielle</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {[
                          { id: "sans-serif", name: "Inter", class: "font-sans", desc: "La norme numérique moderne", preview: "L'anatomie cardiaque est fascinante.", style: {} },
                          { id: "open-sans", name: "Open Sans", class: "", desc: "Lisibilité maximale, certifiée", style: { fontFamily: "'Open Sans', sans-serif" }, preview: "Le ventricule gauche propulse le sang." },
                          { id: "serif", name: "Merriweather", class: "font-serif", desc: "Confort de lecture littéraire", preview: "L'artère aorte naît du ventricule.", style: {} },
                          { id: "monospace", name: "JetBrains", class: "font-mono", desc: "Architecture et technique pure", preview: "V = IR ; Loi d'Ohm.", style: {} }
                        ].map(font => {
                          const isActive = formData.fontFamily === font.id;
                          return (
                            <button key={font.id} onClick={() => handleChange("fontFamily", font.id)} className={`relative flex items-center p-5 rounded-[2rem] border transition-all duration-500 group text-left outline-none ${isActive ? "border-[#5B21B6] bg-[#5B21B6]/5 shadow-[0_10px_30px_-15px_rgba(91,33,182,0.15)]" : "border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 bg-white dark:bg-[#161614]"}`}>
                              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#5B21B6] rounded-r-full" />}
                              <div className="flex-1 pl-3 pr-4 border-r border-black/5 dark:border-white/5">
                                <h4 className={`text-base font-bold text-[#111111] dark:text-white ${font.class}`} style={font.style}>{font.name}</h4>
                                <p className="text-[10px] uppercase tracking-widest text-[#888888] mt-1">{font.desc}</p>
                              </div>
                              <div className="w-1/2 pl-6 overflow-hidden">
                                <p className={`text-sm text-[#444444] dark:text-[#AAAAAA] whitespace-nowrap truncate opacity-80 group-hover:opacity-100 transition-opacity ${font.class}`} style={font.style}>{font.preview}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-[#888888] mb-4 border-b border-black/5 dark:border-white/5 pb-2">Acoustique & Cognition</h3>
                      
                      <div className="flex flex-col md:flex-row items-center justify-between p-6 md:p-8 bg-white dark:bg-[#161614] rounded-[2rem] border border-black/5 dark:border-white/5 hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 transition-all duration-500 group">
                        <div className="flex items-start gap-5 mb-6 md:mb-0">
                          <div className="h-12 w-12 rounded-full bg-transparent border border-black/5 dark:border-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-[#5B21B6] group-hover:border-[#5B21B6] group-hover:text-white transition-colors duration-500 shadow-inner">
                            <Headphones className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-[#111111] dark:text-white tracking-tight">Battements Binauraux (40Hz)</h4>
                            <p className="text-sm text-[#666666] dark:text-[#8E8E8A] mt-2 max-w-lg leading-relaxed">
                              L'activation de la fréquence 40Hz en fond sonore stimule les ondes gamma du cerveau. Une technologie acoustique prouvée pour améliorer la concentration lors des phases de mémorisation intenses.
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-4 bg-transparent p-3 pr-4 rounded-full border border-black/5 dark:border-white/5">
                          <CustomToggle checked={formData.binauralDefault} onChange={() => handleChange("binauralDefault", !formData.binauralDefault)} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${formData.binauralDefault ? "text-[#5B21B6]" : "text-[#888888]"}`}>
                            {formData.binauralDefault ? "Activé" : "Inactif"}
                          </span>
                        </div>
                      </div>
                      
                    </div>
                  </div>
                )}

                {/* 4. NOTIFICATIONS */}
                {activeTab === "notifications" && (
                  <div className="space-y-12">
                    <div>
                      <h2 className="text-2xl font-light tracking-tight mb-2">Notifications</h2>
                      <p className="text-sm text-[#888888] dark:text-[#8E8E8A]">Gérez la façon dont Hippocampus communique avec vous.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-6 bg-transparent rounded-2xl border border-black/5 dark:border-white/5 transition-colors hover:border-black/10 dark:hover:border-white/10">
                        <div>
                          <h4 className="text-sm font-bold">Rappels de Révision (SM-2)</h4>
                          <p className="text-xs text-[#888888] dark:text-[#8E8E8A] mt-1">Alerte quand l'algorithme détecte un risque d'oubli.</p>
                        </div>
                        <CustomToggle checked={formData.notifyReview} onChange={() => handleChange("notifyReview", !formData.notifyReview)} />
                      </div>
                      <div className="flex items-center justify-between p-6 bg-transparent rounded-2xl border border-black/5 dark:border-white/5 transition-colors hover:border-black/10 dark:hover:border-white/10">
                        <div>
                          <h4 className="text-sm font-bold">Mises à jour et Nouveautés</h4>
                          <p className="text-xs text-[#888888] dark:text-[#8E8E8A] mt-1">Nouvelles fonctionnalités et annonces importantes.</p>
                        </div>
                        <CustomToggle checked={formData.notifyUpdates} onChange={() => handleChange("notifyUpdates", !formData.notifyUpdates)} />
                      </div>
                      <div className="flex items-center justify-between p-6 bg-transparent rounded-2xl border border-black/5 dark:border-white/5 transition-colors hover:border-black/10 dark:hover:border-white/10">
                        <div>
                          <h4 className="text-sm font-bold">Défis et Duels Cliniques</h4>
                          <p className="text-xs text-[#888888] dark:text-[#8E8E8A] mt-1">Invitations à des duels et résultats de classement.</p>
                        </div>
                        <CustomToggle checked={formData.notifyDuels} onChange={() => handleChange("notifyDuels", !formData.notifyDuels)} />
                      </div>
                      <div className="flex items-center justify-between p-6 bg-transparent rounded-2xl border border-black/5 dark:border-white/5 transition-colors hover:border-black/10 dark:hover:border-white/10">
                        <div>
                          <h4 className="text-sm font-bold">Activité de la Communauté</h4>
                          <p className="text-xs text-[#888888] dark:text-[#8E8E8A] mt-1">Nouveaux QCM et résumés partagés dans vos groupes.</p>
                        </div>
                        <CustomToggle checked={formData.notifyCommunity} onChange={() => handleChange("notifyCommunity", !formData.notifyCommunity)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. SÉCURITÉ & ACCÈS (Refonte Majeure) */}
                {activeTab === "security" && (
                  <div className="space-y-12">
                    <div>
                      <h2 className="text-2xl font-light tracking-tight mb-2">Sécurité & Accès</h2>
                      <p className="text-sm text-[#888888] dark:text-[#8E8E8A]">Gérez votre mot de passe et l'intégrité de votre compte.</p>
                    </div>

                    <div className="space-y-6">
                      
                      {/* --- Modification Mot de Passe In-Place --- */}
                      <div className="bg-transparent rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden transition-all duration-300">
                        <div className="flex items-center justify-between p-6">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-white dark:bg-[#161614] rounded-xl border border-black/10 dark:border-white/10 shadow-sm">
                              <KeyRound className="h-5 w-5 text-[#111111] dark:text-white" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold">Modifier le mot de passe</h4>
                              <p className="text-xs text-[#888888] dark:text-[#8E8E8A]">Mettez à jour vos identifiants de connexion.</p>
                            </div>
                          </div>
                          <button onClick={() => setIsChangingPassword(!isChangingPassword)} className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full transition-colors ${isChangingPassword ? "bg-[#111111] dark:bg-white text-white dark:text-[#111111]" : "hover:bg-black/5 dark:hover:bg-white/10"}`}>
                            {isChangingPassword ? "Fermer" : "Gérer"}
                          </button>
                        </div>

                        <AnimatePresence>
                          {isChangingPassword && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-black/5 dark:border-white/5 bg-white dark:bg-[#161614]">
                              <form onSubmit={handleUpdatePassword} className="p-6 space-y-4">
                                <div className="space-y-3">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#888888] dark:text-[#8E8E8A]">Nouveau mot de passe</label>
                                  <div className="relative">
                                    <input type={showPassword ? "text" : "password"} value={passwords.new} onChange={(e) => setPasswords({...passwords, new: e.target.value})} className="w-full bg-transparent border border-black/10 dark:border-white/10 focus:border-[#5B21B6] rounded-xl px-4 py-3 text-sm outline-none" required />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#111111] dark:hover:text-white transition-colors">
                                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#888888] dark:text-[#8E8E8A]">Confirmer le mot de passe</label>
                                  <input type={showPassword ? "text" : "password"} value={passwords.confirm} onChange={(e) => setPasswords({...passwords, confirm: e.target.value})} className="w-full bg-transparent border border-black/10 dark:border-white/10 focus:border-[#5B21B6] rounded-xl px-4 py-3 text-sm outline-none" required />
                                </div>
                                <div className="pt-2 flex justify-end">
                                  <button type="submit" disabled={isSaving} className="px-6 py-3 rounded-full bg-[#111111] dark:bg-white text-white dark:text-[#111111] text-xs font-bold uppercase tracking-widest hover:bg-[#5B21B6] dark:hover:bg-[#5B21B6] dark:hover:text-white transition-colors disabled:opacity-50">
                                    {isSaving ? "Mise à jour..." : "Enregistrer le mot de passe"}
                                  </button>
                                </div>
                              </form>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <button onClick={handleLogout} className="w-full flex items-center p-6 bg-transparent rounded-2xl border border-black/5 dark:border-white/5 hover:border-red-500/50 transition-colors group">
                        <div className="p-3 bg-white dark:bg-[#161614] rounded-xl border border-black/10 dark:border-white/10 shadow-sm mr-4">
                          <LogOut className="h-5 w-5 text-[#111111] dark:text-white group-hover:text-red-500 transition-colors" />
                        </div>
                        <div className="text-left">
                          <h4 className="text-sm font-bold">Se déconnecter</h4>
                          <p className="text-xs text-[#888888] dark:text-[#8E8E8A]">Fermer la session en toute sécurité.</p>
                        </div>
                      </button>
                    </div>

                    {/* --- ZONE DE DANGER (Style Vercel / Suppression Autonome) --- */}
                    <div className="mt-12 pt-8 border-t border-red-500/20">
                      <h3 className="text-lg font-bold text-red-500 mb-4 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" /> Zone de Danger
                      </h3>
                      
                      <div className={`border rounded-2xl overflow-hidden transition-all duration-300 ${isDeletingAccount ? "border-red-500 bg-red-500/5" : "border-red-500/30 bg-transparent"}`}>
                        <div className="flex flex-col md:flex-row items-center justify-between p-6">
                          <div className="mb-4 md:mb-0">
                            <h4 className="text-sm font-bold text-[#111111] dark:text-white">Supprimer le compte</h4>
                            <p className="text-xs text-[#888888] dark:text-[#8E8E8A] mt-1 max-w-sm leading-relaxed">
                              Supprime définitivement votre compte, vos abonnements, et votre historique clinique. Cette action est irréversible.
                            </p>
                          </div>
                          {!isDeletingAccount && (
                            <button onClick={() => setIsDeletingAccount(true)} className="px-6 py-3 rounded-xl bg-red-500 text-white text-xs font-bold uppercase tracking-widest hover:bg-red-600 transition-colors shrink-0 shadow-sm">
                              Supprimer
                            </button>
                          )}
                        </div>

                        <AnimatePresence>
                          {isDeletingAccount && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-red-500/10 border-t border-red-500/20 p-6">
                              <div className="bg-white dark:bg-[#161614] rounded-xl p-5 border border-red-500/30">
                                <p className="text-sm font-bold text-red-500 mb-4">Pour confirmer, tapez "SUPPRIMER" ci-dessous :</p>
                                <input 
                                  type="text" 
                                  placeholder="SUPPRIMER" 
                                  value={deleteConfirmation}
                                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                                  className="w-full bg-transparent border border-black/10 dark:border-white/10 focus:border-red-500 rounded-lg px-4 py-3 text-sm font-mono outline-none mb-4 transition-colors"
                                />
                                <div className="flex justify-end gap-3">
                                  <button onClick={() => { setIsDeletingAccount(false); setDeleteConfirmation(""); }} className="px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-[#888888] hover:text-[#111111] dark:hover:text-white transition-colors">
                                    Annuler
                                  </button>
                                  <button onClick={handleDeleteAccount} disabled={deleteConfirmation !== "SUPPRIMER"} className="px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                                    Confirmer la suppression
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* --- BARRE DE SAUVEGARDE FLOTTANTE --- */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
            <div className="bg-[#111111] dark:bg-white text-white dark:text-[#111111] px-6 py-4 rounded-[2rem] shadow-2xl flex items-center justify-between border border-white/10 dark:border-black/10">
              <span className="text-sm font-medium">Modifications non enregistrées.</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setHasChanges(false)} className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-white/10 dark:hover:bg-black/10 transition-colors">Annuler</button>
                <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 rounded-full bg-white dark:bg-[#111111] text-[#111111] dark:text-white text-xs font-bold uppercase tracking-widest hover:bg-[#5B21B6] dark:hover:bg-[#5B21B6] hover:text-white transition-colors flex items-center gap-2 shadow-md">
                  {isSaving ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><Save className="h-4 w-4" /></motion.div> : "Enregistrer"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Settings;
