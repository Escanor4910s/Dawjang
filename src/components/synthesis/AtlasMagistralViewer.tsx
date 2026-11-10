/**
 * ============================================================================
 * src/components/synthesis/AtlasMagistralViewer.tsx
 * COMPOSANT REACT DU « MODE ATLAS MAGISTRAL » (AVEC BOUTON TÉLÉCHARGER EN PDF)
 * ============================================================================
 */

import React, { useState, useMemo } from "react";
import type { AtlasMagistralSummary } from "@/lib/atlasMagistralEngine";
import { exportAtlasMagistralToPDF } from "@/utils/atlasMagistralPdfExport";
import { HEMOGLOBINOPATHIES_M1_ATLAS_SUMMARY } from "@/data/goldStandardExamples";

export const ATLAS_MAGISTRAL_VIEWER_CSS = `
  .font-serif-editorial {
    font-family: 'Newsreader', Georgia, serif;
    letter-spacing: -0.016em;
  }
  .font-mono-metric {
    font-family: 'JetBrains Mono', monospace;
    font-variant-numeric: tabular-nums;
  }
  .craft-surface {
    background-color: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    box-shadow: 0 1px 2px rgba(24, 22, 19, 0.035),
                0 6px 20px -4px rgba(24, 22, 19, 0.045),
                inset 0 1px 0 0 rgba(255, 255, 255, 0.85);
  }
  @keyframes pulseHighlight {
    0% { box-shadow: 0 0 0 0 rgba(201, 100, 66, 0.45); border-color: hsl(var(--primary)); }
    70% { box-shadow: 0 0 0 8px rgba(201, 100, 66, 0); border-color: hsl(var(--primary)); }
    100% { box-shadow: 0 1px 2px rgba(24, 22, 19, 0.035); }
  }
  .highlight-target {
    animation: pulseHighlight 1.6s ease-out;
  }
  .course-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 12.5px;
  }
  .course-table th {
    background-color: hsl(var(--secondary) / 0.75);
    color: hsl(var(--foreground));
    font-weight: 600;
    text-align: left;
    padding: 9px 12px;
    border-bottom: 1px solid hsl(var(--border));
  }
  .course-table td {
    padding: 9px 12px;
    border-bottom: 1px solid hsl(var(--border) / 0.6);
    color: hsl(var(--foreground) / 0.9);
    vertical-align: top;
  }
  .course-table tr:last-child td {
    border-bottom: none;
  }
`;

export interface AtlasMagistralViewerProps {
  course?: AtlasMagistralSummary;
  onBack?: () => void;
  backButtonLabel?: string;
}

export const AtlasMagistralViewer: React.FC<AtlasMagistralViewerProps> = ({
  course = HEMOGLOBINOPATHIES_M1_ATLAS_SUMMARY,
  onBack,
  backButtonLabel = "Retour",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedChapterId, setHighlightedChapterId] = useState<string | null>(null);

  const filteredChapters = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return course.chapters;

    return course.chapters
      .map((ch) => {
        const matchingBlocks = ch.blocks.filter(
          (b) =>
            ch.title.toLowerCase().includes(q) ||
            b.heading.toLowerCase().includes(q) ||
            b.body.toLowerCase().includes(q) ||
            b.slideBadge.toLowerCase().includes(q)
        );
        return { ...ch, blocks: matchingBlocks };
      })
      .filter((ch) => ch.blocks.length > 0);
  }, [course.chapters, searchQuery]);

  const jumpToChapter = (chapterId: string) => {
    const target = document.getElementById(`course-${chapterId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlightedChapterId(chapterId);
      setTimeout(() => setHighlightedChapterId(null), 1600);
    }
  };

  return (
    <div className="space-y-5">
      <style>{ATLAS_MAGISTRAL_VIEWER_CSS}</style>

      {/* Barre supérieure sticky : Titre + Recherche + Télécharger en PDF + Retour */}
      <div className="craft-surface rounded-2xl p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 sticky top-4 z-10 backdrop-blur-xl bg-card/95">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-semibold text-foreground truncate">
              {course.title}
            </h2>
            <p className="text-[11px] text-muted-foreground truncate">
              {course.tag} • {course.author}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-1 sm:flex-initial justify-end">
          <div className="relative w-full sm:w-64">
            <svg className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans le cours..."
              className="w-full h-8 pl-8 pr-3 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
            />
          </div>

          <button
            type="button"
            onClick={() => exportAtlasMagistralToPDF(course)}
            className="h-8 px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-95 transition-opacity flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Télécharger en PDF</span>
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="h-8 px-3.5 rounded-xl bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 shrink-0"
            >
              <span>← {backButtonLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Grille 12 colonnes : Sommaire latéral (3 col) + Chapitres Romains (9 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-3 craft-surface rounded-2xl p-4 lg:sticky lg:top-24 space-y-3">
          <div className="text-[11px] font-mono-metric uppercase tracking-wider text-muted-foreground font-semibold px-1">
            Plan du cours magistral
          </div>
          <nav className="space-y-1 text-xs">
            {course.chapters.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => jumpToChapter(ch.id)}
                className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-secondary/80 transition-colors flex items-start gap-2.5 group"
              >
                <span className="font-mono-metric text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                  {ch.num}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground leading-snug line-clamp-2">
                    {ch.title}
                  </div>
                  <div className="font-mono-metric text-[10px] text-muted-foreground mt-0.5">
                    {ch.slides}
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </aside>

        <div className="lg:col-span-9 space-y-5">
          {filteredChapters.map((ch) => (
            <article
              key={ch.id}
              id={`course-${ch.id}`}
              className={`craft-surface rounded-2xl p-6 sm:p-7 space-y-5 scroll-mt-28 ${
                highlightedChapterId === ch.id ? "highlight-target" : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-border/80">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-foreground text-background font-mono-metric text-xs font-semibold flex items-center justify-center shrink-0">
                    {ch.num}
                  </span>
                  <div>
                    <h3 className="text-base sm:text-[17px] font-semibold text-foreground">
                      {ch.title}
                    </h3>
                    <p className="font-mono-metric text-[11px] text-muted-foreground">
                      {ch.slides} • {course.author}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {ch.blocks.map((blk, bIdx) => (
                  <React.Fragment key={bIdx}>
                    {bIdx > 0 && <div className="border-t border-border/60" />}
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-metric text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/25">
                          {blk.slideBadge}
                        </span>
                        <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                          {blk.heading}
                        </h4>
                      </div>
                      <div
                        className="pl-0 sm:pl-1"
                        dangerouslySetInnerHTML={{ __html: blk.body }}
                      />
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AtlasMagistralViewer;
