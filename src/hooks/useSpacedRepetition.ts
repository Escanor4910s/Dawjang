/**
 * useSpacedRepetition.ts
 * ────────────────────────────────────────────────────────────
 * SM-2 Algorithm for Spaced Repetition (SuperMemo 2)
 * 
 * Quality rating (0-5):
 *   0 - Complete blackout
 *   1 - Incorrect; correct answer remembered upon seeing it
 *   2 - Incorrect; but correct answer seemed easy to recall
 *   3 - Correct; but with significant difficulty
 *   4 - Correct; after hesitation
 *   5 - Perfect response
 * ────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ReviewCard {
  id: string;
  question: string;
  answer: string;
  course_id: string;
  courseName: string;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review: string;
}

export interface ReviewStats {
  dueToday: number;
  dueTomorrow: number;
  totalCards: number;
  masteredCards: number;  // cards with interval > 21 days
  streakDays: number;
}

export interface DailyForecast {
  date: string;
  label: string;
  count: number;
}

function computeSM2(
  quality: number,
  oldEase: number,
  oldInterval: number,
  oldReps: number
): { easeFactor: number; interval: number; repetitions: number } {
  // Clamp quality
  const q = Math.max(0, Math.min(5, quality));

  let easeFactor = oldEase + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  let interval: number;
  let repetitions: number;

  if (q < 3) {
    // Failed — reset
    repetitions = 0;
    interval = 1;
  } else {
    repetitions = oldReps + 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(oldInterval * easeFactor);
    }
  }

  return { easeFactor, interval, repetitions };
}

export function useSpacedRepetition() {
  const [dueCards, setDueCards] = useState<ReviewCard[]>([]);
  const [stats, setStats] = useState<ReviewStats>({
    dueToday: 0,
    dueTomorrow: 0,
    totalCards: 0,
    masteredCards: 0,
    streakDays: 0,
  });
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDueCards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date().toISOString();

      // Fetch cards due for review (next_review <= now)
      const { data: dueData, error: dueError } = await supabase
        .from("flashcards")
        .select("id, question, answer, course_id, ease_factor, interval, repetitions, next_review, courses(title)")
        .eq("user_id", user.id)
        .lte("next_review", now)
        .order("next_review", { ascending: true });

      if (dueError) throw dueError;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cards: ReviewCard[] = (dueData || []).map((c: any) => ({
        id: c.id,
        question: c.question,
        answer: c.answer,
        course_id: c.course_id,
        courseName: c.courses?.title || "Sans cours",
        ease_factor: c.ease_factor ?? 2.5,
        interval: c.interval ?? 0,
        repetitions: c.repetitions ?? 0,
        next_review: c.next_review,
      }));

      setDueCards(cards);

      // Fetch all cards for stats
      const { data: allData } = await supabase
        .from("flashcards")
        .select("id, interval, next_review")
        .eq("user_id", user.id);

      const allCards = allData || [];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const dueTomorrow = allCards.filter(c => {
        const nr = new Date(c.next_review);
        return nr > new Date() && nr <= tomorrow;
      }).length;

      setStats({
        dueToday: cards.length,
        dueTomorrow,
        totalCards: allCards.length,
        masteredCards: allCards.filter(c => c.interval > 21).length,
        streakDays: 0, // Could be computed from a separate streak table
      });

      // Build 7-day forecast
      const forecastData: DailyForecast[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);

        const count = allCards.filter(c => {
          const nr = new Date(c.next_review);
          return nr >= dayStart && nr <= dayEnd;
        }).length;

        const label = i === 0 ? "Aujourd'hui" : i === 1 ? "Demain" :
          d.toLocaleDateString("fr-FR", { weekday: "short" });

        forecastData.push({
          date: d.toISOString().split("T")[0],
          label,
          count,
        });
      }
      setForecast(forecastData);
    } catch (err) {
      console.error("Error fetching due cards:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDueCards();
  }, [fetchDueCards]);

  const reviewCard = useCallback(async (cardId: string, quality: number) => {
    const card = dueCards.find(c => c.id === cardId);
    if (!card) return;

    const { easeFactor, interval, repetitions } = computeSM2(
      quality,
      card.ease_factor,
      card.interval,
      card.repetitions
    );

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    const { error } = await supabase
      .from("flashcards")
      .update({
        ease_factor: easeFactor,
        interval,
        repetitions,
        next_review: nextReview.toISOString(),
      })
      .eq("id", cardId);

    if (!error) {
      // Remove from current due list
      setDueCards(prev => prev.filter(c => c.id !== cardId));
      setStats(prev => ({
        ...prev,
        dueToday: prev.dueToday - 1,
      }));
    }

    return !error;
  }, [dueCards]);

  return {
    dueCards,
    stats,
    forecast,
    loading,
    reviewCard,
    refreshCards: fetchDueCards,
  };
}
