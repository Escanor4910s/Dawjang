// scripts/generate-pdf.js
/**
 * Script Node.js de génération PDF haute fidélité DawJang Press via Puppeteer
 *
 * Utilisation :
 *   node scripts/generate-pdf.js [chemin_fichier_markdown] [chemin_sortie_pdf]
 *
 * Exemple :
 *   node scripts/generate-pdf.js ./mon_cours.md ./mon_cours.pdf
 */

const fs = require('fs');
const path = require('path');

// Template HTML + CSS DawJang Press
function buildFullHtml(title, synthesisHtml, options = {}) {
  const {
    date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    reference = 'DWJ-2026-1657',
    faculty = 'Faculté de Médecine',
    logo = 'DAWJANG PRESS'
  } = options;

  return `<!DOCTYPE html>
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
    line-height: 1.6;
    color: #1f2937;
    margin: 0;
  }
  header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3.5cm;
    border-bottom: 2px solid #e2e8f0;
    padding: 1rem 2.5cm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8fafc;
    font-weight: 600;
    color: #1e40af;
  }
  header .logo {
    font-family: 'Merriweather', Georgia, serif;
    font-size: 20pt;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #1d4ed8;
  }
  header .meta {
    text-align: right;
    font-size: 10pt;
    line-height: 1.35;
    color: #4b5563;
  }
  header .meta strong {
    color: #1e40af;
  }
  section.title {
    margin-top: 4.5cm;
    margin-bottom: 1.75rem;
    font-family: 'Merriweather', Georgia, serif;
    font-size: 20pt;
    font-weight: 700;
    border-left: 6px solid #2563eb;
    padding-left: 1.25rem;
    color: #1e3a8a;
    line-height: 1.3;
  }
  h2 {
    font-family: 'Merriweather', Georgia, serif;
    font-weight: 700;
    font-size: 14pt;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
    border-left: 4px solid #3b82f6;
    padding-left: 0.65rem;
    color: #1d4ed8;
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
    letter-spacing: 0.08em;
    page-break-after: avoid;
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
  ul, ol {
    margin-left: 1.5rem;
    margin-bottom: 0.75rem;
  }
  li {
    margin-bottom: 0.35rem;
  }
  blockquote {
    background: #eff6ff;
    border-left: 4px solid #3b82f6;
    padding: 0.65rem 1rem;
    margin: 1rem 0;
    font-style: italic;
    color: #1e40af;
    border-radius: 4px;
    box-shadow: 0 2px 6px rgba(59, 130, 246, 0.15);
  }
  .note {
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-left: 4px solid #f59e0b;
    padding: 0.65rem 1rem;
    margin: 0.85rem 0 1.5rem 0;
    font-weight: 600;
    color: #92400e;
    border-radius: 6px;
    box-shadow: 0 2px 6px rgba(245, 158, 11, 0.15);
  }
  table {
    width: 100%;
    margin: 1.25rem 0;
    border-collapse: collapse;
    font-size: 10pt;
    border: 1px solid #cbd5e1;
    page-break-inside: avoid;
  }
  th {
    background: #f1f5f9;
    color: #1e293b;
    font-weight: 700;
    padding: 0.5rem 0.75rem;
    border: 1px solid #cbd5e1;
    text-transform: uppercase;
    font-size: 9pt;
  }
  td {
    padding: 0.5rem 0.75rem;
    border: 1px solid #cbd5e1;
  }
  footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2cm;
    border-top: 1px solid #e2e8f0;
    padding: 0.5rem 2.5cm;
    font-size: 9pt;
    color: #64748b;
    text-align: right;
  }
</style>
</head>
<body>
<header>
  <div class="logo">${logo}</div>
  <div class="meta">
    <div>${faculty} • ${date}</div>
    <div>Réf : <strong>${reference}</strong></div>
  </div>
</header>

<section class="title">${title} — Synthèse Médicale</section>

<article>
${synthesisHtml}
</article>

<footer>
  ${logo} • Synthèse Médicale • Édition Haute Précision
</footer>
</body>
</html>`;
}

async function generatePdf(synthesisHtml, options = {}) {
  const {
    path: outputPath = 'synthese.pdf',
    title = 'Synthèse Médicale',
    date = new Date().toLocaleDateString('fr-FR'),
    reference = 'DWJ-2026-1657'
  } = options;

  const fullHtml = buildFullHtml(title, synthesisHtml, { date, reference });

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (err) {
    // Si Puppeteer n'est pas encore installé dans l'environnement Node local
    const htmlPath = outputPath.replace(/\.pdf$/i, '.html');
    fs.writeFileSync(htmlPath, fullHtml, 'utf8');
    console.log(`\n[INFO] Puppeteer n'est pas installé dans cet environnement Node.`);
    console.log(`       Le fichier HTML prêt à imprimer a été généré : ${path.resolve(htmlPath)}`);
    console.log(`       Pour générer le PDF directement via Chromium headless, exécutez :`);
    console.log(`       npm install puppeteer\n`);
    return htmlPath;
  }

  console.log(`[INFO] Lancement de Puppeteer Chromium...`);
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '3.5cm', right: '2.5cm', bottom: '3cm', left: '2.5cm' }
  });

  await browser.close();
  console.log(`[SUCCÈS] PDF généré avec succès : ${path.resolve(outputPath)}`);
  return outputPath;
}

// Démonstration CLI
if (require.main === module) {
  const sampleContent = `
    <h2>1. Définir les formes d'insuffisance cardiaque</h2>
    <p>L'insuffisance cardiaque (IC) se définit par l'incapacité du muscle cardiaque à assurer un débit sanguin suffisant pour subvenir aux besoins métaboliques de l'organisme, ou par le fait qu'il n'y parvient qu'au prix d'une élévation anormale des pressions de remplissage ventriculaires.</p>
    <div class="note">⚠️ <strong>Piège QCM :</strong> Une FEVG normale n'élimine jamais le diagnostic d'insuffisance cardiaque (IC à fraction d'éjection préservée = HFpEF).</div>
    <h2>2. Stratégie thérapeutique des 4 piliers</h2>
    <p>La prise en charge médicamenteuse de l'IC à FEVG réduite repose sur l'association systématique et précoce des quatre classes de niveau IA :</p>
    <ul>
      <li><strong>Inhibiteurs de SGLT2 (Dapagliflozine ou Empagliflozine)</strong> : Réduction de la mortalité cardiovasculaire dès J28.</li>
      <li><strong>ARNI (Sacubitril/Valsartan)</strong> : Remplacement préférentiel de l'IEC.</li>
      <li><strong>Bêta-bloquants cardioselectifs</strong> : Bisoprolol, Carvedilol ou Metoprolol succinate.</li>
      <li><strong>Antagonistes des récepteurs des minéralocorticoïdes (MRA)</strong> : Spironolactone ou Éplérénone.</li>
    </ul>
    <blockquote>✓ <strong>Règle d'Or :</strong> Titrer les posologies toutes les 2 à 4 semaines jusqu'aux doses cibles validées dans les essais cliniques.</blockquote>
  `;

  generatePdf(sampleContent, {
    path: path.join(__dirname, '../dist/synthese_dawjang_demo.pdf'),
    title: '7_PATHOLOGIES HP',
    date: '26 octobre 2026',
    reference: 'DWJ-2026-1657',
  }).catch(console.error);
}

module.exports = {
  generatePdf,
  buildFullHtml
};
