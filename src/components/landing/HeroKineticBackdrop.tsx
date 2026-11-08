// src/components/landing/HeroKineticBackdrop.tsx
import React from "react";

/**
 * SCÈNE MOTION DESIGN ILLUSTRÉE EN PARALLAXE 3D (ZÉRO FILS / TRAITS ABSTRAITS)
 * Met en scène 3 véritables illustrations animées d'horlogerie académique :
 * 1. L'Extracteur Iso-3D de Cours & Annales (Feuilles en lévitation + Rayon de scan actif)
 * 2. Le Cardiographe & Radar de Probabilités (Onde systolique temps réel + Jauges animées)
 * 3. L'Arche Iso-3D de Cartes Mémoire & Sceaux en rotation spatiale autour du studio
 */
export function HeroKineticBackdrop() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      <style>{`
        /* 1. Mouvement des volumes de lumière d'atelier */
        @keyframes djStudioLightA {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(4%, -4%, 0) scale(1.08); }
        }
        @keyframes djStudioLightB {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-5%, 5%, 0) scale(1.1); }
        }

        /* 2. Animation de la pile isométrique de feuilles de cours & faisceau laser */
        @keyframes djSheetLevitateTop {
          0%, 100% { transform: translateY(0px) rotate(-6deg); }
          50% { transform: translateY(-14px) rotate(-4deg); }
        }
        @keyframes djSheetLevitateMid {
          0%, 100% { transform: translateY(0px) rotate(-6deg); }
          50% { transform: translateY(-7px) rotate(-5deg); }
        }
        @keyframes djLaserScanSweep {
          0%, 100% { transform: translateY(12px); opacity: 0.25; }
          50% { transform: translateY(118px); opacity: 0.95; }
        }
        @keyframes djExtractedBlockPop {
          0%, 20%, 100% { transform: translate3d(0, 0, 0) scale(0.96); opacity: 0.65; }
          50%, 80% { transform: translate3d(10px, -12px, 0) scale(1.04); opacity: 1; }
        }

        /* 3. Animation du Moniteur Systolique & Barres de Probabilités */
        @keyframes djSystolicWave {
          0% { stroke-dashoffset: 440; }
          50% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -440; }
        }
        @keyframes djBarPulse1 {
          0%, 100% { height: 78%; }
          50% { height: 96%; }
        }
        @keyframes djBarPulse2 {
          0%, 100% { height: 88%; }
          50% { height: 68%; }
        }
        @keyframes djBarPulse3 {
          0%, 100% { height: 62%; }
          50% { height: 91%; }
        }

        /* 4. Bascule 3D des Flashcards et Sceaux en arrière-plan droit */
        @keyframes djCard3DFlip {
          0%, 100% {
            transform: perspective(900px) rotateY(-18deg) rotateX(8deg) translateY(0px);
          }
          50% {
            transform: perspective(900px) rotateY(16deg) rotateX(-6deg) translateY(-14px);
          }
        }
        @keyframes djOrbitFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(4deg); }
        }

        .dj-light-a { animation: djStudioLightA 16s ease-in-out infinite; }
        .dj-light-b { animation: djStudioLightB 20s ease-in-out infinite; }
        .dj-sheet-top { animation: djSheetLevitateTop 5.2s ease-in-out infinite; }
        .dj-sheet-mid { animation: djSheetLevitateMid 5.2s ease-in-out 0.35s infinite; }
        .dj-laser-scan { animation: djLaserScanSweep 4.4s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
        .dj-extracted-pop { animation: djExtractedBlockPop 4.4s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
        .dj-systolic-path {
          stroke-dasharray: 440;
          animation: djSystolicWave 6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .dj-card-3d { animation: djCard3DFlip 7s ease-in-out infinite; }
        .dj-orbit-float { animation: djOrbitFloat 6s ease-in-out infinite; }
      `}</style>

      {/* =====================================================================
          1. ÉCLAIRAGE VOLUMÉTRIQUE D'ATELIER & DAMIER ARCHITECTURAL DOUX
         ===================================================================== */}
      <div
        className="dj-light-a absolute -top-24 right-[6%] h-[520px] w-[580px] rounded-full opacity-[0.22] dark:opacity-[0.16] blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, #C96442 0%, #D99B52 50%, transparent 74%)",
        }}
      />
      <div
        className="dj-light-b absolute bottom-[-10%] left-[4%] h-[460px] w-[520px] rounded-full opacity-[0.16] dark:opacity-[0.12] blur-[105px]"
        style={{
          background:
            "radial-gradient(circle, #D99B52 0%, #C96442 45%, transparent 72%)",
        }}
      />

      {/* Grille de précision architecturale estompée sur les bords */}
      <div
        className="absolute inset-0 opacity-[0.36] dark:opacity-[0.14]"
        style={{
          backgroundImage:
            "radial-gradient(#C96442 1px, transparent 1px), radial-gradient(#141413 0.75px, transparent 0.75px)",
          backgroundSize: "48px 48px",
          backgroundPosition: "0 0, 24px 24px",
          maskImage:
            "radial-gradient(ellipse 85% 70% at 50% 45%, #000 20%, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 85% 70% at 50% 45%, #000 20%, transparent 85%)",
        }}
      />

      {/* =====================================================================
          2. SCÈNE MOTION DESIGN HAUT-GAUCHE :
             L'EXTRACTEUR ISOMÉTRIQUE 3D D'ANNALES & POLYCOPIÉS
         ===================================================================== */}
      <div className="hidden xl:block absolute left-[1.5%] top-[13%] w-[240px] h-[230px] opacity-90 dark:opacity-80">
        {/* Feuille d'archive inférieure (Annales 2024) */}
        <div
          style={{ transform: "rotate(-6deg)" }}
          className="absolute left-4 top-10 w-[175px] h-[145px] rounded-2xl border border-[#DEDAD0] dark:border-white/10 bg-[#F3EFE6] dark:bg-[#191816] shadow-md p-3.5"
        >
          <div className="h-2 w-16 rounded bg-[#D8D4CC] dark:bg-white/15 mb-2" />
          <div className="space-y-1.5">
            <div className="h-1.5 w-full rounded bg-[#E5E2DC] dark:bg-white/10" />
            <div className="h-1.5 w-4/5 rounded bg-[#E5E2DC] dark:bg-white/10" />
          </div>
        </div>

        {/* Feuille intermédiaire (Annales 2025) */}
        <div className="dj-sheet-mid absolute left-7 top-6 w-[175px] h-[145px] rounded-2xl border border-[#D8D4CC] dark:border-white/15 bg-[#FAF8F5] dark:bg-[#1E1D1B] shadow-lg p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[8.5px] font-bold uppercase text-[#6E6D68] dark:text-white/50">
              ANNALES CARDIO
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          </div>
          <div className="space-y-1.5">
            <div className="h-1.5 w-full rounded bg-[#E5E2DC] dark:bg-white/10" />
            <div className="h-1.5 w-3/4 rounded bg-[#E5E2DC] dark:bg-white/10" />
          </div>
        </div>

        {/* Feuille supérieure en lévitation + Rayon Laser de Scan Terracotta */}
        <div className="dj-sheet-top absolute left-10 top-2 w-[182px] h-[152px] rounded-2xl border border-[#C96442]/45 bg-white dark:bg-[#22201E] shadow-[0_20px_45px_-12px_rgba(20,20,19,0.16)] p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-2.5">
            <span className="rounded bg-[#C96442]/15 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-[#C96442]">
              ANALYSE IA EN COURS
            </span>
            <span className="font-mono text-[9px] font-bold text-[#141413] dark:text-white">
              PDF
            </span>
          </div>

          {/* Lignes du polycopié dessiné */}
          <div className="space-y-2">
            <div className="h-2 w-5/6 rounded-full bg-[#141413]/15 dark:bg-white/20" />
            <div className="h-1.5 w-full rounded-full bg-[#141413]/10 dark:bg-white/10" />
            <div className="rounded-lg border border-[#C96442]/40 bg-[#C96442]/10 p-2 space-y-1">
              <div className="h-1.5 w-4/5 rounded-full bg-[#C96442]" />
              <div className="h-1.5 w-3/5 rounded-full bg-[#C96442]/70" />
            </div>
            <div className="h-1.5 w-4/5 rounded-full bg-[#141413]/10 dark:bg-white/10" />
          </div>

          {/* Barre laser de scan qui balaye la feuille de haut en bas */}
          <div className="dj-laser-scan absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-transparent via-[#C96442] to-transparent shadow-[0_0_12px_#C96442]" />
        </div>

        {/* Étiquette d'objectif extraite en 3D hors de la page */}
        <div className="dj-extracted-pop absolute -right-3 bottom-6 rounded-xl border border-[#C96442] bg-[#141413] text-white px-3 py-2 shadow-xl">
          <span className="font-mono text-[8.5px] uppercase tracking-wider text-[#FF7A52] block">
            OBJECTIF DÉTECTÉ
          </span>
          <span className="text-[11px] font-semibold">
            Piège de Censure isolé ✓
          </span>
        </div>
      </div>

      {/* =====================================================================
          3. SCÈNE MOTION DESIGN BAS-GAUCHE :
             MONITEUR SYSTOLIQUE & JAUGES DE PROBABILITÉS DYNAMIQUES
         ===================================================================== */}
      <div className="dj-orbit-float hidden xl:flex absolute left-[2%] bottom-[8%] w-[252px] flex-col gap-3 rounded-2xl border border-[#DEDAD0] dark:border-white/15 bg-white/90 dark:bg-[#1B1A18]/90 backdrop-blur-md p-4 shadow-[0_20px_50px_-15px_rgba(20,20,19,0.14)]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-[#5E5D59] dark:text-white/70">
            Fréquence des sujets
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
            Calibré
          </span>
        </div>

        {/* Tracé ECG dessiné au trait pur */}
        <div className="rounded-xl border border-[#E5E2DC] dark:border-white/10 bg-[#FAF9F5] dark:bg-[#141312] px-3 py-2">
          <svg
            viewBox="0 0 220 42"
            fill="none"
            className="w-full h-8 overflow-visible"
          >
            <path
              d="M 2 24 L 38 24 L 46 16 L 54 24 L 68 24 L 75 33 L 84 5 L 93 37 L 102 20 L 114 24 L 152 24 L 162 12 L 172 24 L 218 24"
              stroke="rgba(201, 100, 66, 0.18)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 2 24 L 38 24 L 46 16 L 54 24 L 68 24 L 75 33 L 84 5 L 93 37 L 102 20 L 114 24 L 152 24 L 162 12 L 172 24 L 218 24"
              stroke="#C96442"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="dj-systolic-path"
            />
          </svg>
        </div>

        {/* 3 Barres de Probabilités qui pulsent en temps réel */}
        <div className="grid grid-cols-3 gap-2 pt-0.5">
          {[
            { label: "Anémies", prob: "96%", anim: "djBarPulse1 4s ease-in-out infinite" },
            { label: "Embolie", prob: "93%", anim: "djBarPulse2 4.5s ease-in-out infinite" },
            { label: "Valvulo.", prob: "89%", anim: "djBarPulse3 3.8s ease-in-out infinite" },
          ].map((b) => (
            <div
              key={b.label}
              className="rounded-lg border border-[#E5E2DC] dark:border-white/10 bg-[#FAF9F5] dark:bg-white/[0.03] p-2 text-center"
            >
              <div className="h-10 w-2.5 mx-auto rounded-full bg-[#E5E2DC] dark:bg-white/10 flex items-end overflow-hidden mb-1">
                <div
                  style={{ animation: b.anim }}
                  className="w-full rounded-full bg-[#C96442]"
                />
              </div>
              <span className="font-mono text-[10px] font-bold text-[#C96442] block">
                {b.prob}
              </span>
              <span className="text-[9.5px] text-[#6E6D68] dark:text-white/60 truncate block">
                {b.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* =====================================================================
          4. SCÈNE MOTION DESIGN DROITE :
             CARTE MÉMOIRE 3D EN BASCULE SPATIALE & ÉPURE D'ARCHITECTURE
         ===================================================================== */}
      <div className="dj-card-3d hidden 2xl:flex absolute right-[1.2%] bottom-[12%] w-[210px] flex-col justify-between rounded-2xl border border-[#C96442]/40 bg-white/90 dark:bg-[#1E1D1B]/90 backdrop-blur-md p-4 shadow-[0_24px_50px_-12px_rgba(201,100,66,0.22)]">
        <div className="flex items-center justify-between border-b border-[#E5E2DC] dark:border-white/10 pb-2">
          <span className="font-mono text-[9px] font-bold uppercase text-[#C96442]">
            FLASHCARD 3D
          </span>
          <span className="rounded bg-[#C96442]/15 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-[#C96442]">
            +15 XP
          </span>
        </div>
        <p className="font-serif text-[13.5px] text-[#141413] dark:text-white leading-snug my-2.5">
          Triade de Duroziez dans le Rétrécissement Mitral
        </p>
        <div className="flex items-center justify-between text-[10px] text-[#6E6D68] dark:text-white/60">
          <span>Ancrage actif</span>
          <span className="font-mono font-bold text-emerald-600">Maîtrisé</span>
        </div>
      </div>
    </div>
  );
}

export default HeroKineticBackdrop;
