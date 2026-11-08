// tests/synthesisEngineV3.test.ts
import {
  computeSectionQuotas,
  buildEliteSynthesisPrompt,
  synthesisMarkdownToHtml,
  DEFAULT_SYNTHESIS_CONFIG,
  type SynthesisConfig,
} from '../src/lib/synthesisEngineV3';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ÉCHEC : ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ SUCCÈS : ${message}`);
  }
}

console.log('=== TEST 1 : CALCUL DES DENSITÉS PAR OBJECTIF (computeSectionQuotas) ===');
const testObjectives = [
  "1. Définir l'anémie",
  "2. Décrire les signes cliniques",
  "3. Interpréter l'hémogramme",
  "4. Mener la démarche diagnostique étiologique",
  "5. Énoncer les principes de traitement",
];

const quotas = computeSectionQuotas(testObjectives, 2000);
console.log('Quotas calculés pour 2000 mots :', quotas);

assert(quotas.length === 5, 'Il doit y avoir exactement 5 sections pondérées');
const totalPercent = quotas.reduce((acc, q) => acc + q.percentage, 0);
assert(totalPercent >= 98 && totalPercent <= 102, `La somme des pourcentages doit être ~100% (trouvé: ${totalPercent}%)`);

const defSection = quotas.find(q => q.index === 1);
const demSection = quotas.find(q => q.index === 4);
assert(defSection !== undefined && demSection !== undefined, 'Sections 1 et 4 trouvées');
assert(demSection!.targetWords > defSection!.targetWords * 2, 'La démarche diagnostique doit avoir un budget > 2x la définition');

console.log('=== TEST 2 : GÉNÉRATION DU PROMPT MAÎTRE POUR LES 3 DOCTRINES ===');
const sampleCourse = "Diapositive 1 : Pr Dupont. Diapositive 2 : Définition Hb < 13 g/dl homme. Diapositive 3 : Traitement fer ferreux 200 mg/j.";

// Doctrine 1
const p1 = buildEliteSynthesisPrompt(sampleCourse, testObjectives, {
  ...DEFAULT_SYNTHESIS_CONFIG,
  doctrine: 'objectives_verbatim',
  targetWordCount: 1500,
});
assert(p1.systemInstruction.includes("LOI D'EXHAUSTIVITÉ INVIOLABLE"), 'Le prompt doit contenir la loi anti-troncature');
assert(p1.systemInstruction.includes("OVERRIDE SYSTÈME ABSOLU"), 'Le prompt doit purger les anciennes consignes');
assert(p1.systemInstruction.includes("SYNTHÈSE STRICTE À PARTIR DES OBJECTIFS"), 'Doit contenir les instructions de la doctrine 1');
assert(p1.apiGenerationConfig.maxOutputTokens === 8192, 'maxOutputTokens doit être 8192');

// Doctrine 2
const p2 = buildEliteSynthesisPrompt(sampleCourse, testObjectives, {
  ...DEFAULT_SYNTHESIS_CONFIG,
  doctrine: 'harvard_method',
  targetWordCount: 2500,
});
assert(p2.systemInstruction.includes("LA MÉTHODE HARVARD"), 'Doit contenir les instructions Harvard');

// Doctrine 3
const p3 = buildEliteSynthesisPrompt(sampleCourse, testObjectives, {
  ...DEFAULT_SYNTHESIS_CONFIG,
  doctrine: 'world_number_one',
  targetWordCount: 4000,
});
assert(p3.systemInstruction.includes("STANDARD MONDIAL N°1"), 'Doit contenir les instructions AMBOSS/First Aid');

console.log('=== TEST 3 : CONVERSION MARKDOWN EN HTML BUREAUTIQUE ===');
const markdownSample = `
## 1. Définir l'anémie *(Quota : 10 % — ~200 mots)*
---
<u>Définition biologique</u> : diminution de la masse d'hémoglobine circulante.
- <span class="hl-blue">Hb < 13 g/dl</span> chez l'homme.
- <span class="hl-red">Fausse anémie par hémodilution</span> : grossesse, splénomégalie.
⚡ **HIGH-YIELD FACTS** : Toujours vérifier le volume plasmatique.
| Paramètre | Norme Homme | Norme Femme |
| Hb | > 13 g/dl | > 12 g/dl |
| VGM | 80 - 100 fl | 80 - 100 fl |
`;

const renderedHtml = synthesisMarkdownToHtml(markdownSample);
assert(renderedHtml.includes('synthesis-h2'), 'Le HTML doit contenir la classe synthesis-h2');
assert(renderedHtml.includes('hl-blue'), 'Le HTML doit préserver hl-blue');
assert(renderedHtml.includes('hl-red'), 'Le HTML doit préserver hl-red');
assert(renderedHtml.includes('<table'), 'Le HTML doit convertir le tableau');

console.log('🎉 TOUS LES TESTS DU MOTEUR V3 SONT VALIDÉS AVEC SUCCÈS !');
