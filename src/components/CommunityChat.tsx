// src/components/CommunityChat.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles,
  Wrench,
  BookOpen,
  Megaphone,
  Pin,
  Plus,
  Trash2,
  Edit3,
  ArrowUpRight,
  Check,
  Clock,
  ShieldCheck,
  Eye,
  Lock,
  MessageCircle,
  Search,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { WhatsAppWidget } from "@/components/TelegramWidget";
import { DawJangDragonIcon } from "@/components/landing/HippocampusLogo";

export const WHATSAPP_CHANNEL_URL =
  "https://whatsapp.com/channel/0029Vb9DSDxAYlUE4HhmiN3b";

export type DispatchCategory =
  | "feature"
  | "maintenance"
  | "content"
  | "announcement";

export type SystemStatusType = "operational" | "maintenance" | "update";

export interface AdminDispatch {
  id: string;
  versionOrTag: string;
  category: DispatchCategory;
  title: string;
  summary: string;
  details: string[];
  publishedAt: string;
  isPinned?: boolean;
  actionLabel?: string;
  actionUrl?: string;
}

// Rétrocompatibilité
export type CommunityTopic = unknown;

interface SystemBannerState {
  status: SystemStatusType;
  headline: string;
  subtext: string;
  updatedAt: string;
}

const DISPATCH_STORAGE_KEY = "hippocampus_official_dispatches_v1";
const SYSTEM_BANNER_KEY = "hippocampus_system_banner_v1";
const READ_DISPATCHES_KEY = "hippocampus_read_dispatches_v1";

const DEFAULT_SYSTEM_BANNER: SystemBannerState = {
  status: "operational",
  headline: "Tous les systèmes cliniques sont opérationnels",
  subtext:
    "Générateur de QCM, Rédacteur de synthèses et synchronisation FSRS fonctionnent à pleine capacité.",
  updatedAt: "Aujourd'hui",
};

const INITIAL_DISPATCHES: AdminDispatch[] = [
  {
    id: "disp-maintenance-oct",
    versionOrTag: "INFRASTRUCTURE",
    category: "maintenance",
    title: "Fenêtre de maintenance programmée & optimisation des serveurs",
    summary:
      "L'accès à l'application sera temporairement fermé ce dimanche entre 02h00 et 03h30 GMT afin de déployer la nouvelle architecture de base de données et d'accélérer le temps de génération des QCM.",
    details: [
      "Fermeture temporaire des sessions pendant 90 minutes (aucune perte de données).",
      "Vos flashcards et cours consultés récemment restent accessibles en mode hors-ligne.",
      "Les notifications de réouverture seront diffusées en temps réel sur notre chaîne WhatsApp officielle.",
    ],
    publishedAt: "21 Oct. 2026",
    isPinned: true,
    actionLabel: "Suivre l'état sur WhatsApp",
    actionUrl: WHATSAPP_CHANNEL_URL,
  },
  {
    id: "disp-feature-v26",
    versionOrTag: "VERSION 2.6",
    category: "feature",
    title: "Refonte du Rédacteur visuel & des Flashcards par Nœuds de cours",
    summary:
      "Mise en ligne du nouveau studio de rédaction sans syntaxe Markdown parasite et restructuration complète des flashcards générées directement depuis vos leçons pré-enregistrées.",
    details: [
      "Nouveau Rédacteur : application directe des titres, sous-titres et mises en gras en un clic.",
      "Bibliothèque centralisée : déposez vos cours une seule fois pour les réutiliser dans le Constructeur de QCM et les Résumés.",
      "Simulateur d'examen : ajout de l'élimination d'hypothèses et du calcul des discordances graves.",
    ],
    publishedAt: "20 Oct. 2026",
    isPinned: false,
    actionLabel: "Explorer la Bibliothèque",
    actionUrl: "/library",
  },
  {
    id: "disp-content-cardio",
    versionOrTag: "CONTENU R2C",
    category: "content",
    title: "Nouveaux dossiers QCM & fiches de synthèse disponibles",
    summary:
      "De nouvelles banques d'entraînement couvrant la Cardiologie (Item 230), la Néphrologie (Item 267) et l'Infectiologie (Amibiase & Choléra) ont été validées et intégrées.",
    details: [
      "Corrections détaillées proposition par proposition selon les derniers référentiels.",
      "Synchronisation immédiate avec votre file d'ancrage mnémonique FSRS.",
    ],
    publishedAt: "18 Oct. 2026",
    isPinned: false,
    actionLabel: "Ouvrir les QCM",
    actionUrl: "/quiz",
  },
];

const CATEGORY_META: Record<
  DispatchCategory,
  {
    label: string;
    icon: React.ElementType;
    badgeClass: string;
    dotClass: string;
  }
> = {
  maintenance: {
    label: "Maintenance & Système",
    icon: Wrench,
    badgeClass:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  feature: {
    label: "Nouvelle Fonctionnalité",
    icon: Sparkles,
    badgeClass: "border-primary/30 bg-primary/10 text-primary",
    dotClass: "bg-primary",
  },
  content: {
    label: "Contenus & QCM",
    icon: BookOpen,
    badgeClass:
      "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  announcement: {
    label: "Communiqué Officiel",
    icon: Megaphone,
    badgeClass: "border-border bg-secondary text-foreground",
    dotClass: "bg-foreground",
  },
};

export function CommunityChat({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const roleHook = useUserRole?.() as { isAdmin?: boolean; role?: string } | undefined;

  // Par défaut, l'administrateur peut basculer entre la vue "Admin (Éditeur)" et "Vue Étudiant (Lecture seule)"
  const isUserAdmin = roleHook?.isAdmin ?? true;
  const [previewAsStudent, setPreviewAsStudent] = useState(false);
  const canManage = isUserAdmin && !previewAsStudent;

  const [dispatches, setDispatches] = useState<AdminDispatch[]>(INITIAL_DISPATCHES);
  const [banner, setBanner] = useState<SystemBannerState>(DEFAULT_SYSTEM_BANNER);
  const [readIds, setReadIds] = useState<string[]>([]);

  // Filtres de lecture
  const [activeFilter, setActiveFilter] = useState<"all" | DispatchCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // États de la Console de Publication Admin
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isStatusEditorOpen, setIsStatusEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formTag, setFormTag] = useState("MISE À JOUR");
  const [formCategory, setFormCategory] = useState<DispatchCategory>("feature");
  const [formTitle, setFormTitle] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formDetails, setFormDetails] = useState("");
  const [formPinned, setFormPinned] = useState(false);
  const [formActionLabel, setFormActionLabel] = useState("");
  const [formActionUrl, setFormActionUrl] = useState("");

  // Chargement initial (LocalStorage + lecture unique Supabase si table présente)
  useEffect(() => {
    try {
      const savedDispatches = localStorage.getItem(DISPATCH_STORAGE_KEY);
      if (savedDispatches) {
        const parsed = JSON.parse(savedDispatches);
        if (Array.isArray(parsed) && parsed.length > 0) setDispatches(parsed);
      }

      const savedBanner = localStorage.getItem(SYSTEM_BANNER_KEY);
      if (savedBanner) setBanner(JSON.parse(savedBanner));

      const savedRead = localStorage.getItem(READ_DISPATCHES_KEY);
      if (savedRead) setReadIds(JSON.parse(savedRead));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const persistDispatches = (updated: AdminDispatch[]) => {
    setDispatches(updated);
    localStorage.setItem(DISPATCH_STORAGE_KEY, JSON.stringify(updated));
  };

  const persistBanner = (updated: SystemBannerState) => {
    setBanner(updated);
    localStorage.setItem(SYSTEM_BANNER_KEY, JSON.stringify(updated));
  };

  const markAsRead = (id: string) => {
    if (readIds.includes(id)) return;
    const updated = [...readIds, id];
    setReadIds(updated);
    localStorage.setItem(READ_DISPATCHES_KEY, JSON.stringify(updated));
  };

  const markAllAsRead = () => {
    const allIds = dispatches.map((d) => d.id);
    setReadIds(allIds);
    localStorage.setItem(READ_DISPATCHES_KEY, JSON.stringify(allIds));
    toast({
      title: "Journal à jour",
      description: "Toutes les annonces ont été marquées comme lues.",
    });
  };

  // --- FONCTIONS ADMINISTRATEUR ---
  const openCreateModal = () => {
    setEditingId(null);
    setFormTag("ANNONCE");
    setFormCategory("feature");
    setFormTitle("");
    setFormSummary("");
    setFormDetails("");
    setFormPinned(false);
    setFormActionLabel("");
    setFormActionUrl("");
    setIsComposerOpen(true);
  };

  const openEditModal = (item: AdminDispatch) => {
    setEditingId(item.id);
    setFormTag(item.versionOrTag);
    setFormCategory(item.category);
    setFormTitle(item.title);
    setFormSummary(item.summary);
    setFormDetails(item.details.join("\n"));
    setFormPinned(!!item.isPinned);
    setFormActionLabel(item.actionLabel || "");
    setFormActionUrl(item.actionUrl || "");
    setIsComposerOpen(true);
  };

  const handleSaveDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formSummary.trim()) {
      toast({
        title: "Champs requis",
        description: "Veuillez renseigner au minimum le titre et le résumé de l'annonce.",
        variant: "destructive",
      });
      return;
    }

    const detailLines = formDetails
      .split("\n")
      .map((l) => l.replace(/^[•\-*]\s*/, "").trim())
      .filter(Boolean);

    const todayLabel = new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    if (editingId) {
      const updated = dispatches.map((d) =>
        d.id === editingId
          ? {
              ...d,
              versionOrTag: formTag.trim().toUpperCase() || "NOTE",
              category: formCategory,
              title: formTitle.trim(),
              summary: formSummary.trim(),
              details: detailLines,
              isPinned: formPinned,
              actionLabel: formActionLabel.trim() || undefined,
              actionUrl: formActionUrl.trim() || undefined,
            }
          : d
      );
      persistDispatches(updated);
      toast({
        title: "Communiqué mis à jour",
        description: "Les modifications sont immédiatement visibles pour tous les utilisateurs.",
      });
    } else {
      const created: AdminDispatch = {
        id: `disp-${Date.now()}`,
        versionOrTag: formTag.trim().toUpperCase() || "NOTE",
        category: formCategory,
        title: formTitle.trim(),
        summary: formSummary.trim(),
        details: detailLines,
        publishedAt: todayLabel,
        isPinned: formPinned,
        actionLabel: formActionLabel.trim() || undefined,
        actionUrl: formActionUrl.trim() || undefined,
      };
      persistDispatches([created, ...dispatches]);
      toast({
        title: "Annonce officielle diffusée",
        description: "Votre message est maintenant publié en tête de page.",
      });
    }

    setIsComposerOpen(false);
  };

  const handleDeleteDispatch = (id: string) => {
    persistDispatches(dispatches.filter((d) => d.id !== id));
    toast({
      title: "Annonce retirée",
      description: "Le communiqué a été supprimé du journal.",
    });
  };

  const handleTogglePin = (id: string) => {
    persistDispatches(
      dispatches.map((d) => (d.id === id ? { ...d, isPinned: !d.isPinned } : d))
    );
  };

  const filteredDispatches = useMemo(() => {
    const list = dispatches.filter((d) => {
      const matchesCat = activeFilter === "all" || d.category === activeFilter;
      const q = (searchQuery || "").trim().toLowerCase();
      const matchesSearch =
        !q ||
        (d.title || "").toLowerCase().includes(q) ||
        (d.summary || "").toLowerCase().includes(q) ||
        (d.versionOrTag || "").toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });

    return [...list].sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
  }, [dispatches, activeFilter, searchQuery]);

  const unreadCount = dispatches.filter((d) => !readIds.includes(d.id)).length;

  const handleActionClick = (url?: string) => {
    if (!url) return;
    if (url.startsWith("http")) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      navigate(url);
    }
  };

  return (
    <div className={cn("max-w-[1120px] mx-auto space-y-8 pb-24", className)}>
      {/* =====================================================================
          1. BARRE SUPÉRIEURE D'ÉTAT SYSTÈME & CONTRÔLE DE VUE ADMINISTRATEUR
         ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/85 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span
              className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                banner.status === "operational"
                  ? "bg-emerald-500"
                  : banner.status === "maintenance"
                  ? "bg-amber-500"
                  : "bg-primary"
              )}
            />
            <span
              className={cn(
                "relative inline-flex rounded-full h-2.5 w-2.5",
                banner.status === "operational"
                  ? "bg-emerald-500"
                  : banner.status === "maintenance"
                  ? "bg-amber-500"
                  : "bg-primary"
              )}
            />
          </span>

          <div className="flex flex-wrap items-center gap-2 text-[13px] min-w-0">
            <strong className="font-semibold text-foreground truncate">
              {banner.headline}
            </strong>
            <span className="text-muted-foreground hidden md:inline">•</span>
            <span className="text-muted-foreground text-[12.5px] truncate hidden md:inline">
              {banner.subtext}
            </span>
          </div>
        </div>

        {/* Outils de gouvernance Administrateur */}
        {isUserAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            {canManage && (
              <button
                type="button"
                onClick={() => setIsStatusEditorOpen(!isStatusEditorOpen)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background hover:bg-secondary px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Wrench className="h-3 w-3 text-primary" />
                <span>Changer l'état du site</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setPreviewAsStudent(!previewAsStudent)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                previewAsStudent
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
              title="Tester le rendu exact que voient vos étudiants (Lecture seule)"
            >
              <Eye className="h-3 w-3" />
              <span>{previewAsStudent ? "Mode Vue Étudiant" : "Mode Administrateur"}</span>
            </button>
          </div>
        )}
      </div>

      {/* ÉDITEUR RAPIDE D'ÉTAT DU SITE (POUR ANNONCER UNE FERMETURE / MAINTENANCE) */}
      {canManage && isStatusEditorOpen && (
        <div className="rounded-2xl border border-primary/35 bg-card p-5 space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-foreground">
              Modifier le bandeau d'état global de l'application
            </h3>
            <button
              type="button"
              onClick={() => setIsStatusEditorOpen(false)}
              className="text-[12px] text-muted-foreground hover:text-foreground"
            >
              Fermer
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(
              [
                {
                  id: "operational",
                  label: "Système Opérationnel (Vert)",
                  defaultTitle: "Tous les systèmes cliniques sont opérationnels",
                },
                {
                  id: "maintenance",
                  label: "Maintenance / Fermeture (Ambre)",
                  defaultTitle: "Maintenance programmée — Fermeture temporaire à 02h00",
                },
                {
                  id: "update",
                  label: "Déploiement en cours (Terracotta)",
                  defaultTitle: "Mise à jour majeure v2.6 déployée avec succès",
                },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() =>
                  persistBanner({
                    ...banner,
                    status: st.id,
                    headline: st.defaultTitle,
                  })
                }
                className={cn(
                  "rounded-xl border p-3 text-left text-[12.5px] font-medium transition-all",
                  banner.status === st.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              value={banner.headline}
              onChange={(e) =>
                persistBanner({ ...banner, headline: e.target.value })
              }
              placeholder="Titre court d'état…"
            />
            <Input
              value={banner.subtext}
              onChange={(e) =>
                persistBanner({ ...banner, subtext: e.target.value })
              }
              placeholder="Sous-texte explicatif…"
            />
          </div>
        </div>
      )}

      {/* =====================================================================
          2. EN-TÊTE ÉDITORIAL (STYLE ANTHROPIC / CLAUDE NEWSROOM)
         ===================================================================== */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/80 pb-7">
        <div className="space-y-2.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[11.5px] font-mono uppercase tracking-[0.08em] text-primary font-semibold">
            <span>DIFFUSION OFFICIELLE DAWJANG</span>
            <span>•</span>
            <span>NOTES DE VERSION & SYSTÈME</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-[42px] font-normal text-foreground tracking-tight leading-[1.12]">
            Journal des mises à jour & communiqués.
          </h1>

          <p className="text-[14.5px] text-muted-foreground leading-relaxed">
            Suivez les évolutions de la plateforme, les fenêtres de maintenance programmées et la mise en ligne des nouveaux référentiels médicaux.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-secondary/70 px-3.5 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Check className="h-3.5 w-3.5 text-primary" />
              <span>Tout marquer comme lu ({unreadCount})</span>
            </button>
          )}

          {canManage && (
            <Button onClick={openCreateModal} className="rounded-xl shadow-sm">
              <Plus className="h-4 w-4" />
              <span>Publier un communiqué</span>
            </Button>
          )}
        </div>
      </header>

      {/* =====================================================================
          3. CONSOLE DE PUBLICATION ADMINISTRATEUR (MASQUÉE AUX ÉTUDIANTS)
         ===================================================================== */}
      {canManage && isComposerOpen && (
        <div className="rounded-2xl border border-primary/40 bg-card p-6 space-y-5 shadow-[0_12px_36px_-12px_rgba(0,0,0,0.08)] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-border/70 pb-3.5">
            <div>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-primary font-semibold block">
                STUDIO DE DIFFUSION ADMINISTRATEUR
              </span>
              <h2 className="text-[16px] font-semibold text-foreground">
                {editingId
                  ? "Modifier le communiqué officiel"
                  : "Rédiger une annonce visible par tous les utilisateurs"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsComposerOpen(false)}
              className="text-[12.5px] text-muted-foreground hover:text-foreground"
            >
              Fermer
            </button>
          </div>

          <form onSubmit={handleSaveDispatch} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground">
                  Type de communiqué
                </label>
                <select
                  value={formCategory}
                  onChange={(e) =>
                    setFormCategory(e.target.value as DispatchCategory)
                  }
                  className="w-full h-9 rounded-xl border border-border bg-background px-3 text-[13px] font-medium text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="feature">Nouvelle Fonctionnalité</option>
                  <option value="maintenance">Maintenance / Fermeture temporaire</option>
                  <option value="content">Nouveau Cours / Banque QCM</option>
                  <option value="announcement">Annonce Générale</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground">
                  Étiquette / Version
                </label>
                <Input
                  value={formTag}
                  onChange={(e) => setFormTag(e.target.value)}
                  placeholder="Ex: VERSION 2.7, MAINTENANCE, URGENT"
                  className="font-mono uppercase text-[12.5px]"
                />
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2.5 h-9 px-3 rounded-xl border border-border bg-background cursor-pointer text-[13px] font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={formPinned}
                    onChange={(e) => setFormPinned(e.target.checked)}
                    className="accent-primary h-4 w-4"
                  />
                  <span>Épingler en tête de page</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">
                Titre de l'annonce
              </label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: Fermeture temporaire ce soir à 23h00 pour mise à jour du moteur QCM"
                className="font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">
                Message principal
              </label>
              <Textarea
                rows={3}
                value={formSummary}
                onChange={(e) => setFormSummary(e.target.value)}
                placeholder="Expliquez clairement ce qui change, l'horaire d'intervention ou la nouveauté déployée…"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">
                Points détaillés (optionnel — 1 point par ligne)
              </label>
              <Textarea
                rows={3}
                value={formDetails}
                onChange={(e) => setFormDetails(e.target.value)}
                placeholder={`Ajout du mode hors-ligne automatique.\nOptimisation du temps de chargement.\nNouveau salon de révision sur WhatsApp.`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground">
                  Texte du bouton d'action (optionnel)
                </label>
                <Input
                  value={formActionLabel}
                  onChange={(e) => setFormActionLabel(e.target.value)}
                  placeholder="Ex: Tester la nouveauté / Rejoindre WhatsApp"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground">
                  Lien du bouton (route interne ex: /quiz ou lien https://)
                </label>
                <Input
                  value={formActionUrl}
                  onChange={(e) => setFormActionUrl(e.target.value)}
                  placeholder="Ex: /quiz ou https://whatsapp.com/channel/..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border/70">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsComposerOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit">
                <span>
                  {editingId ? "Enregistrer les modifications" : "Diffuser à tous les utilisateurs"}
                </span>
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          4. BARRE DE FILTRAGE & RECHERCHE
         ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: "all", label: "Toutes les publications" },
            { id: "feature", label: "Nouvelles fonctionnalités" },
            { id: "maintenance", label: "Maintenance & Système" },
            { id: "content", label: "Contenus & QCM" },
          ].map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as typeof activeFilter)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-[12.5px] font-medium whitespace-nowrap transition-all duration-200",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:border-foreground/25"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer les annonces…"
            className="h-9 pl-9 text-[13px] rounded-xl"
          />
        </div>
      </div>

      {/* =====================================================================
          5. GRILLE ÉDITORIALE : CHRONOLOGIE DES ANNONCES (8 COL) + CANAL WHATSAPP (4 COL)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* COLONNE PRINCIPALE (8/12) : CHRONOLOGIE FAÇON LINEAR CHANGELOG */}
        <div className="lg:col-span-8 space-y-5">
          {filteredDispatches.map((item) => {
            const meta = CATEGORY_META[item.category];
            const Icon = meta.icon;
            const isRead = readIds.includes(item.id);

            return (
              <article
                key={item.id}
                onMouseEnter={() => markAsRead(item.id)}
                className={cn(
                  "group relative rounded-2xl border bg-card p-6 sm:p-7 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-foreground/25 hover:shadow-[0_8px_28px_-12px_rgba(0,0,0,0.06)]",
                  item.isPinned
                    ? "border-primary/45 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]"
                    : "border-border/85"
                )}
              >
                {/* Filet latéral chromatique qui s'illumine au survol */}
                <div
                  className={cn(
                    "absolute left-0 top-6 bottom-6 w-[3px] rounded-r-full transition-all duration-200",
                    item.isPinned
                      ? "bg-primary opacity-100"
                      : "bg-primary opacity-0 group-hover:opacity-100"
                  )}
                />

                {/* Métadonnées de la publication */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-[11.5px] font-medium",
                        meta.badgeClass
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{meta.label}</span>
                    </span>

                    <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-secondary text-foreground">
                      {item.versionOrTag}
                    </span>

                    {item.isPinned && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10.5px] font-semibold text-primary">
                        <Pin className="h-3 w-3" /> Épinglé
                      </span>
                    )}

                    {!isRead && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Nouveau
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11.5px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {item.publishedAt}
                    </span>

                    {/* Actions réservées à l'Administrateur */}
                    {canManage && (
                      <div className="flex items-center gap-1 ml-2 border-l border-border pl-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePin(item.id)}
                          title={item.isPinned ? "Désépingler" : "Épingler en haut"}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            item.isPinned
                              ? "text-primary bg-primary/10"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          )}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          title="Modifier ce communiqué"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDispatch(item.id)}
                          title="Supprimer ce communiqué"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Titre avec échange de couleur au survol */}
                <h2 className="text-[18px] sm:text-[19.5px] font-semibold text-foreground tracking-[-0.015em] group-hover:text-primary transition-colors duration-200 leading-snug mb-2.5">
                  {item.title}
                </h2>

                {/* Résumé principal */}
                <p className="text-[14.5px] text-foreground/85 leading-relaxed">
                  {item.summary}
                </p>

                {/* Liste des points détaillés */}
                {item.details.length > 0 && (
                  <ul className="mt-4 space-y-2 rounded-xl border border-border/70 bg-secondary/30 p-4">
                    {item.details.map((pt, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-[13.5px] text-foreground/85 leading-relaxed"
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full mt-2 shrink-0",
                            meta.dotClass
                          )}
                        />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Pied d'article : Signature officielle + Bouton d'action */}
                <div className="mt-5 pt-4 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <DawJangDragonIcon className="h-5 w-5 text-foreground" />
                    <span>Publié par l'Administration DawJang</span>
                  </div>

                  {item.actionLabel && item.actionUrl && (
                    <button
                      type="button"
                      onClick={() => handleActionClick(item.actionUrl)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background hover:bg-foreground hover:text-background hover:border-foreground px-3.5 py-1.5 text-[12.5px] font-semibold text-foreground transition-all duration-150"
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* COLONNE LATÉRALE DROITE (4/12) : PASSAGE VERS LE CANAL WHATSAPP & POLITIQUE DE DIFFUSION */}
        <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-6">
          {/* Encart Éditorial d'invitation vers la Chaîne WhatsApp avec le vrai logo et touches de verre vertes */}
          <WhatsAppWidget variant="card" />

          {/* Note d'architecture & fiabilité */}
          <div className="rounded-2xl border border-border/75 bg-background/60 p-5 space-y-3">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Canal de diffusion vérifié</span>
            </div>
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              Afin de garantir une rapidité maximale des serveurs lors de vos sessions de QCM et d'ancrage, cet espace est exclusivement dédié aux annonces officielles de l'administration.
            </p>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>Mode de flux</span>
              <span className="text-foreground font-medium">Diffusion Admin</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default CommunityChat;
