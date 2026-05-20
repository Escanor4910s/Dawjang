import { useEffect, useState } from "react";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";
import { motion } from "framer-motion";
import { Scale, BookOpen, Crown, Cpu, AlertTriangle, XOctagon, Pencil, Mail } from "lucide-react";

const sections = [
  { id: "objet", title: "Objet", icon: BookOpen },
  { id: "compte", title: "Inscription et Compte", icon: Scale },
  { id: "services", title: "Services proposés", icon: Cpu },
  { id: "abonnements", title: "Abonnements", icon: Crown },
  { id: "propriete", title: "Propriété intellectuelle", icon: Scale },
  { id: "responsabilite", title: "Responsabilité", icon: AlertTriangle },
  { id: "resiliation", title: "Résiliation", icon: XOctagon },
  { id: "modifications", title: "Modification des CGU", icon: Pencil },
  { id: "contact", title: "Contact", icon: Mail },
];

const Terms = () => {
  const [activeSection, setActiveSection] = useState("objet");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
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
    <div className="min-h-screen bg-[#FDFBF7] text-[#1A1A1A] font-sans selection:bg-[#0F3B2E]/20">
      <LandingHeader />
      
      {/* Hero Section */}
      <div className="pt-32 pb-16 px-6 relative overflow-hidden bg-[#0F3B2E] text-[#FDFBF7]">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-[#FDFBF7]/10 rounded-2xl flex items-center justify-center border border-[#FDFBF7]/20 backdrop-blur-sm">
                <Scale className="w-8 h-8 text-[#D4C3A3]" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif leading-[1.1] tracking-tight mb-6">
              Conditions Générales d'Utilisation
            </h1>
            <p className="text-lg md:text-xl text-[#FDFBF7]/80 font-light max-w-2xl mx-auto">
              Les règles de notre plateforme, rédigées avec clarté. Un accord mutuel pour bâtir le futur de l'apprentissage médical.
            </p>
            <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FDFBF7]/10 border border-[#FDFBF7]/20 text-sm font-medium text-[#D4C3A3]">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Dernière révision : Février 2026
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
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-6 ml-4">
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
                        ? "bg-white text-[#0F3B2E] shadow-sm border border-[#E5E5E5] scale-105" 
                        : "text-[#1A1A1A]/60 hover:text-[#1A1A1A] hover:bg-white/50"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-[#0F3B2E]" : "text-[#1A1A1A]/40"}`} />
                    {section.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 space-y-24">
            
            <section id="objet" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-[#0F3B2E] mb-6 flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-[#D4C3A3]" />
                1. Objet
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-[#1A1A1A]/80 font-light leading-relaxed">
                <p>
                  Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès, la consultation et l'utilisation de la plateforme <strong>Hippocampus</strong>, la référence de l'intelligence artificielle appliquée aux études médicales, accessible à l'adresse <code>hipocampus2026.lovable.app</code>.
                </p>
              </div>
            </section>

            <section id="compte" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-[#0F3B2E] mb-6 flex items-center gap-3">
                <Scale className="w-8 h-8 text-[#D4C3A3]" />
                2. Inscription et Compte
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-[#1A1A1A]/80 font-light leading-relaxed">
                <p>
                  L'accès à nos algorithmes d'analyse et à votre espace de travail personnalisé requiert la création d'un compte utilisateur.
                </p>
                <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] shadow-sm mt-6">
                  <ul className="space-y-4 m-0 p-0 list-none text-sm">
                    <li className="flex items-start gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-[#0F3B2E] flex-shrink-0" />
                      <div><strong>Exhaustivité :</strong> Vous vous engagez à fournir des informations de profil exactes lors de l'inscription.</div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-[#0F3B2E] flex-shrink-0" />
                      <div><strong>Confidentialité :</strong> Vous êtes responsable du maintien de la sécurité de vos identifiants d'accès.</div>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <section id="services" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-[#0F3B2E] mb-6 flex items-center gap-3">
                <Cpu className="w-8 h-8 text-[#D4C3A3]" />
                3. Services proposés
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-[#1A1A1A]/80 font-light leading-relaxed">
                <p>Hippocampus déploie une suite d'outils de pointe dédiés à l'excellence académique :</p>
                <div className="grid sm:grid-cols-2 gap-4 mt-6">
                  {[
                    "Génération automatique de QCM", 
                    "Création de flashcards (Spaced Repetition)", 
                    "Extraction de résumés par IA", 
                    "Tutorat personnalisé via l'Agent MOR",
                    "Tableau de bord de statistiques prédictives",
                    "Réseau social académique exclusif"
                  ].map((service, i) => (
                    <div key={i} className="flex items-center gap-3 bg-[#FDFBF7] border border-[#E5E5E5] p-4 rounded-xl">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0F3B2E]" />
                      <span className="font-medium text-[#1A1A1A] text-sm">{service}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="abonnements" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-[#0F3B2E] mb-6 flex items-center gap-3">
                <Crown className="w-8 h-8 text-[#D4C3A3]" />
                4. Abonnements et Tarification
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-[#1A1A1A]/80 font-light leading-relaxed">
                <p>
                  Pour s'adapter aux besoins de chaque étudiant, Hippocampus propose un modèle tarifaire transparent :
                </p>
                <div className="flex flex-col gap-4 mt-6">
                  <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-[#E5E5E5]">
                    <div>
                      <strong className="text-[#1A1A1A] block">Formule Gratuite</strong>
                      <span className="text-sm text-[#1A1A1A]/60">Accès limité aux fonctions de base</span>
                    </div>
                    <span className="font-serif text-[#0F3B2E] font-bold">0 FCFA</span>
                  </div>
                  <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-[#E5E5E5]">
                    <div>
                      <strong className="text-[#1A1A1A] block flex items-center gap-2">Premium <Crown className="w-4 h-4 text-amber-500" /></strong>
                      <span className="text-sm text-[#1A1A1A]/60">Pour les étudiants réguliers</span>
                    </div>
                    <span className="font-serif text-[#0F3B2E] font-bold">2 500 FCFA / mois</span>
                  </div>
                  <div className="flex justify-between items-center bg-[#0F3B2E] text-white p-5 rounded-2xl shadow-lg">
                    <div>
                      <strong className="block flex items-center gap-2">Pro <Crown className="w-4 h-4 text-[#D4C3A3]" /></strong>
                      <span className="text-sm text-white/70">L'expérience d'apprentissage ultime sans limites</span>
                    </div>
                    <span className="font-serif text-[#D4C3A3] font-bold">5 000 FCFA / mois</span>
                  </div>
                </div>
              </div>
            </section>

            <section id="propriete" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-[#0F3B2E] mb-6 flex items-center gap-3">
                <Scale className="w-8 h-8 text-[#D4C3A3]" />
                5. Propriété intellectuelle
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-[#1A1A1A]/80 font-light leading-relaxed">
                <p>
                  La plateforme, son code source, son identité visuelle, et la marque <strong>Hippocampus</strong> constituent la propriété exclusive de ses créateurs.
                </p>
                <div className="bg-[#D4C3A3]/10 border border-[#D4C3A3]/30 rounded-2xl p-6 mt-6">
                  Toutefois, <strong>le contenu généré par l'IA</strong> (vos QCM, vos résumés, vos flashcards) à partir de vos propres documents <strong>reste votre entière propriété</strong> intellectuelle.
                </div>
              </div>
            </section>

            <section id="responsabilite" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-[#0F3B2E] mb-6 flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-[#D4C3A3]" />
                6. Responsabilité & Limites
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-[#1A1A1A]/80 font-light leading-relaxed">
                <p>
                  Hippocampus est conçu pour être un puissant <strong>outil de soutien</strong>. Néanmoins, la médecine exigeant une précision absolue :
                </p>
                <div className="flex items-start gap-4 bg-rose-50 border border-rose-100 rounded-2xl p-6 mt-6">
                  <AlertTriangle className="w-6 h-6 text-rose-500 flex-shrink-0 mt-1" />
                  <p className="m-0 text-sm text-rose-900 leading-relaxed">
                    Les contenus générés par l'IA ne peuvent en aucun cas se substituer à l'enseignement médical officiel de votre faculté. Il incombe à l'utilisateur de vérifier systématiquement l'exactitude scientifique des informations proposées avant de les assimiler.
                  </p>
                </div>
              </div>
            </section>

            <section id="resiliation" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-[#0F3B2E] mb-6 flex items-center gap-3">
                <XOctagon className="w-8 h-8 text-[#D4C3A3]" />
                7. Résiliation
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-[#1A1A1A]/80 font-light leading-relaxed">
                <p>
                  Votre liberté est primordiale. Vous pouvez supprimer définitivement votre compte et effacer l'intégralité de vos données à tout instant depuis les paramètres de votre espace personnel. 
                </p>
                <p className="text-sm mt-4 text-[#1A1A1A]/60">
                  Hippocampus se réserve le droit de suspendre ou de supprimer l'accès à un compte de manière unilatérale en cas d'utilisation abusive avérée de ses services ou de violation manifeste des présentes conditions.
                </p>
              </div>
            </section>

            <section id="modifications" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-[#0F3B2E] mb-6 flex items-center gap-3">
                <Pencil className="w-8 h-8 text-[#D4C3A3]" />
                8. Modification des CGU
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-[#1A1A1A]/80 font-light leading-relaxed">
                <p>
                  Le monde de l'intelligence artificielle évoluant rapidement, Hippocampus se réserve le droit de modifier les présentes Conditions. Tout changement significatif fera l'objet d'une communication claire (email ou notification in-app) avant son entrée en vigueur.
                </p>
              </div>
            </section>

            <section id="contact" className="scroll-mt-32">
              <h2 className="text-3xl font-serif text-[#0F3B2E] mb-6 flex items-center gap-3">
                <Mail className="w-8 h-8 text-[#D4C3A3]" />
                9. Contact juridique
              </h2>
              <div className="prose prose-lg prose-neutral max-w-none text-[#1A1A1A]/80 font-light leading-relaxed">
                <p>
                  Pour toute question juridique, requête ou litige concernant les présentes CGU, veuillez vous adresser à notre département via l'adresse officielle :
                </p>
                <div className="inline-flex flex-col sm:flex-row items-center gap-4 bg-white border border-[#E5E5E5] rounded-2xl p-2 pr-6 mt-4 shadow-sm">
                  <div className="w-12 h-12 bg-[#0F3B2E]/5 rounded-xl flex items-center justify-center text-[#0F3B2E]">
                    <Mail className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-[#1A1A1A]">contact@hippocampus.fr</span>
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

export default Terms;
