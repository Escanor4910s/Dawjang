// src/pages/Privacy.tsx
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Lock, Database, EyeOff, Trash2, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import {
  DawJangDragonIcon,
  DawJangWordmark,
} from "@/components/landing/HippocampusLogo";

export default function Privacy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#FAF9F5] dark:bg-[#111110] text-[#141413] dark:text-[#F5F3EE]">
      <header className="sticky top-0 z-50 border-b border-[#E5E2DC] dark:border-white/10 bg-[#FAF9F5]/90 dark:bg-[#111110]/90 backdrop-blur-xl py-3.5">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <DawJangDragonIcon className="h-9 w-9 text-foreground" />
            <div className="flex flex-col">
              <DawJangWordmark size="md" />
              <span className="text-[10.5px] font-medium text-muted-foreground leading-none mt-0.5">
                Studio Académique
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-[12.5px] font-semibold hover:border-foreground/40 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Retour à l'accueil</span>
            </Link>
            <UserAvatar inHeader={true} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-16 space-y-10">
        <div className="space-y-3 border-b border-border/80 pb-8">
          <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-primary font-bold">
            <Lock className="h-3.5 w-3.5" />
            PROTECTION DES DONNÉES ÉTUDIANTES • MISE À JOUR 2026
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl text-foreground">
            Politique de Confidentialité
          </h1>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            La présente Politique de Confidentialité détaille la manière dont
            DawJang collecte, protège et synchronise vos données académiques et
            personnelles.
          </p>
        </div>

        <div className="space-y-8 text-[14.5px] leading-relaxed text-foreground/90">
          <section className="rounded-2xl border border-border bg-card p-6 space-y-2.5">
            <h2 className="font-serif text-2xl text-foreground flex items-center gap-2.5">
              <Database className="h-5 w-5 text-primary" />
              1. Propriété exclusive de vos cours et annales
            </h2>
            <p className="text-muted-foreground">
              Tous les documents que vous importez dans DawJang (polycopiés PDF,
              diaporamas de cours, sujets d'examens passés, fiches du Rédacteur,
              banques de QCM et flashcards) demeurent votre propriété
              intellectuelle stricte. Ils ne sont jamais revendus, ni partagés
              publiquement sans votre action explicite.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 space-y-2.5">
            <h2 className="font-serif text-2xl text-foreground flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-primary" />
              2. Données de profil et synchronisation hybride
            </h2>
            <p className="text-muted-foreground">
              Lors de votre inscription, nous recueillons uniquement les
              informations nécessaires au calibrage de votre studio : votre nom,
              votre adresse e-mail, votre numéro de téléphone (pour pré-remplir
              vos souscriptions Wave / Orange Money), votre niveau d'étude
              (Licence 1 à Doctorat / Internat) et votre faculté.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 space-y-2.5">
            <h2 className="font-serif text-2xl text-foreground flex items-center gap-2.5">
              <Trash2 className="h-5 w-5 text-primary" />
              3. Droit à l'effacement et suppression définitive
            </h2>
            <p className="text-muted-foreground">
              Chaque suppression d'un cours, d'un QCM ou d'une flashcard est
              immédiatement appliquée en local et sur nos serveurs grâce à notre
              registre d'exclusion permanent. Vous pouvez également exporter ou
              purger l'intégralité de vos données depuis la page Paramètres.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-2">
            <h2 className="font-serif text-xl sm:text-2xl text-foreground flex items-center gap-2.5">
              <EyeOff className="h-5 w-5 text-primary shrink-0" />
              <span>4. Contact du responsable de la confidentialité</span>
            </h2>
            <p className="text-muted-foreground text-[13.5px] sm:text-[14.5px]">
              Pour toute demande relative à vos données personnelles, vous
              pouvez nous joindre directement à l'adresse{" "}
              <strong className="text-foreground break-all">
                tallathiam232@gmail.com
              </strong>{" "}
              ou au{" "}
              <strong className="text-foreground">+221 76 821 91 39</strong>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
