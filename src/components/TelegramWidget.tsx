import { useState } from "react";
import { X, ChevronDown, Send as SendIcon, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const TelegramWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const handleOpenTelegram = () => {
    toast.info("Le canal Telegram sera bientôt disponible !");
    // Future: window.open("https://t.me/your_channel", "_blank");
  };

  return (
    <>
      {/* Floating Button - positioned to the LEFT of where Mor would be */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-3 right-16 sm:bottom-4 sm:right-[4.5rem] h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all z-50 flex items-center justify-center animate-fade-in bg-[#0088cc] text-white"
          aria-label="Ouvrir Telegram"
        >
          <SendIcon className="h-5 w-5" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`fixed right-16 sm:right-[4.5rem] bottom-4 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden transition-all duration-300 w-[calc(100vw-5rem)] max-w-[20rem] sm:w-80 ${isMinimized ? "h-12" : "h-[320px]"}`}>
          {/* Header */}
          <div
            className="px-3 py-2 flex items-center justify-between cursor-pointer bg-[#0088cc]"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <div className="flex items-center gap-2">
              <SendIcon className="h-4 w-4 text-white" />
              <span className="font-semibold text-sm text-white">Telegram</span>
              <Badge className="bg-white/20 text-white text-[10px] px-1.5 py-0">Communauté</Badge>
            </div>
            <div className="flex items-center gap-0.5">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
                <ChevronDown className={`h-3 w-3 transition-transform ${isMinimized ? "rotate-180" : ""}`} />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <div className="flex flex-col items-center justify-center h-[calc(100%-40px)] p-6 text-center">
              <div className="bg-[#0088cc]/10 p-4 rounded-full mb-4">
                <MessageSquare className="h-10 w-10 text-[#0088cc]" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Canal Telegram</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Rejoignez notre canal Telegram pour des discussions en temps réel avec la communauté Hippocampus.
              </p>
              <Button onClick={handleOpenTelegram} className="bg-[#0088cc] hover:bg-[#0077b3] text-white w-full">
                <SendIcon className="h-4 w-4 mr-2" />
                Rejoindre le canal
              </Button>
              <p className="text-xs text-muted-foreground mt-3">Bientôt disponible</p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default TelegramWidget;
