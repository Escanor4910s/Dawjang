import { untypedTable } from "@/lib/untypedDb";
// src/pages/Stats.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  TrendingUp,
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Target,
  Layers,
  CheckSquare,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Clock,
  SlidersHorizontal,
  ShieldAlert,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DawJangDragonIcon } from "@/components/landing/HippocampusLogo";
import { cn } from "@/lib/utils";

export interface TopicGapMetric {
  id: string;
  title: string;
  category: string;
  precision: number; // %
  questionsAttempted: number;
  correctCount: number;
  targetThreshold: number; // 60%
  lastAttemptDate: string;
}

const DEFAULT_TOPIC_METRICS: TopicGapMetric[] = [
  {
    id: "gap-semio-abces",
    title: "Sémiologie — Abcès du poumon & suppurations pulmonaires",
    category: "Pneumologie & Sémiologie",
    precision: 0,
    questionsAttempted: 10,
    correctCount: 0,
    targetThreshold: 60,
    lastAttemptDate: "Aujourd'hui",
  },
  {
    id: "gap-ddb",
    title: "DDB — Dilatation des bronches (Bronchectasies)",
    category: "Pneumologie",
    precision: 5,
    questionsAttempted: 20,
    correctCount: 1,
    targetThreshold: 60,
    lastAttemptDate: "Aujourd'hui",
  },
  {
    id: "gap-ischemie",
    title: "Ischémie aiguë des membres — Diagnostic & Urgence",
    category: "Cardiologie & Vasculaire",
    precision: 16,
    questionsAttempted: 70,
    correctCount: 11,
    targetThreshold: 60,
    lastAttemptDate: "Hier",
  },
  {
    id: "gap-infectio-mi",
    title: "Généralités sur les infections & modes de transmission",
    category: "Maladies Infectieuses",
    precision: 38,
    questionsAttempted: 24,
    correctCount: 9,
    targetThreshold: 60,
    lastAttemptDate: "Hier",
  },
  {
    id: "gap-irc",
    title: "Insuffisance Respiratoire Chronique (IRC) & Gazométrie",
    category: "Pneumologie",
    precision: 45,
    questionsAttempted: 20,
    correctCount: 9,
    targetThreshold: 60,
    lastAttemptDate: "Il y a 2j",
  },
  {
    id: "gap-cholera",
    title: "Le Choléra — Physiopathologie, Signes & Réhydratation",
    category: "Maladies Infectieuses",
    precision: 52,
    questionsAttempted: 25,
    correctCount: 13,
    targetThreshold: 60,
    lastAttemptDate: "Il y a 3j",
  },
  {
    id: "gap-amibiase",
    title: "Amibiase viscérale & abcès amibien hépatique",
    category: "Parasitologie",
    precision: 55,
    questionsAttempted: 18,
    correctCount: 10,
    targetThreshold: 60,
    lastAttemptDate: "Il y a 3j",
  },
  {
    id: "gap-acido-basique",
    title: "Troubles de l'équilibre acido-basique & Trou anionique",
    category: "Néphrologie & Réanimation",
    precision: 58,
    questionsAttempted: 30,
    correctCount: 17,
    targetThreshold: 60,
    lastAttemptDate: "Il y a 4j",
  },
  {
    id: "gap-paludisme",
    title: "Paludisme grave d'importation et en zone d'endémie",
    category: "Parasitologie",
    precision: 59,
    questionsAttempted: 22,
    correctCount: 13,
    targetThreshold: 60,
    lastAttemptDate: "Il y a 5j",
  },
  {
    id: "mastered-cardio-230",
    title: "Douleur thoracique aiguë & Syndromes coronariens",
    category: "Cardiologie",
    precision: 84,
    questionsAttempted: 45,
    correctCount: 38,
    targetThreshold: 60,
    lastAttemptDate: "Aujourd'hui",
  },
  {
    id: "mastered-neuro-avc",
    title: "Accidents Vasculaires Cérébraux — Prise en charge aiguë",
    category: "Neurologie",
    precision: 78,
    questionsAttempted: 32,
    correctCount: 25,
    targetThreshold: 60,
    lastAttemptDate: "Hier",
  },
];

// Nettoie les titres tronqués venant éventuellement de la base (ex: "SÉMIO ABCES DU")
function normalizeTopicTitle(rawTitle: string): string {
  const upper = rawTitle.trim().toUpperCase();
  if (upper === "SÉMIO ABCES DU" || upper === "SEMIO ABCES DU") {
    return "Sémiologie — Abcès du poumon & suppurations";
  }
  if (upper === "DDB") {
    return "DDB — Dilatation des bronches";
  }
  if (upper === "GENERALITES MI" || upper === "GÉNÉRALITÉS MI") {
    return "Généralités — Infections & transmission";
  }
  return rawTitle.trim();
}

export default function Stats() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Vue active : "overview" (Statistiques générales) ou "lacunes" (Rapport de Lacunes)
  const initialView =
    searchParams.get("view") === "lacunes" ? "lacunes" : "overview";
  const [activeView, setActiveView] = useState<"overview" | "lacunes">(
    initialView
  );

  const [metrics, setMetrics] = useState<TopicGapMetric[]>(
    DEFAULT_TOPIC_METRICS
  );
  const [severityFilter, setSeverityFilter] = useState<
    "all" | "critical" | "fragile"
  >("all");

  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam === "lacunes") setActiveView("lacunes");
  }, [searchParams]);

  // Synchronisation avec Supabase si des résultats de quiz sont présents
  useEffect(() => {
    const fetchRealQuizStats = async () => {
      try {
        const { data } = await untypedTable("quiz_results")
          .select("*")
          .limit(100);

        if (data && Array.isArray(data) && data.length > 0) {
          const grouped: Record<
            string,
            { title: string; totalQ: number; correctQ: number }
          > = {};

          data.forEach((row: any) => {
            const rawTitle = row.quiz_title || row.subject || row.title;
            if (!rawTitle) return;
            const clean = normalizeTopicTitle(rawTitle);
            if (!grouped[clean]) {
              grouped[clean] = { title: clean, totalQ: 0, correctQ: 0 };
            }
            grouped[clean].totalQ += Number(row.total_questions || 10);
            grouped[clean].correctQ += Number(row.score || 0);
          });

          const computedFromDb: TopicGapMetric[] = Object.entries(grouped).map(
            ([key, val], idx) => ({
              id: `db-gap-${idx}`,
              title: val.title,
              category: "Évaluation QCM",
              precision:
                val.totalQ > 0
                  ? Math.round((val.correctQ / val.totalQ) * 100)
                  : 0,
              questionsAttempted: val.totalQ,
              correctCount: val.correctQ,
              targetThreshold: 60,
              lastAttemptDate: "Synchronisé",
            })
          );

          if (computedFromDb.length > 0) {
            const existingTitles = new Set(
              computedFromDb.map((c) => (c.title || "").toLowerCase())
            );
            const merged = [
              ...computedFromDb,
              ...DEFAULT_TOPIC_METRICS.filter(
                (d) => !existingTitles.has((d.title || "").toLowerCase())
              ),
            ];
            setMetrics(merged);
          }
        }
      } catch {
        // Conserve les métriques par défaut
      }
    };

    fetchRealQuizStats();
  }, []);

  const switchView = (nextView: "overview" | "lacunes") => {
    setActiveView(nextView);
    if (nextView === "lacunes") {
      setSearchParams({ view: "lacunes" });
    } else {
      setSearchParams({});
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Toutes les zones en dessous du seuil de 60% constituent les lacunes détectées
  const lacunesList = useMemo(() => {
    return metrics
      .filter((m) => m.precision < m.targetThreshold)
      .sort((a, b) => a.precision - b.precision);
  }, [metrics]);

  const filteredLacunes = useMemo(() => {
    return lacunesList.filter((item) => {
      if (severityFilter === "critical") return item.precision < 25;
      if (severityFilter === "fragile")
        return item.precision >= 25 && item.precision < 60;
      return true;
    });
  }, [lacunesList, severityFilter]);

  const criticalCount = lacunesList.filter((l) => l.precision < 25).length;
  const fragileCount = lacunesList.filter(
    (l) => l.precision >= 25 && l.precision < 60
  ).length;
  const totalQuestionsAnalyzed = metrics.reduce(
    (acc, m) => acc + m.questionsAttempted,
    0
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* =====================================================================
          VUE 1 : RAPPORT DE LACUNES & DIAGNOSTIC DE MAÎTRISE (REFONTE COMPLÈTE)
         ===================================================================== */}
      {activeView === "lacunes" ? (
        <div className="space-y-7 animate-in fade-in duration-200">
          {/* Barre de navigation supérieure */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => switchView("overview")}
              className="group inline-flex items-center gap-2 rounded-xl border border-border bg-card hover:border-foreground/30 px-3.5 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-all"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <span>Retour aux Statistiques</span>
            </button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/flashcards")}
              >
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span>Convertir mes lacunes en Flashcards</span>
              </Button>
              <Button size="sm" onClick={() => navigate("/exams")}>
                <CheckSquare className="h-3.5 w-3.5" />
                <span>Lancer un Examen de rattrapage</span>
              </Button>
            </div>
          </div>

          {/* EN-TÊTE ÉDITORIAL DAWJANG (SANS DÉGRADÉ ROSE NI MENTION ECNi) */}
          <section className="rounded-[24px] border border-border bg-card p-6 sm:p-8 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.04)] space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-border/75 pb-6">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-lg border border-primary/35 bg-primary/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-primary">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>
                    DIAGNOSTIC DE MAÎTRISE • {lacunesList.length} ZONES SOUS LE SEUIL DE 60%
                  </span>
                </div>

                <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight">
                  Rapport des Lacunes & Priorités
                </h1>

                <p className="text-[14px] text-muted-foreground leading-relaxed">
                  L'algorithme d'analyse a identifié{" "}
                  <strong className="text-foreground font-semibold">
                    {lacunesList.length} chapitres
                  </strong>{" "}
                  dont le score de précision est inférieur au seuil de validation académique fixé à{" "}
                  <strong className="font-mono text-foreground">60%</strong>.
                </p>
              </div>

              {/* Filtres de sévérité */}
              <div className="inline-flex items-center rounded-xl border border-border bg-secondary/65 p-1 self-start shrink-0">
                {[
                  {
                    id: "all" as const,
                    label: `Toutes (${lacunesList.length})`,
                  },
                  {
                    id: "critical" as const,
                    label: `Critiques < 25% (${criticalCount})`,
                  },
                  {
                    id: "fragile" as const,
                    label: `À consolider (${fragileCount})`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSeverityFilter(tab.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap",
                      severityFilter === tab.id
                        ? "bg-card text-foreground font-semibold shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3 compteurs synthétiques de diagnostic */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border/80 bg-background/60 p-4 flex items-center justify-between">
                <div>
                  <span className="text-[12px] text-muted-foreground block">
                    Urgences critiques (&lt; 25%)
                  </span>
                  <span className="font-mono text-2xl font-bold text-destructive tabular-nums">
                    {criticalCount} cours
                  </span>
                </div>
                <span className="font-mono text-[11px] px-2 py-1 rounded-md bg-destructive/10 text-destructive font-semibold">
                  Priorité #1
                </span>
              </div>

              <div className="rounded-xl border border-border/80 bg-background/60 p-4 flex items-center justify-between">
                <div>
                  <span className="text-[12px] text-muted-foreground block">
                    Chapitres fragiles (25% – 59%)
                  </span>
                  <span className="font-mono text-2xl font-bold text-primary tabular-nums">
                    {fragileCount} cours
                  </span>
                </div>
                <span className="font-mono text-[11px] px-2 py-1 rounded-md bg-primary/10 text-primary font-semibold">
                  À réviser
                </span>
              </div>

              <div className="rounded-xl border border-border/80 bg-background/60 p-4 flex items-center justify-between">
                <div>
                  <span className="text-[12px] text-muted-foreground block">
                    Volume analysé
                  </span>
                  <span className="font-mono text-2xl font-bold text-foreground tabular-nums">
                    {totalQuestionsAnalyzed} QCM
                  </span>
                </div>
                <span className="font-mono text-[11px] px-2 py-1 rounded-md bg-secondary text-foreground font-semibold">
                  Seuil 60%
                </span>
              </div>
            </div>
          </section>

          {/* GRILLE DES CARTES DE LACUNES (DESIGN ÉDITORIAL PROPRE, ZÉRO TITRE COUPÉ) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLacunes.map((item) => {
              const isCritical = item.precision < 25;
              const gapToTarget = Math.max(0, item.targetThreshold - item.precision);

              return (
                <Card
                  key={item.id}
                  className="group flex flex-col justify-between overflow-hidden border-border/90 hover:border-foreground/30 transition-all duration-200"
                >
                  <CardContent className="p-5 flex-1 flex flex-col justify-between gap-5">
                    {/* En-tête de la carte : Catégorie + Score de précision */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <Badge
                          variant={isCritical ? "destructive" : "secondary"}
                          className="text-[10.5px] font-mono uppercase"
                        >
                          {isCritical ? "Seuil Critique" : "À consolider"}
                        </Badge>

                        <div className="text-right">
                          <span
                            className={cn(
                              "font-mono text-2xl font-bold tabular-nums leading-none block",
                              isCritical ? "text-destructive" : "text-primary"
                            )}
                          >
                            {item.precision}%
                          </span>
                          <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
                            PRÉCISION
                          </span>
                        </div>
                      </div>

                      {/* Titre complet (non coupé) + sous-texte */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-muted-foreground block">
                          {item.category}
                        </span>
                        <h3 className="text-[15.5px] font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                          {item.title}
                        </h3>
                        <p className="font-mono text-[11.5px] text-muted-foreground pt-0.5">
                          Sur {item.questionsAttempted} questions traitées ({item.correctCount} réussie{item.correctCount > 1 ? "s" : ""})
                        </p>
                      </div>
                    </div>

                    {/* Barre de seuil avec repère visuel à 60% + Actions de rattrapage */}
                    <div className="space-y-3.5 pt-3 border-t border-border/60">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between font-mono text-[10.5px]">
                          <span
                            className={cn(
                              "font-semibold",
                              isCritical
                                ? "text-destructive"
                                : "text-muted-foreground"
                            )}
                          >
                            ÉCART : -{gapToTarget}%
                          </span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            OBJECTIF {item.targetThreshold}%
                          </span>
                        </div>

                        {/* Jauge bi-zone avec marqueur 60% */}
                        <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isCritical ? "bg-destructive" : "bg-primary"
                            )}
                            style={{
                              width: `${Math.max(4, item.precision)}%`,
                            }}
                          />
                          {/* Ligne repère du seuil 60% */}
                          <div
                            className="absolute top-0 bottom-0 w-[2px] bg-emerald-600 dark:bg-emerald-400"
                            style={{ left: "60%" }}
                            title="Objectif 60%"
                          />
                        </div>
                      </div>

                      {/* Boutons d'action directe pour combler la lacune */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => navigate("/quiz")}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background hover:bg-foreground hover:text-background hover:border-foreground py-2 px-2.5 text-[12px] font-semibold text-foreground transition-all"
                        >
                          <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                          <span>Rattraper QCM</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate("/flashcards")}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary hover:text-primary-foreground py-2 px-2.5 text-[12px] font-semibold text-primary transition-all"
                        >
                          <Layers className="h-3.5 w-3.5 shrink-0" />
                          <span>Flashcards</span>
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        /* =====================================================================
           VUE 2 : VUE D'ENSEMBLE DES STATISTIQUES & BOUTON RAPPORT DE LACUNES
          ===================================================================== */
        <div className="space-y-8 animate-in fade-in duration-200">
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/80 pb-6">
            <div>
              <span className="text-[12px] font-medium text-primary block mb-1">
                Télémétrie académique & Progression par matière
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight">
                Statistiques & Courbes de Rétention
              </h1>
            </div>

            <Button
              onClick={() => switchView("lacunes")}
              className="shadow-sm gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>
                Consulter le rapport des lacunes ({lacunesList.length})
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </header>

          {/* BANNIÈRE D'ALERTE INTERACTIVE VERS LE RAPPORT DE LACUNES */}
          <div
            onClick={() => switchView("lacunes")}
            className="group cursor-pointer rounded-2xl border border-primary/40 bg-card hover:border-primary p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-all duration-200"
          >
            <div className="flex items-start sm:items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Target className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="font-mono text-[10.5px]">
                    DIAGNOSTIC ACTIF
                  </Badge>
                  <span className="font-mono text-[11.5px] text-muted-foreground">
                    • Seuil cible : 60%
                  </span>
                </div>
                <h2 className="text-[16.5px] font-semibold text-foreground group-hover:text-primary transition-colors">
                  {lacunesList.length} zones de faiblesse détectées dans vos révisions
                </h2>
                <p className="text-[13px] text-muted-foreground">
                  Inspectez vos chapitres sous le seuil de 60% (dont{" "}
                  <strong className="text-foreground">
                    {lacunesList[0]?.title}
                  </strong>
                  ) et lancez un rattrapage ciblé.
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-xl bg-secondary group-hover:bg-foreground group-hover:text-background px-4 py-2.5 text-[13px] font-semibold text-foreground shrink-0 transition-colors">
              <span>Ouvrir le rapport</span>
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>

          {/* 3 Indicateurs clés */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: "Stabilité mémorielle FSRS",
                value: "21,4 jours",
                desc: "Durée moyenne avant rappel nécessaire",
              },
              {
                label: "Questions QCM traitées",
                value: `${totalQuestionsAnalyzed}`,
                desc: "Sur l'ensemble de vos banques de QCM",
              },
              {
                label: "Cadence par question",
                value: "28 sec",
                desc: "Temps de réponse moyen en Examen & Duel",
              },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-5 space-y-1.5">
                  <span className="text-[12.5px] text-muted-foreground">
                    {stat.label}
                  </span>
                  <div className="font-mono text-2xl font-bold text-foreground tabular-nums">
                    {stat.value}
                  </div>
                  <p className="text-[11.5px] text-muted-foreground">
                    {stat.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Matrice complète des cours et chapitres */}
          <Card>
            <CardHeader className="border-b border-border/75 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-[16px]">
                    Indice de maîtrise par chapitre étudié
                  </CardTitle>
                  <CardDescription>
                    Comparaison directe de votre précision actuelle avec l'objectif académique de 60%.
                  </CardDescription>
                </div>
                <span className="font-mono text-[11.5px] text-muted-foreground">
                  Objectif : ≥ 60%
                </span>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-4">
              {metrics.map((m) => {
                const isBelow = m.precision < m.targetThreshold;
                return (
                  <div key={m.id} className="group space-y-1.5">
                    <div className="flex items-center justify-between text-[13.5px] gap-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                          {m.title}
                        </span>
                        <span className="text-[11.5px] text-muted-foreground hidden sm:inline">
                          • {m.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 font-mono text-[12px] shrink-0 tabular-nums">
                        <span className="text-muted-foreground">
                          {m.questionsAttempted} QCM
                        </span>
                        <span
                          className={cn(
                            "font-bold w-12 text-right",
                            isBelow ? "text-primary" : "text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {m.precision}%
                        </span>
                      </div>
                    </div>

                    <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          m.precision >= 60
                            ? "bg-emerald-600 dark:bg-emerald-500"
                            : m.precision >= 25
                            ? "bg-primary"
                            : "bg-destructive"
                        )}
                        style={{ width: `${Math.max(3, m.precision)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
