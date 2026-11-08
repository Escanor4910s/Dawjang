import React from "react";

export interface CelebrationOverlayProps {
  show?: boolean;
  message?: string;
  events?: Array<{ title?: string; message?: string }>;
  onComplete?: () => void;
}

export function CelebrationOverlay({
  show = false,
  message = "Objectif atteint",
  events,
  onComplete,
}: CelebrationOverlayProps = {}) {
  const isVisible = show || (Boolean(events && events.length > 0));
  if (!isVisible) return null;

  const displayMessage = message || (events && events[0]?.title) || (events && events[0]?.message) || "Objectif atteint";

  return (
    <div
      onClick={onComplete}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-primary/30 bg-card px-4 py-2.5 shadow-lg text-[13px] font-medium text-foreground animate-in fade-in slide-in-from-bottom-2 duration-200 cursor-pointer"
    >
      {displayMessage}
    </div>
  );
}

export default CelebrationOverlay;
