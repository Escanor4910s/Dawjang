import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Users, Clock, Trash2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useUserRole } from "@/hooks/useUserRole";

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  displayName?: string;
  isAdmin?: boolean;
}

const CommunityChat = () => {
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { isAdmin } = useUserRole();

  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("community_messages").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;

      const userIds = [...new Set((data || []).map((m) => m.user_id))];
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, first_name, name").in("id", userIds),
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds).eq("role", "admin"),
      ]);

      const nameMap = new Map((profilesRes.data || []).map((p) => [p.id, p.first_name || p.name || "Étudiant"]));
      const adminSet = new Set((rolesRes.data || []).map((r) => r.user_id));

      setMessages(
        (data || []).map((m) => ({
          ...m,
          displayName: nameMap.get(m.user_id) || "Étudiant",
          isAdmin: adminSet.has(m.user_id),
        }))
      );
    } catch {
      console.error("Error fetching messages");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
    fetchMessages();
  }, [fetchMessages]);

  useRealtimeSubscription({ table: "community_messages", event: "*", onUpdate: fetchMessages });

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUserId) return;
    const { error } = await supabase.from("community_messages").insert({ user_id: currentUserId, content: newMessage.trim() });
    if (error) { toast.error("Erreur lors de l'envoi"); return; }
    setNewMessage("");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("community_messages").delete().eq("id", id);
    if (error) toast.error("Erreur lors de la suppression");
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `Il y a ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    return new Date(dateStr).toLocaleDateString("fr-FR");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5 text-primary" /><span>Discussion Générale</span>
              <Badge variant="outline" className="ml-auto"><Users className="h-3 w-3 mr-1" />En ligne</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Input placeholder="Partagez vos questions, conseils ou réussites..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleSendMessage()} className="flex-1" />
              <Button onClick={handleSendMessage} className="px-3 bg-foreground text-background hover:bg-foreground/90"><Send className="h-4 w-4" /></Button>
            </div>

            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {loading ? (
                  <div className="animate-pulse space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-lg" />)}</div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucun message. Soyez le premier à écrire !</p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 rounded-lg border ${
                        message.isAdmin
                          ? "bg-gradient-to-r from-primary/15 to-primary/5 border-primary/40 shadow-md"
                          : "bg-background/50 border-border/50"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`font-semibold ${message.isAdmin ? "text-primary" : "text-foreground"}`}>
                            {message.displayName}
                          </span>
                          {message.isAdmin && (
                            <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 gap-1">
                              <ShieldCheck className="h-3 w-3" />Admin
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /><span>{formatTime(message.created_at)}</span>
                          </div>
                          {message.user_id === currentUserId && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(message.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className={`leading-relaxed ${message.isAdmin ? "text-foreground font-medium" : "text-foreground"}`}>{message.content}</p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader><CardTitle className="flex items-center space-x-2"><Users className="h-4 w-4 text-primary" /><span className="text-sm">Communauté</span></CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Échangez avec d'autres étudiants en médecine. Posez vos questions, partagez vos astuces !</p></CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CommunityChat;
