import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const stats = [
  { number: 50000, suffix: "+", label: "QCM Générés" },
  { number: 12000, suffix: "+", label: "Étudiants Actifs" },
  { number: 95, suffix: "%", label: "Taux de Réussite" },
  { number: 4.9, suffix: "/5", label: "Satisfaction" },
];

const AnimatedNumber = ({ value, suffix, inView }: { value: number; suffix: string; inView: boolean }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current * 10) / 10);
      }
    }, 2000 / steps);
    return () => clearInterval(timer);
  }, [value, inView]);

  const formatted = value >= 1000
    ? `${Math.floor(displayValue / 1000)}K`
    : value < 10
      ? displayValue.toFixed(1)
      : Math.floor(displayValue);

  return <span>{formatted}{suffix}</span>;
};

const StatsSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-12 bg-section-dark" ref={ref}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-3xl lg:text-4xl font-bold text-accent-warm">
                <AnimatedNumber value={stat.number} suffix={stat.suffix} inView={isInView} />
              </div>
              <div className="text-section-dark-foreground/60 text-sm mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
