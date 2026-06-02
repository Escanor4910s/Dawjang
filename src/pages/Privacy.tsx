import { useEffect, useState } from "react";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";
import { motion } from "framer-motion";
import { Shield, Database, Lock, Users, Brain, FileText, Cookie, Mail } from "lucide-react";

const sections = [
  { id: "collecte", title: "Collecte des données", icon: Database },
  { id: "utilisation", title: "Utilisation des données", icon: FileText },
  { id: "securite", title: "Stockage et sécurité", icon: Lock },
  { id: "partage", title: "Partage des données", icon: Users },
  { id: "ia", title: "Intelligence artificielle", icon: Brain },
  { id: "droits", title: "Vos droits (RGPD)", icon: Shield },
  { id: "cookies", title: "Cookies", icon: Cookie },
  { id: "contact", title: "Contact", icon: Mail },
];

const Privacy = () => {
  const [activeSection, setActiveSection] = useState("collecte");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200; // offset
      for (const section of [...sections].reverse()) {
        const element = document.getElementById(section.id);
        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(section.id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 100,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-[#1A1A1A] font-sans selection:bg-[#0F3B2E]/20">
      <LandingHeader forceSolid={true} />
      
      {/* Hero Section */}
      <div className="pt-32 pb-16 px-6 relative overflow-hidden bg-[#0F3B2E] text-[#FDFBF7]">
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-transparent/10 rounded-2xl flex items-center justify-center border border-[#FDFBF7]/20 backdrop-blur-sm">
                <Shield className="w-8 h-8 text-[#D4C3A3]" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif leading-[1.1] tracking-tight mb-6">
              Politique de Confidentialité
            </h1>
            <p className="text-lg md:text-xl text-[#FDFBF7]/80 font-light max-w-2xl mx-auto">
              Votre confiance est notre priorité absolue. Découvrez comment nous protégeons et gérons vos données avec la plus haute rigueur.
            </p>
            <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-transparent/10 border border-[#FDFBF7]/20 text-sm font-medium text-[#D4C3A3]">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Dernière mise à jour : Février 2026
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content Split */}
      <main className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <div className="flex flex-col md:flex-row gap-12 lg:gap-24 relative">
          
          {/* Sidebar Navigation */}
          <div className="hidden md:block w-64 flex-shrink-0">
            <div className="sticky top-32 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/40 mb-6 ml-4">
                Sommaire
              </h3>
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                      isActive 
                        ? "bg-card text-primary shadow-sm border border-border scale-105" 
                        : "text-foreground/60 hover:text-foreground hover:bg-card/50"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-foreground/40"}`} />
                    {section.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 space-y-24">
            
            <section id="collecte" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-foreground mb-6 flex items-center gap-3">
                <Database className="w-8 h-8 text-muted-foreground" />
                1. Collecte des données
              </h2>
              <div className="prose prose-lg prose-neutral dark:prose-invert max-w-none text-foreground/80 font-light leading-relaxed">
                <p>
                  Afin de vous fournir une expérience académique personnalisée, Hippocampus collecte de manière transparente et limitée les données suivantes :
                </p>
                <div className="grid sm:grid-cols-2 gap-6 mt-8">
                  <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="text-lg font-bold text-foreground mb-3">Identité & Profil</h3>
                    <ul className="space-y-2 text-sm m-0 p-0 list-none">
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Nom et Prénom</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Adresse e-mail</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Faculté de médecine</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Année d'étude</li>
                    </ul>
                  </div>
                  <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="text-lg font-bold text-foreground mb-3">Activité d'Apprentissage</h3>
                    <ul className="space-y-2 text-sm m-0 p-0 list-none">
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Documents téléchargés</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Résultats de QCM</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Statistiques de progression</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section id="utilisation" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-foreground mb-6 flex items-center gap-3">
                <FileText className="w-8 h-8 text-muted-foreground" />
                2. Utilisation des données
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-foreground/80 font-light leading-relaxed">
                <p>
                  L'intégralité des données collectées est mobilisée dans un but unique : <strong>optimiser votre réussite académique</strong>.
                </p>
                <ul className="mt-6 space-y-4">
                  <li><strong>Personnalisation :</strong> Ajuster la difficulté des QCM et des flashcards selon votre niveau.</li>
                  <li><strong>Analyse prédictive :</strong> Générer vos statistiques de révision et anticiper vos besoins d'apprentissage.</li>
                  <li><strong>Amélioration continue :</strong> Identifier les bugs et optimiser la vitesse de l'application.</li>
                </ul>
              </div>
            </section>

            <section id="securite" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-foreground mb-6 flex items-center gap-3">
                <Lock className="w-8 h-8 text-muted-foreground" />
                3. Stockage et Sécurité de niveau Enterprise
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-foreground/80 font-light leading-relaxed">
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 mb-8 text-primary">
                  <strong>Notre engagement de sécurité :</strong> Vos données sont stockées au sein de l'Union Européenne, bénéficiant des normes de protection les plus strictes au monde.
                </div>
                <p>
                  Les infrastructures d'Hippocampus s'appuient sur les serveurs sécurisés de <strong>Supabase</strong>. Les communications entre votre appareil et nos serveurs sont protégées par un chiffrement SSL/TLS (HTTPS) de bout en bout. L'accès à la base de données est restreint par des politiques de sécurité au niveau des lignes (RLS), garantissant que seul vous avez accès à vos documents personnels.
                </p>
              </div>
            </section>

            <section id="partage" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-foreground mb-6 flex items-center gap-3">
                <Users className="w-8 h-8 text-muted-foreground" />
                4. Partage des données
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-foreground/80 font-light leading-relaxed">
                <div className="flex items-start gap-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-6 mb-6">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0 text-emerald-600 dark:text-emerald-400">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-emerald-900 dark:text-emerald-300 font-bold m-0 mb-1">Zéro Vente de Données</h3>
                    <p className="text-emerald-800 dark:text-emerald-400 m-0 text-sm">Nous ne vendrons <strong>jamais</strong> vos informations à des annonceurs, courtiers en données ou autres entités commerciales. C'est notre promesse.</p>
                  </div>
                </div>
                <p>
                  Les seules situations où certaines de vos informations sont visibles par autrui concernent les fonctionnalités communautaires que vous décidez d'utiliser, telles que le classement global (votre nom et score) ou vos messages publics dans l'espace "Communauté".
                </p>
              </div>
            </section>

            <section id="ia" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-foreground mb-6 flex items-center gap-3">
                <Brain className="w-8 h-8 text-muted-foreground" />
                5. Intelligence Artificielle et Confidentialité
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-foreground/80 font-light leading-relaxed">
                <p>
                  Hippocampus intègre les modèles d'Intelligence Artificielle d'OpenAI pour analyser vos cours et créer des QCM. Nous garantissons que :
                </p>
                <ul className="space-y-3 mt-6">
                  <li>Vos documents soumis sont utilisés <strong>exclusivement</strong> pour traiter votre propre requête d'analyse.</li>
                  <li>Vos cours ou vos données ne sont <strong>pas</strong> utilisés pour entraîner les modèles d'IA d'OpenAI ou d'Hippocampus.</li>
                  <li>Les analyses sont supprimées de la mémoire temporaire dès la fin de la génération du contenu.</li>
                </ul>
              </div>
            </section>

            <section id="droits" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-foreground mb-6 flex items-center gap-3">
                <Shield className="w-8 h-8 text-muted-foreground" />
                6. Vos droits (Conformité RGPD)
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-foreground/80 font-light leading-relaxed">
                <p>
                  Vous avez un contrôle total sur vos informations, conformément au Règlement Général sur la Protection des Données (RGPD) :
                </p>
                <div className="grid sm:grid-cols-2 gap-4 mt-8">
                  {[
                    "Droit d'accès", "Droit de rectification", 
                    "Droit à l'oubli", "Droit à la portabilité",
                    "Droit d'opposition"
                  ].map((droit, i) => (
                    <div key={i} className="flex items-center gap-3 bg-card border border-border p-4 rounded-xl shadow-sm">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="font-semibold text-foreground">{droit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="cookies" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-foreground mb-6 flex items-center gap-3">
                <Cookie className="w-8 h-8 text-muted-foreground" />
                7. Politique relative aux Cookies
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-foreground/80 font-light leading-relaxed">
                <p>
                  Fidèles à notre philosophie sans superflu, nous n'utilisons <strong>aucun cookie publicitaire ou de traçage tiers</strong>.
                </p>
                <p>
                  Les seuls cookies déployés sur votre appareil sont strictement nécessaires au fonctionnement technique de la plateforme (maintien de votre session sécurisée, préservation de vos préférences locales).
                </p>
              </div>
            </section>

            <section id="contact" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-foreground mb-6 flex items-center gap-3">
                <Mail className="w-8 h-8 text-muted-foreground" />
                8. Nous contacter
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-foreground/80 font-light leading-relaxed">
                <p>
                  Pour toute question concernant cette politique ou pour exercer vos droits, notre équipe juridique et de support est à votre entière disposition.
                </p>
                <div className="inline-flex flex-col sm:flex-row items-center gap-4 bg-card border border-border rounded-2xl p-2 pr-6 mt-4 shadow-sm">
                  <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center text-primary">
                    <Mail className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-foreground">privacy@hippocampus.fr</span>
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
};

export default Privacy;
