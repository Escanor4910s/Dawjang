import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Upload,
  X,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Brain,
  ShieldAlert,
  ArrowUpRight,
  BookOpen,
  Plus,
  RotateCcw,
  Eye
} from 'lucide-react';
import {
  QuestionArchetype,
  CognitiveTier,
  OptionLetter,
  QuizQuestion,
  QuizSeries,
  UploadedCourseDocument
} from '@/types/quiz';
import { supabase } from '@/integrations/supabase/client';

const ARCHETYPE_OPTIONS: { value: QuestionArchetype; label: string; badge: string }[] = [
  { value: 'mixte', label: 'Panachage Intelligent', badge: 'MIXTE' },
  { value: 'complement_multiple', label: 'Complément Multiple', badge: 'QCM' },
  { value: 'groupage', label: 'Groupage (I-V)', badge: 'GROUPAGE' },
  { value: 'association', label: 'Association (Colonnes 1-5 / A-E)', badge: 'ASSOCIATION' },
  { value: 'jumelage', label: 'Jumelage (Causalité)', badge: 'JUMELAGE' },
  { value: 'censure', label: 'Censure (Intrus)', badge: 'CENSURE' },
];

const COGNITIVE_TIERS: {
  value: CognitiveTier;
  title: string;
  subtitle: string;
  accent: string;
}[] = [
  {
    value: 'ancrage',
    title: 'Ancrage & Sémiologie',
    subtitle: 'Reformulation synonymique & seuils inversés',
    accent: 'from-emerald-500/20 to-teal-500/5 text-emerald-300 border-emerald-500/30',
  },
  {
    value: 'mecanismes',
    title: 'Mécanismes & Corrélations',
    subtitle: 'Déduction physiopathologique cause → effet',
    accent: 'from-indigo-500/20 to-violet-500/5 text-indigo-300 border-indigo-500/30',
  },
  {
    value: 'discernement',
    title: 'Discernement & Cas Croisés',
    subtitle: 'Vignettes synthétiques & nuances restrictives',
    accent: 'from-amber-500/20 to-rose-500/5 text-amber-300 border-amber-500/30',
  },
];

export const QuizWorkspace: React.FC = () => {
  // Documents de cours chargés (Tags style Flutter avec suppression individuelle)
  const [documents, setDocuments] = useState<UploadedCourseDocument[]>([
    {
      id: 'demo-anemie',
      fileName: 'Anemie_Ferriprive_Hematologie.pdf',
      cleanTitle: 'Anémie',
      content: `L'anémie ferriprive est une anémie centrale microcytaire (VGM < 80 fL) et hypochrome (TCMH < 27 pg) liée à un défaut de synthèse de l'hémoglobine par carence martiale. Sur le plan biologique, la ferritine sérique est le premier paramètre à s'effondrer (reflet fidèle de l'épuisement des réserves tissulaires), suivie d'une élévation compensatrice de la capacité totale de fixation de la transferrine (CTF) par synthèse hépatique accrue et d'une baisse du coefficient de saturation de la transferrine (< 16%). En revanche, dans l'anémie inflammatoire, le fer est séquestré dans les macrophages sous l'effet de l'hepcidine : la ferritine y est normale ou élevée et la CTF est abaissée. Le récepteur soluble de la transferrine (RsTf) est augmenté dans la carence martiale vraie par surexpression membranaire érythroblastique, alors qu'il reste normal dans l'inflammation pure.`
    }
  ]);

  // Paramètres de génération
  const [selectedArchetype, setSelectedArchetype] = useState<QuestionArchetype>('mixte');
  const [selectedTier, setSelectedTier] = useState<CognitiveTier>('mecanismes');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Historique des séries générées (Anémie #1, Anémie #2, etc.)
  const [seriesList, setSeriesList] = useState<QuizSeries[]>([]);
  const [activeSeriesId, setActiveSeriesId] = useState<string | null>(null);

  // État des réponses utilisateur par questionId
  const [userAnswers, setUserAnswers] = useState<Record<string, OptionLetter>>({});
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0);
  const [instantFeedbackMode, setInstantFeedbackMode] = useState<boolean>(true);
  const [examSubmitted, setExamSubmitted] = useState<boolean>(false);

  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Titre racine combiné à partir des fichiers actifs
  const currentCourseRootTitle = useMemo(() => {
    if (documents.length === 0) return 'Session Libre';
    if (documents.length === 1) return documents[0].cleanTitle;
    return `${documents[0].cleanTitle} +${documents.length - 1}`;
  }, [documents]);

  // Calcul automatique du prochain numéro de série (#1, #2, #3...) pour ce cours
  const nextSeriesNumber = useMemo(() => {
    const matchingSeries = seriesList.filter(
      (s) => s.courseRootTitle.toLowerCase() === currentCourseRootTitle.toLowerCase()
    );
    return matchingSeries.length + 1;
  }, [seriesList, currentCourseRootTitle]);

  const activeSeries = useMemo(
    () => seriesList.find((s) => s.id === activeSeriesId) || null,
    [seriesList, activeSeriesId]
  );

  // Upload de fichiers avec création de tags individuels
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newDocs: UploadedCourseDocument[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      const cleanTitle = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .trim();

      newDocs.push({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileName: file.name,
        cleanTitle: cleanTitle || 'Cours',
        content: text || `Contenu extrait du document ${file.name}`
      });
    }
    setDocuments((prev) => [...prev, ...newDocs]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeDocumentTag = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  // Génération d'une nouvelle série (#1, #2...) avec exclusion des questions précédentes
  const handleGenerateSeries = async () => {
    if (documents.length === 0 || isGenerating) return;
    setIsGenerating(true);

    try {
      const combinedCourseText = documents
        .map((d) => `--- DOCUMENT : ${d.cleanTitle} ---\n${d.content}`)
        .join('\n\n');

      // Récupérer tous les concepts déjà testés dans les séries précédentes de ce même cours
      const previousSeriesForCourse = seriesList.filter(
        (s) => s.courseRootTitle.toLowerCase() === currentCourseRootTitle.toLowerCase()
      );
      const excludedConcepts = previousSeriesForCourse.flatMap((s) =>
        s.questions.map((q) => `${q.conceptTag || ''} (${q.stem.slice(0, 70)})`)
      );

      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: {
          courseContent: combinedCourseText,
          courseTitle: currentCourseRootTitle,
          archetype: selectedArchetype,
          cognitiveTier: selectedTier,
          questionCount,
          seriesNumber: nextSeriesNumber,
          excludedConcepts,
        },
      });

      if (error) throw error;

      const newSeries: QuizSeries = {
        id: `series-${Date.now()}`,
        courseRootTitle: currentCourseRootTitle,
        seriesNumber: nextSeriesNumber,
        displayTitle: `${currentCourseRootTitle} #${nextSeriesNumber}`,
        createdAt: new Date().toISOString(),
        archetype: selectedArchetype,
        cognitiveTier: selectedTier,
        questions: data.questions || [],
      };

      setSeriesList((prev) => [newSeries, ...prev]);
      setActiveSeriesId(newSeries.id);
      setActiveQuestionIdx(0);
      setExamSubmitted(false);
    } catch (err) {
      console.error('Erreur de génération QCM:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Sélection d'une réponse + défilement doux vers la question suivante
  const handleSelectOption = (questionId: string, letter: OptionLetter, idx: number) => {
    if (!instantFeedbackMode && examSubmitted) return;
    if (instantFeedbackMode && userAnswers[questionId]) return; // Verrouillé après validation en mode instantané

    setUserAnswers((prev) => ({ ...prev, [questionId]: letter }));
    setActiveQuestionIdx(idx);
  };

  const scrollToQuestion = (idx: number) => {
    if (!activeSeries) return;
    const clamped = Math.max(0, Math.min(activeSeries.questions.length - 1, idx));
    setActiveQuestionIdx(clamped);
    cardRefs.current[clamped]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Navigation clavier (A-E pour répondre, Flèches Haut/Bas pour défiler)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeSeries || activeSeries.questions.length === 0) return;
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const currentQ = activeSeries.questions[activeQuestionIdx];
      const key = e.key.toUpperCase();

      if (['A', 'B', 'C', 'D', 'E'].includes(key) && currentQ) {
        e.preventDefault();
        handleSelectOption(currentQ.id, key as OptionLetter, activeQuestionIdx);
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        scrollToQuestion(activeQuestionIdx + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        scrollToQuestion(activeQuestionIdx - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSeries, activeQuestionIdx, userAnswers, instantFeedbackMode, examSubmitted]);

  // Statistiques de la série active
  const stats = useMemo(() => {
    if (!activeSeries) return { answered: 0, correct: 0, total: 0, progress: 0 };
    const total = activeSeries.questions.length;
    let answered = 0;
    let correct = 0;

    for (const q of activeSeries.questions) {
      const ans = userAnswers[q.id];
      if (ans) {
        answered++;
        if (ans === q.correctLetter) correct++;
      }
    }
    return {
      answered,
      correct,
      total,
      progress: total > 0 ? Math.round((answered / total) * 100) : 0,
    };
  }, [activeSeries, userAnswers]);

  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100 selection:bg-indigo-500/30 font-sans">
      {/* HEADER FLOTTANT SINGLE-LINE (Style Stripe / Linear / Claude) */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#090A0F]/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Sélecteur de Séries Horizontal (#1, #2, #3...) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <div className="flex items-center gap-2 pr-2 border-r border-white/10">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
                QCM Studio
              </span>
            </div>

            {seriesList.map((s) => {
              const isCurrent = s.id === activeSeries?.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSeriesId(s.id);
                    setActiveQuestionIdx(0);
                  }}
                  className={`group flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    isCurrent
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                  }`}
                >
                  <span>{s.courseRootTitle}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isCurrent ? 'bg-slate-900 text-white' : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    #{s.seriesNumber}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Jauge de progression & Mode de correction sur une seule ligne */}
          {activeSeries && (
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setInstantFeedbackMode((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-slate-300 hover:bg-white/[0.07] transition"
                title="Basculer entre correction immédiate et mode examen"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                <span>{instantFeedbackMode ? 'Correction Immédiate' : 'Mode Examen'}</span>
              </button>

              <div className="hidden sm:flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.07] px-3 py-1 rounded-full">
                <span className="text-xs font-mono text-slate-400">
                  {stats.answered}/{stats.total}
                </span>
                <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-400 to-emerald-400 transition-all duration-500"
                    style={{ width: `${stats.progress}%` }}
                  />
                </div>
                {(instantFeedbackMode || examSubmitted) && stats.answered > 0 && (
                  <span className="text-xs font-mono font-semibold text-emerald-400">
                    {stats.correct} juste{stats.correct > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <button
                onClick={handleGenerateSeries}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 hover:bg-indigo-500/25 text-xs font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Générer #{nextSeriesNumber}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-28">
        {/* PANNEAU DE CONFIGURATION ULTRA-COMPACT */}
        <section className="mb-8 rounded-2xl border border-white/[0.08] bg-[#10121A]/90 p-4 shadow-2xl">
          {/* Ligne 1 : Tags de cours style Flutter avec bouton × individuel */}
          <div className="flex flex-wrap items-center gap-2 pb-3.5 mb-3.5 border-b border-white/[0.06]">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.pdf,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-slate-200 transition"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Ajouter un cours</span>
            </button>

            {documents.map((doc) => (
              <div
                key={doc.id}
                className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-200"
              >
                <BookOpen className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className="font-medium truncate max-w-[180px]">{doc.cleanTitle}</span>
                <button
                  onClick={() => removeDocumentTag(doc.id)}
                  className="p-0.5 rounded-full hover:bg-indigo-500/30 text-indigo-300 hover:text-white transition"
                  aria-label={`Retirer ${doc.cleanTitle}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            <div className="ml-auto flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
              <span>Prochaine session :</span>
              <span className="px-2 py-0.5 rounded bg-white/[0.06] text-slate-200 font-semibold">
                {currentCourseRootTitle} #{nextSeriesNumber}
              </span>
            </div>
          </div>

          {/* Ligne 2 : Les 3 nouveaux Paliers Cognitifs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-3.5">
            {COGNITIVE_TIERS.map((tier) => {
              const active = selectedTier === tier.value;
              return (
                <button
                  key={tier.value}
                  onClick={() => setSelectedTier(tier.value)}
                  className={`text-left px-3.5 py-2.5 rounded-xl border transition-all ${
                    active
                      ? `bg-gradient-to-br ${tier.accent} shadow-sm`
                      : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-tight text-slate-100">
                      {tier.title}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        active ? 'bg-current' : 'bg-white/15'
                      }`}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                    {tier.subtitle}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Ligne 3 : Barre d'action Single-Line (Type de QCM + Quantité + Bouton Générer) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Sélecteur de type sur une ligne */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {ARCHETYPE_OPTIONS.map((arch) => {
                const active = selectedArchetype === arch.value;
                return (
                  <button
                    key={arch.value}
                    onClick={() => setSelectedArchetype(arch.value)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                      active
                        ? 'bg-white text-slate-950 font-semibold'
                        : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                    }`}
                  >
                    {arch.label}
                  </button>
                );
              })}
            </div>

            {/* Quantité + Bouton Générer sur la même ligne */}
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
                {[5, 10, 20, 30].map((count) => (
                  <button
                    key={count}
                    onClick={() => setQuestionCount(count)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition ${
                      questionCount === count
                        ? 'bg-indigo-500 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>

              <button
                onClick={handleGenerateSeries}
                disabled={isGenerating || documents.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-50 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>
                  {isGenerating
                    ? 'Construction docimologique...'
                    : `Générer ${currentCourseRootTitle} #${nextSeriesNumber}`}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* FLUX DE DÉFILEMENT VERTICAL DES QCM */}
        {activeSeries ? (
          <div className="space-y-6">
            {activeSeries.questions.map((question, qIdx) => {
              const selectedLetter = userAnswers[question.id];
              const isRevealed =
                (instantFeedbackMode && !!selectedLetter) || examSubmitted;
              const isFocused = activeQuestionIdx === qIdx;

              return (
                <article
                  key={question.id}
                  ref={(el) => (cardRefs.current[qIdx] = el)}
                  onClick={() => setActiveQuestionIdx(qIdx)}
                  className={`rounded-2xl border transition-all duration-300 p-6 sm:p-7 ${
                    isFocused
                      ? 'bg-[#121521] border-white/15 shadow-2xl opacity-100'
                      : 'bg-[#0D0F18]/80 border-white/[0.06] opacity-75 hover:opacity-100'
                  }`}
                >
                  {/* En-tête éditorial de la carte */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-white/[0.06] text-slate-200">
                        {String(qIdx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300">
                        {question.archetype.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] text-slate-400 hidden sm:inline">
                        • {question.conceptTag}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-slate-400">
                      {activeSeries.displayTitle}
                    </span>
                  </div>

                  {/* Énoncé principal */}
                  <h2 className="text-base sm:text-[17px] font-medium leading-relaxed text-slate-100 mb-5">
                    {question.stem}
                  </h2>

                  {/* RENDU SPÉCIALISÉ 1 : ASSOCIATION (2 COLONNES CÔTE À CÔTE AVANT LES CHOIX) */}
                  {question.archetype === 'association' && question.matchingColumns && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-6 p-4 rounded-xl bg-[#090B11] border border-white/[0.08]">
                      {/* Colonne 1 (1 à 5) */}
                      <div>
                        <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 mb-2.5 pb-1.5 border-b border-white/[0.06]">
                          Colonne 1 • {question.matchingColumns.leftColumnTitle || 'Éléments'}
                        </div>
                        <ul className="space-y-2">
                          {question.matchingColumns.leftItems.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 bg-white/[0.02] px-3 py-2 rounded-lg border border-white/[0.04]"
                            >
                              <span className="font-mono font-bold text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded text-xs shrink-0">
                                {item.id}
                              </span>
                              <span className="leading-snug">{item.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Colonne 2 (A à E) */}
                      <div>
                        <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 mb-2.5 pb-1.5 border-b border-white/[0.06]">
                          Colonne 2 • {question.matchingColumns.rightColumnTitle || 'Correspondances'}
                        </div>
                        <ul className="space-y-2">
                          {question.matchingColumns.rightItems.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 bg-white/[0.02] px-3 py-2 rounded-lg border border-white/[0.04]"
                            >
                              <span className="font-mono font-bold text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded text-xs shrink-0">
                                {item.id}
                              </span>
                              <span className="leading-snug">{item.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* RENDU SPÉCIALISÉ 2 : GROUPAGE (ASSERTIONS ROMAINES I à V INDENTÉES) */}
                  {question.archetype === 'groupage' &&
                    question.groupageStatements &&
                    question.groupageStatements.length > 0 && (
                      <div className="mb-6 pl-4 border-l-2 border-indigo-500/40 space-y-2.5 py-1">
                        {question.groupageStatements.map((stmt) => (
                          <div
                            key={stmt.numeral}
                            className="flex items-start gap-3 text-sm text-slate-200 bg-white/[0.02] px-3.5 py-2.5 rounded-xl border border-white/[0.05]"
                          >
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 shrink-0">
                              {stmt.numeral}
                            </span>
                            <span className="leading-relaxed">{stmt.text}</span>
                            {isRevealed && (
                              <span
                                className={`ml-auto text-[11px] font-mono px-2 py-0.5 rounded shrink-0 ${
                                  stmt.isTrue
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : 'bg-rose-500/15 text-rose-300'
                                }`}
                              >
                                {stmt.isTrue ? 'VRAI' : 'FAUX'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                  {/* RENDU SPÉCIALISÉ 3 : JUMELAGE (ASSERTION 1 + CONNECTEUR LOGIQUE + ASSERTION 2) */}
                  {question.archetype === 'jumelage' && question.jumelageData && (
                    <div className="mb-6 space-y-2.5 p-4 rounded-xl bg-[#090B11] border border-white/[0.08]">
                      <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] text-sm text-slate-200">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 block mb-1">
                          Proposition 1
                        </span>
                        {question.jumelageData.statementOne}
                      </div>

                      <div className="flex items-center justify-center">
                        <span className="px-3 py-0.5 rounded-full text-[11px] font-mono font-bold tracking-widest bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {question.jumelageData.connector || 'PARCE QUE'}
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] text-sm text-slate-200">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block mb-1">
                          Proposition 2
                        </span>
                        {question.jumelageData.statementTwo}
                      </div>
                    </div>
                  )}

                  {/* GRILLE DES 5 PROPOSITIONS DE RÉPONSE (A, B, C, D, E) */}
                  <div className="space-y-2">
                    {question.options.map((opt) => {
                      const isSelected = selectedLetter === opt.letter;
                      const isCorrect = opt.letter === question.correctLetter;

                      let optionStyle =
                        'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-slate-200';
                      let badgeStyle = 'bg-white/[0.07] text-slate-300';

                      if (isRevealed) {
                        if (isCorrect) {
                          optionStyle =
                            'border-emerald-500/50 bg-emerald-500/10 text-emerald-100';
                          badgeStyle = 'bg-emerald-500 text-slate-950 font-bold';
                        } else if (isSelected && !isCorrect) {
                          optionStyle = 'border-rose-500/50 bg-rose-500/10 text-rose-100';
                          badgeStyle = 'bg-rose-500 text-white font-bold';
                        } else {
                          optionStyle = 'border-white/[0.04] bg-white/[0.01] text-slate-400 opacity-65';
                        }
                      } else if (isSelected) {
                        optionStyle =
                          'border-indigo-500 bg-indigo-500/15 text-white shadow-sm';
                        badgeStyle = 'bg-indigo-500 text-white font-bold';
                      }

                      return (
                        <button
                          key={opt.letter}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectOption(question.id, opt.letter, qIdx);
                          }}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 ${optionStyle}`}
                        >
                          <span
                            className={`w-7 h-7 rounded-lg font-mono text-xs flex items-center justify-center shrink-0 transition ${badgeStyle}`}
                          >
                            {opt.letter}
                          </span>

                          <div className="flex-1 text-sm leading-relaxed">
                            <div>{opt.text}</div>
                            {isRevealed && opt.rationale && (
                              <p className="mt-1.5 text-xs text-slate-400">
                                {opt.rationale}
                              </p>
                            )}
                          </div>

                          {isRevealed && isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
                          )}
                          {isRevealed && isSelected && !isCorrect && (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* TIROIR D'EXPLICATION INLINE & PREUVE DU COURS */}
                  {isRevealed && (
                    <div className="mt-5 pt-4 border-t border-white/[0.08] space-y-3 animate-in fade-in duration-300">
                      <div className="p-4 rounded-xl bg-indigo-500/[0.07] border border-indigo-500/20">
                        <div className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-1">
                          Synthèse Docimologique (Réponse {question.correctLetter})
                        </div>
                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                          {question.globalExplanation}
                        </p>
                      </div>

                      {question.courseExcerpt && (
                        <blockquote className="px-3.5 py-2.5 rounded-lg bg-white/[0.02] border-l-2 border-emerald-400/60 text-xs text-slate-300 italic">
                          <span className="not-italic font-semibold text-emerald-300 block mb-0.5">
                            Ancrage exact dans le cours :
                          </span>
                          « {question.courseExcerpt} »
                        </blockquote>
                      )}
                    </div>
                  )}
                </article>
              );
            })}

            {/* Barre de validation finale si Mode Examen (Correction différée) */}
            {!instantFeedbackMode && !examSubmitted && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => setExamSubmitted(true)}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm shadow-lg shadow-emerald-500/20 transition"
                >
                  Valider la série {activeSeries.displayTitle} ({stats.answered}/{stats.total})
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ÉTAT INITIAL AVANT LA PREMIÈRE GÉNÉRATION */
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#0E1018]/60 p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-100 mb-1">
              Prêt à générer {currentCourseRootTitle} #{nextSeriesNumber}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
              Sélectionne ton palier cognitif ci-dessus. Les colonnes d'Association, assertions de Groupage et distributions aléatoires des lettres A–E sont garanties.
            </p>
            <button
              onClick={handleGenerateSeries}
              disabled={isGenerating || documents.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-950 hover:bg-slate-200 text-xs font-semibold transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Lancer {currentCourseRootTitle} #{nextSeriesNumber}</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default QuizWorkspace;
