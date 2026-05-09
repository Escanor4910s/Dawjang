 import React, { createContext, useContext, ReactNode } from 'react';
 import { useGamification, GamificationData, GamificationEvent, BadgeId } from '@/hooks/useGamification';
 
 interface GamificationContextType {
   data: GamificationData | null;
   loading: boolean;
   events: GamificationEvent[];
   clearEvents: () => void;
   addXP: (amount: number) => Promise<GamificationEvent[]>;
   recordQuizCompletion: (score: number, totalQuestions: number) => Promise<GamificationEvent[]>;
   refetch: () => Promise<void>;
 }
 
 const GamificationContext = createContext<GamificationContextType | undefined>(undefined);
 
 export const GamificationProvider = ({ children }: { children: ReactNode }) => {
   const gamification = useGamification();
 
   return (
     <GamificationContext.Provider value={gamification}>
       {children}
     </GamificationContext.Provider>
   );
 };
 
 export const useGamificationContext = () => {
   const context = useContext(GamificationContext);
   if (!context) {
     // Safe fallback to avoid hard crashes when widget renders outside provider
     return {
       data: null,
       loading: true,
       events: [],
       clearEvents: () => {},
       addXP: async () => [],
       recordQuizCompletion: async () => [],
       refetch: async () => {},
     } as GamificationContextType;
   }
   return context;
 };