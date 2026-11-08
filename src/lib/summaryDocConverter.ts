// src/lib/summaryDocConverter.ts

export type Verb = "definir" | "citer" | "decrire" | "interpreter" | "traiter" | "autre";

export interface ObjectiveBlock {
  n: number;
  verb: Verb;
  statement: string;
  lead: string;
  points: { label?: string | null; text: string }[];
  table?: { caption?: string | null; headers: string[]; rows: string[][] } | null;
  numbers?: { label: string; value: string }[] | null;
  exam_tip?: string | null;
  slides: number[];
  coverage: "full" | "partial" | "absent_from_course";
}

export interface SummaryDoc {
  schema_version: 2;
  mode: "objectives" | "harvard" | "flash";
  title: string;
  objectives: ObjectiveBlock[];
  qa_matrix?: { q: string; a: string; slide?: number | null }[] | null;
  comparison?: { caption?: string | null; headers: string[]; rows: string[][] } | null;
  vignette?: { presentation: string; workup: string; management: string } | null;
  flash?: { definition: string; key_points: string[]; thresholds: string[]; pitfalls: string[] } | null;
}

/**
 * Nettoie les glyphes corrompus et les artefacts de conversion PDF.
 */
export function cleanMedicalSourceText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/[\uE000-\uF8FF]/g, "• ") // Puces Wingdings (❑ ❖ ➢)
    .replace(/˃/g, ">")
    .replace(/˂/g, "<")
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Convertit un SummaryDoc en HTML médical haute définition pour Le Rédacteur et l'affichage web.
 */
export function summaryDocToHtml(doc: SummaryDoc): string {
  const parts: string[] = [];

  const VERB_STYLES: Record<string, { label: string; badge: string; border: string }> = {
    definir: {
      label: "DÉFINITION & SEUILS",
      badge: "bg-blue-600 text-white font-mono shadow-sm",
      border: "border-blue-500/30 dark:border-blue-700/50",
    },
    citer: {
      label: "ÉNUMÉRATION EXHAUSTIVE",
      badge: "bg-emerald-600 text-white font-mono shadow-sm",
      border: "border-emerald-500/30 dark:border-emerald-700/50",
    },
    decrire: {
      label: "PHYSIOPATHOLOGIE & CLINIQUES",
      badge: "bg-purple-600 text-white font-mono shadow-sm",
      border: "border-purple-500/30 dark:border-purple-700/50",
    },
    interpreter: {
      label: "DÉMARCHE DIAGNOSTIQUE & PARACLINIQUE",
      badge: "bg-amber-600 text-white font-mono shadow-sm",
      border: "border-amber-500/30 dark:border-amber-700/50",
    },
    traiter: {
      label: "PRISE EN CHARGE & THÉRAPEUTIQUE",
      badge: "bg-rose-600 text-white font-mono shadow-sm",
      border: "border-rose-500/30 dark:border-rose-700/50",
    },
    autre: {
      label: "OBJECTIF PÉDAGOGIQUE",
      badge: "bg-slate-700 text-white font-mono shadow-sm",
      border: "border-slate-300 dark:border-slate-700",
    },
  };

  // 1. Synthèse par Objectifs
  if (doc.objectives && doc.objectives.length > 0) {
    doc.objectives.forEach((obj: ObjectiveBlock) => {
      const vStyle = VERB_STYLES[obj.verb] || VERB_STYLES.autre;
      const isDef = obj.verb === "definir";

      parts.push(`
        <div class="mb-6 p-4 rounded-xl border ${vStyle.border} bg-card/60 shadow-sm space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${vStyle.badge}">
                ${vStyle.label}
              </span>
              <h3 class="text-base font-serif font-bold text-foreground">
                Objectif ${obj.n} : ${escapeHtml(obj.statement)}
              </h3>
            </div>
            ${
              obj.slides && obj.slides.length > 0
                ? `<span class="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border/60">Diapo ${obj.slides.join(", ")}</span>`
                : ""
            }
          </div>
      `);

      if (obj.lead?.trim()) {
        if (isDef) {
          parts.push(`
            <div class="p-3 rounded-lg border-l-4 border-blue-600 bg-blue-50/70 dark:bg-blue-950/20 text-sm font-semibold text-foreground leading-relaxed">
              ${escapeHtml(obj.lead)}
            </div>
          `);
        } else {
          parts.push(`
            <p class="text-sm font-medium text-foreground/90 leading-relaxed">
              ${escapeHtml(obj.lead)}
            </p>
          `);
        }
      }

      if (obj.numbers && obj.numbers.length > 0) {
        parts.push(`
          <div class="flex flex-wrap gap-2 my-2">
            ${obj.numbers
              .map(
                (n) => `
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-secondary/80 text-foreground border border-border">
                <span class="text-muted-foreground font-sans">${escapeHtml(n.label)}:</span>
                <span class="text-primary font-black">${escapeHtml(n.value)}</span>
              </span>
            `
              )
              .join("")}
          </div>
        `);
      }

      if (obj.points && obj.points.length > 0) {
        parts.push(`
          <ul class="space-y-1.5 pl-4 list-disc text-sm text-foreground/85">
            ${obj.points
              .map(
                (p) => `
              <li class="leading-relaxed">
                ${p.label ? `<strong class="text-foreground">${escapeHtml(p.label)} :</strong> ` : ""}
                <span>${escapeHtml(p.text)}</span>
              </li>
            `
              )
              .join("")}
          </ul>
        `);
      }

      if (obj.table && obj.table.rows && obj.table.rows.length > 0) {
        parts.push(`
          <div class="overflow-x-auto my-3 rounded-lg border border-border shadow-xs">
            <table class="w-full text-xs text-left border-collapse">
              ${
                obj.table.caption
                  ? `<caption class="p-2 text-xs font-bold text-muted-foreground text-left">${escapeHtml(
                      obj.table.caption
                    )}</caption>`
                  : ""
              }
              <thead class="bg-muted text-muted-foreground font-bold">
                <tr>
                  ${obj.table.headers
                    .map(
                      (h) =>
                        `<th class="p-2.5 border-b border-border">${escapeHtml(
                          h
                        )}</th>`
                    )
                    .join("")}
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                ${obj.table.rows
                  .map(
                    (r, rIdx) => `
                  <tr class="${rIdx % 2 === 0 ? "bg-card" : "bg-muted/30"} hover:bg-muted/50 transition-colors">
                    ${r
                      .map(
                        (cell) => `<td class="p-2.5 align-top">${escapeHtml(cell)}</td>`
                      )
                      .join("")}
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `);
      }

      if (obj.exam_tip) {
        parts.push(`
          <div class="mt-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs space-y-1">
            <div class="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-amber-700 dark:text-amber-400">
              <span>⚠️</span>
              <span>PIÈGE CONCOURS / FOCUS QCM</span>
            </div>
            <p class="leading-relaxed font-medium">${escapeHtml(obj.exam_tip)}</p>
          </div>
        `);
      }

      parts.push(`</div>`);
    });
  }

  // 2. Matrice Bicolonne Active-Recall (Harvard)
  if (doc.qa_matrix && doc.qa_matrix.length > 0) {
    parts.push(`
      <div class="mt-8 mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold uppercase tracking-wider text-primary">
            Matrice Active-Recall (Harvard Docimologique)
          </h3>
          <span class="text-[11px] font-mono text-muted-foreground">
            AMORCES QCM ↔ PREUVES DU COURS
          </span>
        </div>
        <div class="space-y-3">
          ${doc.qa_matrix
            .map(
              (item) => `
            <div class="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 rounded-lg bg-card border border-border/60">
              <div class="md:col-span-5 font-semibold text-xs text-primary leading-relaxed">
                ${escapeHtml(item.q)}
                ${
                  item.slide
                    ? `<span class="block mt-1 text-[10px] font-mono text-muted-foreground">[Diapo ${item.slide}]</span>`
                    : ""
                }
              </div>
              <div class="harvard-recall-answer md:col-span-7 text-xs text-foreground/90 border-t md:border-t-0 md:border-l border-border/60 pt-2 md:pt-0 md:pl-3 leading-relaxed">
                ${escapeHtml(item.a)}
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `);
  }

  // 3. Tableau Différentiel (Comparison / Illness Scripts)
  if (doc.comparison && doc.comparison.rows && doc.comparison.rows.length > 0) {
    parts.push(`
      <div class="mt-6 mb-6 p-4 rounded-xl border border-border bg-card space-y-3">
        <h3 class="text-sm font-bold uppercase tracking-wider text-foreground">
          ${escapeHtml(doc.comparison.caption || "Tableau Différentiel Pathologique")}
        </h3>
        <div class="overflow-x-auto rounded-lg border border-border">
          <table class="w-full text-xs text-left border-collapse">
            <thead class="bg-muted text-muted-foreground font-bold">
              <tr>
                ${doc.comparison.headers
                  .map(
                    (h) =>
                      `<th class="p-2 border-b border-border">${escapeHtml(
                        h
                      )}</th>`
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              ${doc.comparison.rows
                .map(
                  (r) => `
                <tr class="hover:bg-muted/40 transition-colors">
                  ${r
                    .map(
                      (cell) => `<td class="p-2 align-top">${escapeHtml(cell)}</td>`
                    )
                    .join("")}
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `);
  }

  // 4. Vignette Clinique (CBCL)
  if (doc.vignette && doc.vignette.presentation) {
    parts.push(`
      <div class="mt-6 mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
        <h3 class="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          Vignette Clinique CBCL
        </h3>
        <p class="text-xs text-foreground/90 leading-relaxed">
          <strong>Présentation :</strong> ${escapeHtml(doc.vignette.presentation)}
        </p>
        <p class="text-xs text-foreground/90 leading-relaxed">
          <strong>Bilan :</strong> ${escapeHtml(doc.vignette.workup)}
        </p>
        <p class="text-xs text-foreground/90 leading-relaxed">
          <strong>Prise en charge :</strong> ${escapeHtml(doc.vignette.management)}
        </p>
      </div>
    `);
  }

  // 5. Fiche Flash
  if (doc.flash) {
    parts.push(`
      <div class="mt-6 mb-6 p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-3">
        <h3 class="text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
          Fiche Flash Express
        </h3>
        <p class="text-xs font-semibold text-foreground">
          ${escapeHtml(doc.flash.definition)}
        </p>
        <div class="space-y-1 pl-4 list-disc text-xs text-foreground/85">
          ${doc.flash.key_points
            .map((kp) => `<div>• ${escapeHtml(kp)}</div>`)
            .join("")}
        </div>
      </div>
    `);
  }

  return parts.join("\n").trim();
}

/**
 * Convertit un SummaryDoc en texte hiérarchique Markdown / Amboss pour stockage dans la base
 * et compatibilité avec SummaryView.tsx (chapitres, sections, fiches, mindmap).
 */
export function summaryDocToStructuredMarkdown(doc: SummaryDoc): string {
  const lines: string[] = [];

  if (doc.objectives && doc.objectives.length > 0) {
    doc.objectives.forEach((obj: ObjectiveBlock) => {
      lines.push(`## Objectif ${obj.n} : ${obj.statement}`);
      if (obj.lead?.trim()) {
        lines.push(obj.lead);
      }
      if (obj.numbers && obj.numbers.length > 0) {
        obj.numbers.forEach((n) => {
          lines.push(`- **${n.label}** : ${n.value}`);
        });
      }
      if (obj.points && obj.points.length > 0) {
        obj.points.forEach((p) => {
          const prefix = p.label ? `- **${p.label}** : ` : "- ";
          lines.push(`${prefix}${p.text}`);
        });
      }
      if (obj.table && obj.table.rows && obj.table.rows.length > 0) {
        if (obj.table.caption) {
          lines.push(`\n### ${obj.table.caption}`);
        } else {
          lines.push("");
        }
        lines.push(`| ${obj.table.headers.join(" | ")} |`);
        lines.push(`| ${obj.table.headers.map(() => "---").join(" | ")} |`);
        obj.table.rows.forEach((r) => {
          lines.push(`| ${r.join(" | ")} |`);
        });
        lines.push("");
      }
      if (obj.exam_tip) {
        lines.push(`> ⚠️ **Piège d'examen** : ${obj.exam_tip}`);
      }
      lines.push("");
    });
  }

  if (doc.qa_matrix && doc.qa_matrix.length > 0) {
    lines.push(`## 1. Matrice Active Recall (Questions-Réponses)`);
    doc.qa_matrix.forEach((q) => {
      lines.push(`- **Question** : ${q.q}`);
      lines.push(`  - → **Réponse** : ${q.a}`);
    });
    lines.push("");
  }

  if (doc.comparison && doc.comparison.rows && doc.comparison.rows.length > 0) {
    lines.push(`## 2. ${doc.comparison.caption || "Scripts Cliniques Différentiels"}`);
    lines.push("");
    lines.push(`| ${doc.comparison.headers.join(" | ")} |`);
    lines.push(`| ${doc.comparison.headers.map(() => "---").join(" | ")} |`);
    doc.comparison.rows.forEach((r) => {
      lines.push(`| ${r.join(" | ")} |`);
    });
    lines.push("");
  }

  if (doc.vignette && doc.vignette.presentation) {
    lines.push(`## 3. Vignette Clinique d'Application`);
    lines.push(`- **Présentation** : ${doc.vignette.presentation}`);
    lines.push(`- **Démarche diagnostique** : ${doc.vignette.workup}`);
    lines.push(`- **Prise en charge** : ${doc.vignette.management}`);
    lines.push("");
  }

  if (doc.flash) {
    lines.push(`## 4. Visas de Révision & Points Clés`);
    lines.push(doc.flash.definition);
    doc.flash.key_points.forEach((kp) => lines.push(`- ✓ ${kp}`));
    lines.push("");
  }

  return lines.join("\n").trim();
}

function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
