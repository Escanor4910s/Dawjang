import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Sparkles, Crown, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const teasers = [
  { icon: Sparkles, name: "Gratuit", price: "0 FCFA", desc: "Pour découvrir" },
  { icon: Zap, name: "Premium", price: "2 500 FCFA", desc: "Le plus populaire", highlight: true },
  { icon: Crown, name: "Pro", price: "5 000 FCFA", desc: "Pour les exigeants" },
];

const PricingSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="pricing" className="py-20 bg-section-alt" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-12 max-w-2xl mx-auto"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Des tarifs <span className="text-accent-warm">transparents</span>
          </h2>
          <p className="text-muted-foreground">
            Trois plans pensés pour votre parcours. Détails complets sur la page Tarifs.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-10">
          {teasers.map((t, i) => {
            const Icon = t.icon;
            return (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className={`rounded-2xl p-5 border bg-card text-center ${
                  t.highlight ? "border-accent-warm shadow-md" : "border-border"
                }`}
              >
                <div className="h-10 w-10 mx-auto rounded-xl bg-foreground/10 flex items-center justify-center mb-3">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="font-bold text-foreground">{t.name}</h3>
                <p className="text-2xl font-bold text-foreground mt-1">{t.price}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <Button
            asChild
            size="lg"
            className="bg-foreground text-background hover:bg-foreground/90 group"
          >
            <Link to="/pricing" className="inline-flex items-center gap-2">
              Voir les tarifs détaillés
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;
