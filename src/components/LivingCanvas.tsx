import { motion } from "framer-motion";

export const LivingCanvas = () => {
  // ─── TEXTURES VECTORIELLES MATHÉMATIQUES ───
  
  // 1. Le Monogramme Gemini (L'Étoile à 4 branches)
  const geminiPattern = `data:image/svg+xml,%3Csvg width='64' height='64' viewBox='0 0 64 64' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M32 20C32 26.627 26.627 32 20 32C26.627 32 32 37.373 32 44C32 37.373 37.373 32 44 32C37.373 32 32 26.627 32 20Z' fill='black'/%3E%3C/svg%3E`;

  // 2. L'Onde Topographique (La vague fluide)
  const wavePattern = `data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 60 C 30 20, 90 100, 120 60' fill='none' stroke='black' stroke-width='0.5' opacity='0.5'/%3E%3Cpath d='M0 80 C 30 40, 90 120, 120 80' fill='none' stroke='black' stroke-width='0.5' opacity='0.3'/%3E%3C/svg%3E`;

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden bg-[#FAFAF8] dark:bg-[#050505] transition-colors duration-700">
      
      {/* ─── COUCHE 1 : LE GRAIN PHOTOGRAPHIQUE (Le liant organique) ─── */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04] mix-blend-overlay z-40"
        style={{ backgroundImage: `url('https://grainy-gradients.vercel.app/noise.svg')` }}
      />

      {/* ─── MOTEUR D'ANIMATION CSS PUR (Performance 60fps) ─── */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes panDiagonalFast {
          0% { transform: translateY(0) translateX(0); }
          100% { transform: translateY(-64px) translateX(-64px); }
        }
        @keyframes panDiagonalSlow {
          0% { transform: translateY(0) translateX(0); }
          100% { transform: translateY(-120px) translateX(120px); }
        }
        .animate-gemini {
          animation: panDiagonalFast 25s linear infinite;
          mask-image: url("${geminiPattern}");
          -webkit-mask-image: url("${geminiPattern}");
          mask-size: 64px 64px;
          -webkit-mask-size: 64px 64px;
          mask-repeat: repeat;
        }
        .animate-waves {
          animation: panDiagonalSlow 35s linear infinite;
          mask-image: url("${wavePattern}");
          -webkit-mask-image: url("${wavePattern}");
          mask-size: 120px 120px;
          -webkit-mask-size: 120px 120px;
          mask-repeat: repeat;
        }
      `}} />

      {/* ─── COUCHE 2 : L'AURORE COGNITIVE (Lumières statiques optimisées) ─── */}
      <div className="absolute inset-0 z-10 opacity-50 dark:opacity-70">
        
        {/* Le Courant Violet */}
        <div 
          className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-[#5B21B6] rounded-full blur-[140px]"
        />

        {/* Le Flux Émeraude */}
        <div 
          className="absolute bottom-[-10%] right-[-10%] w-[55vw] h-[55vw] bg-[#10B981] rounded-full blur-[150px]"
        />

        {/* L'Étincelle Ambre */}
        <div 
          className="absolute top-[30%] left-[30%] w-[35vw] h-[35vw] bg-[#F59E0B] rounded-full blur-[120px]"
        />
      </div>

      {/* ─── COUCHE 3 : LES VAGUES DIAGONALES (Topologie de fond) ─── */}
      <div className="absolute inset-[-100%] z-20 opacity-[0.03] dark:opacity-[0.05]">
        <div className="w-full h-full animate-waves bg-[#111111] dark:bg-white" />
      </div>

      {/* ─── COUCHE 4 : LA MATRICE GEMINI (Grille de premier plan) ─── */}
      <div className="absolute inset-[-100%] z-20 opacity-[0.05] dark:opacity-[0.08]">
        <div className="w-full h-full animate-gemini bg-[#111111] dark:bg-white" />
      </div>

      {/* ─── VIGNETTAGE : Fondu en douceur sur les bords de l'écran ─── */}
      <div className="absolute inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(250,250,248,0.6)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,5,5,0.7)_100%)]" />
      
    </div>
  );
};
