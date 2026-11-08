import { motion } from "framer-motion";

interface AnimatedBannerProps {
  title: string | React.ReactNode;
  subtitle?: string; // Gardé optionnel, mais nous le masquerons si non fourni (ex: page révision)
  rightWidgets?: React.ReactNode;
}

export const AnimatedBanner = ({ title, subtitle, rightWidgets }: AnimatedBannerProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full max-w-[1300px] mx-auto mb-8 md:mb-12 rounded-3xl md:rounded-[2.5rem] overflow-hidden relative shadow-2xl shadow-black/10"
    >
      {/* Le fond animé avec la vague thermique */}
      <div className="absolute inset-0 bg-thermal-wave opacity-95"></div>
      
      {/* Texture par-dessus pour l'effet premium */}
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>

      {/* Contenu de la banderole */}
      <div className="relative z-10 px-8 py-10 md:px-12 md:py-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
        
        {/* Extrême Gauche : Titre et Sous-titre */}
        <div className="space-y-2 max-w-xl text-white">
          <h1 className="text-4xl md:text-5xl font-light tracking-tighter drop-shadow-sm">
            {title}
          </h1>
          {subtitle && (
            <p className="text-white/70 font-medium text-sm tracking-wide">
              {subtitle}
            </p>
          )}
        </div>

        {/* Extrême Droite : Widgets ou Boutons (Injectés dynamiquement) */}
        <div className="flex flex-wrap items-center justify-end gap-4">
          {rightWidgets}
        </div>

      </div>
    </motion.div>
  );
};
