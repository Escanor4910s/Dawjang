import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Comment fonctionne la génération de QCM par IA ?",
    a: "Notre IA analyse vos documents (PDF, Word, texte) et génère des questions de différents types : QCM classiques, élection, censure et Vrai/Faux, adaptées au niveau d'études en médecine.",
  },
  {
    q: "L'abonnement gratuit a-t-il des limitations ?",
    a: "Le plan gratuit permet 5 QCM par jour avec les fonctionnalités de base. Pour un accès illimité, passez au plan Premium ou Pro.",
  },
  {
    q: "Comment fonctionne l'assistant MOR ?",
    a: "MOR est un tuteur IA 24/7 (plan Premium). Il explique vos erreurs, approfondit les concepts et s'adapte à votre niveau.",
  },
  {
    q: "Puis-je utiliser Hippocampus sur mobile ?",
    a: "Oui ! La plateforme est entièrement responsive et optimisée pour mobile et tablette.",
  },
  {
    q: "Puis-je annuler mon abonnement ?",
    a: "Oui, annulez à tout moment depuis votre espace personnel. Vous conservez l'accès jusqu'à la fin de la période payée.",
  },
];

const FAQSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Questions <span className="text-accent-warm">fréquentes</span>
          </h2>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-card rounded-2xl border border-border p-2 sm:p-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.05 }}
                className="border-b border-border last:border-0"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full py-4 flex items-start justify-between gap-3 text-left"
                >
                  <span className="text-foreground font-medium text-sm">{faq.q}</span>
                  <ChevronDown className={cn(
                    "h-4 w-4 flex-shrink-0 mt-0.5 transition-transform",
                    openIndex === i ? "rotate-180 text-accent-warm" : "text-muted-foreground"
                  )} />
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: openIndex === i ? "auto" : 0, opacity: openIndex === i ? 1 : 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <p className="pb-4 text-muted-foreground text-sm leading-relaxed">{faq.a}</p>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
