import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";

const Terms = () => (
  <div className="min-h-screen bg-background">
    <LandingHeader />
    <main className="container mx-auto px-4 py-20 max-w-3xl prose prose-neutral dark:prose-invert">
      <h1>Conditions Générales d'Utilisation</h1>
      <p className="text-muted-foreground">Dernière mise à jour : Février 2026</p>

      <h2>1. Objet</h2>
      <p>Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme Hippocampus, accessible à l'adresse hipocampus2026.lovable.app.</p>

      <h2>2. Inscription et Compte</h2>
      <p>L'accès à certaines fonctionnalités nécessite la création d'un compte. L'utilisateur s'engage à fournir des informations exactes et à maintenir la confidentialité de ses identifiants.</p>

      <h2>3. Services proposés</h2>
      <p>Hippocampus propose les services suivants :</p>
      <ul>
        <li>Génération automatique de QCM à partir de cours médicaux</li>
        <li>Création de flashcards intelligentes</li>
        <li>Génération de résumés par intelligence artificielle</li>
        <li>Assistant IA "MOR" pour l'aide à la révision</li>
        <li>Suivi de progression et statistiques</li>
        <li>Communauté d'étudiants en médecine</li>
      </ul>

      <h2>4. Abonnements</h2>
      <p>Hippocampus propose trois formules : Gratuit, Premium (2 500 FCFA/mois) et Pro (5 000 FCFA/mois). Les fonctionnalités varient selon la formule choisie.</p>

      <h2>5. Propriété intellectuelle</h2>
      <p>Le contenu généré par l'IA reste la propriété de l'utilisateur. La plateforme, son code, son design et sa marque sont la propriété d'Hippocampus.</p>

      <h2>6. Responsabilité</h2>
      <p>Hippocampus fournit un outil d'aide à la révision. Les contenus générés par l'IA ne se substituent pas à l'enseignement médical officiel. L'utilisateur est responsable de vérifier l'exactitude des informations.</p>

      <h2>7. Résiliation</h2>
      <p>L'utilisateur peut supprimer son compte à tout moment depuis les paramètres. Hippocampus se réserve le droit de suspendre un compte en cas de violation des présentes CGU.</p>

      <h2>8. Modification des CGU</h2>
      <p>Hippocampus se réserve le droit de modifier les présentes CGU. Les utilisateurs seront informés de toute modification significative.</p>

      <h2>9. Contact</h2>
      <p>Pour toute question, contactez-nous à contact@hippocampus.fr.</p>
    </main>
    <LandingFooter />
  </div>
);

export default Terms;
