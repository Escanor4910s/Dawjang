import React from 'react';

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}

const GlowCard: React.FC<GlowCardProps> = ({ children, className = "", innerClassName = "" }) => {
  return (
    <div className={`relative group perspective-2000 ${className}`}>
      {/* LA BORDURE LUMINEUSE ANIMÉE */}
      <div className="absolute -inset-[2px] rounded-[2.5rem] animate-border-spin opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      
      {/* Ombre Abyssale */}
      <div className="absolute inset-0 bg-black/40 blur-[30px] rounded-[2rem] pointer-events-none -z-10 translate-y-5 transition-all duration-700 group-hover:blur-[50px] group-hover:bg-black/50" />

      {/* Conteneur intérieur (Verre dépoli chaud) */}
      <div className={`relative z-10 w-full h-full bg-[#FCFBF8]/95 backdrop-blur-3xl text-[#111111] rounded-[calc(2.5rem-2px)] shadow-inner overflow-hidden border border-white/50 ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
};

export default GlowCard;
