export interface PricingTier {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "freemium",
    name: "Découverte",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "L'essentiel pour tester l'IA",
    features: [
      "5 QCM générés par jour",
      "1 résumé structuré par jour",
      "Statistiques de base",
      "Accès à la communauté (lecture)",
    ],
    cta: "Créer un compte gratuit",
    highlight: false,
  },
  {
    id: "premium",
    name: "Premium",
    monthlyPrice: 2500,
    yearlyPrice: 22500, // 2500 * 12 * 0.75 (25% discount)
    description: "Idéal pour valider ses années",
    features: [
      "QCM générés en illimité",
      "Résumés et fiches illimités",
      "Génération automatique de Flashcards",
      "Mode Examen chronométré",
      "Mode Duel multijoueur",
      "Assistant MOR (Tuteur IA)",
    ],
    cta: "Passer Premium",
    highlight: true,
  },
  {
    id: "pro", // Excellence in some parts of the UI
    name: "Excellence",
    monthlyPrice: 5000,
    yearlyPrice: 45000, // 5000 * 12 * 0.75 (25% discount)
    description: "Pour préparer les ECNi / Concours",
    features: [
      "Toutes les fonctionnalités Premium",
      "Priorité absolue sur l'Agent MOR",
      "Analyse prédictive de réussite",
      "Génération de cas cliniques complexes",
      "Support prioritaire 7j/7",
    ],
    cta: "Passer Excellence",
    highlight: false,
  },
];
