import React from 'react';
import { motion } from 'framer-motion';

const HighlightCircle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <motion.path d="M 50 10 C 80 10 90 40 90 50 C 90 80 40 90 30 80 C 10 60 20 10 50 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, ease: "easeInOut", delay: 0.2 }}
    />
  </svg>
);

const DrawnArrow = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <motion.path d="M10 90 Q 40 10 90 10 M 70 10 L 90 10 L 90 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" 
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
    />
  </svg>
);

interface DashboardShellProps {
  children: React.ReactNode;
  className?: string;
}

const DashboardShell: React.FC<DashboardShellProps> = ({ children, className = "" }) => {
  return (
    <div className={`min-h-screen bg-mosaic-wave text-white font-sans relative overflow-hidden transition-colors duration-500 ${className}`}>
      {/* ─── BACKGROUND EFFECTS 70/70 ─── */}
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none z-0" />
      <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] bg-[#5B21B6]/30 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-pink-500/10 blur-[150px] rounded-full pointer-events-none z-0" />
      
      {/* ─── FILIGRANES SUBTILS ─── */}
      <motion.div initial={{ opacity: 0, rotate: 10 }} animate={{ opacity: 0.1, rotate: 5 }} className="absolute top-[10%] left-[5%] text-6xl font-serif italic font-bold text-white select-none pointer-events-none z-0 mix-blend-overlay">
        DawJang.
        <HighlightCircle className="absolute -inset-6 text-white/30 w-[150%] h-[150%]" />
      </motion.div>
      <DrawnArrow className="absolute bottom-[20%] right-[10%] w-32 h-32 text-white/10 -rotate-12 pointer-events-none z-0 mix-blend-overlay" />

      {/* ─── CONTENU PRINCIPAL ─── */}
      <div className="relative z-10 w-full h-full p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

export default DashboardShell;
