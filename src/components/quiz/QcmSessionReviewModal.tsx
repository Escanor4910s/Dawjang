// src/components/quiz/QcmSessionReviewModal.tsx
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, Calendar, Trophy, RotateCcw, Sparkles } from "lucide-react";
import type { QcmSessionRecord } from "@/lib/qcmSessionManager";
import { cn } from "@/lib/utils";

export interface QcmSessionReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: QcmSessionRecord | null;
  onReplay?: (session: QcmSessionRecord) => void;
}

export function QcmSessionReviewModal({
  open,
  onOpenChange,
  session,
  onReplay,
}: QcmSessionReviewModalProps) {
  if (!session) return null;

  const percent =
    session.totalQuestions > 0
      ? Math.round((session.score / session.totalQuestions) * 100)
      : 0;

  const isSuccess = percent >= 70;
  const isAverage = percent >= 50 && percent < 70;

  const formattedDate = new Date(session.startedAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const minutes = Math.floor(session.timeElapsed / 60);
  const seconds = session.timeElapsed % 60;
  const durationText = `${minutes} min ${seconds < 10 ? "0" : ""}${seconds} s`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-3xl max-h-[92vh] sm:max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-4 sm:p-6 border-b border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{session.subject}</Badge>
              {session.isDiversified && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                  <Sparkles className="w-3 h-3 mr-1 inline" />
                  Session unique diversifiée
                </Badge>
              )}
            </div>
            <Badge
              className={cn(
                "font-mono text-sm px-3 py-1",
                isSuccess
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : isAverage
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                  : "bg-destructive/15 text-destructive border-destructive/30"
              )}
            >
              <Trophy className="w-3.5 h-3.5 mr-1.5 inline" />
              {session.score} / {session.totalQuestions} ({percent}%)
            </Badge>
          </div>

          <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
            {session.title}
          </DialogTitle>

          <DialogDescription className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Durée : {durationText}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {session.questions.map((q, qIndex) => {
            const userSelected = session.userAnswers[q.id] || [];
            const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);

            const isExact =
              correctIds.length === userSelected.length &&
              correctIds.every((id) => userSelected.includes(id));

            return (
              <div
                key={q.id}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  isExact
                    ? "border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10"
                    : "border-destructive/30 bg-destructive/10 dark:bg-destructive/10"
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h4 className="font-semibold text-sm sm:text-base text-foreground leading-relaxed">
                    <span className="text-primary font-bold mr-2">Q{qIndex + 1}.</span>
                    {q.question}
                  </h4>
                  <Badge
                    variant={isExact ? "default" : "destructive"}
                    className="shrink-0 text-[11px] gap-1"
                  >
                    {isExact ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Exact
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        Incorrect
                      </>
                    )}
                  </Badge>
                </div>

                {q.stemBlocks && q.stemBlocks.length > 0 && (
                  <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1 mb-3.5 font-mono">
                    {q.stemBlocks.map((block, bIdx) => (
                      <div key={bIdx} className="text-muted-foreground">
                        {block}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2 mb-3">
                  {q.options.map((opt) => {
                    const isChosen = userSelected.includes(opt.id);
                    const isCorrect = opt.isCorrect;

                    let rowClass = "border border-border/60 bg-card text-foreground";
                    if (isCorrect && isChosen) {
                      rowClass =
                        "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-medium";
                    } else if (isCorrect && !isChosen) {
                      rowClass =
                        "border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 border-dashed";
                    } else if (!isCorrect && isChosen) {
                      rowClass =
                        "border-destructive bg-destructive/10 text-destructive font-medium";
                    }

                    return (
                      <div
                        key={opt.id}
                        className={cn(
                          "flex flex-wrap sm:flex-nowrap items-start gap-2.5 p-2.5 rounded-lg text-xs sm:text-sm",
                          rowClass
                        )}
                      >
                        <span className="font-mono font-bold w-5 shrink-0 text-center">
                          {opt.label}.
                        </span>
                        <span className="flex-1 leading-snug">{opt.text}</span>
                        <div className="shrink-0 flex items-center gap-1.5 text-[10px] ml-auto sm:ml-0">
                          {isChosen && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Votre choix
                            </Badge>
                          )}
                          {isCorrect && (
                            <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">
                              Bonne réponse
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {q.explanation && (
                  <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/50">
                    <span className="font-bold text-foreground block mb-1">
                      💡 Explication médicale :
                    </span>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-3 sm:p-4 border-t border-border bg-card flex flex-wrap items-center justify-between gap-2.5">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>

          {onReplay && (
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onReplay(session);
              }}
              className="gap-2 font-bold"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Rejouer (Session diversifiée)</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default QcmSessionReviewModal;
