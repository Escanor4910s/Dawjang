import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Send, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { safeText } from "@/lib/textUtils";

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
    }
  }, [initialMessage, courses, selectedCourseId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkAuthAndLoadCourses = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please sign in to use Mor",
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
    } catch (error) {
      console.error("Error loading courses:", error);
      toast({
        title: "Error loading courses",
        description: "Could not load your courses. Please try again.",
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
        title: "Missing information",
        description: "Please select a course and enter a question",
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ask-mor", {
        body: {
          question: userMessage.content,
          courseId: selectedCourseId,
        },
      });

      if (error) throw error;

      // Ensure content is a string using safeText utility
      const answerContent = safeText(data.answer, "Réponse non disponible");
      
      // Safely handle sources - ensure all items are strings
      const safeSources = Array.isArray(data.sources) 
        ? data.sources.map((s: any) => safeText(s, ""))
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
        title: "Error",
        description: error.message || "Failed to get response from Mor",
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
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const containerClass = embedded 
    ? "flex flex-col h-full" 
    : "min-h-screen bg-background";
  
  const innerClass = embedded 
    ? "flex flex-col h-full px-6 py-4" 
    : "container mx-auto px-4 py-8 max-w-4xl";

  return (
    <div className={containerClass}>
      <div className={innerClass}>
        {/* Header - only show when not embedded */}
        {!embedded && (
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-full mb-4 shadow-medical">
              <BookOpen className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Mor</h1>
            <p className="text-muted-foreground">Votre tuteur virtuel en médecine</p>
          </div>
        )}

        {/* Course Selector */}
        <Card className={`p-4 shadow-card ${embedded ? 'mb-4' : 'mb-6'}`}>
          <label className="block text-sm font-medium text-foreground mb-2">
            Sélectionner un cours
          </label>
          <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
            <SelectTrigger>
              <SelectValue placeholder="Choisissez un cours..." />
            </SelectTrigger>
            <SelectContent>
              {courses.length === 0 ? (
                <SelectItem value="none" disabled>
                  Aucun cours disponible
                </SelectItem>
              ) : (
                courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Card>

        {/* Chat Messages */}
        <Card className={`p-6 overflow-y-auto shadow-card ${embedded ? 'flex-1 mb-4 min-h-0' : 'mb-6 min-h-[400px] max-h-[500px]'}`}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Posez une question sur votre cours et Mor vous aidera à comprendre
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs opacity-70">Sources:</p>
                        {message.sources.map((source, idx) => (
                          <p key={idx} className="text-xs mt-1 italic">
                            {source}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </Card>

        {/* Input Area */}
        <Card className="p-4 shadow-card">
          <div className="flex gap-2">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Posez votre question à Mor..."
              className="min-h-[80px] resize-none"
              disabled={isLoading || !selectedCourseId}
            />
            <Button
              onClick={handleAskMor}
              disabled={isLoading || !question.trim() || !selectedCourseId}
              size="icon"
              className="h-[80px] w-[80px]"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Mor est un tuteur virtuel. Il ne peut pas donner de diagnostic médical personnel ni de conseil thérapeutique.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default AskMor;
