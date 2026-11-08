// supabase/functions/generate-summary/index.ts  —  MOTEUR DE RÉSUMÉ v2
// Principe : UN appel IA sur le cours ENTIER (texte + PDF lu nativement) → JSON structuré → contrôle qualité → 1 réparation auto.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";
import { encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { getUserPlanInfo } from "../_shared/plan-utils.ts";
import { logDiagnostic } from "../_shared/ai-utils.ts";
import { cleanSourceText, sourceStats, validateSummary, wc, type SummaryDoc } from "../_shared/summary-gate.ts";
import {
  calculateObjectiveQuotas,
  buildCourseSummaryPrompt,
  extractObjectivesFromCourseText,
  DEFAULT_SUMMARY_PARAMS,
  type SummaryParameters,
  type ObjectiveQuota,
} from "../_shared/summary-engine.ts";
import {
  buildEliteSynthesisPrompt,
  DEFAULT_SYNTHESIS_CONFIG,
  type SynthesisConfig,
  type SynthesisDoctrine,
} from "../_shared/synthesis-engine-v3.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MODEL = Deno.env.get("SUMMARY_MODEL") || "google/gemini-2.5-flash"; // qualité max : "google/gemini-2.5-pro"
const ENFORCE_PLAN = false; // true = flash gratuit, objectives/harvard réservés au Premium
const BUCKET = "course-files";
const DENSITY: Record<string, number> = { essential: 0.25, balanced: 0.35, detailed: 0.5 };
const MODE_ALIAS: Record<string, "objectives" | "harvard" | "flash"> = {
  objectives: "objectives", complete: "objectives", harvard: "harvard", structured: "harvard", flash: "flash", concise: "flash",
};

// ───────────── DOCTRINE DOCIMOLOGIQUE SUPRÊME (Prompt Final Salvateur) ─────────────
const DOCTRINE = `Tu es professeur agrégé de médecine et expert en docimologie médicale internationale (concours d'internat, ECN, examens de faculté).
Tu rédiges des fiches de synthèse haute précision pour des étudiants en médecine francophones.
Tu reçois UN cours complet découpé en diapositives numérotées (« --- Diapositive N --- »), et éventuellement le PDF original.
Tu réponds UNIQUEMENT par un objet JSON valide et rigoureusement conforme au schéma. Aucun texte hors JSON.

PRINCIPES MÉDICAUX NON NÉGOCIABLES
P1 FIDÉLITÉ ABSOLUE AU COURS — Chaque fait, seuil, posologie et terme médical provient exclusivement du cours fourni. Ne jamais inventer ni extrapoler. Si un objectif n'est pas abordé dans le cours : coverage="absent_from_course", lead="Non traité dans ce cours.", points=[].
P2 DENSITÉ DOCIMOLOGIQUE MAXIMALE (ZÉRO TRONCATURE) — Tu structures et hiérarchises l'intégralité des connaissances médicales du cours par appareil/mécanisme en éliminant le bruit administratif. Tu conserves 100 % des faits, termes nosologiques, noms de molécules, chiffres, seuils diagnostiques, unités, classifications et posologies.
P3 INTERDICTION DE LA DIAPOSITIVE 1 & DES NOMS D'ENSEIGNANTS — La diapositive 1 (page de garde : titre du cours, nom du professeur, ex. « Pr Moussa Seck », faculté, date) ne contient JAMAIS une définition médicale. Tu as interdiction formelle d'extraire des noms de professeurs, des mentions administratives ou des dates de cours.
P4 MÉTA-DIAPOSITIVES INTERDITES — Les diapositives « Objectifs », « Plan », « Sommaire », « Introduction administrative » et « Conclusion / Remerciements » ne sont JAMAIS la source d'une réponse. Le contenu clinique provient exclusivement des diapositives de fond (Généralités nosologiques, Clinique, Paraclinique, Diagnostic différentiel, Traitement).
P5 UN OBJECTIF = UNE RÉPONSE PROPRE ET UNIQUE — Deux objectifs différents ne doivent JAMAIS avoir le même contenu. Si le cours aborde deux entités différentes (ex. Déficit en G6PD vs Déficit en PK), dissocie-les scrupuleusement : ne recopie jamais les caractéristiques de l'une sur l'autre.
P6 LECTURE VISUELLE & ANTIMACRO — Lis les tableaux, algorithmes et schémas du cours (ex. arbres décisionnels, bilans en images). Remplace les symboles : ↗ = augmenté, ↘ = diminué, « ˃ » = « > », « ˂ » = « < ». Supprime sans exception les puces corrompues de polices Wingdings/Symbol (ex. « qForme latente » → « Forme latente », carrés, losanges, Ø).
P7 NUMÉROTATION EXACTE — Respecte le nombre et l'ordre des objectifs du cours. L'énoncé (statement) est nettoyé : une seule phrase grammaticalement correcte, sans numéro de diapositive, sans résidu d'autres phrases.
P8 LANGAGE MÉDICAL TÉLÉGRAPHIQUE — Style médical dense, précis, sans formules de politesse ni fioritures.

FORME CALIBRÉE SELON LE VERBE COGNITIF DE L'OBJECTIF (Bloom Taxonomy)
• definir — Définition nosologique et physiopathologique complète et approfondie. Développe les critères nosologiques, les mécanismes, les formes cliniques et les seuils chiffrés majeurs dans "points" sans aucune limitation arbitraire de longueur.
• citer (Citer, Énumérer, Lister) — "points" = liste STRICTE, EXHAUSTIVE et PRÉCISE des éléments demandés, une puce claire par élément. "lead" = intitulé synthétique (ex. « 3 mécanismes étiologiques majeurs »).
• decrire (Décrire, Expliquer, Reconnaître) — "points" regroupés par rubrique ("label" : phase, système, mécanisme causal), une ligne dense par rubrique. Physiopathologie sous forme de chaîne causale fléchée explicite « Cause → Événement cellulaire → Conséquence clinique ». "lead" = 1 phrase de synthèse globale.
• interpreter (Interpréter, Diagnostiquer, Comparer, Classer) — Structurer sous forme de tableau "table" si comparaison d'entités ; sinon points clés avec critères majeurs/mineurs et valeurs seuils précises.
• traiter (Traiter, Prise en charge, Indications thérapeutiques) — Hiérarchie d'action clinique : situation/urgence ("label"), traitement de 1ère intention, posologie exacte, surveillance et contre-indication formelle.
• autre — Adapte la structure avec la rigueur la plus proche du verbe.

"exam_tip" : Signale le PIÈGE DE CENSURE QCM ou le détail docimologique critique (« Attention », « Forme trompeuse », « Contre-indication formelle », « À ne pas confondre avec »). Si aucun piège explicite dans le cours, laisser null. ≤ 25 mots.
"slides" : Liste des numéros des diapositives de fond exploitées (exclure diapositives 1, objectifs et sommaire).

EXHAUSTIVITÉ INTÉGRALE : Traite 100 % des objectifs pédagogiques et cliniques sans aucune restriction ni plafond de budget de mots. Développe chaque objectif dans sa plénitude académique pour produire une synthèse autonome parfaite.`;

const MODE_RULES: Record<string, string> = {
  objectives: `MODE « OBJECTIFS » : remplis "objectives" (un bloc par objectif du cours, dans l'ordre). qa_matrix=[], comparison=null, vignette=null, flash=null.`,
  harvard: `MODE « HARVARD » (Active-Recall & Illness Scripts) : objectives=[]. 
- "qa_matrix" : au moins une question-cible de type QCM/clinique PAR objectif du cours, et la réponse exacte en une ligne (avec seuils), "slide" = diapositive-preuve.
- "comparison" : UN tableau différentiel des entités que le cours oppose (ex. maladies, formes, stades) ; colonnes = Entité | Mécanisme | Signe discriminant | À ne pas confondre. Lignes issues du cours uniquement.
- "vignette" : un cas clinique bref construit avec les données et seuils du cours (présentation → démarche → prise en charge). Tout détail non fourni par le cours (âge, profession) reste neutre. 
flash=null.`,
  flash: `MODE « FICHE FLASH » (veille d'examen) : objectives=[], qa_matrix=[], comparison=null, vignette=null.
"flash" : definition (1 phrase) ; key_points (15 à 30 lignes de ≤ 20 mots : définitions, formes cliniques, signes cardinaux, examens clés, traitements) ; thresholds (valeurs chiffrées clés) ; pitfalls (uniquement les pièges signalés par le cours, sinon []).`,
};

// ───────────── SCHÉMA JSON ─────────────
const S = (extra: Record<string, unknown>) => ({ additionalProperties: false, ...extra });
const NS = { type: ["string", "null"] };
const TABLE = { type: ["object", "null"], ...S({ properties: { caption: NS, headers: { type: "array", items: { type: "string" } }, rows: { type: "array", items: { type: "array", items: { type: "string" } } } }, required: ["caption", "headers", "rows"] }) };
const SUMMARY_SCHEMA = S({
  type: "object",
  properties: {
    schema_version: { type: "integer", enum: [2] },
    mode: { type: "string", enum: ["objectives", "harvard", "flash"] },
    title: { type: "string" },
    objectives: { type: "array", items: S({ type: "object", properties: {
      n: { type: "integer" }, verb: { type: "string", enum: ["definir", "citer", "decrire", "interpreter", "traiter", "autre"] },
      statement: { type: "string" }, lead: { type: "string" },
      points: { type: "array", items: S({ type: "object", properties: { label: NS, text: { type: "string" } }, required: ["label", "text"] }) },
      table: TABLE,
      numbers: { type: "array", items: S({ type: "object", properties: { label: { type: "string" }, value: { type: "string" } }, required: ["label", "value"] }) },
      exam_tip: NS, slides: { type: "array", items: { type: "integer" } },
      coverage: { type: "string", enum: ["full", "partial", "absent_from_course"] },
    }, required: ["n", "verb", "statement", "lead", "points", "table", "numbers", "exam_tip", "slides", "coverage"] }) },
    qa_matrix: { type: "array", items: S({ type: "object", properties: { q: { type: "string" }, a: { type: "string" }, slide: { type: ["integer", "null"] } }, required: ["q", "a", "slide"] }) },
    comparison: TABLE,
    vignette: { type: ["object", "null"], ...S({ properties: { presentation: { type: "string" }, workup: { type: "string" }, management: { type: "string" } }, required: ["presentation", "workup", "management"] }) },
    flash: { type: ["object", "null"], ...S({ properties: { definition: { type: "string" }, key_points: { type: "array", items: { type: "string" } }, thresholds: { type: "array", items: { type: "string" } }, pitfalls: { type: "array", items: { type: "string" } } }, required: ["definition", "key_points", "thresholds", "pitfalls"] }) },
  },
  required: ["schema_version", "mode", "title", "objectives", "qa_matrix", "comparison", "vignette", "flash"],
});

// ───────────── APPEL IA (repli intelligent multi-modèles et schémas) ─────────────
const CANDIDATE_MODELS = [
  MODEL,
  "google/gemini-2.5-flash",
  "google/gemini-2.0-flash-001",
  "google/gemini-flash-1.5",
];

async function callModel(
  system: string,
  userText: string,
  pdfDataUrl: string | null,
  asJson = true,
  temperature = 0.1
): Promise<string> {
  const orKey = Deno.env.get("OPENROUTER_API_KEY");
  const lovKey = Deno.env.get("LOVABLE_API_KEY");
  if (!orKey && !lovKey) throw Object.assign(new Error("Configuration IA manquante (OPENROUTER_API_KEY)."), { status: 500 });

  const url = orKey ? "https://openrouter.ai/api/v1/chat/completions" : "https://ai.gateway.lovable.dev/v1/chat/completions";
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${orKey || lovKey}` };
  if (orKey) { headers["HTTP-Referer"] = Deno.env.get("APP_PUBLIC_URL") || "https://dawjang.app"; headers["X-Title"] = "DawJang"; }

  const parts: unknown[] = [{ type: "text", text: userText }];
  const withPdf = !!(orKey && pdfDataUrl); // la passerelle Lovable n'est pas garantie pour les PDF
  if (withPdf) parts.push({ type: "file", file: { filename: "cours.pdf", file_data: pdfDataUrl } });

  let lastErr = "Réponse IA invalide";
  const modelsToTry = Array.from(new Set(CANDIDATE_MODELS.filter(Boolean)));

  for (const targetModel of modelsToTry) {
    const base: Record<string, unknown> = {
      model: targetModel,
      temperature, // 0.15 pour le moteur V3, ou 0.1 pour fidélité verbatim
      max_tokens: 16000,
      maxOutputTokens: 8192,
      messages: [{ role: "system", content: system }, { role: "user", content: parts }],
      ...(withPdf ? { plugins: [{ id: "file-parser", pdf: { engine: "native" } }] } : {}),
    };

    const variants = asJson
      ? [
          { ...base, response_format: { type: "json_schema", json_schema: { name: "fiche", strict: true, schema: SUMMARY_SCHEMA } }, ...(orKey ? { reasoning: { max_tokens: 2048 } } : {}) },
          { ...base, response_format: { type: "json_object" } },
          base,
        ]
      : [base];

    for (const body of variants) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 110_000);
      try {
        const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
        const raw = await r.text();
        if (!r.ok) {
          lastErr = `IA ${r.status}: ${raw.slice(0, 300)}`;
          if (r.status === 404 || r.status === 400 && raw.includes("model")) break; // Modèle non disponible, passer au modèle suivant
          if (r.status === 400 || r.status === 422) continue; // Schéma ou paramètre refusé → variante suivante
          throw Object.assign(new Error(r.status === 429 ? "Service IA saturé, réessayez dans un instant." : lastErr), { status: r.status });
        }
        const data = JSON.parse(raw);
        const c = data?.choices?.[0]?.message?.content;
        const text = typeof c === "string" ? c : Array.isArray(c) ? c.map((p: any) => p?.text ?? "").join("") : "";
        if (text.trim()) return text;
        lastErr = `Réponse vide (finish_reason=${data?.choices?.[0]?.finish_reason ?? "?"})`;
      } finally { clearTimeout(t); }
    }
  }
  throw new Error(lastErr);
}

function parseDoc(text: string): SummaryDoc {
  const clean = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = clean.indexOf("{"), end = clean.lastIndexOf("}");
  return JSON.parse(clean.slice(start, end + 1));
}

// ───────────── HANDLER ─────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const t0 = Date.now();
  let userId: string | null = null;
  try {
    const user = await getUserPlanInfo(req).catch(() => null);
    const body = await req.json().catch(() => ({}));

    // Protection des cours privés en base : authentification obligatoire si courseId fourni
    if (body.courseId && !user) {
      return json({ error: "Authentification requise pour charger un cours enregistré." }, 401);
    }
    userId = user?.userId ?? "guest_student";

    const mode = MODE_ALIAS[String(body.mode ?? body.type ?? "objectives")] ?? "objectives";
    const ratio = DENSITY[String(body.density ?? "balanced")] ?? 0.35;

    if (ENFORCE_PLAN && user && !user.isAdmin && mode !== "flash" && user.plan === "gratuit")
      return json({ error: "Accès refusé", message: "Ce type de fiche est réservé aux abonnés Premium.", upgradeRequired: true }, 403);

    // 1) Charger le cours (par id : propriétaire vérifié) ─ ou texte brut en secours
    let text = typeof body.content === "string"
      ? body.content
      : typeof body.courseContent === "string"
      ? body.courseContent
      : typeof body.text === "string"
      ? body.text
      : "";
    let title = String(body.title ?? body.courseTitle ?? "");
    let pdfDataUrl: string | null = null;
    if (body.courseId) {
      const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: c } = await svc.from("courses").select("id,user_id,title,content,file_path").eq("id", body.courseId).maybeSingle();
      if (!c || (c.user_id !== user.userId && !user.isAdmin)) return json({ error: "Cours introuvable" }, 404);
      text = c.content ?? ""; title = title || c.title;
      if (c.file_path && /\.pdf$/i.test(c.file_path)) {
        const { data: blob } = await svc.storage.from(BUCKET).download(c.file_path);
        if (blob && blob.size < 18 * 1024 * 1024) pdfDataUrl = `data:application/pdf;base64,${encodeBase64(new Uint8Array(await blob.arrayBuffer()))}`;
      }
    }
    text = cleanSourceText(text);
    if (text.length < 40 && !pdfDataUrl) return json({ error: "Contenu du cours insuffisant (minimum 40 caractères)." }, 400);

    const src = sourceStats(text);
    if (src.poor && !pdfDataUrl)
      return json({ error: "SOURCE_PAUVRE", message: `Ce cours ne contient presque pas de texte lisible (${src.words} mots pour ${src.slides} diapositive(s), ${src.emptySlides} sans texte). Il est probablement fait d'images : ré-importe le PDF d'origine pour que l'IA puisse le lire.`, stats: src }, 422);

    // 2) Configuration du Moteur Haute Précision V3 (Doctrines & Anti-troncature)
    const words = wc(text);

    // =========================================================================
    // MODE SPÉCIAL SAINT GRAAL : SYNTHÈSE UNIFIÉE EN 4 PARTIES (PARALLÉLISÉE SANS COUPURE)
    // =========================================================================
    const isArgonAudit =
      body.type === "objectives_audit" ||
      body.doctrine === "drive_objective_strategy" ||
      (Array.isArray(body.examFiles) && body.examFiles.length > 0);

    if (isArgonAudit) {
      console.log(`[Argon Saint Graal] Generating unified 4-part summary for "${title}" with ${body.examFiles?.length || 0} exam files`);

      const extractRelevantExamContent = (fullExamText: string, courseTitleStr: string): string => {
        if (!fullExamText) return "";
        if (fullExamText.length <= 26000) return fullExamText;
        const keywords = [
          ...courseTitleStr.toLowerCase().split(/\s+/),
          "hématologie", "hematologie", "hémogramme", "hemogramme", "aplasie", "médullaire",
          "medullaire", "hémophilie", "hemophilie", "willebrand", "plaquettes", "thrombopénie",
          "thrombopenie", "anémie", "anemie", "pancytopénie", "pancytopenie", "myélogramme",
          "médullogramme", "biopsie", "bom", "lymphome", "leucémie", "leucemie", "myélome",
          "groupage", "censure", "jumelage", "cas clinique"
        ].filter((w) => w.length >= 3);

        const chunks = fullExamText.split(/(?=--- Page |Cas [Cc]linique|UNIVERSITE|EPREUVES|Module)/g);
        if (chunks.length <= 1) {
          return fullExamText.slice(0, 13000) + "\n...\n" + fullExamText.slice(-15000);
        }
        const scored = chunks.map((chunk, idx) => {
          const lower = chunk.toLowerCase();
          let score = 0;
          for (const kw of keywords) {
            if (lower.includes(kw)) score += 2;
          }
          return { chunk, idx, score };
        });
        scored.sort((a, b) => b.score - a.score);
        const selected = scored.slice(0, 18).sort((a, b) => a.idx - b.idx);
        return selected.map((s) => s.chunk).join("\n").slice(0, 26000);
      };

      const cleanAndDeduplicateOutput = (rawOut: string): string => {
        if (!rawOut) return "";
        const lines = rawOut.split("\n");
        const seenMainHeaders = new Set<string>();
        const result: string[] = [];
        let skipDuplicateBlock = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();
          const mainMatch = trimmed.match(/^===\s*(.+?)\s*===$/);
          if (mainMatch) {
            const normalizedHeader = mainMatch[1].toUpperCase().replace(/\s+/g, " ").trim();
            if (seenMainHeaders.has(normalizedHeader)) {
              skipDuplicateBlock = true;
              continue;
            } else {
              seenMainHeaders.add(normalizedHeader);
              skipDuplicateBlock = false;
            }
          }
          if (!skipDuplicateBlock) {
            result.push(line);
          }
        }
        return result.join("\n").trim();
      };

      const examFiles = Array.isArray(body.examFiles)
        ? body.examFiles.filter((ef: any) => ef && (ef.content || ef.text) && String(ef.content || ef.text).trim().length > 20)
        : [];

      const uploadedNamesList =
        examFiles.length > 0
          ? examFiles.map((f: any) => f.fileName || f.name || "Examen").join(", ")
          : "Annales universitaires de référence (UCAD)";

      let examAuditDossier = "";
      if (examFiles.length > 0) {
        const compiledExams = examFiles
          .map((ef: any, idx: number) => {
            const fname = ef.fileName || ef.name || `Examen ${idx + 1}`;
            const relevantText = extractRelevantExamContent(String(ef.content || ef.text || ""), title || "");
            return `=== FICHIER D'EXAMEN N°${idx + 1} : "${fname}" ===\n${relevantText}`;
          })
          .join("\n\n====================\n\n");

        const stage1SystemPrompt = `Tu es un Professeur Agrégé de Médecine à l'UCAD et Auditeur Docimologique.
Analyse le COURS et les ${examFiles.length} FICHIERS D'EXAMENS fournis.
Attention : certains PDF contiennent deux matières (ex: Maladies Systémiques pages 1-15 et Hématologie pages 16-23). Fouille chaque fichier jusqu'à la dernière page.

Extrais un DOSSIER FACTUEL contenant :
1. Les OBJECTIFS officiels exacts du cours et toutes ses sous-parties.
2. Le BILAN TRANSPARENT DES APPARITIONS dans les ${examFiles.length} fichiers d'examens :
   - Indique honnêtement combien de fois la leçon est tombée en Cas Clinique principal ET combien de fois elle est apparue comme LEURRE / DISTRACTEUR ou diagnostic différentiel dans les QCM des autres cas cliniques.
   - Pour chaque apparition trouvée, note la RÉFÉRENCE EXACTE : [Nom du fichier / Année de session + N° du Cas Clinique + N° exact du QCM + Texte de la proposition concernée + Valeurs biologiques de l'énoncé].
3. Pour chaque sous-partie / objectif du cours : sa fréquence d'apparition passée et sa probabilité de sortie future (Critique / Très Élevée / Élevée / Modérée) avec le format attendu (Cas clinique, Groupage 1+2+3, Censure, Jumelage).`;

        const stage1UserPrompt = `TITRE DU COURS : ${title || "Cours médical"}

EXTRAIT DU COURS (OBJECTIFS ET PLAN) :
${text.substring(0, 14000)}

LISTE DES ${examFiles.length} FICHIERS D'EXAMENS UPLOADÉS :
${examFiles.map((f: any, i: number) => `${i + 1}. ${f.fileName || f.name}`).join("\n")}

CONTENU DES EXAMENS :
${compiledExams}`;

        examAuditDossier = await callModel(
          stage1SystemPrompt,
          stage1UserPrompt,
          null,
          false,
          0.1
        );
      } else {
        examAuditDossier = "Aucun fichier d'annale joint : analyse l'incidence et la probabilité de sortie de chaque sous-partie selon les standards docimologiques de la FMPO-UCAD.";
      }

      const commonFormattingRules = `
RÈGLES TYPOGRAPHIQUES STRICTES (POUR LE MOTEUR PDF SAINT GRAAL) :
1. JAMAIS de hashtag (#) pour les titres :
   - Utilise === TITRE === sur une ligne seule pour les grandes parties et les Objectifs.
   - Utilise -- Sous-titre -- sur une ligne seule pour les sous-sections.
2. MISE EN GRAS INLINE OBLIGATOIRE :
   - Entoure systématiquement les termes clés, seuils chiffrés, noms de gènes, médicaments et conclusions par **deux astérisques** (ex: **< 200/mm3**, **BOM indispensable**, **gène PIG-A**, **Allogreffe de CSH**).
3. TABLEAUX MARKDOWN COMPLETS :
   - Utilise la syntaxe | Colonne 1 | Colonne 2 | Colonne 3 | Colonne 4 | avec une ligne d'en-tête et la ligne de séparation | :--- | :--- | :--- | :--- |.
   - Ne laisse JAMAIS un tableau inachevé ou vide.
4. ENCADRÉS DE HAUT RENDEMENT, RAPPELS ET AVERTISSEMENTS :
   - Utilise [ RENDEMENT EXAMEN : ... ] ou [ RÈGLE D'OR : ... ] (s'affichera en boîte émeraude).
   - Utilise [ RAPPEL CLINIQUE : ... ] (s'affichera en boîte rose bordeaux).
   - Utilise [ AVERTISSEMENT / PIÈGE N°X : ... ] (s'affichera en boîte ambre/or).
5. PUCES ET INDENTATIONS :
   - Utilise • pour les points principaux.
   - Utilise - en début de ligne pour les sous-points indentés.
   - Utilise ✓ en début de ligne pour les parades et règles validées.
   - Utilise → en début de ligne pour les étapes chronologiques de la démarche clinique.`;

      const blocASystemPrompt = `Tu es un Professeur Agrégé de Médecine de l'UCAD.
Tu rédiges la première moitié (PARTIE 1 et PARTIE 2) de la SYNTHÈSE UNIFIÉE (Protocole Argon Saint Graal).
${commonFormattingRules}

STRUCTURE EXACTE ET OBLIGATOIRE À PRODUIRE DANS CET APPEL :

=== PARTIE 1 : BILAN D'INCIDENCE DANS LES ANNALES & PROBABILITÉ DE SORTIE PAR SOUS-PARTIE ===

-- 1.1. Bilan transparent des apparitions dans les annales de l'université (${uploadedNamesList}) --
• Explique avec une transparence totale combien de fois ce cours est tombé comme **Cas Clinique principal** et combien de fois il a été utilisé comme **Leurre / Distracteur différentiel** dans les QCM des annales analysées, et ce que cela implique sur le risque de sortie à la prochaine session.
• Produis le tableau complet des apparitions réelles dans les annales :
| Session & Référence Exacte | Rôle dans l'Épreuve (Sujet ou Leurre) | Énoncé & Données Biologiques de l'Examen | Pourquoi la leçon est confirmée ou éliminée |

-- 1.2. Matrice d'incidence passée et probabilité de sortie future pour chaque sous-partie du cours --
• Produis un tableau analytique complet évaluant CHAQUE sous-partie / objectif du cours :
| Sous-partie / Objectif du cours | Incidence passée dans les annales (avec réf.) | Probabilité de sortie future & Format attendu | Ce qu'il faut cibler et retenir en priorité |

=== PARTIE 2 : RÉSUMÉ EXHAUSTIF DU COURS PAR OBJECTIFS (AVEC CIBLAGE DES PARTIES À HAUT RENDEMENT) ===

Traite maintenant INTÉGRALEMENT et SANS AUCUN RACCOURCI tous les objectifs officiels du cours (de l'Objectif 1 au dernier objectif) ainsi que les compléments indispensables :

Pour chaque Objectif (=== OBJECTIF 1 : ... ===, === OBJECTIF 2 : ... ===, etc.) :
[ RENDEMENT EXAMEN : Probabilité (Critique / Très Élevée / Élevée) — Format cible (Cas clinique / Groupage / Censure) — Points chauds à maîtriser ]
-- Sous-sections détaillées du cours --
• Développe 100% des définitions, mécanismes, seuils chiffrés en **gras**, particularités cliniques/cytologiques/histologiques, notes "NB" et tableaux comparatifs Markdown (| ... |).
[ RÈGLE D'OR : Synthèse incontournable de l'objectif ]`;

      const blocAUserPrompt = `TITRE DU COURS : ${title || "Cours médical"}
FICHIERS D'EXAMENS ANALYSÉS (${examFiles.length}) : ${uploadedNamesList}

=== DOSSIER D'AUDIT DOCIMOLOGIQUE DES ANNALES ===
${examAuditDossier}

=== CONTENU INTÉGRAL DU COURS ===
${text.substring(0, 38000)}

Rédige maintenant l'intégralité de la PARTIE 1 et de la PARTIE 2 (tous les objectifs jusqu'au traitement complet) sans aucune coupure.`;

      const blocBSystemPrompt = `Tu es un Professeur Agrégé de Médecine de l'UCAD.
Tu rédiges la seconde moitié (PARTIE 3 et PARTIE 4) de la SYNTHÈSE UNIFIÉE (Protocole Argon Saint Graal) sans aucune répétition avec le résumé du cours.
${commonFormattingRules}

INTERDICTION FORMELLE : Ne génère pas de QCM à choix multiples artificiels. Produis uniquement les outils tactiques, les pièges, la table de discrimination, le décodeur Groupage/Jumelage et la démarche opérationnelle devant un cas clinique.

STRUCTURE EXACTE ET OBLIGATOIRE À PRODUIRE DANS CET APPEL :

=== PARTIE 3 : LES PIÈGES DES PROFESSEURS, LA TABLE DE DISCRIMINATION & LES QUESTIONS PRÉ-RÉSOLUES ===

-- 3.1. Table de discrimination inter-cours (Comment départager cette leçon des pathologies proches dans les annales) --
• Produis un tableau comparatif opposant la pathologie du cours aux 4 ou 5 pathologies concurrentes qui tombent dans les annales de l'UCAD :
| Pathologie concurrente dans les annales | Référence Examen UCAD | Points communs trompeurs (Le piège) | Le Critère Tranchant qui confirme ou élimine la leçon |

-- 3.2. Décorticage des 6 à 7 pièges internes du cours et des évaluations --
Pour chaque piège majeur (notes NB du cours, exceptions biologiques, paradoxes des tableaux, contre-indications thérapeutiques), utilise strictement ce format :
[ AVERTISSEMENT / PIÈGE N°X : Titre précis du piège (Réf. Diapo du cours ou Examen UCAD) ]
• **Le problème qui fait échouer l'étudiant :** explication précise de l'erreur de raisonnement.
• **Le mécanisme du piège du professeur :** comment le distracteur est construit.
✓ **La parade absolue à retenir :** la règle chiffrée ou clinique infaillible pour déjouer le piège.

-- 3.3. Décodeur spécial Groupage (1+2+3) & Jumelage (PARCE QUE) de l'UCAD --
• Liste les 5 combinaisons de **Groupage (A = 1+2+3)** ou **B = 1+3** / **C = 2+4** les plus susceptibles de tomber sur ce cours.
• Produis le tableau des 4 questions de **Jumelage (PARCE QUE)** pré-résolues sur les mécanismes clés du cours :
| Proposition 1 | Lien | Proposition 2 | Code à cocher (A, B, C, D, E) & Justification exacte |

=== PARTIE 4 : DÉMARCHE OPÉRATIONNELLE DEVANT UN CAS CLINIQUE À L'EXAMEN & CHECK-LIST ULTIME ===

-- 4.1. Marche à suivre étape par étape lorsque la leçon tombe en Cas Clinique (La Cascade des 5 Temps) --
Décris exactement comment l'étudiant doit traiter un cas clinique sur cette leçon de la Question 1 à la Question 5 :
→ **Temps 1 (Reconnaissance syndromique et lecture de l'énoncé) :** quoi repérer dans l'observation clinique et quels pièges d'emblée écarter.
→ **Temps 2 (Interprétation de l'hémogramme et du frottis) :** comment qualifier les lignées et quelles constantes vérifier.
→ **Temps 3 (Examens de confirmation cytologique / histologique / spécifique) :** quel examen de 1re intention vs examen de certitude cocher et quels critères décrire.
→ **Temps 4 (Classification pronostique et recherche étiologique) :** quel score/stade calculer et quel bilan étiologique/clonal prescrire selon l'âge.
→ **Temps 5 (Décision thérapeutique d'urgence et de fond) :** quelles mesures symptomatiques urgentes, quelles contre-indications / précautions transfusionnelles et quel traitement curatif choisir selon l'arbre décisionnel.

-- 4.2. Traducteur instantané d'énoncés (Réflexe mental immédiat en salle d'examen) --
• Produis le tableau de traduction rapide :
| Si l'énoncé de l'examen mentionne... | Traduction immédiate dans votre tête | Action immédiate sur la grille QCM |

-- 4.3. Check-list ultime "5 minutes avant d'entrer en salle" (Tous les chiffres, seuils, gènes et posologies) --
• Produis le tableau récapitulatif de toutes les valeurs numériques et marqueurs du cours :
| Paramètre / Repère du cours | Valeur chiffrée / Gène / Formule exacte | Signification diagnostique, pronostique ou thérapeutique |`;

      const blocBUserPrompt = `TITRE DU COURS : ${title || "Cours médical"}
FICHIERS D'EXAMENS ANALYSÉS (${examFiles.length}) : ${uploadedNamesList}

=== DOSSIER D'AUDIT DOCIMOLOGIQUE DES ANNALES ===
${examAuditDossier}

=== CONTENU INTÉGRAL DU COURS ===
${text.substring(0, 32000)}

Rédige maintenant l'intégralité de la PARTIE 3 et de la PARTIE 4 jusqu'au tableau final 4.3 sans aucune coupure.`;

      const [blocAText, blocBText] = await Promise.all([
        callModel(blocASystemPrompt, blocAUserPrompt, pdfDataUrl, false, 0.15),
        callModel(blocBSystemPrompt, blocBUserPrompt, null, false, 0.15),
      ]);

      const rawMarkdown = cleanAndDeduplicateOutput(
        `${blocAText.trim()}\n\n${blocBText.trim()}`
      );

      await logDiagnostic({
        function_name: "generate-summary",
        user_id: userId,
        status: 200,
        duration_ms: Date.now() - t0,
        request_payload: { mode: "objectives_audit", words, pdf: !!pdfDataUrl, model: MODEL, examFilesCount: examFiles.length },
        response_payload: { ok: true, markdownLength: rawMarkdown.length },
      });

      return json({
        summary: rawMarkdown,
        auditedExamsCount: examFiles.length,
        doctrine: "drive_objective_strategy",
        source: src,
        model: MODEL,
        ms: Date.now() - t0,
      });
    }

    let extractedObjs: string[] = Array.isArray(body.objectives) && body.objectives.length > 0
      ? body.objectives
      : extractObjectivesFromCourseText(text);

    if (extractedObjs.length === 0) {
      extractedObjs = [
        "Définir la pathologie et ses seuils",
        "Décrire les mécanismes physiopathologiques et la clinique",
        "Interpréter les examens complémentaires paracliniques",
        "Mener la démarche du diagnostic étiologique",
        "Énoncer les principes de prise en charge et thérapeutique",
      ];
    }

    const v3Config: SynthesisConfig = {
      ...DEFAULT_SYNTHESIS_CONFIG,
      ...(body.synthesisConfig || {}),
      ...(body.doctrine ? { doctrine: body.doctrine } : {}),
      ...(body.densityMode ? { densityMode: body.densityMode } : {}),
      ...(body.targetWordCount !== undefined ? { targetWordCount: Number(body.targetWordCount) } : {}),
      ...(Array.isArray(extractedObjs) && extractedObjs.length > 0 ? { objectives: extractedObjs } : {}),
      ...(typeof body.verbatimProfessorSyntax === "boolean" ? { verbatimProfessorSyntax: body.verbatimProfessorSyntax } : {}),
      ...(typeof body.autoRichFormatting === "boolean" ? { autoRichFormatting: body.autoRichFormatting } : {}),
      ...(typeof body.preserveCourseTables === "boolean" ? { preserveCourseTables: body.preserveCourseTables } : {}),
      ...(typeof body.useLogicalConnectors === "boolean" ? { useLogicalConnectors: body.useLogicalConnectors } : {}),
      ...(typeof body.strictObjectivesFilter === "boolean" ? { strictObjectivesFilter: body.strictObjectivesFilter } : {}),
      ...(typeof body.includeClinicalPearls === "boolean" ? { includeClinicalPearls: body.includeClinicalPearls } : {}),
      ...(typeof body.customInstructions === "string" ? { customInstructions: body.customInstructions } : {}),
    };

    // MOTEUR HAUTE PRÉCISION V3 ACTIF :
    // Écrase 100% des anciennes règles pour éviter toute collision et applique la loi d'exhaustivité
    if (body.synthesisConfig || body.doctrine || (mode === "objectives" && body.useLegacyEngine !== true)) {
      const v3Prompt = buildEliteSynthesisPrompt(
        text.slice(0, 120_000),
        extractedObjs,
        v3Config
      );

      const rawMarkdown = await callModel(
        v3Prompt.systemInstruction,
        v3Prompt.userPrompt,
        pdfDataUrl,
        false, // asJson = false (génération Markdown haute fidélité)
        v3Prompt.apiGenerationConfig.temperature ?? 0.15
      );

      await logDiagnostic({
        function_name: "generate-summary",
        user_id: userId,
        status: 200,
        duration_ms: Date.now() - t0,
        request_payload: { mode, v3Config, words, pdf: !!pdfDataUrl, model: MODEL },
        response_payload: { ok: true, quotasApplied: v3Prompt.quotas, markdownLength: rawMarkdown.length },
      });

      return json({
        summary: rawMarkdown,
        quotasApplied: v3Prompt.quotas,
        configUsed: v3Config,
        doctrine: v3Config.doctrine,
        objectives: extractedObjs,
        source: src,
        model: MODEL,
        ms: Date.now() - t0,
      });
    }

    const finalParams: SummaryParameters = {
      ...DEFAULT_SUMMARY_PARAMS,
      ...(body.summaryParameters || body.userParams || {}),
      ...(body.targetWordCount ? { targetWordCount: Number(body.targetWordCount) } : {}),
      ...(body.compressionStyle ? { compressionStyle: body.compressionStyle } : {}),
      ...(body.lexicalFidelity ? { lexicalFidelity: body.lexicalFidelity } : {}),
      ...(typeof body.strictObjectivesFilter === "boolean" ? { strictObjectivesFilter: body.strictObjectivesFilter } : {}),
      ...(typeof body.useTelegraphicSymbols === "boolean" ? { useTelegraphicSymbols: body.useTelegraphicSymbols } : {}),
      ...(typeof body.surgicalBoldAnchors === "boolean" ? { surgicalBoldAnchors: body.surgicalBoldAnchors } : {}),
      ...(typeof body.displayQuotasInHeaders === "boolean" ? { displayQuotasInHeaders: body.displayQuotasInHeaders } : {}),
    };

    const quotas = calculateObjectiveQuotas(extractedObjs, finalParams.targetWordCount);

    // MODE HARVARD / FLASH (OU SCHÉMA JSON V2) — SANS AUCUNE RESTRICTION DE BUDGET
    const system = DOCTRINE + "\n\n" + MODE_RULES[mode];
    const baseUser = `Titre du cours : ${title || "Cours"}\nMode : ${mode}\nNombre de mots du cours : ${words}\n\n=== TEXTE DU COURS (peut omettre images, tableaux et flèches : lis le PDF joint) ===\n${text.slice(0, 120_000)}`;

    let best: { doc: SummaryDoc; gate: ReturnType<typeof validateSummary> } | null = null;
    let feedback = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await callModel(system, baseUser + feedback, pdfDataUrl, true, 0.1);
        const doc = parseDoc(raw);
        doc.mode = mode; doc.schema_version = 2; doc.title = doc.title || title;
        const gate = validateSummary(doc, text, ratio * 1.15);
        if (!best || gate.errors.length < best.gate.errors.length) best = { doc, gate };
        if (gate.ok) break;
        feedback = `\n\n=== CORRECTIONS OBLIGATOIRES (ta réponse précédente a été rejetée) ===\n${gate.errors.map((e) => "- " + e).join("\n")}\nRefais la fiche complète en corrigeant tous ces points.`;
      } catch (e) {
        if (attempt === 2 && !best) throw e;
        feedback = `\n\n=== CORRECTION === Ta réponse précédente n'était pas un JSON valide conforme au schéma. Réponds uniquement par le JSON.`;
      }
    }
    if (!best) throw new Error("L'IA n'a produit aucune fiche exploitable.");

    await logDiagnostic({ function_name: "generate-summary", user_id: userId, status: 200, duration_ms: Date.now() - t0,
      request_payload: { mode, ratio, words, pdf: !!pdfDataUrl, model: MODEL }, response_payload: { ok: best.gate.ok, metrics: best.gate.metrics, errors: best.gate.errors } });

    return json({ summary: best.doc, quality: best.gate, quotasApplied: quotas, configUsed: finalParams, source: src, model: MODEL, ms: Date.now() - t0 });
  } catch (e) {
    const status = (e as any)?.status && (e as any).status >= 400 ? (e as any).status : 500;
    console.error("generate-summary:", e);
    await logDiagnostic({ function_name: "generate-summary", user_id: userId, status, error: String((e as Error)?.message ?? e), duration_ms: Date.now() - t0 });
    return json({ error: (e as Error)?.message ?? "Erreur lors de la génération" }, status);
  }
});
