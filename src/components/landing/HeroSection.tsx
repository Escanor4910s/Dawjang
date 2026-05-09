import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import illustHero from "@/assets/landing/illust-hero.png";

const HeroSection = () => {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-16 bg-gradient-to-b from-background to-section-alt">
      {/* Subtle warm pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="container relative z-10 px-4 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center lg:text-left space-y-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-accent-warm/10 text-accent-warm px-3 py-1.5 rounded-full text-sm font-medium"
            >
              <Sparkles className="h-4 w-4" />
              Propulsé par l'IA
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Révisez vos cours de médecine{" "}
              <span className="text-accent-warm">intelligemment</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0">
              Uploadez vos cours, notre IA génère des QCM personnalisés.
              Flashcards, révision espacée, assistant IA — tout pour réussir.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
            >
              <Button
                asChild
                size="lg"
                className="bg-foreground text-background hover:bg-foreground/90 h-12 px-6 text-base group"
              >
                <Link to="/auth" className="flex items-center gap-2">
                  Commencer gratuitement
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </motion.div>

            <div className="flex items-center justify-center lg:justify-start gap-6 text-sm text-muted-foreground">
              <span>✓ 100% Gratuit</span>
              <span>✓ +12K Étudiants</span>
              <span>✓ IA avancée</span>
            </div>
          </motion.div>

          {/* Hero illustration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex justify-center"
          >
            <motion.img
              src={illustHero}
              alt="Étudiant en médecine révisant avec Hippocampus"
              width={500}
              height={500}
              className="w-full max-w-[340px] sm:max-w-[420px] lg:max-w-[480px] drop-shadow-xl"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
