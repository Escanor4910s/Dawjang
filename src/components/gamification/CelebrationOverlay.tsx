 import { motion, AnimatePresence } from 'framer-motion';
 import { useEffect, useState } from 'react';
 import { BADGES, BadgeId, GamificationEvent } from '@/hooks/useGamification';
 import { Sparkles, Trophy, Flame, Star } from 'lucide-react';
 import confetti from 'canvas-confetti';
 
 interface CelebrationOverlayProps {
   events: GamificationEvent[];
   onComplete: () => void;
 }
 
 export const CelebrationOverlay = ({ events, onComplete }: CelebrationOverlayProps) => {
   const [currentEventIndex, setCurrentEventIndex] = useState(0);
   const [isVisible, setIsVisible] = useState(false);
 
   const celebratableEvents = events.filter(
     e => e.type === 'level_up' || e.type === 'badge_earned'
   );
 
   useEffect(() => {
     if (celebratableEvents.length > 0 && currentEventIndex < celebratableEvents.length) {
       setIsVisible(true);
       
       // Trigger confetti
       const event = celebratableEvents[currentEventIndex];
       if (event.type === 'level_up') {
         confetti({
           particleCount: 100,
           spread: 70,
           origin: { y: 0.6 },
           colors: ['#10b981', '#06b6d4', '#8b5cf6']
         });
       } else if (event.type === 'badge_earned') {
         confetti({
           particleCount: 50,
           spread: 60,
           origin: { y: 0.6 },
           colors: ['#f59e0b', '#eab308', '#fbbf24']
         });
       }
 
       const timer = setTimeout(() => {
         setIsVisible(false);
         setTimeout(() => {
           if (currentEventIndex < celebratableEvents.length - 1) {
             setCurrentEventIndex(prev => prev + 1);
           } else {
             onComplete();
           }
         }, 300);
       }, 2500);
 
       return () => clearTimeout(timer);
     }
   }, [currentEventIndex, celebratableEvents, onComplete]);
 
   if (celebratableEvents.length === 0) return null;
 
   const currentEvent = celebratableEvents[currentEventIndex];
   if (!currentEvent) return null;
 
   return (
     <AnimatePresence>
       {isVisible && (
         <motion.div
           className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           onClick={() => setIsVisible(false)}
         >
           <motion.div
             className="relative p-8 rounded-2xl bg-gradient-to-br from-card to-card/80 shadow-2xl border"
             initial={{ scale: 0.5, y: 50 }}
             animate={{ scale: 1, y: 0 }}
             exit={{ scale: 0.5, y: 50 }}
             transition={{ type: 'spring', damping: 15 }}
           >
             {currentEvent.type === 'level_up' && (
               <div className="text-center">
                 <motion.div
                   className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent mb-4"
                   animate={{ 
                     scale: [1, 1.2, 1],
                     rotate: [0, 10, -10, 0]
                   }}
                   transition={{ duration: 0.6 }}
                 >
                   <Trophy className="h-10 w-10 text-primary-foreground" />
                 </motion.div>
                 <motion.h2 
                   className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
                   animate={{ scale: [0.8, 1.1, 1] }}
                   transition={{ delay: 0.2 }}
                 >
                   Niveau {currentEvent.newLevel} !
                 </motion.h2>
                 <p className="text-muted-foreground mt-2">
                   Félicitations ! Vous avez atteint un nouveau niveau !
                 </p>
                 <motion.div
                   className="flex justify-center gap-2 mt-4"
                   animate={{ y: [0, -5, 0] }}
                   transition={{ repeat: Infinity, duration: 1.5 }}
                 >
                   <Sparkles className="h-5 w-5 text-warning" />
                   <Star className="h-5 w-5 text-warning" />
                   <Sparkles className="h-5 w-5 text-warning" />
                 </motion.div>
               </div>
             )}
 
             {currentEvent.type === 'badge_earned' && currentEvent.badgeId && (
               <div className="text-center">
                 <motion.div
                   className="text-6xl mb-4"
                   animate={{ 
                     scale: [1, 1.3, 1],
                     rotate: [0, 15, -15, 0]
                   }}
                   transition={{ duration: 0.6 }}
                 >
                   {BADGES[currentEvent.badgeId]?.icon}
                 </motion.div>
                 <motion.h2 
                   className="text-2xl font-bold"
                   animate={{ scale: [0.8, 1.1, 1] }}
                   transition={{ delay: 0.2 }}
                 >
                   Badge débloqué !
                 </motion.h2>
                 <p className="text-lg font-medium text-primary mt-2">
                   {BADGES[currentEvent.badgeId]?.name}
                 </p>
                 <p className="text-sm text-muted-foreground mt-1">
                   {BADGES[currentEvent.badgeId]?.description}
                 </p>
               </div>
             )}
           </motion.div>
         </motion.div>
       )}
     </AnimatePresence>
   );
 };