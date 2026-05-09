import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Upload, Sparkles, CheckCircle, TrendingUp } from "lucide-react";

const steps = [
  { number: "1", icon: Upload, title: "Uploadez", desc: "Importez votre cours (PDF, texte)" },
  { number: "2", icon: Sparkles, title: "L'IA génère", desc: "Des QCM adaptés à votre contenu" },
  { number: "3", icon: CheckCircle, title: "Révisez", desc: "Testez-vous et comprenez vos erreurs" },
  { number: "4", icon: TrendingUp, title: "Progressez", desc: "Suivez vos stats et améliorez-vous" },
];

const HowItWorksSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" className="py-20 bg-section-alt" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Comment ça <span className="text-accent-warm">marche ?</span>
          </h2>
          <p className="text-muted-foreground">4 étapes simples pour réussir vos révisions</p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto relative">
          {/* Connection line desktop */}
          <div className="hidden lg:block absolute top-10 left-[15%] right-[15%] h-0.5 bg-border" />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                className="text-center relative"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-section-dark flex items-center justify-center relative">
                  <Icon className="h-8 w-8 text-accent-warm" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-accent-warm text-accent-warm-foreground text-xs font-bold flex items-center justify-center">
                    {step.number}
                  </span>
                </div>
                <h3 className="font-bold text-foreground mb-1">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
