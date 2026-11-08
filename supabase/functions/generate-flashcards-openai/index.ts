import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getUserPlanInfo } from "../_shared/plan-utils.ts";
import { extractCompletionText } from "../_shared/ai-utils.ts";
import { callAI, hasAiKey } from "../_shared/llm.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * Prompt système construit d'après les règles de rédaction de SuperMemo
 * (« 20 règles de formulation des connaissances ») et les pratiques d'Anki / RemNote.
 */
function buildSystemPrompt(mode: string, count: number, studyLevel?: string): string {
  const modeRule = mode === "objectives"
    ? `MODE « À PARTIR DES OBJECTIFS » :
Dans le chapeau ou l'introduction du cours, le professeur énonce les objectifs pédagogiques (ex: « 1. Définir l'anémie », « 2. Décrire les signes cliniques... », « 3. Citer les étiologies... », « 4. Énoncer les principes du traitement... »).
Pour chaque objectif :
1. AU RECTO (champ "question") : Tu écris DIRECTEMENT l'objectif du cours formulé avec clarté et précision (ex: « Définir l'anémie selon les critères du cours. », « Décrire les signes cliniques du syndrome anémique. », « Citer les étiologies d'une anémie régénérative. »). Si le cours ne présente pas de chapeau d'objectifs explicite, formule les objectifs pédagogiques correspondant aux grandes sections du cours.
2. AU VERSO (champs "answer" et "details") : Tu analyses le cours et tu extrais LA RÉPONSE EXACTE et complète que le professeur a donnée dans le corps de la leçon pour accomplir cet objectif (la définition du professeur, sa liste clinique, ses étiologies ou ses principes thérapeutiques). La réponse principale ("answer") doit être une phrase complète et autonome ; les éléments structurés complémentaires vont dans "details" (puces complètes, jamais coupées).
Chaque carte correspond à un objectif pédagogique du cours.`
    : `MODE « ALÉATOIRE PAR PERTINENCE » :
Analyse l'intégralité du cours et sélectionne par ordre d'importance les notions médicales indispensables que l'étudiant doit impérativement maîtriser pour l'examen et la pratique clinique (urgences vitales, signes de gravité, critères diagnostiques majeurs +++, seuils biologiques clés, diagnostics étiologiques majeurs, traitements de référence, contre-indications).
1. AU RECTO (champ "question") : Rédige une vraie question médicale claire, précise, complète et autonome (ex: « Quels sont les signes cliniques d'intolérance (signes de gravité) d'une anémie aiguë imposant une transfusion d'urgence ? », « Quels sont les critères biologiques distinguant une carence martiale d'une anémie inflammatoire ? »).
2. AU VERSO (champs "answer" et "details") : Donne la réponse clinique exacte et vérifiable issue du cours.
3. CLASSEMENT : Classe les cartes par ordre de pertinence décroissante (importance 5 pour les notions vitales/indispensables, puis 4, puis 3).`;

  return `Tu es un professeur clinicien et ingénieur pédagogique expert en mémorisation espacée (Anki, SuperMemo, RemNote) qui conçoit des flashcards d'excellence pour des étudiants en santé au Sénégal${studyLevel ? ` (niveau : ${studyLevel})` : ""}.

${modeRule}

RÈGLES DE RÉDACTION STRICTES ET OBLIGATOIRES :
1. Une carte = UNE seule notion (principe d'information minimale). Jamais de question double.
2. La question au recto est toujours autonome, compréhensible hors contexte, et formulée en français médical élégant.
3. INTERDICTIONS FORMELLES :
   - INTERDICTION d'écrire « Point clé #1 », « Point clé #2 », « Point clé #3 », etc.
   - INTERDICTION des formulations mécaniques dénuées de sens du genre « 2. Indications — citez les 2 éléments » ou « Régénérative — citez les 5 éléments ».
   - INTERDICTION d'écrire « X éléments à connaître : » sans phrase explicative complète.
   - INTERDICTION de couper des phrases en plein vol (« privilégier soit une. », « ou d'une. ») : chaque phrase au verso doit être complète et grammaticalement parfaite.
4. Au verso, "answer" donne la réponse directe, claire et précise (sans débordement ni hors-sujet). "details" contient 0 à 4 éléments clés complémentaires issus du cours (chacun rédigé sous forme de puce complète).
5. Varie les formats : "qa" (question clinique ou affirmation médicale ciblée / réponse précise), "definition" (définition académique), "list" (liste courte d'éléments clés ≤ 5 éléments). INTERDICTION ABSOLUE d'utiliser la syntaxe "{{c1::...}}" ou "{{c2::...}}" ou "cloze" : écris toutes les valeurs et unités normalement (ex. 13 g/dL, 12 g/dL, 95 g/dL).
6. Fidélité absolue : n'utilise QUE les informations du cours fourni. Aucune invention.
7. Français académique impeccable, sans markdown dans les valeurs textuelles, sans astérisques, sans accolades ni double deux-points.
8. "importance" de 1 à 5 (5 = vital / indispensable à l'examen).
9. N'écris AUCUNE carte équivalente à une question de la liste « À EXCLURE ».

Produis exactement ${count} cartes. Réponds UNIQUEMENT avec un objet JSON valide :
{"cards":[{"type":"qa|definition|list","question":"...","answer":"...","details":["..."],"importance":5,"objective":"... ou null","source":"..."}]}`;
}

function parseCards(rawOutput: string): any[] {
  let cleaned = (rawOutput || "").trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const firstBrace = cleaned.search(/[\[{]/);
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
  const parsed = JSON.parse(cleaned);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.cards)) return parsed.cards;
  if (Array.isArray(parsed?.flashcards)) return parsed.flashcards;
  return [];
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      courseId,
      content: directContent,
      courseTitle = "",
      mode = "relevance",
      excludeQuestions = [],
      studyLevel,
      persist = false,
    } = body;
    const count = Math.max(1, Math.min(30, Number(body.count) || 10));

    if (!hasAiKey()) return json({ error: "Service indisponible" }, 503);

    // Contenu : envoyé directement par l'application (v7) ou lu en base (compatibilité)
    let courseContent: string = typeof directContent === "string" ? directContent : "";
    let userInfo: any = null;

    if ((!courseContent && courseId) || persist) {
      try {
        userInfo = await getUserPlanInfo(req);
      } catch (e) {
        console.warn("getUserPlanInfo failed:", e);
      }
    }

    if (!courseContent && courseId) {
      if (!userInfo) return json({ error: "Authentification requise" }, 401);
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: courseData } = await supabase.from("courses").select("content").eq("id", courseId).single();
      courseContent = courseData?.content || "";
    }
    if (!courseContent || courseContent.length < 100) {
      return json({ error: "Contenu du cours insuffisant (100 caractères minimum)." }, 400);
    }
    // Gemini 2.5 Flash prend en charge de larges contextes : conserve le chapeau (intro) + corps du cours
    if (courseContent.length > 50000) {
      const headerChunk = courseContent.substring(0, 8000);
      const restChunk = courseContent.substring(8000, 50000);
      courseContent = `${headerChunk}\n\n[... suite du cours ...]\n\n${restChunk}`;
    }

    const exclusions = Array.isArray(excludeQuestions)
      ? excludeQuestions.slice(0, 80).map((q: unknown) => `- ${String(q).slice(0, 140)}`).join("\n")
      : "";

    const userPrompt = `Leçon : ${courseTitle || "Cours"}
${exclusions ? `\nÀ EXCLURE (cartes déjà possédées par l'étudiant) :\n${exclusions}\n` : ""}
Texte du cours :
${courseContent}`;

    // Gemini 2.5 Flash via OpenRouter (couche commune _shared/llm.ts)
    const response = await callAI({
      messages: [
        { role: "system", content: buildSystemPrompt(mode, count, studyLevel) },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8
    });

    if (!response.ok) {
      const errTxt = await response.text();
      console.error('API error:', response.status, errTxt);
      if (response.status === 429) return json({ error: "Limite d'utilisation IA atteinte" });
      if (response.status === 402) return json({ error: "Quota IA atteint" });
      throw new Error(`API AI erreur ${response.status}`);
    }

    const data = await response.json();
    let cards: any[] = [];
    try {
      cards = parseCards(extractCompletionText(data));
    } catch {
      return json({ error: "Réponse IA illisible, veuillez réessayer." });
    }

    const validated = cards.filter((c: any) => c && c.question && (c.answer || c.cloze));

    // Persistance optionnelle (ancien comportement de la table « flashcards »)
    if (persist && courseId && userInfo && validated.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error: insertError } = await supabase.from('flashcards').insert(
        validated.map((c: any) => ({
          user_id: userInfo.userId,
          course_id: courseId,
          question: c.question,
          answer: c.answer || c.cloze,
        }))
      );
      if (insertError) console.error("Erreur d'insertion DB:", insertError);
    }

    return json({ success: true, count: validated.length, cards: validated });
  } catch (err: any) {
    console.error('Error:', err);
    return json({ error: err.message || "Erreur serveur." });
  }
}

serve(handler);
