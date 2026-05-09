import { motion } from 'framer-motion';
import { BADGES, BadgeId } from '@/hooks/useGamification';
import { Lock, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BadgeDisplayProps {
  earnedBadges: BadgeId[];
  showAll?: boolean;
  compact?: boolean;
}

export const BadgeDisplay = ({ earnedBadges, showAll = false, compact = false }: BadgeDisplayProps) => {
  const allBadges = Object.values(BADGES);
  const displayBadges = showAll ? allBadges : allBadges.filter(b => earnedBadges.includes(b.id as BadgeId));

  if (compact) {
    const recentBadges = displayBadges.slice(-3);
    return (
      <div className="flex items-center gap-1">
        {recentBadges.map((badge, index) => (
          <Tooltip key={badge.id}>
            <TooltipTrigger>
              <motion.div
                className="text-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                {badge.icon}
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{badge.name}</p>
              <p className="text-xs text-muted-foreground">{badge.description}</p>
              <p className="text-xs text-primary mt-1 flex items-center gap-1">
                <Info className="h-3 w-3" />
                {(badge as any).condition || (badge as any).description}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
        {earnedBadges.length > 3 && (
          <span className="text-xs text-muted-foreground ml-1">
            +{earnedBadges.length - 3}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
      {displayBadges.map((badge) => {
        const isEarned = earnedBadges.includes(badge.id as BadgeId);
        
        return (
          <Tooltip key={badge.id}>
            <TooltipTrigger>
              <motion.div
                className={`relative flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                  isEarned 
                    ? 'bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-primary/30' 
                    : 'bg-muted/50 border-2 border-transparent opacity-50'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className={`text-2xl sm:text-3xl ${!isEarned ? 'grayscale' : ''}`}>
                  {badge.icon}
                </span>
                <span className="text-xs font-medium mt-1 text-center line-clamp-1">
                  {badge.name}
                </span>
                {!isEarned && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px]">
              <p className="font-medium">{badge.name}</p>
              <p className="text-xs text-muted-foreground">{badge.description}</p>
              <p className="text-xs text-primary mt-1 flex items-center gap-1">
                <Info className="h-3 w-3" />
                {(badge as any).condition || (badge as any).description}
              </p>
              {!isEarned && (
                <p className="text-xs text-warning mt-1">🔒 Non débloqué</p>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};
