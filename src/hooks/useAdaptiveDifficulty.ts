/**
 * useAdaptiveDifficulty.ts
 * ────────────────────────────────────────────────────────────
 * Adaptive difficulty engine for QCM generation.
 *
 * Analyzes past quiz performance per course/topic to recommend
 * the optimal difficulty level for the next quiz session.
 *
 * Uses an Elo-inspired rating system:
 *   - Each correct answer raises the student's "skill score"
 *   - Each incorrect answer lowers it
 *   - The recommended difficulty is derived from this score
 * ────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DifficultyLevel = "facile" | "moyen" | "difficile" | "expert";

export interface TopicPerformance {
  courseId: string;
  courseTitle: string;
  totalAttempts: number;
  averageScore: number; // 0-100
  skillScore: number;   // Elo-like, starts at 1000
  recommendedDifficulty: DifficultyLevel;
  trend: "improving" | "stable" | "declining";
  weakTopics: string[]; // Questions most often failed
}

export interface AdaptiveState {
  globalSkillScore: number;
  globalDifficulty: DifficultyLevel;
  topicPerformances: TopicPerformance[];
  loading: boolean;
}

const INITIAL_SKILL = 1000;

function scoreToLevel(skill: number): DifficultyLevel {
  if (skill >= 1400) return "expert";
  if (skill >= 1200) return "difficile";
  if (skill >= 1000) return "moyen";
  return "facile";
}

function computeTrend(scores: number[]): "improving" | "stable" | "declining" {
  if (scores.length < 3) return "stable";
  const recent = scores.slice(-3);
  const older = scores.slice(-6, -3);
  if (older.length === 0) return "stable";
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const diff = recentAvg - olderAvg;
  if (diff > 5) return "improving";
  if (diff < -5) return "declining";
  return "stable";
}

export function useAdaptiveDifficulty() {
  const [state, setState] = useState<AdaptiveState>({
    globalSkillScore: INITIAL_SKILL,
    globalDifficulty: "moyen",
    topicPerformances: [],
    loading: true,
  });

  const analyze = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all quiz results with course info
      const { data: results, error } = await supabase
        .from("quiz_results")
        .select("course_id, score, total_questions, answers, created_at, courses(title)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!results || results.length === 0) {
        setState({
          globalSkillScore: INITIAL_SKILL,
          globalDifficulty: "facile",
          topicPerformances: [],
          loading: false,
        });
        return;
      }

      // Group by course
      const courseMap = new Map<string, {
        title: string;
        scores: number[];
        totalCorrect: number;
        totalQuestions: number;
        failedQuestions: Map<string, number>;
      }>();

      for (const r of results) {
        const cid = r.course_id;
        const title = (r as any).courses?.title || "Sans titre";
        if (!courseMap.has(cid)) {
          courseMap.set(cid, { title, scores: [], totalCorrect: 0, totalQuestions: 0, failedQuestions: new Map() });
        }
        const entry = courseMap.get(cid)!;
        const pct = r.total_questions > 0 ? Math.round((r.score / r.total_questions) * 100) : 0;
        entry.scores.push(pct);
        entry.totalCorrect += r.score;
        entry.totalQuestions += r.total_questions;

        // Track weak questions
        const answers = r.answers as any[];
        if (Array.isArray(answers)) {
          for (const a of answers) {
            if (!a.correct && a.question) {
              const q = a.question.substring(0, 80);
              entry.failedQuestions.set(q, (entry.failedQuestions.get(q) || 0) + 1);
            }
          }
        }
      }

      // Compute per-topic performance
      const topicPerformances: TopicPerformance[] = [];
      let globalSkill = INITIAL_SKILL;

      for (const [courseId, data] of courseMap) {
        const avgScore = data.totalQuestions > 0
          ? Math.round((data.totalCorrect / data.totalQuestions) * 100)
          : 0;

        // Elo-like adjustment: +/- based on distance from 50%
        let skill = INITIAL_SKILL;
        for (const pct of data.scores) {
          const expected = 0.5;
          const actual = pct / 100;
          const kFactor = 32;
          skill += kFactor * (actual - expected);
        }
        skill = Math.max(600, Math.min(1600, Math.round(skill)));

        // Top 3 most-failed questions
        const weakTopics = Array.from(data.failedQuestions.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([q]) => q);

        topicPerformances.push({
          courseId,
          courseTitle: data.title,
          totalAttempts: data.scores.length,
          averageScore: avgScore,
          skillScore: skill,
          recommendedDifficulty: scoreToLevel(skill),
          trend: computeTrend(data.scores),
          weakTopics,
        });
      }

      // Global skill = weighted average
      if (topicPerformances.length > 0) {
        const totalAttempts = topicPerformances.reduce((s, t) => s + t.totalAttempts, 0);
        globalSkill = Math.round(
          topicPerformances.reduce((s, t) => s + t.skillScore * t.totalAttempts, 0) / totalAttempts
        );
      }

      setState({
        globalSkillScore: globalSkill,
        globalDifficulty: scoreToLevel(globalSkill),
        topicPerformances: topicPerformances.sort((a, b) => b.totalAttempts - a.totalAttempts),
        loading: false,
      });
    } catch (err) {
      console.error("Adaptive difficulty error:", err);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    analyze();
  }, [analyze]);

  const getDifficultyForCourse = useCallback((courseId: string): DifficultyLevel => {
    const topic = state.topicPerformances.find(t => t.courseId === courseId);
    return topic?.recommendedDifficulty ?? state.globalDifficulty;
  }, [state]);

  return {
    ...state,
    getDifficultyForCourse,
    refresh: analyze,
  };
}
