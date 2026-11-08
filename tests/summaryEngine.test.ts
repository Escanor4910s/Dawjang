import assert from "node:assert/strict";
import {
  calculateObjectiveQuotas,
  buildCourseSummaryPrompt,
  DEFAULT_SUMMARY_PARAMS,
  medicalMarkdownToHtml,
} from "../src/lib/summaryEngine.js";

const SAMPLE_OBJECTIVES = [
  "1. Définir l'anémie",
  "2. Décrire les différents mécanismes d'une anémie",
  "3. Énumérer les différents signes cliniques d'une anémie",
  "4. Savoir interpréter un hémogramme",
  "5. Savoir mener la démarche du diagnostic étiologique d'une anémie en fonction de son type",
  "6. Énoncer les principes du traitement des anémies",
];

console.log("=== TEST CALCULATE OBJECTIVE QUOTAS ===");
const quotas500 = calculateObjectiveQuotas(SAMPLE_OBJECTIVES, 500);
console.log("Quotas pour 500 mots :", quotas500);

assert.equal(quotas500.length, 6, "Doit avoir 6 quotas pour 6 objectifs");
assert.equal(quotas500[0].category, "definition", "Obj 1 doit être definition");
assert.equal(quotas500[4].category, "diagnostic_workup", "Obj 5 doit être diagnostic_workup");
assert.equal(quotas500[5].category, "treatment", "Obj 6 doit être treatment");

// Le total des pourcentages doit être proche de 100%
const sumPct = quotas500.reduce((s, q) => s + q.percentage, 0);
console.log("Somme des pourcentages :", sumPct);
assert.ok(sumPct >= 95 && sumPct <= 105, "La somme des pourcentages doit avoisiner 100%");

// L'allocation de mots doit refléter la pondération taxonomique
assert.ok(quotas500[4].allocatedWords > quotas500[0].allocatedWords, "Démarche étiologique doit avoir plus de mots que définition");

console.log("=== TEST BUILD COURSE SUMMARY PROMPT ===");
const prompt = buildCourseSummaryPrompt("Contenu du cours sur les anémies...", SAMPLE_OBJECTIVES, {
  ...DEFAULT_SUMMARY_PARAMS,
  targetWordCount: 500,
  compressionStyle: "v2_ultra_compact_lists",
});

assert.ok(prompt.systemInstruction.includes("PLAFOND GLOBAL STRICT : 500 mots"), "Doit mentionner le budget strict");
assert.ok(prompt.systemInstruction.includes("ARCHITECTURE V2"), "Doit spécifier l'architecture V2");
assert.ok(prompt.systemInstruction.includes("STYLE TÉLÉGRAPHIQUE"), "Doit spécifier le style télégraphique");
assert.ok(prompt.systemInstruction.includes("Quota strict ="), "Doit contenir le blueprint des quotas");

console.log("=== TEST MEDICAL MARKDOWN TO HTML ===");
const sampleMd = `## 1. Définir l'anémie *(Quota : 8 % — ~40 mots)*
* **Définition** : Baisse de l'hémoglobine < 13 g/dL (homme) ou < 12 g/dL (femme) avec volume plasmatique normal.

## 2. Démarche étiologique *(Quota : 35 % — ~175 mots)*
* **Algorithme** : Réticulocytes → si < 80 000/mm³ centrale, si > 80 000/mm³ périphérique.`;

const html = medicalMarkdownToHtml(sampleMd);
assert.ok(html.includes("OBJECTIF 1"), "Doit contenir le badge OBJECTIF 1");
assert.ok(html.includes("Quota : 8 % — ~40 mots"), "Doit contenir le badge de quota");
assert.ok(html.includes("strong"), "Doit formater le gras chirurgical");

console.log("✅ TOUS LES TESTS DU MOTEUR DE QUOTAS SONT VALIDÉS AVEC SUCCÈS !");
