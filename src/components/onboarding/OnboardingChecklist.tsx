 import { motion } from "framer-motion";
 import { useNavigate } from "react-router-dom";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Progress } from "@/components/ui/progress";
 import { 
   CheckCircle2, 
   Circle, 
   ChevronRight,
   Sparkles,
   X,
   RotateCcw
 } from "lucide-react";
 import type { OnboardingStep } from "@/hooks/useOnboarding";
 
 interface OnboardingChecklistProps {
   steps: OnboardingStep[];
   completionPercentage: number;
   isComplete: boolean;
   onDismiss?: () => void;
   onReset?: () => void;
 }
 
 const OnboardingChecklist = ({
   steps,
   completionPercentage,
   isComplete,
   onDismiss,
   onReset,
 }: OnboardingChecklistProps) => {
   const navigate = useNavigate();
 
   if (isComplete) {
     return (
       <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
       >
         <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
           <CardContent className="p-6">
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-primary/20 rounded-full">
                   <Sparkles className="h-5 w-5 text-primary" />
                 </div>
                 <div>
                   <h3 className="font-semibold">Bravo ! 🎉</h3>
                   <p className="text-sm text-muted-foreground">
                     Vous maîtrisez Hippocampus
                   </p>
                 </div>
               </div>
               <div className="flex gap-2">
                 {onReset && (
                   <Button variant="ghost" size="icon" onClick={onReset}>
                     <RotateCcw className="h-4 w-4" />
                   </Button>
                 )}
                 {onDismiss && (
                   <Button variant="ghost" size="icon" onClick={onDismiss}>
                     <X className="h-4 w-4" />
                   </Button>
                 )}
               </div>
             </div>
           </CardContent>
         </Card>
       </motion.div>
     );
   }
 
   return (
     <motion.div
       initial={{ opacity: 0, y: 20 }}
       animate={{ opacity: 1, y: 0 }}
     >
       <Card className="border-primary/20 overflow-hidden">
         <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-primary/20 rounded-full">
                 <Sparkles className="h-5 w-5 text-primary" />
               </div>
               <div>
                 <CardTitle className="text-lg">Guide de démarrage</CardTitle>
                 <p className="text-sm text-muted-foreground">
                   {completionPercentage}% complété
                 </p>
               </div>
             </div>
             {onDismiss && (
               <Button variant="ghost" size="icon" onClick={onDismiss}>
                 <X className="h-4 w-4" />
               </Button>
             )}
           </div>
           <Progress value={completionPercentage} className="h-2 mt-3" />
         </CardHeader>
         
         <CardContent className="p-4 pt-2">
           <div className="space-y-2">
             {steps.map((step, index) => (
               <motion.div
                 key={step.id}
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: index * 0.05 }}
               >
                 <button
                   onClick={() => step.route && navigate(step.route)}
                   disabled={step.completed}
                   className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                     step.completed
                       ? "bg-muted/50 text-muted-foreground"
                       : "hover:bg-accent cursor-pointer"
                   }`}
                 >
                   {step.completed ? (
                     <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                   ) : (
                     <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                   )}
                   
                   <div className="flex-1 min-w-0">
                     <p className={`font-medium text-sm ${step.completed ? "line-through" : ""}`}>
                       {step.title}
                     </p>
                     <p className="text-xs text-muted-foreground truncate">
                       {step.description}
                     </p>
                   </div>
                   
                   {!step.completed && step.action && (
                     <div className="flex items-center gap-1 text-xs text-primary font-medium flex-shrink-0">
                       <span className="hidden sm:inline">{step.action}</span>
                       <ChevronRight className="h-4 w-4" />
                     </div>
                   )}
                 </button>
               </motion.div>
             ))}
           </div>
         </CardContent>
       </Card>
     </motion.div>
   );
 };
 
 export default OnboardingChecklist;