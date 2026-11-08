// scripts/pdf-server.mjs
/**
 * Serveur HTTP Microservice dédié à la génération de PDF Haut de Gamme
 * Moteur : remark + remark-html + Puppeteer
 * Usage : node scripts/pdf-server.mjs
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;

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
 * Convertit le Markdown en HTML avec support GFM complet (tables) et mise en valeur docimologique
 */
export async function markdownToStyledHtml(markdown) {
  const { remark } = await import('remark');
  const { default: html } = await import('remark-html');
  const { default: gfm } = await import('remark-gfm');

  const processed = await remark()
    .use(gfm)
    .use(html, { sanitize: false })
    .process(markdown || '');

  let rawHtml = processed.toString();

  // Traitement docimologique des alertes et règles
  rawHtml = rawHtml.replace(
    /<blockquote>\s*<p>(?:\[V\]\s*)?(?:⚠️\s*)?(?:Piège(?:\s+clinique|\s+QCM)?\s*:\s*)?(.*?)<\/p>\s*<\/blockquote>/gis,
    '<div class="note">⚠️ <strong>Piège QCM :</strong> $1</div>'
  );

  rawHtml = rawHtml.replace(
    /<blockquote>\s*<p>(?:✓|Règle d'or\s*:)\s*(.*?)<\/p>\s*<\/blockquote>/gis,
    '<blockquote>✓ <strong>Règle d\'Or :</strong> $1</blockquote>'
  );

  return structureArvaHtmlSections(rawHtml);
}

/**
 * Assemble le template HTML DawJang Press A4
 */
export function buildDawjangHtml({ htmlContent, title, date, ref }) {
  const displayTitle = title || 'Synthèse Médicale';
  const displayDate = date || new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const displayRef = ref || `DWJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${displayTitle}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap');
    @page {
      size: A4;
      margin: 3.5cm 2.5cm 3cm 2.5cm;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
      bottom: 0;
      left: 0;
      right: 0;
      height: 2cm;
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
      <div>Faculté de Médecine • ${displayDate}</div>
      <div>Réf : ${displayRef}</div>
      <div>Page <span class="page-number"></span></div>
    </div>
  </header>

  <section class="title">${displayTitle}</section>

  <article>${htmlContent}</article>

  <footer>
    <span>Hippocampus • DawJang Press</span>
    <span>Synthèse Médicale • Page <span class="page-number"></span></span>
  </footer>
</body>
</html>`;
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
 * Lance Puppeteer pour transformer le template en PDF Buffer
 */
export async function renderPdfBuffer(htmlString) {
  const puppeteer = (await import('puppeteer')).default;
  const launchOptions = getBrowserLaunchOptions();
  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setContent(htmlString, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '3.5cm', right: '2.5cm', bottom: '3cm', left: '2.5cm' },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

/**
 * Création du serveur HTTP
 */
const server = http.createServer(async (req, res) => {
  // En-têtes CORS universels pour React et requêtes externes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Route Health Check
  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    let puppeteerAvailable = false;
    try {
      await import('puppeteer');
      puppeteerAvailable = true;
    } catch {}

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'Hippocampus DawJang PDF Microservice',
      version: '1.0.0',
      puppeteerInstalled: puppeteerAvailable,
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // Route Génération PDF POST
  if (req.method === 'POST' && url.pathname === '/api/generate-pdf') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { markdown, title, date, ref } = payload;

        if (!markdown || !markdown.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Le champ "markdown" est obligatoire.' }));
          return;
        }

        const htmlContent = await markdownToStyledHtml(markdown);
        const fullHtml = buildDawjangHtml({ htmlContent, title, date, ref });

        // Vérifier si Puppeteer est disponible
        let isPuppeteerReady = false;
        try {
          await import('puppeteer');
          isPuppeteerReady = true;
        } catch {}

        if (!isPuppeteerReady) {
          // Fallback : renvoie le HTML prêt pour impression si Puppeteer n'est pas encore installé
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Fallback': 'true',
          });
          res.end(fullHtml);
          return;
        }

        const pdfBuffer = await renderPdfBuffer(fullHtml);
        const safeTitle = (title || 'Synthese_Medicale')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9_-]+/g, '_')
          .substring(0, 48);

        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="DawJang_${safeTitle}.pdf"`,
          'Content-Length': pdfBuffer.length,
        });
        res.end(pdfBuffer);
      } catch (err) {
        console.error('Erreur lors de la génération du PDF :', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erreur interne du serveur lors de la compilation du PDF.', details: err.message }));
      }
    });
    return;
  }

  // 404 par défaut
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Route introuvable' }));
});

export function startServer(port = PORT) {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 Serveur PDF DawJang Press opérationnel sur http://localhost:${port}`);
      console.log(`📌 Route POST : http://localhost:${port}/api/generate-pdf`);
      console.log(`📌 Route GET  : http://localhost:${port}/health`);
      console.log(`======================================================\n`);
      resolve(server);
    });
  });
}

// Démarrage automatique si exécuté directement
if (process.argv[1] && process.argv[1].endsWith('pdf-server.mjs')) {
  startServer();
}
