import { useState, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, BookOpen, Brain, Globe, Lock, Zap, Sparkles, ChevronDown, MessageCircle, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { safeText } from "@/lib/textUtils";
import { useUserRole } from "@/hooks/useUserRole";
import { UpgradePrompt } from "@/components/UpgradePrompt";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { type: "course" | "web"; text: string }[];
  action?: { type: "navigate"; route: string; label: string };
}

interface Course { id: string; title: string; }
interface QcmSession { id: string; title: string; status: string; score?: number; total_questions?: number; }

const NAVIGATION_COMMANDS = [
  { keywords: ["dashboard", "tableau de bord", "accueil"], route: "/dashboard", label: "Dashboard" },
  { keywords: ["révision", "revision", "review"], route: "/review", label: "Révision" },
  { keywords: ["flashcard", "flashcards", "carte"], route: "/flashcards", label: "Flashcards" },
  { keywords: ["statistique", "stats", "statistiques"], route: "/statistics", label: "Statistiques" },
  { keywords: ["quiz", "qcm", "mes qcm"], route: "/quiz-library", label: "Mes QCM" },
  { keywords: ["ajouter", "nouveau cours", "upload"], route: "/add-course", label: "Ajouter un cours" },
];

const formatMarkdown = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^[•\-]\s/gm, '→ ')
    .replace(/\n/g, '<br/>');
};

const MorChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [recentSessions, setRecentSessions] = useState<QcmSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, hasAccess, plan } = useUserRole();

  const hasMorAccess = isAdmin || hasAccess("premium");
  const hasPriorityAccess = isAdmin || hasAccess("pro");

  useEffect(() => { if (isOpen && hasMorAccess) loadData(); }, [isOpen, hasMorAccess]);
  useEffect(() => { scrollToBottom(); }, [messages]);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const [coursesResult, sessionsResult] = await Promise.all([
        supabase.from("courses").select("id, title, content, created_at").order("created_at", { ascending: false }),
        supabase.from("qcm_sessions").select("id, title, status, score, total_questions").order("created_at", { ascending: false }).limit(5)
      ]);
      
      const seenContents = new Set<string>();
      const deduplicatedCourses: any[] = [];
      
      // Deduplicate exact repeats based on text content
      (coursesResult.data || []).forEach((course: any) => {
        const contentKey = (course.content || "").trim() || course.title;
        if (!seenContents.has(contentKey)) {
          seenContents.add(contentKey);
          deduplicatedCourses.push(course);
        }
      });

      // Group by normalized base title to find distinct versions of same-name courses
      const titleGroups: { [key: string]: any[] } = {};
      deduplicatedCourses.forEach((course) => {
        const baseTitle = course.title.replace(/\s*\(Session\s*\d+\)\s*$/i, '').trim();
        const key = baseTitle.toLowerCase();
        if (!titleGroups[key]) {
          titleGroups[key] = [];
        }
        titleGroups[key].push({ course, baseTitle });
      });

      const uniqueCoursesWithDate: { id: string; title: string; created_at: string }[] = [];

      Object.keys(titleGroups).forEach((key) => {
        const group = titleGroups[key];
        if (group.length === 1) {
          uniqueCoursesWithDate.push({
            id: group[0].course.id,
            title: group[0].baseTitle,
            created_at: group[0].course.created_at
          });
        } else {
          // Sort chronologically ascending to assign version numbers (v1, v2, ...)
          group.sort((a, b) => new Date(a.course.created_at).getTime() - new Date(b.course.created_at).getTime());
          group.forEach((item, index) => {
            const dateStr = new Date(item.course.created_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short"
            });
            uniqueCoursesWithDate.push({
              id: item.course.id,
              title: `${item.baseTitle} [V${index + 1} - ${dateStr}]`,
              created_at: item.course.created_at
            });
          });
        }
      });

      // Sort unique courses descending by creation date
      uniqueCoursesWithDate.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const finalUniqueCourses = uniqueCoursesWithDate.map(c => ({ id: c.id, title: c.title }));
      setCourses(finalUniqueCourses);
      
      setRecentSessions(sessionsResult.data || []);
      if (finalUniqueCourses.length > 0 && !selectedCourseId) {
        setSelectedCourseId(finalUniqueCourses[0].id);
      }
      if (messages.length === 0) {
        setMessages([{
          role: "assistant",
          content: hasPriorityAccess
            ? "Salut ! Je suis **Mor** 🩺 *(Mode Pro)*\n\nJe peux t'aider à comprendre tes cours et chercher des infos sur le web médical."
            : "Salut ! Je suis **Mor** 🩺\n\nJe peux t'aider à comprendre tes cours et chercher des infos sur le web médical."
        }]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally { setIsLoadingData(false); }
  };

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };

  const detectNavigationCommand = (text: string): { route: string; label: string } | null => {
    const lowerText = text.toLowerCase();
    for (const cmd of NAVIGATION_COMMANDS) {
      if (cmd.keywords.some(keyword => lowerText.includes(keyword))) return { route: cmd.route, label: cmd.label };
    }
    return null;
  };

  const handleOpenWidget = () => {
    if (!hasMorAccess) { setShowUpgradePrompt(true); return; }
    setIsOpen(true);
  };

  const handleSend = async (text?: string) => {
    const messageText = text || question;
    if (!messageText.trim()) return;
    const userMessage: Message = { role: "user", content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setQuestion("");
    setIsLoading(true);
    try {
      const navCommand = detectNavigationCommand(userMessage.content);
      if (navCommand) {
        setMessages(prev => [...prev, { role: "assistant", content: `Je t'emmène vers **${navCommand.label}** 🚀`, action: { type: "navigate", route: navCommand.route, label: `Aller à ${navCommand.label}` } }]);
        setIsLoading(false); return;
      }
      if (userMessage.content.toLowerCase().includes("résultat") || userMessage.content.toLowerCase().includes("score")) {
        if (recentSessions.length > 0) {
          const sessionSummary = recentSessions.filter(s => s.status === "completed" && s.score !== null).slice(0, 3).map(s => `• ${s.title}: ${s.score}/${s.total_questions}`).join("\n");
          setMessages(prev => [...prev, { role: "assistant", content: `Tes derniers résultats :\n\n${sessionSummary || "Aucun QCM terminé."}`, action: { type: "navigate", route: "/statistics", label: "Voir les statistiques" } }]);
          setIsLoading(false); return;
        }
      }
      if (!selectedCourseId) {
        setMessages(prev => [...prev, { role: "assistant", content: "Sélectionne un cours pour que je puisse t'aider 📚" }]);
        setIsLoading(false); return;
      }
      // Use retry helper to recover from transient 502/503/504 errors
      const { invokeWithRetry } = await import("@/lib/edgeRetry");
      const { data, error } = await invokeWithRetry<any>("ask-mor", {
        body: { question: userMessage.content, courseId: selectedCourseId, priority: hasPriorityAccess },
        retries: 2,
      });
      if (error) {
        let errMsg = error.message || "Erreur inconnue";
        const status = error.status;
        if (status === 429) errMsg = "Trop de requêtes, réessaie dans quelques secondes ⏳";
        if (status === 402) errMsg = "Crédits IA épuisés. Contacte le support.";
        if (status === 403) {
          setShowUpgradePrompt(true);
        }
        toast({ title: "Erreur Mor", description: errMsg, variant: "destructive" });
        setMessages(prev => [...prev, { role: "assistant", content: `❌ ${errMsg}` }]);
        return;
      }
      if (data?.error) {
        toast({ title: "Erreur Mor", description: data.error, variant: "destructive" });
        setMessages(prev => [...prev, { role: "assistant", content: `❌ ${data.error}` }]);
        return;
      }
      const answerContent = safeText(data.answer, "Réponse non disponible");
      const safeSources = Array.isArray(data.sources) ? data.sources.map((s: any) => {
        if (typeof s === 'string') return { type: 'course' as const, text: s };
        if (s && typeof s === 'object') { const text = safeText(s.text || s.name || s, ""); return { type: s.type || 'course', text }; }
        return { type: 'course' as const, text: safeText(s, "") };
      }) : [];
      setMessages(prev => [...prev, { role: "assistant", content: answerContent, sources: safeSources }]);
    } catch (error: any) {
      console.error("Error asking Mor:", error);
      const msg = error?.message || "Une erreur réseau est survenue";
      toast({ title: "Erreur Mor", description: msg, variant: "destructive" });
      setMessages(prev => [...prev, { role: "assistant", content: `❌ ${msg}` }]);
    } finally { setIsLoading(false); }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const executeAction = (action: Message["action"]) => { if (action?.type === "navigate") { navigate(action.route); setIsOpen(false); } };

  // Contextual quick replies after assistant messages
  const lastMessage = messages[messages.length - 1];
  const showQuickReplies = lastMessage?.role === "assistant" && !isLoading && messages.length > 1;

  return (
    <>
      <UpgradePrompt isOpen={showUpgradePrompt} onClose={() => setShowUpgradePrompt(false)} requiredPlan="premium" featureName="Agent MOR" />

      {/* Floating Button with premium backlit glow */}
      {!isOpen && (
        <div className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-50 group cursor-pointer" onClick={handleOpenWidget}>
          <div className="relative">
            {/* Pulsing Backlit rings */}
            {hasMorAccess && (
              <>
                <div className="absolute inset-[-4px] rounded-full bg-gradient-to-tr from-primary via-indigo-500 to-violet-500 blur-md opacity-70 animate-[pulse_2.5s_infinite]" />
                <div className="absolute inset-[-8px] rounded-full bg-violet-600/30 blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
              </>
            )}

            {/* Main button circle */}
            <button
              className={`relative h-14 w-14 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center z-10 ${
                hasMorAccess
                  ? "bg-gradient-to-tr from-white/95 via-slate-50/90 to-white/95 dark:from-card/90 dark:via-[#0d121f]/95 dark:to-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-white/15 text-primary hover:scale-108 hover:-translate-y-0.5"
                  : "bg-muted text-muted-foreground hover:scale-105 border border-border"
              }`}
              aria-label="Ouvrir Mor"
            >
              {hasMorAccess ? (
                <>
                  <Brain className="h-6.5 w-6.5 text-primary animate-[pulse_3s_infinite_alternate]" />
                  {/* Micro notification status badge */}
                  <div className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-green-500 border border-[#0d121f] animate-[pulse_1.5s_infinite]" />
                </>
              ) : (
                <div className="relative">
                  <Brain className="h-6 w-6 opacity-50" />
                  <Lock className="h-3 w-3 absolute -top-1 -right-1" />
                </div>
              )}
            </button>

            {/* Premium glassmorphic tooltip */}
            <div className="absolute right-16 top-1/2 -translate-y-1/2 bg-white/95 dark:bg-slate-950/90 border border-slate-200/80 dark:border-white/10 backdrop-blur-md px-3.5 py-1.8 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-xl flex items-center gap-1.5 whitespace-nowrap z-20">
              <Activity className="h-3.5 w-3.5 text-primary animate-pulse" />
              <span>{hasMorAccess ? "Tuteur MOR Actif" : "Accès Premium Requis"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Chat Window with spring animation and expanded size */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="fixed right-3 sm:right-6 bottom-4 sm:bottom-6 z-50 bg-white/95 dark:bg-[#0f172a]/95 border border-slate-200/80 dark:border-white/10 backdrop-blur-2xl rounded-[2rem] shadow-[0_15px_50px_rgba(0,0,0,0.12)] dark:shadow-[0_0_80px_rgba(0,0,0,0.65)] overflow-hidden w-[calc(100vw-2rem)] max-w-[48rem] sm:w-[48rem] flex flex-col"
            style={{ height: isMinimized ? "52px" : "85vh", maxHeight: "900px", transformOrigin: 'bottom right' }}
          >
            {/* Header */}
            <div
              className={`px-5 py-4.5 flex items-center justify-between cursor-pointer border-b border-slate-100 dark:border-white/5 ${
                hasPriorityAccess
                  ? "bg-gradient-to-r from-violet-600/90 via-indigo-600/80 to-purple-600/90"
                  : "bg-gradient-to-r from-primary/90 to-indigo-600/90"
              }`}
              onClick={() => setIsMinimized(!isMinimized)}
            >
              <div className="flex items-center gap-3">
                <div className="h-8.5 w-8.5 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                  <Brain className="h-5 w-5 text-primary-foreground animate-pulse" />
                </div>
                <div>
                  <span className="font-black text-sm sm:text-base tracking-tight text-primary-foreground uppercase flex items-center gap-1.5 leading-none">
                    Mor
                    {hasPriorityAccess && (
                      <Badge className="bg-primary-foreground/20 text-primary-foreground text-[9px] px-1.5 py-0 border-0 uppercase font-black tracking-wider">
                        <Zap className="h-2.5 w-2.5 mr-0.5" />Pro
                      </Badge>
                    )}
                  </span>
                  <span className="text-[9px] font-bold text-primary-foreground/70 uppercase tracking-widest leading-none mt-1 block">
                    Tuteur Clinique IA
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary-foreground hover:bg-white/10 rounded-xl transition-all" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
                  <ChevronDown className={`h-4.5 w-4.5 transition-transform ${isMinimized ? "rotate-180" : ""}`} />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary-foreground hover:bg-white/10 rounded-xl transition-all" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
                  <X className="h-4.5 w-4.5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            {!isMinimized && (
              <div className="flex flex-col h-[calc(100%-52px)]">
                {/* Course Selector */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/2">
                  <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                    <SelectTrigger className="h-10 text-xs sm:text-sm border-slate-200/80 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-slate-800 dark:text-white/90 focus:border-primary/80">
                      <SelectValue placeholder="Choisir un cours..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white">
                      {courses.length === 0 ? (
                        <SelectItem value="none" disabled>Aucun cours disponible</SelectItem>
                      ) : (
                        courses.map((course) => (
                          <SelectItem key={course.id} value={course.id} className="text-xs sm:text-sm text-slate-700 dark:text-white/90 focus:bg-slate-100 dark:focus:bg-white/10 focus:text-slate-900 dark:focus:text-white">{course.title}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Messages Viewport */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-white dark:bg-slate-900">
                  {isLoadingData ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                        <div className={`max-w-[85%] rounded-[1.8rem] px-4.5 py-3.5 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-md shadow-lg shadow-primary/10"
                            : "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-md shadow-sm"
                        }`}>
                          <div
                            className="text-[15px] sm:text-[16px] leading-relaxed text-slate-900 dark:text-slate-100 select-text selection:bg-primary/30 font-medium"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatMarkdown(message.content)) }}
                          />
                          {message.sources && message.sources.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-white/10 space-y-1">
                              {message.sources.map((source, idx) => (
                                <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-white/70 mt-1 font-semibold">
                                  {source.type === "web" ? <Globe className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" /> : <BookOpen className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />}
                                  <span className="line-clamp-2">{source.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {message.action && (
                            <Button size="sm" variant="secondary" className="mt-3 w-full text-[12px] h-8.5 rounded-xl font-bold bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white border-0" onClick={() => executeAction(message.action)}>
                              {message.action.label}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Typing indicator */}
                  {isLoading && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="bg-slate-100/90 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-[1.8rem] rounded-bl-md px-5 py-4">
                        <div className="flex gap-2">
                          <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Replies */}
                {showQuickReplies && (
                  <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 overflow-x-auto bg-slate-50 dark:bg-slate-900">
                    {["Explique plus", "Autre question", "Mes résultats"].map((label) => (
                      <button
                        key={label}
                        onClick={() => handleSend(label)}
                        className="shrink-0 text-[12px] font-semibold px-4 py-2 rounded-full border border-primary/30 text-slate-700 dark:text-white hover:bg-primary/10 dark:hover:bg-primary/20 transition-all bg-slate-100 dark:bg-primary/10 active:scale-95"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input Area */}
                <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                  <div className="flex gap-2">
                    <Input
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Pose ta question clinique..."
                      className="h-12 text-sm sm:text-base px-4 rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
                      disabled={isLoading}
                    />
                    <Button onClick={() => handleSend()} disabled={isLoading || !question.trim()} className="h-12 w-12 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-lg flex items-center justify-center">
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MorChatWidget;
