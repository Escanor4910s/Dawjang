import React, { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-secondary border-b border-border px-4 py-1.5 text-[12px] text-foreground flex items-center justify-center gap-2">
      <WifiOff className="h-3.5 w-3.5 text-primary" />
      <span>Mode hors-ligne actif — Vos QCM et résumés restent accessibles localement.</span>
    </div>
  );
}

export default OfflineIndicator;
