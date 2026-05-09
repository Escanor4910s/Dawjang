 import { motion } from 'framer-motion';
 import { getXPProgressToNextLevel, getXPForLevel } from '@/hooks/useGamification';
 import { Zap } from 'lucide-react';
 
 interface XPBarProps {
   xp: number;
   level: number;
   compact?: boolean;
 }
 
 export const XPBar = ({ xp, level, compact = false }: XPBarProps) => {
   const progress = getXPProgressToNextLevel(xp);
   const currentLevelXP = getXPForLevel(level);
   const nextLevelXP = getXPForLevel(level + 1);
 
   if (compact) {
     return (
       <div className="flex items-center gap-2">
         <div className="flex items-center gap-1 text-primary font-bold">
           <Zap className="h-4 w-4" />
           <span className="text-sm">Niv. {level}</span>
         </div>
         <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[80px]">
           <motion.div
             className="h-full bg-gradient-to-r from-primary to-accent"
             initial={{ width: 0 }}
             animate={{ width: `${progress}%` }}
             transition={{ duration: 0.5, ease: 'easeOut' }}
           />
         </div>
       </div>
     );
   }
 
   return (
     <div className="space-y-2">
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-2">
           <motion.div 
             className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold text-lg"
             whileHover={{ scale: 1.1 }}
             whileTap={{ scale: 0.95 }}
           >
             {level}
           </motion.div>
           <div>
             <p className="text-sm font-medium">Niveau {level}</p>
             <p className="text-xs text-muted-foreground">{xp} XP total</p>
           </div>
         </div>
         <div className="text-right">
           <p className="text-sm text-muted-foreground">
             {xp - currentLevelXP} / {nextLevelXP - currentLevelXP} XP
           </p>
         </div>
       </div>
       <div className="h-3 bg-muted rounded-full overflow-hidden">
         <motion.div
           className="h-full bg-gradient-to-r from-primary via-accent to-primary-glow"
           initial={{ width: 0 }}
           animate={{ width: `${progress}%` }}
           transition={{ duration: 0.8, ease: 'easeOut' }}
         />
       </div>
     </div>
   );
 };