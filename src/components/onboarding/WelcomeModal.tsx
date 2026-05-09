import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  GraduationCap, 
  Brain, 
  Target, 
  Sparkles,
  ArrowRight,
  BookOpen,
  Zap,
  AlertTriangle
} from "lucide-react";
import HippocampusLogo from "@/components/landing/HippocampusLogo";

interface WelcomeModalProps {
  userName: string | null;
  onClose: () => void;
  onStartTour: () => void;
}

const WelcomeModal = ({ userName, onClose, onStartTour }: WelcomeModalProps) => {
  const [step, setStep] = useState(0);

  const features = [
    {
      icon: BookOpen,
      title: "Importez vos cours",
      description: "Téléchargez vos PDF et PowerPoints pour générer des quiz automatiquement",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: Brain,
      title: "Quiz intelligents",
      description: "L'IA analyse votre contenu et crée des questions pertinentes",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: Zap,
      title: "Flashcards & Révision",
      description: "Mémorisez efficacement avec la répétition espacée",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      icon: Target,
      title: "Suivez vos progrès",
      description: "Visualisez votre progression et identifiez vos points faibles",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  ];

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      onStartTour();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-lg"
        >
          <Card className="border-0 shadow-elegant overflow-hidden bg-gradient-card">
            <CardContent className="p-0">
              {step === 0 ? (
                /* Welcome Step */
                <div className="p-8 text-center space-y-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="flex justify-center"
                  >
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                      <HippocampusLogo size="lg" />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-2"
                  >
                    <h1 className="text-3xl font-bold">
                      Bienvenue{userName ? `, ${userName}` : ""} ! 
                      <motion.span
                        initial={{ rotate: 0 }}
                        animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                        className="inline-block ml-2"
                      >
                        👋
                      </motion.span>
                    </h1>
                    <p className="text-muted-foreground text-lg">
                      Prêt à révolutionner votre apprentissage médical ?
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>Hippocampus utilise l'IA pour vous aider à réussir</span>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="pt-4"
                  >
                    <Button
                      onClick={handleNext}
                      size="lg"
                      className="w-full bg-gradient-primary shadow-button"
                    >
                      Découvrir Hippocampus
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </motion.div>
                </div>
              ) : step === 1 ? (
                /* Features Step */
                <div className="p-6 space-y-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold">
                      Ce que vous pouvez faire
                    </h2>
                    <p className="text-muted-foreground">
                      Explorez les fonctionnalités d'Hippocampus
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {features.map((feature, index) => (
                      <motion.div
                        key={feature.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className={`p-4 rounded-xl ${feature.bgColor} space-y-2`}
                      >
                        <feature.icon className={`h-6 w-6 ${feature.color}`} />
                        <h3 className="font-semibold text-sm">{feature.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {feature.description}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  <Button
                    onClick={handleNext}
                    size="lg"
                    className="w-full bg-gradient-primary shadow-button"
                  >
                    Suivant
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : (
                /* Free tier limits Step */
                <div className="p-6 space-y-6">
                  <div className="text-center space-y-2">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex justify-center mb-2"
                    >
                      <div className="p-3 bg-warning/10 rounded-full">
                        <AlertTriangle className="h-8 w-8 text-warning" />
                      </div>
                    </motion.div>
                    <h2 className="text-2xl font-bold">
                      Version d'essai gratuite
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      Voici les limites de votre version gratuite
                    </p>
                  </div>

                  <div className="space-y-3">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20"
                    >
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Brain className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">Générateur de QCM</p>
                        <p className="text-xs text-muted-foreground">Limité à <span className="font-bold text-primary">3 générations</span> par jour</p>
                      </div>
                      <span className="text-2xl font-bold text-primary">3</span>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-center gap-3 p-4 rounded-xl bg-accent/5 border border-accent/20"
                    >
                      <div className="p-2 bg-accent/10 rounded-lg">
                        <Sparkles className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">Générateur de résumés</p>
                        <p className="text-xs text-muted-foreground">Limité à <span className="font-bold text-accent">2 générations</span> par jour</p>
                      </div>
                      <span className="text-2xl font-bold text-accent">2</span>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border"
                    >
                      <div className="p-2 bg-muted rounded-lg">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">Upload de cours</p>
                        <p className="text-xs text-muted-foreground">Limité à <span className="font-bold">1 cours</span> par jour</p>
                      </div>
                      <span className="text-2xl font-bold text-muted-foreground">1</span>
                    </motion.div>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <Button
                      onClick={onStartTour}
                      size="lg"
                      className="w-full bg-gradient-primary shadow-button"
                    >
                      <GraduationCap className="mr-2 h-4 w-4" />
                      Commencer le tutoriel guidé
                    </Button>
                    <Button
                      onClick={onClose}
                      variant="ghost"
                      className="w-full text-muted-foreground"
                    >
                      Je connais déjà, passer
                    </Button>
                  </div>
                </div>
              )}

              {/* Step indicator */}
              <div className="flex justify-center gap-2 pb-6">
                {[0, 1, 2].map((i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      step === i 
                        ? "bg-primary w-6" 
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WelcomeModal;
