import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { getUserPlanInfo } from "../_shared/plan-utils.ts";
import { extractCompletionText, logDiagnostic } from "../_shared/ai-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// Plan-based restrictions for summary types
const SUMMARY_TYPE_ACCESS: Record<string, "gratuit" | "premium" | "pro"> = {
  concise: "gratuit",      // Free users can only use concise summaries
  structured: "premium",   // Premium for structured summaries
  complete: "premium",     // Premium for complete summaries
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication and get plan
    const userInfo = await getUserPlanInfo(req);
    if (!userInfo) {
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Input validation ---
    const SummarySchema = z.object({
      content: z.string().min(50, "Contenu trop court").max(100000, "Contenu trop long (max 100k caractères)"),
      type: z.enum(["concise", "structured", "complete"]).default("concise"),
      title: z.string().max(300).optional(),
    });

    const parseResult = SummarySchema.safeParse(await req.json());
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Requête invalide : " + parseResult.error.issues[0]?.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { content, type, title } = parseResult.data;

    // Check plan-based access for summary type
    const requiredPlan = SUMMARY_TYPE_ACCESS[type] || "premium";
    const userPlan = userInfo.plan;
    
    // Admin bypasses all restrictions
    if (!userInfo.isAdmin) {
      if (requiredPlan === "premium" && userPlan === "gratuit") {
        return new Response(
          JSON.stringify({
            error: "Accès refusé",
            message: `Les résumés ${type === "complete" ? "complets" : "structurés"} sont réservés aux abonnés Premium.`,
            requiredPlan: "premium",
            currentPlan: userPlan,
            upgradeRequired: true,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Configuration API manquante" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating ${type} summary for user ${userInfo.userId} (plan: ${userInfo.plan})`);

    // Build the prompt based on summary type
    let typeInstructions = "";
    let lengthGuidelines = "";

    const styleRules = `
FORMAT DE STRUCTURE STRICT:
- Sections principales: === TITRE DE SECTION ===
- Sous-sections: -- Sous-titre --
- Points avec puces: • pour les listes principales
- Sous-points: - pour les éléments détaillés
- Points validés: ✓ pour les points clés
- Flèches: → pour les conséquences ou liens
- Encadrés importants: [ POINT CRITIQUE À RETENIR ]
- Séparateurs entre grandes parties: Une ligne vide

RÈGLES DE CONTENU:
- JAMAIS de hashtag (#) dans le texte
- Phrases complètes et claires
- Vocabulaire médical précis
- Chaque section doit contenir du contenu substantiel
- Ne pas créer de sections vides
- Structurer logiquement l'information`;

    switch (type) {
      case "complete":
        typeInstructions = `Crée un RÉSUMÉ COMPLET et DÉTAILLÉ du cours, format cours magistral médical.

${styleRules}

STRUCTURE À SUIVRE:

=== ${title?.toUpperCase() || "RÉSUMÉ COMPLET"} ===

-- Introduction --
• Contexte et importance du sujet
• Définition claire et précise

-- Physiopathologie --
• Mécanismes physiopathologiques détaillés
• Étiologies principales
- Sous-catégories si nécessaire

-- Clinique --
• Signes fonctionnels (symptômes rapportés)
• Signes généraux
• Signes physiques à l'examen
- Détails sémiologiques importants

-- Examens complémentaires --
• Biologie
• Imagerie
• Autres examens spécifiques

-- Diagnostic différentiel --
• Pathologies à éliminer
• Critères de distinction

-- Complications --
• Complications aiguës
• Complications chroniques
→ Évolution possible

-- Traitement --
• Traitement médical
- Molécules, posologies si pertinent
• Traitement chirurgical si applicable
• Surveillance

-- Prévention --
• Mesures préventives
• Éducation thérapeutique

[ POINTS CLÉS À RETENIR ]
✓ Point essentiel 1
✓ Point essentiel 2
✓ Point essentiel 3
✓ Pièges à éviter`;
        lengthGuidelines = "Résumé détaillé de 2000 à 6000 mots. Chaque section doit être complète et informative.";
        break;

      case "structured":
        typeInstructions = `Crée un RÉSUMÉ STRUCTURÉ et ÉQUILIBRÉ du cours.

${styleRules}

STRUCTURE:

=== ${title?.toUpperCase() || "RÉSUMÉ STRUCTURÉ"} ===

-- Définition --
• Définition concise et complète
→ Points clés de la définition

-- Physiopathologie --
• Mécanisme principal
• Facteurs de risque

-- Tableau clinique --
• Signes majeurs:
  ✓ Signe 1
  ✓ Signe 2
• Signes associés:
  - Détail 1
  - Détail 2

-- Examens --
• Examens de première intention
• Examens spécialisés

-- Traitement --
• Objectifs thérapeutiques
• Modalités:
  ✓ Traitement 1
  ✓ Traitement 2

[ RÉSUMÉ RAPIDE ]
→ Point synthétique 1
→ Point synthétique 2
→ Point synthétique 3`;
        lengthGuidelines = "Résumé de 500 à 2000 mots. Équilibre entre exhaustivité et concision.";
        break;

      case "concise":
        typeInstructions = `Crée une FICHE D'EXAMEN ultra-concise et mémorisable.

${styleRules}

STRUCTURE (20-30 lignes max):

=== FICHE FLASH: ${title?.toUpperCase() || "RÉSUMÉ"} ===

-- Définition --
✓ Définition en une phrase

-- Physiopathologie --
✓ Mécanisme clé

-- Clinique --
✓ Signe cardinal 1
✓ Signe cardinal 2

-- Diagnostic --
✓ Examen de référence

-- Traitement --
✓ Traitement de première ligne

-- Complications --
✓ Complication majeure à connaître

[ À NE PAS OUBLIER ]
→ Le piège classique de l'examen`;
        lengthGuidelines = "Fiche très courte: 150-400 mots maximum. Seulement l'essentiel.";
        break;

      default:
        typeInstructions = "Crée un résumé structuré et clair du cours avec une structure logique.";
        lengthGuidelines = "Résumé équilibré.";
    }

    const systemPrompt = `Tu es un assistant médical expert spécialisé dans la création de fiches pédagogiques professionnelles pour étudiants en médecine.

${typeInstructions}

${lengthGuidelines}

RÈGLES CRITIQUES:
1. JAMAIS de hashtag (#) - utilise === et -- pour les titres
2. Utilise le français médical correct et précis
3. Sois factuel, ne rajoute RIEN qui n'est pas dans le cours
4. Style élégant, professionnel, facile à lire
5. Utilise les icônes médicales avec parcimonie
6. Encadrés [ ] pour les points importants
7. Listes avec • ✓ → selon le contexte`;

    const userPrompt = `Titre du cours: ${title || "Non spécifié"}

Contenu du cours à résumer:
${content.substring(0, 30000)}

Génère le résumé selon les instructions données.`;

    console.log(`Generating ${type} summary for: ${title}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Use a Lovable AI Gateway supported model
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        // Gemini Flash supports ~ 4096 output tokens reliably
        max_tokens: type === "concise" ? 800 : type === "structured" ? 2500 : 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez dans quelques minutes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits insuffisants. Veuillez recharger votre compte." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erreur lors de la génération du résumé" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const summary = extractCompletionText(data);

    if (!summary || !summary.trim()) {
      console.error("No summary generated. Raw response:", JSON.stringify(data).slice(0, 1000));
      await logDiagnostic({
        function_name: "generate-summary",
        user_id: userInfo.userId,
        status: 502,
        request_payload: { type, title, contentLength: content.length },
        response_payload: data,
        error: "Empty AI response after parsing",
      });
      return new Response(
        JSON.stringify({ error: "Aucun résumé n'a pu être généré. Le service IA est temporairement indisponible. Réessayez." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Summary generated successfully, length: ${summary.length} chars`);

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-summary:", error);
    return new Response(
      JSON.stringify({ error: "Erreur lors de la génération du résumé" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
