// tests/synthesisEngineV3.test.ts
import { test, expect } from 'vitest';
import {
  computeSectionQuotas,
  buildEliteSynthesisPrompt,
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

const quotas = computeSectionQuotas({
  ...DEFAULT_SYNTHESIS_CONFIG,
  objectives: testObjectives,
  densityMode: 'balanced',
  targetWordCount: 2000,
});
console.log('Quotas calculés pour 2000 mots :', quotas);

assert(quotas.sectionCount === 5, 'Il doit y avoir exactement 5 sections pondérées');
assert(!quotas.isUnlimited, 'Le plafond de 2000 mots doit être actif');
assert(quotas.wordsPerSection === 400, 'Chaque objectif doit recevoir 400 mots');
assert(quotas.minTotalWords === 1800 && quotas.maxTotalWords === 2300, 'Les bornes de longueur doivent encadrer la cible');

console.log('=== TEST 2 : GÉNÉRATION DU PROMPT MAÎTRE POUR LES 3 DOCTRINES ===');
const sampleCourse = "Diapositive 1 : Pr Dupont. Diapositive 2 : Définition Hb < 13 g/dl homme. Diapositive 3 : Traitement fer ferreux 200 mg/j.";

// Doctrine 1
const p1 = buildEliteSynthesisPrompt(sampleCourse, testObjectives, {
  ...DEFAULT_SYNTHESIS_CONFIG,
  doctrine: 'objectives_verbatim',
  targetWordCount: 1500,
});
assert(p1.systemInstruction.includes("PAR OBJECTIFS DU COURS"), 'Doit contenir les instructions de la doctrine 1');
assert(p1.systemInstruction.includes("sans en fusionner ni en omettre aucun"), 'Le prompt doit contenir la loi anti-troncature');
assert(p1.systemInstruction.includes("PROTECTION DES TABLEAUX FLÉCHÉS"), 'Le prompt doit préserver les données de fin de cours');
assert(p1.apiGenerationConfig.maxOutputTokens === 8192, 'maxOutputTokens doit être 8192');

// Doctrine 2
const p2 = buildEliteSynthesisPrompt(sampleCourse, testObjectives, {
  ...DEFAULT_SYNTHESIS_CONFIG,
  doctrine: 'harvard_method',
  targetWordCount: 2500,
});
assert(p2.systemInstruction.includes("MÉTHODE DE HARVARD"), 'Doit contenir les instructions Harvard');

// Doctrine 3
const p3 = buildEliteSynthesisPrompt(sampleCourse, testObjectives, {
  ...DEFAULT_SYNTHESIS_CONFIG,
  doctrine: 'world_number_one',
  targetWordCount: 4000,
});
assert(p3.systemInstruction.includes("STANDARD MONDIAL N°1"), 'Doit contenir les instructions AMBOSS/First Aid');

test('les quotas et les prompts V3 restent cohérents', () => {
  expect(quotas.sectionCount).toBe(5);
  expect(p1.userPrompt).toContain(sampleCourse);
  expect(p2.quotas.sectionCount).toBe(5);
});
console.log('🎉 TOUS LES TESTS DU MOTEUR V3 SONT VALIDÉS AVEC SUCCÈS !');
