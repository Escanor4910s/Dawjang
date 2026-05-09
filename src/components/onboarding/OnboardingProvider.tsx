 import { createContext, useContext, ReactNode } from "react";
 import { useOnboarding } from "@/hooks/useOnboarding";
 import WelcomeModal from "./WelcomeModal";
 import OnboardingTour from "./OnboardingTour";
 
 interface OnboardingContextType {
   isNewUser: boolean;
   hasSeenWelcome: boolean;
   steps: ReturnType<typeof useOnboarding>["steps"];
   completionPercentage: number;
   isComplete: boolean;
   loading: boolean;
   userName: string | null;
   tourActive: boolean;
   completeStep: (stepId: string) => void;
   toggleTour: (active: boolean) => void;
   resetOnboarding: () => void;
   refreshState: () => void;
 }
 
 const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);
 
 export const useOnboardingContext = () => {
   const context = useContext(OnboardingContext);
   if (!context) {
     throw new Error("useOnboardingContext must be used within OnboardingProvider");
   }
   return context;
 };
 
 interface OnboardingProviderProps {
   children: ReactNode;
 }
 
 export const OnboardingProvider = ({ children }: OnboardingProviderProps) => {
   const onboarding = useOnboarding();
 
   const {
     isNewUser,
     hasSeenWelcome,
     steps,
     completionPercentage,
     isComplete,
     loading,
     userName,
     tourActive,
     markWelcomeSeen,
     completeStep,
     toggleTour,
     resetOnboarding,
     refreshState,
   } = onboarding;
 
   const handleCloseWelcome = () => {
     markWelcomeSeen();
   };
 
   const handleStartTour = () => {
     markWelcomeSeen();
     toggleTour(true);
   };
 
   const handleEndTour = () => {
     toggleTour(false);
   };
 
   return (
     <OnboardingContext.Provider
       value={{
         isNewUser,
         hasSeenWelcome,
         steps,
         completionPercentage,
         isComplete,
         loading,
         userName,
         tourActive,
         completeStep,
         toggleTour,
         resetOnboarding,
         refreshState,
       }}
     >
       {children}
       
       {/* Welcome Modal for new users */}
       {!loading && !hasSeenWelcome && isNewUser && (
         <WelcomeModal
           userName={userName}
           onClose={handleCloseWelcome}
           onStartTour={handleStartTour}
         />
       )}
       
       {/* Tour overlay */}
       <OnboardingTour isActive={tourActive} onEnd={handleEndTour} />
     </OnboardingContext.Provider>
   );
 };