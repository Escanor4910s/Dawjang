import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground text-center py-1.5 text-sm font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top">
      <WifiOff className="h-4 w-4" />
      Mode hors-ligne — Les données affichées peuvent ne pas être à jour
    </div>
  );
};

export default OfflineIndicator;
