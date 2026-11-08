import React, { useState } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Layers,
  BookOpen,
  AlertTriangle,
  ArrowUpRight,
  SlidersHorizontal,
  Play
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSpacedRepetition } from "@/hooks/useSpacedRepetition";

export default function Planning() {
  const navigate = useNavigate();
  const { dueCards, stats, forecast, loading, refreshCards } = useSpacedRepetition();

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  return (
    <div className="space-y-8 pb-12">
      {/* ─── EN-TÊTE ÉDITORIAL ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/70 pb-6">
        <div>
          <h1 className="font-editorial text-3xl sm:text-4xl text-foreground tracking-tight">
            Planification & Charge Mémorielle
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-border bg-[hsl(var(--surface))] px-3 py-1.5 text-xs font-mono-metric">
            File active : <strong className="text-primary font-semibold">{stats.dueToday}</strong> cartes dues aujourd'hui
          </div>
          <Button
            onClick={() => navigate("/review")}
            className="rounded-lg h-9 px-4 text-xs gap-1.5 bg-foreground text-background"
          >
            <Play className="h-3 w-3" />
            <span>Lancer la Session</span>
          </Button>
        </div>
      </div>

      {/* ─── PRÉVISION DE CHARGE SUR 7 JOURS (RÉELLE) ─── */}
      <div className="rounded-2xl border border-border/80 bg-[hsl(var(--surface))] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Onde de Rétention sur 7 Jours
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Projection dynamique calculée selon vos intervalles de répétition espacée.
            </p>
          </div>
          <span className="font-mono-metric text-xs text-muted-foreground">
            Total : {stats.totalCards} fiches en base
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 pt-2">
          {forecast.map((day, idx) => {
            const isToday = idx === 0;
            const isSelected = selectedDayIndex === idx;
            return (
              <div
                key={day.date}
                onClick={() => setSelectedDayIndex(idx)}
                className={cn(
                  "p-3 rounded-xl border text-center cursor-pointer transition-all duration-150 space-y-1.5",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-xs"
                    : isToday
                    ? "border-border/90 bg-background"
                    : "border-border/60 bg-[hsl(var(--surface-hover))]/40 hover:border-border"
                )}
              >
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {day.label}
                </div>
                <div className="font-mono-metric text-xl font-semibold text-foreground">
                  {day.count}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {day.count === 0 ? "Repos" : `${day.count} cartes`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── BLOCS D'ÉTUDE DU JOUR ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">
            Créneaux et Sessions Recommandés
          </h3>
          <span className="text-xs text-muted-foreground">
            {dueCards.length} concept{dueCards.length > 1 ? "s" : ""} identifié{dueCards.length > 1 ? "s" : ""}
          </span>
        </div>

        {dueCards.length === 0 ? (
          <div className="rounded-xl border border-border/80 bg-[hsl(var(--surface))] p-8 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-semibold text-foreground">Aucune surcharge détectée</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Votre calendrier de révision est parfaitement à jour. Aucune carte n'est en retard d'ancrage.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {dueCards.slice(0, 5).map((card, idx) => (
              <div
                key={card.id}
                onClick={() => navigate("/review")}
                className="group p-4 rounded-xl border border-border/80 bg-[hsl(var(--surface))] hover:bg-[hsl(var(--surface-hover))]/60 transition-colors flex items-center justify-between gap-4 cursor-pointer"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-metric text-[11px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium">
                      Fiche #{idx + 1}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono-metric truncate">
                      {card.courseName || "Médecine Clinique"}
                    </span>
                  </div>
                  <h4 className="text-[13.5px] font-semibold text-foreground truncate">
                    {card.question}
                  </h4>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right font-mono-metric text-xs text-muted-foreground">
                    <div>Répétitions : {card.repetitions || 0}</div>
                    <div className="text-primary font-medium">Intervalle : {card.interval || 1}j</div>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                    <Play className="h-3 w-3" /> Réviser
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
