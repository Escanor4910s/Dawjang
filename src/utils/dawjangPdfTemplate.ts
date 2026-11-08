// src/utils/dawjangPdfTemplate.ts
import Showdown from "showdown";
import { cleanForDawJangPdf } from "@/lib/coPilotSummaryEngine";

export interface DawjangTemplateOptions {
  date?: string;
  reference?: string;
  faculty?: string;
  logoText?: string;
}

const converter = new Showdown.Converter({
  tables: true,
  simplifiedAutoLink: true,
  strikethrough: true,
  tasklists: true,
  openLinksInNewWindow: true,
});

/**
 * Découpe et encapsule sémantiquement les sections de la doctrine ARVA
 */
export function structureArvaHtmlSections(htmlContent: string): string {
  if (
    !htmlContent.includes("Matrice Active Recall") &&
    !htmlContent.includes("Scripts Cliniques") &&
    !htmlContent.includes("Vignette Clinique")
  ) {
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
 * Convertit le Markdown en HTML haute fidélité via remark + remark-gfm + remark-html
 * avec support exhaustif des tableaux GFM, alertes et encapsulation ARVA
 */
export async function markdownToHtmlGfm(markdown: string): Promise<string> {
  const safeMarkdown = cleanForDawJangPdf(markdown || "");
  const { remark } = await import("remark");
  const { default: html } = await import("remark-html");
  const { default: gfm } = await import("remark-gfm");

  const processed = await remark()
    .use(gfm)
    .use(html, { sanitize: false })
    .process(safeMarkdown);

  let rawHtml = processed.toString();

  // Pièges docimologiques
  rawHtml = rawHtml.replace(
    /(?:<p>)?(?:[-*•]\s*)?(?:⚠️|\[Piège\]|Piège(?:\s+clinique)?\s*:)\s*(.*?)(?:<\/p>)?/gim,
    '<div class="note">⚠️ <strong>Piège Docimologique :</strong> $1</div>'
  );

  // Règles d'or
  rawHtml = rawHtml.replace(
    /(?:<p>)?(?:[-*•]\s*)?(?:✓|Règle d'or\s*:)\s*(.*?)(?:<\/p>)?/gim,
    '<blockquote>✓ <strong>Règle d\'Or :</strong> $1</blockquote>'
  );

  return structureArvaHtmlSections(rawHtml);
}

/**
 * Convertit le Markdown ou HTML brut en HTML enrichi pour le template DawJang Press (mode synchrone)
 */
export function formatMedicalHtmlForPdf(rawText: string): string {
  if (!rawText) return "";

  let md = cleanForDawJangPdf(rawText).trim();

  // Si c'est déjà du pur HTML avec des balises h2, ne pas sur-convertir
  if (!md.startsWith("<") && !md.includes("<h2") && !md.includes("<p>")) {
    // Normalisation des sauts de ligne autour des tableaux Markdown pour Showdown
    md = md.replace(/([^\n])\n(\|.*?\|)\n/g, "$1\n\n$2\n");
    md = md.replace(/(\|[^\n]+\|)\n([^\n|])/g, "$1\n\n$2");
    md = converter.makeHtml(md);
  }

  // Transformation des pièges et alertes vers <div class="note">
  md = md.replace(
    /(?:<p>)?(?:[-*•]\s*)?(?:⚠️|\[Piège\]|Piège(?:\s+clinique)?\s*:)\s*(.*?)(?:<\/p>)?/gim,
    '<div class="note">⚠️ <strong>Piège Docimologique :</strong> $1</div>'
  );

  // Transformation des règles d'or vers <blockquote>
  md = md.replace(
    /(?:<p>)?(?:[-*•]\s*)?(?:✓|Règle d'or\s*:)\s*(.*?)(?:<\/p>)?/gim,
    '<blockquote>✓ <strong>Règle d\'Or :</strong> $1</blockquote>'
  );

  return structureArvaHtmlSections(md);
}

/**
 * Génère le document HTML complet calibré pour l'impression A4 haute fidélité (Puppeteer ou Navigateur)
 */
export function generateDawjangHtml(
  title: string,
  content: string,
  options: DawjangTemplateOptions = {}
): string {
  const {
    date = new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    reference = `DWJ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    faculty = "Faculté de Médecine",
    logoText = "DAWJANG PRESS",
  } = options;

  const synthesisHtml = formatMedicalHtmlForPdf(content);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — Synthèse Médicale</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap');

  @page {
    size: A4;
    margin: 3.5cm 2.5cm 3cm 2.5cm;
  }

  @media print {
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
    }
    footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
    }
    .page-break {
      page-break-before: always;
    }
    h2, h3, .note, blockquote, table {
      page-break-inside: avoid;
    }
  }

  * {
    box-sizing: border-box;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 10.5pt;
    line-height: 1.6;
    color: #1f2937;
    margin: 0;
    background: #ffffff;
  }

  header {
    height: 2.8cm;
    border-bottom: 2px solid #e2e8f0;
    padding: 0.8rem 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: transparent;
    color: #1e40af;
  }

  header .logo {
    font-family: 'Merriweather', Georgia, serif;
    font-size: 18pt;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #1d4ed8;
  }

  header .meta {
    text-align: right;
    font-size: 9pt;
    line-height: 1.35;
    color: #4b5563;
  }

  header .meta strong {
    color: #1e40af;
  }

  section.title-section {
    margin-top: 1.25rem;
    margin-bottom: 1.75rem;
    padding: 0.85rem 1.25rem;
    background: #f8fafc;
    border-left: 6px solid #2563eb;
    border-radius: 0 8px 8px 0;
  }

  section.title-section h1 {
    font-family: 'Merriweather', Georgia, serif;
    font-size: 19pt;
    font-weight: 700;
    margin: 0 0 0.35rem 0;
    color: #1e3a8a;
    line-height: 1.25;
  }

  section.title-section .subtitle {
    font-size: 9pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #3b82f6;
  }

  h2 {
    font-family: 'Merriweather', Georgia, serif;
    font-weight: 700;
    font-size: 13.5pt;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
    border-left: 4px solid #3b82f6;
    padding-left: 0.65rem;
    color: #1d4ed8;
    line-height: 1.3;
  }

  h3 {
    font-family: 'Inter', sans-serif;
    font-weight: 700;
    font-size: 10.5pt;
    text-transform: uppercase;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    color: #2563eb;
    letter-spacing: 0.08em;
  }

  p {
    margin-top: 0;
    margin-bottom: 0.75rem;
    text-align: justify;
  }

  strong {
    font-weight: 700;
    color: #111827;
  }

  em {
    font-style: italic;
    color: #374151;
  }

  ul {
    list-style: none;
    margin-top: 0.35rem;
    margin-left: 0.25rem;
    margin-bottom: 0.85rem;
    padding-left: 0;
  }

  ul li {
    position: relative;
    padding-left: 1.35rem;
    margin-bottom: 0.35rem;
    line-height: 1.55;
  }

  ul li::before {
    content: "■";
    position: absolute;
    left: 0;
    color: #2563eb;
    font-size: 7.5pt;
    top: 0.15rem;
  }

  ul ul li::before {
    content: "◆";
    color: #4f46e5;
    font-size: 7.5pt;
  }

  ol {
    margin-top: 0.35rem;
    margin-left: 1.5rem;
    margin-bottom: 0.85rem;
    padding-left: 0;
  }

  ol li {
    margin-bottom: 0.35rem;
    line-height: 1.55;
  }

  blockquote {
    background: #f0f7ff;
    border-left: 4px solid #3b82f6;
    padding: 0.75rem 1.15rem;
    margin: 1rem 0;
    font-style: normal;
    color: #1e40af;
    border-radius: 0 8px 8px 0;
    font-size: 10pt;
    line-height: 1.55;
    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.06);
  }

  .note {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-left: 4px solid #2563eb;
    padding: 0.75rem 1.15rem;
    margin: 0.85rem 0 1.25rem 0;
    color: #1e3a8a;
    border-radius: 0 8px 8px 0;
    font-size: 10pt;
    line-height: 1.55;
    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1.25rem 0;
    font-size: 10pt;
    font-family: 'Inter', sans-serif;
    page-break-inside: avoid;
    border-radius: 6px;
    overflow: hidden;
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
    text-align: left;
    text-transform: uppercase;
    font-size: 8.5pt;
    letter-spacing: 0.05em;
  }

  tbody tr:nth-child(even) td {
    background-color: #f8fafc;
  }

  tbody tr:hover td {
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

  .arva-section.active-recall {
    border-left-color: #4f46e5;
    background-color: #eef2ff;
  }

  .arva-section.scripts-cliniques {
    border-left-color: #0284c7;
    background-color: #f0f9ff;
  }

  .arva-section.vignette {
    border-left-color: #f59e0b;
    background-color: #fffbeb;
  }

  .arva-section.visas {
    border-left-color: #059669;
    background-color: #ecfdf5;
  }

  footer {
    height: 1.8cm;
    border-top: 1px solid #e2e8f0;
    padding: 0.5rem 0;
    font-size: 8.5pt;
    color: #64748b;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  footer .brand {
    font-weight: 600;
    color: #1d4ed8;
  }
</style>
</head>
<body>
<header>
  <div class="logo">${logoText}</div>
  <div class="meta">
    <div>${faculty} • ${date}</div>
    <div>Réf : <strong>${reference}</strong></div>
    <div>Monographie de Synthèse Clinique</div>
  </div>
</header>

<section class="title-section">
  <div class="subtitle">Synthèse Médicale Haute Précision</div>
  <h1>${title}</h1>
</section>

<article>
  ${synthesisHtml}
</article>

<footer>
  <span class="brand">${logoText} • Synthèse Médicale</span>
  <span>Document académique officiel • Diffusion restreinte</span>
</footer>
</body>
</html>`;
}

export function generateDawjangHtmlFromHtml(
  title: string,
  synthesisHtml: string,
  options: DawjangTemplateOptions = {}
): string {
  const {
    date = new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    reference = `DWJ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    faculty = "Faculté de Médecine",
    logoText = "DAWJANG PRESS",
  } = options;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — Synthèse Médicale</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap');

  @page {
    size: A4;
    margin: 3.5cm 2.5cm 3cm 2.5cm;
  }

  @media print {
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
    }
    footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
    }
    .page-break {
      page-break-before: always;
    }
    h2, h3, .note, blockquote, table, .arva-section {
      page-break-inside: avoid;
    }
  }

  * {
    box-sizing: border-box;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 10.5pt;
    line-height: 1.6;
    color: #1f2937;
    margin: 0;
    background: #ffffff;
  }

  header {
    height: 2.8cm;
    border-bottom: 2px solid #e2e8f0;
    padding: 0.8rem 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: transparent;
    color: #1e40af;
  }

  header .logo {
    font-family: 'Merriweather', Georgia, serif;
    font-size: 18pt;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #1d4ed8;
  }

  header .meta {
    text-align: right;
    font-size: 9pt;
    line-height: 1.35;
    color: #4b5563;
  }

  header .meta strong {
    color: #1e40af;
  }

  section.title-section {
    margin-top: 1.25rem;
    margin-bottom: 1.75rem;
    padding: 0.85rem 1.25rem;
    background: #f8fafc;
    border-left: 6px solid #2563eb;
    border-radius: 0 8px 8px 0;
  }

  section.title-section h1 {
    font-family: 'Merriweather', Georgia, serif;
    font-size: 19pt;
    font-weight: 700;
    margin: 0 0 0.35rem 0;
    color: #1e3a8a;
    line-height: 1.25;
  }

  section.title-section .subtitle {
    font-size: 9pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #3b82f6;
  }

  h2 {
    font-family: 'Merriweather', Georgia, serif;
    font-weight: 700;
    font-size: 13.5pt;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
    border-left: 4px solid #3b82f6;
    padding-left: 0.65rem;
    color: #1d4ed8;
    line-height: 1.3;
  }

  h3 {
    font-family: 'Inter', sans-serif;
    font-weight: 700;
    font-size: 10.5pt;
    text-transform: uppercase;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    color: #2563eb;
    letter-spacing: 0.08em;
  }

  p {
    margin-top: 0;
    margin-bottom: 0.75rem;
    text-align: justify;
  }

  strong {
    font-weight: 700;
    color: #111827;
  }

  em {
    font-style: italic;
    color: #374151;
  }

  ul {
    list-style: none;
    margin-top: 0.35rem;
    margin-left: 0.25rem;
    margin-bottom: 0.85rem;
    padding-left: 0;
  }

  ul li {
    position: relative;
    padding-left: 1.35rem;
    margin-bottom: 0.35rem;
    line-height: 1.55;
  }

  ul li::before {
    content: "■";
    position: absolute;
    left: 0;
    color: #2563eb;
    font-size: 7.5pt;
    top: 0.15rem;
  }

  ul ul li::before {
    content: "◆";
    color: #4f46e5;
    font-size: 7.5pt;
  }

  ol {
    margin-top: 0.35rem;
    margin-left: 1.5rem;
    margin-bottom: 0.85rem;
    padding-left: 0;
  }

  ol li {
    margin-bottom: 0.35rem;
    line-height: 1.55;
  }

  blockquote {
    background: #f0f7ff;
    border-left: 4px solid #3b82f6;
    padding: 0.75rem 1.15rem;
    margin: 1rem 0;
    font-style: normal;
    color: #1e40af;
    border-radius: 0 8px 8px 0;
    font-size: 10pt;
    line-height: 1.55;
    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.06);
  }

  .note {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-left: 4px solid #2563eb;
    padding: 0.75rem 1.15rem;
    margin: 0.85rem 0 1.25rem 0;
    color: #1e3a8a;
    border-radius: 0 8px 8px 0;
    font-size: 10pt;
    line-height: 1.55;
    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1.25rem 0;
    font-size: 10pt;
    font-family: 'Inter', sans-serif;
    page-break-inside: avoid;
    border-radius: 6px;
    overflow: hidden;
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
    text-align: left;
    text-transform: uppercase;
    font-size: 8.5pt;
    letter-spacing: 0.05em;
  }

  tbody tr:nth-child(even) td {
    background-color: #f8fafc;
  }

  tbody tr:hover td {
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

  .arva-section.active-recall {
    border-left-color: #4f46e5;
    background-color: #eef2ff;
  }

  .arva-section.scripts-cliniques {
    border-left-color: #0284c7;
    background-color: #f0f9ff;
  }

  .arva-section.vignette {
    border-left-color: #f59e0b;
    background-color: #fffbeb;
  }

  .arva-section.visas {
    border-left-color: #059669;
    background-color: #ecfdf5;
  }

  footer {
    height: 1.8cm;
    border-top: 1px solid #e2e8f0;
    padding: 0.5rem 0;
    font-size: 8.5pt;
    color: #64748b;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  footer .brand {
    font-weight: 600;
    color: #1d4ed8;
  }
</style>
</head>
<body>
<header>
  <div class="logo">${logoText}</div>
  <div class="meta">
    <div>${faculty} • ${date}</div>
    <div>Réf : <strong>${reference}</strong></div>
    <div>Monographie de Synthèse Clinique</div>
  </div>
</header>

<section class="title-section">
  <div class="subtitle">Synthèse Médicale Haute Précision</div>
  <h1>${title}</h1>
</section>

<article>
  ${synthesisHtml}
</article>

<footer>
  <span class="brand">${logoText} • Synthèse Médicale</span>
  <span>Document académique officiel • Diffusion restreinte</span>
</footer>
</body>
</html>`;
}

/**
 * Lance l'impression vectorielle A4 native du navigateur via le template DawJang Press
 */
export async function printDawjangPdf(
  title: string,
  content: string,
  options: DawjangTemplateOptions = {}
): Promise<void> {
  let synthesisHtml: string;
  try {
    synthesisHtml = await markdownToHtmlGfm(content);
  } catch {
    synthesisHtml = formatMedicalHtmlForPdf(content);
  }

  const fullHtml = generateDawjangHtmlFromHtml(title, synthesisHtml, options);

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    // Si popup bloqué, utiliser un iframe caché
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(fullHtml);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1500);
      }, 500);
    }
    return;
  }

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();

  // Attendre le chargement des polices web avant d'ouvrir la boîte d'impression
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 600);
}
