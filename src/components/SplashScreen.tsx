import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { DawJangDragonIcon, DawJangWordmark } from "@/components/landing/HippocampusLogo";

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen = ({ onFinish }: SplashScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Le splash screen reste visible pendant 2 secondes
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Attend la fin de l'animation de sortie (0.8s) avant de notifier App.tsx
      setTimeout(onFinish, 800);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(10px)" }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FDFDFD] dark:bg-[#050505] overflow-hidden"
        >
          {/* Cercles lumineux en arrière-plan (Ambiance médicale/futuriste) */}
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute w-[40vw] h-[40vw] rounded-full bg-gradient-to-tr from-indigo-500/20 to-pink-500/20 blur-[100px]"
          />

          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative z-10 flex flex-col items-center gap-6"
          >
            {/* Conteneur du Logo */}
            <div className="relative flex items-center justify-center w-24 h-24 rounded-[2rem] bg-white/50 dark:bg-black/50 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.1)] dark:shadow-[0_0_40px_rgba(255,255,255,0.05)]">
              <motion.div
                animate={{ 
                  boxShadow: ["0px 0px 0px rgba(236,72,153,0)", "0px 0px 30px rgba(236,72,153,0.4)", "0px 0px 0px rgba(236,72,153,0)"]
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-[2rem]"
              />
              <DawJangDragonIcon className="w-14 h-14 text-foreground" />
            </div>

            {/* Texte Typographique DawJang */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex flex-col items-center gap-2"
            >
              <DawJangWordmark size="lg" />
              <div className="flex gap-1.5 mt-1">
                <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
