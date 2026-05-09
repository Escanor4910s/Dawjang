export interface SM2Params {
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review: string; // ISO date string (YYYY-MM-DD)
}

/**
 * SM-2 Algorithm implementation
 * @param quality - Response quality (0-5):
 *   0: Complete blackout
 *   1: Incorrect, but remembered upon seeing answer
 *   2: Incorrect, but easy to recall once shown
 *   3: Correct with serious difficulty
 *   4: Correct with some hesitation
 *   5: Perfect response
 */
export function calculateSM2(
  quality: number,
  currentParams: SM2Params
): SM2Params {
  const { ease_factor, interval, repetitions } = currentParams;

  let newEF = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEF < 1.3) newEF = 1.3;

  let newInterval: number;
  let newReps: number;

  if (quality < 3) {
    // Failed: reset
    newReps = 0;
    newInterval = 0;
  } else {
    newReps = repetitions + 1;
    if (newReps === 1) {
      newInterval = 1;
    } else if (newReps === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * newEF);
    }
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + (newInterval || 1));
  const next_review = nextDate.toISOString().split('T')[0];

  return {
    ease_factor: Math.round(newEF * 100) / 100,
    interval: newInterval,
    repetitions: newReps,
    next_review,
  };
}

export function getQualityLabel(quality: number): string {
  switch (quality) {
    case 0: return "Aucun souvenir";
    case 1: return "Très difficile";
    case 2: return "Difficile";
    case 3: return "Correct (difficile)";
    case 4: return "Bien";
    case 5: return "Parfait";
    default: return "";
  }
}

export function getQualityColor(quality: number): string {
  if (quality <= 1) return "text-destructive";
  if (quality <= 2) return "text-orange-500";
  if (quality <= 3) return "text-yellow-500";
  if (quality <= 4) return "text-green-500";
  return "text-emerald-600";
}
