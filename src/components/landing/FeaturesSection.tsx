import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import illustUpload from "@/assets/landing/illust-upload.png";
import illustAiQuiz from "@/assets/landing/illust-ai-quiz.png";
import illustFlashcards from "@/assets/landing/illust-flashcards.png";
import illustStats from "@/assets/landing/illust-stats.png";
import illustMor from "@/assets/landing/illust-mor.png";
import illustSuccess from "@/assets/landing/illust-success.png";

const features = [
  {
    image: illustUpload,
    title: "Importez vos cours",
    description: "Uploadez vos PDF ou collez votre texte. L'IA extrait automatiquement le contenu pertinent.",
  },
  {
    image: illustAiQuiz,
    title: "QCM générés par IA",
    description: "Des questions variées : QCM classiques, élection, censure, cas cliniques, Vrai/Faux.",
  },
  {
    image: illustFlashcards,
    title: "Flashcards intelligentes",
    description: "Des cartes de révision générées à partir de vos erreurs pour une mémorisation efficace.",
  },
  {
    image: illustMor,
    title: "Assistant MOR",
    description: "Un tuteur IA disponible 24/7 pour expliquer vos erreurs et approfondir les concepts.",
  },
  {
    image: illustStats,
    title: "Suivi de progression",
    description: "Statistiques détaillées pour visualiser votre évolution et cibler vos lacunes.",
  },
  {
    image: illustSuccess,
    title: "Résumés de cours",
    description: "L'IA génère des résumés structurés de vos cours pour réviser l'essentiel rapidement.",
  },
];

const FeaturesSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="features" className="py-20 relative overflow-hidden" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Tout pour <span className="text-accent-warm">réussir</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Des outils conçus pour les étudiants en médecine et sciences de la santé
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 25 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="group"
            >
              <div className="bg-card rounded-2xl p-6 border border-border hover:border-accent-warm/40 shadow-sm hover:shadow-md transition-all duration-300 text-center h-full">
                <img
                  src={f.image}
                  alt={f.title}
                  loading="lazy"
                  width={120}
                  height={120}
                  className="w-24 h-24 mx-auto mb-4 object-contain"
                />
                <h3 className="text-lg font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
