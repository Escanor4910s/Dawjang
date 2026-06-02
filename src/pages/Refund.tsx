import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ShieldCheck, Mail, Clock, AlertTriangle } from "lucide-react";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";

const Refund = () => {
  return (
    <div className="min-h-screen bg-transparent">
      <LandingHeader forceSolid />
      <main className="pt-28 pb-16 px-4">
        <div className="max-w-3xl mx-auto">

          <header className="text-center mb-10 space-y-3">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/10 mb-2">
              <ShieldCheck className="h-7 w-7 text-foreground" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Politique de remboursement</h1>
            <p className="text-muted-foreground">Transparence et protection de nos abonnés.</p>
          </header>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5" /> Délai de rétractation (14 jours)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-foreground/80 space-y-2">
                <p>
                  Conformément à nos engagements, tout nouvel abonnement Premium ou Pro peut être remboursé
                  <strong> dans les 14 jours suivant le paiement initial</strong>, à condition que l'usage des
                  fonctionnalités payantes reste raisonnable.
                </p>
                <p>
                  On considère un usage raisonnable comme : moins de 50 résumés générés, moins de 200 questions
                  de QCM créées via l'IA, et moins de 10 duels lancés.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5" /> Cas non remboursables
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-foreground/80 space-y-2">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Renouvellements automatiques au-delà du premier mois.</li>
                  <li>Comptes ayant enfreint les conditions générales d'utilisation.</li>
                  <li>Crédits IA déjà consommés (les crédits sont décomptés à chaque appel).</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mail className="h-5 w-5" /> Comment demander un remboursement ?
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-foreground/80 space-y-2">
                <p>
                  Envoyez un email à <a href="mailto:support@hippocampus.app" className="underline font-medium">support@hippocampus.app</a> avec :
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Votre adresse email de connexion</li>
                  <li>La date et le moyen de paiement utilisé</li>
                  <li>Le motif de votre demande</li>
                </ul>
                <p>
                  Nous traitons toutes les demandes <strong>sous 5 jours ouvrés</strong>. Le remboursement, lorsqu'il
                  est accepté, est effectué sur le moyen de paiement original sous 7 à 10 jours bancaires.
                </p>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center pt-2">
              Cette politique peut évoluer. Consultez régulièrement nos <Link to="/terms" className="underline">conditions générales</Link>.
            </p>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
};

export default Refund;
