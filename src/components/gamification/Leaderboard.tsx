import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Flame, Medal, Crown, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  xp: number;
  level: number;
  current_streak: number;
  total_quizzes_completed: number;
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1: return <Crown className="h-5 w-5 text-yellow-500" />;
    case 2: return <Medal className="h-5 w-5 text-gray-400" />;
    case 3: return <Medal className="h-5 w-5 text-amber-600" />;
    default: return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
  }
};

const getRankStyle = (rank: number) => {
  switch (rank) {
    case 1: return 'bg-yellow-500/10 border-yellow-500/30';
    case 2: return 'bg-gray-300/10 border-gray-300/30';
    case 3: return 'bg-amber-600/10 border-amber-600/30';
    default: return 'bg-muted/30 border-border/50';
  }
};

export const Leaderboard = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const { data, error } = await supabase.rpc('get_leaderboard', { limit_count: 20 });
      if (!error && data) {
        setEntries(data as LeaderboardEntry[]);
      }
      setLoading(false);
    };
    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Classement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-primary" />
            Classement communautaire
          </CardTitle>
          <p className="text-sm text-muted-foreground">Top étudiants par XP</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucun classement disponible. Complète des QCM pour apparaître !
            </p>
          ) : (
            entries.map((entry, index) => {
              const rank = index + 1;
              const isCurrentUser = entry.user_id === currentUserId;
              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${getRankStyle(rank)} ${
                    isCurrentUser ? 'ring-2 ring-primary/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-center w-8">
                    {getRankIcon(rank)}
                  </div>

                  <Avatar className="h-9 w-9">
                    {entry.avatar_url && <AvatarImage src={entry.avatar_url} />}
                    <AvatarFallback className="text-xs">
                      {entry.display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {entry.display_name}
                        {isCurrentUser && (
                          <Badge variant="secondary" className="ml-2 text-xs">Toi</Badge>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" /> Niv. {entry.level}
                      </span>
                      {entry.current_streak > 0 && (
                        <span className="flex items-center gap-1">
                          <Flame className="h-3 w-3 text-orange-500" /> {entry.current_streak}j
                        </span>
                      )}
                      <span>{entry.total_quizzes_completed} QCM</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-sm text-primary">{entry.xp.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground ml-1">XP</span>
                  </div>
                </motion.div>
              );
            })
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
