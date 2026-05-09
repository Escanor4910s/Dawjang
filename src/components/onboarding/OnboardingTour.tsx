 import { useState, useEffect } from "react";
 import { motion, AnimatePresence } from "framer-motion";
 import { useNavigate, useLocation } from "react-router-dom";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent } from "@/components/ui/card";
 import { 
   X, 
   ArrowRight, 
   ArrowLeft,
   BookOpen,
   FileQuestion,
   Layers,
   BarChart3,
   Home
 } from "lucide-react";
 
 interface TourStep {
   id: string;
   title: string;
   description: string;
   route: string;
   icon: React.ElementType;
   position: "top" | "bottom" | "left" | "right" | "center";
 }
 
 const TOUR_STEPS: TourStep[] = [
   {
     id: "dashboard",
     title: "Tableau de bord",
     description: "Voici votre espace personnel. Vous y trouverez vos statistiques et votre progression.",
     route: "/dashboard",
     icon: Home,
     position: "center",
   },
   {
     id: "add-course",
     title: "Ajouter un cours",
     description: "Téléchargez vos cours au format PDF ou PowerPoint. L'IA les analysera automatiquement.",
     route: "/add-course",
     icon: BookOpen,
     position: "center",
   },
   {
     id: "quiz-library",
     title: "Bibliothèque de QCM",
     description: "Générez des quiz à partir de vos cours. Choisissez le nombre de questions et le type.",
     route: "/quiz-library",
     icon: FileQuestion,
     position: "center",
   },
   {
     id: "flashcards",
     title: "Flashcards",
     description: "Révisez efficacement avec des cartes de mémorisation basées sur la répétition espacée.",
     route: "/flashcards",
     icon: Layers,
     position: "center",
   },
   {
     id: "statistics",
     title: "Statistiques",
     description: "Suivez votre progression, identifiez vos points forts et faibles par thème.",
     route: "/statistics",
     icon: BarChart3,
     position: "center",
   },
 ];
 
 interface OnboardingTourProps {
   isActive: boolean;
   onEnd: () => void;
 }
 
 const OnboardingTour = ({ isActive, onEnd }: OnboardingTourProps) => {
   const [currentStepIndex, setCurrentStepIndex] = useState(0);
   const navigate = useNavigate();
   const location = useLocation();
 
   const currentStep = TOUR_STEPS[currentStepIndex];
   const isFirstStep = currentStepIndex === 0;
   const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;
 
   // Navigate to current step route
   useEffect(() => {
     if (isActive && currentStep && location.pathname !== currentStep.route) {
       navigate(currentStep.route);
     }
   }, [isActive, currentStep, navigate, location.pathname]);
 
   const handleNext = () => {
     if (isLastStep) {
       onEnd();
       navigate("/dashboard");
     } else {
       setCurrentStepIndex(currentStepIndex + 1);
     }
   };
 
   const handlePrev = () => {
     if (!isFirstStep) {
       setCurrentStepIndex(currentStepIndex - 1);
     }
   };
 
   const handleSkip = () => {
     onEnd();
     navigate("/dashboard");
   };
 
   if (!isActive || !currentStep) return null;
 
   const Icon = currentStep.icon;
 
   return (
     <AnimatePresence>
       <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         exit={{ opacity: 0 }}
         className="fixed inset-0 z-50 pointer-events-none"
       >
         {/* Overlay */}
         <div className="absolute inset-0 bg-background/60 backdrop-blur-sm pointer-events-auto" />
         
         {/* Tour Card */}
         <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-auto">
           <motion.div
             key={currentStep.id}
             initial={{ opacity: 0, y: 20, scale: 0.95 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, y: -20, scale: 0.95 }}
             transition={{ type: "spring", damping: 25, stiffness: 300 }}
             className="w-full max-w-md"
           >
             <Card className="border-primary/30 shadow-elegant overflow-hidden">
               <CardContent className="p-0">
                 {/* Header with icon */}
                 <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
                   <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-2">
                       {TOUR_STEPS.map((step, i) => (
                         <div
                           key={step.id}
                           className={`h-1.5 rounded-full transition-all ${
                             i === currentStepIndex
                               ? "w-6 bg-primary"
                               : i < currentStepIndex
                               ? "w-1.5 bg-primary/50"
                               : "w-1.5 bg-muted-foreground/30"
                           }`}
                         />
                       ))}
                     </div>
                     <Button
                       variant="ghost"
                       size="icon"
                       onClick={handleSkip}
                       className="h-8 w-8"
                     >
                       <X className="h-4 w-4" />
                     </Button>
                   </div>
 
                   <div className="flex items-center gap-4">
                     <div className="p-3 bg-primary/20 rounded-xl">
                       <Icon className="h-8 w-8 text-primary" />
                     </div>
                     <div>
                       <p className="text-xs text-muted-foreground uppercase tracking-wide">
                         Étape {currentStepIndex + 1} sur {TOUR_STEPS.length}
                       </p>
                       <h3 className="text-xl font-bold">{currentStep.title}</h3>
                     </div>
                   </div>
                 </div>
 
                 {/* Content */}
                 <div className="p-6 space-y-6">
                   <p className="text-muted-foreground leading-relaxed">
                     {currentStep.description}
                   </p>
 
                   {/* Navigation */}
                   <div className="flex items-center justify-between gap-3">
                     <Button
                       variant="outline"
                       onClick={handlePrev}
                       disabled={isFirstStep}
                       className="flex-1"
                     >
                       <ArrowLeft className="h-4 w-4 mr-2" />
                       Précédent
                     </Button>
                     <Button
                       onClick={handleNext}
                       className="flex-1 bg-gradient-primary"
                     >
                       {isLastStep ? "Terminer" : "Suivant"}
                       <ArrowRight className="h-4 w-4 ml-2" />
                     </Button>
                   </div>
 
                   <button
                     onClick={handleSkip}
                     className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                   >
                     Passer le tutoriel
                   </button>
                 </div>
               </CardContent>
             </Card>
           </motion.div>
         </div>
       </motion.div>
     </AnimatePresence>
   );
 };
 
 export default OnboardingTour;