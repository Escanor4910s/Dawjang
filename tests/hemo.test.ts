import { withSlideMarkers, sourceStats, validateSummary, wc, type SummaryDoc } from "../supabase/functions/_shared/summary-gate.ts";
// Reconstitution du cours « Hémoglobinopathies M1 » tel que le moteur local le voit :
// la diapo Objectifs + quelques titres seulement (le reste = images sans texte).
const obj = "Objectifs 1. Définir la drépanocytose 2. Décrire les étapes du diagnostic positif de la drépanocytose 3. Décrire les étapes de diagnostic positif des différentes complications de la drépanocytose 4. Enoncer le principe de la prise en charge de la drépanocytose 5. Définir les thalassémies 6. Décrire les étapes du diagnostic positif de la bêta et alpha thalassémie 7. Décrire les indications thérapeutiques dans les thalassémies";
const pages = ["Hémoglobinopathies M1", obj, "Plan", "Anomalies de l’hémoglobine", "Anomalies de structure: modification dans la séquence polypeptidique", "", "", "", "Électrophorèse de l’hémoglobine Principe: migration selon la charge électrique et le pH", "", "", "Bêta thalassémies — Diagnostic positif", "", "", "Principes actuels de la prise en charge de la drépanocytose Un diagnostic précoce"];
const course = withSlideMarkers(pages);
const st = sourceStats(course);
console.log("SOURCE:", JSON.stringify({ ...st, wordsPerSlide: +st.wordsPerSlide.toFixed(1) }), st.poor ? "→ REFUSÉE (cours creux), message clair à l'étudiant" : "→ ok");

const list = obj.replace("Objectifs ", "");
const mk = (n: number, verb: any, statement: string, lead: string, points: string[]) => ({ n, verb, statement, lead, points: points.map((text) => ({ text })), slides: [2], coverage: "full" }) as any;
const stmts = ["Définir la drépanocytose", "Décrire les étapes du diagnostic positif de la drépanocytose", "Décrire les étapes de diagnostic positif des différentes complications de la drépanocytose", "Enoncer le principe de la prise en charge de la drépanocytose", "Définir les thalassémies", "Décrire les étapes du diagnostic positif de la bêta et alpha thalassémie", "Décrire les indications thérapeutiques dans les thalassémies"];
const verbs = ["definir", "decrire", "decrire", "decrire", "definir", "decrire", "decrire"];
// la fiche de l'application : chaque objectif = la liste des objectifs recopiée
const bad: SummaryDoc = { schema_version: 2, mode: "objectives", title: "6_Hemoglobinopathies M1",
  objectives: stmts.map((s, i) => mk(i + 1, verbs[i], s, i === 0 || i === 4 ? "Définition : " + list.slice(0, 190) : "", i === 0 || i === 4 ? [] : [list])) };
const r = validateSummary(bad, course, 0.35);
console.log("FICHE DE L'APPLICATION →", r.ok ? "acceptée ✗" : "REJETÉE ✓");
r.errors.forEach((e) => console.log("  -", e));
