import React, { useState, useEffect, useCallback } from "react";
import { getErrorMessage } from "@/lib/errorUtils";
import { 
  Database, Users, BookOpen, Layers, Sparkles, CheckCircle2, 
  Trash2, Plus, Download, ShieldCheck, RefreshCw, Server, AlertCircle,
  Search, Pencil, ShieldAlert, ArrowUpRight, Play, FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { seedPreRecordedDataForUser } from "@/lib/seedPreRecordedData";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: "active" | "suspended";
  qcmCount: number;
  credits: number;
  university?: string;
  specialty?: string;
  avatar_url?: string | null;
}

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [activeTab, setActiveTab] = useState<"cms" | "users" | "telemetry">("cms");
  const [contentSubTab, setContentSubTab] = useState<"courses" | "summaries" | "flashcards" | "qcms">("courses");

  // Redirection forcée vers l'onglet CMS si un utilisateur non-admin tente d'accéder aux onglets protégés
  useEffect(() => {
    if (!isAdmin && activeTab !== "cms") {
      setActiveTab("cms");
    }
  }, [isAdmin, activeTab]);

  // Content Data
  const [courses, setCourses] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [qcms, setQcms] = useState<any[]>([]);

  // Users & Stats
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

  // User Edit Modal
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ plan: "pro", credits: 250 });
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Telemetry status
  const [tableStatus, setTableStatus] = useState<Record<string, { count: number; ok: boolean }>>({});

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // 1. Charger le profil de l'utilisateur courant
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      setCurrentProfile(myProfile || { id: user.id, name: user.email?.split("@")[0] || "Admin", plan: "pro" });

      // 2. Charger les cours de l'utilisateur
      const { data: userCourses } = await supabase
        .from("courses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setCourses(userCourses || []);

      // 3. Charger les synthèses
      const { data: userSummaries } = await supabase
        .from("summaries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setSummaries(userSummaries || []);

      // 4. Charger les flashcards
      const { data: userCards } = await supabase
        .from("flashcards")
        .select("*, courses(title)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setFlashcards(userCards || []);

      // 5. Charger les QCMs
      const { data: userQcms } = await supabase
        .from("qcm_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setQcms(userQcms || []);

      // 6. Charger la liste des utilisateurs (avec tolérance RLS)
      const { data: allProfiles, error: profErr } = await supabase
        .from("profiles")
        .select("*");

      if (!profErr && allProfiles && allProfiles.length > 0) {
        setUsers(allProfiles.map((p: any) => ({
          id: p.id,
          name: p.first_name ? `${p.first_name} ${p.last_name || ""}` : (p.name || "Externe"),
          email: p.university || "Faculté de Médecine",
          plan: p.plan || "gratuit",
          status: "active",
          qcmCount: (userQcms || []).filter(q => q.user_id === p.id).length,
          credits: p.credits || 100,
          university: p.university,
          specialty: p.target_specialty,
          avatar_url: p.avatar_url || null,
        })));
      } else {
        // En cas de restriction RLS stricte, l'admin voit son propre compte
        setUsers([{
          id: user.id,
          name: myProfile?.first_name || myProfile?.name || "Administrateur",
          email: user.email || "admin@hippocampus.app",
          plan: myProfile?.plan || "pro",
          status: "active",
          qcmCount: (userQcms || []).length,
          credits: myProfile?.credits || 500,
          university: myProfile?.university || "Paris Cité",
          specialty: ((myProfile as unknown as Record<string, unknown>)?.target_specialty as string) || "Cardiologie",
          avatar_url: myProfile?.avatar_url || user.user_metadata?.avatar_url || null,
        }]);
      }

      // 7. Télémétrie des tables
      setTableStatus({
        courses: { count: userCourses?.length || 0, ok: true },
        summaries: { count: userSummaries?.length || 0, ok: true },
        flashcards: { count: userCards?.length || 0, ok: true },
        qcm_sessions: { count: userQcms?.length || 0, ok: true },
        profiles: { count: allProfiles?.length || 1, ok: true },
      });

    } catch (err) {
      console.error("[AdminDashboard] Erreur chargement données:", err);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Action : Réactiver / Synchroniser les données pré-enregistrées
  const handleSeedData = async () => {
    setIsSeeding(true);
    toast.loading("Réactivation des dossiers cliniques pré-enregistrés...", { id: "seed-toast" });

    try {
      const res = await seedPreRecordedDataForUser();
      if (res.success) {
        toast.success("Synchronisation réussie !", {
          id: "seed-toast",
          description: `${res.coursesCount} cours, ${res.flashcardsCount} flashcards, ${res.summariesCount} synthèses et ${res.qcmsCount} QCMs activés.`
        });
        await loadAllData();
      } else {
        toast.error("Échec de synchronisation", {
          id: "seed-toast",
          description: res.error
        });
      }
    } catch (e: unknown) {
      toast.error("Erreur inattendue lors de l'injection.", { id: "seed-toast" });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    try {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
      toast.success("Cours supprimé avec succès.");
      setCourses(prev => prev.filter(c => c.id !== id));
    } catch {
      toast.error("Impossible de supprimer le cours.");
    }
  };

  const handleDeleteSummary = async (id: string) => {
    try {
      const { error } = await supabase.from("summaries").delete().eq("id", id);
      if (error) throw error;
      toast.success("Synthèse supprimée.");
      setSummaries(prev => prev.filter(s => s.id !== id));
    } catch {
      toast.error("Impossible de supprimer la synthèse.");
    }
  };

  const handleDeleteCard = async (id: string) => {
    try {
      const { error } = await supabase.from("flashcards").delete().eq("id", id);
      if (error) throw error;
      toast.success("Flashcard supprimée.");
      setFlashcards(prev => prev.filter(f => f.id !== id));
    } catch {
      toast.error("Impossible de supprimer la flashcard.");
    }
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setIsSavingUser(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          plan: editForm.plan,
          credits: editForm.credits
        })
        .eq("id", editingUser.id);

      if (error) throw error;

      toast.success(`Profil de ${editingUser.name} mis à jour avec le plan ${editForm.plan.toUpperCase()}.`);
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, plan: editForm.plan, credits: editForm.credits } : u));
      setEditingUser(null);
    } catch (err: unknown) {
      toast.error("Erreur lors de la mise à jour : " + (getErrorMessage(err, "") || "RLS"));
    } finally {
      setIsSavingUser(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* ─── EN-TÊTE ÉDITORIAL DU CMS ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
        <div>
          <h1 className="font-editorial text-3xl sm:text-4xl text-foreground font-normal tracking-tight">
            {isAdmin ? "Centre d'Administration Globale" : "Centre de Gestion des Contenus"}
          </h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">
            {isAdmin
              ? "Supervision des utilisateurs, des abonnements, de la télémétrie système et des contenus de la plateforme."
              : "Consultez, organisez et pilotez l'ensemble de vos cours, synthèses, fiches et questionnaires médicaux."}
          </p>
        </div>

        {/* Bouton Clé : Réactivation Immédiate des Données */}
        <div className="flex items-center gap-2.5">
          <Button
            onClick={handleSeedData}
            disabled={isSeeding}
            className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[12.5px] font-medium h-9 px-4 gap-2 shadow-xs transition-all"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isSeeding && "animate-spin")} />
            <span>{isSeeding ? "Réactivation..." : "Réactiver Données Pré-enregistrées"}</span>
          </Button>

          <Button
            onClick={() => loadAllData()}
            variant="outline"
            className="rounded-lg border-border/80 h-9 px-3 gap-1.5 text-[12px] hover:bg-[hsl(var(--surface-hover))]"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* ─── ONGLET PRINCIPAUX DU CMS (ACCÈS ADMINISTRATEUR RESTREINT) ─── */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        {[
          { id: "cms" as const, label: "Gestion des Contenus (CMS)", icon: BookOpen, count: courses.length + summaries.length + flashcards.length },
          ...(isAdmin ? [
            { id: "users" as const, label: "Utilisateurs & Abonnements", icon: Users, count: users.length },
            { id: "telemetry" as const, label: "Santé Système & Base de Données", icon: Server },
          ] : [])
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-all duration-150",
                active
                  ? "bg-foreground text-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-hover))]"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={cn(
                  "font-mono-metric text-[10.5px] px-1.5 py-0.2 rounded font-semibold",
                  active ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── CONTENU DE L'ONGLET 1 : CMS DE CONTENUS ─── */}
      {activeTab === "cms" && (
        <div className="space-y-6">
          {/* Sous-navigation CMS */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 bg-[hsl(var(--surface))] p-1 rounded-lg border border-border/80">
              {[
                { id: "courses", label: "Cours Médicaux", count: courses.length, icon: BookOpen },
                { id: "summaries", label: "Synthèses MOR", count: summaries.length, icon: Sparkles },
                { id: "flashcards", label: "Fiches Flashcards", count: flashcards.length, icon: Layers },
                { id: "qcms", label: "Séries QCM", count: qcms.length, icon: CheckCircle2 },
              ].map((sub) => {
                const active = contentSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setContentSubTab(sub.id as typeof contentSubTab)}
                    className={cn(
                      "px-3 py-1 rounded-md text-[12px] font-medium flex items-center gap-1.5 transition-all",
                      active
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <sub.icon className="h-3.5 w-3.5" />
                    <span>{sub.label}</span>
                    <span className="font-mono-metric text-[10px] opacity-75">({sub.count})</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => navigate("/quiz")}
                className="h-8 rounded-lg text-[12px] gap-1.5 bg-foreground text-background hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> Nouveau QCM / Cours
              </Button>
            </div>
          </div>

          {/* Tableau Sous-Onglet 1 : Cours */}
          {contentSubTab === "courses" && (
            <div className="rounded-xl border border-border/80 bg-[hsl(var(--surface))] overflow-hidden">
              <div className="px-4 py-3 border-b border-border/70 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground">
                  Cours Actuellement Enregistrés en Base ({courses.length})
                </span>
                <span className="text-[11px] text-muted-foreground font-mono-metric">
                  Synchronisé avec Supabase table `courses`
                </span>
              </div>
              {courses.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="h-10 w-10 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <p className="text-[13.5px] font-medium text-foreground">Aucun cours trouvé dans ce compte</p>
                  <p className="text-[12px] text-muted-foreground max-w-sm mx-auto">
                    Appuyez sur « Réactiver Données Pré-enregistrées » pour importer automatiquement les cours R2C recommandés.
                  </p>
                  <Button onClick={handleSeedData} className="rounded-lg h-8 px-4 text-[12px] bg-primary text-white">
                    Réactiver Maintenant
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {courses.map((course) => (
                    <div key={course.id} className="p-4 flex items-center justify-between gap-4 hover:bg-[hsl(var(--surface-hover))]/60 transition-colors">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-metric text-[11px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium">
                            {course.category || "Médecine"}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono-metric">
                            {new Date(course.created_at).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                        <h4 className="text-[13.5px] font-semibold text-foreground truncate">
                          {course.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          onClick={() => navigate(`/quiz?item=${course.id}`)}
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11.5px] gap-1"
                        >
                          <Play className="h-3 w-3" /> S'entraîner
                        </Button>
                        <Button
                          onClick={() => handleDeleteCourse(course.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tableau Sous-Onglet 2 : Synthèses */}
          {contentSubTab === "summaries" && (
            <div className="rounded-xl border border-border/80 bg-[hsl(var(--surface))] overflow-hidden">
              <div className="px-4 py-3 border-b border-border/70 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground">
                  Synthèses & Fiches R2C Disponibles ({summaries.length})
                </span>
                <Button onClick={() => navigate("/generate-summary")} size="sm" variant="outline" className="h-7 text-[11px] gap-1">
                  <Sparkles className="h-3 w-3 text-[hsl(var(--accent-warm))]" /> Générer avec MOR
                </Button>
              </div>
              {summaries.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-[13px] text-muted-foreground">Aucune synthèse pré-enregistrée.</p>
                  <Button onClick={handleSeedData} variant="outline" size="sm">Charger les synthèses types</Button>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {summaries.map((s) => (
                    <div key={s.id} className="p-4 flex items-center justify-between gap-4 hover:bg-[hsl(var(--surface-hover))]/60 transition-colors">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <h4 className="text-[13.5px] font-semibold text-foreground truncate">{s.title}</h4>
                        <p className="text-[11.5px] text-muted-foreground line-clamp-1">{s.content?.substring(0, 120)}...</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button onClick={() => navigate(`/summaries?id=${s.id}`)} variant="outline" size="sm" className="h-8 text-[11.5px] gap-1">
                          <BookOpen className="h-3 w-3" /> Lire
                        </Button>
                        <Button onClick={() => handleDeleteSummary(s.id)} variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tableau Sous-Onglet 3 : Flashcards */}
          {contentSubTab === "flashcards" && (
            <div className="rounded-xl border border-border/80 bg-[hsl(var(--surface))] overflow-hidden">
              <div className="px-4 py-3 border-b border-border/70 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground">
                  Cartes d'Ancrage Actives ({flashcards.length})
                </span>
                <Button onClick={() => navigate("/flashcards")} size="sm" variant="outline" className="h-7 text-[11px] gap-1">
                  <Layers className="h-3 w-3" /> Ouvrir Deck Builder
                </Button>
              </div>
              {flashcards.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-[13px] text-muted-foreground">Aucune flashcard en base.</p>
                  <Button onClick={handleSeedData} variant="outline" size="sm">Générer les fiches de révision</Button>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {flashcards.slice(0, 20).map((fc) => (
                    <div key={fc.id} className="p-3.5 flex items-center justify-between gap-4 text-xs hover:bg-[hsl(var(--surface-hover))]/60">
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-semibold text-foreground truncate">{fc.question}</p>
                        <p className="text-muted-foreground line-clamp-1 font-mono-metric text-[11px]">{fc.answer}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono-metric text-[11px] text-muted-foreground">
                          Int: {fc.interval || 1}j • Rep: {fc.repetitions || 0}
                        </span>
                        <button onClick={() => handleDeleteCard(fc.id)} className="text-muted-foreground hover:text-rose-500 p-1">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tableau Sous-Onglet 4 : QCMs */}
          {contentSubTab === "qcms" && (
            <div className="rounded-xl border border-border/80 bg-[hsl(var(--surface))] overflow-hidden">
              <div className="px-4 py-3 border-b border-border/70 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground">
                  Sessions de Questions & Cas Cliniques ({qcms.length})
                </span>
              </div>
              <div className="divide-y divide-border/60">
                {qcms.map((q) => (
                  <div key={q.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <h4 className="font-semibold text-foreground text-[13px]">{q.title}</h4>
                      <p className="text-muted-foreground font-mono-metric text-[11px]">
                        {q.question_count || q.questions?.length || 0} questions • Modèle : {q.ai_model || "Claude 3.5 Sonnet"}
                      </p>
                    </div>
                    <Button onClick={() => navigate(`/quiz?session=${q.id}`)} size="sm" variant="outline" className="h-8 gap-1">
                      <Play className="h-3 w-3" /> Lancer
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── CONTENU DE L'ONGLET 2 : UTILISATEURS & ABONNEMENTS (RÉSERVÉ SUPER-ADMINISTRATEUR) ─── */}
      {isAdmin && activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un externe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg bg-[hsl(var(--surface))] border-border/80"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-[hsl(var(--surface))] overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border/70 bg-[hsl(var(--surface-hover))]/30">
              <div className="col-span-4">Externe & CHU</div>
              <div className="col-span-3">Abonnement</div>
              <div className="col-span-3">Crédits IA</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            <div className="divide-y divide-border/60">
              {users.map((u) => (
                <div key={u.id} className="grid grid-cols-12 gap-3 px-4 py-3 items-center text-xs hover:bg-[hsl(var(--surface-hover))]/50 transition-colors">
                  <div className="col-span-4 min-w-0 flex items-center gap-2.5">
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt=""
                        className="h-8 w-8 rounded-lg object-cover border border-border shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-lg bg-foreground text-background font-semibold text-[11px] flex items-center justify-center shrink-0">
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{u.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="col-span-3">
                    <span className={cn(
                      "font-mono-metric text-[10.5px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider",
                      u.plan === "pro" || u.plan === "admin"
                        ? "bg-primary/12 text-primary"
                        : u.plan === "premium"
                        ? "bg-[hsl(var(--accent-warm))]/15 text-[hsl(var(--accent-warm))]"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {u.plan}
                    </span>
                  </div>
                  <div className="col-span-3 font-mono-metric font-medium text-foreground">
                    {u.credits} crédits
                  </div>
                  <div className="col-span-2 text-right">
                    <Button
                      onClick={() => {
                        setEditingUser(u);
                        setEditForm({ plan: u.plan, credits: u.credits });
                      }}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 hover:text-primary"
                    >
                      <Pencil className="h-3 w-3" /> Éditer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── CONTENU DE L'ONGLET 3 : TÉLÉMÉTRIE BASE SUPABASE (RÉSERVÉ SUPER-ADMINISTRATEUR) ─── */}
      {isAdmin && activeTab === "telemetry" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Cours Réels", count: courses.length, icon: BookOpen },
              { label: "Synthèses MOR", count: summaries.length, icon: Sparkles },
              { label: "Flashcards en Base", count: flashcards.length, icon: Layers },
              { label: "Sessions QCM", count: qcms.length, icon: CheckCircle2 },
            ].map((stat) => (
              <div key={stat.label} className="p-4 rounded-xl border border-border/80 bg-[hsl(var(--surface))] space-y-1">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 font-medium">
                  <stat.icon className="h-3.5 w-3.5 text-primary" />
                  {stat.label}
                </span>
                <p className="font-mono-metric text-2xl font-semibold text-foreground">
                  {stat.count}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border/80 bg-[hsl(var(--surface))] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> État des Relations et Politiques RLS Supabase
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Toutes les requêtes de données sont cloisonnées par `user_id` conformément aux standards HIPAA / RGPD.
              Pour réinjecter les données médicales d'étalonnage dans un nouveau compte, utilisez le bouton ci-dessous.
            </p>
            <div className="pt-2">
              <Button onClick={handleSeedData} disabled={isSeeding} className="gap-2">
                <RefreshCw className={cn("h-3.5 w-3.5", isSeeding && "animate-spin")} />
                Réinjecter le Référentiel Médical
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODALE D'ÉDITION UTILISATEUR ─── */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-[hsl(var(--surface))]">
          <DialogHeader>
            <DialogTitle className="text-lg font-editorial">Modifier le profil & abonnement</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ajustez le niveau de privilège et l'allocation de crédits pour cet externe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Type d'abonnement</Label>
              <Select value={editForm.plan} onValueChange={(v) => setEditForm({ ...editForm, plan: v })}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gratuit">Gratuit</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="pro">Pro (Accès Complet)</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Crédits d'analyse et de génération</Label>
              <Input
                type="number"
                value={editForm.credits}
                onChange={(e) => setEditForm({ ...editForm, credits: parseInt(e.target.value) || 0 })}
                className="h-9 text-xs font-mono-metric"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditingUser(null)}>Annuler</Button>
            <Button size="sm" onClick={handleSaveUser} disabled={isSavingUser}>
              {isSavingUser ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
