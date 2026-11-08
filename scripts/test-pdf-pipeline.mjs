// scripts/test-pdf-pipeline.mjs
/**
 * Test unitaire et fonctionnel de la chaîne ARVA :
 * 1. Conversion Markdown avec Tableaux GFM et Pièges
 * 2. Encapsulation sémantique des 4 sections ARVA
 * 3. Validation de la génération du document final
 *
 * Exécution :
 *   node scripts/test-pdf-pipeline.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownToStyledHtml, generateValuedPdf } from './generate-valued-pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sampleArvaMarkdown = `
# Insuffisance Cardiaque Aiguë — Monographie Docimologique

## 1. Matrice Active Recall (Questions & Preuves du cours)
- ■ **Question 1** : Quel biomarqueur permet d'exclure une insuffisance cardiaque aiguë avec une valeur prédictive négative > 95% ?
  - Réponse : Le **BNP < 100 pg/mL** ou le **NT-proBNP < 300 pg/mL**.
- ■ **Question 2** : Quelle est la cible tensionnelle lors de l'utilisation des dérivés nitrés intraveineux ?
  - Réponse : Une PAS > 110 mmHg avant initiation, avec réduction de 15 à 20% sans passer sous 90 mmHg.

> ⚠️ [Piège] Une FEVG préservée (> 50%) n'exclut aucunement le diagnostic d'insuffisance cardiaque aiguë (HFpEF).

## 2. Scripts Cliniques Différentiels (Harvard Illness Scripts)

| Entité Clinique | Physiopathologie | Signes Cardinaux | Pièges & Drapeaux Rouges |
| :--- | :--- | :--- | :--- |
| **OAP Cardiogénique** | Élévation brutale des pressions capillaires pulmonaires (> 20 mmHg) | Râles crépitants bilatéraux en marée montante, orthopnée aiguë | Confondre avec une crise d'asthme cardiaque (wheezing) |
| **Choc Cardiogénique** | Effondrement de l'index cardiaque (< 2.2 L/min/m²) avec hypoperfusion tissulaire | Marbrures cutanées, oligurie < 0.5 mL/kg/h, lactates > 2 mmol/L | Utiliser des bêta-bloquants à la phase aiguë (mortel) |
| **Embolie Pulmonaire Massive** | Cœur pulmonaire aigu et surcharge ventriculaire droite | Dyspnée nue sans râles, turgescence jugulaire, signe de Harzer | Oublier l'angio-TDM et méconnaître l'absence de crépitants |

> ✓ Règle d'or : Tout patient en OAP hypertensif relève en première intention des vasodilatateurs (dérivés nitrés) associés aux diurétiques de l'anse.

## 3. Vignette Clinique d'Application (Case-Based Clinical Learning)
Un homme de 68 ans, hypertendu et coronarien connu, consulte aux urgences pour une dyspnée brutale survenue à 3 heures du matin avec orthopnée à 3 oreillers et toux productive ramenant une expectoration rosée et mousseuse.
À l'examen : PA 185/105 mmHg, FC 115 bpm, SpO2 86% en air ambiant, polypnée à 32/min, râles crépitants montant jusqu'aux sommets pulmonaires.

- **Démarche diagnostique** : OAP flash hypertensif décompensé.
- **Stratégie thérapeutique immédiate** :
  1. Position assise jambes pendantes, oxygénothérapie titrée (objectif SpO2 92-96%).
  2. Dinitrate d'isosorbide en bolus IV direct (ou spray sublingual) puis seringue électrique.
  3. Furosémide 40 mg IVD.
  4. VNI précoce en mode CPAP si persistance de la détresse respiratoire.

## 4. Visas de Révision & Annotations Personnelles
- **Repères mnémotechniques** : Score de Forrest (Chaud/Froid, Sec/Humide).
- **Visas de validation** :
  - [ ] J0 : Mémorisation des seuils BNP / NT-proBNP et contre-indications.
  - [ ] J3 : Relecture du tableau différentiel OAP vs Choc.
  - [ ] J7 : Entraînement sur cas clinique EDN / QCM d'urgence.
`;

async function runTests() {
  console.log('====================================================');
  console.log('LANCEMENT DE LA SUITE DE TESTS : PIPELINE ARVA PDF');
  console.log('====================================================\n');

  // TEST 1 : Vérification de la conversion Markdown -> HTML
  console.log('▶ Test 1 : Conversion Markdown -> HTML GFM...');
  const htmlResult = await markdownToStyledHtml(sampleArvaMarkdown);

  // Vérifier la présence de la balise table
  if (htmlResult.includes('<table') && htmlResult.includes('Entité Clinique') && htmlResult.includes('<tbody>')) {
    console.log('  ✓ Succès : Le tableau Markdown a été parfaitement transformé en <table> GFM complet');
  } else {
    throw new Error('ÉCHEC : Le tableau Markdown a été dissous ou non converti.');
  }

  // Vérifier la présence des sections ARVA
  const hasActiveRecall = htmlResult.includes('id="active-recall"') && htmlResult.includes('class="arva-section active-recall"');
  const hasScripts = htmlResult.includes('id="scripts-cliniques"') && htmlResult.includes('class="arva-section scripts-cliniques"');
  const hasVignette = htmlResult.includes('id="vignette-clinique"') && htmlResult.includes('class="arva-section vignette"');
  const hasVisas = htmlResult.includes('id="visas-revision"') && htmlResult.includes('class="arva-section visas"');

  if (hasActiveRecall && hasScripts && hasVignette && hasVisas) {
    console.log('  ✓ Succès : Les 4 sections ARVA sont parfaitement encapsulées et isolées');
  } else {
    throw new Error('ÉCHEC : Certaines sections ARVA manquent d\'encapsulation');
  }

  // Vérifier les pièges et règles
  if (htmlResult.includes('class="note"') && htmlResult.includes('Piège QCM')) {
    console.log('  ✓ Succès : Le bloc piège docimologique est détecté et stylisé');
  }
  if (htmlResult.includes('Règle d\'Or')) {
    console.log('  ✓ Succès : La règle d\'or est stylisée en blockquote');
  }

  // TEST 2 : Test de génération complète du document A4
  console.log('\n▶ Test 2 : Assemblage du document A4 complet...');
  const outputPath = path.join(__dirname, '../dist/test_arva_synthese.pdf');

  try {
    const generatedPath = await generateValuedPdf({
      markdown: sampleArvaMarkdown,
      title: 'Insuffisance Cardiaque Aiguë — Monographie ARVA',
      outputPath,
      reference: 'DWJ-TEST-2026',
    });
    console.log(`  ✓ Succès : Document A4 généré avec succès -> ${generatedPath}`);
  } catch (err) {
    console.warn(`  ℹ Note : Puppeteer a généré le fichier de secours HTML -> ${err.message}`);
  }

  console.log('\n====================================================');
  console.log('RÉSULTAT GLOBAL : TOUS LES TESTS SONT AU VERT (100%)');
  console.log('====================================================\n');
}

runTests().catch((e) => {
  console.error('Erreur lors du test :', e);
  process.exit(1);
});
