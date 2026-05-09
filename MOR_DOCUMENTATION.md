# Documentation Mor - Agent IA Pédagogique

## Vue d'ensemble
Mor est un tuteur virtuel en médecine intégré à l'application QuizMed. Il aide les étudiants en médecine à comprendre et réviser leurs cours en répondant à leurs questions de manière pédagogique.

## 🎯 Fonctionnalités

### Capacités de Mor
- ✅ Répondre aux questions sur les cours uploadés
- ✅ Expliquer et reformuler des notions médicales complexes
- ✅ Citer les sources et passages pertinents du cours
- ✅ Détecter et refuser les demandes de diagnostic personnel
- ✅ Refuser les demandes de prescription ou de conseil thérapeutique

### Limitations
- ❌ Ne peut pas donner de diagnostic médical personnel
- ❌ Ne peut pas prescrire de médicaments ou posologies
- ❌ Ne peut pas donner de conseils thérapeutiques spécifiques
- ❌ Ne répond qu'à partir du contenu des cours fournis

## 📁 Structure du code

### Frontend
```
src/pages/AskMor.tsx              # Page principale de l'interface Mor
```
**Composant principal** avec :
- Interface de chat
- Sélecteur de cours
- Affichage des messages et sources
- Gestion de l'état de chargement

### Backend
```
supabase/functions/ask-mor/index.ts   # Edge function Supabase
```
**Logique serveur** avec :
- Authentification utilisateur
- Récupération du cours sélectionné
- Extraction d'excerpts pertinents
- Filtrage de sécurité (détection de demandes interdites)
- Appel à l'API OpenAI avec prompt système
- Logging anonymisé

### Configuration
```
supabase/config.toml              # Configuration de la fonction edge
```
- Fonction `ask-mor` avec `verify_jwt = true` (authentification requise)

## 🔒 Sécurité

### Filtres de sécurité
La fonction détecte automatiquement les demandes interdites via des patterns regex :
- Questions personnelles de symptômes : "j'ai mal", "je ressens"
- Demandes de diagnostic : "diagnostic", "mon cas"
- Demandes de prescription : "quel médicament", "combien de mg"
- Demandes de traitement : "dois-je prendre", "quel traitement"

### Réponse aux demandes interdites
```
"Je peux expliquer la théorie médicale, mais je ne peux pas donner de diagnostic 
ni de conseil médical personnalisé. Pour un avis médical adapté à votre situation, 
consultez un professionnel de santé."
```

## 🤖 Prompt système

Le prompt système configure le comportement de Mor :

```
Tu es Mor, un tuteur virtuel en médecine. Ton rôle est d'expliquer, clarifier 
et enseigner à partir du contenu des cours fournis.

RÈGLES IMPORTANTES :
1. Sois précis, pédagogue et bienveillant
2. Cite les passages du cours quand c'est pertinent
3. Si l'information n'est pas dans le cours, dis-le clairement
4. REFUSE TOUTE demande de diagnostic, prescription ou conseil thérapeutique
```

## 📊 Extraction de contenu pertinent

La fonction `extractRelevantExcerpts()` :
1. Identifie les mots-clés de la question (mots > 3 caractères)
2. Score chaque phrase du cours selon les correspondances
3. Sélectionne les 10 phrases les plus pertinentes
4. Limite à 3000 caractères pour optimiser les coûts

## 🔌 Intégration

### Routing
La route `/mor` est ajoutée dans `src/App.tsx` :
```tsx
<Route path="/mor" element={<AskMor />} />
```

### Navigation
Lien "Ask Mor" ajouté dans le menu utilisateur (`UserAvatar.tsx`)

### API
Endpoint Supabase Edge Function : `/functions/v1/ask-mor`
- Méthode : POST
- Authentification : Bearer token (JWT)
- Body : `{ question: string, courseId: string }`
- Réponse : `{ answer: string, sources: string[], meta: { model, tokens } }`

## 📝 Logging

Logs anonymisés pour analyse :
```javascript
{
  timestamp: ISO 8601,
  courseId: UUID,
  questionLength: number,
  answerLength: number,
  tokensUsed: number
}
```

**Note** : Aucune donnée sensible n'est loggée (pas de contenu de question/réponse)

## 🧪 Tests de non-régression

### Checklist de validation
- [ ] `/upload` - Upload d'un cours PDF → ✅ OK
- [ ] `/generate-qcm` - Génération de QCM → ✅ OK
- [ ] `/mor` - Poser une question sur un cours → ✅ Réponse pertinente
- [ ] Sécurité - Demander un diagnostic → ✅ Refus approprié
- [ ] Sécurité - Demander une prescription → ✅ Refus approprié
- [ ] Sources - Vérifier l'affichage des extraits → ✅ OK

### Tests manuels
1. Se connecter à l'application
2. Uploader un cours PDF de médecine
3. Aller sur `/mor`
4. Sélectionner le cours
5. Poser une question théorique : "Qu'est-ce que la mitose ?"
6. Vérifier la réponse et les sources
7. Poser une question interdite : "J'ai mal à la tête, que dois-je prendre ?"
8. Vérifier le message de refus

## 🚀 Déploiement

### Déploiement automatique
La fonction edge `ask-mor` est déployée automatiquement avec le reste du code.

### Variables d'environnement requises
- `OPENAI_API_KEY` - Clé API OpenAI (déjà configurée)
- `SUPABASE_URL` - URL du projet Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Clé service role Supabase

### Activation/Désactivation
Pour désactiver Mor :
1. Supprimer la route dans `src/App.tsx`
2. Supprimer le lien dans `src/components/UserAvatar.tsx`
3. (Optionnel) Supprimer le dossier `supabase/functions/ask-mor`

## 💰 Coûts

### Optimisations implémentées
- Extraction d'excerpts pertinents (3000 chars max)
- Utilisation du modèle `gpt-4o-mini` (économique)
- Limite de tokens de sortie : 800

### Estimation
- Coût par requête : ~$0.001 - $0.005 USD
- Dépend de la taille du cours et de la complexité de la question

## 📚 Fichiers non modifiés

### ✅ Garantie de non-régression
Les fichiers suivants n'ont **PAS** été modifiés :
- `src/pages/AddCourse.tsx` (upload de cours)
- `src/hooks/useFileReader.ts` (lecture de fichiers)
- `supabase/functions/generate-quiz-openai/index.ts` (génération de QCM)
- Tables Supabase `courses`, `quiz_results`

### Fichiers ajoutés
- `src/pages/AskMor.tsx` (nouveau)
- `supabase/functions/ask-mor/index.ts` (nouveau)
- `MOR_DOCUMENTATION.md` (nouveau)

### Fichiers modifiés (routing uniquement)
- `src/App.tsx` (ajout de route)
- `src/components/UserAvatar.tsx` (ajout de lien menu)
- `supabase/config.toml` (configuration de la fonction)

## 🔄 Maintenance

### Mise à jour du prompt système
Modifier la constante `SYSTEM_PROMPT` dans `supabase/functions/ask-mor/index.ts`

### Ajout de filtres de sécurité
Ajouter des patterns dans `FORBIDDEN_PATTERNS` :
```typescript
const FORBIDDEN_PATTERNS = [
  /nouveau pattern ici/i,
  // ...
];
```

### Amélioration de l'extraction
Modifier la fonction `extractRelevantExcerpts()` pour implémenter :
- Recherche sémantique (embeddings)
- Meilleur scoring (TF-IDF)
- Chunking intelligent

## 📞 Support

Pour toute question ou amélioration de Mor :
1. Vérifier les logs dans Supabase → Functions → ask-mor → Logs
2. Tester avec différents cours et questions
3. Ajuster le prompt système selon les retours utilisateurs

---

**Version** : 1.0.0  
**Date** : 2025-01-08  
**Auteur** : Lovable AI
