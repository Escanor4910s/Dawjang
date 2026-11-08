// scripts/generate-valued-pdf.mjs
/**
 * Automatisation de la chaîne : Markdown -> HTML stylé -> PDF haut de gamme
 * Moteur : remark + remark-html + Puppeteer
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Découpe et encapsule sémantiquement les sections de la doctrine ARVA
 */
function structureArvaHtmlSections(htmlContent) {
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
 * Convertit du Markdown en HTML stylé pour PDF via remark, remark-gfm et remark-html
 * @param {string} markdown 
 * @returns {Promise<string>} HTML enrichi avec classes CSS prêtes à être stylées
 */
export async function markdownToStyledHtml(markdown) {
  const { remark } = await import('remark');
  const { default: html } = await import('remark-html');
  const { default: gfm } = await import('remark-gfm');

  const processed = await remark()
    .use(gfm)
    .use(html, { sanitize: false })
    .process(markdown);
  
  let rawHtml = processed.toString();

  // Détection des pièges docimologiques et conversion vers <div class="note">
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
}

/**
 * Détecte le chemin de Chromium / Chrome ou utilise les réglages Puppeteer standards
 */
export function getBrowserLaunchOptions() {
  const commonChromePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);

  let executablePath;
  for (const p of commonChromePaths) {
    try {
      if (fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    } catch {}
  }

  const options = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };

  if (executablePath) {
    options.executablePath = executablePath;
  }

  return options;
}

/**
 * Génère un PDF A4 valorisé à partir d'un Markdown donné
 * @param {Object} options
 * @param {string} options.markdown Contenu markdown
 * @param {string} options.title Titre de la synthèse
 * @param {string} [options.date] Date de l'édition
 * @param {string} [options.reference] Référence du document
 * @param {string} [options.outputPath] Chemin de sortie du PDF
 * @returns {Promise<string>} Chemin du fichier généré
 */
export async function generateValuedPdf({
  markdown,
  title = 'Synthèse Médicale',
  date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
  reference = 'DWJ-2026-1657',
  outputPath = 'output.pdf',
}) {
  const synthesisHtml = await markdownToStyledHtml(markdown);

  const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
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
    }
    header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 3.5cm;
      border-bottom: 1px solid #ccc;
      padding: 1rem 2.5cm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      font-weight: 600;
      color: #1e40af;
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
      line-height: 1.3;
    }
    section.title {
      margin-top: 4.5cm;
      margin-bottom: 1.5rem;
      font-family: 'Merriweather', serif;
      font-size: 20pt;
      font-weight: 700;
      border-left: 6px solid #3b82f6;
      padding-left: 1rem;
      color: #1e40af;
    }
    h2 {
      font-family: 'Merriweather', serif;
      font-weight: 700;
      font-size: 14pt;
      margin-top: 2rem;
      margin-bottom: 0.75rem;
      border-left: 4px solid #60a5fa;
      padding-left: 0.5rem;
      color: #2563eb;
      page-break-after: avoid;
    }
    h3 {
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: 11pt;
      text-transform: uppercase;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
      color: #2563eb;
      letter-spacing: 0.1em;
      page-break-after: avoid;
    }
    p {
      margin-bottom: 0.75rem;
      text-align: justify;
    }
    strong {
      font-weight: 700;
      color: #111;
    }
    ul, ol {
      margin-left: 1.5rem;
      margin-bottom: 0.75rem;
    }
    li {
      margin-bottom: 0.3rem;
    }
    blockquote {
      background: #e0f2fe;
      border-left: 4px solid #60a5fa;
      padding: 0.5rem 1rem;
      margin: 1rem 0;
      font-style: italic;
      color: #1e40af;
      border-radius: 4px;
      box-shadow: 0 2px 6px rgba(96, 165, 250, 0.3);
    }
    .note {
      background: #fef3c7;
      border: 1px solid #facc15;
      padding: 0.5rem 1rem;
      margin: 0.75rem 0 1.5rem 0;
      font-weight: 600;
      color: #b45309;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(250, 204, 21, 0.3);
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
      bottom: 0;
      left: 0;
      right: 0;
      height: 2cm;
      border-top: 1px solid #ccc;
      padding: 0.5rem 2.5cm;
      font-size: 9pt;
      color: #666;
      text-align: right;
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
    DawJang Press • Synthèse Médicale • Page <span class="page-number"></span>
  </footer>
</body>
</html>`;

  // Vérifier la présence de puppeteer
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch (err) {
    const htmlPath = outputPath.replace(/\.pdf$/i, '.html');
    fs.writeFileSync(htmlPath, fullHtml, 'utf8');
    console.log(`\n[INFO] Puppeteer n'est pas installé dans cet environnement Node.`);
    console.log(`       Le fichier HTML prêt pour l'impression a été généré : ${path.resolve(htmlPath)}`);
    console.log(`       Pour compiler le PDF headless : npm install puppeteer\n`);
    return htmlPath;
  }

  console.log(`[INFO] Lancement de Puppeteer Chromium headless...`);
  const launchOptions = getBrowserLaunchOptions();
  if (launchOptions.executablePath) {
    console.log(`[INFO] Navigateur local détecté : ${launchOptions.executablePath}`);
  }
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '3.5cm', right: '2.5cm', bottom: '3cm', left: '2.5cm' },
  });

  await browser.close();

  console.log(`[SUCCÈS] PDF généré avec succès : ${path.resolve(outputPath)}`);
  return outputPath;
}

// Démonstration CLI si exécuté directement
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sampleMarkdown = `
# 1. Définir les pathologies de l'hémostase primaire (PHP)

**Définition maîtresse :** Anomalie acquise ou héréditaire empêchant la formation du clou plaquettaire hémostatique.

> [V] Piège QCM : Ne pas confondre les pathologies de l'hémostase primaire avec les troubles de la coagulation plasmatique.

## Modalités de survenue

- Saignements spontanés ou provoqués par des traumatismes mineurs.
- Topographie préférentielle cutanée (purpura pétéchial ou ecchymotique) et muqueuse (épistaxis, gingivorragies, métrorragies).

### Note importante

*Toujours éliminer une fausse thrombopénie à l'EDTA par examen du frottis sanguin sur tube citraté.*
`;

  const distDir = path.join(__dirname, '../dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  generateValuedPdf({
    markdown: sampleMarkdown,
    title: '7_PATHOLOGIES HP — Synthèse Médicale',
    date: '26 octobre 2026',
    reference: 'DWJ-2026-1657',
    outputPath: path.join(distDir, '7_PATHOLOGIES_HP_Valued.pdf'),
  }).catch(console.error);
}
