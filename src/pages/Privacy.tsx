import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";

const Privacy = () => (
  <div className="min-h-screen bg-background">
    <LandingHeader />
    <main className="container mx-auto px-4 py-20 max-w-3xl prose prose-neutral dark:prose-invert">
      <h1>Politique de Confidentialité</h1>
      <p className="text-muted-foreground">Dernière mise à jour : Février 2026</p>

      <h2>1. Collecte des données</h2>
      <p>Hippocampus collecte les données suivantes :</p>
      <ul>
        <li><strong>Données d'inscription :</strong> nom, prénom, adresse e-mail, université, année d'étude</li>
        <li><strong>Données d'utilisation :</strong> cours téléchargés, résultats de QCM, progression, statistiques</li>
        <li><strong>Données techniques :</strong> adresse IP, type de navigateur, appareil utilisé</li>
      </ul>

      <h2>2. Utilisation des données</h2>
      <p>Vos données sont utilisées pour :</p>
      <ul>
        <li>Fournir et améliorer nos services</li>
        <li>Personnaliser votre expérience d'apprentissage</li>
        <li>Générer des QCM et résumés adaptés</li>
        <li>Calculer vos statistiques de progression</li>
        <li>Vous envoyer des notifications de révision (si activées)</li>
      </ul>

      <h2>3. Stockage et sécurité</h2>
      <p>Vos données sont stockées de manière sécurisée sur les serveurs Supabase (hébergés dans l'Union Européenne). Toutes les communications sont chiffrées via HTTPS. Les politiques de sécurité au niveau des lignes (RLS) protègent vos données personnelles.</p>

      <h2>4. Partage des données</h2>
      <p>Vos données ne sont jamais vendues à des tiers. Seules les données suivantes peuvent être partagées :</p>
      <ul>
        <li>Votre nom et score dans le classement communautaire (si vous y participez)</li>
        <li>Vos messages dans le chat communautaire</li>
      </ul>

      <h2>5. Intelligence artificielle</h2>
      <p>Les cours que vous téléchargez sont traités par des modèles d'IA (OpenAI) pour générer des QCM et résumés. Ces données ne sont pas utilisées pour entraîner les modèles.</p>

      <h2>6. Vos droits (RGPD)</h2>
      <p>Conformément au RGPD, vous disposez des droits suivants :</p>
      <ul>
        <li><strong>Droit d'accès :</strong> consulter vos données personnelles</li>
        <li><strong>Droit de rectification :</strong> modifier vos informations</li>
        <li><strong>Droit à l'effacement :</strong> supprimer votre compte et toutes vos données</li>
        <li><strong>Droit à la portabilité :</strong> exporter vos données</li>
        <li><strong>Droit d'opposition :</strong> vous opposer au traitement de vos données</li>
      </ul>

      <h2>7. Cookies</h2>
      <p>Hippocampus utilise des cookies essentiels pour le fonctionnement de l'application (session d'authentification, préférences utilisateur). Aucun cookie publicitaire n'est utilisé.</p>

      <h2>8. Contact</h2>
      <p>Pour exercer vos droits ou pour toute question relative à la protection de vos données, contactez-nous à : privacy@hippocampus.fr</p>
    </main>
    <LandingFooter />
  </div>
);

export default Privacy;
