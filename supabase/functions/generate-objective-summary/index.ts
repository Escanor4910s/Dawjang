import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SummaryRequest {
  courseText: string;
  courseTitle: string;
  forcedMatiere?: string;
  forcedSemestre?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { courseText, courseTitle, forcedMatiere, forcedSemestre }: SummaryRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ÉTAPE 1 : Identifier le compartiment (Niveau, Semestre, Matière) et extraire les Objectifs du cours
    const classificationPrompt = `
Tu es un classificateur académique médical (cursus L1 S1 à M2).
Analyse l'intitulé et l'extrait du cours suivant :
Titre : ${courseTitle}
Extrait : ${(courseText || "").slice(0, 6000)}

Retourne UNIQUEMENT un JSON valide avec cette structure :
{
  "niveau": "L1 | L2 | L3 | M1 | M2",
  "semestre": "S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 | S10",
  "matiere": "Nom exact de la matière (ex: Hématologie, Maladies Infectieuses, Urgences Réanimation, Cancérologie, Anatomie, Biologie Cellulaire...)",
  "objectifs_officiels": ["Objectif 1...", "Objectif 2..."]
}`;

    const classifRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: classificationPrompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      }
    );

    const classifData = await classifRes.json();
    const metadata = JSON.parse(classifData.candidates[0].content.parts[0].text);

    const targetMatiere = forcedMatiere || metadata.matiere || "Médecine Générale";
    const targetSemestre = forcedSemestre || metadata.semestre || "S8";

    // ÉTAPE 2 : Rechercher activement toutes les évaluations de cette matière dans l'index du Drive
    const { data: examArchives } = await supabase
      .from("drive_exam_archives")
      .select("titre, type_doc, contenu_extrait, pieges_extraits")
      .ilike("matiere", `%${targetMatiere}%`)
      .in("type_doc", ["evaluation_qcm", "cas_clinique"])
      .limit(10);

    const examContext = examArchives && examArchives.length > 0
      ? examArchives.map((e) => `[${e.titre}] :\n${e.contenu_extrait}\nPièges connus: ${JSON.stringify(e.pieges_extraits)}`).join("\n\n---\n\n")
      : "Standards d'évaluation QCM et Cas cliniques des facultés de médecine francophones (Université Assane Seck / UCAD).";

    // ÉTAPE 3 : Générer le Résumé Calibré par Objectif + La Marche à Suivre Anti-Pièges
    const masterSystemPrompt = `
Tu es un Professeur Agrégé de Médecine et Concepteur d'Examens (QCM & Cas Cliniques).
Ta mission est de produire un résumé de perfection selon la doctrine "OBJECTIFS & STRATÉGIE D'EXAMEN".

RÈGLES D'OR DU JUGEMENT PÉDAGOGIQUE (OÙ APPUYER vs OÙ SE RETENIR) :
1. NE SURVOLE JAMAIS un objectif de façon superficielle, mais NE NOIE PAS l'étudiant sous du remplissage.
2. APPUIE FORTEMENT (tableaux comparatifs, seuils chiffrés exacts, formules, arbres décisionnels, posologies) sur tout ce qui est directement testable en QCM ou indispensable au diagnostic étiologique.
3. RETIENS-TOI (synthétise en 1 ligne ou ignore) sur l'historique, les cartes épidémiologiques mondiales générales ou les illustrations purement décoratives.
4. Croise systématiquement le cours avec les ANNALES D'ÉVALUATION de la matière (${targetMatiere} - ${targetSemestre}) fournies ci-dessous.

STRUCTURE JSON OBLIGATOIRE EN SORTIE :
{
  "metadata": {
    "titre_lecon": "string",
    "matiere": "${targetMatiere}",
    "niveau_semestre": "${metadata.niveau || "M1"} - ${targetSemestre}"
  },
  "objectifs_developpes": [
    {
      "numero": 1,
      "intitule_objectif": "string",
      "importance_examen": "Critique (Tombe à chaque session) | Élevée | Modérée",
      "contenu_structuré_markdown": "Développement complet, précis, avec tableaux Markdown, formules et gras sur les mots-clés...",
      "points_incontournables": ["Valeur/Seuil clé 1", "Règle absolue 2"]
    }
  ],
  "strategie_examen": {
    "marche_a_suivre_evaluation": [
      {
        "etape": 1,
        "action": "Que regarder en premier lorsque cette leçon tombe en QCM ou Cas Clinique",
        "detail_reflexe": "Explication concrète du réflexe mental à avoir"
      }
    ],
    "pieges_des_professeurs": [
      {
        "titre_piege": "Nom du tour de passe-passe (ex: Ferritine normale et inflammation)",
        "distracteur_qcm": "La phrase piège typique qui apparaît dans les propositions de QCM",
        "parade_etudiant": "Pourquoi c'est faux et comment ne jamais tomber dedans"
      }
    ],
    "a_ne_jamais_oublier": [
      "Contre-indication absolue ou règle vitale 1",
      "Règle vitale 2"
    ]
  },
  "qcm_entrainement_cibles": [
    {
      "question": "Énoncé de QCM ou mini-cas clinique ciblant un des pièges identifiés",
      "options": ["A. ...", "B. ...", "C. ...", "D. ...", "E. ..."],
      "reponses_exactes": ["B", "D"],
      "explication_anti_piege": "Correction détaillée expliquant le piège tendu"
    }
  ]
}`;

    const userPrompt = `
=== OBJECTIFS OFFICIELS IDENTIFIÉS DANS LE COURS ===
${JSON.stringify(metadata.objectifs_officiels || [], null, 2)}

=== ANNALES & ÉVALUATIONS DU DRIVE (${targetMatiere} - ${targetSemestre}) ===
${examContext}

=== CONTENU INTÉGRAL DU COURS ===
${courseText}
`;

    const summaryRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: masterSystemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      }
    );

    const summaryJson = await summaryRes.json();
    const structuredResult = JSON.parse(summaryJson.candidates[0].content.parts[0].text);

    return new Response(JSON.stringify(structuredResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
