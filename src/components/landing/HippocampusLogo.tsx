import { motion } from "framer-motion";
import logoImg from "@/assets/logo-hippocampus.jpeg";

interface HippocampusLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "default" | "white" | "gradient";
}

const sizeMap = {
  sm: { icon: 32, text: "text-lg" },
  md: { icon: 40, text: "text-xl" },
  lg: { icon: 56, text: "text-2xl" },
  xl: { icon: 72, text: "text-3xl" },
};

const HippocampusLogo = ({ 
  className = "", 
  size = "md", 
  showText = true,
  variant = "default"
}: HippocampusLogoProps) => {
  const { icon, text } = sizeMap[size];
  
  const textColorClass = variant === "white" 
    ? "text-white" 
    : variant === "gradient" 
      ? "bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
      : "text-foreground";

  return (
    <motion.div 
      className={`flex items-center gap-2 ${className}`}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
    >
      <img 
        src={logoImg} 
        alt="Hippocampus" 
        width={icon} 
        height={icon} 
        className="rounded-xl drop-shadow-lg object-cover"
      />
      
      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold tracking-tight ${text} ${textColorClass}`}>
            Hippocampus
          </span>
          {size !== "sm" && (
            <span className={`text-xs ${variant === "white" ? "text-white/70" : "text-muted-foreground"} -mt-0.5`}>
              Mémorise. Révise. Réussis.
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default HippocampusLogo;
