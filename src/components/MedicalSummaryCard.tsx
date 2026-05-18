import { FC } from "react";
import { Heart, Stethoscope, Brain, Pill, AlertTriangle, BookOpen, CheckCircle, Microscope, Activity, FileText, ShieldCheck, Lightbulb, Target, ClipboardList, Syringe, TestTube } from "lucide-react";
import { cn } from "@/lib/utils";

interface MedicalSummaryCardProps {
  content: string;
  title: string;
  summaryType: "complete" | "structured" | "concise";
}

interface ParsedSection {
  title: string;
  content: string[];
  isMainSection: boolean;
}

// Icon and color mapping for different section types
const sectionStyles: Record<string, { 
  icon: FC<{ className?: string }>;
  headerBg: string;
  headerText: string;
  contentBg: string;
  accentColor: string;
  borderColor: string;
}> = {
  "définition": { 
    icon: BookOpen, 
    headerBg: "bg-blue-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-blue-700 dark:text-blue-300",
    borderColor: "border-blue-200 dark:border-blue-800"
  },
  "introduction": { 
    icon: FileText, 
    headerBg: "bg-slate-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-slate-700 dark:text-slate-300",
    borderColor: "border-slate-200 dark:border-slate-800"
  },
  "physiopathologie": { 
    icon: Brain, 
    headerBg: "bg-purple-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-purple-700 dark:text-purple-300",
    borderColor: "border-purple-200 dark:border-purple-800"
  },
  "étiologie": { 
    icon: Microscope, 
    headerBg: "bg-indigo-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-indigo-700 dark:text-indigo-300",
    borderColor: "border-indigo-200 dark:border-indigo-800"
  },
  "clinique": { 
    icon: Stethoscope, 
    headerBg: "bg-teal-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-teal-700 dark:text-teal-300",
    borderColor: "border-teal-200 dark:border-teal-800"
  },
  "tableau": { 
    icon: Stethoscope, 
    headerBg: "bg-teal-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-teal-700 dark:text-teal-300",
    borderColor: "border-teal-200 dark:border-teal-800"
  },
  "signes": { 
    icon: Activity, 
    headerBg: "bg-cyan-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-cyan-700 dark:text-cyan-300",
    borderColor: "border-cyan-200 dark:border-cyan-800"
  },
  "examen": { 
    icon: ClipboardList, 
    headerBg: "bg-sky-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-sky-700 dark:text-sky-300",
    borderColor: "border-sky-200 dark:border-sky-800"
  },
  "bilan": { 
    icon: TestTube, 
    headerBg: "bg-sky-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-sky-700 dark:text-sky-300",
    borderColor: "border-sky-200 dark:border-sky-800"
  },
  "diagnostic": { 
    icon: Target, 
    headerBg: "bg-emerald-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-emerald-700 dark:text-emerald-300",
    borderColor: "border-emerald-200 dark:border-emerald-800"
  },
  "différentiel": { 
    icon: Target, 
    headerBg: "bg-emerald-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-emerald-700 dark:text-emerald-300",
    borderColor: "border-emerald-200 dark:border-emerald-800"
  },
  "traitement": { 
    icon: Pill, 
    headerBg: "bg-green-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-green-700 dark:text-green-300",
    borderColor: "border-green-200 dark:border-green-800"
  },
  "prise en charge": { 
    icon: Pill, 
    headerBg: "bg-green-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-green-700 dark:text-green-300",
    borderColor: "border-green-200 dark:border-green-800"
  },
  "complications": { 
    icon: AlertTriangle, 
    headerBg: "bg-amber-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-amber-700 dark:text-amber-300",
    borderColor: "border-amber-200 dark:border-amber-800"
  },
  "évolution": { 
    icon: Activity, 
    headerBg: "bg-orange-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-orange-700 dark:text-orange-300",
    borderColor: "border-orange-200 dark:border-orange-800"
  },
  "prévention": { 
    icon: ShieldCheck, 
    headerBg: "bg-lime-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-lime-700 dark:text-lime-300",
    borderColor: "border-lime-200 dark:border-lime-800"
  },
  "points clés": { 
    icon: CheckCircle, 
    headerBg: "bg-rose-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-rose-700 dark:text-rose-300",
    borderColor: "border-rose-200 dark:border-rose-800"
  },
  "pièges": { 
    icon: AlertTriangle, 
    headerBg: "bg-red-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-red-700 dark:text-red-300",
    borderColor: "border-red-200 dark:border-red-800"
  },
  "résumé": { 
    icon: Lightbulb, 
    headerBg: "bg-yellow-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-yellow-700 dark:text-yellow-300",
    borderColor: "border-yellow-200 dark:border-yellow-800"
  },
  "rappel": { 
    icon: Lightbulb, 
    headerBg: "bg-yellow-600",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-yellow-700 dark:text-yellow-300",
    borderColor: "border-yellow-200 dark:border-yellow-800"
  },
  "objectif": { 
    icon: Target, 
    headerBg: "bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-500 dark:to-indigo-500",
    headerText: "text-white",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-violet-700 dark:text-violet-300",
    borderColor: "border-indigo-200 dark:border-indigo-800"
  },
  "default": { 
    icon: Heart, 
    headerBg: "bg-primary",
    headerText: "text-primary-foreground",
    contentBg: "bg-white dark:bg-slate-900/98 backdrop-blur-md",
    accentColor: "text-primary",
    borderColor: "border-border"
  }
};

const getSectionStyle = (title: string) => {
  const lowerTitle = title.toLowerCase();
  for (const [key, value] of Object.entries(sectionStyles)) {
    if (key !== "default" && lowerTitle.includes(key)) {
      return value;
    }
  }
  return sectionStyles.default;
};

// Clean title from emojis and formatting characters
const cleanTitle = (title: string): string => {
  return title
    .replace(/[🧬🩺📌📚🔬💊🫀🧠📋📊⚖️⚠️💡🛡️🎯✓→•\-=]/g, "")
    .trim();
};

// Parse the summary content into structured sections
const parseContent = (content: string): ParsedSection[] => {
  const sections: ParsedSection[] = [];
  const lines = content.split('\n');
  
  let currentSection: ParsedSection | null = null;
  let currentSubsection: ParsedSection | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Skip separator lines
    if (/^-{3,}$/.test(trimmed) || /^={3,}$/.test(trimmed)) continue;
    
    // Main section header: === TITLE === or just === at start
    const mainMatch = trimmed.match(/^===\s*(.+?)\s*===$/);
    if (mainMatch) {
      const title = cleanTitle(mainMatch[1]);
      if (title && title.length > 0) {
        // Save previous section
        if (currentSubsection) {
          sections.push(currentSubsection);
          currentSubsection = null;
        }
        if (currentSection && currentSection.content.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { title, content: [], isMainSection: true };
      }
      continue;
    }
    
    // Subsection header: -- Title -- or just -- at start
    const subMatch = trimmed.match(/^--\s*(.+?)\s*--$/);
    if (subMatch) {
      const title = cleanTitle(subMatch[1]);
      if (title && title.length > 0) {
        // Save previous subsection
        if (currentSubsection && currentSubsection.content.length > 0) {
          sections.push(currentSubsection);
        }
        currentSubsection = { title, content: [], isMainSection: false };
      }
      continue;
    }
    
    // Also match "# Title" format as subsection (legacy format)
    const hashMatch = trimmed.match(/^#+\s*(.+)$/);
    if (hashMatch) {
      const title = cleanTitle(hashMatch[1]);
      if (title && title.length > 0) {
        if (currentSubsection && currentSubsection.content.length > 0) {
          sections.push(currentSubsection);
        }
        currentSubsection = { title, content: [], isMainSection: false };
      }
      continue;
    }
    
    // Regular content line - skip watermark
    if (trimmed.includes("QUIZZMED") || trimmed.includes("Plateforme d'apprentissage")) {
      continue;
    }
    
    // Add content to current section
    if (currentSubsection) {
      currentSubsection.content.push(trimmed);
    } else if (currentSection) {
      currentSection.content.push(trimmed);
    } else {
      // No section yet, create default
      currentSection = { title: "Introduction", content: [trimmed], isMainSection: true };
    }
  }
  
  // Push remaining sections
  if (currentSubsection && currentSubsection.content.length > 0) {
    sections.push(currentSubsection);
  }
  if (currentSection && currentSection.content.length > 0) {
    sections.push(currentSection);
  }
  
  // If no sections parsed, return content as single section
  if (sections.length === 0) {
    return [{
      title: "Contenu",
      content: content.split('\n').filter(l => l.trim()),
      isMainSection: true
    }];
  }
  
  return sections;
};

// Format a single content line with proper styling
const formatLine = (line: string, index: number, accentColor: string) => {
  const trimmed = line.trim();
  
  // Important box: [ TEXT ]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return (
      <div key={index} className="my-2 p-3 bg-primary/10 border-l-4 border-primary rounded-r-lg">
        <p className="font-medium text-primary text-[13px] md:text-sm break-words">{trimmed.slice(1, -1).trim()}</p>
      </div>
    );
  }
  
  // Bullet point with checkmark
  if (trimmed.startsWith('✓')) {
    return (
      <div key={index} className="flex items-start gap-2 py-1">
        <span className="text-green-600 dark:text-green-400 font-bold mt-0.5 flex-shrink-0">✓</span>
        <span className="flex-1 break-words">{formatInlineText(trimmed.slice(1).trim())}</span>
      </div>
    );
  }
  
  // Bullet point with arrow
  if (trimmed.startsWith('→')) {
    return (
      <div key={index} className="flex items-start gap-2 py-1">
        <span className={cn("font-bold mt-0.5 flex-shrink-0", accentColor)}>→</span>
        <span className="flex-1 break-words">{formatInlineText(trimmed.slice(1).trim())}</span>
      </div>
    );
  }
  
  // Bullet point with dot
  if (trimmed.startsWith('•')) {
    return (
      <div key={index} className="flex items-start gap-2 py-1">
        <span className={cn("font-bold mt-0.5 flex-shrink-0", accentColor)}>•</span>
        <span className="flex-1 break-words">{formatInlineText(trimmed.slice(1).trim())}</span>
      </div>
    );
  }
  
  // Indented sub-item with dash
  if (trimmed.startsWith('-')) {
    return (
      <div key={index} className="flex items-start gap-2 py-0.5 ml-4">
        <span className="text-muted-foreground flex-shrink-0">–</span>
        <span className="flex-1 text-muted-foreground break-words">{formatInlineText(trimmed.slice(1).trim())}</span>
      </div>
    );
  }
  
  // Numbered list
  if (/^\d+\./.test(trimmed)) {
    const match = trimmed.match(/^(\d+)\.\s*(.*)$/);
    if (match) {
      return (
        <div key={index} className="flex items-start gap-2 py-1">
          <span className={cn("font-semibold min-w-5 flex-shrink-0", accentColor)}>{match[1]}.</span>
          <span className="flex-1 break-words">{formatInlineText(match[2])}</span>
        </div>
      );
    }
  }
  
  // Regular paragraph
  return (
    <p key={index} className="py-1 leading-relaxed break-words">
      {formatInlineText(trimmed)}
    </p>
  );
};

// Format inline text (bold, emphasis)
const formatInlineText = (text: string) => {
  // Handle **bold** and __bold__
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    // Handle :text: as emphasized
    const colonParts = part.split(/(:[\w\s]+:)/g);
    return colonParts.map((cp, ci) => {
      if (cp.startsWith(':') && cp.endsWith(':') && cp.length > 2) {
        return <em key={`${i}-${ci}`} className="font-medium text-primary">{cp.slice(1, -1)}</em>;
      }
      return cp;
    });
  });
};

// Section Card Component
const SectionCard: FC<{ section: ParsedSection }> = ({ section }) => {
  const style = getSectionStyle(section.title);
  const Icon = style.icon;
  
  return (
    <div className={cn(
      "rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 border",
      style.borderColor
    )}>
      {/* Section Header */}
      <div className={cn("px-4 py-3 flex items-center gap-3", style.headerBg)}>
        <div className="p-1.5 bg-white/20 rounded-lg flex-shrink-0">
          <Icon className={cn("h-5 w-5", style.headerText)} />
        </div>
        <h3 className={cn(
          "font-semibold text-base md:text-lg uppercase truncate",
          style.headerText
        )}>
          {section.title}
        </h3>
      </div>
      
      {/* Section Content */}
      <div className={cn("px-4 md:px-5 py-4", style.contentBg)}>
        <div className="space-y-1.5 text-[13px] md:text-sm leading-relaxed text-foreground font-[system-ui,-apple-system,sans-serif]">
          {section.content.map((line, idx) => formatLine(line, idx, style.accentColor))}
        </div>
      </div>
    </div>
  );
};

const MedicalSummaryCard: FC<MedicalSummaryCardProps> = ({ content, title, summaryType }) => {
  const sections = parseContent(content);
  
  // Determine layout - key sections get full width
  const isFullWidthSection = (sectionTitle: string): boolean => {
    const fullWidthKeywords = ["points clés", "pièges", "complications", "résumé", "rappel", "introduction"];
    const lower = sectionTitle.toLowerCase();
    return fullWidthKeywords.some(kw => lower.includes(kw));
  };
  
  return (
    <div className="w-full max-w-5xl mx-auto space-y-6" id="summary-content">
      {/* Main Header */}
      <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 text-center shadow-lg relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-20 sm:w-32 h-20 sm:h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-16 sm:w-24 h-16 sm:h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1 sm:py-1.5 bg-white/20 rounded-full text-xs sm:text-sm mb-3 sm:mb-4">
            <Heart className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Fiche de révision médicale</span>
          </div>
          
          <h1 className="text-xl sm:text-2xl md:text-4xl font-bold uppercase tracking-wide mb-2 sm:mb-3 break-words">
            {title}
          </h1>
          
          <p className="text-primary-foreground/80 text-sm md:text-base">
            {summaryType === "complete" ? "Résumé Complet" : summaryType === "structured" ? "Résumé Structuré" : "Fiche Concise"}
          </p>
        </div>
      </div>
      
      {/* Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {sections.map((section, index) => (
          <div 
            key={index} 
            className={cn(
              isFullWidthSection(section.title) && "md:col-span-2"
            )}
          >
            <SectionCard section={section} />
          </div>
        ))}
      </div>
      
      {/* Footer */}
      <div className="text-center py-4 border-t border-border">
        <p className="text-xs text-muted-foreground tracking-wide">
          QUIZZMED — Plateforme d'apprentissage médical
        </p>
      </div>
    </div>
  );
};

export default MedicalSummaryCard;
