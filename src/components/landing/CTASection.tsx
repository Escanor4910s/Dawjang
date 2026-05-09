import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const CTASection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-20 bg-section-dark" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center max-w-2xl mx-auto"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-section-dark-foreground mb-4">
            Prêt à transformer vos révisions ?
          </h2>
          <p className="text-section-dark-foreground/60 mb-8">
            Rejoignez +12 000 étudiants qui réussissent avec Hippocampus.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-accent-warm text-accent-warm-foreground hover:bg-accent-warm/90 h-12 px-8 text-base group"
          >
            <Link to="/auth" className="flex items-center gap-2">
              Créer mon compte gratuit
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
