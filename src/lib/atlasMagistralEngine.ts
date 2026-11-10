import { callGeminiAcademicEngine } from "@/lib/syncEngine";
/**
 * ============================================================================
 * src/lib/atlasMagistralEngine.ts
 * MOTEUR OFFICIEL DU « MODE ATLAS MAGISTRAL » (CALIBRÉ POUR CLAUDE SONNET 4.6)
 * ============================================================================
 * NE RIEN MODIFIER DANS LE PROMPT SYSTÈME NI DANS LES CLASSES HTML CI-DESSOUS.
 */

export interface AtlasSlideBlock {
  /** Référence exacte des diapositives couvertes (ex: "Diapos 4 – 6", "Diapo 16") */
  slideBadge: string;
  /** Titre déclaratif précis résumant le bloc de diapositives */
  heading: string;
  /** Contenu HTML utilisant exclusivement les classes du système Atlas Magistral */
  body: string;
}

export interface AtlasChapter {
  /** Identifiant unique du chapitre (ex: "chap_1", "chap_2") */
  id: string;
  /** Chiffre romain du chapitre ("I", "II", "III", "IV", "V", "VI") */
  num: string;
  /** Titre complet du chapitre */
  title: string;
  /** Plage des diapositives du chapitre (ex: "Diapositives 1 à 7") */
  slides: string;
  /** Liste ordonnée des blocs de diapositives */
  blocks: AtlasSlideBlock[];
}

export interface AtlasMagistralSummary {
  id: string;
  title: string;
  author: string;
  tag: string;
  updatedAt: string;
  chapters: AtlasChapter[];
}

/**
 * PROMPT SYSTÈME VERROUILLÉ POUR CLAUDE SONNET 4.6 (T° = 0.1)
 * Garantit que Claude Sonnet 4.6 produit exactement la même structure HTML,
 * les mêmes tableaux .course-table, les mêmes grilles et la même densité médicale.
 */
export const ATLAS_MAGISTRAL_SONNET_4_6_SYSTEM_PROMPT = `
Tu es le moteur « MODE ATLAS MAGISTRAL » de DawJang, opéré par Claude Sonnet 4.6.
Ta mission est de transformer l'intégralité d'un cours médical magistral (toutes ses diapositives ou pages, de la première à la dernière, sans jamais résumer par omission) en un objet JSON strictement conforme à l'interface TypeScript \`AtlasMagistralSummary\`.

================================================================================
LOIS ABSOLUES D'EXÉCUTION (INTERDICTION FORMELLE D'Y DÉROGER)
================================================================================

1. COUVERTURE INTÉGRALE DE LA LEÇON (DIAPO 1 À DIAPO N) :
   - Découpe l'ensemble du cours en 5 à 7 grands chapitres numérotés en chiffres romains (\`num: "I"\`, \`"II"\`, \`"III"\`, \`"IV"\`, \`"V"\`, \`"VI"\`).
   - Chaque chapitre indique la plage exacte de diapositives dans \`slides\` (ex: \`"Diapositives 1 à 7"\`).
   - Chaque chapitre est subdivisé en sous-blocs (\`blocks\`) portant un \`slideBadge\` précis (ex: \`"Diapos 1 – 3"\`, \`"Diapos 4 – 6"\`, \`"Diapo 16"\`) et un titre \`heading\`.

2. PRÉCISION CHIRURGICALE DES CHIFFRES, FORMULES, SEUILS ET POSOLOGIES :
   - Conserve 100 % des valeurs numériques, pourcentages, formules biologiques, seuils diagnostiques, durées et posologies en mg/kg/j ou UI/kg/j.
   - Entoure systématiquement les chiffres clés, formules et seuils avec :
     \`<span class="font-mono-metric font-semibold text-primary">...</span>\`
   - Entoure les contre-indications absolues, seuils d'arrêt ou urgences vitales avec :
     \`<strong class="text-rose-600 dark:text-rose-400">...</strong>\`

3. GRAMMAIRE VISUELLE OBLIGATOIRE DANS LE CHAMP \`body\` (HTML PUR) :
   Tu dois utiliser EXCLUSIVEMENT les 4 patrons HTML suivants selon la nature des informations de la diapositive :

   - PATRON A — TABLEAU MÉDICAL (\`table.course-table\`) pour tout bilan biologique, seuils, classification, diagnostic différentiel, formes cliniques ou protocole thérapeutique :
     \`\`\`html
     <div class="overflow-hidden rounded-xl border border-border mb-3">
       <table class="course-table">
         <thead>
           <tr>
             <th>Paramètre / Entité</th>
             <th>Valeurs &amp; Mécanismes</th>
             <th>Interprétation clinique</th>
           </tr>
         </thead>
         <tbody>
           <tr>
             <td><strong>Nom de l'entité</strong></td>
             <td class="font-mono-metric font-semibold text-primary">Valeur chiffrée exacte</td>
             <td>Détail précis du cours</td>
           </tr>
         </tbody>
       </table>
     </div>
     \`\`\`

   - PATRON B — GRILLE COMPARATIVE CÔTÉ À CÔTÉ (\`md:grid-cols-2\` ou \`md:grid-cols-3\`) pour comparer 2 ou 3 mécanismes, objectifs/plan ou triades sémiologiques :
     \`\`\`html
     <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
       <div class="p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1.5">
         <div class="font-semibold text-foreground">Titre du volet 1</div>
         <p class="text-foreground/90 leading-relaxed">• Point 1<br/>• Point 2</p>
       </div>
       <div class="p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1.5">
         <div class="font-semibold text-foreground">Titre du volet 2</div>
         <p class="text-foreground/90 leading-relaxed">• Point 1<br/>• Point 2</p>
       </div>
     </div>
     \`\`\`

   - PATRON C — CHAÎNE DE MATURATION OU CASCADE PHYSIOPATHOLOGIQUE :
     \`\`\`html
     <div class="flex flex-wrap items-center gap-1.5 text-xs font-medium mb-3">
       <span class="px-2.5 py-1 rounded-lg bg-secondary border border-border">1. Étape initiale</span>
       <span class="text-muted-foreground">&rarr;</span>
       <span class="px-2.5 py-1 rounded-lg bg-primary/12 text-primary border border-primary/30 font-semibold">2. Étape clé</span>
     </div>
     \`\`\`

   - PATRON D — ENCADRÉ DE VIGILANCE / RÈGLE D'OR / PÉDIATRIE :
     \`\`\`html
     <div class="p-3.5 rounded-xl bg-primary/8 border border-primary/25 text-xs space-y-1">
       <div class="font-semibold text-foreground">Titre de la règle d'or</div>
       <p class="text-foreground/90 leading-relaxed">• Détail 1<br/>• Détail 2</p>
     </div>
     \`\`\`

4. FORMAT DE SORTIE :
   - Réponds UNIQUEMENT avec l'objet JSON valide (sans texte avant ni après, sans balise markdown \`\`\`json) respectant exactement la structure :
     {
       "id": "...",
       "title": "...",
       "author": "...",
       "tag": "Cours Magistral Intégral • X diapositives",
       "updatedAt": "JJ/MM/AAAA",
       "chapters": [ ... ]
     }
`.trim();

/**
 * Appelle Claude Sonnet 4.6 (via OpenRouter ou le moteur académique DawJang)
 * pour transformer un cours magistral brut en `AtlasMagistralSummary`.
 */
export async function generateAtlasMagistralSummary(params: {
  rawCourseText: string;
  courseTitle: string;
  courseAuthor?: string;
  slideCount?: number;
  apiKey?: string;
  model?: string;
}): Promise<AtlasMagistralSummary> {
  const {
    rawCourseText,
    courseTitle,
    courseAuthor = "Faculté de Médecine",
    slideCount,
    model = "anthropic/claude-sonnet-4.6",
  } = params;

  const apiKey =
    params.apiKey ||
    (typeof window !== "undefined" &&
      (localStorage.getItem("dawjang_openrouter_api_key") ||
        localStorage.getItem("dawjang_claude_api_key") ||
        localStorage.getItem("dawjang_anthropic_api_key") ||
        localStorage.getItem("dawjang_gemini_api_key"))) ||
    (import.meta as any).env?.VITE_OPENROUTER_API_KEY ||
    (import.meta as any).env?.VITE_ANTHROPIC_API_KEY ||
    "";

  const userPrompt = [
    `TITRE DU COURS MAGISTRAL : ${courseTitle}`,
    `AUTEUR / SERVICE : ${courseAuthor}`,
    slideCount ? `NOMBRE TOTAL DE DIAPOSITIVES : ${slideCount}` : "",
    "",
    "CONTENU INTÉGRAL DU COURS À TRANSFORMER EN MODE ATLAS MAGISTRAL :",
    rawCourseText,
  ]
    .filter(Boolean)
    .join("\n");

  let rawContent = "";

  // 1. Clé Anthropic Directe (sk-ant-...)
  if (apiKey.startsWith("sk-ant-")) {
    const modelsToTry = [
      "claude-3-7-sonnet-20250219",
      "claude-sonnet-4-6",
      "claude-3-5-sonnet-20241022",
    ];
    for (const m of modelsToTry) {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: m,
            temperature: 0.1,
            max_tokens: 16000,
            system: ATLAS_MAGISTRAL_SONNET_4_6_SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const text = data?.content?.[0]?.text;
          if (typeof text === "string" && text.trim().length > 0) {
            rawContent = text;
            break;
          }
        }
      } catch {
        // Essai du modèle suivant
      }
    }
  }

  // 2. Clé OpenRouter (sk-or-... ou autre)
  if (!rawContent && apiKey) {
    const modelsToTry = [
      model,
      "anthropic/claude-sonnet-4.6",
      "anthropic/claude-3.7-sonnet",
      "anthropic/claude-3.5-sonnet",
    ];
    for (const m of modelsToTry) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://dawjang.app",
            "X-Title": "DawJang Studio Academique - Mode Atlas Magistral",
          },
          body: JSON.stringify({
            model: m,
            temperature: 0.1,
            max_tokens: 16000,
            messages: [
              { role: "system", content: ATLAS_MAGISTRAL_SONNET_4_6_SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data?.choices?.[0]?.message?.content;
          if (typeof text === "string" && text.trim().length > 0) {
            rawContent = text;
            break;
          }
        }
      } catch {
        // Essai suivant
      }
    }
  }

  // 3. Repli résilient sur Gemini 2.5 Flash si Claude / OpenRouter n'est pas configuré ou a échoué
  if (!rawContent) {
    try {
      const geminiResult = await callGeminiAcademicEngine(
        ATLAS_MAGISTRAL_SONNET_4_6_SYSTEM_PROMPT,
        userPrompt,
        0.1
      );
      if (typeof geminiResult === "string" && geminiResult.trim().length > 0) {
        rawContent = geminiResult;
      }
    } catch {
      // ignore
    }
  }

  if (!rawContent) {
    throw new Error(
      "Aucune réponse reçue pour générer le Mode Atlas Magistral. Veuillez vérifier votre clé API (OpenRouter, Anthropic ou Gemini)."
    );
  }

  const cleanedJson = rawContent
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleanedJson) as AtlasMagistralSummary;
    return parsed;
  } catch (parseErr) {
    const firstBrace = cleanedJson.indexOf('{');
    const lastBrace = cleanedJson.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const sub = cleanedJson.slice(firstBrace, lastBrace + 1);
      return JSON.parse(sub) as AtlasMagistralSummary;
    }
    throw parseErr;
  }
}

export function compileAtlasSummaryToHtml(course: AtlasMagistralSummary): string {
  const metaHeader = `<!-- @ATLAS_MAGISTRAL_JSON_START ${JSON.stringify(course)} @ATLAS_MAGISTRAL_JSON_END -->`;
  const chaptersHtml = course.chapters
    .map(
      (ch) => `
      <article id="course-${ch.id}" class="craft-surface rounded-2xl p-6 sm:p-7 space-y-5 mb-5">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-border/80">
          <div class="flex items-center gap-3">
            <span class="w-8 h-8 rounded-xl bg-foreground text-background font-mono-metric text-xs font-semibold flex items-center justify-center shrink-0">
              ${ch.num}
            </span>
            <div>
              <h2 class="text-base sm:text-[17px] font-semibold text-foreground">${ch.title}</h2>
              <p class="font-mono-metric text-[11px] text-muted-foreground">${ch.slides} • ${course.author}</p>
            </div>
          </div>
        </div>
        <div class="space-y-5">
          ${ch.blocks
            .map(
              (blk) => `
              <div class="space-y-2.5">
                <div class="flex items-center gap-2">
                  <span class="font-mono-metric text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/25">
                    ${blk.slideBadge}
                  </span>
                  <h3 class="text-xs sm:text-sm font-semibold text-foreground">${blk.heading}</h3>
                </div>
                <div class="pl-0 sm:pl-1">${blk.body}</div>
              </div>
            `
            )
            .join('<div class="border-t border-border/60"></div>')}
        </div>
      </article>
    `
    )
    .join("\n");

  return `${metaHeader}\n${chaptersHtml}`;
}

/**
 * Extrait l'objet `AtlasMagistralSummary` depuis un `htmlContent` sauvegardé.
 */
export function tryParseAtlasMagistralHtml(htmlContent: string): AtlasMagistralSummary | null {
  if (!htmlContent) return null;
  const match = htmlContent.match(
    /<!--\s*@ATLAS_MAGISTRAL_JSON_START\s+([\s\S]*?)\s+@ATLAS_MAGISTRAL_JSON_END\s*-->/
  );
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(match[1]) as AtlasMagistralSummary;
  } catch {
    return null;
  }
}
