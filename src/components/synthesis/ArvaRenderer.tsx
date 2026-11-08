// src/components/synthesis/ArvaRenderer.tsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Brain,
  Stethoscope,
  ClipboardList,
  BookmarkCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export interface ArvaRendererProps {
  markdown: string;
  className?: string;
}

/**
 * Rendu Haute Fidélité pour la Doctrine ARVA (DawJang — Studio Académique) :
 * 1. Matrice Active Recall
 * 2. Scripts Cliniques Différentiels (Harvard Illness Scripts)
 * 3. Vignette Clinique d'Application
 * 4. Visas de Révision & Annotations
 */
export const ArvaRenderer: React.FC<ArvaRendererProps> = ({
  markdown,
  className = "",
}) => {
  const hasRecall = /matrice.*active\s*recall|active\s*recall/i.test(markdown);
  const hasScripts = /scripts.*différentiels|illness\s*scripts/i.test(markdown);
  const hasVignette = /vignette.*clinique|cas\s*clinique/i.test(markdown);
  const hasVisas = /visas.*révision|annotations/i.test(markdown);

  const detectedCount = [hasRecall, hasScripts, hasVignette, hasVisas].filter(Boolean).length;

  const components = {
    h2: ({ node, ...props }: any) => {
      const text = String(props.children || "");
      const lower = text.toLowerCase();

      let borderClass =
        "border-l-[3.5px] pl-4 py-2.5 my-6 text-[18px] sm:text-[20px] font-serif font-semibold rounded-r-xl transition-all tracking-tight ";
      let icon = null;

      if (lower.includes("matrice") || lower.includes("active recall") || lower.includes("questions")) {
        borderClass +=
          "border-[#D96B43] bg-[#D96B43]/[0.06] text-[#18181B] dark:text-[#F4F4F5]";
        icon = <Brain className="w-4 h-4 inline mr-2.5 text-[#D96B43]" />;
      } else if (
        lower.includes("scripts") ||
        lower.includes("différentiels") ||
        lower.includes("illness") ||
        lower.includes("differentiels")
      ) {
        borderClass +=
          "border-[#2E6F4E] bg-[#2E6F4E]/[0.06] text-[#18181B] dark:text-[#F4F4F5]";
        icon = <Stethoscope className="w-4 h-4 inline mr-2.5 text-[#2E6F4E]" />;
      } else if (
        lower.includes("vignette") ||
        lower.includes("cas clinique") ||
        lower.includes("application")
      ) {
        borderClass +=
          "border-[#C87D28] bg-[#C87D28]/[0.07] text-[#18181B] dark:text-[#F4F4F5]";
        icon = <ClipboardList className="w-4 h-4 inline mr-2.5 text-[#C87D28]" />;
      } else if (
        lower.includes("visas") ||
        lower.includes("révision") ||
        lower.includes("annotations") ||
        lower.includes("revision")
      ) {
        borderClass +=
          "border-[#18181B] dark:border-[#E4E4E7] bg-[#F5F2EB] dark:bg-zinc-800/50 text-[#18181B] dark:text-[#F4F4F5]";
        icon = <BookmarkCheck className="w-4 h-4 inline mr-2.5 text-[#D96B43]" />;
      } else {
        borderClass +=
          "border-[#D96B43] bg-[#FAF8F5] dark:bg-zinc-800/40 text-[#18181B] dark:text-[#F4F4F5]";
      }

      return (
        <h2 className={`${borderClass} ${props.className || ""}`}>
          {icon}
          {props.children}
        </h2>
      );
    },
    h3: ({ node, ...props }: any) => (
      <h3
        className="text-[15.5px] font-bold text-[#18181B] dark:text-zinc-100 mt-5 mb-2.5 border-b border-[#EAE4DC] dark:border-zinc-800 pb-1.5 flex items-center gap-2"
        {...props}
      />
    ),
    p: ({ node, ...props }: any) => (
      <p
        className="mb-3.5 leading-[1.75] text-[#27272A] dark:text-zinc-200 text-[14.5px] sm:text-[15px]"
        {...props}
      />
    ),
    ul: ({ node, ...props }: any) => (
      <ul className="list-none ml-1 mb-4 space-y-2 text-[14.5px] sm:text-[15px]" {...props} />
    ),
    li: ({ node, ...props }: any) => {
      const content = String(props.children || "");
      let bulletIcon = (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#D96B43] mr-2.5 mt-2 shrink-0" />
      );

      if (content.includes("⚠️") || content.includes("Piège")) {
        bulletIcon = (
          <AlertTriangle className="w-4 h-4 text-[#C87D28] inline mr-2.5 mt-1 shrink-0" />
        );
      } else if (content.includes("✓") || content.includes("Règle")) {
        bulletIcon = (
          <CheckCircle2 className="w-4 h-4 text-[#2E6F4E] inline mr-2.5 mt-1 shrink-0" />
        );
      } else if (content.includes("→") || content.includes("➔")) {
        bulletIcon = (
          <ArrowRight className="w-3.5 h-3.5 text-[#D96B43] inline mr-2.5 mt-1 shrink-0" />
        );
      }

      return (
        <li className="flex items-start text-[#27272A] dark:text-zinc-200 leading-[1.7]" {...props}>
          {bulletIcon}
          <div className="flex-1 min-w-0">{props.children}</div>
        </li>
      );
    },
    table: ({ node, ...props }: any) => (
      <div className="overflow-x-auto my-5 border border-[#EAE4DC] dark:border-zinc-800 rounded-xl shadow-2xs bg-white dark:bg-zinc-900">
        <table className="w-full text-[13.5px] text-left border-collapse" {...props} />
      </div>
    ),
    thead: ({ node, ...props }: any) => (
      <thead className="bg-[#F5F2EB] dark:bg-zinc-800/80 border-b border-[#EAE4DC] dark:border-zinc-700" {...props} />
    ),
    th: ({ node, ...props }: any) => (
      <th
        className="px-4 py-3 font-bold text-[#18181B] dark:text-zinc-100 border-b border-[#EAE4DC] dark:border-zinc-700 text-[11.5px] uppercase tracking-wider text-left"
        {...props}
      />
    ),
    tr: ({ node, ...props }: any) => (
      <tr
        className="even:bg-[#FAF8F5]/70 dark:even:bg-zinc-800/30 hover:bg-[#F5F2EB]/60 dark:hover:bg-zinc-800/60 transition-colors border-b border-[#EAE4DC]/70 dark:border-zinc-800 last:border-b-0"
        {...props}
      />
    ),
    td: ({ node, ...props }: any) => (
      <td
        className="px-4 py-3 border-r border-[#EAE4DC]/60 dark:border-zinc-800 last:border-r-0 text-[#27272A] dark:text-zinc-200 align-top leading-relaxed"
        {...props}
      />
    ),
    blockquote: ({ node, ...props }: any) => (
      <blockquote
        className="border-l-[3.5px] border-[#C87D28] bg-[#C87D28]/[0.07] dark:bg-amber-950/20 px-4 py-3 my-4 rounded-r-xl text-[13.5px] text-[#18181B] dark:text-zinc-200"
        {...props}
      />
    ),
  };

  return (
    <div className={`arva-prose-container space-y-4 ${className}`}>
      {detectedCount === 4 && markdown.trim().length > 150 && (
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#2E6F4E]/25 bg-[#2E6F4E]/[0.07] text-[#2E6F4E] dark:text-emerald-300 text-[11.5px] font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Architecture ARVA — 4 Piliers Docimologiques Actifs</span>
        </div>
      )}

      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
};
