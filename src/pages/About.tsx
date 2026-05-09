import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Users, GraduationCap, Heart, Target, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main className="container mx-auto px-4 py-20 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">À propos d'Hippocampus</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            La plateforme d'apprentissage médical nouvelle génération, conçue par et pour les étudiants en médecine.
          </p>
        </motion.div>

        <div className="space-y-8">
          <Card>
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-xl"><Brain className="h-6 w-6 text-primary" /></div>
                <div>
                  <h2 className="text-xl font-semibold mb-2">Notre Mission</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Hippocampus tire son nom de la région du cerveau responsable de la mémoire et de l'apprentissage.
                    Notre mission est simple : rendre la révision médicale plus efficace, plus engageante et accessible à tous
                    les étudiants en médecine francophones.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: Lightbulb, title: "Innovation IA", desc: "Nous utilisons l'intelligence artificielle pour générer des QCM personnalisés à partir de vos propres cours." },
              { icon: Target, title: "Révision ciblée", desc: "Notre système identifie vos faiblesses et crée automatiquement des flashcards pour les points à retravailler." },
              { icon: Users, title: "Communauté", desc: "Rejoignez des milliers d'étudiants en médecine qui partagent leurs connaissances et s'entraident." },
              { icon: Heart, title: "Passion", desc: "Créé par des étudiants en médecine qui comprennent les défis de la révision quotidienne." },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className="h-full">
                  <CardContent className="p-6">
                    <item.icon className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card>
            <CardContent className="p-8 text-center">
              <GraduationCap className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Rejoignez-nous</h2>
              <p className="text-muted-foreground">
                Plus de 12 000 étudiants font déjà confiance à Hippocampus pour leurs révisions.
                Commencez gratuitement dès aujourd'hui.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
};

export default About;
