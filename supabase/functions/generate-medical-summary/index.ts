// supabase/functions/generate-medical-summary/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.68.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1. Définition stricte du JSON Schema (10 sections identiques à RemNote)
export const medicalSummaryJsonSchema = {
  name: "remnote_medical_summary",
  strict: true,
  schema: {
    type: "object",
    properties: {
      core_concepts: {
        type: "array",
        description:
          "Définitions fondamentales, seuils numériques par population et séquences biologiques.",
        items: {
          type: "object",
          properties: {
            term: {
              type: "string",
              description: "Terme médical clé (ex: Anémie, Érythropoïèse)",
            },
            definition: {
              type: "string",
              description: "Définition précise issue du cours",
            },
            sub_points: {
              type: "array",
              items: { type: "string" },
              description:
                "Sous-points éventuels (seuils par âge/sexe, étapes séquentielles avec ⇒)",
            },
          },
          required: ["term", "definition", "sub_points"],
          additionalProperties: false,
        },
      },
      must_remember: {
        type: "array",
        description:
          "Faits incontournables, formules mathématiques en LaTeX ($...$), valeurs normales, seuils décisionnels et posologies.",
        items: {
          type: "object",
          properties: {
            statement: {
              type: "string",
              description:
                "Point essentiel avec mots-clés en **gras** et formules en LaTeX",
            },
            sub_bullets: {
              type: "array",
              items: { type: "string" },
              description:
                "Sous-puces détaillant les formules, classifications ou étiologies",
            },
          },
          required: ["statement", "sub_bullets"],
          additionalProperties: false,
        },
      },
      key_processes: {
        type: "array",
        description:
          "Démarches diagnostiques étape par étape, séquences physiologiques et arbres de prise en charge.",
        items: {
          type: "object",
          properties: {
            process_name: {
              type: "string",
              description:
                "Nom du processus (ex: Démarche diagnostique globale)",
            },
            is_ordered: {
              type: "boolean",
              description:
                "true pour liste numérotée (1, 2, 3), false pour liste à puces",
            },
            steps: {
              type: "array",
              items: { type: "string" },
              description: "Étapes ordonnées ou règles d'interprétation",
            },
          },
          required: ["process_name", "is_ordered", "steps"],
          additionalProperties: false,
        },
      },
      key_comparisons: {
        type: "array",
        description:
          "Comparaisons binaires entre concepts proches (ex: Anémie centrale vs périphérique, Ferritine vs transferrine).",
        items: {
          type: "object",
          properties: {
            comparison_title: {
              type: "string",
              description: "Titre de l'opposition (ex: Entité A vs Entité B)",
            },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entity: { type: "string" },
                  characteristics: { type: "string" },
                },
                required: ["entity", "characteristics"],
                additionalProperties: false,
              },
            },
          },
          required: ["comparison_title", "items"],
          additionalProperties: false,
        },
      },
      common_misunderstandings: {
        type: "array",
        items: { type: "string" },
        description:
          "Idées reçues cliniques ou biologiques corrigées par le cours (limites des tests, faux positifs/négatifs).",
      },
      mental_models: {
        type: "array",
        description:
          "Modèles mentaux, logique intuitive en 2 temps et mécanismes de compensation physiopathologique.",
        items: {
          type: "object",
          properties: {
            main_idea: { type: "string" },
            sub_points: { type: "array", items: { type: "string" } },
          },
          required: ["main_idea", "sub_points"],
          additionalProperties: false,
        },
      },
      exceptions_edge_cases: {
        type: "array",
        description:
          "Cas particuliers, variations de seuils, limites de coûts/disponibilité des biomarqueurs (sTfR, RET-He).",
        items: {
          type: "object",
          properties: {
            main_point: { type: "string" },
            sub_points: { type: "array", items: { type: "string" } },
          },
          required: ["main_point", "sub_points"],
          additionalProperties: false,
        },
      },
      when_to_use_which: {
        type: "array",
        items: { type: "string" },
        description:
          "Règles d'indication des examens complémentaires et des traitements (Utiliser **X** pour Y...).",
      },
      patterns_to_recognize: {
        type: "array",
        description:
          "Associations syndromiques et profils biologiques typiques à reconnaître immédiatement.",
        items: {
          type: "object",
          properties: {
            pattern_trigger: {
              type: "string",
              description:
                "Combinaison de signes (ex: Hb basse + VGM bas + TCMH/CCMH basses)",
            },
            clinical_meaning: {
              type: "string",
              description: "Orientation diagnostique immédiate",
            },
          },
          required: ["pattern_trigger", "clinical_meaning"],
          additionalProperties: false,
        },
      },
      exam_traps: {
        type: "array",
        description:
          "Pièges classiques d'examen (QCM/EDN), confusions de formules, contre-indications thérapeutiques.",
        items: {
          type: "object",
          properties: {
            trap: {
              type: "string",
              description:
                "Description du piège à éviter (peut inclure une formule LaTeX $$...$$)",
            },
            details: { type: "array", items: { type: "string" } },
          },
          required: ["trap", "details"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "core_concepts",
      "must_remember",
      "key_processes",
      "key_comparisons",
      "common_misunderstandings",
      "mental_models",
      "exceptions_edge_cases",
      "when_to_use_which",
      "patterns_to_recognize",
      "exam_traps",
    ],
    additionalProperties: false,
  },
};

// 2. Le System Prompt d'Ingénierie Pédagogique Médicale
export const SYSTEM_PROMPT = `Tu es un Professeur Agrégé de Médecine spécialisé dans la synthèse pédagogique de haut niveau (style RemNote / AMBOSS High-Yield).
Ta mission est de transformer l'intégralité du cours médical fourni en une fiche d'étude exhaustive, structurée en 10 sections cognitives.

RÈGLES ABSOLUES DE FIDÉLITÉ ET DE RIGUEUR :
1. ZÉRO OMISSION : Tu dois couvrir 100 % du cours, du début (définitions, épidémiologie, physiopathologie) jusqu'à la toute fin (traitements, posologies exactes en mg/j ou µg, durées, contre-indications et indications transfusionnelles).
2. CORRECTION DES FORMULES OCR : Si le texte brut extrait d'une diapositive a cassé une fraction mathématique (ex: formules de VGM, TCMH, CCMH, Coefficient de saturation), rétablis la formule complète exacte de la diapositive en LaTeX valide :
   - $VGM = \\frac{Ht(\\%) \\times 10}{GR\\,(millions)}$
   - $TCMH = \\frac{Hb(g/dL) \\times 10}{GR\\,(millions)}$
   - $CCMH = \\frac{Hb(g/dL) \\times 100}{Ht(\\%)}$
   - $\\%\\,Sat = \\frac{Fer\\,sérique}{CTFS} \\times 100$
3. VALEURS NUMÉRIQUES ET SEUILS : Conserve scrupuleusement tous les chiffres, seuils (Hb par âge/sexe, réticulocytes à 80 000/mm³, RET-He < 28 pg, CV 12-15%, etc.), flèches de variations biologiques (↑, ↓) et posologies thérapeutiques (ex: Sels ferreux 100-200 mg/j adulte, 10 mg/kg enfant, Acide folique 5 mg/j, Vitamine B12 1000 µg/3j, contre-indication du fer dans l'anémie inflammatoire) du support original.
4. STYLE DIRECT ET CLINIQUE : Rédige en français médical précis. Utilise la flèche "⇒" pour les séquences cellulaires (ex: érythropoïèse). Mets en **gras** les concepts clés à l'intérieur des phrases.`;

// 3. Fonction de conversion du JSON vers le Markdown exact de RemNote
export function renderRemNoteMarkdown(data: any): string {
  const lines: string[] = [];

  // 1. Core Concepts
  lines.push("## 📖 Core Concepts\n");
  for (const item of data.core_concepts || []) {
    lines.push(`- **${item.term}** : ${item.definition}`);
    for (const sub of item.sub_points || []) {
      lines.push(`  - ${sub}`);
    }
  }

  // 2. Must Remember
  lines.push("\n## 📌 Must Remember\n");
  for (const item of data.must_remember || []) {
    lines.push(`- ${item.statement}`);
    for (const sub of item.sub_bullets || []) {
      lines.push(`  - ${sub}`);
    }
  }

  // 3. Key Processes
  lines.push("\n## 🔄 Key Processes\n");
  for (const proc of data.key_processes || []) {
    lines.push(`- **${proc.process_name} :**`);
    (proc.steps || []).forEach((step: string, idx: number) => {
      const prefix = proc.is_ordered ? `${idx + 1}.` : `-`;
      lines.push(`  ${prefix} ${step}`);
    });
  }

  // 4. Key Comparisons
  lines.push("\n## 🔍 Key Comparisons\n");
  for (const comp of data.key_comparisons || []) {
    lines.push(`- **${comp.comparison_title}**`);
    for (const el of comp.items || []) {
      lines.push(`  - **${el.entity}** : ${el.characteristics}`);
    }
  }

  // 5. Common Misunderstandings
  lines.push("\n## ⚠️ Common Misunderstandings\n");
  for (const item of data.common_misunderstandings || []) {
    lines.push(`- ${item}`);
  }

  // 6. Mental Models / Intuition
  lines.push("\n## 🧠 Mental Models / Intuition\n");
  for (const item of data.mental_models || []) {
    lines.push(`- ${item.main_idea}`);
    for (const sub of item.sub_points || []) {
      lines.push(`  - ${sub}`);
    }
  }

  // 7. Exceptions & Edge Cases
  lines.push("\n## 🚩 Exceptions & Edge Cases\n");
  for (const item of data.exceptions_edge_cases || []) {
    lines.push(`- ${item.main_point}`);
    for (const sub of item.sub_points || []) {
      lines.push(`  - ${sub}`);
    }
  }

  // 8. When to Use Which
  lines.push("\n## 📍 When to Use Which\n");
  for (const item of data.when_to_use_which || []) {
    lines.push(`- ${item}`);
  }

  // 9. Patterns to Recognize
  lines.push("\n## 👀 Patterns to Recognize\n");
  for (const pat of data.patterns_to_recognize || []) {
    lines.push(`- **${pat.pattern_trigger}** : ${pat.clinical_meaning}`);
  }

  // 10. Exam Traps
  lines.push("\n## 🗂️ Exam Traps\n");
  for (const trap of data.exam_traps || []) {
    lines.push(`- ${trap.trap}`);
    for (const detail of trap.details || []) {
      lines.push(`  - ${detail}`);
    }
  }

  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const courseText = String(body.courseText || body.content || "");
    const slideImagesBase64: string[] = Array.isArray(body.slideImagesBase64)
      ? body.slideImagesBase64
      : [];
    const customSystemExtra = body.customInstructions
      ? `\n\nDIRECTIVES SUPPLÉMENTAIRES DE L'ÉTUDIANT :\n${body.customInstructions}`
      : "";

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const client = new OpenAI({
      apiKey: openAiKey || openRouterKey || lovableKey || "",
      baseURL: openAiKey
        ? undefined
        : openRouterKey
        ? "https://openrouter.ai/api/v1"
        : "https://ai.gateway.lovable.dev/v1",
    });

    const modelName = openAiKey
      ? "gpt-4o-2024-08-06"
      : "google/gemini-2.5-flash";

    // Construction du message multimodal (Texte + Images des diapos si disponibles)
    const userContent: any[] = [
      {
        type: "text",
        text: `Voici le contenu complet du cours de médecine à synthétiser (du début jusqu'à la toute dernière diapositive) :\n\n${courseText}`,
      },
    ];

    // Ajout optionnel des diapositives sous forme d'images pour lire les schémas, fractions et tableaux
    for (const base64Img of slideImagesBase64.slice(0, 20)) {
      userContent.push({
        type: "image_url",
        image_url: { url: base64Img, detail: "low" },
      });
    }

    const completion = await client.chat.completions.create({
      model: modelName,
      temperature: 0.1, // Température très basse pour garantir la précision médicale et zéro paraphrase
      messages: [
        { role: "system", content: SYSTEM_PROMPT + customSystemExtra },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: medicalSummaryJsonSchema,
      },
    });

    const rawJson = completion.choices[0]?.message?.content || "{}";
    const structuredData = JSON.parse(rawJson);
    const markdownOutput = renderRemNoteMarkdown(structuredData);

    return new Response(
      JSON.stringify({
        structured: structuredData,
        markdown: markdownOutput,
        summary: markdownOutput,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
