import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  BookOpen,
  Layers,
  CheckCircle2,
  Sparkles,
  Calendar,
  Swords,
  BarChart3,
  ArrowRight,
  CornerDownLeft,
  FileText,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  category: "Items R2C & Cours" | "Actions Rapides MOR" | "Navigation";
  code?: string;
  title: string;
  subtitle?: string;
  url: string;
  icon: React.ElementType;
  shortcut?: string;
  isAccent?: boolean;
}

const COMMAND_ITEMS: CommandItem[] = [
  // Items R2C & Cours
  {
    id: "item-230",
    category: "Items R2C & Cours",
    code: "ITEM 230",
    title: "Douleur thoracique aiguë et chronique",
    subtitle: "Cardiologie • 14 Rang A, 6 Rang B",
    url: "/summaries?item=230",
    icon: BookOpen,
  },
  {
    id: "item-267",
    category: "Items R2C & Cours",
    code: "ITEM 267",
    title: "Troubles de l'équilibre acido-basique et désordres hydro-électrolytiques",
    subtitle: "Néphrologie • Rétention actuelle : 58%",
    url: "/summaries?item=267",
    icon: BookOpen,
  },
  {
    id: "item-345",
    category: "Items R2C & Cours",
    code: "ITEM 345",
    title: "Malaise, perte de connaissance, crise comitiale chez l'adulte",
    subtitle: "Neurologie • 12 cartes à réviser",
    url: "/flashcards?item=345",
    icon: Layers,
  },
  {
    id: "item-199",
    category: "Items R2C & Cours",
    code: "ITEM 199",
    title: "Dyspnée aiguë et chronique",
    subtitle: "Pneumologie • Maîtrisé (88%)",
    url: "/summaries?item=199",
    icon: FileText,
  },

  // Actions Rapides MOR
  {
    id: "mor-synth",
    category: "Actions Rapides MOR",
    title: "Générer une fiche de synthèse R2C depuis un PDF",
    subtitle: "Extraction automatique Rang A / Rang B",
    url: "/summaries",
    icon: Sparkles,
    isAccent: true,
  },
  {
    id: "mor-qcm",
    category: "Actions Rapides MOR",
    title: "Lancer un Dossier Progressif ciblé sur mes points faibles",
    subtitle: "Néphrologie & Cardiologie (15 QCM)",
    url: "/quiz",
    icon: CheckCircle2,
  },
  {
    id: "mor-ank",
    category: "Actions Rapides MOR",
    title: "Démarrer la file d'ancrage FSRS du jour",
    subtitle: "54 cartes en attente • ~22 min",
    url: "/flashcards",
    icon: Layers,
  },

  // Navigation
  {
    id: "nav-dash",
    category: "Navigation",
    title: "Vue d'ensemble (Dashboard)",
    url: "/dashboard",
    icon: Command,
    shortcut: "G D",
  },
  {
    id: "nav-plan",
    category: "Navigation",
    title: "Planification & Charge FSRS",
    url: "/planning",
    icon: Calendar,
    shortcut: "G P",
  },
  {
    id: "nav-duels",
    category: "Navigation",
    title: "Confrontations Cliniques (Duels ELO)",
    url: "/duels",
    icon: Swords,
    shortcut: "G C",
  },
  {
    id: "nav-stats",
    category: "Navigation",
    title: "Analytique & Courbes de Rétention",
    url: "/stats",
    icon: BarChart3,
    shortcut: "G S",
  },
  {
    id: "nav-admin",
    category: "Navigation",
    title: "CMS & Centre d'Administration",
    subtitle: "Gestion des contenus, cours, utilisateurs et réactivation",
    url: "/admin",
    icon: Command,
    shortcut: "G A",
    isAccent: true,
  },
  {
    id: "mor-add-course",
    category: "Actions Rapides MOR",
    title: "Générer un QCM par IA ou importer",
    subtitle: "Importer un support PDF ou créer un item R2C",
    url: "/qcm",
    icon: Sparkles,
  },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Filtrage instantané
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMAND_ITEMS;
    return COMMAND_ITEMS.filter(
      (item) =>
        (item.title || "").toLowerCase().includes(q) ||
        item.code?.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q)
    );
  }, [query]);

  // Regroupement par catégorie pour l'affichage
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredItems.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Écoute globale du raccourci ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Focus automatique à l'ouverture
  useEffect(() => {
    if (open) {
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQuery("");
    }
  }, [open]);

  // Navigation clavier dans la liste
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (filteredItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredItems[selectedIndex];
      if (target) {
        setOpen(false);
        navigate(target.url);
      }
    }
  };

  const handleSelect = (item: CommandItem) => {
    setOpen(false);
    navigate(item.url);
  };

  let runningIndex = -1;

  return (
    <>
      {/* Déclencheur discret dans la Sidebar / Topbar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full flex items-center justify-between gap-2 rounded-xl border border-[#DAD0BE] dark:border-stone-800 bg-[#FBF9F4] dark:bg-stone-900/80 hover:bg-white dark:hover:bg-stone-900 hover:border-[#D96B43]/60 px-3 py-1.5 text-[12px] text-muted-foreground transition-all duration-150 shadow-2xs"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/75 group-hover:text-[#D96B43] transition-colors" />
          <span className="truncate group-hover:text-foreground transition-colors">
            Recherche rapide…
          </span>
        </span>
        <kbd className="kbd-badge shrink-0 group-hover:border-foreground/25">⌘K</kbd>
      </button>

      {/* Modale Command Palette (Style Linear / Raycast) */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
          {/* Backdrop sobre avec flou optique */}
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-foreground/20 dark:bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-150"
          />

          {/* Boîte de dialogue */}
          <div className="relative z-10 w-full max-w-[620px] rounded-2xl border border-border bg-[hsl(var(--surface))] shadow-[0_16px_48px_-12px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.65)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Barre de saisie supérieure */}
            <div className="flex items-center gap-3 border-b border-border/80 px-4 py-3.5">
              <Search className="h-4 w-4 shrink-0 text-primary" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Rechercher un item (ex: 230), une pathologie, ou lancer une action…"
                className="w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded"
                >
                  Effacer
                </button>
              )}
              <kbd className="kbd-badge shrink-0">ESC</kbd>
            </div>

            {/* Liste des résultats */}
            <div className="max-h-[380px] overflow-y-auto p-2 space-y-3">
              {filteredItems.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-2">
                  <p className="text-[13.5px] font-medium text-foreground">
                    Aucun item trouvé pour « {query} »
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    Appuyez sur Entrée pour demander une synthèse directe à l'assistant MOR.
                  </p>
                </div>
              ) : (
                Object.entries(groupedItems).map(([category, items]) => (
                  <div key={category} className="space-y-1">
                    <div className="px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.07em] text-muted-foreground/70 select-none">
                      {category}
                    </div>
                    {items.map((item) => {
                      runningIndex += 1;
                      const currentIdx = runningIndex;
                      const isSelected = currentIdx === selectedIndex;
                      const Icon = item.icon;

                      return (
                        <div
                          key={item.id}
                          onMouseEnter={() => setSelectedIndex(currentIdx)}
                          onClick={() => handleSelect(item)}
                          className={cn(
                            "group relative flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-150",
                            isSelected
                              ? "bg-foreground/[0.05] dark:bg-foreground/[0.08]"
                              : "hover:bg-foreground/[0.03]"
                          )}
                        >
                          {/* Indicateur latéral d'élément actif */}
                          <span
                            className={cn(
                              "absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] rounded-r-full transition-all duration-150",
                              isSelected
                                ? item.isAccent
                                  ? "h-5 bg-[hsl(var(--accent-warm))] opacity-100"
                                  : "h-5 bg-primary opacity-100"
                                : "h-0 opacity-0"
                            )}
                          />

                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150",
                                isSelected
                                  ? item.isAccent
                                    ? "border-[hsl(var(--accent-warm))]/30 bg-[hsl(var(--accent-warm))]/10 text-[hsl(var(--accent-warm))]"
                                    : "border-primary/30 bg-primary/10 text-primary"
                                  : "border-border/70 bg-background text-muted-foreground"
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {item.code && (
                                  <span
                                    className={cn(
                                      "font-mono-metric text-[11px] font-semibold transition-colors",
                                      isSelected ? "text-primary" : "text-muted-foreground"
                                    )}
                                  >
                                    {item.code}
                                  </span>
                                )}
                                <span
                                  className={cn(
                                    "text-[13.5px] truncate transition-colors",
                                    isSelected
                                      ? "font-medium text-foreground"
                                      : "text-foreground/80"
                                  )}
                                >
                                  {item.title}
                                </span>
                              </div>
                              {item.subtitle && (
                                <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {item.shortcut && (
                              <kbd className="kbd-badge">{item.shortcut}</kbd>
                            )}
                            <ArrowRight
                              className={cn(
                                "h-3.5 w-3.5 transition-all duration-150",
                                isSelected
                                  ? "text-foreground translate-x-0 opacity-100"
                                  : "text-muted-foreground -translate-x-1 opacity-0"
                              )}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Pied de modale : Aide clavier */}
            <div className="flex items-center justify-between border-t border-border/70 bg-background/60 px-4 py-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="kbd-badge">↑</kbd>
                  <kbd className="kbd-badge">↓</kbd>
                  <span className="ml-0.5">Naviguer</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="kbd-badge">
                    <CornerDownLeft className="h-2.5 w-2.5 inline" />
                  </kbd>
                  <span className="ml-0.5">Ouvrir</span>
                </span>
              </div>
              <span className="font-mono-metric text-[10.5px] text-muted-foreground/75">
                Index R2C • 367 items
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default GlobalSearch;

