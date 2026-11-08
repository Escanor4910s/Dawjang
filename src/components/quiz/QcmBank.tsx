// src/components/quiz/QcmBank.tsx
import React, { useState } from "react";
import { LayoutGrid, List as ListIcon, Play, Download, Trash2, Timer, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QcmBankItem {
  id: string;
  title: string;
  subject?: string;
  contentPreview?: string;
  questionCount?: number;
  wordCount?: number;
  createdAt?: string;
  professorStyleTag?: string;
  [key: string]: any;
}

export interface QcmBankProps {
  items: QcmBankItem[];
  onSelect?: (item: QcmBankItem) => void;
  onExamMode?: (item: QcmBankItem, e: React.MouseEvent) => void;
  onExportPdf?: (item: QcmBankItem, e: React.MouseEvent) => void;
  onDelete?: (item: QcmBankItem, e: React.MouseEvent) => void;
  initialMode?: "mosaic" | "list";
  className?: string;
}

export function QcmBank({
  items,
  onSelect,
  onExamMode,
  onExportPdf,
  onDelete,
  initialMode = "mosaic",
  className,
}: QcmBankProps) {
  const [viewMode, setViewMode] = useState<"mosaic" | "list">(initialMode);

  if (!items || items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 p-10 text-center space-y-3 bg-card/40">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <BookOpen className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          Aucun QCM disponible dans la banque
        </p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Vos questionnaires et sessions générés apparaîtront automatiquement ici.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Contrôles d'affichage & Compteur responsive */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="inline-flex items-center rounded-xl border border-border bg-secondary/70 p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode("mosaic")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              viewMode === "mosaic"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={viewMode === "mosaic"}
          >
            <LayoutGrid className="h-3.5 w-3.5 text-primary" />
            <span>Mosaïque</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              viewMode === "list"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={viewMode === "list"}
          >
            <ListIcon className="h-3.5 w-3.5 text-primary" />
            <span>Alignement</span>
          </button>
        </div>

        <span className="font-mono text-xs text-muted-foreground">
          {items.length} questionnaire{items.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Affichage Mosaïque ou Liste */}
      {viewMode === "mosaic" ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const countLabel =
              typeof item.questionCount === "number"
                ? `${item.questionCount} QCM`
                : typeof item.wordCount === "number"
                ? `${item.wordCount} mots`
                : null;

            return (
              <article
                key={item.id}
                onClick={() => onSelect?.(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(item);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Ouvrir ${item.title}`}
                className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.subject && <Badge variant="default">{item.subject}</Badge>}
                      {countLabel && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {countLabel}
                        </span>
                      )}
                      {item.professorStyleTag && (
                        <Badge variant="secondary" className="text-[10px] font-mono text-primary">
                          {item.professorStyleTag}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {onExportPdf && (
                        <button
                          type="button"
                          onClick={(e) => onExportPdf(item, e)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-background/90 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Exporter PDF"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                      )}
                      {onExamMode && (
                        <button
                          type="button"
                          onClick={(e) => onExamMode(item, e)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/35 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                          title="Mode examen"
                        >
                          <Timer className="h-3 w-3" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={(e) => onDelete(item, e)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-[15px] text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {item.title}
                  </h3>

                  {item.contentPreview && (
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {item.contentPreview}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono text-[11px]">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString("fr-FR") : ""}
                  </span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Play className="h-3 w-3 fill-current" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <ul className="rounded-xl border border-border/85 bg-card divide-y divide-border/60 overflow-hidden shadow-2xs">
          {items.map((item) => (
            <li
              key={item.id}
              onClick={() => onSelect?.(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(item);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Ouvrir ${item.title}`}
              className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer hover:bg-secondary/40 transition-colors gap-3 focus:outline-none focus:bg-secondary/60"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.subject && <Badge variant="default">{item.subject}</Badge>}
                  {item.questionCount !== undefined && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.questionCount} questions
                    </span>
                  )}
                  {item.createdAt && (
                    <span className="font-mono text-xs text-muted-foreground">
                      • {new Date(item.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate">
                  {item.title}
                </h3>
                {item.contentPreview && (
                  <p className="text-xs text-muted-foreground truncate max-w-xl">
                    {item.contentPreview}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                {onExportPdf && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => onExportPdf(item, e)}
                    className="h-8 text-xs gap-1"
                  >
                    <Download className="h-3.5 w-3.5 text-primary" />
                    <span className="hidden sm:inline">PDF</span>
                  </Button>
                )}
                {onExamMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => onExamMode(item, e)}
                    className="h-8 text-xs gap-1 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Timer className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Examen</span>
                  </Button>
                )}
                <Button size="sm" onClick={() => onSelect?.(item)} className="h-8 text-xs gap-1">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>S'entraîner</span>
                </Button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => onDelete(item, e)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
