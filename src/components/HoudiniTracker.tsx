import { useEffect } from 'react';

export function HoudiniTracker() {
  useEffect(() => {
    let tick = 0;
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`);
    };

    const updateTick = () => {
      tick += 0.002;
      document.documentElement.style.setProperty('--animation-tick', tick.toString());
      animationFrameId = requestAnimationFrame(updateTick);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    updateTick();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return null;
}
