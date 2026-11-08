import { useEffect, useRef, useState } from "react";
import { Heart, Activity, Droplets, Thermometer, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

interface EcgMonitorProps {
  bpm: number;
  spo2: number;
  bloodPressure: string;
  temperature: number;
  isStable: boolean;
  status: "stable" | "unstable" | "critical";
}

export const EcgMonitor = ({
  bpm,
  spo2,
  bloodPressure,
  temperature,
  isStable,
  status,
}: EcgMonitorProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [pulse, setPulse] = useState(false);

  // Play cardiac beep on each beat
  const playCardiacBeep = () => {
    try {
      if (!audioContextRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // Critical alert has higher pitched beep
      if (status === "critical") {
        osc.frequency.setValueAtTime(980, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.frequency.setValueAtTime(650, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch (e) {
      // Ignored if blocked by browser autoplay policy
    }
  };

  // Real-time canvas ECG sweeping wave
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let x = 0;
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = "#0c111d";
    ctx.fillRect(0, 0, width, height);

    // Grid lines for hospital monitor look
    const drawGrid = () => {
      ctx.strokeStyle = "rgba(16, 185, 129, 0.04)";
      ctx.lineWidth = 1;
      
      // Vertical grid lines
      for (let i = 0; i < width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      // Horizontal grid lines
      for (let j = 0; j < height; j += 20) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(width, j);
        ctx.stroke();
      }
    };

    // Cardiac cycle configuration
    let lastBeatTime = Date.now();
    const points: { x: number; y: number }[] = Array.from({ length: width }, (_, index) => ({
      x: index,
      y: height / 2,
    }));

    const render = () => {
      const now = Date.now();
      const beatIntervalMs = (60 / bpm) * 1000;
      const isBeating = now - lastBeatTime >= beatIntervalMs;

      if (isBeating) {
        lastBeatTime = now;
        setPulse(true);
        playCardiacBeep();
        setTimeout(() => setPulse(false), 150);
      }

      // ECG wave generation
      const timeSinceBeat = now - lastBeatTime;
      let targetY = height / 2;

      // Draw QRS medical spike complex
      if (timeSinceBeat < 350) {
        const t = timeSinceBeat;
        if (t < 50) {
          // P wave (small atrial contraction)
          targetY = height / 2 - 5;
        } else if (t >= 50 && t < 100) {
          // Isoelectric segment
          targetY = height / 2;
        } else if (t >= 100 && t < 120) {
          // Q wave (initial downward deflection)
          targetY = height / 2 + 8;
        } else if (t >= 120 && t < 155) {
          // R wave (huge clinical ventricular contraction)
          const ratio = (t - 120) / 35;
          targetY = height / 2 - 45 + (status === "critical" ? 15 : 0); // Varies by state
        } else if (t >= 155 && t < 190) {
          // S wave (deep downward deflection)
          targetY = height / 2 + 18;
        } else if (t >= 190 && t < 240) {
          // Return to baseline
          targetY = height / 2;
        } else if (t >= 240 && t < 330) {
          // T wave (ventricular repolarization)
          targetY = height / 2 - 10;
        }
      } else {
        // Flatline if BPM is 0 or ventricular fibrillation simulation
        if (bpm === 0) {
          targetY = height / 2 + (Math.random() - 0.5) * 1.5;
        } else if (status === "critical") {
          // Add chaotic ventricular jitter
          targetY = height / 2 + (Math.random() - 0.5) * 4;
        }
      }

      // Add a sweeping gap like a real CRT phosphor monitor
      const sweepWidth = 18;
      const startX = x;
      const endX = (x + sweepWidth) % width;

      // Update points array at current cursor position
      for (let i = 0; i < sweepWidth; i++) {
        const currentIdx = (x + i) % width;
        points[currentIdx].y = targetY;
      }

      // Repaint entire screen with trace
      ctx.fillStyle = "#0a0f1d";
      ctx.fillRect(0, 0, width, height);
      
      drawGrid();

      // Render glowing green/red neon tracing line
      ctx.beginPath();
      ctx.lineWidth = 2.5;
      
      const isCritical = status === "critical";
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      
      if (isCritical) {
        ctx.strokeStyle = "#f43f5e";
        ctx.shadowColor = "rgba(244, 63, 94, 0.4)";
      } else if (status === "unstable") {
        ctx.strokeStyle = "#f59e0b";
        ctx.shadowColor = "rgba(245, 158, 11, 0.4)";
      } else {
        ctx.strokeStyle = "#10b981";
        ctx.shadowColor = "rgba(16, 185, 129, 0.4)";
      }
      
      ctx.shadowBlur = 8;

      let firstPoint = true;
      
      // Draw all points except the sweep cursor gap area
      for (let i = 0; i < width; i++) {
        // Skip drawing inside the sweeping gap
        const inGap = startX < endX 
          ? (i >= startX && i <= endX)
          : (i >= startX || i <= endX);
          
        if (inGap) {
          firstPoint = true;
          continue;
        }

        if (firstPoint) {
          ctx.beginPath();
          ctx.moveTo(points[i].x, points[i].y);
          firstPoint = false;
        } else {
          ctx.lineTo(points[i].x, points[i].y);
        }
      }
      ctx.stroke();

      // Draw sweeping scan cursor dot
      ctx.beginPath();
      ctx.arc(points[startX].x, points[startX].y, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = isCritical ? "#ff7e8e" : "#34d399";
      ctx.fill();

      // Increment x coordinate
      x = (x + 2) % width;

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, status]);

  // Color mappings based on severity status
  const themeColors = {
    critical: {
      text: "text-rose-500",
      bg: "bg-rose-500/10",
      border: "border-rose-500/30 animate-pulse",
      glow: "shadow-[0_0_15px_rgba(244,63,94,0.15)]",
    },
    unstable: {
      text: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      glow: "shadow-[0_0_15px_rgba(245,158,11,0.15)]",
    },
    stable: {
      text: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.05)]",
    },
  }[status];

  return (
    <div className={`p-4 rounded-3xl bg-[#0a0f1d] border ${themeColors.border} ${themeColors.glow} space-y-4`}>
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Activity className={`h-4.5 w-4.5 ${themeColors.text} ${status !== "stable" && "animate-pulse"}`} />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/80">Moniteur de Réanimation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${pulse ? "scale-125 bg-rose-500" : "bg-muted-foreground/45"} transition-all duration-75`} />
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/60">SYS ACTIVE</span>
        </div>
      </div>

      {/* Main Tracing screen */}
      <div className="relative rounded-2xl overflow-hidden border border-white/5 bg-[#0c111d] shadow-inner">
        <canvas 
          ref={canvasRef} 
          width={420} 
          height={130} 
          className="w-full h-[130px] block"
        />
        {status === "critical" && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-500 text-[9px] font-black uppercase tracking-wider animate-bounce">
            <ShieldAlert className="h-3 w-3" /> ALERTE CRITIQUE
          </div>
        )}
      </div>

      {/* Hospital constant grid readout */}
      <div className="grid grid-cols-4 gap-3 pt-1">
        {/* Heart Rate */}
        <div className="bg-[#0c111d] p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute top-1 left-2 flex items-center gap-1">
            <Heart className="h-3 w-3 text-rose-500" />
            <span className="text-[8px] font-black text-muted-foreground/80 uppercase">FC</span>
          </div>
          <p className="text-2xl font-black font-mono text-rose-500 tracking-tight mt-2 animate-pulse">{bpm}</p>
          <span className="text-[8px] font-extrabold text-muted-foreground/65 uppercase tracking-wider mt-0.5">BPM</span>
        </div>

        {/* SpO2 */}
        <div className="bg-[#0c111d] p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-1 left-2 flex items-center gap-1">
            <Droplets className="h-3 w-3 text-sky-400" />
            <span className="text-[8px] font-black text-muted-foreground/80 uppercase">SpO2</span>
          </div>
          <p className="text-2xl font-black font-mono text-sky-400 tracking-tight mt-2">{spo2}</p>
          <span className="text-[8px] font-extrabold text-muted-foreground/65 uppercase tracking-wider mt-0.5">%</span>
        </div>

        {/* Blood Pressure */}
        <div className="bg-[#0c111d] p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-1 left-2 flex items-center gap-1">
            <Activity className="h-3 w-3 text-amber-500" />
            <span className="text-[8px] font-black text-muted-foreground/80 uppercase">TA</span>
          </div>
          <p className="text-xl font-black font-mono text-amber-500 tracking-tight mt-3">{bloodPressure}</p>
          <span className="text-[8px] font-extrabold text-muted-foreground/65 uppercase tracking-wider mt-0.5">mmHg</span>
        </div>

        {/* Temperature */}
        <div className="bg-[#0c111d] p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-1 left-2 flex items-center gap-1">
            <Thermometer className="h-3 w-3 text-purple-400" />
            <span className="text-[8px] font-black text-muted-foreground/80 uppercase">T°</span>
          </div>
          <p className="text-2xl font-black font-mono text-purple-400 tracking-tight mt-2">{temperature}°</p>
          <span className="text-[8px] font-extrabold text-muted-foreground/65 uppercase tracking-wider mt-0.5">CELSIUS</span>
        </div>
      </div>
    </div>
  );
};
