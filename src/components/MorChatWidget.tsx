import { useState, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { useNavigate } from "react-router-dom";
import { X, Send, Loader2, BookOpen, Brain, Globe, Lock, Zap, Sparkles, ChevronDown, MessageCircle } from "lucide-react";
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
        supabase.from("courses").select("id, title").order("created_at", { ascending: false }),
        supabase.from("qcm_sessions").select("id, title, status, score, total_questions").order("created_at", { ascending: false }).limit(5)
      ]);
      
      const uniqueCourses: Course[] = [];
      const seenTitles = new Set<string>();
      (coursesResult.data || []).forEach((course: Course) => {
        const baseTitle = course.title.replace(/\s*\(Session\s*\d+\)\s*$/i, '').trim();
        const baseTitleLower = baseTitle.toLowerCase();
        if (!seenTitles.has(baseTitleLower)) {
          seenTitles.add(baseTitleLower);
          uniqueCourses.push({ ...course, title: baseTitle });
        }
      });
      setCourses(uniqueCourses);
      
      setRecentSessions(sessionsResult.data || []);
      if (uniqueCourses.length > 0 && !selectedCourseId) {
        setSelectedCourseId(uniqueCourses[0].id);
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

      {/* Floating Button with pulse */}
      {!isOpen && (
        <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-50 group">
          <button
            onClick={handleOpenWidget}
            className={`relative h-14 w-14 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center ${
              hasMorAccess
                ? "bg-gradient-primary text-primary-foreground hover:scale-110 animate-pulse-glow"
                : "bg-muted text-muted-foreground hover:scale-105"
            }`}
            aria-label="Ouvrir Mor"
          >
            {hasMorAccess ? (
              <Brain className="h-6 w-6" />
            ) : (
              <div className="relative">
                <Brain className="h-6 w-6 opacity-50" />
                <Lock className="h-3 w-3 absolute -top-1 -right-1" />
              </div>
            )}
          </button>
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-card border border-border rounded-lg shadow-lg text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            <MessageCircle className="h-3 w-3 inline mr-1" />
            {hasMorAccess ? "Discuter avec Mor" : "Accès Premium requis"}
          </div>
        </div>
      )}

      {/* Chat Window with scale+fade transition */}
      {isOpen && (
        <div
          className={`fixed right-3 sm:right-4 bottom-4 z-50 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-scale-in w-[calc(100vw-1.5rem)] max-w-[22rem] sm:w-[22rem] ${
            isMinimized ? "h-12" : "h-[500px] max-h-[80vh]"
          }`}
          style={{ transformOrigin: 'bottom right' }}
        >
          {/* Header */}
          <div
            className={`px-4 py-3 flex items-center justify-between cursor-pointer ${
              hasPriorityAccess
                ? "bg-gradient-to-r from-violet-500 to-purple-600"
                : "bg-gradient-primary"
            }`}
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <Brain className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm text-primary-foreground">Mor</span>
              {hasPriorityAccess && (
                <Badge className="bg-primary-foreground/20 text-primary-foreground text-[10px] px-1.5 py-0 border-0">
                  <Zap className="h-2 w-2 mr-0.5" />Pro
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
                <ChevronDown className={`h-3 w-3 transition-transform ${isMinimized ? "rotate-180" : ""}`} />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <div className="flex flex-col h-[calc(100%-48px)]">
              {/* Course Selector */}
              <div className="px-3 py-2 border-b border-border/50 bg-muted/20">
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger className="h-8 text-xs border-border/50 rounded-lg">
                    <SelectValue placeholder="Choisir un cours..." />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.length === 0 ? (
                      <SelectItem value="none" disabled>Aucun cours</SelectItem>
                    ) : (
                      courses.map((course) => (
                        <SelectItem key={course.id} value={course.id} className="text-xs">{course.title}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {isLoadingData ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                      <div className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted/50 text-foreground rounded-bl-md border border-border/30"
                      }`}>
                        <div
                          className="text-[13px] leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatMarkdown(message.content)) }}
                        />
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/20 space-y-1">
                            {message.sources.map((source, idx) => (
                              <div key={idx} className="flex items-start gap-1.5 text-[10px] opacity-70">
                                {source.type === "web" ? <Globe className="h-3 w-3 mt-0.5 shrink-0" /> : <BookOpen className="h-3 w-3 mt-0.5 shrink-0" />}
                                <span className="line-clamp-2">{source.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {message.action && (
                          <Button size="sm" variant="secondary" className="mt-2 w-full text-[11px] h-7 rounded-lg" onClick={() => executeAction(message.action)}>
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
                    <div className="bg-muted/50 border border-border/30 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies */}
              {showQuickReplies && (
                <div className="px-3 py-1.5 border-t border-border/30 flex gap-1.5 overflow-x-auto">
                  {["Explique plus", "Autre question", "Mes résultats"].map((label) => (
                    <button
                      key={label}
                      onClick={() => handleSend(label)}
                      className="shrink-0 text-[10px] px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="p-2.5 border-t border-border/50 bg-card">
                <div className="flex gap-1.5">
                  <Input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Pose ta question..."
                    className="h-9 text-xs rounded-xl"
                    disabled={isLoading}
                  />
                  <Button onClick={() => handleSend()} disabled={isLoading || !question.trim()} size="icon" className="h-9 w-9 shrink-0 rounded-xl">
                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default MorChatWidget;
