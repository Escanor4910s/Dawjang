import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Smartphone, Check, Share, Plus, ArrowRight, Wifi, WifiOff, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import HippocampusLogo from "@/components/landing/HippocampusLogo";
import { Link } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    // Online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const features = [
    {
      icon: WifiOff,
      title: "Mode hors-ligne",
      description: "Révisez vos flashcards sans connexion internet"
    },
    {
      icon: Bell,
      title: "Notifications",
      description: "Rappels de révision personnalisés"
    },
    {
      icon: Smartphone,
      title: "Comme une app native",
      description: "Accès rapide depuis votre écran d'accueil"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <HippocampusLogo size="sm" />
            <span className="font-bold text-xl">Hippocampus</span>
          </Link>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                <Wifi className="h-3 w-3 mr-1" />
                En ligne
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                <WifiOff className="h-3 w-3 mr-1" />
                Hors-ligne
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <Badge variant="outline" className="mb-4 px-4 py-1 border-primary/30 bg-primary/5">
            📱 Application Mobile
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Installez Hippocampus
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Révisez n'importe où, même sans connexion internet. 
            Installez l'app directement sur votre téléphone.
          </p>
        </motion.div>

        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-12"
        >
          {isInstalled ? (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="flex items-center justify-center gap-4 py-8">
                <div className="p-3 rounded-full bg-emerald-500/20">
                  <Check className="h-8 w-8 text-emerald-500" />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-semibold text-emerald-500">App installée !</h3>
                  <p className="text-muted-foreground">
                    Hippocampus est disponible sur votre écran d'accueil
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : isIOS ? (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share className="h-5 w-5" />
                  Installation sur iPhone/iPad
                </CardTitle>
                <CardDescription>
                  Suivez ces étapes pour installer l'app
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  <li className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Appuyez sur le bouton Partager</p>
                      <p className="text-sm text-muted-foreground">
                        En bas de l'écran dans Safari (icône <Share className="h-4 w-4 inline" />)
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Faites défiler et appuyez sur "Sur l'écran d'accueil"</p>
                      <p className="text-sm text-muted-foreground">
                        L'icône <Plus className="h-4 w-4 inline" /> apparaîtra
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Appuyez sur "Ajouter"</p>
                      <p className="text-sm text-muted-foreground">
                        L'app sera ajoutée à votre écran d'accueil
                      </p>
                    </div>
                  </li>
                </ol>
              </CardContent>
            </Card>
          ) : deferredPrompt ? (
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-violet-500/5">
              <CardContent className="py-8 text-center">
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-6">
                    <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-primary to-violet-600 shadow-lg shadow-primary/25">
                      <Download className="h-10 w-10 text-background" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Prêt à installer</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Installez Hippocampus sur votre appareil pour un accès rapide et le mode hors-ligne
                  </p>
                  <Button 
                    size="lg" 
                    onClick={handleInstallClick}
                    className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Installer maintenant
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  L'installation est disponible depuis Chrome, Edge ou Samsung Internet sur Android.
                  <br />
                  Sur iPhone, utilisez Safari.
                </p>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-6 mb-12"
        >
          {features.map((feature, index) => (
            <Card key={index} className="text-center">
              <CardContent className="pt-6">
                <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary mb-4">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* CTA to Dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center"
        >
          <Link to="/dashboard">
            <Button variant="outline" size="lg">
              Continuer vers le Dashboard
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </main>
    </div>
  );
};

export default Install;
