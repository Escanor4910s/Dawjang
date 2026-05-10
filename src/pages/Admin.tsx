import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, BookOpen, FileText, Brain, ArrowLeft, Shield, RefreshCw, Search, Copy, Pencil, ShieldAlert, Sparkles, Activity, KeyRound, Database, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  name: string | null;
  first_name: string | null;
  avatar_url: string | null;
  plan: string | null;
  university: string | null;
}

interface AdminStats {
  totalUsers: number;
  totalCourses: number;
  totalQuizzes: number;
  totalSummaries: number;
}

interface UserWithStats extends UserProfile {
  courseCount: number;
  quizCount: number;
  summaryCount: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [userEmail, setUserEmail] = useState("");
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, totalCourses: 0, totalQuizzes: 0, totalSummaries: 0 });
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [editing, setEditing] = useState<UserWithStats | null>(null);
  const [editForm, setEditForm] = useState({ 
    first_name: "", 
    name: "", 
    plan: "gratuit", 
    credits: 100, 
    university: "",
    student_number: "",
    year_of_study: ""
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email || "");
    });
  }, []);

  // Admin status is determined SOLELY by the user_roles table via useUserRole() hook
  // Never use hardcoded email checks — that's a client-side bypass vulnerability
  const isActuallyAdmin = isAdmin;

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, first_name, avatar_url, plan, university, student_number, year_of_study");
      if (profilesError) {
        console.error("profiles error:", profilesError);
        toast.error("Erreur chargement profils: " + profilesError.message);
      }
      const [coursesRes, quizzesRes, summariesRes] = await Promise.all([
        supabase.from("courses").select("id, user_id"),
        supabase.from("qcm_sessions").select("id, user_id"),
        supabase.from("summaries").select("id, user_id"),
      ]);

      const courses = coursesRes.data || [];
      const quizzes = quizzesRes.data || [];
      const summaries = summariesRes.data || [];

      setStats({
        totalUsers: (profiles || []).length,
        totalCourses: courses.length,
        totalQuizzes: quizzes.length,
        totalSummaries: summaries.length,
      });

      const usersWithStats: UserWithStats[] = (profiles || []).map((p) => ({
        ...p,
        courseCount: courses.filter((c) => c.user_id === p.id).length,
        quizCount: quizzes.filter((q) => q.user_id === p.id).length,
        summaryCount: summaries.filter((s) => s.user_id === p.id).length,
      }));

      setUsers(usersWithStats);
    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast.error("Erreur lors de la récupération des données");
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => {
    if (roleLoading) return;
    if (isActuallyAdmin) fetchAdminData();
  }, [roleLoading, isActuallyAdmin, fetchAdminData]);

  const openEdit = (u: UserWithStats) => {
    setEditing(u);
    setEditForm({
      first_name: u.first_name || "",
      name: u.name || "",
      plan: u.plan || "gratuit",
      credits: 100,
      university: u.university || "",
      student_number: u.student_number || "",
      year_of_study: u.year_of_study || "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    
    // First try standard update
    const { error } = await supabase.from("profiles").update({
      first_name: editForm.first_name || null,
      name: editForm.name || null,
      plan: editForm.plan,
      university: editForm.university || null,
      student_number: editForm.student_number || null,
      year_of_study: editForm.year_of_study || null,
    }).eq("id", editing.id);

    if (error) {
      // Fallback to RPC if RLS blocks standard update
      const { error: rpcError } = await supabase.rpc("admin_update_profile" as any, {
        p_user_id: editing.id,
        p_first_name: editForm.first_name || null,
        p_name: editForm.name || null,
        p_plan: editForm.plan,
        p_credits: editForm.credits,
        p_university: editForm.university || null,
        p_student_number: editForm.student_number || null,
        p_year_of_study: editForm.year_of_study || null,
      });
      if (rpcError) {
        toast.error("Échec de la modification: " + rpcError.message);
        setSaving(false);
        return;
      }
    }
    
    toast.success("Profil mis à jour avec succès !");
    setSaving(false);
    setEditing(null);
    fetchAdminData();
  };

  const filteredUsers = useMemo(() => {
    if (!searchText.trim()) return users;
    const q = searchText.toLowerCase();
    return users.filter(u =>
      (u.first_name || "").toLowerCase().includes(q) ||
      (u.name || "").toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      (u.plan || "").toLowerCase().includes(q) ||
      (u.university || "").toLowerCase().includes(q)
    );
  }, [users, searchText]);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("ID copié !");
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Shield className="w-10 h-10 text-primary" />
          <p className="text-muted-foreground font-medium">Vérification des accès...</p>
        </div>
      </div>
    );
  }

  if (!isActuallyAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-lg w-full border-destructive/20 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-destructive" />
          <CardContent className="py-10 text-center">
            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-3 text-foreground">Accès Restreint</h2>
            <p className="text-muted-foreground mb-6 px-4">
              Votre compte n'est pas encore enregistré comme administrateur dans la base de données.
            </p>
            {userEmail && (
              <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Pour activer l'accès admin, exécutez dans Supabase SQL Editor :</p>
                <code className="text-xs bg-background block p-3 rounded-lg border border-border/50 text-primary font-mono overflow-x-auto whitespace-pre">{`INSERT INTO user_roles (user_id, role)\nSELECT id, 'admin'\nFROM auth.users\nWHERE email = '${userEmail}'\nON CONFLICT DO NOTHING;`}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(`INSERT INTO user_roles (user_id, role)\nSELECT id, 'admin'\nFROM auth.users\nWHERE email = '${userEmail}'\nON CONFLICT DO NOTHING;`); toast.success("Commande SQL copiée !"); }}
                  className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" /> Copier la commande SQL
                </button>
              </div>
            )}
            <Button onClick={() => navigate("/dashboard")} className="bg-foreground text-background w-full sm:w-auto px-8 rounded-full h-12">
              Retour au tableau de bord
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dashboard bg-doodle-watermark py-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="max-w-[1600px] mx-auto px-4 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6 pt-8 sm:pt-0">
          <div className="flex items-center gap-5">
            <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")} className="rounded-xl h-12 w-12 border-border/50 shadow-sm hover:bg-muted">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest mb-1.5">
                <Shield className="h-3 w-3" /> Espace Sécurisé
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground">Panneau d'Administration</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Badge variant="outline" className="px-3 py-1.5 h-12 flex items-center gap-2 border-border/50 shadow-sm bg-card">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Connecté en tant que: <span className="font-bold">{userEmail}</span>
            </Badge>
            <Button onClick={fetchAdminData} disabled={loading} className="rounded-xl h-12 shadow-sm gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[
            { icon: Users, label: "Utilisateurs Inscrits", value: stats.totalUsers, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
            { icon: BookOpen, label: "Cours Importés", value: stats.totalCourses, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
            { icon: Brain, label: "QCM Générés", value: stats.totalQuizzes, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
            { icon: FileText, label: "Résumés Créés", value: stats.totalSummaries, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className={`border ${s.border} shadow-sm bg-card hover:shadow-md transition-all overflow-hidden relative group`}>
                <div className={`absolute top-0 right-0 w-32 h-32 ${s.bg} rounded-full blur-[40px] -mr-10 -mt-10 transition-transform group-hover:scale-150`} />
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-2xl ${s.bg}`}><s.icon className={`h-6 w-6 ${s.color}`} /></div>
                    <Activity className={`h-4 w-4 ${s.color} opacity-50`} />
                  </div>
                  <div>
                    <p className="text-4xl font-black text-foreground mb-1">{loading ? "-" : s.value}</p>
                    <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Database Table */}
        <Card className="border-border/50 shadow-lg bg-card overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-bold"><Database className="h-5 w-5 text-primary" /> Base de Données Utilisateurs</CardTitle>
                <CardDescription className="mt-1">Gérez les permissions, abonnements et profils ({filteredUsers.length} résultats)</CardDescription>
              </div>
              <div className="relative w-full lg:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher par nom, email, ID, université..." 
                  value={searchText} 
                  onChange={(e) => setSearchText(e.target.value)} 
                  className="pl-11 h-12 rounded-xl border-border/50 bg-background focus:ring-primary shadow-sm" 
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-6 py-4 font-semibold text-foreground">Utilisateur</TableHead>
                    <TableHead className="py-4 font-semibold text-foreground">ID Unique</TableHead>
                    <TableHead className="py-4 font-semibold text-foreground">Abonnement</TableHead>
                    <TableHead className="py-4 font-semibold text-foreground">Études</TableHead>
                    <TableHead className="text-center py-4 font-semibold text-foreground">Activité</TableHead>
                    <TableHead className="text-right px-6 py-4 font-semibold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                        Synchronisation en cours...
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                        Aucun utilisateur trouvé.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} className="hover:bg-muted/30 transition-colors group">
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10 border border-border/50 shadow-sm">
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary font-bold">
                                {(user.first_name || user.name || "?").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-bold text-foreground">{user.first_name || ""} {user.name || "Anonyme"}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{user.university || "Université non renseignée"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <button onClick={() => copyId(user.id)} className="flex items-center gap-2 text-xs font-mono bg-muted/50 text-muted-foreground hover:text-primary hover:bg-primary/10 px-2 py-1 rounded-md transition-colors group-hover:bg-background">
                            {user.id.substring(0, 12)}...<Copy className="h-3 w-3" />
                          </button>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge 
                            className={`capitalize px-3 py-1 shadow-sm ${
                              user.plan === "pro" ? "bg-primary hover:bg-primary" : 
                              user.plan === "premium" ? "bg-accent hover:bg-accent" : 
                              "bg-muted text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {user.plan === "pro" && <Sparkles className="w-3 h-3 mr-1" />}
                            {user.plan || "gratuit"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="w-fit text-[10px] py-0 border-primary/20 text-primary bg-primary/5">
                              {user.year_of_study || "N/A"}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Matr: {user.student_number || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center justify-center gap-3 text-xs font-medium">
                            <div className="flex flex-col items-center" title="Cours">
                              <BookOpen className="h-3 w-3 text-muted-foreground mb-1" />
                              <span className="text-foreground">{user.courseCount}</span>
                            </div>
                            <div className="flex flex-col items-center" title="QCM">
                              <Brain className="h-3 w-3 text-muted-foreground mb-1" />
                              <span className="text-foreground">{user.quizCount}</span>
                            </div>
                            <div className="flex flex-col items-center" title="Résumés">
                              <FileText className="h-3 w-3 text-muted-foreground mb-1" />
                              <span className="text-foreground">{user.summaryCount}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6 py-4">
                          <Button size="sm" variant="secondary" onClick={() => openEdit(user)} className="rounded-lg shadow-sm hover:bg-primary hover:text-background transition-all">
                            <Pencil className="h-4 w-4 mr-1.5" /> Gérer
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md rounded-[2rem] p-0 overflow-hidden border-border/50 shadow-2xl">
          <div className="bg-muted/30 px-6 py-5 border-b border-border/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl"><Pencil className="h-5 w-5 text-primary" /> Modifier l'utilisateur</DialogTitle>
              <DialogDescription>
                Synchronisation en temps réel avec la base de données Supabase.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-5 bg-background">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Prénom</Label>
                <Input className="h-12 rounded-xl" value={editForm.first_name} onChange={(e) => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nom</Label>
                <Input className="h-12 rounded-xl" value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Université / Faculté</Label>
              <Input className="h-12 rounded-xl" value={editForm.university} onChange={(e) => setEditForm(f => ({ ...f, university: e.target.value }))} placeholder="Ex: UCAD Dakar" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Niveau d'études</Label>
                <Input className="h-12 rounded-xl" value={editForm.year_of_study} onChange={(e) => setEditForm(f => ({ ...f, year_of_study: e.target.value }))} placeholder="Ex: L1, M2..." />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">N° Étudiant</Label>
                <Input className="h-12 rounded-xl" value={editForm.student_number} onChange={(e) => setEditForm(f => ({ ...f, student_number: e.target.value }))} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Abonnement</Label>
                <Select value={editForm.plan} onValueChange={(v) => setEditForm(f => ({ ...f, plan: v }))}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gratuit">Gratuit</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Crédits (Optionnel)</Label>
                <Input className="h-12 rounded-xl" type="number" value={editForm.credits} onChange={(e) => setEditForm(f => ({ ...f, credits: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            
            <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-4 flex items-start gap-3">
              <KeyRound className="h-5 w-5 text-destructive flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-destructive block mb-1">Sécurité des identifiants</strong>
                Pour des raisons de sécurité Supabase, la modification d'email et mot de passe ne peut être faite que par l'utilisateur lui-même via son propre espace.
              </p>
            </div>
          </div>
          
          <div className="p-4 px-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3">
            <Button variant="outline" className="rounded-xl px-6" onClick={() => setEditing(null)}>Annuler</Button>
            <Button className="rounded-xl px-8 shadow-sm" onClick={saveEdit} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
              {saving ? "Synchro..." : "Sauvegarder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;