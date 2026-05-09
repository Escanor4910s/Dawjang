import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { BookOpen, FileText, Brain, FileSearch, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  id: string;
  title: string;
  type: "course" | "qcm" | "flashcard" | "summary";
  path: string;
}

const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName))) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const searchTerm = `%${q}%`;

    const [courses, qcms, flashcards, summaries] = await Promise.all([
      supabase.from("courses").select("id, title").eq("user_id", user.id).ilike("title", searchTerm).limit(5),
      supabase.from("qcm_sessions").select("id, title").eq("user_id", user.id).ilike("title", searchTerm).limit(5),
      supabase.from("flashcards").select("id, question").eq("user_id", user.id).ilike("question", searchTerm).limit(5),
      supabase.from("summaries").select("id, title").eq("user_id", user.id).ilike("title", searchTerm).limit(5),
    ]);

    const all: SearchResult[] = [
      ...(courses.data || []).map((c) => ({ id: c.id, title: c.title, type: "course" as const, path: "/quiz-library" })),
      ...(qcms.data || []).map((q) => ({ id: q.id, title: q.title, type: "qcm" as const, path: `/quiz/${q.id}` })),
      ...(flashcards.data || []).map((f) => ({ id: f.id, title: f.question, type: "flashcard" as const, path: "/flashcards" })),
      ...(summaries.data || []).map((s) => ({ id: s.id, title: s.title, type: "summary" as const, path: `/summary/${s.id}` })),
    ];

    setResults(all);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const getIcon = (type: string) => {
    switch (type) {
      case "course": return <BookOpen className="h-4 w-4 text-primary" />;
      case "qcm": return <FileText className="h-4 w-4 text-blue-500" />;
      case "flashcard": return <Brain className="h-4 w-4 text-purple-500" />;
      case "summary": return <FileSearch className="h-4 w-4 text-green-500" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case "course": return "Cours";
      case "qcm": return "QCM";
      case "flashcard": return "Flashcard";
      case "summary": return "Résumé";
      default: return "";
    }
  };

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate(result.path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Rechercher cours, QCM, flashcards, résumés..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
        {["course", "qcm", "flashcard", "summary"].map((type) => {
          const items = results.filter((r) => r.type === type);
          if (items.length === 0) return null;
          return (
            <CommandGroup key={type} heading={getLabel(type)}>
              {items.map((result) => (
                <CommandItem
                  key={result.id}
                  onSelect={() => handleSelect(result)}
                  className="flex items-center gap-2"
                >
                  {getIcon(result.type)}
                  <span className="truncate">{result.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
};

export default GlobalSearch;
