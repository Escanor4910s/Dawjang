import React, { useState, useMemo } from "react";
import {
  Award,
  CheckCircle2,
  Lock,
  Search,
  X,
  Flame,
  Shield,
  Target,
  BookOpen,
  Layers,
  Infinity as InfinityIcon,
  Swords,
  Compass,
  Zap,
  Crown,
  Star,
  Trophy,
  Medal,
  Brain,
  Sparkles,
} from "lucide-react";
import {
  AcademicBadge,
  BadgeCategory,
  BadgeRarity,
} from "@/hooks/useGamification";

interface BadgeDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  badges: AcademicBadge[];
  totalXp: number;
  level: number;
  rankTitle: string;
}

const RARITY_STYLES: Record<
  BadgeRarity,
  {
    badgeBg: string;
    border: string;
    text: string;
    label: string;
    gradStart: string;
    gradMid: string;
    gradEnd: string;
    rimColor: string;
    innerBg: string;
    accentColor: string;
  }
> = {
  bronze: {
    badgeBg: "bg-[#F5EBE1] dark:bg-amber-950/30",
    border: "border-[#D8B89A] dark:border-amber-800/50",
    text: "text-[#8C5828] dark:text-amber-300",
    label: "Bronze",
    gradStart: "#E6A15C",
    gradMid: "#CD7F32",
    gradEnd: "#6E3B10",
    rimColor: "#F7D4AE",
    innerBg: "#3A1F09",
    accentColor: "#FFD7AE",
  },
  argent: {
    badgeBg: "bg-stone-100 dark:bg-stone-800",
    border: "border-stone-300 dark:border-stone-600",
    text: "text-stone-700 dark:text-stone-200",
    label: "Argent",
    gradStart: "#F3F4F6",
    gradMid: "#9CA3AF",
    gradEnd: "#374151",
    rimColor: "#FFFFFF",
    innerBg: "#1F2937",
    accentColor: "#F9FAFB",
  },
  or: {
    badgeBg: "bg-amber-50 dark:bg-yellow-950/30",
    border: "border-amber-300 dark:border-yellow-700/60",
    text: "text-amber-800 dark:text-yellow-300",
    label: "Or",
    gradStart: "#FDE68A",
    gradMid: "#F59E0B",
    gradEnd: "#92400E",
    rimColor: "#FEF3C7",
    innerBg: "#451A03",
    accentColor: "#FEF08A",
  },
  platine: {
    badgeBg: "bg-teal-50 dark:bg-teal-950/30",
    border: "border-teal-300 dark:border-teal-700/60",
    text: "text-teal-900 dark:text-teal-300",
    label: "Platine",
    gradStart: "#99F6E4",
    gradMid: "#14B8A6",
    gradEnd: "#115E59",
    rimColor: "#CCFBF1",
    innerBg: "#042F2E",
    accentColor: "#E6FFFA",
  },
  obsidienne: {
    badgeBg: "bg-[#18181B] text-white",
    border: "border-[#D96B43]",
    text: "text-[#D96B43]",
    label: "Obsidienne",
    gradStart: "#3F3F46",
    gradMid: "#18181B",
    gradEnd: "#09090B",
    rimColor: "#D96B43",
    innerBg: "#14110F",
    accentColor: "#F59E0B",
  },
};

/**
 * Génère la silhouette géométrique externe du blason selon la catégorie (10 formes héraldiques distinctes)
 */
function renderShieldSilhouette(category: BadgeCategory, gradId: string, rimColor: string) {
  switch (category) {
    case "cadence":
      // Écu Flamme Impériale
      return (
        <path
          d="M32 4 L54 11 C55 28 52 44 32 59 C12 44 9 28 10 11 Z"
          fill={`url(#${gradId})`}
          stroke={rimColor}
          strokeWidth="2"
        />
      );
    case "qcm":
      // Sceau Octogonal Tactique
      return (
        <polygon
          points="21,4 43,4 58,19 58,41 43,56 21,56 6,41 6,19"
          fill={`url(#${gradId})`}
          stroke={rimColor}
          strokeWidth="2"
        />
      );
    case "precision":
      // Écu Chirurgical Losangé à Épaulements
      return (
        <path
          d="M32 3 L56 17 L50 45 L32 59 L14 45 L8 17 Z"
          fill={`url(#${gradId})`}
          stroke={rimColor}
          strokeWidth="2"
        />
      );
    case "synthese":
      // Cartouche Académique d'Oxford
      return (
        <path
          d="M14 6 H50 L56 14 V42 C56 50 44 56 32 59 C20 56 8 50 8 42 V14 Z"
          fill={`url(#${gradId})`}
          stroke={rimColor}
          strokeWidth="2"
        />
      );
    case "memorisation":
      // Hexagone Synaptique Ciselé
      return (
        <polygon
          points="32,3 57,17 57,45 32,59 7,45 7,17"
          fill={`url(#${gradId})`}
          stroke={rimColor}
          strokeWidth="2"
        />
      );
    case "infini":
      // Médaillon Stellaire à 12 Pointes
      return (
        <path
          d="M32 3 L38 9 L46 6 L49 14 L57 17 L55 25 L60 32 L55 39 L57 47 L49 50 L46 58 L38 55 L32 61 L26 55 L18 58 L15 50 L7 47 L9 39 L4 32 L9 25 L7 17 L15 14 L18 6 L26 9 Z"
          fill={`url(#${gradId})`}
          stroke={rimColor}
          strokeWidth="1.75"
        />
      );
    case "duels":
      // Blason Chevaleresque Croisé
      return (
        <path
          d="M8 8 L32 4 L56 8 L53 36 C51 47 42 54 32 60 C22 54 13 47 11 36 Z"
          fill={`url(#${gradId})`}
          stroke={rimColor}
          strokeWidth="2"
        />
      );
    case "polyvalence":
      // Rose des Vents Décaèdre
      return (
        <polygon
          points="32,3 44,7 54,16 58,29 54,43 44,53 32,59 20,53 10,43 6,29 10,16 20,7"
          fill={`url(#${gradId})`}
          stroke={rimColor}
          strokeWidth="2"
        />
      );
    case "vitesse":
      // Écusson Aérodynamique Ailé
      return (
        <path
          d="M32 4 L58 12 L51 39 L32 59 L13 39 L6 12 Z"
          fill={`url(#${gradId})`}
          stroke={rimColor}
          strokeWidth="2"
        />
      );
    case "pantheon":
    default:
      // Sceau Impérial Couronné
      return (
        <path
          d="M18 6 L32 2 L46 6 L57 16 L54 42 L32 60 L10 42 L7 16 Z"
          fill={`url(#${gradId})`}
          stroke={rimColor}
          strokeWidth="2.2"
        />
      );
  }
}

/**
 * Ornementations progressives selon le palier (Tier 1 à 10) :
 * Couronne, lauriers, rayons solaires, étoiles de rang, ailes ou ruban d'honneur
 */
function renderTierOrnament(tier: number, accent: string, rimColor: string) {
  return (
    <g>
      {/* Rayons solaires de fond pour les paliers 7 à 10 */}
      {tier >= 7 && (
        <g stroke={rimColor} strokeWidth="1" opacity="0.45">
          <line x1="32" y1="1" x2="32" y2="63" />
          <line x1="1" y1="32" x2="63" y2="32" />
          <line x1="9" y1="9" x2="55" y2="55" />
          <line x1="55" y1="9" x2="9" y2="55" />
        </g>
      )}

      {/* Couronne de lauriers latérale à partir du palier 4 */}
      {tier >= 4 && (
        <g fill="none" stroke={accent} strokeWidth="1.4" opacity="0.85">
          <path d="M15 44 C11 36 11 24 16 16" strokeDasharray="3 1.5" />
          <path d="M49 44 C53 36 53 24 48 16" strokeDasharray="3 1.5" />
        </g>
      )}

      {/* Couronne souveraine au sommet pour les paliers 8, 9, 10 */}
      {tier >= 8 && (
        <path
          d="M23 12 L26 6 L32 10 L38 6 L41 12 Z"
          fill={accent}
          stroke={rimColor}
          strokeWidth="0.8"
        />
      )}

      {/* Étoiles de palier en bas du blason */}
      {tier <= 3 && (
        <g fill={accent}>
          {Array.from({ length: tier }).map((_, i) => {
            const offset = (i - (tier - 1) / 2) * 6;
            return <circle key={i} cx={32 + offset} cy={50} r={1.6} />;
          })}
        </g>
      )}

      {tier >= 4 && tier <= 7 && (
        <g fill={accent}>
          <circle cx="25" cy="50" r="1.6" />
          <circle cx="32" cy="51.5" r="2.1" />
          <circle cx="39" cy="50" r="1.6" />
        </g>
      )}

      {tier >= 9 && (
        <g fill={accent}>
          <circle cx="21" cy="49" r="1.4" />
          <circle cx="26.5" cy="51" r="1.7" />
          <circle cx="32" cy="52" r="2.2" />
          <circle cx="37.5" cy="51" r="1.7" />
          <circle cx="43" cy="49" r="1.4" />
        </g>
      )}
    </g>
  );
}

/**
 * Génère un motif central vectoriel unique pour chacun des 100 badges
 * en combinant l'emblème de sa collection et une géométrie spécifique à son palier (1..10)
 */
function renderUniqueCenterMotif(
  badge: AcademicBadge,
  accent: string,
  rimColor: string
) {
  const t = badge.tier; // 1..10

  switch (badge.category) {
    case "cadence":
      // Flamme sacrée évolutive (1 à 10)
      return (
        <g>
          <path
            d="M32 15 C37 22 42 26 40 35 C39 41 35 44 32 44 C29 44 25 41 24 35 C22 26 27 22 32 15 Z"
            fill={accent}
          />
          <path
            d="M32 23 C34.5 27 36 30 35 35 C34.5 38 33 40 32 40 C31 40 29.5 38 29 35 C28 30 29.5 27 32 23 Z"
            fill="#D96B43"
          />
          {t >= 5 && (
            <circle cx="32" cy="34" r={1.8 + (t % 3) * 0.6} fill="#FFFFFF" />
          )}
          {t % 2 === 0 && (
            <path d="M22 38 L42 38" stroke={rimColor} strokeWidth="1.5" strokeLinecap="round" />
          )}
        </g>
      );

    case "qcm":
      // Cible docimologique & flèche de précision
      return (
        <g fill="none" stroke={accent} strokeWidth="1.8">
          <circle cx="32" cy="30" r={11} />
          <circle cx="32" cy="30" r={6} strokeDasharray={t % 2 === 0 ? "3 2" : undefined} />
          <circle cx="32" cy="30" r={2.2} fill={accent} />
          <line x1="32" y1="15" x2="32" y2="21" />
          <line x1="32" y1="39" x2="32" y2="45" />
          <line x1="17" y1="30" x2="23" y2="30" />
          <line x1="41" y1="30" x2="47" y2="30" />
          {t >= 4 && <line x1="22" y1="20" x2="30" y2="28" stroke="#D96B43" strokeWidth="2.2" />}
        </g>
      );

    case "precision":
      // Caducée / Scalpel / Étoile chirurgicale
      return (
        <g stroke={accent} strokeWidth="1.8" fill="none">
          <path
            d="M32 15 L36 26 L47 30 L36 34 L32 45 L28 34 L17 30 L28 26 Z"
            fill={t >= 6 ? accent : "none"}
            fillOpacity={t >= 6 ? 0.25 : 0}
          />
          <circle cx="32" cy="30" r={3 + (t % 3)} fill={accent} />
          {t >= 3 && (
            <circle cx="32" cy="30" r="9" stroke={rimColor} strokeWidth="1.1" strokeDasharray="2 2" />
          )}
        </g>
      );

    case "synthese":
      // Codex ouvert & Plume d'or
      return (
        <g stroke={accent} strokeWidth="1.7" fill="none">
          <path d="M19 22 C24 22 29 24 32 27 C35 24 40 22 45 22 V39 C40 39 35 40 32 43 C29 40 24 39 19 39 Z" />
          <line x1="32" y1="27" x2="32" y2="43" />
          {t >= 2 && <line x1="23" y1="27" x2="29" y2="28" strokeWidth="1.3" />}
          {t >= 4 && <line x1="35" y1="28" x2="41" y2="27" strokeWidth="1.3" />}
          {t >= 6 && <path d="M32 16 L36 22 L32 20 L28 22 Z" fill={accent} />}
        </g>
      );

    case "memorisation":
      // Cristal FSRS & Réseau synaptique
      return (
        <g stroke={accent} strokeWidth="1.6" fill="none">
          <polygon
            points="32,16 44,24 44,36 32,44 20,36 20,24"
            fill={accent}
            fillOpacity="0.18"
          />
          <circle cx="32" cy="16" r="2" fill={accent} />
          <circle cx="44" cy="24" r="2" fill={accent} />
          <circle cx="44" cy="36" r="2" fill={accent} />
          <circle cx="32" cy="44" r="2" fill={accent} />
          <circle cx="20" cy="36" r="2" fill={accent} />
          <circle cx="20" cy="24" r="2" fill={accent} />
          <circle cx="32" cy="30" r={2.5 + (t % 3) * 0.7} fill="#D96B43" />
          <line x1="32" y1="16" x2="32" y2="44" opacity="0.6" />
          <line x1="20" y1="24" x2="44" y2="36" opacity="0.6" />
        </g>
      );

    case "infini":
      // Anneau de Möbius / Lemniscate Infini
      return (
        <g stroke={accent} strokeWidth="2.2" fill="none">
          <path d="M23 30 C18 24 18 36 23 30 C27 25 37 35 41 30 C46 24 46 36 41 30 C37 25 27 35 23 30 Z" />
          <circle cx="22" cy="30" r="1.8" fill={accent} />
          <circle cx="42" cy="30" r="1.8" fill={accent} />
          {t >= 5 && <circle cx="32" cy="21" r="2" fill="#D96B43" />}
        </g>
      );

    case "duels":
      // Épées croisées & Bouclier d'arène
      return (
        <g stroke={accent} strokeWidth="2" strokeLinecap="round" fill="none">
          <line x1="20" y1="41" x2="44" y2="19" />
          <line x1="44" y1="41" x2="20" y2="19" />
          <line x1="22" y1="35" x2="26" y2="39" />
          <line x1="42" y1="35" x2="38" y2="39" />
          {t >= 3 && (
            <path
              d="M32 23 L38 27 L36 35 L32 39 L28 35 L26 27 Z"
              fill="#D96B43"
              stroke={rimColor}
              strokeWidth="1.2"
            />
          )}
        </g>
      );

    case "polyvalence":
      // Rose des vents & Astrolabe
      return (
        <g stroke={accent} strokeWidth="1.6" fill="none">
          <circle cx="32" cy="30" r="11" />
          <polygon
            points="32,16 35,27 46,30 35,33 32,44 29,33 18,30 29,27"
            fill={accent}
            fillOpacity="0.85"
          />
          <circle cx="32" cy="30" r="2.5" fill="#18181B" />
        </g>
      );

    case "vitesse":
      // Foudre Olympique & Chevron Supersonique
      return (
        <g>
          <polygon
            points="35,15 22,31 31,31 28,45 43,28 34,28"
            fill={accent}
            stroke={rimColor}
            strokeWidth="1"
          />
          {t >= 5 && (
            <path
              d="M18 24 L24 19 M46 36 L40 41"
              stroke="#D96B43"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </g>
      );

    case "pantheon":
    default:
      // Couronne Impériale & Sceau du Panthéon
      return (
        <g>
          <path
            d="M19 37 L22 22 L28 29 L32 19 L36 29 L42 22 L45 37 Z"
            fill={accent}
            stroke={rimColor}
            strokeWidth="1.2"
          />
          <rect x="20" y="38" width="24" height="3.5" rx="1.5" fill="#D96B43" />
          <circle cx="32" cy="17" r="2" fill="#FFFFFF" />
        </g>
      );
  }
}

/**
 * Composant SVG Héraldique sur-mesure pour chacun des 100 Badges Académiques
 */
export const AcademicBadgeCrest: React.FC<{
  badge: AcademicBadge;
  size?: "sm" | "md" | "lg";
  className?: string;
}> = ({ badge, size = "md", className = "" }) => {
  const style = RARITY_STYLES[badge.rarity];
  const gradId = `badge-grad-${badge.id}-${size}`;
  const innerGradId = `badge-inner-${badge.id}-${size}`;

  const dimensions =
    size === "sm"
      ? "w-10 h-10"
      : size === "lg"
      ? "w-16 h-16"
      : "w-13 h-13";

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${dimensions} ${
        !badge.unlocked ? "grayscale opacity-60" : ""
      } ${className}`}
      title={`${badge.name} (#${badge.number}/100 • ${style.label})`}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xs"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={style.gradStart} />
            <stop offset="50%" stopColor={style.gradMid} />
            <stop offset="100%" stopColor={style.gradEnd} />
          </linearGradient>
          <radialGradient id={innerGradId} cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor={style.innerBg} stopOpacity="0.85" />
            <stop offset="100%" stopColor="#09090B" stopOpacity="0.95" />
          </radialGradient>
        </defs>

        {/* Silhouette Héraldique Externe (10 formes selon la collection) */}
        {renderShieldSilhouette(badge.category, gradId, style.rimColor)}

        {/* Médaillon intérieur sombre ciselé */}
        <circle
          cx="32"
          cy="30"
          r="16.5"
          fill={`url(#${innerGradId})`}
          stroke={style.rimColor}
          strokeWidth="1.2"
          strokeOpacity="0.8"
        />

        {/* Ornementations de Palier (Tier 1..10) */}
        {renderTierOrnament(badge.tier, style.accentColor, style.rimColor)}

        {/* Motif Vectoriel Central Unique */}
        {renderUniqueCenterMotif(badge, style.accentColor, style.rimColor)}
      </svg>

      {/* Numéro matricule #1..100 */}
      <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded bg-[#18181B] border border-white/20 text-white font-mono text-[8.5px] font-bold leading-tight shadow-2xs">
        #{badge.number}
      </span>
    </div>
  );
};

export const BadgeDisplayModal: React.FC<BadgeDisplayModalProps> = ({
  isOpen,
  onClose,
  badges,
  totalXp,
  level,
  rankTitle,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<BadgeCategory | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "unlocked" | "locked">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const unlockedCount = useMemo(
    () => badges.filter((b) => b.unlocked).length,
    [badges]
  );

  const categoriesList: { id: BadgeCategory | "all"; label: string }[] = [
    { id: "all", label: "Toutes (100)" },
    { id: "cadence", label: "Cadence (10)" },
    { id: "qcm", label: "QCM (10)" },
    { id: "precision", label: "Précision (10)" },
    { id: "synthese", label: "Synthèses (10)" },
    { id: "memorisation", label: "Mémorisation (10)" },
    { id: "infini", label: "Mode Infini (10)" },
    { id: "duels", label: "Duels (10)" },
    { id: "polyvalence", label: "Polyvalence (10)" },
    { id: "vitesse", label: "Vitesse (10)" },
    { id: "pantheon", label: "Panthéon XP (10)" },
  ];

  const filteredBadges = useMemo(() => {
    return badges.filter((b) => {
      if (selectedCategory !== "all" && b.category !== selectedCategory) return false;
      if (selectedStatus === "unlocked" && !b.unlocked) return false;
      if (selectedStatus === "locked" && b.unlocked) return false;
      const cleanQuery = String(searchQuery || "").trim();
      if (cleanQuery) {
        const q = cleanQuery.toLowerCase();
        return (
          (b.name || "").toLowerCase().includes(q) ||
          (b.requirementText || "").toLowerCase().includes(q) ||
          (b.categoryLabel || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [badges, selectedCategory, selectedStatus, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-[#FAF8F5] dark:bg-[#141312] border border-[#E6DCD0] dark:border-stone-800 w-full max-w-6xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95">
        {/* En-tête de la Galerie des 100 Distinctions */}
        <div className="p-5 sm:px-7 bg-white dark:bg-[#1C1917] border-b border-[#EAE4DC] dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-[#D96B43]/15 text-[#C85A32]">
                PANTHÉON HÉRALDIQUE DAWJANG • 100 EMBLÈMES CISELÉS
              </span>
              <span className="text-xs font-mono text-stone-500 tabular-nums">
                LV.{level} • {rankTitle} ({totalXp.toLocaleString("fr-FR")} XP)
              </span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#18181B] dark:text-white">
              Registre des 100 Badges & Distinctions ({unlockedCount} / 100 débloqués)
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="self-end sm:self-auto w-9 h-9 rounded-xl bg-[#FAF8F5] dark:bg-stone-800 border border-[#E6DCD0] dark:border-stone-700 flex items-center justify-center text-stone-600 hover:text-black dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barre de filtres et recherche */}
        <div className="px-5 sm:px-7 py-3.5 bg-[#FAF8F5] dark:bg-[#181615] border-b border-[#EAE4DC] dark:border-stone-800 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher parmi les 100 blasons (ex: Centurion, Scalpel, FSRS, Obsidienne)..."
                className="w-full h-9 pl-9 pr-4 rounded-xl bg-white dark:bg-stone-900 border border-[#E6DCD0] dark:border-stone-700 text-xs focus:outline-none focus:border-[#D96B43]"
              />
            </div>

            <div className="inline-flex p-1 rounded-xl bg-white dark:bg-stone-900 border border-[#E6DCD0] dark:border-stone-800 shrink-0">
              {[
                { id: "all", label: `Tous (100)` },
                { id: "unlocked", label: `Débloqués (${unlockedCount})` },
                { id: "locked", label: `À conquérir (${100 - unlockedCount})` },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedStatus(st.id as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedStatus === st.id
                      ? "bg-[#18181B] text-white dark:bg-stone-100 dark:text-[#18181B]"
                      : "text-stone-500 hover:text-[#18181B]"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Onglets des 10 collections */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categoriesList.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                  selectedCategory === cat.id
                    ? "bg-[#D96B43] text-white font-semibold shadow-2xs"
                    : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border border-[#EAE4DC] dark:border-stone-800 hover:border-[#D96B43]/50"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grille des 100 Badges Héraldiques */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBadges.map((badge) => {
            const style = RARITY_STYLES[badge.rarity];

            return (
              <div
                key={badge.id}
                className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                  badge.unlocked
                    ? "bg-white dark:bg-[#1C1917] border-[#E2D9C8] dark:border-stone-700 shadow-xs hover:border-[#D96B43]/60"
                    : "bg-white/65 dark:bg-stone-900/40 border-[#EAE4DC] dark:border-stone-800/80 opacity-85"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <AcademicBadgeCrest badge={badge} size="md" />

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border ${style.badgeBg} ${style.border} ${style.text}`}
                          >
                            {style.label} • Palier {badge.tier}/10
                          </span>
                          <span className="text-[10px] font-mono font-bold text-[#D96B43]">
                            +{badge.xpBonus.toLocaleString("fr-FR")} XP
                          </span>
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold text-[#18181B] dark:text-white truncate mt-1">
                          {badge.name}
                        </h3>
                      </div>
                    </div>

                    {badge.unlocked ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                    ) : (
                      <Lock className="w-4 h-4 text-stone-400 shrink-0 mt-1" />
                    )}
                  </div>

                  <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-3 leading-relaxed">
                    {badge.requirementText}
                  </p>
                </div>

                {/* Barre de progression individuelle du badge */}
                <div className="mt-3.5 pt-2.5 border-t border-[#F2EDE6] dark:border-stone-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-stone-500">{badge.categoryLabel}</span>
                    <span className="font-bold text-[#18181B] dark:text-stone-200 tabular-nums">
                      {badge.currentValue.toLocaleString("fr-FR")} /{" "}
                      {badge.targetValue.toLocaleString("fr-FR")} ({badge.progress}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#EFECE6] dark:bg-stone-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        badge.unlocked ? "bg-emerald-600" : "bg-[#D96B43]"
                      }`}
                      style={{ width: `${badge.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BadgeDisplayModal;

// ============================================================================
// COMPATIBILITÉ AVEC LE PANNEAU DE PROFIL, SETTINGS & WIDGETS EXISTANTS
// ============================================================================

export interface QuestBadgeItem {
  id: string;
  title: string;
  xpRequired: number;
  questDescription: string;
  iconKey: string;
  unlocked: boolean;
  pinnedOnCard?: boolean;
}

export const BADGES_STORAGE_KEY = "hippocampus_quest_badges_v2";

export const DEFAULT_QUEST_BADGES: QuestBadgeItem[] = [
  { id: "quest-1", title: "Inauguration DawJang", xpRequired: 500, questDescription: "Compléter votre premier cycle de travail", iconKey: "sparkles", unlocked: true, pinnedOnCard: true },
  { id: "quest-2", title: "Cadence 3 Jours", xpRequired: 1200, questDescription: "Maintenir 3 jours de régularité", iconKey: "flame", unlocked: true, pinnedOnCard: true },
  { id: "quest-3", title: "Mémoire Vive", xpRequired: 2500, questDescription: "Maîtriser 50 flashcards académiques", iconKey: "brain", unlocked: true, pinnedOnCard: true },
  { id: "quest-4", title: "Artisan QCM", xpRequired: 4000, questDescription: "Résoudre 50 questions à choix multiple", iconKey: "target", unlocked: true, pinnedOnCard: true },
  { id: "quest-5", title: "Cadence 7 Jours", xpRequired: 6500, questDescription: "Valider une semaine complète de révision", iconKey: "flame", unlocked: true, pinnedOnCard: true },
  { id: "quest-6", title: "Excellence Parfaite", xpRequired: 9000, questDescription: "Obtenir 100% sur 5 séries d'entraînement", iconKey: "star", unlocked: true, pinnedOnCard: true },
  { id: "quest-7", title: "Plume Clinique", xpRequired: 12000, questDescription: "Générer et archiver 5 synthèses de cours", iconKey: "book", unlocked: true, pinnedOnCard: true },
  { id: "quest-8", title: "Maître du Savoir", xpRequired: 15500, questDescription: "Franchir le cap des 15 000 XP académiques", iconKey: "trophy", unlocked: true, pinnedOnCard: true },
  { id: "quest-9", title: "Commandant DawJang", xpRequired: 21540, questDescription: "Atteindre le rang de Master 1 • Commandant", iconKey: "shield", unlocked: true, pinnedOnCard: false },
  { id: "quest-10", title: "Vétéran des Épreuves", xpRequired: 30000, questDescription: "Compléter 15 examens blancs chronométrés", iconKey: "award", unlocked: false, pinnedOnCard: false },
  { id: "quest-11", title: "Duelliste d'Élite", xpRequired: 40000, questDescription: "Remporter 10 duels académiques consécutifs", iconKey: "swords", unlocked: false, pinnedOnCard: false },
  { id: "quest-12", title: "Cadence 30 Jours", xpRequired: 55000, questDescription: "Maintenir 30 jours sans interruption", iconKey: "flame", unlocked: false, pinnedOnCard: false },
  { id: "quest-13", title: "Polymathe Clinique", xpRequired: 75000, questDescription: "Valider tous les modules du semestre", iconKey: "compass", unlocked: false, pinnedOnCard: false },
  { id: "quest-14", title: "Maître de la Vitesse", xpRequired: 100000, questDescription: "Répondre en moins de 10s à 100 QCM", iconKey: "zap", unlocked: false, pinnedOnCard: false },
  { id: "quest-15", title: "Centurion Médical", xpRequired: 130000, questDescription: "Résoudre 1 000 QCM académiques", iconKey: "medal", unlocked: false, pinnedOnCard: false },
  { id: "quest-16", title: "Encyclopédiste", xpRequired: 170000, questDescription: "Archiver 50 synthèses de cours complètes", iconKey: "book", unlocked: false, pinnedOnCard: false },
  { id: "quest-17", title: "Grand Stratège", xpRequired: 220000, questDescription: "Dominer le haut du classement général", iconKey: "crown", unlocked: false, pinnedOnCard: false },
  { id: "quest-18", title: "Infini Titanesque", xpRequired: 280000, questDescription: "Atteindre une série de 100 en Mode Infini", iconKey: "infinity", unlocked: false, pinnedOnCard: false },
  { id: "quest-19", title: "Cadence 60 Jours", xpRequired: 350000, questDescription: "Deux mois complets de dévouement quotidien", iconKey: "flame", unlocked: false, pinnedOnCard: false },
  { id: "quest-20", title: "Érudit d'Obsidienne", xpRequired: 430000, questDescription: "Débloquer votre premier insigne d'Obsidienne", iconKey: "shield", unlocked: false, pinnedOnCard: false },
  { id: "quest-21", title: "Maître Praticien", xpRequired: 520000, questDescription: "Maîtriser 500 cas cliniques complexes", iconKey: "award", unlocked: false, pinnedOnCard: false },
  { id: "quest-22", title: "Professeur Émérite", xpRequired: 620000, questDescription: "Atteindre le grade de Professeur Titulaire", iconKey: "crown", unlocked: false, pinnedOnCard: false },
  { id: "quest-23", title: "Docteur Honoris Causa", xpRequired: 730000, questDescription: "Valider 30 collections thématiques complètes", iconKey: "trophy", unlocked: false, pinnedOnCard: false },
  { id: "quest-24", title: "Cadence 100 Jours", xpRequired: 850000, questDescription: "Un siècle de jours consécutifs d'étude", iconKey: "flame", unlocked: false, pinnedOnCard: false },
  { id: "quest-25", title: "Légende Vivante", xpRequired: 1000000, questDescription: "Franchir le seuil mythique de 1 000 000 XP", iconKey: "crown", unlocked: false, pinnedOnCard: false },
];

export const getStoredQuestBadges = (): QuestBadgeItem[] => {
  if (typeof window === "undefined") return DEFAULT_QUEST_BADGES;
  try {
    const raw = localStorage.getItem(BADGES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(BADGES_STORAGE_KEY, JSON.stringify(DEFAULT_QUEST_BADGES));
      return DEFAULT_QUEST_BADGES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return DEFAULT_QUEST_BADGES;
};

export const renderBadgeIcon = (iconKey: string, className = "w-4 h-4") => {
  switch (iconKey) {
    case "flame":
      return <Flame className={className} />;
    case "target":
      return <Target className={className} />;
    case "shield":
      return <Shield className={className} />;
    case "book":
      return <BookOpen className={className} />;
    case "brain":
      return <Brain className={className} />;
    case "star":
      return <Star className={className} />;
    case "trophy":
      return <Trophy className={className} />;
    case "award":
      return <Award className={className} />;
    case "swords":
      return <Swords className={className} />;
    case "compass":
      return <Compass className={className} />;
    case "zap":
      return <Zap className={className} />;
    case "crown":
      return <Crown className={className} />;
    case "medal":
      return <Medal className={className} />;
    case "infinity":
      return <InfinityIcon className={className} />;
    case "sparkles":
    default:
      return <Sparkles className={className} />;
  }
};

export const MilitaryMedalEmblem: React.FC<{
  badge: QuestBadgeItem;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}> = ({ badge, size = "md", onClick }) => {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  }[size];

  return (
    <div
      onClick={onClick}
      title={`${badge.title} (${badge.xpRequired.toLocaleString("fr-FR")} XP) - ${badge.questDescription}`}
      className={`relative rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs border ${sizeClasses} ${
        badge.unlocked
          ? "bg-gradient-to-br from-[#18181B] via-stone-800 to-[#D96B43] text-white border-[#D96B43]/60 hover:scale-105"
          : "bg-stone-200 dark:bg-stone-800 text-stone-400 border-stone-300 dark:border-stone-700 opacity-40"
      }`}
    >
      {badge.unlocked ? (
        renderBadgeIcon(badge.iconKey, size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4")
      ) : (
        <Lock className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      )}
    </div>
  );
};

export const BadgeDisplay: React.FC<{
  earnedBadges?: string[];
  showAll?: boolean;
  compact?: boolean;
}> = ({ compact = false }) => {
  const badges = getStoredQuestBadges();
  const unlocked = badges.filter((b) => b.unlocked);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {unlocked.slice(0, 4).map((b) => (
          <MilitaryMedalEmblem key={b.id} badge={b} size="sm" />
        ))}
        {unlocked.length > 4 && (
          <span className="text-[10px] font-mono font-bold text-stone-500">
            +{unlocked.length - 4}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
      {badges.map((b) => (
        <MilitaryMedalEmblem key={b.id} badge={b} size="md" />
      ))}
    </div>
  );
};
