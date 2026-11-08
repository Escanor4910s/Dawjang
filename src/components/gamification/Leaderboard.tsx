import React, { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PeerEntry {
  rank: number;
  name: string;
  fac: string;
  points: number;
  accuracy: string;
  isCurrent?: boolean;
}

const DEFAULT_PEERS: PeerEntry[] = [
  { rank: 1, name: "Camille R.", fac: "Paris Cité", points: 4820, accuracy: "89%" },
  { rank: 2, name: "Thomas L.", fac: "Lyon Est", points: 4610, accuracy: "86%" },
  { rank: 3, name: "Vous", fac: "Session active", points: 4390, accuracy: "84%", isCurrent: true },
  { rank: 4, name: "Sarah M.", fac: "Bordeaux", points: 4150, accuracy: "81%" },
  { rank: 5, name: "Lucas V.", fac: "Montpellier", points: 3980, accuracy: "79%" },
];

export function Leaderboard({ className }: { className?: string }) {
  const [peers, setPeers] = useState<PeerEntry[]>(DEFAULT_PEERS);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Vous";
        setPeers((prev) =>
          prev.map((p) =>
            p.isCurrent
              ? { ...p, name: `Vous (${userName})` }
              : p
          )
        );
      }
    });
  }, []);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3 border-b border-border/70">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <Trophy className="h-4 w-4 text-primary" />
            Classement Inter-Facultés
          </CardTitle>
          <span className="font-mono text-[11px] text-muted-foreground">
            Hebdomadaire
          </span>
        </div>
        <CardDescription>
          Indice calculé sur la régularité d'ancrage et la précision aux QCM.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-border/60">
        {peers.map((peer) => (
          <div
            key={peer.rank}
            className={cn(
              "group flex items-center justify-between px-5 py-3 text-[13px] transition-colors",
              peer.isCurrent ? "bg-primary/[0.06] font-semibold" : "hover:bg-secondary/50"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-[12px] text-muted-foreground w-5 tabular-nums">
                #{peer.rank}
              </span>
              <div>
                <span className="text-foreground group-hover:text-primary transition-colors block">
                  {peer.name}
                </span>
                <span className="text-[11px] text-muted-foreground">{peer.fac}</span>
              </div>
            </div>
            <div className="text-right font-mono tabular-nums">
              <span className="text-foreground font-semibold block">{peer.points} pts</span>
              <span className="text-[11px] text-primary">{peer.accuracy}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default Leaderboard;
