/**
 * ============================================================================
 * src/utils/atlasMagistralPdfExport.ts
 * MOTEUR D'EXPORT PDF A4 & FILIGRANES DU « MODE ATLAS MAGISTRAL »
 * ============================================================================
 * Reproduit à l'identique le PDF du Résumé Magistral (fond parchemin #FAF8F5,
 * cartes blanches #FFFFFF, bandeau supérieur terracotta #C96442, badges de
 * diapositives, tableaux .course-table et filigranes de pied de page DawJang).
 */

import type { AtlasMagistralSummary } from "@/lib/atlasMagistralEngine";

/**
 * Construit le document HTML A4 hermétique prêt pour l'impression PDF vectorielle
 * (navigateur window.print() ou Chromium Page.printToPDF).
 */
export function buildAtlasMagistralPdfHtml(course: AtlasMagistralSummary): string {
  const chaptersHtml = course.chapters
    .map((ch) => {
      const blocksHtml = ch.blocks
        .map((blk, idx) => {
          const divider = idx > 0 ? '<hr class="block-divider" />' : "";
          return `
            ${divider}
            <div class="slide-block">
              <div class="slide-block-header">
                <span class="slide-badge">${blk.slideBadge}</span>
                <h3>${blk.heading}</h3>
              </div>
              <div class="slide-block-body">
                ${blk.body}
              </div>
            </div>
          `;
        })
        .join("");

      return `
        <section class="chapter-card">
          <div class="chapter-header">
            <span class="chapter-num">${ch.num}</span>
            <div class="chapter-titles">
              <h2>${ch.title}</h2>
              <div class="chapter-sub">${ch.slides} • ${course.author}</div>
            </div>
          </div>
          <div class="chapter-content">
            ${blocksHtml}
          </div>
        </section>
      `;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Résumé Magistral — ${course.title}</title>
  <style>
    :root {
      --bg: #FAF8F5;
      --card: #FFFFFF;
      --primary: #C96442;
      --primary-soft: #F9EBE5;
      --secondary: #F2EDE4;
      --text: #181614;
      --muted: #5C574F;
      --border: #E2DDD3;
      --rose: #BE3428;
    }

    @page {
      size: A4;
      margin: 14mm 14mm 16mm 14mm;
      background: var(--bg);
      @bottom-right {
        content: "Page " counter(page) " / " counter(pages);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 9pt;
        color: var(--muted);
      }
      @bottom-left {
        content: "DawJang Studio Académique • ${course.title.replace(/"/g, "'")}";
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 9pt;
        color: var(--muted);
      }
    }

    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10.5pt;
      line-height: 1.5;
    }

    main.document-flow {
      width: 100%;
    }

    /* Bandeau d'en-tête éditorial DawJang */
    .doc-banner {
      background: var(--card);
      border: 1px solid var(--border);
      border-top: 4px solid var(--primary);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 16px;
    }
    .doc-kicker {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--primary);
      margin-bottom: 4px;
    }
    h1 {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 20pt;
      font-weight: 700;
      color: var(--text);
      margin: 0 0 6px 0;
      line-height: 1.2;
    }
    .doc-meta {
      font-size: 10pt;
      color: var(--muted);
      margin: 0;
    }

    /* Cartes de chapitres */
    .chapter-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 18px;
      margin-bottom: 14px;
      page-break-inside: auto;
      break-inside: auto;
    }
    .chapter-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 10px;
      margin-bottom: 12px;
      border-bottom: 1.5px solid var(--border);
      page-break-after: avoid;
      break-after: avoid;
    }
    .chapter-num {
      background: var(--text);
      color: #FFFFFF;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10pt;
      font-weight: 700;
      min-width: 28px;
      height: 28px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    h2 {
      font-size: 13.5pt;
      font-weight: 700;
      color: var(--text);
      margin: 0;
      line-height: 1.25;
    }
    .chapter-sub {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9pt;
      color: var(--muted);
      margin-top: 2px;
    }

    .slide-block {
      margin-bottom: 10px;
    }
    .slide-block-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      page-break-after: avoid;
      break-after: avoid;
    }
    .slide-badge {
      background: var(--primary-soft);
      color: var(--primary);
      border: 1px solid rgba(201, 100, 66, 0.3);
      font-family: 'JetBrains Mono', monospace;
      font-size: 9pt;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 5px;
      flex-shrink: 0;
    }
    h3 {
      font-size: 11pt;
      font-weight: 700;
      color: var(--text);
      margin: 0;
      line-height: 1.3;
    }

    .block-divider {
      border: none;
      border-top: 1px solid var(--border);
      margin: 12px 0;
    }

    p {
      margin: 0 0 8px 0;
      font-size: 10.5pt;
    }
    ul {
      list-style: none;
      margin: 0 0 8px 0;
      padding-left: 2px;
      font-size: 10.5pt;
    }
    ol {
      margin: 0 0 8px 0;
      padding-left: 18px;
      font-size: 10.5pt;
    }
    li {
      margin-bottom: 4px;
    }

    .grid {
      display: grid;
      gap: 10px;
      margin-bottom: 8px;
    }
    .md\\:grid-cols-2, .sm\\:grid-cols-2 {
      grid-template-columns: repeat(2, 1fr);
    }
    .md\\:grid-cols-3 {
      grid-template-columns: repeat(3, 1fr);
    }
    .p-3\\.5, .p-4 {
      background: var(--secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .bg-primary\\/8 {
      background: var(--primary-soft);
      border: 1px solid rgba(201, 100, 66, 0.35);
    }
    .font-semibold, strong {
      font-weight: 700;
    }
    .font-mono-metric {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10pt;
    }
    .text-primary {
      color: var(--primary);
    }
    .text-rose-600 {
      color: var(--rose);
    }
    .text-muted-foreground {
      color: var(--muted);
    }
    .flex {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      margin-bottom: 10px;
    }
    .px-2\\.5 {
      background: var(--secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 10pt;
    }

    .overflow-hidden {
      margin: 8px 0 10px 0;
    }
    table.course-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--border);
    }
    table.course-table tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    table.course-table th {
      background: var(--secondary);
      color: var(--text);
      font-size: 10pt;
      font-weight: 700;
      text-align: left;
      padding: 7px 10px;
      border-bottom: 1.5px solid var(--border);
    }
    table.course-table td {
      padding: 7px 10px;
      font-size: 10pt;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      line-height: 1.45;
    }
    table.course-table tbody tr:nth-child(even) {
      background: #FCFBF9;
    }
  </style>
</head>
<body>
  <main class="document-flow">
    <header class="doc-banner">
      <div class="doc-kicker">DawJang • Mode Atlas Magistral (${course.tag})</div>
      <h1>${course.title}</h1>
      <p class="doc-meta">${course.author} • Édition du ${course.updatedAt}</p>
    </header>
    ${chaptersHtml}
  </main>
</body>
</html>`;
}

/**
 * Déclenche l'export PDF A4 haute résolution dans le navigateur (avec prise en charge
 * des couleurs de fond, des tableaux .course-table et des filigranes de pied de page).
 */
export function exportAtlasMagistralToPDF(course: AtlasMagistralSummary): void {
  const fullHtml = buildAtlasMagistralPdfHtml(course);

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
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 450);
  }
}
