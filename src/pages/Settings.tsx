import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { User, Settings as SettingsIcon, Shield, Monitor, Bell, Database, Trash2, Camera, Save, LogOut, Upload, Image, X, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/ThemeProvider";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreferences } = useUserPreferences();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [university, setUniversity] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  
  // Password change states
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  
  const [textSize, setTextSize] = useState(preferences.text_size);
  const [fontFamily, setFontFamily] = useState(preferences.font_family);
  const [summaryDisplay, setSummaryDisplay] = useState(preferences.summary_display);
  const [language, setLanguage] = useState(preferences.language);
  
  const [weeklyResults, setWeeklyResults] = useState(preferences.notify_weekly_results);
  const [revisionReminders, setRevisionReminders] = useState(preferences.notify_revision_reminders);
  const [newQuizAlerts, setNewQuizAlerts] = useState(preferences.notify_new_qcm);
  const [flashcardAlerts, setFlashcardAlerts] = useState(preferences.notify_flashcard_alerts);
  const [subscriptionAlerts, setSubscriptionAlerts] = useState(preferences.notify_subscription_alerts);
  
  const [stats, setStats] = useState({ courses: 0, quizzes: 0, summaries: 0, flashcards: 0, storageUsed: 0, storageLimit: 100 });

  useEffect(() => {
    setTextSize(preferences.text_size);
    setFontFamily(preferences.font_family);
    setSummaryDisplay(preferences.summary_display);
    setLanguage(preferences.language);
    setWeeklyResults(preferences.notify_weekly_results);
    setRevisionReminders(preferences.notify_revision_reminders);
    setNewQuizAlerts(preferences.notify_new_qcm);
    setFlashcardAlerts(preferences.notify_flashcard_alerts);
    setSubscriptionAlerts(preferences.notify_subscription_alerts);
  }, [preferences]);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setUser(user);

      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (profileData) {
        setProfile(profileData);
        setName(profileData.name || "");
        setFirstName(profileData.first_name || "");
        setStudentNumber(profileData.student_number || "");
        setUniversity(profileData.university || "");
        setYearOfStudy(profileData.year_of_study || "");
        if (profileData.avatar_url) setAvatarPreview(profileData.avatar_url);
      }

      const [coursesRes, quizzesRes, summariesRes, flashcardsRes] = await Promise.all([
        supabase.from("courses").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("qcm_sessions").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("summaries").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("flashcards").select("id", { count: "exact" }).eq("user_id", user.id),
      ]);

      setStats({
        courses: coursesRes.count || 0, quizzes: quizzesRes.count || 0, summaries: summariesRes.count || 0, flashcards: flashcardsRes.count || 0,
        storageUsed: Math.round(((coursesRes.count || 0) * 0.5 + (quizzesRes.count || 0) * 0.1)),
        storageLimit: profileData?.plan === "premium" ? 1000 : profileData?.plan === "pro" ? 5000 : 100,
      });
      setLoading(false);
    };
    fetchUserData();
  }, [navigate]);

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
      toast({ title: "Succès", description: "Photo de profil mise à jour" });
    } catch (error) {
      console.error("Avatar upload error:", error);
      setAvatarPreview(profile?.avatar_url || null);
      toast({ title: "Erreur", description: "Impossible d'uploader la photo", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
      if (error) throw error;
      setProfile({ ...profile, avatar_url: null });
      setAvatarPreview(null);
      toast({ title: "Succès", description: "Photo de profil supprimée" });
    } catch { toast({ title: "Erreur", description: "Impossible de supprimer la photo", variant: "destructive" }); }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        name, first_name: firstName, student_number: studentNumber, university, year_of_study: yearOfStudy,
      }).eq("id", user.id);
      if (error) throw error;
      setProfile({ ...profile, name, first_name: firstName, student_number: studentNumber, university, year_of_study: yearOfStudy });
      toast({ title: "Succès ✅", description: "Vos informations ont été mises à jour" });
    } catch { toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Erreur", description: "Le mot de passe doit contenir au moins 6 caractères", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Succès ✅", description: "Mot de passe mis à jour avec succès" });
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible de changer le mot de passe", variant: "destructive" });
    } finally { setChangingPassword(false); }
  };

  const handleSavePreferences = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updatePreferences({
        theme: theme as any, text_size: textSize as any, font_family: fontFamily as any,
        summary_display: summaryDisplay as any, language: language as any,
        notify_weekly_results: weeklyResults, notify_revision_reminders: revisionReminders,
        notify_new_qcm: newQuizAlerts, notify_flashcard_alerts: flashcardAlerts,
        notify_subscription_alerts: subscriptionAlerts,
      });
      toast({ title: "Succès ✅", description: "Préférences enregistrées" });
    } catch { toast({ title: "Erreur", description: "Impossible de sauvegarder les préférences", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/"); };

  if (loading) {
    return (<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>);
  }

  return (
    <div className="min-h-screen bg-dashboard bg-doodle-watermark py-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-5xl relative z-10">
        <div className="mb-6 sm:mb-8 text-center pt-8 sm:pt-0">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-foreground/10">
              <SettingsIcon className="h-6 w-6 text-foreground" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Paramètres</h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">Gérez votre compte et vos préférences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl mx-auto bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
              <User className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Profil</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Shield className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Sécurité</span>
            </TabsTrigger>
            <TabsTrigger value="display" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Monitor className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Affichage</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Bell className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Notifs</span>
            </TabsTrigger>
            <TabsTrigger value="storage" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Database className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Données</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="bg-card border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-foreground" />Informations personnelles</CardTitle>
                <CardDescription>Gérez vos informations de profil</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <Avatar className="h-24 w-24 border-4 border-foreground/20">
                      <AvatarImage src={avatarPreview || undefined} />
                      <AvatarFallback className="bg-foreground/10 text-foreground text-2xl">
                        {name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleAvatarUpload} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full shadow-md bg-foreground text-background hover:bg-foreground/90" disabled={uploadingAvatar}>
                          {uploadingAvatar ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background" /> : <Camera className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center">
                        <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}><Camera className="h-4 w-4 mr-2" />Prendre une photo</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()}><Image className="h-4 w-4 mr-2" />Choisir depuis la galerie</DropdownMenuItem>
                        {avatarPreview && (
                          <DropdownMenuItem onClick={handleDeleteAvatar} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Supprimer la photo</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{name || firstName || "Étudiant"}</h3>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <Badge variant="outline" className="mt-2 capitalize border-foreground/30">{profile?.plan || "gratuit"}</Badge>
                  </div>
                </div>
                <Separator />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="name">Nom</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" /></div>
                  <div className="space-y-2"><Label htmlFor="firstName">Prénom</Label><Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Votre prénom" /></div>
                  <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" value={user?.email || ""} disabled className="bg-muted" /></div>
                  <div className="space-y-2"><Label htmlFor="studentNumber">Numéro étudiant</Label><Input id="studentNumber" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} placeholder="Ex: 12345678" /></div>
                  <div className="space-y-2"><Label htmlFor="university">École / Université</Label><Input id="university" value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="Votre université" /></div>
                  <div className="space-y-2">
                    <Label htmlFor="yearOfStudy">Année d'étude</Label>
                    <Select value={yearOfStudy} onValueChange={setYearOfStudy}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="p1">PASS / L.AS</SelectItem><SelectItem value="p2">2ème année</SelectItem><SelectItem value="p3">3ème année</SelectItem>
                        <SelectItem value="d1">4ème année (Externat)</SelectItem><SelectItem value="d2">5ème année</SelectItem><SelectItem value="d3">6ème année</SelectItem>
                        <SelectItem value="internat">Internat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={saving} className="bg-foreground text-background hover:bg-foreground/90">
                    <Save className="h-4 w-4 mr-2" />{saving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab - with actual password change */}
          <TabsContent value="security">
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-foreground" />Sécurité du compte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <KeyRound className="h-5 w-5 text-foreground" />
                    <h4 className="font-semibold">Changer le mot de passe</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="new-password" className="text-sm">Nouveau mot de passe</Label>
                      <Input id="new-password" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="confirm-new-password" className="text-sm">Confirmer</Label>
                      <Input id="confirm-new-password" type="password" placeholder="••••••••" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
                    </div>
                    <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword} className="bg-foreground text-background hover:bg-foreground/90">
                      <KeyRound className="h-4 w-4 mr-2" />{changingPassword ? "Mise à jour..." : "Mettre à jour"}
                    </Button>
                  </div>
                </div>
                <Separator />
                <Button variant="outline" onClick={handleSignOut} className="border-destructive/30 text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />Se déconnecter
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Display Tab */}
          <TabsContent value="display">
            <Card className="border-border/50 shadow-lg">
              <CardHeader><CardTitle className="flex items-center gap-2"><Monitor className="h-5 w-5 text-foreground" />Préférences d'affichage</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div><Label className="text-base">Mode d'affichage</Label><p className="text-sm text-muted-foreground">Clair ou sombre</p></div>
                  <div className="flex gap-2">
                    <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => { setTheme("light"); }} className={theme === "light" ? "bg-foreground text-background" : "border-foreground/30"}>🌞 Clair</Button>
                    <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => { setTheme("dark"); }} className={theme === "dark" ? "bg-foreground text-background" : "border-foreground/30"}>🌙 Sombre</Button>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between"><div><Label className="text-base">Taille du texte</Label></div>
                  <Select value={textSize} onValueChange={(v) => setTextSize(v as any)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="small">Petit</SelectItem><SelectItem value="medium">Moyen</SelectItem><SelectItem value="large">Grand</SelectItem></SelectContent></Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between"><div><Label className="text-base">Police de lecture</Label></div>
                  <Select value={fontFamily} onValueChange={(v) => setFontFamily(v as any)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sans-serif">Sans-serif</SelectItem><SelectItem value="serif">Serif</SelectItem></SelectContent></Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between"><div><Label className="text-base">Affichage résumés</Label></div>
                  <Select value={summaryDisplay} onValueChange={(v) => setSummaryDisplay(v as any)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">Compact</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="extended">Étendu</SelectItem></SelectContent></Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between"><div><Label className="text-base">Langue</Label></div>
                  <Select value={language} onValueChange={(v) => setLanguage(v as any)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fr">🇫🇷 Français</SelectItem><SelectItem value="en">🇬🇧 English</SelectItem></SelectContent></Select>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSavePreferences} disabled={saving} className="bg-foreground text-background hover:bg-foreground/90"><Save className="h-4 w-4 mr-2" />Sauvegarder</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card className="border-border/50 shadow-lg">
              <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-foreground" />Notifications</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-foreground/5 border border-foreground/10">
                  <div><h4 className="font-medium text-sm">Notifications navigateur</h4><p className="text-xs text-muted-foreground">Activez les notifications push</p></div>
                  <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90" onClick={async () => {
                    const { requestNotificationPermission } = await import("@/lib/notifications");
                    const granted = await requestNotificationPermission();
                    toast(granted ? { title: "Notifications activées !" } : { title: "Notifications refusées", variant: "destructive" });
                  }}>Activer</Button>
                </div>
                {[
                  { label: "Résultats hebdomadaires", desc: "Résumé de vos performances", val: weeklyResults, set: setWeeklyResults },
                  { label: "Rappels de révision", desc: "Sessions de révision", val: revisionReminders, set: setRevisionReminders },
                  { label: "Nouveaux QCM", desc: "QCM disponibles", val: newQuizAlerts, set: setNewQuizAlerts },
                  { label: "Flashcards du jour", desc: "Rappel quotidien", val: flashcardAlerts, set: setFlashcardAlerts },
                  { label: "Alertes abonnement", desc: "Infos abonnement", val: subscriptionAlerts, set: setSubscriptionAlerts },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                    <div><h4 className="font-medium text-sm">{item.label}</h4><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                    <Switch checked={item.val} onCheckedChange={item.set} />
                  </div>
                ))}
                <div className="flex justify-end pt-3">
                  <Button onClick={handleSavePreferences} disabled={saving} className="bg-foreground text-background hover:bg-foreground/90"><Save className="h-4 w-4 mr-2" />Sauvegarder</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Storage Tab */}
          <TabsContent value="storage">
            <Card className="border-border/50 shadow-lg">
              <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-foreground" />Stockage et données</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-lg bg-muted/30">
                  <div className="flex justify-between mb-2"><span className="font-medium">Espace utilisé</span><span className="text-sm text-muted-foreground">{stats.storageUsed} Mo / {stats.storageLimit} Mo</span></div>
                  <Progress value={(stats.storageUsed / stats.storageLimit) * 100} className="h-2" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { val: stats.courses, label: "Cours", color: "text-foreground" },
                    { val: stats.quizzes, label: "QCM", color: "text-foreground" },
                    { val: stats.summaries, label: "Résumés", color: "text-foreground" },
                    { val: stats.flashcards, label: "Flashcards", color: "text-foreground" },
                  ].map((s) => (
                    <div key={s.label} className="p-4 rounded-lg bg-muted/30 border border-border/50 text-center">
                      <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
                      <p className="text-sm text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex items-center justify-between p-4 rounded-lg bg-foreground/5 border border-foreground/10">
                  <div>
                    <h4 className="font-medium">Plan actuel</h4>
                    <p className="text-sm text-muted-foreground capitalize">{profile?.plan || "Gratuit"}</p>
                  </div>
                  <div className="flex gap-2">
                    {profile?.plan && profile.plan !== "gratuit" && profile.plan !== "freemium" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20">
                            Résilier
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Résilier votre abonnement ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Vous passerez au plan gratuit à la fin de votre cycle de facturation actuel. Vous perdrez l'accès aux fonctionnalités premium.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={async () => {
                                if (!user) return;
                                try {
                                  const { error } = await supabase.from("profiles").update({ plan: "gratuit" }).eq("id", user.id);
                                  if (error) throw error;

                                  // Verify the update actually persisted (RLS may silently block it)
                                  const { data: verifyProfile } = await supabase
                                    .from("profiles")
                                    .select("plan")
                                    .eq("id", user.id)
                                    .single();

                                  if (verifyProfile?.plan && verifyProfile.plan !== "gratuit") {
                                    toast({ title: "Erreur", description: "La résiliation n'a pas pu être effectuée (restriction serveur). Contactez le support.", variant: "destructive" });
                                    return;
                                  }

                                  toast({ title: "Abonnement résilié", description: "Vous êtes repassé au plan gratuit. Rechargement..." });
                                  setTimeout(() => { window.location.reload(); }, 1500);
                                } catch (e) {
                                  toast({ title: "Erreur", description: "Impossible de résilier l'abonnement", variant: "destructive" });
                                }
                              }}
                            >
                              Confirmer la résiliation
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <Button onClick={() => navigate("/subscription")} className="bg-foreground text-background hover:bg-foreground/90">Améliorer</Button>
                  </div>
                </div>
                <Separator />
                <div className="pt-4">
                  <h4 className="text-sm font-medium text-destructive mb-4">Zone de danger</h4>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10"><Trash2 className="h-4 w-4 mr-2" />Supprimer mon compte</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Supprimer votre compte ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => toast({ title: "Contactez le support", variant: "destructive" })}>Supprimer</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
