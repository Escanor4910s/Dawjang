import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Upload,
  X,
  Check,
  AlertCircle,
  BookOpen,
  FileText,
  GraduationCap,
  SlidersHorizontal,
  ArrowDown,
  ArrowUp,
  RotateCcw,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  Library,
  Layers,
  Plus,
  Trash2,
  BookmarkCheck,
  Key
} from 'lucide-react';
import {
  QuestionArchetype,
  CognitiveTier,
  OptionLetter,
  QuizQuestion,
  QuizSeriesSession,
  CourseSourceItem,
  MatchingColumnsPayload,
  GroupageStatement,
  JumelagePayload
} from '@/types/quiz';
import { supabase } from '@/integrations/supabase/client';
import {
  sanitizeAndValidateQuestions,
  buildUniversalDocimologicalBatchPrompt,
  DocimologicalFormat
} from '@/lib/annalesMimicryEngine';
import { callDawiaEngine } from '@/lib/dawiaQcmEngine';
import { repairAndParseQuizJson } from '@/lib/jsonRepair';

const LETTERS: OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];

const ARCHETYPE_CATALOG: {
  id: QuestionArchetype;
  label: string;
  shortTag: string;
  desc: string;
}[] = [
  {
    id: 'complement_multiple',
    label: 'Élection (QCU)',
    shortTag: 'ÉLECTION',
    desc: '1 proposition exacte parmi 5'
  },
  {
    id: 'censure',
    label: 'Censure',
    shortTag: 'CENSURE',
    desc: 'Identifier l’unique proposition inexacte'
  },
  {
    id: 'groupage',
    label: 'Groupage (I–V)',
    shortTag: 'GROUPAGE',
    desc: 'Assertions romaines I à V combinées en A–E'
  },
  {
    id: 'association',
    label: 'Association (1–5 ↔ A–E)',
    shortTag: 'ASSOCIATION',
    desc: '2 colonnes affichées en vis-à-vis avant les choix'
  },
  {
    id: 'jumelage',
    label: 'Jumelage',
    shortTag: 'JUMELAGE',
    desc: 'Lien de causalité (PARCE QUE / D’OÙ)'
  }
];

const COGNITIVE_TIERS: {
  id: CognitiveTier;
  num: string;
  title: string;
  subtitle: string;
  detail: string;
}[] = [
  {
    id: 'ancrage',
    num: 'PALIER I',
    title: 'Ancrage & Sémiologie',
    subtitle: 'Restitution croisée & seuils biologiques',
    detail: 'Reformulation médicale stricte sans paraphrase scolaire ; pièges sur les seuils et signes cardinaux.'
  },
  {
    id: 'mecanismes',
    num: 'PALIER II',
    title: 'Mécanismes & Corrélations',
    subtitle: 'Physiopathologie & liens de causalité',
    detail: 'Relie chaque anomalie clinique ou paraclinique à son mécanisme générateur exact dans le cours.'
  },
  {
    id: 'discernement',
    num: 'PALIER III',
    title: 'Discernement & Cas Croisés',
    subtitle: 'Micro-vignettes & nuances restrictives',
    detail: 'Croise plusieurs sous-parties du cours (terrain, diagnostic différentiel, contre-indications).'
  }
];

const STORAGE_SERIES_KEY = 'dawjang_qcm_series_v2';

/**
 * Extrait un nom de cours court et élégant (ex: "1-Anémies 2026 (Médecine Générale).pdf" -> "Anémies")
 */
function extractCleanRootName(rawTitle: string): string {
  if (!rawTitle) return 'Cours';
  const withoutExt = rawTitle.replace(/\.[^/.]+$/, '');
  const withoutParen = withoutExt.replace(/\([^)]*\)/g, '');
  const withoutLeadingNums = withoutParen.replace(/^[0-9]+[\s._-]+/, '');
  const withoutYears = withoutLeadingNums.replace(/\b(202[0-9]|19[0-9]{2})\b/g, '');
  const cleaned = withoutYears.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ').slice(0, 3).join(' ');
  return words || 'Cours';
}

/**
 * Mélangeur déterministe côté client (Filet de sécurité absolu contre les suites A-A-A-A)
 * Garantit que même si une ancienne fonction Edge répond, les lettres A-E sont mélangées
 * et aucune série mécanique de réponses identiques ne peut apparaître.
 */
function enforceClientSideRandomizationAndStructure(
  rawQuestions: any[],
  fallbackTier: CognitiveTier
): QuizQuestion[] {
  const letterHistory: OptionLetter[] = [];
  const letterCounts: Record<OptionLetter, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  return rawQuestions.map((q, idx) => {
    const archetype: QuestionArchetype =
      q.archetype ||
      q.type ||
      (q.matchingColumns ? 'association' : q.groupageStatements ? 'groupage' : q.jumelageData ? 'jumelage' : 'complement_multiple');

    // Normalisation des options brutes
    let rawOptions: { letter?: string; text: string; rationale?: string }[] = [];
    if (Array.isArray(q.options)) {
      rawOptions = q.options.map((o: any, i: number) =>
        typeof o === 'string'
          ? { letter: LETTERS[i], text: o.replace(/^[A-E][\s.\-):]+/i, '').trim() }
          : {
              letter: o.letter || LETTERS[i],
              text: String(o.text || o.label || o.content || '').replace(/^[A-E][\s.\-):]+/i, '').trim(),
              rationale: o.rationale || o.explanation || ''
            }
      );
    }

    while (rawOptions.length < 5) {
      rawOptions.push({
        letter: LETTERS[rawOptions.length],
        text: `Proposition ${LETTERS[rawOptions.length]}`,
        rationale: ''
      });
    }
    rawOptions = rawOptions.slice(0, 5);

    // Identification de la bonne réponse initiale
    let origCorrectIdx = 0;
    if (typeof q.correctLetter === 'string') {
      const found = LETTERS.indexOf(q.correctLetter.trim().toUpperCase().charAt(0) as OptionLetter);
      if (found !== -1) origCorrectIdx = found;
    } else if (typeof q.correct_answer === 'string') {
      const found = LETTERS.indexOf(q.correct_answer.trim().toUpperCase().charAt(0) as OptionLetter);
      if (found !== -1) origCorrectIdx = found;
    } else if (typeof q.correctIndex === 'number') {
      origCorrectIdx = Math.max(0, Math.min(4, q.correctIndex));
    }

    const correctObj = rawOptions[origCorrectIdx] || rawOptions[0];
    const distractors = shuffle(rawOptions.filter((_, i) => i !== origCorrectIdx));

    // Choix d'une lettre cible qui interdit les répétitions (Anti-Streak strict)
    const last1 = letterHistory[letterHistory.length - 1];
    const last2 = letterHistory[letterHistory.length - 2];

    const candidates = shuffle(LETTERS).filter((l) => {
      if (last1 && l === last1) return false;
      if (last2 && l === last2 && Math.random() < 0.6) return false;
      return true;
    });
    candidates.sort((a, b) => letterCounts[a] - letterCounts[b]);

    const targetLetter = candidates[0] || LETTERS[idx % 5];
    const targetIdx = LETTERS.indexOf(targetLetter);

    const finalOptions = [];
    let dPtr = 0;
    for (let i = 0; i < 5; i++) {
      if (i === targetIdx) {
        finalOptions.push({
          letter: LETTERS[i],
          text: correctObj.text,
          rationale: correctObj.rationale || 'Proposition exacte selon les données du cours.'
        });
      } else {
        const d = distractors[dPtr++] || { text: 'Proposition inexacte', rationale: '' };
        finalOptions.push({
          letter: LETTERS[i],
          text: d.text,
          rationale: d.rationale || 'Proposition comportant une inexactitude par rapport au cours.'
        });
      }
    }

    letterHistory.push(targetLetter);
    letterCounts[targetLetter]++;

    // Garantie structurelle pour l'Association (2 colonnes 1-5 et A-E toujours présentes)
    let matchingColumns: MatchingColumnsPayload | null = q.matchingColumns || q.matching_columns || null;
    if (archetype === 'association' && (!matchingColumns || !Array.isArray(matchingColumns.leftItems))) {
      matchingColumns = {
        leftColumnTitle: 'Colonne 1 (Éléments à relier)',
        rightColumnTitle: 'Colonne 2 (Correspondances)',
        leftItems: [1, 2, 3, 4, 5].map((n) => ({
          id: String(n),
          text: (q.leftColumn && q.leftColumn[n - 1]) || `Élément clinique ou biologique ${n}`
        })),
        rightItems: ['A', 'B', 'C', 'D', 'E'].map((l, i) => ({
          id: l,
          text: (q.rightColumn && q.rightColumn[i]) || `Mécanisme ou caractéristique ${l}`
        }))
      };
    }

    // Garantie structurelle pour le Groupage (Assertions I à V)
    let groupageStatements: GroupageStatement[] | null = q.groupageStatements || q.groupage_statements || null;
    if (archetype === 'groupage' && (!Array.isArray(groupageStatements) || groupageStatements.length === 0)) {
      const numerals: ('I' | 'II' | 'III' | 'IV' | 'V')[] = ['I', 'II', 'III', 'IV', 'V'];
      if (Array.isArray(q.statements) && q.statements.length > 0) {
        groupageStatements = numerals.map((num, i) => ({
          numeral: num,
          text: String(q.statements[i]?.text || q.statements[i] || `Assertion ${num}`).replace(/^(I|II|III|IV|V)[\s.\-):]+/i, ''),
          isTrue: q.statements[i]?.isTrue
        }));
      }
    }

    // Garantie structurelle pour le Jumelage
    let jumelageData: JumelagePayload | null = q.jumelageData || q.jumelage_data || null;
    if (archetype === 'jumelage' && !jumelageData && (q.statementOne || q.assertion1)) {
      jumelageData = {
        statementOne: q.statementOne || q.assertion1,
        connector: q.connector || 'PARCE QUE',
        statementTwo: q.statementTwo || q.assertion2 || ''
      };
    }

    return {
      id: q.id || `q-${Date.now()}-${idx + 1}`,
      index: idx + 1,
      archetype,
      cognitiveTier: q.cognitiveTier || fallbackTier,
      stem: q.stem || q.question || 'Analysez les propositions suivantes selon les données du cours :',
      conceptTag: q.conceptTag || q.topic || 'Sémiologie & Physiopathologie',
      matchingColumns,
      groupageStatements,
      jumelageData,
      options: finalOptions,
      correctLetter: targetLetter,
      globalExplanation:
        q.globalExplanation ||
        q.explanation ||
        'Consultez les justifications détaillées sous chaque proposition.',
      courseExcerpt: q.courseExcerpt || q.excerpt || ''
    };
  });
}

/**
 * Extracteur de texte côté client pour fichiers TXT, MD, JSON ou PDF simples
 */
async function extractTextFromUploadedFile(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith('.pdf')) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const rawLatin = new TextDecoder('latin1').decode(bytes);
    // Extraction des chaînes lisibles dans les flux texte PDF si pdfjs n'est pas chargé
    const textChunks: string[] = [];
    const regex = /\(([^()\\]{3,})\)/g;
    let match;
    while ((match = regex.exec(rawLatin)) !== null) {
      const cleaned = match[1].replace(/[^\x20-\x7E\xC0-\xFF]/g, ' ').trim();
      if (cleaned.length > 3 && !/^[0-9\s.]+$/.test(cleaned)) {
        textChunks.push(cleaned);
      }
    }
    const joined = textChunks.join(' ').replace(/\s+/g, ' ').trim();
    if (joined.length > 150) return joined;
  }
  return await file.text();
}

export const ConstructeurQCM: React.FC = () => {
  // 1. Sources de cours (Bibliothèque Supabase + Fichiers uploadés + Texte libre)
  const [libraryCourses, setLibraryCourses] = useState<CourseSourceItem[]>([]);
  const [selectedSources, setSelectedSources] = useState<CourseSourceItem[]>([]);
  const [showLibraryPicker, setShowLibraryPicker] = useState<boolean>(false);
  const [showTextDrawer, setShowTextDrawer] = useState<boolean>(false);
  const [manualTitle, setManualTitle] = useState<string>('');
  const [manualText, setManualText] = useState<string>('');
  const [examArchiveText, setExamArchiveText] = useState<string>('');

  // 2. Configuration Docimologique
  const [selectedArchetypes, setSelectedArchetypes] = useState<QuestionArchetype[]>([
    'complement_multiple',
    'groupage',
    'association'
  ]);
  const [selectedTier, setSelectedTier] = useState<CognitiveTier>('mecanismes');
  const [questionCount, setQuestionCount] = useState<number>(10);

  // 3. Séries générées (#1, #2, #3...) & État du flux vertical
  const [seriesList, setSeriesList] = useState<QuizSeriesSession[]>([]);
  const [activeSeriesId, setActiveSeriesId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStepLabel, setGenerationStepLabel] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 4. Réponses & Navigation dans le Défilement Vertical
  const [userAnswers, setUserAnswers] = useState<Record<string, OptionLetter>>({});
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0);
  const [instantFeedback, setInstantFeedback] = useState<boolean>(true);
  const [examValidated, setExamValidated] = useState<boolean>(false);
  const [configCollapsed, setConfigCollapsed] = useState<boolean>(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('dawjang_openrouter_api_key') ||
        localStorage.getItem('dawjang_claude_api_key') ||
        localStorage.getItem('dawjang_gemini_api_key') ||
        ''
      );
    } catch {
      return '';
    }
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const questionCardRefs = useRef<(HTMLElement | null)[]>([]);

  // Chargement initial : Séries sauvegardées + Cours de la Bibliothèque Supabase
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SERIES_KEY);
      if (saved) {
        const parsed: QuizSeriesSession[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSeriesList(parsed);
          setActiveSeriesId(parsed[0].id);
        }
      }
    } catch {
      // Ignore storage error
    }

    async function fetchUserLibraryCourses() {
      try {
        // Interroge les tables de cours existantes dans Supabase
        const { data: coursesData } = await supabase
          .from('courses')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30);

        if (Array.isArray(coursesData) && coursesData.length > 0) {
          const mapped: CourseSourceItem[] = coursesData.map((c: any) => {
            const rawTitle = c.title || c.name || c.file_name || 'Cours Médical';
            const content =
              c.content ||
              c.extracted_text ||
              c.text ||
              c.summary ||
              `Contenu médical du cours ${rawTitle}`;
            return {
              id: String(c.id),
              title: rawTitle,
              cleanRootName: extractCleanRootName(rawTitle),
              content,
              sourceType: 'library',
              wordCount: String(content).split(/\s+/).length
            };
          });
          setLibraryCourses(mapped);
          if (selectedSources.length === 0 && mapped.length > 0) {
            setSelectedSources([mapped[0]]);
          }
          return;
        }
      } catch {
        // Fallback si la table porte un autre nom ou en local
      }

      // Cours de la bibliothèque par défaut si la base locale est vide
      const defaultCourse: CourseSourceItem = {
        id: 'lib-anemies-2026',
        title: '1-Anémies 2026 (Médecine Générale)',
        cleanRootName: 'Anémies',
        sourceType: 'library',
        wordCount: 420,
        content: `L'anémie est définie par la diminution de la concentration d'hémoglobine (Hb) en dessous des valeurs seuils physiologiques : < 13 g/dL chez l'homme adulte, < 12 g/dL chez la femme non enceinte, et < 10,5 g/dL chez la femme enceinte à partir du 2e trimestre (hémodilution physiologique).
L'anémie ferriprive est une anémie centrale (arégénérative, réticulocytes < 120 G/L), microcytaire (VGM < 80 fL) et hypochrome (TCMH < 27 pg). Sa physiopathologie repose sur l'épuisement progressif des réserves martiales :
1. Stade pré-latent : chute isolée de la ferritine sérique (< 20-30 µg/L), paramètre le plus précoce et le plus spécifique reflétant l'épuisement des stocks tissulaires.
2. Stade latent (sidéropénie sans anémie) : élévation compensatrice de la capacité totale de fixation de la transferrine (CTF > 70 µmol/L) par synthèse hépatique accrue de transferrine, chute du fer sérique et effondrement du coefficient de saturation de la transferrine (CST < 16%), avec surexpression membranaire érythroblastique du récepteur soluble de la transferrine (RsTf élevé).
3. Stade patent : défaut d'hémoglobinisation érythroblastique entraînant une mitose supplémentaire dans la moelle osseuse, d'où la microcytose et l'hypochromie.
Diagnostic différentiel majeur : l'anémie inflammatoire (anémie des maladies chroniques). Sous l'action de l'IL-6, le foie sécrète l'hepcidine qui dégrade la ferroportine, séquestrant le fer dans les macrophages et bloquant son absorption duodénale. Dans l'inflammation pure : la ferritine est normale ou élevée (> 100 µg/L), la CTF est abaissée (< 50 µmol/L), le fer sérique est bas, et le récepteur soluble de la transferrine (RsTf) demeure strictement normal.`
      };
      setLibraryCourses([defaultCourse]);
      setSelectedSources((prev) => (prev.length === 0 ? [defaultCourse] : prev));
    }

    fetchUserLibraryCourses();
  }, []);

  // Sauvegarde automatique des séries dans localStorage
  useEffect(() => {
    if (seriesList.length > 0) {
      try {
        localStorage.setItem(STORAGE_SERIES_KEY, JSON.stringify(seriesList.slice(0, 25)));
      } catch {
        // Ignore quota error
      }
    }
  }, [seriesList]);

  // Nom racine du cours actif (ex: "Anémies")
  const activeCourseRootTitle = useMemo(() => {
    if (selectedSources.length === 0) return 'Session';
    if (selectedSources.length === 1) return selectedSources[0].cleanRootName;
    return `${selectedSources[0].cleanRootName} +${selectedSources.length - 1}`;
  }, [selectedSources]);

  // Calcul perpétuel du prochain numéro de série (#1, #2, #3...) rattaché à ce cours
  const nextSeriesNumber = useMemo(() => {
    const existingForCourse = seriesList.filter(
      (s) => s.courseRootTitle.toLowerCase() === activeCourseRootTitle.toLowerCase()
    );
    return existingForCourse.length + 1;
  }, [seriesList, activeCourseRootTitle]);

  const activeSeries = useMemo(
    () => seriesList.find((s) => s.id === activeSeriesId) || null,
    [seriesList, activeSeriesId]
  );

  // Bascule d'un type de QCM (on peut en sélectionner 1 ou plusieurs)
  const toggleArchetype = (id: QuestionArchetype) => {
    setSelectedArchetypes((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((item) => item !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const selectAllArchetypes = () => {
    setSelectedArchetypes(ARCHETYPE_CATALOG.map((a) => a.id));
  };

  // Upload d'un fichier de cours -> Création d'un tag individuel supprimable (×)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setErrorMessage(null);

    const added: CourseSourceItem[] = [];
    for (const file of Array.from(files)) {
      try {
        const extracted = await extractTextFromUploadedFile(file);
        const cleanRoot = extractCleanRootName(file.name);
        added.push({
          id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: file.name,
          cleanRootName: cleanRoot,
          content: extracted,
          sourceType: 'upload',
          wordCount: extracted.split(/\s+/).filter(Boolean).length
        });
      } catch {
        setErrorMessage(`Impossible de lire le fichier ${file.name}.`);
      }
    }

    if (added.length > 0) {
      setSelectedSources((prev) => [...prev, ...added]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Ajout d'un extrait texte manuel -> Tag individuel
  const handleAddManualTextSource = () => {
    if (!manualText.trim() || manualText.trim().length < 30) {
      setErrorMessage('Veuillez coller un extrait de cours d’au moins quelques lignes.');
      return;
    }
    const cleanRoot = extractCleanRootName(manualTitle || 'Notes de cours');
    const newSource: CourseSourceItem = {
      id: `text-${Date.now()}`,
      title: manualTitle.trim() || 'Extrait de cours',
      cleanRootName: cleanRoot,
      content: manualText.trim(),
      sourceType: 'text',
      wordCount: manualText.trim().split(/\s+/).length
    };
    setSelectedSources((prev) => [...prev, newSource]);
    setManualTitle('');
    setManualText('');
    setShowTextDrawer(false);
    setErrorMessage(null);
  };

  const removeSourceTag = (id: string) => {
    setSelectedSources((prev) => prev.filter((s) => s.id !== id));
  };

  // GÉNÉRATION DE LA SÉRIE (#1, #2, #3...)
  const handleGenerateSeries = async () => {
    if (selectedSources.length === 0) {
      setErrorMessage('Sélectionnez un cours de votre bibliothèque ou importez un fichier avant de lancer la génération.');
      return;
    }
    if (isGenerating) return;

    setIsGenerating(true);
    setErrorMessage(null);

    const targetSeriesNum = nextSeriesNumber;
    const newSeriesId = `series-${Date.now()}`;
    const combinedCourseContent = selectedSources
      .map((s) => `=== COURS : ${s.title} ===\n${s.content}`)
      .join('\n\n');

    // Récupération de la mémoire d'exclusion des séries précédentes (#1, #2...) de ce même cours
    const previousSeries = seriesList.filter(
      (s) => s.courseRootTitle.toLowerCase() === activeCourseRootTitle.toLowerCase()
    );
    const excludedConcepts = previousSeries.flatMap((s) =>
      s.questions.map((q) => `${q.conceptTag} : ${q.stem.slice(0, 65)}`)
    );

    const CHUNK_SIZE = 10;
    const totalChunks = Math.ceil(questionCount / CHUNK_SIZE);
    let accumulatedQuestions: QuizQuestion[] = [];

    try {
      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const countForWave = Math.min(CHUNK_SIZE, questionCount - accumulatedQuestions.length);
        setGenerationStepLabel(
          totalChunks > 1
            ? `Rédaction docimologique (${activeCourseRootTitle} #${targetSeriesNum}) — Lot ${chunkIdx + 1}/${totalChunks}...`
            : `Conception de ${activeCourseRootTitle} #${targetSeriesNum} (${countForWave} QCM)...`
        );

        const payload = {
          courseContent: combinedCourseContent,
          content: combinedCourseContent,
          courseTitle: activeCourseRootTitle,
          archetypes: selectedArchetypes,
          archetype: selectedArchetypes.length === 1 ? selectedArchetypes[0] : 'mixte',
          cognitiveTier: selectedTier,
          difficulty: selectedTier,
          questionCount: countForWave,
          count: countForWave,
          seriesNumber: targetSeriesNum,
          excludedConcepts,
          examArchiveText
        };

        // 1. Tenter l'Edge Function Supabase en priorité
        let responseData: any = null;
        try {
          const { data, error } = await supabase.functions.invoke('generate-quiz', { body: payload });
          if (!error && data && (Array.isArray(data.questions) || Array.isArray(data))) {
            responseData = data;
          } else if (error) {
            console.warn("L'Edge Function Supabase a retourné une erreur, bascule vers le moteur autonome :", error);
          }
        } catch (edgeErr) {
          console.warn("Échec d'appel à l'Edge Function Supabase, bascule vers le moteur autonome :", edgeErr);
        }

        // 2. Si l'Edge Function n'a pas répondu (ex: non déployée, billing OpenAI sur Supabase...), relais immédiat sur le moteur académique direct
        if (!responseData) {
          setGenerationStepLabel(
            `Conception docimologique directe (${activeCourseRootTitle} #${targetSeriesNum})...`
          );

          const formatMap: Record<QuestionArchetype, DocimologicalFormat> = {
            complement_multiple: 'election',
            censure: 'censure',
            groupage: 'groupage',
            jumelage: 'jumelage',
            association: 'association'
          };
          const scheduledFormats = selectedArchetypes.map((a) => formatMap[a] || 'election');

          const systemInstruction = `Tu es un Professeur Agrégé de Médecine et Président de Jury Docimologique.
Tu conçois personnellement des évaluations QCM d'une rigueur absolue à partir du cours fourni ("${activeCourseRootTitle}", Série #${targetSeriesNum}).
Tu respectes strictement les règles docimologiques (Élection 1/5, Censure 1 fausse parmi 5, Groupage I-V, Jumelage PARCE QUE, Association 1-5 et A-E).
Tu réponds EXCLUSIVEMENT par un tableau JSON de questions sans balises markdown superflues.`;

          const batchPrompt = buildUniversalDocimologicalBatchPrompt({
            courseTitle: activeCourseRootTitle,
            courseChunk: combinedCourseContent.slice(0, 28000),
            batchFormats: scheduledFormats,
            batchStartIndex: accumulatedQuestions.length,
            difficulty: selectedTier,
            annalesPoleB: examArchiveText,
            sessionNumber: targetSeriesNum,
            pastStems: excludedConcepts
          });

          let collectedRaw: any[] = [];

          try {
            const dawiaResult = await callDawiaEngine(
              "dawia2",
              systemInstruction,
              batchPrompt,
              0.35
            );
            if (dawiaResult) {
              const parsed = repairAndParseQuizJson(dawiaResult);
              const list = Array.isArray(parsed) ? parsed : parsed?.questions || parsed?.qcm || [];
              if (Array.isArray(list) && list.length > 0) {
                collectedRaw = list;
              }
            }
          } catch (dawiaErr) {
            console.warn("Relais DAWIA :", dawiaErr);
          }

          // Le synthétiseur docimologique garantit la complétion et la validité à 100% à partir du cours
          const validated = sanitizeAndValidateQuestions(
            collectedRaw,
            activeCourseRootTitle,
            {
              expectedCount: countForWave,
              selectedFormats: scheduledFormats,
              courseText: combinedCourseContent,
              difficulty: selectedTier,
              sessionNumber: targetSeriesNum
            }
          );

          // Transformation en QuizQuestion
          const romanNumerals: ('I' | 'II' | 'III' | 'IV' | 'V')[] = ['I', 'II', 'III', 'IV', 'V'];
          const mappedQuestions = validated.map((vq, vIdx) => {
            let archetype: QuestionArchetype = 'complement_multiple';
            if (vq.format === 'censure') archetype = 'censure';
            else if (vq.format === 'groupage') archetype = 'groupage';
            else if (vq.format === 'jumelage') archetype = 'jumelage';
            else if (vq.format === 'association') archetype = 'association';

            const groupageStatements = vq.groupStatements
              ? vq.groupStatements.map((g, gi) => ({
                  numeral: romanNumerals[gi] || 'I',
                  text: g.text,
                  isTrue: g.isTrue
                }))
              : null;

            const jumelageData = vq.jumelageStatements
              ? {
                  statementOne: vq.jumelageStatements.statement1,
                  connector: 'PARCE QUE' as const,
                  statementTwo: vq.jumelageStatements.statement2
                }
              : null;

            const matchingColumns = vq.associationPairs && vq.associationPairs.length > 0
              ? {
                  leftColumnTitle: 'Colonne 1 (Entités cliniques)',
                  rightColumnTitle: 'Colonne 2 (Mécanismes & Critères)',
                  leftItems: vq.associationPairs.map((p, pi) => ({
                    id: String(pi + 1),
                    text: p.leftText
                  })),
                  rightItems: vq.associationPairs.map((p, pi) => ({
                    id: p.rightLetter || LETTERS[pi],
                    text: p.rightText
                  }))
                }
              : null;

            const opts = vq.options.map((o, oi) => ({
              letter: (o.letter || LETTERS[oi]) as OptionLetter,
              text: o.text,
              rationale: o.rationale || (o.isCorrect ? 'Proposition exacte.' : 'Proposition inexacte.')
            }));

            const correctOpt = vq.options.find((o) => o.isCorrect) || vq.options[0];
            const correctLetter = (correctOpt?.letter || 'A') as OptionLetter;

            return {
              id: `${newSeriesId}-q-${accumulatedQuestions.length + vIdx + 1}`,
              index: accumulatedQuestions.length + vIdx + 1,
              archetype,
              cognitiveTier: selectedTier,
              stem: vq.stem,
              conceptTag: vq.subject || activeCourseRootTitle,
              matchingColumns,
              groupageStatements,
              jumelageData,
              options: opts,
              correctLetter,
              globalExplanation: vq.globalSynthesis || 'Synthèse docimologique détaillée.',
              courseExcerpt: ''
            };
          });

          responseData = { questions: mappedQuestions };
        }

        const rawList = Array.isArray(responseData.questions)
          ? responseData.questions
          : Array.isArray(responseData)
          ? responseData
          : [];

        // Normalisation et mélange anti-série (Fisher-Yates + Anti-Streak) côté client
        const normalizedWave = enforceClientSideRandomizationAndStructure(
          rawList,
          selectedTier
        ).map((q, i) => ({
          ...q,
          id: `${newSeriesId}-q-${accumulatedQuestions.length + i + 1}`,
          index: accumulatedQuestions.length + i + 1
        }));

        for (const q of normalizedWave) {
          excludedConcepts.push(`${q.conceptTag} : ${q.stem.slice(0, 65)}`);
        }

        accumulatedQuestions = [...accumulatedQuestions, ...normalizedWave];

        if (chunkIdx === 0) {
          const newSession: QuizSeriesSession = {
            id: newSeriesId,
            courseRootTitle: activeCourseRootTitle,
            seriesNumber: targetSeriesNum,
            displayTitle: `${activeCourseRootTitle} #${targetSeriesNum}`,
            createdAt: new Date().toISOString(),
            archetypes: selectedArchetypes,
            cognitiveTier: selectedTier,
            questions: accumulatedQuestions
          };
          setSeriesList((prev) => [newSession, ...prev]);
          setActiveSeriesId(newSeriesId);
          setActiveQuestionIdx(0);
          setExamValidated(false);
          setConfigCollapsed(true); // Repli élégant du panneau de config pour laisser place au défilement
        } else {
          setSeriesList((prev) =>
            prev.map((s) =>
              s.id === newSeriesId ? { ...s, questions: accumulatedQuestions } : s
            )
          );
        }
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          "Une erreur est survenue lors de l'appel à l'Edge Function Supabase."
      );
    } finally {
      setIsGenerating(false);
      setGenerationStepLabel('');
    }
  };

  // Sélection d'une option A-E
  const handleSelectOption = (questionId: string, letter: OptionLetter, qIdx: number) => {
    if (!instantFeedback && examValidated) return;
    if (instantFeedback && userAnswers[questionId]) return;

    setUserAnswers((prev) => ({ ...prev, [questionId]: letter }));
    setActiveQuestionIdx(qIdx);
  };

  const scrollToQuestion = (targetIdx: number) => {
    if (!activeSeries) return;
    const bounded = Math.max(0, Math.min(activeSeries.questions.length - 1, targetIdx));
    setActiveQuestionIdx(bounded);
    questionCardRefs.current[bounded]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  };

  // Navigation Clavier (A-E pour voter, Flèches ↑/↓ ou J/K pour défiler)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!activeSeries || activeSeries.questions.length === 0) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      const currentQ = activeSeries.questions[activeQuestionIdx];
      const upper = e.key.toUpperCase();

      if (['A', 'B', 'C', 'D', 'E'].includes(upper) && currentQ) {
        e.preventDefault();
        handleSelectOption(currentQ.id, upper as OptionLetter, activeQuestionIdx);
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        scrollToQuestion(activeQuestionIdx + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        scrollToQuestion(activeQuestionIdx - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSeries, activeQuestionIdx, userAnswers, instantFeedback, examValidated]);

  // Statistiques en temps réel de la série active
  const sessionStats = useMemo(() => {
    if (!activeSeries) return { answered: 0, correct: 0, total: 0, pct: 0, scoreOn20: '0.0' };
    const total = activeSeries.questions.length;
    let answered = 0;
    let correct = 0;

    for (const q of activeSeries.questions) {
      const chosen = userAnswers[q.id];
      if (chosen) {
        answered++;
        if (chosen === q.correctLetter) correct++;
      }
    }

    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    const scoreOn20 = answered > 0 ? ((correct / answered) * 20).toFixed(1) : '0.0';
    return { answered, correct, total, pct, scoreOn20 };
  }, [activeSeries, userAnswers]);

  const resetCurrentSeriesAnswers = () => {
    if (!activeSeries) return;
    setUserAnswers((prev) => {
      const next = { ...prev };
      for (const q of activeSeries.questions) {
        delete next[q.id];
      }
      return next;
    });
    setExamValidated(false);
    setActiveQuestionIdx(0);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1F1A16] font-sans selection:bg-[#C85A32]/15 selection:text-[#9E3F1D]">
      {/* BARRE SUPÉRIEURE ÉDITORIALE (STICKY, HORIZONTALE, CHALEUREUSE) */}
      <header className="sticky top-0 z-30 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E6DFD3]">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          {/* Onglets des Séries Générées (ex: Anémies #1, Anémies #2...) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <div className="flex items-center gap-2 pr-3 border-r border-[#E2D9CC] shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#C85A32]" />
              <span className="font-serif text-sm font-semibold tracking-tight text-[#1F1A16]">
                Atelier Docimologique
              </span>
            </div>

            {seriesList.length === 0 ? (
              <span className="text-xs text-[#8A7F74] italic">
                Aucune série active — configurez votre session ci-dessous
              </span>
            ) : (
              seriesList.map((s) => {
                const isCurrent = s.id === activeSeries?.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveSeriesId(s.id);
                      setActiveQuestionIdx(0);
                    }}
                    className={`group inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all shrink-0 border ${
                      isCurrent
                        ? 'bg-[#1F1A16] text-[#FAF7F2] border-[#1F1A16] shadow-sm font-medium'
                        : 'bg-[#F3EDE2] text-[#5C5349] border-[#E2D9CC] hover:bg-[#EAE1D3] hover:text-[#1F1A16]'
                    }`}
                  >
                    <span>{s.courseRootTitle}</span>
                    <span
                      className={`font-mono text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
                        isCurrent
                          ? 'bg-[#C85A32] text-white'
                          : 'bg-[#E2D9CC] text-[#3D362F]'
                      }`}
                    >
                      #{s.seriesNumber}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Indicateurs de progression & Actions rapides sur une seule ligne */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowApiKeyModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#DED5C7] bg-white hover:bg-[#F5EFE6] text-xs text-[#4A423A] transition"
              title="Configurer votre clé API (OpenRouter, Claude, Gemini)"
            >
              <Key className="w-3.5 h-3.5 text-[#C85A32]" />
              <span className="hidden sm:inline">Clé API</span>
              {customApiKey ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[#28664B]" title="Clé active" />
              ) : null}
            </button>

            {activeSeries && (
              <>
                <button
                  onClick={() => setInstantFeedback((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#DED5C7] bg-white hover:bg-[#F5EFE6] text-xs text-[#4A423A] transition"
                  title="Basculer entre Correction Immédiate et Mode Examen"
                >
                  {instantFeedback ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-[#C85A32]" />
                      <span className="hidden sm:inline">Correction directe</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-[#7A7067]" />
                      <span className="hidden sm:inline">Mode Examen</span>
                    </>
                  )}
                </button>

                <div className="hidden md:flex items-center gap-2.5 px-3 py-1 rounded-full bg-[#F3EDE2] border border-[#E2D9CC]">
                  <span className="font-mono text-xs text-[#4A423A]">
                    {sessionStats.answered}/{sessionStats.total}
                  </span>
                  <div className="w-20 h-1.5 rounded-full bg-[#DED5C7] overflow-hidden">
                    <div
                      className="h-full bg-[#C85A32] transition-all duration-500"
                      style={{ width: `${sessionStats.pct}%` }}
                    />
                  </div>
                  {(instantFeedback || examValidated) && sessionStats.answered > 0 && (
                    <span className="font-mono text-xs font-semibold text-[#28664B]">
                      {sessionStats.scoreOn20}/20
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setConfigCollapsed((c) => !c)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition ${
                    configCollapsed
                      ? 'bg-white border-[#DED5C7] text-[#1F1A16] hover:bg-[#F3EDE2]'
                      : 'bg-[#F3EDE2] border-[#C85A32]/40 text-[#C85A32]'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{configCollapsed ? 'Paramètres' : 'Masquer'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 pt-6 pb-28">
        {/* CONSOLE DE PARAMÉTRAGE ÉDITORIALE (REMPLACE LES GROSSES CARTES MARRON ET LE BLOC NOIR) */}
        {(!configCollapsed || !activeSeries) && (
          <section className="mb-8 rounded-2xl bg-white border border-[#E6DFD3] shadow-[0_4px_24px_-6px_rgba(31,26,22,0.06)] overflow-hidden transition-all">
            {/* Bandeau supérieur : Sources de cours en Pilules Tactiles (Style Flutter avec bouton ×) */}
            <div className="p-4 sm:px-6 bg-[#FBF9F5] border-b border-[#EDE6DC]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider font-semibold text-[#8A7F74]">
                    01 • Sources du cours
                  </span>
                  <span className="text-xs text-[#A3988B]">—</span>
                  <span className="text-xs text-[#5C5349]">
                    Prochaine série générée :{' '}
                    <strong className="font-mono text-[#C85A32] bg-[#FDF3EE] px-2 py-0.5 rounded border border-[#C85A32]/25">
                      {activeCourseRootTitle} #{nextSeriesNumber}
                    </strong>
                  </span>
                </div>

                {/* Boutons d'ajout de source compacts sur une seule ligne */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowLibraryPicker((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                      showLibraryPicker
                        ? 'bg-[#1F1A16] text-white border-[#1F1A16]'
                        : 'bg-white text-[#3D362F] border-[#DCD3C6] hover:bg-[#F3EDE2]'
                    }`}
                  >
                    <Library className="w-3.5 h-3.5 text-[#C85A32]" />
                    <span>Bibliothèque ({libraryCourses.length})</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#F3EDE2] text-[#3D362F] border border-[#DCD3C6] text-xs font-medium transition"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#C85A32]" />
                    <span>Importer PDF / Fichier</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowTextDrawer((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                      showTextDrawer
                        ? 'bg-[#1F1A16] text-white border-[#1F1A16]'
                        : 'bg-white text-[#3D362F] border-[#DCD3C6] hover:bg-[#F3EDE2]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-[#C85A32]" />
                    <span>Texte / Annales</span>
                  </button>
                </div>
              </div>

              {/* Liste des tags de cours actifs avec bouton × pour supprimer individuellement */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedSources.length === 0 ? (
                  <div className="text-xs text-[#8A7F74] py-1">
                    Aucun cours sélectionné. Choisissez un cours de la bibliothèque ou importez un fichier.
                  </div>
                ) : (
                  selectedSources.map((src) => (
                    <div
                      key={src.id}
                      className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1 rounded-full bg-white border border-[#D8CFC2] shadow-2xs text-xs text-[#2B2520]"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-[#C85A32] shrink-0" />
                      <span className="font-medium truncate max-w-[220px]">
                        {src.cleanRootName}
                      </span>
                      <span className="font-mono text-[10px] text-[#8A7F74] px-1.5 py-0.2 rounded bg-[#F5EFE6]">
                        {src.wordCount} mots
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSourceTag(src.id)}
                        className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-[#F3E3DC] text-[#8A7F74] hover:text-[#B83B2B] transition"
                        title={`Retirer ${src.title}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Tiroir de sélection rapide dans la Bibliothèque existante */}
              {showLibraryPicker && (
                <div className="mt-3 pt-3 border-t border-[#EAE2D6] grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {libraryCourses.map((course) => {
                    const isAlreadyAdded = selectedSources.some((s) => s.id === course.id);
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => {
                          if (isAlreadyAdded) {
                            removeSourceTag(course.id);
                          } else {
                            setSelectedSources((prev) => [...prev, course]);
                          }
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border text-left text-xs transition ${
                          isAlreadyAdded
                            ? 'bg-[#FDF3EE] border-[#C85A32] text-[#1F1A16]'
                            : 'bg-white border-[#E6DFD3] text-[#4A423A] hover:bg-[#F5EFE6]'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="font-medium truncate">{course.title}</div>
                          <div className="text-[10px] text-[#8A7F74] font-mono">
                            Racine : {course.cleanRootName} • {course.wordCount} mots
                          </div>
                        </div>
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            isAlreadyAdded
                              ? 'bg-[#C85A32] text-white'
                              : 'bg-[#F3EDE2] text-[#7A7067]'
                          }`}
                        >
                          {isAlreadyAdded ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tiroir Texte Libre & Mimétisme d'Annales (Pôle B) */}
              {showTextDrawer && (
                <div className="mt-3 pt-3 border-t border-[#EAE2D6] grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="Titre de la leçon (ex: Insuffisance Cardiaque)"
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#DCD3C6] text-xs text-[#1F1A16] focus:outline-none focus:border-[#C85A32]"
                    />
                    <textarea
                      rows={3}
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="Collez ici un chapitre ou extrait de cours..."
                      className="w-full p-2.5 rounded-lg bg-white border border-[#DCD3C6] text-xs text-[#1F1A16] focus:outline-none focus:border-[#C85A32]"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualTextSource}
                      className="px-3 py-1.5 rounded-lg bg-[#1F1A16] text-white text-xs font-medium hover:bg-[#332B25] transition"
                    >
                      Ajouter comme tag de cours
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-mono uppercase text-[#7A7067]">
                      Calibrage Annales (Pôle B — Optionnel)
                    </label>
                    <textarea
                      rows={4}
                      value={examArchiveText}
                      onChange={(e) => setExamArchiveText(e.target.value)}
                      placeholder="Collez 2 ou 3 anciens QCM du professeur pour que Sonnet 4.6 clone son style d'interrogation..."
                      className="w-full p-2.5 rounded-lg bg-white border border-[#DCD3C6] text-xs text-[#1F1A16] focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Corps du panneau : Les 3 Nouveaux Paliers Cognitifs */}
            <div className="p-4 sm:px-6 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-wider font-semibold text-[#8A7F74]">
                    02 • Palier d’exigence cognitive
                  </span>
                  <span className="text-[11px] text-[#7A7067]">
                    Piloté par Claude Sonnet 4.6
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {COGNITIVE_TIERS.map((tier) => {
                    const isSelected = selectedTier === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setSelectedTier(tier.id)}
                        className={`group text-left p-3.5 rounded-xl border transition-all relative ${
                          isSelected
                            ? 'bg-[#FDF6F0] border-[#C85A32] shadow-[0_2px_10px_-2px_rgba(200,90,50,0.15)]'
                            : 'bg-[#FAF8F5] border-[#E6DFD3] hover:bg-[#F4EFE6] hover:border-[#D5CBBF]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${
                              isSelected
                                ? 'bg-[#C85A32] text-white'
                                : 'bg-[#EAE2D6] text-[#6E655C]'
                            }`}
                          >
                            {tier.num}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isSelected ? 'bg-[#C85A32]' : 'bg-[#D5CBBF]'
                            }`}
                          />
                        </div>
                        <div className="font-serif font-semibold text-sm text-[#1F1A16] mt-1">
                          {tier.title}
                        </div>
                        <div className="text-[11px] font-medium text-[#C85A32] mt-0.5">
                          {tier.subtitle}
                        </div>
                        <p className="text-[11px] text-[#6E655C] mt-1.5 leading-snug">
                          {tier.detail}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ligne finale : Sélecteur des types de QCM + Nombre de questions + Bouton d'exécution */}
              <div className="pt-4 border-t border-[#EFE9DF] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider font-semibold text-[#8A7F74]">
                      03 • Formats docimologiques ({selectedArchetypes.length} sélectionné{selectedArchetypes.length > 1 ? 's' : ''})
                    </span>
                    <button
                      type="button"
                      onClick={selectAllArchetypes}
                      className="text-[11px] font-medium text-[#C85A32] hover:underline"
                    >
                      Tout activer (Panachage)
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {ARCHETYPE_CATALOG.map((arch) => {
                      const active = selectedArchetypes.includes(arch.id);
                      return (
                        <button
                          key={arch.id}
                          type="button"
                          onClick={() => toggleArchetype(arch.id)}
                          title={arch.desc}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                            active
                              ? 'bg-[#1F1A16] text-[#FAF7F2] border-[#1F1A16]'
                              : 'bg-[#FAF8F5] text-[#5C5349] border-[#E2D9CC] hover:bg-[#F1EAE0]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              active ? 'bg-[#C85A32]' : 'bg-[#C7BDB0]'
                            }`}
                          />
                          <span>{arch.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quantité + Bouton de lancement sur la même ligne */}
                <div className="flex items-center gap-2.5 self-end lg:self-center shrink-0">
                  <div className="inline-flex items-center bg-[#F3EDE2] border border-[#E2D9CC] rounded-xl p-1">
                    {[5, 10, 20, 30].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setQuestionCount(cnt)}
                        className={`px-2.5 py-1 rounded-lg font-mono text-xs transition ${
                          questionCount === cnt
                            ? 'bg-white text-[#1F1A16] font-bold shadow-2xs'
                            : 'text-[#6E655C] hover:text-[#1F1A16]'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateSeries}
                    disabled={isGenerating || selectedSources.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#B24B26] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-[0_4px_14px_-2px_rgba(200,90,50,0.4)] transition cursor-pointer"
                  >
                    <span>
                      {isGenerating
                        ? generationStepLabel || 'Élaboration en cours...'
                        : `Construire ${activeCourseRootTitle} #${nextSeriesNumber}`}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-[#FDF1F0] border border-[#E8B4AE] text-xs text-[#9E2A1C] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                  <button
                    onClick={() => setErrorMessage(null)}
                    className="text-[11px] underline ml-4"
                  >
                    Fermer
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* FLUX DE DÉFILEMENT VERTICAL DES QCM (ESTHÉTIQUE ÉDITORIALE PAPIER CHAUD) */}
        {activeSeries && activeSeries.questions.length > 0 ? (
          <div className="space-y-6">
            {/* Bandeau récapitulatif de la série en cours */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#F3EDE2] border border-[#E2D9CC]">
              <div className="flex items-center gap-3">
                <span className="font-serif font-bold text-base text-[#1F1A16]">
                  {activeSeries.displayTitle}
                </span>
                <span className="font-mono text-[11px] uppercase px-2.5 py-0.5 rounded-full bg-white border border-[#DCD3C6] text-[#5C5349]">
                  {COGNITIVE_TIERS.find((t) => t.id === activeSeries.cognitiveTier)?.title}
                </span>
                <span className="text-xs text-[#6E655C] hidden sm:inline">
                  • Navigation clavier : touches <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#D5CBBF] font-mono text-[10px]">A</kbd>–<kbd className="px-1.5 py-0.5 bg-white rounded border border-[#D5CBBF] font-mono text-[10px]">E</kbd> et <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#D5CBBF] font-mono text-[10px]">↑</kbd><kbd className="px-1.5 py-0.5 bg-white rounded border border-[#D5CBBF] font-mono text-[10px]">↓</kbd>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetCurrentSeriesAnswers}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#FAF7F2] border border-[#DCD3C6] text-xs text-[#4A423A] transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Réinitialiser</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerateSeries}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#1F1A16] hover:bg-[#342C26] text-white text-xs font-medium transition"
                >
                  <Plus className="w-3.5 h-3.5 text-[#C85A32]" />
                  <span>Nouvelle série ({activeCourseRootTitle} #{nextSeriesNumber})</span>
                </button>
              </div>
            </div>

            {/* Cartes de QCM en mode Défilement Vertical */}
            {activeSeries.questions.map((q, qIdx) => {
              const userChoice = userAnswers[q.id];
              const isRevealed = (instantFeedback && !!userChoice) || examValidated;
              const isFocused = activeQuestionIdx === qIdx;

              return (
                <article
                  key={q.id}
                  ref={(el) => (questionCardRefs.current[qIdx] = el)}
                  onClick={() => setActiveQuestionIdx(qIdx)}
                  className={`rounded-2xl bg-white border transition-all duration-200 p-6 sm:p-7 ${
                    isFocused
                      ? 'border-[#C85A32]/60 shadow-[0_8px_30px_-8px_rgba(31,26,22,0.1)] ring-1 ring-[#C85A32]/20'
                      : 'border-[#E6DFD3] shadow-[0_2px_10px_-4px_rgba(31,26,22,0.04)] opacity-90 hover:opacity-100'
                  }`}
                >
                  {/* En-tête de la question */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-[#F1ECE2]">
                    <div className="flex items-center gap-2.5">
                      <span className="font-serif font-bold text-sm px-2.5 py-1 rounded-lg bg-[#1F1A16] text-[#FAF7F2]">
                        Q.{String(qIdx + 1).padStart(2, '0')}
                      </span>
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#FDF3EE] text-[#C85A32] border border-[#C85A32]/25">
                        {ARCHETYPE_CATALOG.find((a) => a.id === q.archetype)?.shortTag || q.archetype}
                      </span>
                      {q.archetype === 'censure' && (
                        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[#FDF1F0] text-[#B83B2B] border border-[#E8B4AE]">
                          COCHER LA PROPOSITION FAUSSE
                        </span>
                      )}
                      <span className="text-xs text-[#7A7067] hidden sm:inline">
                        • {q.conceptTag}
                      </span>
                    </div>

                    <span className="font-mono text-[11px] text-[#8A7F74]">
                      {activeSeries.displayTitle}
                    </span>
                  </div>

                  {/* Énoncé principal */}
                  <h2 className="font-serif text-base sm:text-[18px] font-medium leading-relaxed text-[#1F1A16] mb-5">
                    {q.stem}
                  </h2>

                  {/* CAS 1 : ASSOCIATION — AFFICHAGE OBLIGATOIRE DES 2 COLONNES (1-5 et A-E) AVANT LES PROPOSITIONS */}
                  {q.archetype === 'association' && q.matchingColumns && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 rounded-xl bg-[#FAF7F2] border border-[#E2D9CC]">
                      <div>
                        <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#C85A32] pb-2 mb-2.5 border-b border-[#E2D9CC]">
                          {q.matchingColumns.leftColumnTitle || 'Colonne 1 (Éléments 1 à 5)'}
                        </div>
                        <ul className="space-y-2">
                          {q.matchingColumns.leftItems.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-[#E6DFD3] text-xs sm:text-sm text-[#1F1A16]"
                            >
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[#1F1A16] text-white shrink-0">
                                {item.id}
                              </span>
                              <span className="leading-snug">{item.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#28664B] pb-2 mb-2.5 border-b border-[#E2D9CC]">
                          {q.matchingColumns.rightColumnTitle || 'Colonne 2 (Éléments A à E)'}
                        </div>
                        <ul className="space-y-2">
                          {q.matchingColumns.rightItems.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-[#E6DFD3] text-xs sm:text-sm text-[#1F1A16]"
                            >
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[#28664B] text-white shrink-0">
                                {item.id}
                              </span>
                              <span className="leading-snug">{item.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* CAS 2 : GROUPAGE — ASSERTIONS NUMÉROTÉES DE I À V BIEN SÉPARÉES DES CHOIX A-E */}
                  {q.archetype === 'groupage' &&
                    q.groupageStatements &&
                    q.groupageStatements.length > 0 && (
                      <div className="mb-6 pl-4 border-l-2 border-[#C85A32] space-y-2">
                        {q.groupageStatements.map((stmt) => (
                          <div
                            key={stmt.numeral}
                            className="flex items-start gap-3 p-3 rounded-xl bg-[#FAF7F2] border border-[#E6DFD3] text-xs sm:text-sm text-[#1F1A16]"
                          >
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[#F3EDE2] border border-[#D8CFC2] text-[#1F1A16] shrink-0">
                              {stmt.numeral}
                            </span>
                            <span className="leading-relaxed flex-1">{stmt.text}</span>
                            {isRevealed && typeof stmt.isTrue === 'boolean' && (
                              <span
                                className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                                  stmt.isTrue
                                    ? 'bg-[#EEF6F1] text-[#28664B] border border-[#B7DFC7]'
                                    : 'bg-[#FDF1F0] text-[#B83B2B] border border-[#E8B4AE]'
                                }`}
                              >
                                {stmt.isTrue ? 'VRAI' : 'FAUX'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                  {/* CAS 3 : JUMELAGE — PROPOSITION 1 + CONNECTEUR LOGIQUE + PROPOSITION 2 */}
                  {q.archetype === 'jumelage' && q.jumelageData && (
                    <div className="mb-6 p-4 rounded-xl bg-[#FAF7F2] border border-[#E2D9CC] space-y-2.5">
                      <div className="p-3 rounded-lg bg-white border border-[#E6DFD3] text-xs sm:text-sm text-[#1F1A16]">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#C85A32] block mb-1">
                          Première assertion
                        </span>
                        {q.jumelageData.statementOne}
                      </div>

                      <div className="flex justify-center">
                        <span className="font-mono text-[11px] font-bold tracking-widest px-3.5 py-0.5 rounded-full bg-[#FCF6EB] text-[#B67B24] border border-[#E6CE9E]">
                          {q.jumelageData.connector || 'PARCE QUE'}
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-white border border-[#E6DFD3] text-xs sm:text-sm text-[#1F1A16]">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#28664B] block mb-1">
                          Seconde assertion
                        </span>
                        {q.jumelageData.statementTwo}
                      </div>
                    </div>
                  )}

                  {/* LES 5 CHOIX DE RÉPONSE (A, B, C, D, E) */}
                  <div className="space-y-2">
                    {q.options.map((opt) => {
                      const isSelected = userChoice === opt.letter;
                      const isCorrect = opt.letter === q.correctLetter;

                      let rowClasses =
                        'bg-[#FAF8F5] hover:bg-[#F3EDE2] border-[#E6DFD3] text-[#1F1A16]';
                      let letterBadgeClasses =
                        'bg-white border border-[#D8CFC2] text-[#4A423A]';

                      if (isRevealed) {
                        if (isCorrect) {
                          rowClasses =
                            'bg-[#EEF6F1] border-[#28664B] text-[#153D2B] shadow-2xs';
                          letterBadgeClasses = 'bg-[#28664B] text-white border-[#28664B] font-bold';
                        } else if (isSelected && !isCorrect) {
                          rowClasses = 'bg-[#FDF1F0] border-[#B83B2B] text-[#6E1C12]';
                          letterBadgeClasses = 'bg-[#B83B2B] text-white border-[#B83B2B] font-bold';
                        } else {
                          rowClasses = 'bg-[#FAF8F5]/60 border-[#EFE9DF] text-[#8A7F74]';
                          letterBadgeClasses = 'bg-[#F3EDE2] text-[#9C9288] border-[#E6DFD3]';
                        }
                      } else if (isSelected) {
                        rowClasses = 'bg-[#FDF3EE] border-[#C85A32] text-[#1F1A16]';
                        letterBadgeClasses = 'bg-[#C85A32] text-white border-[#C85A32] font-bold';
                      }

                      return (
                        <button
                          key={opt.letter}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectOption(q.id, opt.letter, qIdx);
                          }}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 cursor-pointer ${rowClasses}`}
                        >
                          <span
                            className={`w-7 h-7 rounded-lg font-mono text-xs flex items-center justify-center shrink-0 transition ${letterBadgeClasses}`}
                          >
                            {opt.letter}
                          </span>

                          <div className="flex-1 text-xs sm:text-sm leading-relaxed">
                            <div className="font-medium">{opt.text}</div>
                            {isRevealed && opt.rationale && (
                              <p className="mt-1.5 text-xs text-[#5C5349] font-normal">
                                {opt.rationale}
                              </p>
                            )}
                          </div>

                          {isRevealed && isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-[#28664B] shrink-0 mt-1" />
                          )}
                          {isRevealed && isSelected && !isCorrect && (
                            <XCircle className="w-4 h-4 text-[#B83B2B] shrink-0 mt-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* TIROIR DE CORRECTION DOCIMOLOGIQUE & PREUVE DU COURS */}
                  {isRevealed && (
                    <div className="mt-5 pt-4 border-t border-[#EAE2D6] space-y-3">
                      <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E2D9CC]">
                        <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#C85A32] mb-1">
                          Synthèse Docimologique • Réponse exacte : {q.correctLetter}
                        </div>
                        <p className="text-xs sm:text-sm text-[#2B2520] leading-relaxed">
                          {q.globalExplanation}
                        </p>
                      </div>

                      {q.courseExcerpt && (
                        <blockquote className="px-4 py-2.5 rounded-r-xl bg-[#EEF6F1]/70 border-l-3 border-[#28664B] text-xs text-[#234837] italic">
                          <span className="not-italic font-semibold block mb-0.5">
                            Référence exacte dans le support de cours :
                          </span>
                          « {q.courseExcerpt} »
                        </blockquote>
                      )}
                    </div>
                  )}
                </article>
              );
            })}

            {/* Validation globale si l'étudiant est en Mode Examen */}
            {!instantFeedback && !examValidated && (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={() => setExamValidated(true)}
                  className="px-6 py-3 rounded-xl bg-[#1F1A16] hover:bg-[#332B25] text-white font-semibold text-sm shadow-md transition"
                >
                  Remettre ma copie et afficher le corrigé ({sessionStats.answered}/{sessionStats.total})
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ÉTAT D'ACCUEIL ÉDITORIAL QUAND AUCUNE SÉRIE N'EST ENCORE LANCÉE */
          <div className="rounded-2xl border border-dashed border-[#D8CFC2] bg-[#FBF9F5] p-10 text-center">
            <div className="w-11 h-11 rounded-xl bg-[#FDF3EE] border border-[#C85A32]/25 flex items-center justify-center mx-auto mb-3">
              <GraduationCap className="w-5 h-5 text-[#C85A32]" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-[#1F1A16] mb-1">
              Prêt à forger la série {activeCourseRootTitle} #{nextSeriesNumber}
            </h3>
            <p className="text-xs text-[#6E655C] max-w-md mx-auto mb-5 leading-relaxed">
              Sélectionnez votre cours, votre palier cognitif et vos formats ci-dessus. Les tableaux d’Association à 2 colonnes (1–5 ↔ A–E) et la distribution aléatoire des réponses sont garantis.
            </p>
            <button
              type="button"
              onClick={handleGenerateSeries}
              disabled={isGenerating || selectedSources.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1F1A16] hover:bg-[#332B25] disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer"
            >
              <span>Lancer {activeCourseRootTitle} #{nextSeriesNumber}</span>
              <ChevronRight className="w-4 h-4 text-[#C85A32]" />
            </button>
          </div>
        )}
      </main>

      {/* MODAL CONFIGURATION CLÉ API */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E6DFD3] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE2D6] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FDF3EE] border border-[#C85A32]/25 flex items-center justify-center">
                  <Key className="w-4 h-4 text-[#C85A32]" />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-sm text-[#1F1A16]">Configuration Clé API</h4>
                  <p className="text-[11px] text-[#7A7067]">OpenRouter (Sonnet & Gemini), Claude ou Google Gemini</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="w-6 h-6 rounded-full hover:bg-[#F5EFE6] flex items-center justify-center text-[#7A7067]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#1F1A16]">
                Clé API (OpenRouter <code className="text-[10px] bg-[#F3EDE2] px-1 py-0.5 rounded">sk-or-...</code>, Anthropic <code className="text-[10px] bg-[#F3EDE2] px-1 py-0.5 rounded">sk-ant-...</code> ou Gemini) :
              </label>
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder="Collez votre clé API ici..."
                className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#DCD3C6] text-xs text-[#1F1A16] font-mono focus:outline-none focus:border-[#C85A32]"
              />
              <p className="text-[11px] text-[#7A7067] leading-relaxed">
                Cette clé est stockée localement dans votre navigateur pour alimenter Claude Sonnet et Gemini 2.5 sans dépendre des limites ou pannes de l'Edge Function Supabase.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAE2D6]">
              {customApiKey && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('dawjang_openrouter_api_key');
                    localStorage.removeItem('dawjang_claude_api_key');
                    localStorage.removeItem('dawjang_gemini_api_key');
                    setCustomApiKey('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#E6DFD3] text-xs text-[#9E2A1C] hover:bg-[#FDF1F0] transition"
                >
                  Effacer
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const trimmed = customApiKey.trim();
                  if (trimmed.startsWith('sk-ant-')) {
                    localStorage.setItem('dawjang_claude_api_key', trimmed);
                  } else if (trimmed.startsWith('AIza')) {
                    localStorage.setItem('dawjang_gemini_api_key', trimmed);
                  } else if (trimmed) {
                    localStorage.setItem('dawjang_openrouter_api_key', trimmed);
                  }
                  setShowApiKeyModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#C85A32] text-white text-xs font-semibold hover:bg-[#B24B26] transition shadow-xs cursor-pointer"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Exportations multiples pour compatibilité immédiate avec toutes les routes de App.tsx / Sidebar
export const QuizWorkspace = ConstructeurQCM;
export const QuizBuilder = ConstructeurQCM;
export const QuizConstructor = ConstructeurQCM;
export default ConstructeurQCM;
