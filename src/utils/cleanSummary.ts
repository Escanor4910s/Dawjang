/**
 * Nettoyage du texte brut produit par le modèle avant mise en page.
 * Corrige ce qui fuyait dans l'ancien PDF : « ** » orphelins, « > », « --- », puces, espaces avant « : ».
 */
export type Seg = { text: string; bold?: boolean };

export const isRule = (l: string) => /^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/.test(l);

/** Retire citations, puces et marques de titre en début de ligne. */
export function cleanLine(raw: string): string {
  return raw
    .replace(/^\s*>+\s?/, '')
    .replace(/^\s*(?:[-*•·∙●◦]\s+|#{1,6}\s+)/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** « **gras** » apparié devient un segment gras ; les astérisques orphelins disparaissent. */
export function toSegments(s: string): Seg[] {
  const out: Seg[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out.map((x) => ({ ...x, text: x.text.replace(/\*+/g, '') })).filter((x) => x.text);
}

export const plain = (s: string) => toSegments(s).map((x) => x.text).join('');

/** « Libellé :Texte » devient { label, text } ; null si la ligne n'a pas ce format. */
export function splitLabel(line: string) {
  const m = plain(cleanLine(line)).match(/^([^:]{2,70}?)\s*:\s*(.+)$/);
  return m ? { label: m[1].trim(), text: m[2].trim() } : null;
}

/** Typographie française : apostrophe courbe, espace insécable avant : ; ! ? » et après «. */
export function typo(s: string) {
  return s.replace(/'/g, '’').replace(/ ([:;!?»])/g, '\u00A0$1').replace(/« /g, '«\u00A0');
}

/** Le texte s'arrête-t-il en cours de phrase ? (génération coupée) */
export const isTruncated = (s: string) => !/[.!?)…]$/.test(s.trim());

/** Numéros d'objectifs attendus mais absents du résumé. */
export const missing = (found: number[], total: number) =>
  Array.from({ length: total }, (_, i) => i + 1).filter((n) => !found.includes(n));
