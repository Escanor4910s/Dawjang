 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { useGamificationContext } from './GamificationProvider';
 import { XPBar } from './XPBar';
 import { StreakCounter } from './StreakCounter';
 import { BadgeDisplay } from './BadgeDisplay';
 import { CelebrationOverlay } from './CelebrationOverlay';
 import { Skeleton } from '@/components/ui/skeleton';
 import { Trophy, Medal, Target } from 'lucide-react';
 import { motion } from 'framer-motion';
 
 interface GamificationWidgetProps {
   variant?: 'full' | 'compact' | 'sidebar';
 }
 
 export const GamificationWidget = ({ variant = 'full' }: GamificationWidgetProps) => {
   const { data, loading, events, clearEvents } = useGamificationContext();
 
   if (loading) {
     return (
       <Card>
         <CardContent className="p-4">
           <Skeleton className="h-20 w-full" />
         </CardContent>
       </Card>
     );
   }
 
   if (!data) return null;
 
   if (variant === 'sidebar') {
     return (
       <>
         <CelebrationOverlay events={events} onComplete={clearEvents} />
         <div className="p-3 space-y-3 border-t">
           <XPBar xp={data.xp} level={data.level} compact />
           <div className="flex items-center justify-between">
             <StreakCounter 
               currentStreak={data.currentStreak} 
               longestStreak={data.longestStreak}
               compact 
             />
             <BadgeDisplay earnedBadges={data.earnedBadges} compact />
           </div>
         </div>
       </>
     );
   }
 
   if (variant === 'compact') {
     return (
       <>
         <CelebrationOverlay events={events} onComplete={clearEvents} />
         <Card>
           <CardContent className="p-4">
             <div className="flex items-center justify-between gap-4">
               <XPBar xp={data.xp} level={data.level} compact />
               <StreakCounter 
                 currentStreak={data.currentStreak} 
                 longestStreak={data.longestStreak}
                 compact 
               />
             </div>
           </CardContent>
         </Card>
       </>
     );
   }
 
   return (
     <>
       <CelebrationOverlay events={events} onComplete={clearEvents} />
       <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.5 }}
       >
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="flex items-center gap-2 text-lg">
               <Trophy className="h-5 w-5 text-primary" />
               Progression & Récompenses
             </CardTitle>
           </CardHeader>
           <CardContent className="space-y-6">
             {/* XP and Level */}
             <XPBar xp={data.xp} level={data.level} />
 
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Streak */}
               <div>
                 <h3 className="text-sm font-medium text-muted-foreground mb-3">
                   Série quotidienne
                 </h3>
                 <StreakCounter 
                   currentStreak={data.currentStreak} 
                   longestStreak={data.longestStreak} 
                 />
               </div>
 
               {/* Stats */}
               <div>
                 <h3 className="text-sm font-medium text-muted-foreground mb-3">
                   Statistiques
                 </h3>
                 <div className="space-y-2">
                   <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                     <div className="flex items-center gap-2">
                       <Target className="h-4 w-4 text-primary" />
                       <span className="text-sm">QCM complétés</span>
                     </div>
                     <span className="font-bold">{data.totalQuizzesCompleted}</span>
                   </div>
                   <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                     <div className="flex items-center gap-2">
                     <Medal className="h-4 w-4 text-warning" />
                       <span className="text-sm">Badges gagnés</span>
                     </div>
                     <span className="font-bold">{data.earnedBadges.length}</span>
                   </div>
                 </div>
               </div>
             </div>
 
             {/* Badges */}
             <div>
               <h3 className="text-sm font-medium text-muted-foreground mb-3">
                 Badges ({data.earnedBadges.length}/{Object.keys(BADGES).length})
               </h3>
               <BadgeDisplay earnedBadges={data.earnedBadges} showAll />
             </div>
           </CardContent>
         </Card>
       </motion.div>
     </>
   );
 };
 
 import { BADGES } from '@/hooks/useGamification';