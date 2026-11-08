// src/components/MorChatWidget.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  X,
  Maximize2,
  Minimize2,
  ArrowUp,
  RotateCcw,
  Layers,
  CheckCircle2,
  CornerDownRight,
  Globe,
  Compass,
  Mic,
  MicOff,
  ArrowUpRight,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Emblème géométrique noir officiel de l'Agent MOR (Bouton flottant purement circulaire)
 */
export function MorGeometricLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1000 1000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <mask id="mor-top-dome-mask">
          <rect width="1000" height="1000" fill="white" />
          <rect x="392" y="110" width="24" height="286" fill="black" />
          <rect x="584" y="110" width="24" height="286" fill="black" />
          <path
            d="M 294 340 C 254 386, 236 438, 232 492 L 294 492 Z"
            fill="black"
          />
          <path
            d="M 706 340 C 746 386, 764 438, 768 492 L 706 492 Z"
            fill="black"
          />
        </mask>
      </defs>

      <path
        d="M 130 490 A 370 370 0 0 1 870 490 Z"
        fill="currentColor"
        mask="url(#mor-top-dome-mask)"
      />

      <path
        d="M 388 504 L 612 504 L 570 528 L 594 558 L 554 558 L 554 598 L 518 574 L 500 612 L 482 574 L 446 598 L 446 558 L 406 558 L 430 528 Z"
        fill="currentColor"
      />

      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 131 504 L 364 504 L 266 576 L 152 576 Z M 166 524 L 310 524 L 258 556 L 176 556 Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 869 504 L 636 504 L 734 576 L 848 576 Z M 834 524 L 690 524 L 742 556 L 824 556 Z"
        fill="currentColor"
      />

      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 500 634 L 568 766 L 568 846 L 500 870 L 432 846 L 432 766 Z M 500 678 L 544 762 L 544 824 L 500 842 L 456 824 L 456 762 Z"
        fill="currentColor"
      />

      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 432 620 L 432 766 L 364 838 L 294 818 L 264 754 L 362 650 Z M 408 660 L 408 756 L 354 812 L 312 798 L 292 752 L 370 672 Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 568 620 L 568 766 L 636 838 L 706 818 L 736 754 L 638 650 Z M 592 660 L 592 756 L 646 812 L 688 798 L 708 752 L 630 672 Z"
        fill="currentColor"
      />

      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 362 576 L 266 576 L 166 618 L 184 688 L 250 740 L 362 650 Z M 338 596 L 262 596 L 194 628 L 208 674 L 254 710 L 338 642 Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 638 576 L 734 576 L 834 618 L 816 688 L 750 740 L 638 650 Z M 662 596 L 738 596 L 806 628 L 792 674 L 746 710 L 662 642 Z"
        fill="currentColor"
      />

      <path d="M 362 520 L 406 542 L 370 566 L 298 566 Z" fill="currentColor" />
      <path d="M 638 520 L 594 542 L 630 566 L 702 566 Z" fill="currentColor" />
      <path d="M 398 574 L 430 574 L 402 636 L 370 636 Z" fill="currentColor" />
      <path d="M 602 574 L 570 574 L 598 636 L 630 636 Z" fill="currentColor" />
      <path d="M 448 612 L 486 590 L 486 650 L 448 710 Z" fill="currentColor" />
      <path d="M 552 612 L 514 590 L 514 650 L 552 710 Z" fill="currentColor" />
    </svg>
  );
}

export interface AgentActionLink {
  label: string;
  route: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  webSources?: string[];
  suggestedActions?: AgentActionLink[];
  timestamp: string;
}

const CHAT_HISTORY_STORAGE_KEY = "dawjang_mor_professor_history_v1";

/**
 * Nettoie toute trace de syntaxe Markdown brute (**, ##, ```) pour un rendu humain et naturel
 */
interface SpeechResultEvent {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechWindow {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

function formatProfessorText(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, (match) =>
      match.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "")
    )
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();
}

/**
 * Inspecte en temps réel toutes les données et fonctionnalités de l'application DawJang
 */
function gatherLiveApplicationContext(currentPathname: string) {
  try {
    const profile = JSON.parse(
      localStorage.getItem("hippocampus_user_profile_sn_v1") || "{}"
    );
    const stats = JSON.parse(
      localStorage.getItem("hippocampus_user_telemetry_v2") || "{}"
    );
    const courses = JSON.parse(
      localStorage.getItem("hippocampus_courses_library_v2") || "[]"
    );
    const quizzes = JSON.parse(
      localStorage.getItem("hippocampus_saved_quizzes_v1") || "[]"
    );
    const summaries = JSON.parse(
      localStorage.getItem("hippocampus_clean_summaries_v4") || "[]"
    );
    const flashcards = JSON.parse(
      localStorage.getItem("hippocampus_core_flashcards_v6") || "[]"
    );
    const customNodes = JSON.parse(
      localStorage.getItem("hippocampus_student_custom_nodes_v2") || "[]"
    );

    const courseTitles = Array.isArray(courses)
      ? courses.map((c: { title?: string; subject?: string }) => `${c.title} (${c.subject || "Cours"})`).slice(0, 12)
      : [];
    const quizTitles = Array.isArray(quizzes)
      ? quizzes
          .map((q: { title?: string; questions?: unknown[] }) => `${q.title} (${q.questions?.length || 0} QCM)`)
          .slice(0, 12)
      : [];
    const summaryTitles = Array.isArray(summaries)
      ? summaries.map((s: { title?: string }) => s.title).slice(0, 10)
      : [];

    // Extrait le contenu pertinent des cours de l'utilisateur pour répondre aux questions sur ses propres leçons
    const courseSnippets = Array.isArray(courses)
      ? courses
          .slice(0, 5)
          .map(
            (c: { title?: string; content?: string }) =>
              `[Cours: ${c.title}] : ${(c.content || "").slice(0, 450)}`
          )
          .join("\n")
      : "";

    return {
      studentName: profile.fullName || "l'étudiant",
      studyLevel: profile.studyLevel || "Licence / Master / Doctorat",
      university: profile.university || "Université au Sénégal (UCAD, UGB, UIDT, UASZ)",
      lv: stats.level || 5,
      xp: stats.xp || 640,
      credits: stats.credits ?? 420,
      daysRemaining: stats.daysRemaining ?? 24,
      isPro: stats.isPremium !== false,
      currentPathname,
      coursesCount: Array.isArray(courses) ? courses.length : 0,
      courseTitles,
      courseSnippets,
      quizzesCount: Array.isArray(quizzes) ? quizzes.length : 0,
      quizTitles,
      summariesCount: Array.isArray(summaries) ? summaries.length : 0,
      summaryTitles,
      flashcardsCount: Array.isArray(flashcards) ? flashcards.length : 0,
      customNodes,
    };
  } catch {
    return {
      studentName: "l'étudiant",
      studyLevel: "Cursus universitaire",
      university: "Sénégal",
      lv: 5,
      xp: 640,
      credits: 420,
      daysRemaining: 24,
      isPro: true,
      currentPathname,
      coursesCount: 0,
      courseTitles: [],
      courseSnippets: "",
      quizzesCount: 0,
      quizTitles: [],
      summariesCount: 0,
      summaryTitles: [],
      flashcardsCount: 0,
      customNodes: [],
    };
  }
}

/**
 * Recherche en direct sur Internet (API Wikipédia FR + DuckDuckGo Instant Answer)
 * Permet à l'agent de disposer de données factuelles vérifiées sur n'importe quel sujet externe
 */
async function fetchLiveWebKnowledge(query: string): Promise<{
  contextText: string;
  sources: string[];
}> {
  const cleanQuery = query
    .replace(
      /^(explique|qu'est-ce que|c'est quoi|définis|parle-moi de|comment fonctionne|qui est|résume)\s+/i,
      ""
    )
    .replace(/[?!.]/g, "")
    .trim();

  if (cleanQuery.length < 3) return { contextText: "", sources: [] };

  const sources: string[] = [];
  const snippets: string[] = [];

  try {
    const wikiSearchUrl = `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      cleanQuery
    )}&utf8=&format=json&origin=*&srlimit=2`;

    const searchRes = await fetch(wikiSearchUrl);
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const hits = searchData?.query?.search || [];

      for (const hit of hits.slice(0, 2)) {
        const title = hit.title;
        const summaryUrl = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
          title
        )}`;
        const sumRes = await fetch(summaryUrl);
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          if (sumData?.extract) {
            snippets.push(`[Source Web — ${title}] : ${sumData.extract}`);
            sources.push(title);
          }
        }
      }
    }
  } catch {
    // Poursuit silencieusement si hors-ligne
  }

  return {
    contextText: snippets.join("\n\n"),
    sources,
  };
}

/**
 * Détecte les raccourcis d'action dans l'application pertinents par rapport à la question ou la réponse
 */
function detectAppActionsForQuery(query: string): AgentActionLink[] {
  const q = String(query || "").toLowerCase();
  const actions: AgentActionLink[] = [];

  if (q.includes("lacune") || q.includes("stat") || q.includes("faiblesse") || q.includes("score")) {
    actions.push({ label: "Ouvrir le Rapport des Lacunes", route: "/stats?view=lacunes" });
  }
  if (q.includes("examen") || q.includes("épreuve") || q.includes("chrono")) {
    actions.push({ label: "Aller au Simulateur d'Examens", route: "/exams" });
  }
  if (q.includes("qcm") || q.includes("quiz") || q.includes("question")) {
    actions.push({ label: "Ouvrir le Constructeur de QCM", route: "/quiz" });
  }
  if (q.includes("flashcard") || q.includes("carte") || q.includes("nœud") || q.includes("noeud") || q.includes("révis")) {
    actions.push({ label: "Ouvrir les Flashcards", route: "/flashcards" });
  }
  if (q.includes("résumé") || q.includes("resume") || q.includes("rédacteur") || q.includes("redacteur") || q.includes("synthèse")) {
    actions.push({ label: "Ouvrir le Rédacteur & Résumés", route: "/summaries" });
  }
  if (q.includes("cours") || q.includes("bibliothèque") || q.includes("upload") || q.includes("importer") || q.includes("masse")) {
    actions.push({ label: "Ouvrir la Bibliothèque de Cours", route: "/library" });
  }
  if (q.includes("duel") || q.includes("arène") || q.includes("elo") || q.includes("adversaire")) {
    actions.push({ label: "Rejoindre l'Arène des Duels", route: "/duels" });
  }
  if (q.includes("niveau") || q.includes("lv") || q.includes("badge") || q.includes("médaille") || q.includes("paramètre") || q.includes("mot de passe") || q.includes("photo")) {
    actions.push({ label: "Ouvrir Paramètres & Carte Prestige", route: "/settings" });
  }
  if (q.includes("abonnement") || q.includes("crédit") || q.includes("souscription") || q.includes("wave") || q.includes("pro") || q.includes("résilier")) {
    actions.push({ label: "Gérer ma Souscription & Crédits", route: "/subscription" });
  }
  if (q.includes("planning") || q.includes("agenda") || q.includes("emploi du temps")) {
    actions.push({ label: "Voir ma Planification", route: "/planning" });
  }

  return actions.slice(0, 2);
}

/**
 * Moteur de génération dynamique en direct (LLM + Internet + Connaissance complète de DawJang)
 */
async function generateProfessorResponse(
  userQuery: string,
  conversationHistory: ChatMessage[],
  currentPathname: string
): Promise<{
  reply: string;
  webSources: string[];
  actions: AgentActionLink[];
}> {
  const appCtx = gatherLiveApplicationContext(currentPathname);
  const actions = detectAppActionsForQuery(userQuery);

  // 1. Recherche Web en direct pour enrichir le contexte factuel
  const webData = await fetchLiveWebKnowledge(userQuery);

  // 2. Construction du prompt système donnant à MOR la posture d'un vrai Professeur + les pleins accès à DawJang
  const systemPrompt = `Tu es le Professeur MOR, le mentor académique, médical et scientifique intégré au studio DawJang (au Sénégal).
Tu parles comme un vrai professeur d'université passionné, humain, chaleureux, clair et rigoureux.
RÈGLES ABSOLUES DE STYLE :
- Ne parle JAMAIS comme un robot ou une IA générique.
- N'utilise JAMAIS d'astérisques (**), ni de dièses (##) dans tes réponses. Écris en français fluide, bien ponctué, avec des paragraphes aérés.
- Tu réponds à TOUTES les questions : qu'elles portent sur la médecine, les sciences, la culture générale, l'actualité, ou le fonctionnement technique de l'application DawJang.

DONNÉES EN DIRECT DE L'ÉTUDIANT CONNECTÉ DANS DAWJANG :
- Nom : ${appCtx.studentName}
- Niveau d'études : ${appCtx.studyLevel} (${appCtx.university})
- Grade Gamification : LV.${appCtx.lv} (${appCtx.xp} XP) | Plan : ${appCtx.isPro ? "PRO" : "Standard"} (${appCtx.credits} crédits IA, ${appCtx.daysRemaining} jours restants)
- Page actuelle de l'étudiant : ${appCtx.currentPathname}
- Cours enregistrés dans sa Bibliothèque (${appCtx.coursesCount}) : ${appCtx.courseTitles.join(", ") || "Aucun cours"}
- Banques de QCM créées (${appCtx.quizzesCount}) : ${appCtx.quizTitles.join(", ") || "Aucun QCM"}
- Fiches de résumés (${appCtx.summariesCount}) : ${appCtx.summaryTitles.join(", ") || "Aucun résumé"}
- Flashcards actives : ${appCtx.flashcardsCount} cartes | Nœuds personnalisés : ${appCtx.customNodes.join(", ")}
${appCtx.courseSnippets ? `\nEXTRAITS DES COURS DE L'ÉTUDIANT :\n${appCtx.courseSnippets}` : ""}

GUIDE COMPLET DE L'APPLICATION DAWJANG (POUR GUIDER L'ÉTUDIANT EN CAS DE PROBLÈME) :
- Bibliothèque & Cours (/library) : Permet de basculer entre Mosaïque et Alignement. Le bouton "Nouveau cours" permet de faire un Upload Unique ou un Upload de Masse (plusieurs fichiers d'un coup) avec détection des doublons et suppression avant enregistrement.
- Rédacteur & Résumés (/summaries) : Permet d'importer n'importe quel fichier et de générer un résumé selon 3 paliers ("À partir des objectifs du cours" qui développe chaque objectif, "Résumé complet", ou "Points clés"). Un modal d'aperçu s'ouvre, puis le bouton "Passer à l'étape suivante" ouvre Le Rédacteur (feuille redimensionnable à la souris avec barre Word complète : Annuler/Rétablir, Gras, Titre, Sous-titre, Surligneur, Alignement). Le bouton "Enregistrer la fiche" envoie le résumé dans "Mes Résumés" où se trouvent les boutons "Copier" et "Télécharger".
- Constructeur de QCM (/quiz) : Création manuelle ou par IA. En vue Mosaïque, l'icône Chronomètre sous la poubelle lance le Mode Examen. En vue Alignement, le bouton "Mode Examen" est affiché sur la ligne.
- Simulateur d'Examens (/exams) : Épreuve chronométrée pleine largeur avec ruban de navigation horizontal (1, 2, 3...), élimination d'hypothèses (icône œil barré), raccourcis clavier A-E et procès-verbal de correction.
- Révision & Flashcards (/flashcards) : L'étudiant peut créer et supprimer ses propres Nœuds personnalisés (bouton ×). Dans "Nouvelle Carte", le mode "Construire avec l'IA" propose 3 calibrages : "À partir des Objectifs", "Aléatoire par Pertinence" et "Depuis mes Erreurs QCM" (supporte les QCM classiques et le Jumelage).
- Duels en ligne (/duels) : On choisit d'abord le QCM dans sa banque et la cadence du chronomètre (15s Blitz, 30s Turbo, 45s Tactique, 60s Maître), puis on clique sur "Passer à l'étape suivante" qui ouvre un modal avec 2 choix animés : "Créer un lobby privé" (avec code et radar d'attente) ou "Rejoindre un salon". Une fois les 2 joueurs connectés, le bouton "Lancer le duel" apparaît.
- Statistiques & Rapport de Lacunes (/stats et /stats?view=lacunes) : Détecte automatiquement les chapitres dont la précision est inférieure au seuil de 60% et permet de lancer un rattrapage direct.
- Paramètres (/settings) : Permet de modifier sa photo de profil, son téléphone (+221), son niveau (Licence 1 à Doctorat / Interne), de voir sa Carte de Prestige avec ses médailles militaires épinglées (30 médailles de 500 à 1 000 000 XP), et d'exporter/restaurer une sauvegarde JSON.
- Souscription (/subscription) : Affiche les jours restants, les crédits IA, permet de résilier à tout moment et pré-remplit automatiquement le nom, l'e-mail et le téléphone lors du choix d'un plan (Wave, Orange Money, Carte).

${webData.contextText ? `\nINFORMATIONS TEMPS RÉEL EXTRAITES D'INTERNET SUR LA QUESTION :\n${webData.contextText}` : ""}`;

  const recentMessages = conversationHistory.slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // 3. Fonction serveur « mor-chat » (Gemini 2.5 Flash via OpenRouter, clé stockée côté serveur)
  try {
    const { data, error } = await supabase.functions.invoke("mor-chat", {
      body: {
        messages: [
          { role: "system", content: systemPrompt },
          ...recentMessages,
          { role: "user", content: userQuery },
        ],
      },
    });

    if (!error && data && (data.reply || data.content || data.message)) {
      return {
        reply: formatProfessorText(data.reply || data.content || data.message),
        webSources: webData.sources,
        actions,
      };
    }
  } catch {
    // Passe immédiatement au moteur LLM direct
  }

  // 4. Aucun relais tiers : le contexte de l'étudiant (cours, profil) ne quitte jamais
  //    le couple application + fonction serveur « mor-chat » (Gemini 2.5 Flash via OpenRouter).

  // 5. Tentative C : Si seul Wikipédia / Web ou les données locales sont accessibles
  if (webData.contextText) {
    return {
      reply: formatProfessorText(
        `Voici l'analyse précise concernant votre question :\n\n${webData.contextText.replace(
          /\[Source Web — .*?\] : /g,
          ""
        )}\n\nSouhaitez-vous que nous approfondissions un aspect particulier ou que nous transformions ce point en fiche de révision dans votre studio DawJang ?`
      ),
      webSources: webData.sources,
      actions,
    };
  }

  // Réponse dynamique basée sur l'inspection en direct de l'application si hors-ligne
  return {
    reply: formatProfessorText(
      `Je suis à votre disposition, ${appCtx.studentName}. Dans votre studio DawJang (${appCtx.studyLevel}), vous disposez actuellement de ${appCtx.coursesCount} cours enregistrés (${appCtx.courseTitles.slice(0, 3).join(", ") || "aucun cours"}), ${appCtx.quizzesCount} banques de QCM et ${appCtx.flashcardsCount} flashcards actives.\n\nDites-moi précisément le sujet que vous souhaitez approfondir ou la fonctionnalité sur laquelle vous voulez que je vous guide.`
    ),
    webSources: [],
    actions,
  };
}

export function MorChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const getInitialGreeting = useCallback((): ChatMessage[] => {
    const ctx = gatherLiveApplicationContext(location.pathname);
    return [
      {
        id: "msg-welcome",
        role: "assistant",
        content: `Bonjour ${ctx.studentName}. Je suis le Professeur MOR, connecté en direct à votre studio DawJang et au Web. Posez-moi n'importe quelle question — qu'il s'agisse d'un cours, d'un concept médical ou scientifique hors application, ou du fonctionnement d'un outil de votre espace.`,
        timestamp: "En direct",
      },
    ];
  }, [location.pathname]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignorer
    }
    return getInitialGreeting();
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      // Ignorer
    }
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen]);

  // Reconnaissance vocale (Permet de parler directement au Professeur MOR)
  const toggleVoiceInput = () => {
    const SpeechRecognition =
      (window as unknown as SpeechWindow).SpeechRecognition ||
      (window as unknown as SpeechWindow).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: SpeechResultEvent) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput("");
    setIsTyping(true);

    // Commande directe de navigation si l'utilisateur demande d'ouvrir une page
    const lowerQ = String(query || "").toLowerCase();
    if (
      /^(ouvre|va sur|affiche|emmène-moi sur|lance)\s+/i.test(lowerQ) &&
      detectAppActionsForQuery(lowerQ).length > 0
    ) {
      const targetAction = detectAppActionsForQuery(lowerQ)[0];
      navigate(targetAction.route);
    }

    const result = await generateProfessorResponse(
      query,
      updatedHistory,
      location.pathname
    );

    const assistantMsg: ChatMessage = {
      id: `mor-${Date.now()}`,
      role: "assistant",
      content: result.reply,
      webSources: result.webSources,
      suggestedActions: result.actions,
      timestamp: new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, assistantMsg]);
    setIsTyping(false);
  };

  const handleResetConversation = () => {
    const fresh = getInitialGreeting();
    setMessages(fresh);
    localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(fresh));
  };

  // Enregistrer directement une explication du professeur comme Flashcard dans DawJang
  const handleSaveReplyAsFlashcard = (assistantContent: string, index: number) => {
    const previousUserQuestion =
      messages
        .slice(0, index)
        .reverse()
        .find((m) => m.role === "user")?.content ||
      "Question posée au Professeur MOR";

    try {
      const existing = JSON.parse(
        localStorage.getItem("hippocampus_core_flashcards_v6") || "[]"
      );
      const sentences = assistantContent
        .split(/\n+/)
        .map((s) => s.replace(/^[•\-*]\s*/, "").trim())
        .filter((s) => s.length > 15);

      const newCard = {
        id: `fc-mor-${Date.now()}`,
        courseId: "mor-live",
        lessonTitle: "Notes du Professeur MOR",
        subject: "Synthèse MOR",
        customNode: "Points essentiels",
        originMode: "manual",
        question: previousUserQuestion,
        answerSummary: sentences[0] || assistantContent.slice(0, 220),
        answerDetails: sentences.slice(1, 5),
        intervalDays: 1,
        repetitionCount: 0,
        status: "new",
      };

      localStorage.setItem(
        "hippocampus_core_flashcards_v6",
        JSON.stringify([newCard, ...existing])
      );
      navigate("/flashcards");
      setIsOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* WIDGET FLOTTANT PUREMENT CIRCULAIRE — EMBLÈME NOIR UNIQUEMENT */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Ouvrir le Professeur MOR"
          className="group fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-border/90 bg-white dark:bg-[#F5F3EE] text-[#141413] shadow-[0_8px_28px_-6px_rgba(0,0,0,0.18)] hover:shadow-[0_14px_34px_-6px_rgba(0,0,0,0.28)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:scale-[1.05] active:scale-95 focus:outline-none"
        >
          <MorGeometricLogo className="h-11 w-11 text-[#141413] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]" />
        </button>
      )}

      {/* FENÊTRE OUVERTE DU PROFESSEUR MOR */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-50 flex flex-col rounded-2xl border border-border bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.24)] dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.75)] overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-3",
            isExpanded
              ? "bottom-4 right-4 left-4 top-12 sm:left-auto sm:w-[680px] sm:h-[85vh]"
              : "bottom-4 right-4 left-4 sm:left-auto sm:w-[430px] h-[600px] max-h-[84vh]"
          )}
        >
          {/* En-tête : Professeur MOR + Indicateur Web & Application */}
          <div className="flex items-center justify-between border-b border-border/80 bg-secondary/35 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-white text-[#141413] shadow-sm">
                <MorGeometricLogo className="h-7 w-7" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-foreground">
                    Professeur MOR
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/12 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-primary">
                    <Globe className="h-2.5 w-2.5" /> Web & Studio
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground block">
                  Mentorat académique, recherches & guide DawJang
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetConversation}
                title="Nouvelle discussion"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Format compact" : "Agrandir la fenêtre"}
                className="hidden sm:flex p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                {isExpanded ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Fermer (⌘J)"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Fil de conversation fluide */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-none"
          >
            {messages.map((msg, idx) => (
              <div key={msg.id} className="space-y-2">
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-foreground text-background px-4 py-2.5 text-[13.5px] leading-relaxed shadow-sm">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/85 bg-background/60 p-4 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                    {/* Texte naturel du Professeur (découpé en paragraphes propres) */}
                    <div className="space-y-2.5 text-[13.5px] text-foreground/95 leading-[1.68] whitespace-pre-line">
                      {msg.content}
                    </div>

                    {/* Sources Web consultées en temps réel */}
                    {msg.webSources && msg.webSources.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                          <Globe className="h-3 w-3 text-primary" /> Sources consultées :
                        </span>
                        {msg.webSources.map((src) => (
                          <span
                            key={src}
                            className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-foreground"
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Boutons d'accès direct aux outils de l'application DawJang */}
                    {(msg.suggestedActions?.length || idx > 0) && (
                      <div className="pt-2.5 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {msg.suggestedActions?.map((act) => (
                            <button
                              key={act.route}
                              type="button"
                              onClick={() => {
                                navigate(act.route);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-primary/35 bg-primary/10 hover:bg-primary hover:text-primary-foreground px-2.5 py-1 text-[11.5px] font-semibold text-primary transition-colors"
                            >
                              <Compass className="h-3 w-3" />
                              <span>{act.label}</span>
                              <ArrowUpRight className="h-3 w-3" />
                            </button>
                          ))}

                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleSaveReplyAsFlashcard(msg.content, idx)
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card hover:border-foreground/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Layers className="h-3 w-3 text-primary" />
                              <span>Mémoriser en Flashcard</span>
                            </button>
                          )}
                        </div>

                        <span className="font-mono text-[10px] text-muted-foreground">
                          {msg.timestamp}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="rounded-2xl border border-border/75 bg-background/50 p-3.5 flex items-center gap-3 text-[12.5px] text-muted-foreground animate-in fade-in duration-150">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
                <span>Le Professeur MOR analyse votre demande…</span>
              </div>
            )}

            {/* Amorces rapides contextuelles au démarrage */}
            {messages.length === 1 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-medium text-muted-foreground px-1">
                  Exemples de questions (Cours, Hors-application ou Aide DawJang) :
                </span>
                {[
                  "Quels sont mes cours et QCM actuellement enregistrés dans DawJang ?",
                  "Explique-moi simplement la physiopathologie du choc septique",
                  "Comment fonctionne l'upload de masse et le Rédacteur de résumés ?",
                  "Où puis-je consulter mon Rapport de Lacunes et mes médailles LV. ?",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend(q)}
                    className="group w-full text-left flex items-center justify-between gap-2 rounded-xl border border-border/75 bg-background/45 hover:bg-secondary/60 hover:border-foreground/25 px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground transition-all"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <CornerDownRight className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate">{q}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Zone de saisie + Microphone vocal */}
          <div className="p-3 border-t border-border/80 bg-secondary/25">
            <div className="relative rounded-xl border border-border bg-card focus-within:border-primary/60 transition-colors px-3 py-2">
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDownInput}
                placeholder="Posez n'importe quelle question à votre professeur…"
                className="w-full resize-none bg-transparent text-[13.5px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none pr-16 leading-relaxed"
              />

              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  title={isListening ? "Arrêter la dictée" : "Poser ma question à la voix"}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                    isListening
                      ? "bg-destructive text-destructive-foreground animate-pulse"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  {isListening ? (
                    <MicOff className="h-3.5 w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150",
                    input.trim() && !isTyping
                      ? "bg-foreground text-background hover:bg-primary hover:text-primary-foreground shadow-sm"
                      : "bg-secondary text-muted-foreground/40 cursor-not-allowed"
                  )}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MorChatWidget;
