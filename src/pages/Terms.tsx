// src/pages/Terms.tsx
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { FileCheck, Scale, CreditCard, Award, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import {
  DawJangDragonIcon,
  DawJangWordmark,
} from "@/components/landing/HippocampusLogo";

export default function Terms() {
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
            <FileCheck className="h-3.5 w-3.5" />
            CADRE CONTRACTUEL & ACADÉMIQUE • ÉDITION 2026
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl text-foreground">
            Conditions Générales d'Utilisation
          </h1>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            Les présentes Conditions Générales d'Utilisation régissent l'accès
            et l'utilisation du studio académique DawJang.
          </p>
        </div>

        <div className="space-y-8 text-[14.5px] leading-relaxed text-foreground/90">
          <section className="rounded-2xl border border-border bg-card p-6 space-y-2.5">
            <h2 className="font-serif text-2xl text-foreground flex items-center gap-2.5">
              <Scale className="h-5 w-5 text-primary" />
              1. Objet et vocation pédagogique
            </h2>
            <p className="text-muted-foreground">
              DawJang fournit aux étudiants de l'enseignement supérieur (de la
              Licence 1 au Doctorat / Internat) des instruments d'analyse de
              cours, de génération docimologique de QCM, de calcul de
              probabilités d'annales et de mémorisation active.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 space-y-2.5">
            <h2 className="font-serif text-2xl text-foreground flex items-center gap-2.5">
              <CreditCard className="h-5 w-5 text-primary" />
              2. Plans (Initié, Taoïste, Napoléon) & Résiliation
            </h2>
            <p className="text-muted-foreground">
              Le Plan Initié est accessible gratuitement. Les Plans Taoïste et
              Napoléon débloquent des crédits d'analyse IA et des fonctionnalités
              d'upload de masse. Vous conservez la liberté de résilier votre
              abonnement à tout moment en un clic depuis votre espace, sans
              perdre les cours et fiches déjà créés.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 space-y-2.5">
            <h2 className="font-serif text-2xl text-foreground flex items-center gap-2.5">
              <Award className="h-5 w-5 text-primary" />
              3. Carte Membre, XP et Intégrité des Duels
            </h2>
            <p className="text-muted-foreground">
              Chaque compte étudiant est personnel. Les points d'expérience
              (XP), les paliers LV. et les 30 décorations de la Carte Membre
              sont acquis par votre travail réel sur la plateforme.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
