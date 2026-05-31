import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, X, Minimize2, Maximize2, Send, 
  Brain, FileText, Activity, ChevronRight, CornerDownLeft
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { askMorWithPuter } from "@/lib/puterAiService";

// --- Types ---
type MorState = "widget" | "floating" | "minimized" | "sidebar";

interface Message {
  id: string;
  role: "user" | "mor";
  content: string;
  isTyping?: boolean;
}

interface AgentMorProps {
  // Permet de forcer l'affichage en sidebar depuis une page comme Quiz.tsx
  forceState?: MorState;
  contextMessage?: string;
  onClose?: () => void;
}

export const AgentMor = ({ forceState, contextMessage, onClose }: AgentMorProps) => {
  const [uiState, setUiState] = useState<MorState>(forceState || "widget");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "mor", content: "Bonjour Docteur. Je suis l'Agent MOR. Avez-vous besoin d'une justification sur ce diagnostic ?" }
  ]);
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // Synchronisation avec les props externes (pour le QCM)
  useEffect(() => {
    if (forceState) setUiState(forceState);
  }, [forceState]);

  // Scroll automatique doux
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, uiState]);

  // Vraie réponse de l'IA (Puter)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, newMsg]);
    setInput("");

    // Ajouter le loader
    const typingId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: typingId, role: "mor", content: "", isTyping: true }]);

    try {
      const historyForApi = [...messages, newMsg].map(m => ({
        role: m.role === "user" ? "user" as const : "assistant" as const,
        content: m.content
      }));
      
      const { answer } = await askMorWithPuter(historyForApi, contextMessage || "", "Discussion Générale");
      
      setMessages(prev => prev.map(m => 
        m.id === typingId 
          ? { id: typingId, role: "mor", content: answer } 
          : m
      ));
    } catch (error) {
      console.error("Erreur AgentMor:", error);
      setMessages(prev => prev.map(m => 
        m.id === typingId 
          ? { id: typingId, role: "mor", content: "Désolé, je rencontre un problème de connexion à l'IA." } 
          : m
      ));
    }
  };

  // --- RENDU DES MESSAGES (Style Éditorial, pas de bulles WhatsApp) ---
  const renderMessage = (msg: Message) => {
    if (msg.isTyping) {
      return (
        <div key={msg.id} className="flex items-start gap-4 py-4">
          <div className="h-6 w-6 rounded-full bg-[#5B21B6]/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-3 w-3 text-[#5B21B6] animate-pulse" />
          </div>
          <div className="flex gap-1 pt-2">
            <div className="w-1.5 h-1.5 bg-[#5B21B6]/40 rounded-full animate-[bounce_1s_infinite_0ms]" />
            <div className="w-1.5 h-1.5 bg-[#5B21B6]/60 rounded-full animate-[bounce_1s_infinite_200ms]" />
            <div className="w-1.5 h-1.5 bg-[#5B21B6] rounded-full animate-[bounce_1s_infinite_400ms]" />
          </div>
        </div>
      );
    }

    const isMor = msg.role === "mor";
    return (
      <div key={msg.id} className={cn("py-4 flex flex-col gap-2", isMor ? "border-l-2 border-[#5B21B6] pl-4 ml-1" : "items-end")}>
        {isMor && (
          <span className="text-[9px] font-black uppercase tracking-widest text-[#888888] dark:text-[#8E8E8A] flex items-center gap-1.5">
            <Sparkles className="h-2.5 w-2.5 text-[#5B21B6]" /> Agent MOR
          </span>
        )}
        <div className={cn(
          "text-sm leading-relaxed",
          isMor 
            ? "text-[#111111] dark:text-[#F4F4F2] font-medium" 
            : "bg-[#FAFAF8] dark:bg-[#161614] border border-black/5 dark:border-white/5 px-4 py-2.5 rounded-2xl text-[#666666] dark:text-[#8E8E8A] max-w-[85%]"
        )}>
          {msg.content}
        </div>
      </div>
    );
  };

  return (
    <>
      <AnimatePresence mode="wait">
        
        {/* ==============================================================
            ÉTAT 1 : LE WIDGET FLOTTANT (Discret, Coin inférieur droit)
            ============================================================== */}
        {uiState === "widget" && (
          <motion.div
            key="widget"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setUiState("floating")}
            className="fixed bottom-6 right-6 z-50 cursor-pointer group"
          >
            <div className="h-14 px-5 bg-[#111111] dark:bg-white text-white dark:text-[#111111] rounded-full flex items-center gap-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] dark:shadow-[0_10px_40px_-10px_rgba(255,255,255,0.15)] border border-white/10 dark:border-black/10">
              <Sparkles className="h-4 w-4 text-[#5B21B6] group-hover:animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest">Agent MOR</span>
            </div>
          </motion.div>
        )}

        {/* ==============================================================
            ÉTAT 2 : LA SECTION RECTANGULAIRE MINIMISÉE (Dynamic Island)
            ============================================================== */}
        {uiState === "minimized" && (
          <motion.div
            key="minimized"
            layoutId="mor-container"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-6 right-6 z-50 w-72 bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 shadow-2xl rounded-[1.5rem] overflow-hidden"
          >
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#FAFAF8] dark:hover:bg-white/5 transition-colors" onClick={() => setUiState("floating")}>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#5B21B6]/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-[#5B21B6] animate-pulse" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#111111] dark:text-white">MOR en veille</h4>
                  <p className="text-[9px] text-[#888888] dark:text-[#8E8E8A] truncate w-32">Cliquez pour reprendre...</p>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onClose ? onClose() : setUiState("widget"); }}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-[#888888]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ==============================================================
            ÉTAT 3 : FENÊTRE FLOTTANTE (Le Terminal de Poche)
            ============================================================== */}
        {uiState === "floating" && (
          <motion.div
            key="floating"
            layoutId="mor-container"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] max-h-[80vh] bg-white dark:bg-[#161614] border border-black/10 dark:border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-[2rem] flex flex-col overflow-hidden"
          >
            {/* Header Flottant */}
            <div className="flex items-center justify-between p-5 border-b border-black/5 dark:border-white/5 bg-[#FAFAF8] dark:bg-[#0E0E0C]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-[#111111] dark:bg-white rounded-xl flex items-center justify-center shadow-inner">
                  <Sparkles className="h-5 w-5 text-white dark:text-[#111111]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#111111] dark:text-white">Agent MOR</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#888888] dark:text-[#8E8E8A]">Prêt</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setUiState("minimized")} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-[#888888] transition-colors" title="Réduire">
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button onClick={() => { onClose ? onClose() : setUiState("widget"); }} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white text-[#888888] transition-colors" title="Fermer">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Zone de Chat */}
            <div className="flex-1 overflow-y-auto p-6 editorial-scrollbar">
              {messages.map(renderMessage)}
              <div ref={endOfMessagesRef} />
            </div>

            {/* Zone de Saisie (Style Command Prompt) */}
            <div className="p-4 bg-white dark:bg-[#161614] border-t border-black/5 dark:border-white/5">
              <form onSubmit={handleSubmit} className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Posez votre question clinique..."
                  className="w-full bg-[#FAFAF8] dark:bg-[#0E0E0C] border border-black/10 dark:border-white/10 focus:border-[#5B21B6] dark:focus:border-[#5B21B6] rounded-2xl pl-5 pr-14 py-4 text-sm text-[#111111] dark:text-[#F4F4F2] placeholder:text-[#888888] dark:placeholder:text-[#8E8E8A] outline-none transition-colors"
                />
                <button 
                  type="submit" 
                  disabled={!input.trim()}
                  className="absolute right-2 h-10 w-10 bg-[#111111] dark:bg-white text-white dark:text-[#111111] rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-[#5B21B6] dark:hover:bg-[#5B21B6] dark:hover:text-white transition-colors"
                >
                  <CornerDownLeft className="h-4 w-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {/* ==============================================================
            ÉTAT 4 : BARRE LATÉRALE (Pour le QCM / Immersion totale)
            ============================================================== */}
        {uiState === "sidebar" && (
          <>
            {/* Overlay d'assombrissement doux (pas noir, juste flou) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onClose ? onClose() : setUiState("widget")}
              className="fixed inset-0 bg-black/5 dark:bg-black/40 backdrop-blur-[2px] z-[90]"
            />
            
            <motion.div
              key="sidebar"
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 250, damping: 30 }}
              className="fixed top-4 bottom-4 right-4 z-[100] w-[450px] bg-[#FAFAF8] dark:bg-[#0E0E0C] border border-black/10 dark:border-white/10 shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.1)] rounded-[2.5rem] flex flex-col overflow-hidden"
            >
              {/* Header Sidebar Monumental */}
              <div className="p-8 border-b border-black/5 dark:border-white/5 bg-white dark:bg-[#161614] shrink-0">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-[#5B21B6]/10 rounded-2xl flex items-center justify-center border border-[#5B21B6]/20">
                      <Brain className="h-6 w-6 text-[#5B21B6]" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#111111] dark:text-white">Agent MOR</h2>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#888888] dark:text-[#8E8E8A]">Supervision QCM</p>
                    </div>
                  </div>
                  <button onClick={() => onClose ? onClose() : setUiState("widget")} className="h-8 w-8 rounded-full bg-[#FAFAF8] dark:bg-[#0E0E0C] flex items-center justify-center hover:bg-black/5 text-[#111111] dark:text-white transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                
                {/* Actions rapides contextuelles */}
                <div className="flex gap-2">
                  <button className="flex-1 py-2 rounded-xl bg-[#FAFAF8] dark:bg-[#0E0E0C] border border-black/5 dark:border-white/5 text-[10px] font-bold uppercase tracking-widest hover:border-[#5B21B6] transition-colors">
                    Simplifier
                  </button>
                  <button className="flex-1 py-2 rounded-xl bg-[#FAFAF8] dark:bg-[#0E0E0C] border border-black/5 dark:border-white/5 text-[10px] font-bold uppercase tracking-widest hover:border-[#5B21B6] transition-colors">
                    Traduire
                  </button>
                </div>
              </div>

              {/* Chat Area Sidebar */}
              <div className="flex-1 overflow-y-auto p-8 editorial-scrollbar bg-[#FAFAF8] dark:bg-[#0E0E0C]">
                {/* Contexte du QCM inséré en entête de chat si existant */}
                {contextMessage && (
                  <div className="mb-8 p-5 bg-white dark:bg-[#161614] border border-black/5 dark:border-white/5 rounded-2xl shadow-sm relative">
                    <div className="absolute -left-2.5 top-5 w-5 h-5 bg-[#FAFAF8] dark:bg-[#0E0E0C] rotate-45 border-l border-b border-black/5 dark:border-white/5" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#5B21B6] mb-2 flex items-center gap-2">
                      <FileText className="h-3 w-3" /> Question en cours
                    </p>
                    <p className="text-sm text-[#111111] dark:text-[#F4F4F2] leading-relaxed italic">
                      "{contextMessage.substring(0, 100)}..."
                    </p>
                  </div>
                )}
                
                {messages.map(renderMessage)}
                <div ref={endOfMessagesRef} />
              </div>

              {/* Input Area Sidebar */}
              <div className="p-6 bg-white dark:bg-[#161614] border-t border-black/5 dark:border-white/5 shrink-0">
                <form onSubmit={handleSubmit} className="relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Demander une justification..."
                    className="w-full bg-[#FAFAF8] dark:bg-[#0E0E0C] border border-black/10 dark:border-white/10 focus:border-[#5B21B6] rounded-2xl pl-5 pr-14 py-4 text-sm text-[#111111] dark:text-[#F4F4F2] placeholder:text-[#888888] dark:placeholder:text-[#8E8E8A] outline-none transition-colors"
                  />
                  <button 
                    type="submit" 
                    disabled={!input.trim()}
                    className="absolute right-2 top-2 h-10 w-10 bg-[#111111] dark:bg-white text-white dark:text-[#111111] rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-[#5B21B6] dark:hover:bg-[#5B21B6] dark:hover:text-white transition-colors"
                  >
                    <Send className="h-4 w-4 ml-0.5" />
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}

      </AnimatePresence>
    </>
  );
};

export default AgentMor;
