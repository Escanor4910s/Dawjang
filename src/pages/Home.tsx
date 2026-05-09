import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Brain, CheckCircle, TrendingUp, ArrowRight, Sparkles, Users, Target, Clock, Shield, Zap } from "lucide-react";
import { useEffect } from "react";
import hero3D from "@/assets/hero-3d-medical.png";

const Home = () => {
  // SEO: Update document title and meta tags
  useEffect(() => {
    document.title = "Hippocampus - Générateur de QCM Médicaux par IA | Révisez Efficacement";
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "Hippocampus génère automatiquement des QCM personnalisés à partir de vos cours de médecine grâce à l'IA. Flashcards, révision espacée, assistant MOR. Rejoignez 12000+ étudiants.");
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = "Hippocampus génère automatiquement des QCM personnalisés à partir de vos cours de médecine grâce à l'IA. Flashcards, révision espacée, assistant MOR. Rejoignez 12000+ étudiants.";
      document.head.appendChild(meta);
    }

    // Add structured data for SEO
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Hippocampus",
      "description": "Plateforme de génération de QCM médicaux par intelligence artificielle",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "XOF"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.9",
        "reviewCount": "12000"
      }
    };
    
    let scriptTag = document.querySelector('script[type="application/ld+json"]');
    if (!scriptTag) {
      scriptTag = document.createElement("script");
      scriptTag.setAttribute("type", "application/ld+json");
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(structuredData);

    return () => {
      document.title = "Hippocampus";
    };
  }, []);

  const features = [
    {
      icon: Plus,
      title: "Importez vos cours",
      description: "Uploadez vos PDF, notes ou documents médicaux en quelques secondes",
    },
    {
      icon: Brain,
      title: "IA génératrice de QCM",
      description: "Notre intelligence artificielle crée des questions adaptées à votre contenu",
    },
    {
      icon: CheckCircle,
      title: "Évaluez-vous",
      description: "Testez vos connaissances et identifiez vos lacunes instantanément",
    },
    {
      icon: Sparkles,
      title: "Assistant MOR",
      description: "Un tuteur IA disponible 24/7 pour expliquer vos erreurs",
    },
    {
      icon: Target,
      title: "Flashcards auto",
      description: "Des cartes de révision générées à partir de vos erreurs",
    },
    {
      icon: TrendingUp,
      title: "Suivi des progrès",
      description: "Statistiques détaillées pour optimiser votre apprentissage",
    },
  ];

  const testimonials = [
    {
      name: "Sarah M.",
      role: "Étudiante en P2",
      content: "Hippocampus m'a fait gagner des heures de révision. Les QCM sont pertinents et MOR explique super bien !",
      rating: 5,
    },
    {
      name: "Thomas L.",
      role: "Interne en chirurgie",
      content: "Parfait pour réviser entre deux gardes. L'IA comprend vraiment le contenu médical.",
      rating: 5,
    },
    {
      name: "Emma D.",
      role: "Étudiante en D1",
      content: "Les flashcards automatiques sont géniales. Je retiens beaucoup mieux maintenant.",
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section - SEO optimized with semantic HTML */}
      <header className="relative bg-gradient-hero text-white py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(160_80%_35%/0.15),transparent_50%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-hero-accent" />
        
        <div className="container relative mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <article className="space-y-6">
              <Badge variant="secondary" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                <Zap className="h-3 w-3 mr-1" />
                Propulsé par l'IA
              </Badge>
              
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
                Générateur de <span className="bg-gradient-text bg-clip-text text-transparent">QCM médicaux</span> par Intelligence Artificielle
              </h1>
              
              <p className="text-lg lg:text-xl text-white/85 max-w-xl leading-relaxed">
                Transformez vos cours de médecine en QCM personnalisés. Révisez efficacement avec des flashcards, un assistant IA et un suivi de progression.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button size="lg" className="bg-white text-primary hover:bg-white/90 shadow-glow group h-12 px-6">
                  <Link to="/add-course" className="flex items-center gap-2">
                    <span className="font-semibold">Commencer gratuitement</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 h-12 px-6">
                  <Link to="/community" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Rejoindre la communauté</span>
                  </Link>
                </Button>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-6 pt-4 text-white/70 text-sm">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4" />
                  <span>100% gratuit</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>Inscription en 30s</span>
                </div>
              </div>
            </article>
            
            <aside className="relative lg:block hidden" aria-hidden="true">
              <div className="relative animate-float">
                <img 
                  src={hero3D} 
                  alt="Visualisation 3D médicale - QCM et révision" 
                  className="w-full h-auto drop-shadow-2xl"
                  loading="eager"
                  width="500"
                  height="400"
                />
                <div className="absolute inset-0 bg-gradient-radial from-primary/20 to-transparent blur-3xl" />
              </div>
            </aside>
          </div>
        </div>
      </header>

      {/* Stats Section */}
      <section className="py-12 lg:py-16 bg-muted/30" aria-label="Statistiques">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8 max-w-4xl mx-auto text-center">
            <div className="space-y-1">
              <div className="text-3xl lg:text-4xl font-bold bg-gradient-text bg-clip-text text-transparent">50K+</div>
              <div className="text-muted-foreground text-sm">QCM générés</div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl lg:text-4xl font-bold bg-gradient-text bg-clip-text text-transparent">12K+</div>
              <div className="text-muted-foreground text-sm">Étudiants actifs</div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl lg:text-4xl font-bold bg-gradient-text bg-clip-text text-transparent">95%</div>
              <div className="text-muted-foreground text-sm">Satisfaction</div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl lg:text-4xl font-bold bg-gradient-text bg-clip-text text-transparent">24/7</div>
              <div className="text-muted-foreground text-sm">Assistant MOR</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 lg:py-24" aria-labelledby="features-heading">
        <div className="container mx-auto px-4">
          <header className="text-center mb-12 lg:mb-16">
            <h2 id="features-heading" className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Tout pour <span className="bg-gradient-text bg-clip-text text-transparent">réussir en médecine</span>
            </h2>
            <p className="text-muted-foreground text-base lg:text-lg max-w-2xl mx-auto">
              Des outils conçus spécifiquement pour les étudiants en médecine, pharmacie et sciences de la santé
            </p>
          </header>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card 
                  key={index} 
                  className="bg-card border border-border hover:border-primary/40 hover:shadow-medical transition-all duration-300 group"
                >
                  <CardHeader className="space-y-3 pb-2">
                    <div className="bg-gradient-primary p-3 rounded-xl w-12 h-12 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-lg font-semibold">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 lg:py-24 bg-muted/20" aria-labelledby="testimonials-heading">
        <div className="container mx-auto px-4">
          <header className="text-center mb-12">
            <h2 id="testimonials-heading" className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Ils nous font <span className="bg-gradient-text bg-clip-text text-transparent">confiance</span>
            </h2>
            <p className="text-muted-foreground text-base lg:text-lg">
              Découvrez les retours de nos utilisateurs
            </p>
          </header>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-card border border-border">
                <CardContent className="pt-6">
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <svg key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-foreground text-sm leading-relaxed mb-4">"{testimonial.content}"</p>
                  <div className="border-t border-border pt-3">
                    <p className="font-medium text-sm">{testimonial.name}</p>
                    <p className="text-muted-foreground text-xs">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 lg:py-24" aria-labelledby="how-it-works-heading">
        <div className="container mx-auto px-4">
          <header className="text-center mb-12">
            <h2 id="how-it-works-heading" className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Comment ça <span className="bg-gradient-text bg-clip-text text-transparent">marche</span> ?
            </h2>
          </header>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 max-w-4xl mx-auto">
            {[
              { step: "1", title: "Uploadez", desc: "Importez votre cours" },
              { step: "2", title: "Générez", desc: "L'IA crée vos QCM" },
              { step: "3", title: "Révisez", desc: "Testez-vous et progressez" },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold text-lg mb-2">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </div>
                {index < 2 && (
                  <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24 bg-gradient-hero text-white relative overflow-hidden" aria-label="Appel à l'action">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,hsl(160_80%_35%/0.2),transparent_60%)]" />
        <div className="container relative mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl lg:text-4xl font-bold">
              Prêt à <span className="bg-gradient-text bg-clip-text text-transparent">transformer</span> vos révisions ?
            </h2>
            <p className="text-lg text-white/85">
              Rejoignez des milliers d'étudiants qui réussissent grâce à Hippocampus
            </p>
            <Button size="lg" className="bg-white text-primary hover:bg-white/90 shadow-glow group h-12 px-8">
              <Link to="/add-course" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span className="font-semibold">Créer mon premier QCM</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer SEO */}
      <footer className="py-8 bg-muted/30 border-t border-border">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>© 2024 Hippocampus - Générateur de QCM médicaux par IA</p>
          <p className="mt-1">Plateforme d'apprentissage pour étudiants en médecine, pharmacie et sciences de la santé</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
