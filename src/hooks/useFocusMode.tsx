import React, { createContext, useContext, useState, useEffect } from 'react';
import { uiAudio } from '@/utils/audio';

interface FocusContextType {
  isFocusMode: boolean;
  toggleFocusMode: () => void;
  timeLeft: number;
  formatTime: (seconds: number) => string;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export const FocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes par défaut (Pomodoro)

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isFocusMode && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      // Fin du Pomodoro
      setIsFocusMode(false);
      uiAudio.playSuccessChime(); // Son de réussite
      setTimeLeft(25 * 60); // Reset
    }

    return () => clearInterval(interval);
  }, [isFocusMode, timeLeft]);

  const toggleFocusMode = () => {
    uiAudio.playToggle();
    if (!isFocusMode) {
      setTimeLeft(25 * 60); // Reset timer quand on lance
      uiAudio.startBinauralBeats(); // Lance les ondes alpha/gamma
    } else {
      uiAudio.stopBinauralBeats();
    }
    setIsFocusMode(!isFocusMode);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <FocusContext.Provider value={{ isFocusMode, toggleFocusMode, timeLeft, formatTime }}>
      {children}
    </FocusContext.Provider>
  );
};

export const useFocusMode = () => {
  const context = useContext(FocusContext);
  if (context === undefined) {
    throw new Error('useFocusMode must be used within a FocusProvider');
  }
  return context;
};
