// src/components/quiz/MesQuizzesManager.tsx
import React, { useState } from "react";
import { useUserQuizzes, type UserQuizRecord } from "@/hooks/useUserQuizzes";
import {
  BookOpen,
  Play,
  Eye,
  Trash2,
  Download,
  Search,
  RefreshCw,
  Sparkles,
  Calendar,
  CheckCircle2,
  X,
  Layers,
  HelpCircle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface MesQuizzesManagerProps {
  userId?: string;
  onStartQuizSession?: (quizRecord: UserQuizRecord) => void;
  onExportPdf?: (quizRecord: UserQuizRecord) => void;
  className?: string;
}

export function MesQuizzesManager({
  userId,
  onStartQuizSession,
  onExportPdf,
  className,
}: MesQuizzesManagerProps) {
  const { quizzes, loading, quizzesCount, fetchQuizzes, deleteQuiz } = useUserQuizzes(userId);
  const [search, setSearch] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState<UserQuizRecord | null>(null);

  const filteredQuizzes = quizzes.filter((q) => {
    const term = search.toLowerCase();
    const title = (q.title || "").toLowerCase();
    const subject = (q.subject || "").toLowerCase();
    return title.includes(term) || subject.includes(term);
  });

  const getQuestionCount = (record: UserQuizRecord): number => {
    if (Array.isArray(record.quiz?.questions)) {
      return record.quiz.questions.length;
    }
    return 0;
  };

  return (
    <div className={cn("space-y-6 animate-in fade-in duration-200", className)}>
      {/* EN-TÊTE DU GESTIONNAIRE */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground">
              Mes Quiz Sauvegardés
            </h2>
            <Badge variant="secondary" className="font-mono text-xs font-semibold">
              {quizzesCount} {quizzesCount > 1 ? "quiz" : "quiz"}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Retrouvez tous vos quiz générés par IA, prévisualisez-les, relancez une session ou exportez-les.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchQuizzes()}
            disabled={loading}
            className="gap-1.5 text-xs h-9"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* BARRE DE RECHERCHE */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par titre ou matière…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      {/* ÉTATS : CHARGEMENT / VIDE / LISTE */}
      {loading && quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-2xl border-dashed border-border bg-card/40">
          <RefreshCw className="h-8 w-8 text-primary animate-spin mb-3" />
          <p className="text-sm font-medium text-foreground">Chargement de vos quiz…</p>
          <p className="text-xs text-muted-foreground">Synchronisation avec Supabase et le stockage local</p>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-2xl border-dashed border-border bg-card/40">
          <BookOpen className="h-10 w-10 text-muted-foreground/60 mb-3" />
          <p className="text-sm font-medium text-foreground">
            {search ? "Aucun quiz ne correspond à votre recherche" : "Aucun quiz sauvegardé"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {search
              ? "Essayez d'ajuster vos termes de recherche."
              : "Générez un nouveau QCM via le Générateur Multi-Moteurs IA pour le sauvegarder automatiquement ici."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuizzes.map((item) => {
            const count = getQuestionCount(item);
            const formattedDate = item.created_at
              ? new Date(item.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Date inconnue";

            return (
              <Card
                key={item.id}
                className="group border border-border/80 hover:border-primary/50 transition-all shadow-sm hover:shadow-md flex flex-col justify-between bg-card"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="text-[11px] font-mono capitalize">
                      {item.subject || "Médecine"}
                    </Badge>
                    <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formattedDate}
                    </span>
                  </div>
                  <CardTitle className="text-base font-bold text-foreground line-clamp-2 mt-2">
                    {item.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    {count} {count > 1 ? "questions" : "question"}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3 mt-1">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedQuiz(item)}
                        className="h-8 px-2.5 text-xs gap-1"
                        title="Prévisualiser le quiz"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Aperçu
                      </Button>

                      {onExportPdf && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onExportPdf(item)}
                          className="h-8 px-2 text-xs"
                          title="Exporter en PDF via DawJang Press"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Supprimer définitivement « ${item.title} » ?`)) {
                            deleteQuiz(item.id);
                          }
                        }}
                        className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Supprimer ce quiz"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {onStartQuizSession && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onStartQuizSession(item)}
                        className="h-8 px-3 text-xs gap-1.5 font-medium"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        S'entraîner
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL DE PRÉVISUALISATION DU QUIZ */}
      <Dialog open={!!selectedQuiz} onOpenChange={(open) => !open && setSelectedQuiz(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedQuiz && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {selectedQuiz.subject || "Médecine"}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    {getQuestionCount(selectedQuiz)} questions
                  </span>
                </div>
                <DialogTitle className="text-xl font-bold font-serif">
                  {selectedQuiz.title}
                </DialogTitle>
                <DialogDescription>
                  Aperçu détaillé des questions, propositions et justifications médicales.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-2">
                {(selectedQuiz.quiz?.questions || []).map((q: any, idx: number) => {
                  const choices = q.choices || q.options || [];
                  const correctAnswer = q.answer || "";

                  return (
                    <div
                      key={q.id || idx}
                      className="p-4 rounded-xl border border-border/80 bg-card space-y-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold font-mono">
                          {idx + 1}
                        </span>
                        <p className="text-sm font-semibold text-foreground leading-snug">
                          {q.question}
                        </p>
                      </div>

                      {/* CHOIX / PROPOSITIONS */}
                      <div className="grid grid-cols-1 gap-1.5 pl-8">
                        {choices.map((choice: any, cIdx: number) => {
                          const label =
                            choice.label || String.fromCharCode(65 + cIdx);
                          const text = typeof choice === "string" ? choice : choice.text;
                          const cleanCorrect = String(correctAnswer || "").trim().toLowerCase();
                          const cleanText = String(text || "").trim().toLowerCase();
                          const cleanLabel = String(label || "").trim().toLowerCase();
                          const isCorrect =
                            Boolean(choice?.isCorrect) ||
                            (cleanCorrect.length > 0 && (cleanText === cleanCorrect || cleanLabel === cleanCorrect));

                          return (
                            <div
                              key={cIdx}
                              className={cn(
                                "flex items-center justify-between text-xs p-2 rounded-lg border transition-all",
                                isCorrect
                                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-semibold"
                                  : "bg-muted/30 border-border/60 text-muted-foreground"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold">{label}.</span>
                                <span>{text}</span>
                              </div>
                              {isCorrect && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* JUSTIFICATION */}
                      {(q.explanation || q.justification) && (
                        <div className="pl-8 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/60 text-foreground/80 space-y-1">
                          <span className="font-semibold text-primary block">
                            Justification docimologique :
                          </span>
                          <p>{q.explanation || q.justification}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <Button variant="outline" onClick={() => setSelectedQuiz(null)}>
                  Fermer
                </Button>

                {onStartQuizSession && (
                  <Button
                    onClick={() => {
                      const record = selectedQuiz;
                      setSelectedQuiz(null);
                      onStartQuizSession(record);
                    }}
                    className="gap-2"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Lancer l'entraînement
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
