// src/components/quiz/MesQcmList.tsx
import React from "react";
import type { QcmSessionRecord } from "@/lib/qcmSessionManager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Trophy, Timer, Eye, Play, Trash2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface MesQcmListProps {
  sessionsList: QcmSessionRecord[];
  onOpen: (session: QcmSessionRecord) => void;
  onResume?: (session: QcmSessionRecord) => void;
  onReplay?: (session: QcmSessionRecord) => void;
  onDelete?: (sessionId: string) => void;
}

export const MesQcmList: React.FC<MesQcmListProps> = ({
  sessionsList,
  onOpen,
  onResume,
  onReplay,
  onDelete,
}) => {
  if (!sessionsList || sessionsList.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 p-8 text-center space-y-2">
        <p className="text-sm font-semibold text-foreground">
          Aucune session QCM enregistrée pour le moment.
        </p>
        <p className="text-xs text-muted-foreground">
          Lancez un entraînement pour mémoriser automatiquement vos sessions et vos résultats.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {sessionsList.map((s) => {
        const pct =
          s.totalQuestions > 0 ? Math.round((s.score / s.totalQuestions) * 100) : 0;
        const isSuccess = pct >= 70;
        const isAvg = pct >= 50 && pct < 70;
        const mins = Math.floor(s.timeElapsed / 60);
        const secs = s.timeElapsed % 60;
        const formattedDuration = `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
        const dateStr = new Date(s.startedAt).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });

        const isInProgress = s.status === "in_progress";

        return (
          <li
            key={s.id}
            className="group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary/50 transition-all gap-3 cursor-pointer shadow-2xs"
            onClick={() => onOpen(s)}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{s.subject || "Médecine"}</Badge>
                {isInProgress ? (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs px-2 py-0.5">
                    <Timer className="w-3 h-3 mr-1 inline" />
                    En cours ({Object.keys(s.userAnswers || {}).length}/{s.totalQuestions})
                  </Badge>
                ) : (
                  <Badge
                    className={cn(
                      "font-mono text-xs px-2 py-0.5",
                      isSuccess
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : isAvg
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                        : "bg-destructive/15 text-destructive border-destructive/30"
                    )}
                  >
                    <Trophy className="w-3 h-3 mr-1 inline" />
                    {s.score} / {s.totalQuestions} ({pct}%)
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground font-mono">{dateStr}</span>
              </div>

              <h4 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                {s.title}
              </h4>
            </div>

            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <span className="font-mono text-xs text-muted-foreground flex items-center gap-1 hidden sm:flex">
                <Clock className="w-3 h-3" />
                {formattedDuration}
              </span>

              {isInProgress && onResume ? (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onResume(s)}
                  className="h-7 text-xs px-2.5 gap-1 bg-amber-600 hover:bg-amber-700 text-white font-medium"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Reprendre</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpen(s)}
                  className="h-7 text-xs px-2 gap-1"
                >
                  <Eye className="w-3 h-3" />
                  <span>Détails</span>
                </Button>
              )}

              {onReplay && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onReplay(s)}
                  className="h-7 text-xs px-2 gap-1 text-primary hover:bg-primary/10"
                  title="Nouvelle session diversifiée"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Rejouer</span>
                </Button>
              )}

              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  title="Supprimer la session"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
