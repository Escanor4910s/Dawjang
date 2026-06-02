import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Send, BookOpen, Loader2, Brain, Sparkles, Zap, ChevronRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { safeText } from "@/lib/textUtils";
import { motion, AnimatePresence } from "framer-motion";
import DOMPurify from "dompurify";
import { askMorWithLovable } from "@/lib/lovableAiService";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

interface Course {
  id: string;
  title: string;
  content: string;
}

interface AskMorProps {
  embedded?: boolean;
  initialMessage?: string;
}

const formatMarkdown = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^[•\-]\s/gm, '→ ')
    .replace(/\n/g, '<br/>');
};

const AskMor = ({ embedded = false, initialMessage }: AskMorProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndLoadCourses();
  }, []);

  useEffect(() => {
    if (initialMessage && courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
      setQuestion(initialMessage);
      // Auto-send initial message if we want, but usually it's better to let user review
    }
  }, [initialMessage, courses, selectedCourseId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkAuthAndLoadCourses = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      toast({
        title: "Authentification requise",
        description: "Veuillez vous connecter pour utiliser Mor",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    await loadCourses();
  };

  const loadCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, content")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCourses(data || []);
      
      if (messages.length === 0) {
        setMessages([{
          role: "assistant",
          content: "Salut ! Je suis **Mor**, ton tuteur IA. 🩺\n\nChoisis un cours ci-dessus et pose-moi tes questions. Je suis là pour t'aider à tout comprendre."
        }]);
      }
    } catch (error) {
      console.error("Error loading courses:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les cours.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleAskMor = async () => {
    if (!question.trim() || !selectedCourseId) {
      toast({
        title: "Information manquante",
        description: "Veuillez sélectionner un cours et entrer une question",
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setIsLoading(true);

    try {
      const course = courses.find(c => c.id === selectedCourseId);
      if (!course) throw new Error("Cours non trouvé.");

      const chatHistory = [...messages, userMessage].map(msg => ({
        role: msg.role === "assistant" ? "assistant" as const : "user" as const,
        content: msg.content
      }));

      const { answer, sources } = await askMorWithLovable(chatHistory, course.id);

      const answerContent = safeText(answer, "Réponse non disponible");
      const safeSources = Array.isArray(sources) 
        ? sources.map((s: any) => {
            if (typeof s === "string") return safeText(s, "");
            return safeText(s.text || s.name || s, "");
          })
        : [];

      const assistantMessage: Message = {
        role: "assistant",
        content: answerContent,
        sources: safeSources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Error asking Mor:", error);
      
      const errorMessage: Message = {
        role: "assistant",
        content: "Désolé, je rencontre des difficultés techniques. Veuillez réessayer dans quelques instants.",
      };
      
      setMessages((prev) => [...prev, errorMessage]);
      
      toast({
        title: "Erreur",
        description: error.message || "Impossible de contacter Mor.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAskMor();
    }
  };

  if (isLoadingCourses) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
        </div>
        <p className="text-sm font-semibold text-muted-foreground animate-pulse">Initialisation de Mor...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${embedded ? "h-full" : "min-h-[85vh] container mx-auto px-4 py-8 max-w-4xl"}`}>
      
      {/* HEADER SECTION (Only visible if not embedded) */}
      {!embedded && (
        <div className="mb-10 text-center relative z-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-violet-600 via-indigo-600 to-primary rounded-3xl mb-6 shadow-2xl shadow-primary/30 relative">
            <div className="absolute inset-0 bg-white/20 rounded-3xl mix-blend-overlay" />
            <Brain className="h-10 w-10 text-white relative z-10 animate-[pulse_3s_infinite]" />
            <div className="absolute -bottom-2 -right-2 bg-transparent rounded-full p-1.5 shadow-lg">
              <div className="bg-emerald-500 h-3 w-3 rounded-full animate-ping absolute opacity-50" />
              <div className="bg-emerald-500 h-3 w-3 rounded-full relative" />
            </div>
          </div>
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground/80 to-foreground mb-3 tracking-tight">
            Mor
          </h1>
          <p className="text-lg text-muted-foreground font-medium max-w-lg mx-auto">
            Votre tuteur virtuel en médecine, propulsé par l'intelligence artificielle pour vous guider.
          </p>
        </div>
      )}

      {/* MAIN CHAT CONTAINER */}
      <div className={`flex flex-col flex-1 relative z-10 ${
        embedded 
          ? "h-full bg-slate-50/50 dark:bg-slate-900/50" 
          : "bg-white/60 dark:bg-slate-950/60 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white/20 dark:border-white/10 overflow-hidden"
      }`}>
        
        {/* COURSE SELECTOR BAR */}
        <div className={`flex items-center gap-4 px-6 py-4 border-b border-border/50 bg-white/40 dark:bg-black/20 backdrop-blur-md ${embedded ? "rounded-t-2xl" : ""}`}>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="w-full h-11 border-0 bg-white/50 dark:bg-white/5 font-semibold text-foreground hover:bg-white/80 dark:hover:bg-white/10 transition-colors shadow-sm rounded-xl">
                <SelectValue placeholder="Sélectionnez un cours à réviser..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50 backdrop-blur-xl">
                {courses.length === 0 ? (
                  <SelectItem value="none" disabled>Aucun cours disponible</SelectItem>
                ) : (
                  courses.map((course) => (
                    <SelectItem key={course.id} value={course.id} className="font-medium cursor-pointer">
                      {course.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* CHAT MESSAGES AREA */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scroll-smooth">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 25 }}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="shrink-0 mr-3 mt-1 h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center shadow-md">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                )}
                
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-[1.5rem] px-5 py-4 shadow-sm ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-primary to-indigo-600 text-white rounded-br-sm shadow-primary/20"
                      : "bg-white dark:bg-slate-900 border border-border/50 text-foreground rounded-bl-sm"
                  }`}
                >
                  <div 
                    className="text-[15px] leading-relaxed font-medium"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatMarkdown(message.content)) }}
                  />
                  
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-current/10 space-y-2">
                      <div className="flex items-center gap-1.5 opacity-70 text-xs font-bold uppercase tracking-wider">
                        <Activity className="h-3.5 w-3.5" />
                        <span>Sources Consultées</span>
                      </div>
                      {message.sources.map((source, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-xs opacity-90 bg-current/5 rounded-lg px-2.5 py-1.5">
                          <BookOpen className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{source}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="shrink-0 mr-3 mt-1 h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center shadow-md opacity-50">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white dark:bg-slate-900 border border-border/50 rounded-[1.5rem] rounded-bl-sm px-6 py-4 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* INPUT AREA */}
        <div className={`p-4 sm:p-6 bg-white/60 dark:bg-black/20 border-t border-border/50 backdrop-blur-md ${embedded ? "rounded-b-2xl" : ""}`}>
          <div className="relative group flex items-end gap-3 bg-white dark:bg-slate-950 rounded-2xl border border-border/60 p-2 shadow-sm transition-all focus-within:border-primary/50 focus-within:shadow-[0_0_20px_rgba(var(--primary),0.1)] focus-within:bg-white dark:focus-within:bg-slate-900">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Posez votre question clinique à Mor..."
              className="min-h-[60px] max-h-[150px] resize-none border-0 bg-transparent focus-visible:ring-0 shadow-none text-base font-medium px-4 py-3 placeholder:text-muted-foreground/60"
              disabled={isLoading || !selectedCourseId}
            />
            <Button
              onClick={handleAskMor}
              disabled={isLoading || !question.trim() || !selectedCourseId}
              size="icon"
              className="h-[52px] w-[52px] shrink-0 rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-white hover:opacity-90 shadow-lg shadow-primary/25 transition-all mb-1 mr-1"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5 ml-1" />
              )}
            </Button>
          </div>
          
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground/70 font-semibold px-2">
            <span className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-amber-500" /> Propulsé par Lovable AI
            </span>
            <span>Mor est un assistant, vérifiez les informations.</span>
          </div>
        </div>
      </div>
      
      {/* Background ambient light */}
      {!embedded && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[150px] mix-blend-screen" />
        </div>
      )}
    </div>
  );
};

export default AskMor;
