import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Users, Activity, Database, ShieldAlert, 
  Search, MoreVertical, Crown, Sparkles, 
  ArrowUpRight, Server, ShieldCheck, Mail, Ban, Pencil, RefreshCw
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AnimatedBanner } from "@/components/AnimatedBanner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// --- Types ---
interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: "gratuit" | "premium" | "pro";
  status: "active" | "suspended";
  lastActive: string;
  qcmCount: number;
  credits: number;
}

export const AdminDashboard = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "system">("users");
  const [stats, setStats] = useState({ totalUsers: 0, mrr: 0, premiumCount: 0, proCount: 0, generations: 0 });
  const [isLoading, setIsLoading] = useState(true);
  
  // States for editing
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ plan: "gratuit", credits: 100 });
  const [saving, setSaving] = useState(false);

  const fetchAdminData = async () => {
    setIsLoading(true);
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*');
    const { data: qcms } = await supabase.from('qcm_sessions').select('user_id');
    
    if (!profilesError && profiles) {
      let premium = 0;
      let pro = 0;
      
      const mappedUsers: AdminUser[] = profiles.map(p => {
        const userPlan = p.plan || "gratuit";
        if (userPlan === "premium") premium++;
        if (userPlan === "pro") pro++;
        
        return {
          id: p.id,
          name: p.name || p.first_name || "Utilisateur",
          email: p.university || "Non renseigné",
          plan: userPlan as any,
          status: "active",
          lastActive: "Récemment",
          qcmCount: qcms ? qcms.filter(q => q.user_id === p.id).length : 0,
          credits: p.credits || 100
        };
      });
      
      setUsers(mappedUsers);
      setStats({
        totalUsers: profiles.length,
        premiumCount: premium,
        proCount: pro,
        mrr: (premium * 5000) + (pro * 10000),
        generations: qcms ? qcms.length : 0
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAction = (action: string, user: AdminUser) => {
    if (action === "Modifier Plan") {
      setEditingUser(user);
      setEditForm({ plan: user.plan, credits: user.credits });
      return;
    }
    
    if (action === "Suspendre" || action === "Réactiver") {
      setUsers(users.map(u => u.id === user.id ? { ...u, status: action === "Suspendre" ? "suspended" : "active" } : u));
      toast.success(`Le statut de ${user.name} a été mis à jour.`);
      return;
    }
    
    toast.success(`Action "${action}" exécutée pour ${user.name}`);
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    
    const { error } = await supabase.from("profiles").update({
      plan: editForm.plan,
      credits: editForm.credits
    }).eq("id", editingUser.id);
    
    if (error) {
      const { error: rpcError } = await supabase.rpc("admin_update_profile" as any, {
        p_user_id: editingUser.id,
        p_plan: editForm.plan,
        p_credits: editForm.credits,
      });
      if (rpcError) {
        toast.error("Erreur de synchronisation.");
        setSaving(false);
        return;
      }
    }
    
    toast.success("Profil synchronisé avec la base de données !");
    setSaving(false);
    setEditingUser(null);
    fetchAdminData();
  };

  // --- Animations ---
  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } } };

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#0E0E0C] text-[#111111] dark:text-[#F4F4F2] bg-doodle-watermark font-sans pt-8 pb-24 w-full">
      
      {/* Scrollbar Éditoriale */}
      <style dangerouslySetInnerHTML={{__html: `
        .editorial-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .editorial-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .editorial-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .editorial-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.25); }
      `}} />

      <div className="max-w-[1500px] mx-auto px-6 space-y-10">
        
        {/* LA BANDEROLE ANIMÉE - Version Super Admin */}
        <AnimatedBanner 
          title="Centre de Commandement."
          subtitle="Supervision globale, gestion des étudiants et télémétrie de l'Agent MOR."
          rightWidgets={
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-inner">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Système Opérationnel</span>
              </div>
              <button className="h-12 px-6 rounded-full bg-white text-black font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-[#5B21B6] hover:text-white transition-all shadow-md">
                <Database className="h-4 w-4" /> Sauvegarde BDD
              </button>
            </div>
          }
        />

        {/* TABS DE NAVIGATION INTERNE */}
        <div className="flex border-b border-black/10 dark:border-white/10">
          <button 
            onClick={() => setActiveTab("users")}
            className={`pb-4 px-6 text-xs font-bold uppercase tracking-widest transition-colors relative ${activeTab === "users" ? "text-[#111111] dark:text-[#F4F4F2]" : "text-[#888888] hover:text-[#111111] dark:hover:text-[#F4F4F2]"}`}
          >
            Utilisateurs & Plans
            {activeTab === "users" && <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#111111] dark:bg-[#F4F4F2]" />}
          </button>
          <button 
            onClick={() => setActiveTab("system")}
            className={`pb-4 px-6 text-xs font-bold uppercase tracking-widest transition-colors relative ${activeTab === "system" ? "text-[#111111] dark:text-[#F4F4F2]" : "text-[#888888] hover:text-[#111111] dark:hover:text-[#F4F4F2]"}`}
          >
            Télémétrie Système
            {activeTab === "system" && <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#111111] dark:bg-[#F4F4F2]" />}
          </button>
        </div>

        {activeTab === "users" && (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-10">
            
            {/* --- LIGNE 1 : KPIs MONUMENTAUX --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* KPI 1 */}
              <motion.div variants={itemVariants} className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2rem] p-8 shadow-sm hover:shadow-md hover:border-[#111111] dark:hover:border-white/30 transition-all duration-300">
                <div className="flex justify-between items-start mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Étudiants Inscrits</span>
                  <div className="p-2 bg-[#FAFAF8] dark:bg-[#111110] rounded-xl border border-black/5 dark:border-white/5">
                    <Users className="h-4 w-4 text-[#111111]" />
                  </div>
                </div>
                <div className="flex items-end gap-3">
                  <span className="text-6xl font-light tracking-tighter text-[#111111]">{stats.totalUsers}</span>
                  <span className="text-sm font-bold text-emerald-500 mb-2 flex items-center gap-1"><ArrowUpRight className="h-4 w-4" /> 12%</span>
                </div>
              </motion.div>

              {/* KPI 2 */}
              <motion.div variants={itemVariants} className="bg-[#111111] border border-[#111111] rounded-[2rem] p-8 shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute -right-10 -top-10 opacity-5 group-hover:scale-110 transition-transform duration-700">
                  <Crown className="w-48 h-48 text-white" />
                </div>
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Revenu Récurrent (MRR)</span>
                </div>
                <div className="flex items-end gap-3 relative z-10">
                  <span className="text-6xl font-light tracking-tighter text-white">{stats.mrr.toLocaleString('fr-FR')} FCFA</span>
                  <span className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-1"><ArrowUpRight className="h-4 w-4" /> 5%</span>
                </div>
                <div className="mt-6 pt-4 border-t border-white/10 relative z-10 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/70">
                  <span>{stats.premiumCount} Premium</span>
                  <span>{stats.proCount} Pro</span>
                </div>
              </motion.div>

              {/* KPI 3 */}
              <motion.div variants={itemVariants} className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2rem] p-8 shadow-sm hover:shadow-md hover:border-[#5B21B6] transition-all duration-300">
                <div className="flex justify-between items-start mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">Générations IA (Mois)</span>
                  <div className="p-2 bg-[#5B21B6]/10 rounded-xl border border-[#5B21B6]/20">
                    <Sparkles className="h-4 w-4 text-[#5B21B6]" />
                  </div>
                </div>
                <div className="flex items-end gap-3">
                  <span className="text-6xl font-light tracking-tighter text-[#5B21B6]">{stats.generations}</span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mt-4">QCM & Résumés créés</p>
              </motion.div>
            </div>

            {/* --- LIGNE 2 : LE GRAND REGISTRE (Tableau des utilisateurs) --- */}
            <motion.div variants={itemVariants} className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2.5rem] shadow-sm flex flex-col overflow-hidden">
              
              {/* Header du Tableau & Filtres */}
              <div className="p-8 border-b border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-medium tracking-tight text-[#111111]">Registre des Étudiants</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] mt-1">Gérez les accès et les abonnements</p>
                </div>
                
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888888]" />
                  <input 
                    type="text" 
                    placeholder="Rechercher un médecin, un email..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#FAFAF8] dark:bg-[#111110] border border-black/10 dark:border-white/10 focus:border-[#5B21B6] rounded-full pl-11 pr-4 py-3 text-sm transition-all outline-none dark:text-[#F4F4F2] dark:placeholder:text-[#666]"
                  />
                </div>
              </div>

              {/* Le Tableau (Style Ledger Suisse) */}
              <div className="overflow-x-auto editorial-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-[#888888] bg-[#FAFAF8]/50 dark:bg-[#111110]/60 border-b border-black/5 dark:border-white/5">Utilisateur</th>
                      <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-[#888888] bg-[#FAFAF8]/50 dark:bg-[#111110]/60 border-b border-black/5 dark:border-white/5">Plan Actuel</th>
                      <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-[#888888] bg-[#FAFAF8]/50 dark:bg-[#111110]/60 border-b border-black/5 dark:border-white/5">Statut</th>
                      <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-[#888888] bg-[#FAFAF8]/50 dark:bg-[#111110]/60 border-b border-black/5 dark:border-white/5">Usage (QCM)</th>
                      <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-[#888888] bg-[#FAFAF8]/50 dark:bg-[#111110]/60 border-b border-black/5 dark:border-white/5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-[#FAFAF8] dark:hover:bg-[#111110] transition-colors group">
                        
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                              user.plan === "pro" ? "bg-amber-500" : user.plan === "premium" ? "bg-[#5B21B6]" : "bg-[#111111]"
                            }`}>
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#111111] dark:text-[#F4F4F2]">{user.name}</p>
                              <p className="text-xs text-[#666666] dark:text-[#999999]">{user.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-8 py-5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                            user.plan === "pro" ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400" :
                            user.plan === "premium" ? "bg-[#5B21B6]/10 border-[#5B21B6]/20 text-[#5B21B6]" :
                            "bg-[#FAFAF8] dark:bg-[#111110] border-black/10 dark:border-white/10 text-[#888888]"
                          }`}>
                            {user.plan === "pro" && <Crown className="h-3 w-3" />}
                            {user.plan === "premium" && <Sparkles className="h-3 w-3" />}
                            {user.plan}
                          </span>
                        </td>

                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${user.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                            <span className="text-xs font-bold text-[#111111] dark:text-[#F4F4F2]">
                              {user.status === "active" ? "Actif" : "Suspendu"}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#888888] mt-1">{user.lastActive}</p>
                        </td>

                        <td className="px-8 py-5 font-mono text-sm text-[#111111] dark:text-[#F4F4F2]">
                          {user.qcmCount}
                        </td>

                        <td className="px-8 py-5 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleAction("Contacter", user)} className="h-8 w-8 rounded-lg bg-white dark:bg-[#1E1E1C] border border-black/10 dark:border-white/10 flex items-center justify-center hover:border-[#111111] dark:hover:border-white/40 hover:text-[#111111] dark:hover:text-white text-[#888888] transition-colors" title="Envoyer un email">
                              <Mail className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleAction("Modifier Plan", user)} className="h-8 w-8 rounded-lg bg-white dark:bg-[#1E1E1C] border border-black/10 dark:border-white/10 flex items-center justify-center hover:border-[#5B21B6] hover:text-[#5B21B6] text-[#888888] transition-colors" title="Changer l'abonnement">
                              <Crown className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleAction(user.status === "active" ? "Suspendre" : "Réactiver", user)} className={`h-8 w-8 rounded-lg bg-white dark:bg-[#1E1E1C] border flex items-center justify-center transition-colors ${user.status === "active" ? "border-black/10 dark:border-white/10 text-[#888888] hover:border-red-500 hover:text-red-500" : "border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-white"}`} title={user.status === "active" ? "Suspendre le compte" : "Réactiver"}>
                              {user.status === "active" ? <Ban className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="p-12 text-center text-[#888888] text-sm font-medium">
                    Aucun étudiant trouvé correspondant à votre recherche.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* VUE SYSTÈME (Optionnelle, pour la démo) */}
        {activeTab === "system" && (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 rounded-[2.5rem] p-10 shadow-sm">
               <h3 className="text-xl font-medium tracking-tight text-[#111111] dark:text-[#F4F4F2] mb-6 flex items-center gap-3">
                 <Server className="h-5 w-5 text-[#5B21B6]" /> État des Serveurs
               </h3>
               <div className="space-y-6">
                 <div>
                   <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-[#888888] mb-2">
                     <span>Charge Base de données (Supabase)</span>
                     <span className="text-[#111111] dark:text-[#F4F4F2]">24%</span>
                   </div>
                   <div className="w-full h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                     <div className="w-[24%] h-full bg-[#111111] dark:bg-white" />
                   </div>
                 </div>
                 <div>
                   <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-[#888888] mb-2">
                     <span>Latence API Agent MOR</span>
                     <span className="text-emerald-500">42ms</span>
                   </div>
                   <div className="w-full h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                     <div className="w-[12%] h-full bg-emerald-500" />
                   </div>
                 </div>
               </div>
            </div>
          </motion.div>
        )}

      </div>
      
      {/* EDIT MODAL */}
      <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <DialogContent className="max-w-md rounded-[2rem] p-0 overflow-hidden border-black/10 dark:border-white/10 shadow-2xl bg-[#FAFAF8] dark:bg-[#161614]">
          <div className="bg-white dark:bg-[#1A1A18] px-6 py-5 border-b border-black/5 dark:border-white/5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl dark:text-white"><Pencil className="h-5 w-5 text-[#5B21B6]" /> 
Modifier l'utilisateur</DialogTitle>
              <DialogDescription className="dark:text-[#999999]">
                Synchronisation en temps réel avec Supabase.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-6 bg-white dark:bg-[#161614]">
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-widest text-[#888888]">Abonnement Actuel</Label>
              <Select value={editForm.plan} onValueChange={(v) => setEditForm({ ...editForm, plan: v })}>
                <SelectTrigger className="w-full h-12 rounded-xl bg-[#FAFAF8] dark:bg-[#111110] border-black/10 dark:border-white/10 focus:ring-[#5B21B6] dark:text-[#F4F4F2]">
                  <SelectValue placeholder="Sélectionner le plan" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-black/10 dark:border-white/10 bg-white dark:bg-[#161614] dark:text-[#F4F4F2]">
                  <SelectItem value="gratuit">Gratuit</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-widest text-[#888888]">Crédits (QCM / Résumés)</Label>
              <Input 
                type="number" 
                value={editForm.credits} 
                onChange={(e) => setEditForm({ ...editForm, credits: parseInt(e.target.value) || 0 })}
                className="w-full h-12 rounded-xl bg-[#FAFAF8] dark:bg-[#111110] border-black/10 dark:border-white/10 focus:border-[#5B21B6] focus:ring-1 focus:ring-[#5B21B6] transition-all dark:text-[#F4F4F2]"
              />
            </div>
          </div>
          
          <div className="p-6 bg-white dark:bg-[#161614] border-t border-black/5 dark:border-white/5 flex justify-end gap-3">
            <Button variant="outline" className="rounded-xl px-6 border-black/10 dark:border-white/10 hover:bg-[#FAFAF8] dark:hover:bg-[#111110] text-[#111111] dark:text-[#F4F4F2]" onClick={() => setEditingUser(null)}>Annuler</Button>
            <Button className="rounded-xl px-8 shadow-sm bg-[#111111] hover:bg-[#5B21B6] text-white transition-colors" onClick={saveEdit} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
              {saving ? "Synchro..." : "Sauvegarder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;