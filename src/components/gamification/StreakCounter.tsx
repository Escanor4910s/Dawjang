 import { motion } from 'framer-motion';
 import { Flame } from 'lucide-react';
 
 interface StreakCounterProps {
   currentStreak: number;
   longestStreak: number;
   compact?: boolean;
 }
 
 export const StreakCounter = ({ currentStreak, longestStreak, compact = false }: StreakCounterProps) => {
   const isOnFire = currentStreak >= 3;
 
   if (compact) {
     return (
       <motion.div 
         className={`flex items-center gap-1 px-2 py-1 rounded-full ${
           isOnFire ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-muted text-muted-foreground'
         }`}
         animate={isOnFire ? { scale: [1, 1.05, 1] } : {}}
         transition={{ duration: 2, repeat: Infinity }}
       >
         <Flame className={`h-4 w-4 ${isOnFire ? 'text-orange-500' : ''}`} />
         <span className="font-bold text-sm">{currentStreak}</span>
       </motion.div>
     );
   }
 
   return (
     <div className="flex items-center gap-4">
       <motion.div
         className={`relative flex flex-col items-center justify-center p-4 rounded-xl ${
           isOnFire 
             ? 'bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30' 
             : 'bg-muted'
         }`}
         animate={isOnFire ? { 
           boxShadow: ['0 0 20px rgba(249, 115, 22, 0.3)', '0 0 30px rgba(249, 115, 22, 0.5)', '0 0 20px rgba(249, 115, 22, 0.3)']
         } : {}}
         transition={{ duration: 2, repeat: Infinity }}
       >
         <motion.div
           animate={isOnFire ? { y: [0, -3, 0] } : {}}
           transition={{ duration: 0.5, repeat: Infinity }}
         >
           <Flame className={`h-8 w-8 ${isOnFire ? 'text-orange-500' : 'text-muted-foreground'}`} />
         </motion.div>
         <span className="text-2xl font-bold mt-1">{currentStreak}</span>
         <span className="text-xs text-muted-foreground">jours</span>
       </motion.div>
       
       <div className="text-sm">
         <p className="text-muted-foreground">Série actuelle</p>
         <p className="font-medium">{currentStreak} jour{currentStreak > 1 ? 's' : ''}</p>
         <p className="text-xs text-muted-foreground mt-1">
           Record: {longestStreak} jour{longestStreak > 1 ? 's' : ''}
         </p>
       </div>
     </div>
   );
 };