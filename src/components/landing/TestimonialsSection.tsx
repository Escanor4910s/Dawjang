import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah M.",
    role: "4ème année Médecine",
    content: "Hippocampus a révolutionné ma façon d'étudier. Les QCM sont d'une précision incroyable !",
    avatar: "👩‍⚕️",
  },
  {
    name: "Thomas D.",
    role: "Interne en Chirurgie",
    content: "Entre deux gardes, je révise avec les flashcards. L'IA comprend vraiment le contenu médical.",
    avatar: "👨‍⚕️",
  },
  {
    name: "Emma R.",
    role: "5ème année Pharmacie",
    content: "J'ai amélioré mes notes de 15% depuis que j'utilise la plateforme. L'assistant MOR est top !",
    avatar: "👩‍🎓",
  },
];

const TestimonialsSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="testimonials" className="py-20" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Ce qu'ils en <span className="text-accent-warm">disent</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-card rounded-2xl p-6 border border-border shadow-sm relative"
            >
              <Quote className="absolute top-4 right-4 h-6 w-6 text-muted-foreground/20" />
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="h-4 w-4 text-star fill-star" />
                ))}
              </div>
              <p className="text-foreground text-sm leading-relaxed mb-4">"{t.content}"</p>
              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <span className="text-2xl">{t.avatar}</span>
                <div>
                  <div className="font-semibold text-foreground text-sm">{t.name}</div>
                  <div className="text-muted-foreground text-xs">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
