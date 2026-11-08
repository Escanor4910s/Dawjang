import { untypedTable } from "@/lib/untypedDb";
import { useState, useEffect } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Sparkles, LibraryBig, Lock, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CARDS_CATALOG } from "@/hooks/useCardUnlock";
import { AnimatedBanner } from "@/components/AnimatedBanner";

interface Card {
  id: string;
  title: string;
  description?: string;
  rarity: "commune" | "rare" | "epique" | "legendaire" | string;
  imageUrl?: string;
  unlocked: boolean;
  unlockedAt?: Date;
}

const getCardImage = (id: string) => {
  const images: Record<string, string> = {
    c1: "https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&q=80&w=800",
    c2: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=800",
    c3: "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=800",
    c4: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800",
    c5: "https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&q=80&w=800",
    c6: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&q=80&w=800"
  };
  return images[id] || "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&q=80&w=800";
};

const getCardDescription = (id: string) => {
  const descriptions: Record<string, string> = {
    c1: "Symbole de l'endurance. Obtenu après une série de 10 jours de révision sans faille.",
    c2: "La lame fine du diagnostic parfait. 100% de réussite sur un QCM d'Anatomie difficile.",
    c3: "Le savoir encyclopédique. Obtenu en complétant 50 chapitres de révision.",
    c4: "Engagement initial envers le soin et l'éthique.",
    c5: "La vision au-delà de la surface. Résoudre 5 ECOS de suite avec succès.",
    c6: "Maîtrise absolue de la pharmacologie clinique."
  };
  return descriptions[id] || "Artéfact mystérieux.";
};

const rarityConfig = {
  commune: { color: "text-slate-400", border: "border-slate-400", bg: "bg-slate-400/10", shadow: "shadow-slate-400/20" },
  rare: { color: "text-blue-400", border: "border-blue-400", bg: "bg-blue-400/10", shadow: "shadow-blue-400/20" },
  epique: { color: "text-purple-500", border: "border-purple-500", bg: "bg-purple-500/10", shadow: "shadow-purple-500/30" },
  legendaire: { color: "text-amber-500", border: "border-amber-500", bg: "bg-amber-500/10", shadow: "shadow-amber-500/40" },
};

const HolographicCard = ({ card }: { card: Card }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-100, 100], [15, -15]);
  const rotateY = useTransform(x, [-100, 100], [-15, 15]);

  const glareX = useTransform(x, [-100, 100], [100, -100]);
  const glareY = useTransform(y, [-100, 100], [100, -100]);
  const glareOpacity = useTransform(x, [-100, 100], [0.1, 0.5]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    x.set(event.clientX - centerX);
    y.set(event.clientY - centerY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const isLegendary = card.rarity === "legendaire";
  const rarityStyle = rarityConfig[card.rarity];

  if (!card.unlocked) {
    return (
      <div className="w-full aspect-[2.5/3.5] bg-black/5 dark:bg-white/5 rounded-3xl border-2 border-dashed border-black/10 dark:border-white/10 flex flex-col items-center justify-center p-6 text-center shadow-inner opacity-70">
        <Lock className="w-12 h-12 text-[#888888] mb-4 opacity-50" />
        <h3 className="text-sm font-black text-[#888888] uppercase tracking-widest mb-2">Carte Verrouillée</h3>
        <p className="text-[10px] text-[#888888] font-medium leading-relaxed">{card.description}</p>
      </div>
    );
  }

  return (
    <motion.div
      style={{ perspective: 1000 }}
      className="w-full aspect-[2.5/3.5] relative group cursor-pointer"
    >
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={`w-full h-full relative rounded-3xl border-4 ${rarityStyle.border} ${rarityStyle.shadow} overflow-hidden bg-black transition-all duration-300`}
      >
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-60 group-hover:opacity-80 transition-opacity duration-500" 
          style={{ backgroundImage: `url(${card.imageUrl})` }}
        />
        
        {/* Holographic Glare Effect */}
        <motion.div
          style={{
            x: glareX,
            y: glareY,
            opacity: glareOpacity,
          }}
          className="absolute inset-[-100%] bg-gradient-to-tr from-transparent via-white to-transparent opacity-20 rotate-45 pointer-events-none mix-blend-overlay"
        />

        {/* Shiny Noise Layer for Legendary */}
        {isLegendary && (
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-color-dodge pointer-events-none" />
        )}

        {/* Content Overlay */}
        <div style={{ transform: "translateZ(40px)" }} className="absolute inset-0 p-6 flex flex-col justify-between z-10">
          <div className="flex justify-between items-start">
            <div className={`px-3 py-1 rounded-full ${rarityStyle.bg} border ${rarityStyle.border} backdrop-blur-md`}>
              <span className={`text-[10px] font-black uppercase tracking-widest ${rarityStyle.color}`}>
                {card.rarity}
              </span>
            </div>
            {isLegendary && <Crown className="w-6 h-6 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,1)]" />}
          </div>

          <div className="mt-auto">
            <h2 className="text-2xl font-serif font-black text-white leading-tight mb-2 drop-shadow-lg">
              {card.title}
            </h2>
            <div className="h-px w-full bg-gradient-to-r from-white/50 to-transparent mb-3" />
            <p className="text-xs text-white/80 font-medium leading-relaxed drop-shadow-md">
              {card.description}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function Collection() {
  const [activeTab, setActiveTab] = useState<"toutes" | "legendaire">("toutes");
  const [userCards, setUserCards] = useState<Card[]>([]);

  useEffect(() => {
    const loadUnlockedCards = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rawUnlocked } = await untypedTable("user_unlocked_cards")
        .select("card_id, unlocked_at")
        .eq("user_id", user.id);

      const unlocked = (rawUnlocked as Array<{ card_id: string; unlocked_at: string }> | null) || [];
      const unlockedIds = new Set(unlocked.map(u => u.card_id));

      const mergedCards: Card[] = CARDS_CATALOG.map(catalogCard => {
        const unlockData = unlocked.find(u => u.card_id === catalogCard.id);
        return {
          id: catalogCard.id,
          title: catalogCard.title,
          description: getCardDescription(catalogCard.id),
          rarity: catalogCard.rarity,
          imageUrl: getCardImage(catalogCard.id),
          unlocked: unlockedIds.has(catalogCard.id),
          unlockedAt: unlockData ? new Date(unlockData.unlocked_at) : undefined
        };
      });

      setUserCards(mergedCards);
    };

    loadUnlockedCards();
  }, []);

  const displayedCards = activeTab === "toutes" ? userCards : userCards.filter(c => c.rarity === "legendaire");

  return (
    <div className="w-full max-w-7xl mx-auto space-y-12">
      <div className="w-full relative z-20 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] rounded-[3rem] overflow-hidden">
        <AnimatedBanner 
          title={<>Le Grimoire <span className="font-serif italic text-white/90">des Savoirs</span></>}
          subtitle="Retrouvez ici vos artefacts d'apprentissage. Ces cartes holographiques rares récompensent votre assiduité et votre excellence clinique."
          rightWidgets={
            <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[1.5rem] p-4 flex flex-col items-center justify-center min-w-[150px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] text-white">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 block mb-1">Cartes Débloquées</span>
              <div className="text-3xl font-serif font-black">
                {userCards.filter(c => c.unlocked).length} <span className="text-xl text-white/50">/ {userCards.length}</span>
              </div>
            </div>
          }
        />
      </div>

      <div className="flex gap-4 border-b border-black/5 dark:border-white/5 pb-4 px-2">
        <button 
          onClick={() => setActiveTab("toutes")}
          className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTab === "toutes" ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111] shadow-lg' : 'text-[#888888] hover:bg-black/5 dark:hover:bg-white/5'}`}
        >
          Toutes les cartes
        </button>
        <button 
          onClick={() => setActiveTab("legendaire")}
          className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeTab === "legendaire" ? 'bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'text-[#888888] hover:bg-amber-500/10 hover:text-amber-500'}`}
        >
          Légendaires
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 px-2">
        {displayedCards.map((card) => (
          <HolographicCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
