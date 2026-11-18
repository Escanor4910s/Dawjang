# Hippocampus

Hippocampus est une PWA de révision médicale destinée aux étudiants en santé. Elle permet d’importer des cours, de générer des QCM, des synthèses et des flashcards, de suivre sa progression et de travailler hors ligne.

L’application est construite avec React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Query et Supabase. Les appels IA et les opérations de paiement sensibles sont exécutés par des Edge Functions côté serveur.

## Prérequis

- Node.js 20 ou supérieur, idéalement 22
- npm
- Un projet Supabase
- Supabase CLI et Deno pour les migrations et Edge Functions

## Installation locale

```sh
npm install
cp .env.example .env
```

Renseignez uniquement les variables publiques Vite dans `.env` :

```env
VITE_SUPABASE_URL="https://votre-projet.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="votre-cle-anon-publique"
VITE_SUPABASE_PROJECT_ID="votre-project-id"
```

Ne placez jamais dans `.env` ou dans une variable `VITE_*` :

- `SUPABASE_SERVICE_ROLE_KEY`
- une clé OpenRouter, Lovable, OpenAI, Anthropic ou Gemini
- un secret PayPal ou PayTech

Ces valeurs doivent rester dans les variables d’environnement des Edge Functions Supabase. Toute clé ayant été exposée côté client doit être révoquée puis régénérée.

## Scripts

```sh
npm run dev            # serveur de développement
npm run build          # build de production
npm run preview        # prévisualisation du build
npm run lint           # ESLint
npm run lint -- --quiet  # uniquement les erreurs ESLint
npm run typecheck      # vérification TypeScript
npm test               # tests Vitest
npm run test:coverage  # tests et couverture
```

## Base de données et Edge Functions

Les migrations se trouvent dans `supabase/migrations/`. Appliquez-les dans l’ordre :

```sh
supabase db push
```

Pour un environnement local :

```sh
supabase start
supabase db reset
```

Déployez les fonctions :

```sh
supabase functions deploy
```

Les principales variables serveur sont :

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`, lorsque la fonction en a explicitement besoin
- `OPENROUTER_API_KEY` ou `LOVABLE_API_KEY` pour le moteur IA partagé
- `SUMMARY_MODEL` et `APP_PUBLIC_URL`, optionnels
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL`
- `PAYTECH_API_KEY`, `PAYTECH_API_SECRET`, `PAYTECH_ENV`
- `SITE_URL`

Les fonctions IA exigent un JWT utilisateur. `paytech-webhook` reste publiquement accessible uniquement parce qu’il vérifie sa propre signature. Les contrôles de plan, d’expiration, de propriété des cours, de taille d’entrée, de tokens et de quotas doivent rester côté serveur ; un garde React n’est pas une protection de sécurité.

## Confidentialité hors ligne

Les données IndexedDB sont isolées par identifiant utilisateur. La déconnexion et le changement de compte suppriment :

- les bases hors ligne de l’ancien compte
- les caches runtime, sauf le précache applicatif public
- les entrées privées `dawjang_*` et `hippocampus_*` de `localStorage`

Une action « Effacer mes données locales » est également disponible dans Paramètres → Données. Les préférences publiques non privées et le statut d’authentification local sont préservés.

## CI

Le workflow `.github/workflows/ci.yml` exécute :

1. `npm ci`
2. ESLint en mode erreurs uniquement
3. `npm run typecheck`
4. `npm test`
5. `npm run build`

Le build CI utilise des valeurs publiques Supabase factices ; il ne doit pas recevoir de secret réel.

## Limites actuelles

- Les Edge Functions, migrations SQL, webhooks et parcours PayPal/PayTech nécessitent encore des tests d’intégration sur un projet Supabase réel.
- Les parcours navigateur authentifiés et les scénarios de paiement ne sont pas encore automatisés.
- Quelques dépendances nécessitent des migrations majeures planifiées ou un remplacement.
- Les modules PDF, OCR et certaines pages restent volumineux ; le lazy loading a été amélioré mais un budget de bundle reste à formaliser.

## Avertissement

Hippocampus est un outil d’aide à la révision. Il ne remplace ni un enseignement médical officiel, ni un avis clinique, ni une source académique validée. Vérifiez toute information médicale avant un usage professionnel ou pédagogique.
