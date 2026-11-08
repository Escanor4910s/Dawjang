import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Infinity as InfinityIcon, CheckCircle2, XCircle, Loader2, StopCircle, Sparkles } from "lucide-react";
import { generateQuizWithLovable } from "@/lib/lovableAiService";

interface InfQuestion { question: string; choices: string[]; correct: number[]; explanation?: string; }

const QuizInfini = () => {
  const { courseId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const type = params.get("type") || "classique";
  const difficulty = params.get("difficulty") || "facile";

  const [content, setContent] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [history, setHistory] = useState<{ q: InfQuestion; picked: number[]; correct: boolean }[]>([]);
  const [current, setCurrent] = useState<InfQuestion | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0 });

  // Load course content
  useEffect(() => {
    if (!courseId) return;
    supabase.from("courses").select("title, content").eq("id", courseId).single().then(({ data }) => {
      if (data) { setContent(data.content); setTitle(data.title); }
    });
  }, [courseId]);

  const generateNext = useCallback(async () => {
    if (!content) return;
    setLoading(true);
    setRevealed(false);
    setPicked([]);
    try {
      const askedSummary = history.slice(-5).map(h => `- ${h.q.question.slice(0, 80)}`).join("\n");
      const generatedQuestions = await generateQuizWithLovable(
        `${content}\n\n[CONTEXTE: questions déjà posées, ne pas répéter]\n${askedSummary}`,
        1, type, difficulty
      );
      const q = generatedQuestions[0];
      if (!q || !Array.isArray(q.choices) || !Array.isArray(q.correct)) throw new Error("Format invalide");
      setCurrent(q);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      toast.error(e.message || "Erreur de génération");
    } finally { setLoading(false); }
  }, [content, history, type, difficulty]);

  useEffect(() => { if (content && !current && history.length === 0) generateNext(); }, [content, current, history.length, generateNext]);

  const togglePick = (idx: number) => {
    if (revealed) return;
    setPicked(p => p.includes(idx) ? p.filter(i => i !== idx) : [...p, idx]);
  };

  const validate = () => {
    if (!current || picked.length === 0) return;
    const isCorrect = picked.length === current.correct.length && picked.every(i => current.correct.includes(i));
    setRevealed(true);
    setStats(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    setHistory(h => [...h, { q: current, picked, correct: isCorrect }]);
  };

  const next = () => { setCurrent(null); generateNext(); };

  const stop = async () => {
    if (history.length === 0) { navigate("/dashboard"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && courseId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("qcm_sessions") as any).insert({
          user_id: user.id, course_id: courseId,
          title: `${title} (Infini · ${history.length}Q)`,
          questions: history.map(h => h.q), status: "completed",
          question_count: history.length, question_type: type, ai_model: "MED 2 (Infini)",
          metadata: { mode: "infini", correct: stats.correct, total: stats.total, difficulty },
        });
      }
    } catch (e) { console.error("Error saving session:", e); }
    toast.success(`Session terminée : ${stats.correct}/${stats.total}`);
    navigate("/dashboard");
  };

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-transparent py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <InfinityIcon className="h-6 w-6 text-foreground" />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mode Infini</h1>
            <Badge variant="outline">{stats.total} Q · {accuracy}%</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={stop} className="text-destructive">
            <StopCircle className="h-4 w-4 mr-1" /> Arrêter & sauvegarder
          </Button>
        </header>
        <p className="text-sm text-muted-foreground truncate">{title}</p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Question {stats.total + (revealed ? 0 : 1)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {loading || !current ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">L'IA prépare votre prochaine question...</p>
                </motion.div>
              ) : (
                <motion.div key={current.question} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <p className="font-medium text-foreground whitespace-pre-line mb-4">{current.question}</p>
                  <div className="space-y-2">
                    {current.choices.map((c, i) => {
                      const isPicked = picked.includes(i);
                      const isCorrect = current.correct.includes(i);
                      const showState = revealed && (isCorrect || isPicked);
                      return (
                        <button
                          key={i}
                          onClick={() => togglePick(i)}
                          disabled={revealed}
                          className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-3 ${
                            showState
                              ? isCorrect ? "border-green-500 bg-green-500/10"
                                : "border-destructive bg-destructive/10"
                              : isPicked ? "border-foreground bg-foreground/5" : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <span className="font-bold text-sm mt-0.5">{String.fromCharCode(65 + i)}.</span>
                          <span className="flex-1 text-sm">{c}</span>
                          {showState && (isCorrect
                            ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                            : <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />)}
                        </button>
                      );
                    })}
                  </div>

                  {revealed && current.explanation && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-foreground/90">
                      <p className="font-semibold text-primary mb-1">Explication</p>
                      <p>{current.explanation}</p>
                    </motion.div>
                  )}

                  <div className="mt-5 flex gap-2">
                    {!revealed ? (
                      <Button onClick={validate} disabled={picked.length === 0} className="flex-1 bg-foreground text-background hover:bg-foreground/90">
                        Valider ma réponse
                      </Button>
                    ) : (
                      <Button onClick={next} className="flex-1 bg-foreground text-background hover:bg-foreground/90">
                        Question suivante →
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QuizInfini;
