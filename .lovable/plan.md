

# Plan : UX Premium + Dark Mode fix + MOR widget + Dashboard visuel

## Problemes identifies

1. **Dark mode ne fonctionne pas** : Les variables `.dark` existent dans `index.css` mais manquent `--gradient-primary` et `--shadow-glow` en dark. De plus, la sidebar utilise `bg-card` qui ne contraste pas assez en dark mode.
2. **Dashboard pas assez distinctif** : Meme fond que les autres pages, pas de decoration.
3. **MOR widget basique** : Interface chat fonctionnelle mais sans polish UX (pas de markdown, pas de transitions fluides).
4. **UX generale** : Manque d'animations, de micro-interactions et de polish visuel.

## Modifications

### 1. Corriger le dark mode (`src/index.css`)
- Ajouter les variables manquantes en `.dark` : `--gradient-primary`, `--shadow-glow`
- Augmenter le contraste sidebar dark (`--sidebar-background: 25 15% 8%`)
- Ajouter une transition douce sur le `body` pour le changement de theme
- Verifier que le watermark s'inverse correctement (deja fait, opacity 0.08 + stroke blanc)

### 2. Dashboard premium (`src/pages/Dashboard.tsx`)
- Ajouter un **header decoratif** avec gradient et motif geometrique (cercles/dots SVG en arriere-plan)
- Cartes stats avec **icones colorees** dans des cercles gradient au lieu d'icones grises
- Ajouter des **micro-animations** : compteurs animes, cartes qui apparaissent en stagger
- Fond specifique plus sombre : utiliser une classe CSS dediee `bg-dashboard` avec un gradient subtil distinct du `bg-background` standard
- Ajouter un **message de bienvenue personnalise** avec le prenom de l'utilisateur et l'heure du jour (Bonjour/Bonsoir)
- Bordures colorees sur les cartes stats (gauche verte pour score, orange pour objectif, etc.)

### 3. Widget MOR ameliore (`src/components/MorChatWidget.tsx`)
- **Redesign du bouton flottant** : ajouter un pulse/glow animation, tooltip au hover
- **Messages mieux formates** : support basique du markdown (gras, listes) via du parsing simple
- **Transition d'ouverture** fluide (scale + fade au lieu d'un simple toggle)
- **Typing indicator** ameliore avec animation plus douce
- **Quick replies** : suggestions cliquables apres la reponse de MOR ("Explique plus", "Autre question", "Voir mes stats")
- Supprimer la section "Quick Actions" actuelle (redondante avec la sidebar) et la remplacer par des suggestions contextuelles

### 4. Animations et micro-interactions globales (`src/index.css` + composants)
- Ajouter des keyframes : `shimmer` (pour les skeletons de chargement), `slide-in-left`, `bounce-subtle`
- Classes utilitaires : `.glass-card` (effet glassmorphism pour les cartes premium), `.gradient-border` (bordure animee)
- Hover effects sur toutes les cartes cliquables avec `transform: translateY(-2px)` + shadow

### 5. Polish visuel global
- **AppSidebar** : ajouter le `ThemeToggle` en bas de la sidebar pour un acces rapide au dark mode
- **Cards** dans toutes les pages : ajouter `card-hover` class pour l'effet de levitation au survol
- **Boutons principaux** : ajouter un subtle shadow et hover scale

## Fichiers modifies

| Fichier | Type de modification |
|---|---|
| `src/index.css` | Variables dark, animations, classes utilitaires, style dashboard |
| `src/pages/Dashboard.tsx` | Header decoratif, cartes colorees, animations stagger, message perso |
| `src/components/MorChatWidget.tsx` | Redesign complet : transitions, markdown, suggestions, polish |
| `src/components/AppSidebar.tsx` | Ajout ThemeToggle dans la sidebar |
| `tailwind.config.ts` | Nouvelles animations (shimmer, slide-in) |

## Contraintes respectees

- Aucune modification de la logique metier (upload -> cours -> QCM -> quiz)
- Pas de nouvelles dependances
- Compatibilite mobile preservee
- Toutes les modifications sont CSS/className + JSX decoratif

