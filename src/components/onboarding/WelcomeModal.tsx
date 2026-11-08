// src/components/onboarding/WelcomeModal.tsx
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckSquare, FileText, Infinity as InfinityIcon } from "lucide-react";
import {
  DawJangDragonIcon,
  DawJangWordmark,
} from "@/components/landing/HippocampusLogo";

const WELCOME_SEEN_KEY = "dawjang_welcome_seen_v1";

export interface WelcomeModalProps {
  userName?: string;
  onClose?: () => void;
  onStartTour?: () => void;
}

export function WelcomeModal({ userName, onClose, onStartTour }: WelcomeModalProps = {}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(WELCOME_SEEN_KEY);
    if (!seen) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(WELCOME_SEEN_KEY, "true");
    setOpen(false);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-2">
            <DawJangDragonIcon className="h-8 w-8 text-foreground" />
            <DawJangWordmark size="md" />
          </div>
          <DialogTitle className="font-serif text-2xl font-normal">
            Bienvenue sur votre Studio DawJang
          </DialogTitle>
          <DialogDescription>
            Votre espace de travail a été conçu pour la clarté cognitive, la vitesse d'exécution et l'excellence académique.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {[
            {
              icon: CheckSquare,
              title: "Constructeur & Banque QCM",
              desc: "Créez vos propres dossiers, générez des QCM par IA ou lancez le Mode Examen.",
            },
            {
              icon: FileText,
              title: "Générateur de Résumés & Rédacteur",
              desc: "Développez vos cours à partir des objectifs et éditez-les librement.",
            },
            {
              icon: InfinityIcon,
              title: "Flashcards Calibrées & Duels",
              desc: "Révisez par objectifs, pertinence ou erreurs QCM et affrontez vos pairs.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3 rounded-xl border border-border/80 bg-secondary/35 p-3.5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card border border-border text-primary">
                <item.icon className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-[13.5px] font-semibold text-foreground">
                  {item.title}
                </h4>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            Entrer dans DawJang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WelcomeModal;
