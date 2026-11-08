// supabase/functions/generate-pdf/index.ts
// Supabase Edge Function (Deno) pour la génération de synthèse médicale PDF / DawJang Press A4
import { serve } from "https://deno.land/std@0.181.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface GeneratePdfRequest {
  markdown: string;
  title?: string;
  date?: string;
  reference?: string;
  ref?: string;
}

/**
 * Découpe et encapsule sémantiquement les sections de la doctrine ARVA
 */
function structureArvaHtmlSections(htmlContent: string): string {
  if (!htmlContent.includes("Matrice Active Recall") && !htmlContent.includes("Scripts Cliniques") && !htmlContent.includes("Vignette Clinique")) {
    return htmlContent;
  }

  const parts = htmlContent.split(/(?=<h2[\s>])/i);
  if (parts.length <= 1) return htmlContent;

  return parts
    .map((part) => {
      const h2Match = part.match(/<h2[^>]*>(.*?)<\/h2>/i);
      const heading = (h2Match ? h2Match[1] : part.substring(0, 150)).toLowerCase();

      if (heading.includes("matrice") || heading.includes("active recall")) {
        return `<section id="active-recall" class="arva-section active-recall">\n${part}\n</section>`;
      }
      if (heading.includes("scripts") || heading.includes("différentiels") || heading.includes("differentiels") || heading.includes("illness")) {
        return `<section id="scripts-cliniques" class="arva-section scripts-cliniques">\n${part}\n</section>`;
      }
      if (heading.includes("vignette") || heading.includes("cas clinique")) {
        return `<section id="vignette-clinique" class="arva-section vignette">\n${part}\n</section>`;
      }
      if (heading.includes("visas") || heading.includes("révision") || heading.includes("revision") || heading.includes("annotations")) {
        return `<section id="visas-revision" class="arva-section visas">\n${part}\n</section>`;
      }
      return part;
    })
    .join("\n\n");
}

/**
 * Conversion du Markdown en HTML avec support complet de GFM (tables, etc.) et alertes docimologiques
 */
async function markdownToHtml(markdown: string): Promise<string> {
  try {
    const { remark } = await import("npm:remark");
    const { default: html } = await import("npm:remark-html");
    const { default: gfm } = await import("npm:remark-gfm");

    const processed = await remark()
      .use(gfm)
      .use(html, { sanitize: false })
      .process(markdown || "");
    let rawHtml = processed.toString();

    // Détection des pièges cliniques / QCM
    rawHtml = rawHtml.replace(
      /<blockquote>\s*<p>(?:\[V\]\s*)?(?:⚠️\s*)?(?:Piège(?:\s+clinique|\s+QCM)?\s*:\s*)?(.*?)<\/p>\s*<\/blockquote>/gis,
      '<div class="note">⚠️ <strong>Piège QCM :</strong> $1</div>'
    );

    // Détection des règles d'or
    rawHtml = rawHtml.replace(
      /<blockquote>\s*<p>(?:✓|Règle d'or\s*:)\s*(.*?)<\/p>\s*<\/blockquote>/gis,
      '<blockquote>✓ <strong>Règle d\'Or :</strong> $1</blockquote>'
    );

    return structureArvaHtmlSections(rawHtml);
  } catch {
    // Fallback Deno sans dépendances npm externes si nécessaire
    return markdown
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
      .replace(/^\s*-\s+(.*$)/gim, "<li>$1</li>")
      .replace(/(<li>.*?<\/li>)/gis, "<ul>$1</ul>")
      .replace(/\n\n/g, "<br/><br/>");
  }
}

/**
 * Assemblage du Template DawJang Press A4
 */
function buildDawjangTemplate(title: string, date: string, reference: string, synthesisHtml: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap');
    @page {
      size: A4;
      margin: 3.5cm 2.5cm 3cm 2.5cm;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #222;
      margin: 0;
      padding: 0;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    header {
      position: fixed;
      top: 0; left: 0; right: 0; height: 3.5cm;
      border-bottom: 1px solid #ccc;
      padding: 1rem 2.5cm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      font-weight: 600;
      color: #1e40af;
      box-sizing: border-box;
    }
    header .logo {
      font-family: 'Merriweather', serif;
      font-size: 20pt;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #2563eb;
    }
    header .meta {
      text-align: right;
      font-size: 10pt;
      line-height: 1.35;
      color: #334155;
    }
    section.title {
      margin-top: 4.5cm;
      margin-bottom: 1.75rem;
      font-family: 'Merriweather', serif;
      font-size: 20pt;
      font-weight: 700;
      border-left: 6px solid #3b82f6;
      padding-left: 1rem;
      color: #1e40af;
      line-height: 1.3;
    }
    h1 {
      font-family: 'Merriweather', serif;
      font-size: 16pt;
      font-weight: 700;
      margin-top: 2rem;
      margin-bottom: 0.75rem;
      color: #1e40af;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 0.4rem;
    }
    h2 {
      font-family: 'Merriweather', serif;
      font-weight: 700;
      font-size: 13.5pt;
      margin-top: 1.75rem;
      margin-bottom: 0.75rem;
      border-left: 4px solid #60a5fa;
      padding-left: 0.6rem;
      color: #2563eb;
      page-break-after: avoid;
    }
    h3 {
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: 11pt;
      text-transform: uppercase;
      margin-top: 1.35rem;
      margin-bottom: 0.5rem;
      color: #2563eb;
      letter-spacing: 0.08em;
      page-break-after: avoid;
    }
    p {
      margin-bottom: 0.75rem;
      text-align: justify;
    }
    strong {
      font-weight: 700;
      color: #0f172a;
    }
    ul, ol {
      margin-left: 1.5rem;
      margin-bottom: 0.75rem;
      padding-left: 0.5rem;
    }
    li {
      margin-bottom: 0.35rem;
      line-height: 1.5;
    }
    blockquote {
      background: #e0f2fe;
      border-left: 4px solid #60a5fa;
      padding: 0.6rem 1rem;
      margin: 1rem 0;
      font-style: italic;
      color: #1e40af;
      border-radius: 4px;
      box-shadow: 0 2px 6px rgba(96, 165, 250, 0.2);
    }
    .note {
      background: #fef3c7;
      border: 1px solid #facc15;
      padding: 0.65rem 1rem;
      margin: 0.75rem 0 1.25rem 0;
      font-weight: 600;
      color: #b45309;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(250, 204, 21, 0.25);
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1.25rem 0;
      font-size: 10pt;
      font-family: 'Inter', sans-serif;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 0.5rem 0.75rem;
      vertical-align: top;
    }
    th {
      background-color: #2563eb;
      color: white;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8.5pt;
      letter-spacing: 0.05em;
    }
    tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    tbody tr:hover {
      background-color: #e0e7ff;
    }
    .arva-section {
      margin-bottom: 2rem;
      padding: 1.25rem 1.5rem;
      border-left: 6px solid #2563eb;
      background-color: #f8fafc;
      page-break-inside: avoid;
      border-radius: 0 10px 10px 0;
    }
    .active-recall {
      border-left-color: #4f46e5;
      background-color: #eef2ff;
    }
    .scripts-cliniques {
      border-left-color: #0284c7;
      background-color: #f0f9ff;
    }
    .vignette {
      border-left-color: #f59e0b;
      background-color: #fffbeb;
    }
    .visas {
      border-left-color: #059669;
      background-color: #ecfdf5;
    }
    footer {
      position: fixed;
      bottom: 0; left: 0; right: 0; height: 2cm;
      border-top: 1px solid #ccc;
      padding: 0.5rem 2.5cm;
      font-size: 9pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-sizing: border-box;
      background: #ffffff;
    }
    .page-number:after {
      content: counter(page);
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">DAWJANG PRESS</div>
    <div class="meta">
      <div>Faculté de Médecine • ${date}</div>
      <div>Réf : ${reference}</div>
      <div>Page <span class="page-number"></span></div>
    </div>
  </header>
  <section class="title">${title}</section>
  <article>${synthesisHtml}</article>
  <footer>
    <span>Hippocampus • DawJang Press</span>
    <span>Synthèse Médicale • Page <span class="page-number"></span></span>
  </footer>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as GeneratePdfRequest;
    const { markdown, title } = payload;
    const docTitle = title || "Synthèse Médicale";
    const docDate = payload.date || new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const docRef = payload.reference || payload.ref || `DWJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (!markdown || !markdown.trim()) {
      return new Response(
        JSON.stringify({ error: "Le champ 'markdown' est obligatoire." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const synthesisHtml = await markdownToHtml(markdown);
    const fullHtml = buildDawjangTemplate(docTitle, docDate, docRef, synthesisHtml);

    // 1. Connexion Browserless.io si la clé API est fournie
    const browserlessKey = Deno.env.get("BROWSERLESS_API_KEY");
    if (browserlessKey) {
      const browserlessRes = await fetch(`https://chrome.browserless.io/pdf?token=${browserlessKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: fullHtml,
          options: {
            format: "A4",
            printBackground: true,
            margin: { top: "3.5cm", bottom: "3cm", left: "2.5cm", right: "2.5cm" },
          },
        }),
      });

      if (browserlessRes.ok) {
        const pdfBytes = await browserlessRes.arrayBuffer();
        const safeTitle = docTitle.replace(/\s+/g, "_");
        return new Response(pdfBytes, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(safeTitle)}.pdf"`,
          },
        });
      }
    }

    // 2. Relais vers microservice local ou conteneur Node.js dédié si configuré
    const pdfServiceUrl = Deno.env.get("PDF_SERVICE_URL");
    if (pdfServiceUrl) {
      const relayRes = await fetch(`${pdfServiceUrl}/api/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, title: docTitle, date: docDate, ref: docRef }),
      });

      if (relayRes.ok) {
        const pdfBytes = await relayRes.arrayBuffer();
        return new Response(pdfBytes, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(docTitle.replace(/\s+/g, "_"))}.pdf"`,
          },
        });
      }
    }

    // 3. Fallback immédiat et universel : retour du template HTML prêt pour affichage et impression vectorielle
    return new Response(
      JSON.stringify({
        success: true,
        html: fullHtml,
        title: docTitle,
        reference: docRef,
        message: "HTML DawJang A4 généré. Prêt pour affichage vectoriel.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e: any) {
    console.error("Erreur Edge Function generate-pdf :", e);
    return new Response(
      JSON.stringify({ error: e.message || "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
