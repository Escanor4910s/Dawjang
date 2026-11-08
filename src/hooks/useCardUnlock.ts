import { useState, useCallback } from "react";
import { untypedTable } from "@/lib/untypedDb";
import { toast } from "sonner";
import { Sparkles, Crown } from "lucide-react";

// On importe les cartes depuis un fichier de configuration, ou on les définit ici.
export const CARDS_CATALOG = [
  { id: "c1", rarity: "legendaire", title: "Le Cœur Inépuisable" },
  { id: "c2", rarity: "epique", title: "Le Scalpel de Précision" },
  { id: "c3", rarity: "rare", title: "Atlas d'Avicenne" },
  { id: "c4", rarity: "commune", title: "La Flamme d'Hippocrate" },
  { id: "c5", rarity: "epique", title: "L'Œil de Galien" },
  { id: "c6", rarity: "legendaire", title: "L'Élixir Universel" }
];

export const useCardUnlock = () => {
  const [isChecking, setIsChecking] = useState(false);

  const checkAndUnlockCard = useCallback(async (userId: string, cardId: string) => {
    setIsChecking(true);
    try {
      // 1. Vérifier si la carte est déjà débloquée
      const { data: existing, error: fetchError } = await untypedTable("user_unlocked_cards")
        .select("id")
        .eq("user_id", userId)
        .eq("card_id", cardId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      // Si la carte est déjà débloquée, on s'arrête là
      if (existing) {
        setIsChecking(false);
        return false;
      }

      // 2. Insérer la nouvelle carte
      const { error: insertError } = await untypedTable("user_unlocked_cards")
        .insert({ user_id: userId, card_id: cardId });

      if (insertError) throw insertError;

      // 3. Récupérer les infos de la carte pour la notification
      const card = CARDS_CATALOG.find(c => c.id === cardId);
      
      if (card) {
        toast.success(`Nouvelle carte débloquée !`, {
          description: `Vous avez obtenu : ${card.title} (${card.rarity})`,
          icon: card.rarity === "legendaire" ? '👑' : '✨',
          duration: 6000,
          className: card.rarity === "legendaire" ? "bg-amber-500/10 border-amber-500 text-amber-500" : ""
        });
      }

      setIsChecking(false);
      return true;

    } catch (err) {
      console.error("Erreur lors du déblocage de la carte :", err);
      setIsChecking(false);
      return false;
    }
  }, []);

  return { checkAndUnlockCard, isChecking };
};
