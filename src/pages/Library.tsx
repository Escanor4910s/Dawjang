import { untypedTable } from "@/lib/untypedDb";
// src/pages/Library.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  FileUp,
  Search,
  Trash2,
  CheckSquare,
  FileText,
  Layers,
  Clock,
  LayoutGrid,
  List as ListIcon,
  CheckCircle2,
  AlertTriangle,
  File,
  X,
  BookOpen,
  Target,
  Sparkles,
} from "lucide-react";
import { extractObjectivesFromCourseText } from "@/lib/summaryEngine";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { pushAppNotification } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/use-toast";
import { useFileReader } from "@/hooks/useFileReader";
import { cn } from "@/lib/utils";
import { permanentlyDeleteEntity, filterOutTombstoned } from "@/lib/syncEngine";

export interface StoredCourse {
  id: string;
  code: string;
  title: string;
  subject: string;
  updatedAt: string;
  wordCount: number;
  content: string;
}

interface StagedUploadItem {
  tempId: string;
  orderIndex: number;
  fileName: string;
  fileSizeKb: number;
  title: string;
  subject: string;
  content: string;
  isDuplicate: boolean;
}

export const COURSES_STORAGE_KEY = "hippocampus_courses_library_v2";

export const INITIAL_COURSES: StoredCourse[] = [
  {
    id: "course-230",
    code: "CARDIO",
    title: "Douleur thoracique aiguë et chronique",
    subject: "Cardiologie",
    updatedAt: "21 Oct. 2026",
    wordCount: 420,
    content: `Orientation diagnostique devant une douleur thoracique aiguë. Les 4 urgences vitales cardiovasculaires (PIED) doivent être éliminées en priorité absolue : Péricardite aiguë, Infarctus du myocarde (SCA), Embolie pulmonaire, Dissection aortique aiguë.`,
  },
  {
    id: "course-mi",
    code: "INFECTIO",
    title: "Généralités — Infections",
    subject: "Maladies Infectieuses",
    updatedAt: "20 Oct. 2026",
    wordCount: 510,
    content: `Une infection résulte de la pénétration et de la multiplication d'un micro-organisme pathogène dans un hôte. Les 4 facteurs favorisant l'émergence des infections sont les mutations microbiennes, la démographie humaine, la mobilité internationale et les changements climatiques.`,
  },
  {
    id: "course-irc",
    code: "PNEUMO",
    title: "Insuffisance Respiratoire Chronique (IRC)",
    subject: "Pneumologie",
    updatedAt: "18 Oct. 2026",
    wordCount: 380,
    content: `Le diagnostic positif d'IRC repose sur la gazométrie artérielle en air ambiant au repos montrant une PaO2 < 70 mmHg. Causes : BPCO, SOH, séquelles de tuberculose. Traitement : Oxygénothérapie de longue durée (OLD), VNI et réhabilitation.`,
  },
];

export function getSavedCourses(): StoredCourse[] {
  try {
    const saved = localStorage.getItem(COURSES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return filterOutTombstoned("course", parsed);
      }
    }
  } catch (e) {
    console.error(e);
  }
  return filterOutTombstoned("course", INITIAL_COURSES);
}

const SUBJECTS = [
  "Tous",
  "Cardiologie",
  "Maladies Infectieuses",
  "Pneumologie",
  "Néphrologie",
  "Neurologie",
];

export default function Library() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { readFile } = useFileReader();

  const [courses, setCourses] = useState<StoredCourse[]>(getSavedCourses);
  const [layoutMode, setLayoutMode] = useState<"mosaic" | "list">("mosaic");
  const [selectedSubject, setSelectedSubject] = useState("Tous");
  const [searchQuery, setSearchQuery] = useState("");

  // États de la Modale d'Upload (Upload Unique vs Upload de Masse)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<"single" | "bulk">("bulk");
  const [defaultSubject, setDefaultSubject] = useState("Médecine Générale");
  const [stagedFiles, setStagedFiles] = useState<StagedUploadItem[]>([]);

  const persistCourses = (updated: StoredCourse[]) => {
    setCourses(updated);
    localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(updated));
  };

  const openUploadModal = () => {
    setStagedFiles([]);
    setIsUploadModalOpen(true);
  };

  // Lecture ordonnée d'un ou plusieurs fichiers + détection automatique des doublons
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesArray =
      uploadMode === "single" ? [fileList[0]] : Array.from(fileList);

    const existingTitlesLower = new Set(
      courses.map((c) => (c.title || "").trim().toLowerCase())
    );
    const alreadyStagedLower = new Set(
      stagedFiles.map((s) => (s.title || "").trim().toLowerCase())
    );

    const unreadable: string[] = [];

    const readPromises = filesArray.map(async (file, idx): Promise<StagedUploadItem> => {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "").trim();
      const isDup =
        existingTitlesLower.has(cleanTitle.toLowerCase()) ||
        alreadyStagedLower.has(cleanTitle.toLowerCase());

      // Extraction réelle du texte : PDF, Word, PowerPoint, OpenDocument, texte…
      const result = await readFile(file);
      if (!result.success || result.content.trim().length < 40) {
        unreadable.push(`${file.name} — ${result.error || "aucun texte exploitable"}`);
      }

      return {
        tempId: `staged-${Date.now()}-${idx}`,
        orderIndex: stagedFiles.length + idx + 1,
        fileName: file.name,
        fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
        title: cleanTitle,
        subject: defaultSubject,
        content: result.success ? result.content : "",
        isDuplicate: isDup,
      };
    });

    const newStaged = await Promise.all(readPromises);

    if (unreadable.length > 0) {
      toast({
        title: "Texte non extrait de certains fichiers",
        description:
          unreadable.slice(0, 2).join(" • ") +
          " — Un PDF scanné (image) n'a pas de texte : exportez-le en PDF texte ou en .docx.",
        variant: "destructive",
      });
    }
    setStagedFiles((prev) =>
      uploadMode === "single"
        ? newStaged
        : [...prev, ...newStaged].map((item, i) => ({
            ...item,
            orderIndex: i + 1,
          }))
    );
    e.target.value = "";
  };

  // Supprimer un fichier pré-uploadé avant l'enregistrement (évite les doublons)
  const removeStagedFile = (tempId: string) => {
    setStagedFiles((prev) =>
      prev
        .filter((f) => f.tempId !== tempId)
        .map((item, idx) => ({ ...item, orderIndex: idx + 1 }))
    );
  };

  const updateStagedTitle = (tempId: string, newTitle: string) => {
    setStagedFiles((prev) =>
      prev.map((f) => (f.tempId === tempId ? { ...f, title: newTitle } : f))
    );
  };

  const updateStagedSubject = (tempId: string, newSubject: string) => {
    setStagedFiles((prev) =>
      prev.map((f) => (f.tempId === tempId ? { ...f, subject: newSubject } : f))
    );
  };

  // Validation finale de l'upload unique ou de masse
  const handleConfirmSaveStagedCourses = async () => {
    if (stagedFiles.length === 0) return;

    const existingByTitle = new Map(
      courses.map((c) => [(c.title || "").trim().toLowerCase(), c])
    );

    const createdCourses: StoredCourse[] = stagedFiles.map((item) => {
      const cleanTitle = item.title.trim() || item.fileName;
      const prior = existingByTitle.get(cleanTitle.toLowerCase());
      return {
        id: prior ? prior.id : `course-${Date.now()}-${item.orderIndex}`,
        code: item.subject.substring(0, 8).toUpperCase(),
        title: cleanTitle,
        subject: item.subject.trim() || prior?.subject || "Médecine",
        updatedAt: "Aujourd'hui",
        wordCount: Math.max(1, item.content.trim().split(/\s+/).filter(Boolean).length),
        content: item.content,
      };
    });

    const replacedIds = new Set(createdCourses.map((c) => c.id));
    const updated = [
      ...createdCourses,
      ...courses.filter((c) => !replacedIds.has(c.id)),
    ];
    persistCourses(updated);

    try {
      await untypedTable("courses").insert(
        createdCourses.map((c) => ({
          title: c.title,
          subject: c.subject,
          content: c.content,
        }))
      );
    } catch {
      // Sauvegarde locale garantie
    }

    pushAppNotification({
      type: "course",
      title: `${createdCourses.length} cours enregistré(s)`,
      message: `Ajouté(s) avec succès à votre Bibliothèque.`,
    });

    setIsUploadModalOpen(false);
    setStagedFiles([]);
    toast({
      title: "Importation terminée",
      description: `${createdCourses.length} leçon(s) ajoutée(s) à votre Bibliothèque.`,
    });
  };

  const handleDeleteCourse = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = courses.find((c) => c.id === id);
    await permanentlyDeleteEntity("course", id, target?.title);
    const updated = filterOutTombstoned(
      "course",
      courses.filter((c) => c.id !== id)
    );
    persistCourses(updated);
    toast({
      title: "Cours supprimé",
      description: "Le cours a été retiré de votre bibliothèque et synchronisé.",
    });
  };

  const launchShortcut = (
    course: StoredCourse,
    destination: "/summaries/new" | "/quiz" | "/smart-flashcards",
    e: React.MouseEvent,
    mode?: "objectives_verbatim" | "drive_objective_strategy"
  ) => {
    e.stopPropagation();
    localStorage.setItem(
      "hippocampus_active_course_shortcut",
      JSON.stringify(course)
    );
    const modeQuery = mode ? `&mode=${mode}` : "";
    navigate(`${destination}?courseId=${encodeURIComponent(course.id)}${modeQuery}`);
  };

  const filteredCourses = courses.filter((c) => {
    const matchesSubject =
      selectedSubject === "Tous" || c.subject === selectedSubject;
    const q = (searchQuery || "").trim().toLowerCase();
    const matchesSearch =
      !q ||
      (c.title || "").toLowerCase().includes(q) ||
      (c.subject || "").toLowerCase().includes(q);
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-6 pb-16">
      {/* EN-TÊTE ÉDITORIAL DAWJANG — UNIFIÉ AVEC MES RÉSUMÉS */}
      <header className="relative overflow-hidden rounded-2xl border border-[#EAE4DC] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-7 shadow-[0_8px_30px_-12px_rgba(24,24,27,0.06)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.16em] text-[#D96B43] font-semibold">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Archives & Polycopiés Synchronisés • Studio Académique</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-semibold tracking-tight text-[#18181B] dark:text-zinc-100">
              Bibliothèque Centrale des Cours
            </h1>
            <p className="text-[13px] sm:text-sm text-[#52525B] dark:text-zinc-400 leading-relaxed">
              Vos cours importés alimentent instantanément le{" "}
              <strong className="font-semibold text-[#18181B] dark:text-zinc-200">
                Rédacteur de Synthèses (Fidèle aux Objectifs &amp; Protocole Argon)
              </strong>
              , le{" "}
              <strong className="font-semibold text-[#18181B] dark:text-zinc-200">
                Constructeur de QCM
              </strong>{" "}
              et les{" "}
              <strong className="font-semibold text-[#18181B] dark:text-zinc-200">
                Smart Flashcards
              </strong>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              onClick={() => navigate("/summaries/new")}
              className="h-10 gap-2 rounded-xl border-[#EAE4DC] dark:border-zinc-700 bg-[#FAF8F5] dark:bg-zinc-800 text-[#18181B] dark:text-zinc-200 hover:border-[#D96B43]/50 text-xs font-medium"
            >
              <FileText className="h-3.5 w-3.5 text-[#D96B43]" />
              <span>Atelier de Synthèses</span>
            </Button>

            <Button
              onClick={openUploadModal}
              className="h-10 gap-2 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-[#FAF8F5] dark:bg-white dark:text-zinc-900 px-4 text-xs font-semibold shadow-xs transition-all"
            >
              <Plus className="h-4 w-4 text-[#D96B43]" />
              <span>Importer un Cours</span>
            </Button>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[#EAE4DC]/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-[#71717A]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF8F5] dark:bg-zinc-800 border border-[#EAE4DC] dark:border-zinc-700 text-[#18181B] dark:text-zinc-200 font-medium">
              <Target className="h-3 w-3 text-[#D96B43]" />
              <span>Détection automatique de la diapo « Objectifs »</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF8F5] dark:bg-zinc-800 border border-[#EAE4DC] dark:border-zinc-700 text-[#18181B] dark:text-zinc-200 font-medium">
              <Sparkles className="h-3 w-3 text-[#D96B43]" />
              <span>Synchronisation directe QCM & Synthèses</span>
            </span>
          </div>

          <div className="font-mono text-[11px] text-[#71717A]">
            {courses.length} cours enregistré{courses.length > 1 ? "s" : ""}
          </div>
        </div>
      </header>

      {/* FILTRES PAR MATIÈRE, RECHERCHE & BASCULE MOSAÏQUE / LISTE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {SUBJECTS.map((subj) => {
            const active = selectedSubject === subj;
            return (
              <button
                key={subj}
                type="button"
                onClick={() => setSelectedSubject(subj)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all duration-200 whitespace-nowrap",
                  active
                    ? "bg-[#18181B] text-[#FAF8F5] dark:bg-white dark:text-zinc-900 shadow-xs"
                    : "bg-white dark:bg-zinc-900 border border-[#EAE4DC] dark:border-zinc-800 text-[#52525B] dark:text-zinc-400 hover:text-[#18181B] hover:border-[#D96B43]/50"
                )}
              >
                {subj}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71717A]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un cours, une matière..."
              className="h-9 pl-10 pr-3 text-xs rounded-xl border-[#EAE4DC] dark:border-zinc-800 bg-white dark:bg-zinc-900 focus-visible:ring-[#D96B43]/30 focus-visible:border-[#D96B43]"
            />
          </div>

          <div className="inline-flex items-center rounded-xl border border-[#EAE4DC] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setLayoutMode("mosaic")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                layoutMode === "mosaic"
                  ? "bg-[#18181B] text-[#FAF8F5] dark:bg-white dark:text-zinc-900 shadow-2xs"
                  : "text-[#71717A] hover:text-[#18181B]"
              )}
              title="Disposition en Mosaïque"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mosaïque</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                layoutMode === "list"
                  ? "bg-[#18181B] text-[#FAF8F5] dark:bg-white dark:text-zinc-900 shadow-2xs"
                  : "text-[#71717A] hover:text-[#18181B]"
              )}
              title="Disposition en Liste"
            >
              <ListIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Liste</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          AFFICHAGE 1 : MODE MOSAÏQUE (STYLE ÉDITORIAL DAWJANG $5,000+)
         ===================================================================== */}
      {layoutMode === "mosaic" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-200">
          {filteredCourses.map((course) => {
            const detectedObjs = extractObjectivesFromCourseText(course.content || "");
            const cleanPreview = (course.content || "")
              .replace(/---\s*Diapositive\s*\d+\s*---/gi, "")
              .replace(/\s+/g, " ")
              .trim();

            return (
              <div
                key={course.id}
                onClick={(e) =>
                  launchShortcut(course, "/summaries/new", e, "objectives_verbatim")
                }
                className="group cursor-pointer rounded-2xl border border-[#EAE4DC] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 flex flex-col justify-between gap-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#D96B43]/60 hover:shadow-[0_18px_38px_-12px_rgba(24,24,27,0.10)]"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#FAF8F5] dark:bg-zinc-800 border border-[#EAE4DC] dark:border-zinc-700 text-[#18181B] dark:text-zinc-200 text-[11px] font-semibold">
                      {course.subject}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10.5px] text-[#71717A] flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {course.updatedAt}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCourse(course.id, e)}
                        className="p-1.5 rounded-lg text-[#71717A] hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Supprimer ce cours"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-serif font-semibold text-[#18181B] dark:text-zinc-100 group-hover:text-[#D96B43] transition-colors leading-snug line-clamp-2">
                      {course.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D96B43]/10 text-[#C85A32] dark:text-[#E8845C] border border-[#D96B43]/25 font-mono text-[10px] font-semibold">
                        <Target className="h-3 w-3" />
                        {detectedObjs.length} objectif{detectedObjs.length > 1 ? "s" : ""} détecté{detectedObjs.length > 1 ? "s" : ""}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FAF8F5] dark:bg-zinc-800 border border-[#EAE4DC] dark:border-zinc-700 text-[#71717A] font-mono text-[10px]">
                        {(course.wordCount || 0).toLocaleString("fr-FR")} mots
                      </span>
                    </div>
                  </div>

                  <p className="text-[12.5px] text-[#52525B] dark:text-zinc-400 line-clamp-2 leading-relaxed">
                    {cleanPreview}
                  </p>
                </div>

                {/* Pied de carte : 3 micro-actions haute précision */}
                <div className="pt-3.5 border-t border-[#EAE4DC]/70 dark:border-zinc-800 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={(e) =>
                      launchShortcut(course, "/summaries/new", e, "objectives_verbatim")
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#18181B] hover:bg-[#D96B43] text-[#FAF8F5] dark:bg-white dark:text-zinc-900 dark:hover:bg-[#D96B43] dark:hover:text-white py-2 px-2.5 text-[11.5px] font-semibold transition-all shadow-2xs"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span>Synthèse</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => launchShortcut(course, "/quiz", e)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#EAE4DC] dark:border-zinc-700 bg-[#FAF8F5] dark:bg-zinc-800 hover:border-[#D96B43] hover:text-[#D96B43] py-2 px-2.5 text-[11.5px] font-semibold text-[#18181B] dark:text-zinc-200 transition-all"
                  >
                    <CheckSquare className="h-3.5 w-3.5 shrink-0 text-[#D96B43]" />
                    <span>QCM</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => launchShortcut(course, "/smart-flashcards", e)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#EAE4DC] dark:border-zinc-700 bg-[#FAF8F5] dark:bg-zinc-800 hover:border-[#D96B43] hover:text-[#D96B43] py-2 px-2.5 text-[11.5px] font-semibold text-[#18181B] dark:text-zinc-200 transition-all"
                  >
                    <Layers className="h-3.5 w-3.5 shrink-0 text-[#D96B43]" />
                    <span>Cartes</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* =====================================================================
           AFFICHAGE 2 : MODE LISTE HAUTE DENSITÉ
          ===================================================================== */
        <div className="rounded-2xl border border-[#EAE4DC] dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-[#EAE4DC]/70 dark:divide-zinc-800 overflow-hidden shadow-2xs animate-in fade-in duration-200">
          {filteredCourses.map((course) => {
            const detectedObjs = extractObjectivesFromCourseText(course.content || "");
            return (
              <div
                key={course.id}
                onClick={(e) =>
                  launchShortcut(course, "/summaries/new", e, "objectives_verbatim")
                }
                className="group cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 hover:bg-[#FAF8F5] dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#FAF8F5] dark:bg-zinc-800 border border-[#EAE4DC] dark:border-zinc-700 text-[#18181B] dark:text-zinc-200 text-[11px] font-semibold shrink-0">
                    {course.subject}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-serif font-semibold text-[#18181B] dark:text-zinc-100 group-hover:text-[#D96B43] transition-colors truncate">
                      {course.title}
                    </h3>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-[#71717A]">
                      <span className="text-[#D96B43] font-semibold">
                        {detectedObjs.length} objectif(s)
                      </span>
                      <span>•</span>
                      <span>{(course.wordCount || 0).toLocaleString("fr-FR")} mots</span>
                      <span>•</span>
                      <span>Ajouté le {course.updatedAt}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) =>
                      launchShortcut(course, "/summaries/new", e, "objectives_verbatim")
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#18181B] hover:bg-[#D96B43] text-[#FAF8F5] dark:bg-white dark:text-zinc-900 px-3 py-1.5 text-[11.5px] font-semibold transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Synthèse</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => launchShortcut(course, "/quiz", e)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAE4DC] dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-[#D96B43] hover:text-[#D96B43] px-3 py-1.5 text-[11.5px] font-medium text-[#18181B] dark:text-zinc-200 transition-colors"
                  >
                    <CheckSquare className="h-3.5 w-3.5 text-[#D96B43]" />
                    <span>QCM</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => launchShortcut(course, "/smart-flashcards", e)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAE4DC] dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-[#D96B43] hover:text-[#D96B43] px-3 py-1.5 text-[11.5px] font-medium text-[#18181B] dark:text-zinc-200 transition-colors"
                  >
                    <Layers className="h-3.5 w-3.5 text-[#D96B43]" />
                    <span>Smart Cards</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCourse(course.id, e)}
                    className="p-1.5 rounded-lg text-[#71717A] hover:text-destructive hover:bg-destructive/10 transition-colors ml-1"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =====================================================================
          MODALE D'IMPORTATION : UPLOAD UNIQUE & UPLOAD DE MASSE (SANS TEXTAREA NI TRAME IA)
         ===================================================================== */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="sm:max-w-[660px] max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-normal">
              Importer des cours dans la Bibliothèque
            </DialogTitle>
            <DialogDescription>
              Choisissez entre un import unique ou un import de masse. Vous pouvez vérifier l'ordre des fichiers et retirer les doublons avant l'enregistrement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
            {/* Sélecteur Upload Unique vs Upload de Masse */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUploadMode("single")}
                className={cn(
                  "rounded-xl border p-3.5 text-left transition-all",
                  uploadMode === "single"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-foreground/30"
                )}
              >
                <span className="text-[13.5px] font-semibold text-foreground block">
                  Upload Unique
                </span>
                <span className="text-[11.5px] text-muted-foreground">
                  Déposer une seule leçon ciblée
                </span>
              </button>

              <button
                type="button"
                onClick={() => setUploadMode("bulk")}
                className={cn(
                  "rounded-xl border p-3.5 text-left transition-all",
                  uploadMode === "bulk"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-foreground/30"
                )}
              >
                <span className="text-[13.5px] font-semibold text-foreground block">
                  Upload de Masse
                </span>
                <span className="text-[11.5px] text-muted-foreground">
                  Sélectionner plusieurs cours en un seul trait
                </span>
              </button>
            </div>

            {/* Matière par défaut */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/35 px-3.5 py-2.5">
              <span className="text-[12.5px] font-medium text-foreground">
                Matière attribuée par défaut :
              </span>
              <Input
                value={defaultSubject}
                onChange={(e) => setDefaultSubject(e.target.value)}
                placeholder="Ex: Cardiologie, Infectiologie…"
                className="h-8 w-52 text-[12.5px]"
              />
            </div>

            {/* Zone de dépôt de fichiers */}
            <label className="group cursor-pointer flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border hover:border-primary bg-background/50 hover:bg-primary/[0.03] p-6 text-center transition-all">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary mb-2 group-hover:scale-105 transition-transform">
                <FileUp className="h-5 w-5" />
              </div>
              <span className="text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors">
                {uploadMode === "bulk"
                  ? "Cliquez pour sélectionner plusieurs fichiers de cours"
                  : "Cliquez pour sélectionner votre fichier de cours"}
              </span>
              <span className="text-[12px] text-muted-foreground mt-0.5">
                Formats pris en charge : PDF, Word, TXT, Markdown
              </span>
              <input
                type="file"
                multiple={uploadMode === "bulk"}
                accept=".pdf,.doc,.docx,.txt,.md"
                onChange={handleFilesSelected}
                className="hidden"
              />
            </label>

            {/* FILE D'ATTENTE ORDONNÉE DES FICHIERS PRÉ-UPLOADÉS (AVEC SUPPRESSION AVANT ENREGISTREMENT) */}
            {stagedFiles.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-foreground">
                    Leçons pré-chargées dans l'ordre d'arrivée ({stagedFiles.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setStagedFiles([])}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Tout vider
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {stagedFiles.map((file) => (
                    <div
                      key={file.tempId}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border p-3 transition-all",
                        file.isDuplicate
                          ? "border-amber-500/50 bg-amber-500/[0.06]"
                          : "border-border bg-card"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary font-mono text-[11px] font-bold text-primary">
                          #{file.orderIndex}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Input
                              value={file.title}
                              onChange={(e) =>
                                updateStagedTitle(file.tempId, e.target.value)
                              }
                              className="h-7 text-[13px] font-medium"
                            />
                            {file.isDuplicate && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-300 shrink-0">
                                <AlertTriangle className="h-3 w-3" /> Doublon
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                            <File className="h-3 w-3" />
                            <span className="truncate">{file.fileName}</span>
                            <span>• {file.fileSizeKb} Ko</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Input
                          value={file.subject}
                          onChange={(e) =>
                            updateStagedSubject(file.tempId, e.target.value)
                          }
                          className="h-7 w-32 text-[12px]"
                        />
                        <button
                          type="button"
                          onClick={() => removeStagedFile(file.tempId)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Retirer ce fichier avant l'enregistrement"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border/70">
            <Button variant="ghost" onClick={() => setIsUploadModalOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleConfirmSaveStagedCourses}
              disabled={stagedFiles.length === 0}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                Enregistrer {stagedFiles.length > 0 ? `(${stagedFiles.length})` : ""} dans la Bibliothèque
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
