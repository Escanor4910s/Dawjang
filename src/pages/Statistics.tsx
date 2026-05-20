import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Target, Clock, BookOpen, RefreshCw, ArrowLeft, Calendar, Flame, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useOnboarding } from "@/hooks/useOnboarding";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
} from "recharts";

interface QuizResult {
  id: string;
  course_id: string;
  score: number;
  total_questions: number;
  created_at: string;
}

interface Course {
  id: string;
  title: string;
}

interface CourseStats {
  courseId: string;
  courseName: string;
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  lastScore: number;
  evolution: { date: string; score: number; percentage: number }[];
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(142, 76%, 36%)", "hsl(217, 91%, 60%)"];

// Animated counter component
const AnimatedCounter = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const duration = 1200;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return <span ref={ref}>{count}{suffix}</span>;
};

const Statistics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);
  const [allResults, setAllResults] = useState<QuizResult[]>([]);
  const [timePeriod, setTimePeriod] = useState<"week" | "month" | "all">("all");
  const [globalStats, setGlobalStats] = useState({
    totalQuizzes: 0,
    averageScore: 0,
    bestScore: 0,
    totalTime: 0,
  });

  const { completeStep } = useOnboarding();

  useEffect(() => {
    completeStep("check_stats");
  }, [completeStep]);

  const fetchStatistics = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("id, title")
        .eq("user_id", user.id);

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      const { data: resultsData, error: resultsError } = await supabase
        .from("quiz_results")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (resultsError) throw resultsError;

      const { data: sessionsData } = await supabase
        .from("qcm_sessions")
        .select("time_elapsed, score, total_questions")
        .eq("user_id", user.id)
        .eq("status", "completed");

      const results = resultsData || [];
      setAllResults(results);
      const sessions = sessionsData || [];
      
      const totalQuizzes = results.length;
      const averageScore = totalQuizzes > 0
        ? results.reduce((acc, r) => acc + (r.score / r.total_questions) * 100, 0) / totalQuizzes
        : 0;
      const bestScore = totalQuizzes > 0
        ? Math.max(...results.map(r => (r.score / r.total_questions) * 100))
        : 0;
      const totalTime = sessions.reduce((acc, s) => acc + (s.time_elapsed || 0), 0);

      setGlobalStats({
        totalQuizzes,
        averageScore: Math.round(averageScore),
        bestScore: Math.round(bestScore),
        totalTime,
      });

      const courseStatsMap = new Map<string, CourseStats>();

      for (const course of coursesData || []) {
        const courseResults = results.filter(r => r.course_id === course.id);
        
        if (courseResults.length > 0) {
          const evolution = courseResults.map(r => ({
            date: new Date(r.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
            score: r.score,
            percentage: Math.round((r.score / r.total_questions) * 100),
          }));

          const avgScore = courseResults.reduce((acc, r) => acc + (r.score / r.total_questions) * 100, 0) / courseResults.length;
          const best = Math.max(...courseResults.map(r => (r.score / r.total_questions) * 100));
          const last = (courseResults[courseResults.length - 1].score / courseResults[courseResults.length - 1].total_questions) * 100;

          courseStatsMap.set(course.id, {
            courseId: course.id,
            courseName: course.title,
            totalAttempts: courseResults.length,
            averageScore: Math.round(avgScore),
            bestScore: Math.round(best),
            lastScore: Math.round(last),
            evolution,
          });
        }
      }

      setCourseStats(Array.from(courseStatsMap.values()));
    } catch (error) {
      console.error("Error fetching statistics:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les statistiques",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [navigate, toast]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  useRealtimeSubscription({
    table: "quiz_results",
    onUpdate: fetchStatistics,
  });

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  const filteredStats = selectedCourse === "all" 
    ? courseStats 
    : courseStats.filter(s => s.courseId === selectedCourse);

  const chartData = filteredStats.flatMap(s => 
    s.evolution.map(e => ({
      ...e,
      course: s.courseName.substring(0, 20),
    }))
  );

  const temporalData = useMemo(() => {
    if (allResults.length === 0) return [];

    const now = new Date();
    const filtered = allResults.filter(r => {
      const d = new Date(r.created_at);
      if (timePeriod === "week") {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
      }
      if (timePeriod === "month") {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return d >= monthAgo;
      }
      return true;
    });

    const grouped: Record<string, { scores: number[]; count: number }> = {};
    filtered.forEach(r => {
      const key = new Date(r.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
      if (!grouped[key]) grouped[key] = { scores: [], count: 0 };
      grouped[key].scores.push(Math.round((r.score / r.total_questions) * 100));
      grouped[key].count++;
    });

    return Object.entries(grouped).map(([date, data]) => ({
      date,
      score: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
      quizzes: data.count,
    }));
  }, [allResults, timePeriod]);

  const barChartData = courseStats.map(s => ({
    name: s.courseName.length > 12 ? s.courseName.substring(0, 12) + "…" : s.courseName,
    moyenne: s.averageScore,
    meilleur: s.bestScore,
  }));

  const pieData = [
    { name: "Excellent (≥80%)", value: courseStats.filter(s => s.averageScore >= 80).length },
    { name: "Bien (60-79%)", value: courseStats.filter(s => s.averageScore >= 60 && s.averageScore < 80).length },
    { name: "À améliorer (<60%)", value: courseStats.filter(s => s.averageScore < 60).length },
  ].filter(d => d.value > 0);

  // Radial data for the "wow" gauge
  const radialData = [
    { name: "Score", value: globalStats.averageScore, fill: "hsl(var(--primary))" },
  ];

  // Ebbinghaus Forgetting Curve Simulator (FSRS algorithm model)
  const ebbinghausData = useMemo(() => {
    return Array.from({ length: 15 }, (_, day) => {
      const t = day;
      const rNoReview = Math.round(100 * Math.exp(-t / 1.5));
      const rOneReview = t >= 1 ? Math.round(100 * Math.exp(-(t - 1) / 5)) : 100;
      const rThreeReviews = t >= 3 ? Math.round(100 * Math.exp(-(t - 3) / 18)) : 100;
      return {
        day: `Jour ${t}`,
        "Sans révision": rNoReview,
        "Avec 1 révision": rOneReview,
        "Avec 3 révisions (FSRS)": rThreeReviews,
      };
    });
  }, []);

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
    }),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dashboard bg-doodle-watermark flex items-center justify-center relative">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          className="text-center relative z-10"
        >
          <BarChart3 className="h-16 w-16 text-primary mx-auto mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Chargement des statistiques...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dashboard text-foreground bg-doodle-watermark font-sans px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-8 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="max-w-[1400px] mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 sm:mb-12 gap-4"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="h-12 w-12 rounded-full border-border hover:bg-muted text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-foreground flex items-center gap-2 sm:gap-3">
                <BarChart3 className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                Statistiques
              </h1>
              <p className="text-sm font-medium text-muted-foreground mt-2">Votre progression détaillée</p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchStatistics} className="gap-2 w-full sm:w-auto h-12 px-6 rounded-full border-border hover:bg-muted text-foreground font-medium shadow-sm">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-10">
          {[
            { icon: BookOpen, label: "Quiz complétés", value: globalStats.totalQuizzes, suffix: "", color: "text-primary", bg: "bg-primary/10" },
            { icon: Target, label: "Score moyen", value: globalStats.averageScore, suffix: "%", color: "text-success", bg: "bg-success/10" },
            { icon: TrendingUp, label: "Meilleur score", value: globalStats.bestScore, suffix: "%", color: "text-warning", bg: "bg-warning/10" },
            { icon: Clock, label: "Temps total", value: null, suffix: "", color: "text-muted-foreground", bg: "bg-muted" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
            >
              <Card className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] overflow-hidden group hover:shadow-md transition-shadow duration-300">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <motion.div
                      whileHover={{ scale: 1.15, rotate: 5 }}
                      className={`p-3 sm:p-4 rounded-2xl ${stat.bg}`}
                    >
                      <stat.icon className={`h-6 w-6 sm:h-7 sm:w-7 ${stat.color}`} />
                    </motion.div>
                    <div>
                      <p className="text-2xl sm:text-3xl font-light text-foreground">
                        {stat.value !== null ? (
                          <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                        ) : (
                          formatTime(globalStats.totalTime)
                        )}
                      </p>
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-widest mt-1">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {courseStats.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="bg-card/40 backdrop-blur-xl border border-border shadow-sm rounded-[2rem]">
              <CardContent className="py-16 sm:py-24 text-center">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <BarChart3 className="h-16 w-16 sm:h-20 sm:w-20 text-muted-foreground mx-auto mb-6" />
                </motion.div>
                <h3 className="text-2xl sm:text-3xl font-light text-foreground mb-2">Pas encore de données</h3>
                <p className="text-sm font-medium text-muted-foreground mb-8 max-w-md mx-auto">
                  Complétez des quiz pour voir vos statistiques détaillées
                </p>
                <Button onClick={() => navigate("/add-course")} className="h-14 px-8 rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium shadow-md">
                  Créer un QCM
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            {/* Radial Score Gauge + Filter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
              >
                <Card className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] h-full">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Award className="h-4 w-4 text-primary" />
                      Score global
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center py-4">
                    <div className="relative w-[160px] h-[160px] sm:w-[180px] sm:h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                          cx="50%"
                          cy="50%"
                          innerRadius="70%"
                          outerRadius="100%"
                          startAngle={180}
                          endAngle={0}
                          data={radialData}
                        >
                          <RadialBar
                            dataKey="value"
                            cornerRadius={10}
                            background={{ fill: "hsl(var(--muted))" }}
                          />
                        </RadialBarChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl sm:text-4xl font-bold text-primary">
                          <AnimatedCounter value={globalStats.averageScore} suffix="%" />
                        </span>
                        <span className="text-xs text-muted-foreground">Moyenne</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="md:col-span-2"
              >
                <Card className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem] h-full">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                          <Calendar className="h-5 w-5 text-primary" />
                          Analytiques temporelles
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Score moyen et quiz par période</CardDescription>
                      </div>
                      <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as "week" | "month" | "all")} className="w-auto">
                        <TabsList className="bg-muted/50 h-8">
                          <TabsTrigger value="week" className="text-xs px-2">7j</TabsTrigger>
                          <TabsTrigger value="month" className="text-xs px-2">30j</TabsTrigger>
                          <TabsTrigger value="all" className="text-xs px-2">Tout</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {temporalData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={temporalData}>
                          <defs>
                            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                          <YAxis yAxisId="score" stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[0, 100]} />
                          <YAxis yAxisId="count" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px"
                            }}
                            formatter={(value: number, name: string) => [
                              name === "score" ? `${value}%` : value,
                              name === "score" ? "Score moyen" : "Quiz"
                            ]}
                          />
                          <Area yAxisId="score" type="monotone" dataKey="score" stroke="hsl(var(--primary))" fill="url(#scoreGradient)" strokeWidth={2.5} />
                          <Bar yAxisId="count" dataKey="quizzes" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} opacity={0.5} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                        Aucune donnée pour cette période
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Filter */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-4 sm:mb-6"
            >
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Filtrer par cours" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les cours</SelectItem>
                  {courses.filter(c => courseStats.some(s => s.courseId === c.id)).map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {/* Evolution Chart */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Évolution des scores
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Progression au fil du temps</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData}>
                          <defs>
                            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="hsl(var(--primary))" />
                              <stop offset="100%" stopColor="hsl(var(--success))" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px"
                            }}
                            formatter={(value: number) => [`${value}%`, "Score"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="percentage"
                            stroke="url(#lineGrad)"
                            strokeWidth={3}
                            dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 7, fill: "hsl(var(--primary))" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                        Aucune donnée pour ce cours
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Bar Chart */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Scores par cours
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Moyenne vs Meilleur score</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={barChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={9} angle={-15} textAnchor="end" height={50} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px"
                          }}
                          formatter={(value: number) => [`${value}%`]}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Bar dataKey="moyenne" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Moyenne" />
                        <Bar dataKey="meilleur" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} name="Meilleur" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* EBBINGHAUS 3D-STYLE FORGETTING CURVE VISUALIZER */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="mb-6 sm:mb-8"
            >
              <Card className="bg-gradient-to-br from-card/85 via-card/55 to-background/50 backdrop-blur-2xl border border-white/10 dark:border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.25)] rounded-[2.5rem] overflow-hidden">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Clock className="h-5 w-5 text-primary animate-pulse" />
                        Simulateur de Rétention Clinique (Courbe d'Ebbinghaus)
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Découvrez comment l'algorithme d'espacement des révisions (FSRS) de Hipocampus combat activement la courbe de l'oubli.
                      </CardDescription>
                    </div>
                    <Badge className="bg-primary/10 text-primary border border-primary/20 rounded-xl text-[9px] font-black uppercase tracking-wider px-3.5 py-1.5 self-start sm:self-auto">
                      💡 MOTEUR FSRS V4 ACTIF
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
                    <div className="lg:col-span-3">
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={ebbinghausData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "12px",
                              fontSize: "12px",
                              boxShadow: "0 10px 25px rgba(0,0,0,0.15)"
                            }}
                            formatter={(value: number) => [`${value}%`, "Rétention"]}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                          <Line
                            type="monotone"
                            dataKey="Sans révision"
                            stroke="hsl(var(--destructive))"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="Avec 1 révision"
                            stroke="hsl(var(--warning))"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="Avec 3 révisions (FSRS)"
                            stroke="hsl(var(--success))"
                            strokeWidth={3.5}
                            dot={{ fill: "hsl(var(--success))", r: 4 }}
                            activeDot={{ r: 7 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="space-y-4 bg-muted/40 p-5 rounded-3xl border border-border/50">
                      <h4 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" /> Vérité Scientifique
                      </h4>
                      <div className="space-y-3.5 text-xs text-muted-foreground leading-relaxed">
                        <p>
                          Sans révision, vous oubliez plus de <strong className="text-destructive">50%</strong> des connaissances après seulement 24 heures et <strong className="text-destructive">90%</strong> en 7 jours.
                        </p>
                        <p>
                          Grâce à Hipocampus, chaque révision calibrée par l'algorithme <strong className="text-foreground">FSRS</strong> réinitialise la courbe et aplatit son déclin.
                        </p>
                        <p className="text-[10px] font-bold text-success flex items-center gap-1">
                          ✔ Stabilisation optimale garantie pour vos examens.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Pie Chart */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem]">
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Répartition</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Par niveau de maîtrise</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                            animationBegin={0}
                            animationDuration={1200}
                          >
                            {pieData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                        Pas assez de données
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Course Progress List */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="lg:col-span-2"
              >
                <Card className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-[2rem]">
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Détails par cours</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Performance et progression</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-[300px] overflow-y-auto">
                    {filteredStats.map((stat, i) => (
                      <motion.div
                        key={stat.courseId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * i }}
                        className="p-3 sm:p-4 bg-muted/50 rounded-xl space-y-2 sm:space-y-3 hover:bg-muted/70 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-foreground text-sm sm:text-base truncate">{stat.courseName}</h4>
                            <p className="text-xs text-muted-foreground">{stat.totalAttempts} tentative(s)</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg sm:text-xl font-bold text-primary">{stat.averageScore}%</p>
                            <p className="text-xs text-muted-foreground">moyenne</p>
                          </div>
                        </div>
                        <Progress value={stat.averageScore} className="h-2" />
                        <div className="flex flex-wrap justify-between text-xs text-muted-foreground gap-1">
                          <span>Meilleur: {stat.bestScore}%</span>
                          <span>Dernier: {stat.lastScore}%</span>
                          <span className={stat.lastScore >= stat.averageScore ? "text-success font-medium" : "text-destructive font-medium"}>
                            {stat.lastScore >= stat.averageScore ? "↑ En progrès" : "↓ À réviser"}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Statistics;
