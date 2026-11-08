# Règle Stricte : Docimologie Médicale, Moteurs DAWIA et Expérience QCM

Cette règle s'applique à toute opération de génération, modification, affichage ou exécution de QCM dans l'application DawJang.

---

## 1. Anonymisation et Nomenclature des Moteurs IA (DAWIA 1 & DAWIA 2)

- **Interdiction formelle** de mentionner les noms commerciaux des modèles d'IA (Gemini, Claude, Sonnet, GPT, DeepSeek, etc.) dans l'interface destinée aux étudiants.
- Les moteurs d'évaluation doivent exclusivement être nommés :
  - **DAWIA 1** : Moteur fondé sur Gemini 2.5 (génération haute vitesse et ancrage synthétique).
  - **DAWIA 2** : Moteur fondé sur Sonnet 4.6 (raisonnement clinique approfondi et docimologie avancée).

---

## 2. Docimologie Universitaire et Rigueur Médicale

Les QCM doivent reproduire fidèlement les épreuves des facultés de médecine :

1. **Formats Obligatoires** :
   - **Élection (QCU)** : Une seule proposition vraie parmi 5.
   - **Censure (« SAUF UNE »)** : 4 propositions vraies et 1 fausse (l'étudiant doit désigner l'affirmation inexacte).
   - **Groupage** : 4 ou 5 assertions numérotées, avec clé docimologique standard (ex. A = 1,2,3 ; B = 1,3 ; C = 2,4 ; D = 4 ; E = Autre).
   - **Jumelage** : Évaluation conjointe de deux assertions reliées par « PARCE QUE » (vérité respective et lien de causalité).
   - **Association** : Appariement rigoureux entre deux listes (1-4 ↔ A-D).

2. **Éradication des Distracteurs Mécaniques** :
   - Ne JAMAIS accoler de suffixes templates répétitifs ou grotesques tels que « — ce qui dispense formellement de toute exploration », « rendant tout bilan inutile », etc.
   - Les distracteurs doivent reposer sur des **inversions cliniques et biologiques réelles** du cours :
     - Origine centrale vs périphérique / régénératif vs arégénératif.
     - Anomalie de volume (microcytaire < 80 fL vs macrocytaire > 100 fL).
     - Anomalie de charge (hypochrome vs normochrome).
     - Inversion de seuils chiffrés ou cinétique (élévation vs abaissement).
     - Inversion d'indication thérapeutique ou contre-indication formelle.

3. **Diversification de la Syntaxe** :
   - Ne jamais faire des QCM où toutes les propositions ont la même structure.
   - Jongler entre :
     - Assertions courtes et percutantes (terme, valeur chiffrée, diagnostic précis).
     - Phrases simples affirmatives.
     - Phrases complexes semant le doute méthodologique ou intégrant une nuance clinique.

---

## 3. Code Couleur de Navigation et Suivi de Progression

Dans tout lecteur de session QCM (barre des numéros 1, 2, 3, 4, 5...) :
- **Vert** : La question a été traitée et la réponse est exacte (question trouvée).
- **Rouge** : La question a été traitée et la réponse est fausse (question ratée).
- **Terre cuite / Accent** : Question actuellement sélectionnée en cours de réponse.
- **Gris neutre** : Question non encore abordée.
- Afficher en continu le score intermédiaire (ex. `✓ 2 / ✗ 1`) et le chronomètre pour situer l'étudiant.

---

## 4. Tolérance aux Pannes et Sécurité des Données Cliniques

- Aucun appel à `.toLowerCase()`, `.trim()`, `.replace()` ou `.includes()` ne doit être fait directement sur un champ clinique sans garde-fou :
  - Privilégier systématiquement : `String(valeur || "").trim().toLowerCase()`.
- Les listes d'options et les énoncés doivent être nettoyés avant affichage (suppression des en-têtes bruts de diapositive type `Frottis Sanguin:` ou des parenthèses orphelines `(Anémies.`).
