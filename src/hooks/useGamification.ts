import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Badge definitions - expanded with more badges and conditions
export const BADGES = {
  first_quiz: {
    id: 'first_quiz',
    name: 'Premier Pas',
    description: 'Complétez votre premier QCM',
    condition: 'Complétez 1 QCM',
    icon: '🎯',
    requirement: 1,
    type: 'quizzes'
  },
  quiz_master_10: {
    id: 'quiz_master_10',
    name: 'Apprenti',
    description: 'Complétez 10 QCM',
    condition: 'Complétez 10 QCM au total',
    icon: '📚',
    requirement: 10,
    type: 'quizzes'
  },
  quiz_master_25: {
    id: 'quiz_master_25',
    name: 'Studieux',
    description: 'Complétez 25 QCM',
    condition: 'Complétez 25 QCM au total',
    icon: '📖',
    requirement: 25,
    type: 'quizzes'
  },
  quiz_master_50: {
    id: 'quiz_master_50',
    name: 'Expert',
    description: 'Complétez 50 QCM',
    condition: 'Complétez 50 QCM au total',
    icon: '🏆',
    requirement: 50,
    type: 'quizzes'
  },
  quiz_master_100: {
    id: 'quiz_master_100',
    name: 'Maître',
    description: 'Complétez 100 QCM',
    condition: 'Complétez 100 QCM au total',
    icon: '👑',
    requirement: 100,
    type: 'quizzes'
  },
  quiz_master_200: {
    id: 'quiz_master_200',
    name: 'Légende',
    description: 'Complétez 200 QCM',
    condition: 'Complétez 200 QCM au total',
    icon: '🌠',
    requirement: 200,
    type: 'quizzes'
  },
  streak_3: {
    id: 'streak_3',
    name: 'Régulier',
    description: '3 jours consécutifs',
    condition: 'Étudiez 3 jours de suite',
    icon: '🔥',
    requirement: 3,
    type: 'streak'
  },
  streak_7: {
    id: 'streak_7',
    name: 'Dévoué',
    description: '7 jours consécutifs',
    condition: 'Étudiez 7 jours de suite',
    icon: '⚡',
    requirement: 7,
    type: 'streak'
  },
  streak_14: {
    id: 'streak_14',
    name: 'Tenace',
    description: '14 jours consécutifs',
    condition: 'Étudiez 14 jours de suite',
    icon: '💪',
    requirement: 14,
    type: 'streak'
  },
  streak_30: {
    id: 'streak_30',
    name: 'Inarrêtable',
    description: '30 jours consécutifs',
    condition: 'Étudiez 30 jours de suite',
    icon: '💎',
    requirement: 30,
    type: 'streak'
  },
  streak_60: {
    id: 'streak_60',
    name: 'Machine',
    description: '60 jours consécutifs',
    condition: 'Étudiez 60 jours de suite',
    icon: '🤖',
    requirement: 60,
    type: 'streak'
  },
  perfect_score: {
    id: 'perfect_score',
    name: 'Perfection',
    description: 'Obtenez 100% à un QCM',
    condition: 'Score parfait sur un QCM',
    icon: '⭐',
    requirement: 1,
    type: 'perfect'
  },
  perfect_score_5: {
    id: 'perfect_score_5',
    name: 'Brillant',
    description: '5 scores parfaits',
    condition: 'Obtenez 100% sur 5 QCM différents',
    icon: '✨',
    requirement: 5,
    type: 'perfect'
  },
  flashcard_50: {
    id: 'flashcard_50',
    name: 'Mémorisateur',
    description: 'Révisez 50 flashcards',
    condition: 'Révisez 50 flashcards au total',
    icon: '🧠',
    requirement: 50,
    type: 'flashcards'
  },
  flashcard_200: {
    id: 'flashcard_200',
    name: 'Mémoire vive',
    description: 'Révisez 200 flashcards',
    condition: 'Révisez 200 flashcards au total',
    icon: '🎓',
    requirement: 200,
    type: 'flashcards'
  },
  level_5: {
    id: 'level_5',
    name: 'Niveau 5',
    description: 'Atteignez le niveau 5',
    condition: 'Accumulez assez d\'XP pour le niveau 5',
    icon: '🌟',
    requirement: 5,
    type: 'level'
  },
  level_10: {
    id: 'level_10',
    name: 'Niveau 10',
    description: 'Atteignez le niveau 10',
    condition: 'Accumulez assez d\'XP pour le niveau 10',
    icon: '🚀',
    requirement: 10,
    type: 'level'
  },
  level_20: {
    id: 'level_20',
    name: 'Niveau 20',
    description: 'Atteignez le niveau 20',
    condition: 'Accumulez assez d\'XP pour le niveau 20',
    icon: '🏅',
    requirement: 20,
    type: 'level'
  },
  level_30: {
    id: 'level_30',
    name: 'Niveau 30',
    description: 'Atteignez le niveau 30',
    condition: 'Accumulez assez d\'XP pour le niveau 30',
    icon: '💫',
    requirement: 30,
    type: 'level'
  },
  early_bird: {
    id: 'early_bird',
    name: 'Lève-tôt',
    description: 'Premier QCM de la journée',
    condition: 'Complétez un QCM avant 8h du matin',
    icon: '🌅',
    requirement: 1,
    type: 'special'
  },
  night_owl: {
    id: 'night_owl',
    name: 'Noctambule',
    description: 'QCM apres minuit',
    condition: 'Completez un QCM apres minuit',
    icon: '🦉',
    requirement: 1,
    type: 'special'
  },
  duel_winner: {
    id: 'duel_winner',
    name: 'Duelliste',
    description: 'Gagnez votre premier duel',
    condition: 'Remportez 1 duel',
    icon: '⚔️',
    requirement: 1,
    type: 'special'
  },
  duel_master: {
    id: 'duel_master',
    name: 'Champion',
    description: 'Gagnez 10 duels',
    condition: 'Remportez 10 duels',
    icon: '🏆',
    requirement: 10,
    type: 'special'
  },
} as const;

export type BadgeId = keyof typeof BADGES;

// XP per action
export const XP_VALUES = {
  quiz_completed: 30,
  perfect_score_bonus: 60,
  streak_bonus: 15,
  flashcard_reviewed: 3,
};

// SLOWER level progression: XP = level^2 * 150
export const getLevelFromXP = (xp: number): number => {
  return Math.floor(Math.sqrt(xp / 150)) + 1;
};

export const getXPForLevel = (level: number): number => {
  return Math.pow(level - 1, 2) * 150;
};

export const getXPProgressToNextLevel = (xp: number): number => {
  const currentLevel = getLevelFromXP(xp);
  const currentLevelXP = getXPForLevel(currentLevel);
  const nextLevelXP = getXPForLevel(currentLevel + 1);
  return ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
};

export interface GamificationData {
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  totalQuizzesCompleted: number;
  totalFlashcardsReviewed: number;
  earnedBadges: BadgeId[];
}

export interface GamificationEvent {
  type: 'xp_gained' | 'level_up' | 'badge_earned' | 'streak_updated';
  value?: number;
  badgeId?: BadgeId;
  newLevel?: number;
}

export const useGamification = () => {
  const [data, setData] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<GamificationEvent[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      let { data: gamificationData, error } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Row should be created by handle_new_user_gamification trigger
        // If missing, try RPC to init it
        const { error: rpcErr } = await supabase.rpc('record_gamification_activity', { p_action_type: 'init' });
        if (rpcErr) {
          console.error('Could not init gamification:', rpcErr);
          setLoading(false);
          return;
        }
        // Re-fetch after init
        const { data: retryData } = await supabase
          .from('user_gamification')
          .select('*')
          .eq('user_id', user.id)
          .single();
        gamificationData = retryData;
      } else if (error) {
        throw error;
      }

      const { data: badgesData } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', user.id);

      const earnedBadges = (badgesData || []).map(b => b.badge_id as BadgeId);

      setData({
        xp: gamificationData?.xp || 0,
        level: getLevelFromXP(gamificationData?.xp || 0),
        currentStreak: gamificationData?.current_streak || 0,
        longestStreak: gamificationData?.longest_streak || 0,
        totalQuizzesCompleted: gamificationData?.total_quizzes_completed || 0,
        totalFlashcardsReviewed: gamificationData?.total_flashcards_reviewed || 0,
        earnedBadges
      });
    } catch (error) {
      console.error('Error fetching gamification data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addXP = async (amount: number): Promise<GamificationEvent[]> => {
    const newEvents: GamificationEvent[] = [];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !data) return newEvents;

      const oldLevel = data.level;
      const newXP = data.xp + amount;
      const newLevel = getLevelFromXP(newXP);

      // Use secure RPC instead of direct update
      await supabase.rpc('increment_user_xp', { p_xp_amount: amount, p_action_type: 'quiz_completed' });

      newEvents.push({ type: 'xp_gained', value: amount });

      if (newLevel > oldLevel) {
        newEvents.push({ type: 'level_up', newLevel });
        
        // Check all level badges
        for (const lvl of [5, 10, 20, 30]) {
          const badgeId = `level_${lvl}` as BadgeId;
          if (newLevel >= lvl && !data.earnedBadges.includes(badgeId)) {
            await awardBadge(user.id, badgeId);
            newEvents.push({ type: 'badge_earned', badgeId });
          }
        }
      }

      setData(prev => prev ? { ...prev, xp: newXP, level: newLevel } : prev);
      setEvents(prev => [...prev, ...newEvents]);
    } catch (error) {
      console.error('Error adding XP:', error);
    }

    return newEvents;
  };

  const awardBadge = async (_userId: string, badgeId: BadgeId): Promise<boolean> => {
    try {
      // Server-validated: the RPC checks eligibility before inserting.
      const { data: awarded, error } = await supabase.rpc('award_badge', { p_badge_id: badgeId });
      if (error) throw error;
      if (!awarded) return false;

      setData(prev => prev ? {
        ...prev,
        earnedBadges: [...prev.earnedBadges, badgeId]
      } : prev);

      return true;
    } catch (error) {
      console.error('Error awarding badge:', error);
      return false;
    }
  };

  const checkAndAwardBadge = async (
    userId: string, 
    badgeId: BadgeId, 
    currentValue: number, 
    requiredValue: number
  ): Promise<boolean> => {
    if (currentValue >= requiredValue && !data?.earnedBadges.includes(badgeId)) {
      const awarded = await awardBadge(userId, badgeId);
      if (awarded) {
        setEvents(prev => [...prev, { type: 'badge_earned', badgeId }]);
      }
      return awarded;
    }
    return false;
  };

  const recordQuizCompletion = async (score: number, totalQuestions: number): Promise<GamificationEvent[]> => {
    const newEvents: GamificationEvent[] = [];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !data) return newEvents;

      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();
      const newQuizCount = data.totalQuizzesCompleted + 1;
      
      // Calculate streak
      let newStreak = data.currentStreak;
      const { data: gamData } = await supabase
        .from('user_gamification')
        .select('last_activity_date')
        .eq('user_id', user.id)
        .single();
      
      const lastDate = gamData?.last_activity_date;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastDate === yesterdayStr) {
        newStreak += 1;
      } else if (lastDate !== today) {
        newStreak = 1;
      }

      const newLongestStreak = Math.max(data.longestStreak, newStreak);

      // Use secure RPC instead of direct update
      await supabase.rpc('record_gamification_activity', { p_action_type: 'quiz_completed' });

      let xpGained = XP_VALUES.quiz_completed;
      
      if (score === totalQuestions) {
        xpGained += XP_VALUES.perfect_score_bonus;
        await checkAndAwardBadge(user.id, 'perfect_score', 1, 1);
      }

      if (newStreak > 1) {
        xpGained += XP_VALUES.streak_bonus * Math.min(newStreak, 7);
      }

      // Special time-based badges
      if (hour < 8) {
        await checkAndAwardBadge(user.id, 'early_bird', 1, 1);
      }
      if (hour >= 0 && hour < 5) {
        await checkAndAwardBadge(user.id, 'night_owl', 1, 1);
      }

      const xpEvents = await addXP(xpGained);
      newEvents.push(...xpEvents);

      // Check quiz badges
      await checkAndAwardBadge(user.id, 'first_quiz', newQuizCount, 1);
      await checkAndAwardBadge(user.id, 'quiz_master_10', newQuizCount, 10);
      await checkAndAwardBadge(user.id, 'quiz_master_25', newQuizCount, 25);
      await checkAndAwardBadge(user.id, 'quiz_master_50', newQuizCount, 50);
      await checkAndAwardBadge(user.id, 'quiz_master_100', newQuizCount, 100);
      await checkAndAwardBadge(user.id, 'quiz_master_200', newQuizCount, 200);

      // Check streak badges
      await checkAndAwardBadge(user.id, 'streak_3', newStreak, 3);
      await checkAndAwardBadge(user.id, 'streak_7', newStreak, 7);
      await checkAndAwardBadge(user.id, 'streak_14', newStreak, 14);
      await checkAndAwardBadge(user.id, 'streak_30', newStreak, 30);
      await checkAndAwardBadge(user.id, 'streak_60', newStreak, 60);

      if (newStreak !== data.currentStreak) {
        newEvents.push({ type: 'streak_updated', value: newStreak });
      }

      setData(prev => prev ? {
        ...prev,
        totalQuizzesCompleted: newQuizCount,
        currentStreak: newStreak,
        longestStreak: newLongestStreak
      } : prev);

    } catch (error) {
      console.error('Error recording quiz completion:', error);
    }

    return newEvents;
  };

  const clearEvents = () => setEvents([]);

  return {
    data,
    loading,
    events,
    clearEvents,
    addXP,
    recordQuizCompletion,
    refetch: fetchData
  };
};
