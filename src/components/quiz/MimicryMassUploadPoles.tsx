import React, { useRef } from "react";
import {
  BookOpen,
  Sparkles,
  PenTool,
  Play,
  FileText,
  GraduationCap,
  X,
  CheckCircle2,
  Loader2,
  FolderPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export interface UploadedFileTag {
  id: string;
  name: string;
  wordCount: number;
  extractedText: string;
}

// ============================================================================
// 1. EN-TÊTE HAUTE PRÉCISION SANS AUCUNE SUPERPOSITION NI TRONCATURE
// ============================================================================

export const CollisionFreeQcmHeader: React.FC<{
  activeTab: string;
  onSelectTab: (tab: any) => void;
  qcmCount: number;
  hasActiveSession: boolean;
}> = ({ activeTab, onSelectTab, qcmCount, hasActiveSession }) => {
  const tabs = [
    { id: "mes_qcm", label: "Mes QCM", count: qcmCount, icon: BookOpen },
    { id: "generateur_ia", label: "Générateur IA", icon: Sparkles },
    { id: "constructeur_manuel", label: "Manuel", icon: PenTool },
    ...(hasActiveSession
      ? [{ id: "session_active", label: "Examen", icon: Play, isLive: true }]
      : []),
  ];

  return (
    <header className="w-full space-y-2 pb-5 border-b border-border/80">
      {/* Ligne 1 : Sous-titre sur toute la largeur (Ne coupe jamais "Jumelage & Association") */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
        <span>
          Studio docimologique • Classique, Censure, Groupage, Jumelage & Association
        </span>
      </div>

      {/* Ligne 2 : Titre à gauche + Barre d'onglets à droite avec gap-6 anti-collision */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pt-0.5">
        <h1 className="font-serif text-2xl sm:text-[28px] font-bold tracking-tight text-foreground leading-tight shrink-0">
          Constructeur & Banque de QCM
        </h1>

        <nav
          aria-label="Navigation QCM"
          className="inline-flex flex-nowrap items-center gap-1 p-1.5 rounded-2xl bg-muted/90 border border-border/80 w-fit max-w-full overflow-x-auto shrink-0"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`relative px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all flex items-center gap-2 ${
                  isActive
                    ? "bg-card text-foreground shadow-sm border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? "text-primary" : ""
                  }`}
                />
                <span>{tab.label}</span>
                {typeof tab.count === "number" && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold leading-none ${
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "bg-background/80 text-muted-foreground"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.isLive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

// ============================================================================
// 2. DOUBLE STUDIO D'UPLOAD DE MASSE (PÔLE A COURS & PÔLE B ANNALES) AVEC TAGS [✕]
// ============================================================================

export const DualMassUploadMimicryStudio: React.FC<{
  poleACourses: UploadedFileTag[];
  onAddPoleAFiles: (files: FileList) => Promise<void>;
  onRemovePoleAFile: (id: string) => void;
  poleBAnnales: UploadedFileTag[];
  onAddPoleBFiles: (files: FileList) => Promise<void>;
  onRemovePoleBFile: (id: string) => void;
  isReadingFiles: boolean;
  detectedDnaSummary?: string | null;
  inferredDifficulty?: string | null;
  enableCustomTypes: boolean;
  onToggleCustomTypes: (val: boolean) => void;
}> = ({
  poleACourses,
  onAddPoleAFiles,
  onRemovePoleAFile,
  poleBAnnales,
  onAddPoleBFiles,
  onRemovePoleBFile,
  isReadingFiles,
  detectedDnaSummary,
  inferredDifficulty,
  enableCustomTypes,
  onToggleCustomTypes,
}) => {
  const poleAInputRef = useRef<HTMLInputElement>(null);
  const poleBInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ===================================================================
            PÔLE A : UPLOAD DE MASSE DES COURS + TAGS SUPPRIMABLES (✕)
        =================================================================== */}
        <div className="p-5 rounded-3xl bg-background border border-border space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-primary/15 text-primary text-xs font-extrabold flex items-center justify-center">
                  A
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Pôle A — Supports de Cours (Upload de masse)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Sélectionnez un ou plusieurs cours simultanément (PDF, DOCX, TXT).
                  </p>
                </div>
              </div>
              {poleACourses.length > 0 && (
                <Badge variant="secondary" className="text-[10px] font-bold">
                  {poleACourses.length} cours
                </Badge>
              )}
            </div>

            {/* Cadre d'upload de masse Pôle A (identique au Pôle B) */}
            <div
              onClick={() => poleAInputRef.current?.click()}
              className="group rounded-2xl border-2 border-dashed border-border hover:border-primary/60 bg-card hover:bg-primary/5 p-5 text-center cursor-pointer transition-all space-y-2"
            >
              <input
                ref={poleAInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onAddPoleAFiles(e.target.files);
                    e.target.value = "";
                  }
                }}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                {isReadingFiles ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <FolderPlus className="w-5 h-5" />
                )}
              </div>
              <div className="text-xs font-bold text-foreground">
                Cliquez pour uploader plusieurs cours en même temps
              </div>
              <p className="text-[11px] text-muted-foreground">
                Vous pouvez ajouter autant de leçons que souhaité en une seule sélection.
              </p>
            </div>
          </div>

          {/* LISTE DES TAGS DE COURS AVEC CROIX (✕) JUSTE EN BAS DU PÔLE A */}
          {poleACourses.length > 0 && (
            <div className="pt-3 border-t border-border/70 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Leçons sélectionnées ({poleACourses.length}) :
              </div>
              <div className="flex flex-wrap gap-2">
                {poleACourses.map((course) => (
                  <span
                    key={course.id}
                    className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold text-foreground shadow-sm group hover:border-primary/40 transition-all"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate max-w-[190px]">{course.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePoleAFile(course.id);
                      }}
                      className="w-5 h-5 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
                      title={`Retirer ${course.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ===================================================================
            PÔLE B : UPLOAD DE MASSE DES ANNALES + TAGS SUPPRIMABLES (✕)
        =================================================================== */}
        <div className="p-5 rounded-3xl bg-primary/5 border border-primary/25 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold flex items-center justify-center">
                  B
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Pôle B — Annales & Examens (Upload de masse)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    L’IA clone les types de QCM, la difficulté et la syntaxe des profs.
                  </p>
                </div>
              </div>
              {poleBAnnales.length > 0 && (
                <Badge variant="default" className="text-[10px] font-bold">
                  {poleBAnnales.length} annale(s)
                </Badge>
              )}
            </div>

            {/* Cadre d'upload de masse Pôle B */}
            <div
              onClick={() => poleBInputRef.current?.click()}
              className="group rounded-2xl border-2 border-dashed border-primary/35 hover:border-primary bg-card hover:bg-primary/5 p-5 text-center cursor-pointer transition-all space-y-2"
            >
              <input
                ref={poleBInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onAddPoleBFiles(e.target.files);
                    e.target.value = "";
                  }
                }}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                {isReadingFiles ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <GraduationCap className="w-5 h-5" />
                )}
              </div>
              <div className="text-xs font-bold text-foreground">
                Cliquez pour uploader plusieurs sujets d’examens en masse
              </div>
              <p className="text-[11px] text-muted-foreground">
                Détection automatique : Élection, Censure, Groupage, Jumelage, Association.
              </p>
            </div>
          </div>

          {/* LISTE DES TAGS D'ANNALES AVEC CROIX (✕) JUSTE EN BAS DU PÔLE B */}
          {poleBAnnales.length > 0 && (
            <div className="pt-3 border-t border-primary/20 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Examens modèles chargés ({poleBAnnales.length}) :
              </div>
              <div className="flex flex-wrap gap-2">
                {poleBAnnales.map((exam) => (
                  <span
                    key={exam.id}
                    className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl bg-card border border-primary/30 text-xs font-semibold text-foreground shadow-sm"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate max-w-[190px]">{exam.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePoleBFile(exam.id);
                      }}
                      className="w-5 h-5 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
                      title={`Retirer ${exam.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BANDEAU DE DIAGNOSTIC D'ADN DOCIMOLOGIQUE & OPTION DE CIBLAGE DE TYPE */}
      <div className="p-4 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span>
              {detectedDnaSummary
                ? `ADN détecté : ${detectedDnaSummary}`
                : "Uploadez vos cours (Pôle A) et vos annales (Pôle B) pour analyser automatiquement les types et la difficulté."}
            </span>
          </div>
          {inferredDifficulty && (
            <p className="text-[11px] text-muted-foreground pl-6">
              Niveau de difficulté verrouillé sur l’examen :{" "}
              <strong className="text-foreground">{inferredDifficulty}</strong>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 pl-6 sm:pl-0">
          <span className="text-xs font-semibold text-foreground">
            Choisir manuellement 1 ou 2 types de QCM (Optionnel)
          </span>
          <Switch
            checked={enableCustomTypes}
            onCheckedChange={onToggleCustomTypes}
          />
        </div>
      </div>
    </div>
  );
};

export default DualMassUploadMimicryStudio;
