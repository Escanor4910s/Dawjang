import { readFileSync } from "node:fs";
import { cleanSourceText, withSlideMarkers, expectedObjectiveCount, validateSummary, wc, type SummaryDoc } from "../supabase/functions/_shared/summary-gate.ts";

// 1) Le cours réel, tel que l'extraction PDF le livre (une page = une diapositive)
const coursUrl = new URL("./cours.txt", import.meta.url);
const raw = readFileSync(coursUrl, "utf8");
const pages = raw.split("\f").filter((_, i, a) => i < a.length - 1 || a[i].trim());
const course = withSlideMarkers(pages);
console.log("Diapositives:", pages.length, "| mots du cours:", wc(course));
console.log("Objectifs détectés (regex tolérante):", expectedObjectiveCount(course));
// version « aplatie » (pdfjs .join(' ') sans retours à la ligne), comme dans useFileReader
const flat = pages.map((p) => p.replace(/\s+/g, " ")).join("\n\n");
console.log("Objectifs détectés (texte aplati):", expectedObjectiveCount(flat));
console.log("Glyphes parasites avant nettoyage:", (raw.match(/[\uE000-\uF8FF]/g) || []).length, "→ après:", (cleanSourceText(raw).match(/[\uE000-\uF8FF]/g) || []).length);

const mk = (n: number, verb: any, statement: string, lead: string, points: string[], slides: number[], cov: any = "full") =>
  ({ n, verb, statement, lead, points: points.map((t) => ({ text: t })), slides, coverage: cov }) as any;

// 2) Le résumé RATÉ reconstitué depuis le PDF produit par l'application
const bad: SummaryDoc = {
  schema_version: 2, mode: "objectives", title: "3_ENZYMOPATHIES",
  objectives: [
    mk(1, "definir", "Définir les anémies par déficits enzymatiques", "Définition : Anémies par déficits — enzymatiques — Pr Moussa Seck.", [], [1]),
    mk(2, "decrire", "Décrire les signes cliniques du déficit en G6PD G6PD", "", [
      "qForme latente : Fréquente, Découverte souvent fortuite ou au cours d’enquête familiale, Absence de signes cliniques, ni hématologique.",
      "qAnémie hémolytique chronique : Manifestation rare du déficit en G6PD, Déficit en G6PD (B-), Triade de Chauffard, Evolution : Accentuation de l’hémolyse au cours de maladies fébriles ou, lors de prise de certains médicaments.",
      "qIctère hémolytique néonatal : Fréquent dans tous les types de déficit, Anémie hémolytique aigue néonatale sans incompatibilité materno-, fœtale Rh ou ABO, Risque d’ictère nucléaire."], [2, 19]),
    mk(3, "decrire", "Décrire les signes cliniques du déficit en PK", "", [
      "qForme latente : Fréquente, Découverte souvent fortuite ou au cours d’enquête familiale, Absence de signes cliniques, ni hématologique.",
      "qAnémie hémolytique chronique : Manifestation rare du déficit en G6PD, Déficit en G6PD (B-), Triade de Chauffard, Evolution : Accentuation de l’hémolyse au cours de maladies fébriles ou, lors de prise de certains médicaments.",
      "qIctère hémolytique néonatal : Fréquent dans tous les types de déficit, Anémie hémolytique aigue néonatale sans incompatibilité materno-, fœtale Rh ou ABO, Risque d’ictère nucléaire."], [2, 19]),
    mk(4, "traiter", "Enumérer les indications thérapeutiques des anémies par déficit en G6PD ou en PK", "1- Définir les anémies par déficits enzymatiques 2- Décrire les signes cliniques du déficit en G6PD", [], [2], "partial"),
  ],
};

// 3) La fiche ATTENDUE (référence « or ») : ce que le moteur doit produire pour ce cours
const gold: SummaryDoc = {
  schema_version: 2, mode: "objectives", title: "Anémies par déficits enzymatiques",
  objectives: [
    mk(1, "definir", "Définir les anémies par déficits enzymatiques",
      "Anémie hémolytique congénitale : durée de vie des GR raccourcie, avec baisse de la masse d'hémoglobine circulante, par déficit congénital d'une enzyme du métabolisme érythrocytaire.", [], [4]),
    { ...mk(2, "decrire", "Décrire les signes cliniques du déficit en G6PD", "Deux tableaux : crise hémolytique aiguë (la plus fréquente) et formes chroniques.", [], [13, 14, 19]),
      points: [
        { label: "Début", text: "brutal, 1 à 3 jours après un médicament (antipaludéen, primaquine++)" },
        { label: "Fonctionnel", text: "syndrome anémique, douleur lombaire ou abdominale" },
        { label: "Examen", text: "pâleur, subictère, fièvre > 38,5 °C, FC > 100/min, FR > 20/min, sueurs profuses" },
        { label: "Urines", text: "rouge porto, parfois oligo-anurie" },
        { label: "Conscience", text: "confusion, obnubilation" },
        { label: "Risques", text: "état de choc, CIVD, insuffisance rénale aiguë" },
        { label: "Forme latente", text: "fréquente, asymptomatique, découverte fortuite ou enquête familiale" },
        { label: "Hémolyse chronique", text: "rare, G6PD B-, triade de Chauffard, aggravée par fièvre ou médicaments" },
        { label: "Néonatal", text: "ictère hémolytique sans incompatibilité Rh/ABO, risque d'ictère nucléaire" }] },
    { ...mk(3, "citer", "Citer les facteurs déclenchant l'hémolyse dans le déficit en G6PD", "3 familles de facteurs.", [], [12, 28]),
      points: [
        { label: "Médicaments", text: "contre-indiqués : primaquine, dapsone, nitrofurantoïne, acide nalidixique, rasburicase, sulfaméthoxazole, sulfadiazine orale, sulfasalazine, bleu de méthylène IV, métamizole" },
        { label: "Médicaments", text: "déconseillés : chloroquine, quinine, quinolones, sulfamides hypoglycémiants, vitamine K" },
        { label: "Infections", text: "maladies fébriles" },
        { label: "Aliment", text: "fèves" }] },
    { ...mk(4, "decrire", "Décrire les signes cliniques du déficit en PK", "Anémie hémolytique chronique : triade de Chauffard, souvent découverte fortuite.", [], [23, 24]),
      points: [
        { label: "Découverte", text: "hémogramme systématique, splénomégalie, enquête familiale" },
        { label: "Crises", text: "déglobulisation (anémie aiguë), déclenchées par infections" },
        { label: "Chronique", text: "lithiase biliaire, ulcère de jambe, déformations osseuses" }] },
    { ...mk(5, "traiter", "Énumérer les indications thérapeutiques des anémies par déficit en G6PD ou en PK", "Selon le type d'hémolyse.", [], [27, 29, 30]),
      points: [
        { label: "Hémolyse aiguë G6PD (A-, B-)", text: "hospitalisation, arrêt du facteur déclenchant, transfusion de CGR, réanimation hydro-électrolytique" },
        { label: "Hémolyse chronique (PK, autres)", text: "acide folique 5 à 10 mg/j, splénectomie" },
        { label: "Hémolyse néonatale", text: "exsanguinotransfusion" }] },
  ],
};

for (const [name, doc] of [["RÉSUMÉ RATÉ (celui de l'appli)", bad], ["FICHE ATTENDUE (référence)", gold]] as const) {
  const r = validateSummary(doc, course, 0.35);
  console.log(`\n=== ${name} → ${r.ok ? "✅ ACCEPTÉE" : "❌ REJETÉE"}`);
  console.log(" métriques:", JSON.stringify({ ...r.metrics, ratio: +r.metrics.ratio.toFixed(2), verbatim: +r.metrics.verbatim.toFixed(2) }));
  r.errors.forEach((e) => console.log("  -", e));
}
