/**
 * DawJang Press : résumé de cours en PDF (react-pdf).
 *
 *   registerFonts('/fonts');
 *   <PDFViewer><MonographPDF data={data} logo="/dawjang-mark.png" /></PDFViewer>
 *
 * Les données doivent être propres (voir cleanSummary.ts). Le plus fiable : demander au modèle
 * un JSON qui respecte les types ci-dessous, au lieu de markdown.
 */
import React from 'react';
import { Document, Page, View, Text, Link, Image, Svg, Path, Line, Rect, Circle, Font, StyleSheet } from '@react-pdf/renderer';
import { typo } from '@/utils/cleanSummary';

export type Block =
  | { k: 'p'; text: string }
  | { k: 'warn'; text: string }
  | { k: 'scale'; caption: string; marks: { label: string; value: number }[] }
  | { k: 'branches'; items: { title: string; kind: string; retic: string; dir: 'up' | 'down'; lines: string[] }[] }
  | { k: 'rows'; rows: { label: string; text: string }[] }
  | { k: 'gap'; title: string; text: string; fragments?: string[] };

export type Objective = { n: number; title: string; blocks: Block[] };

export type Monograph = {
  title: string;
  discipline: string;
  faculty: string;
  date: string;
  ref: string;
  owner: string;
  readingMinutes: number;
  objectives: Objective[];
  readingPasses: { name: string; goal: string }[];
};

let fontsRegistered = false;

export function registerFonts(base = '/fonts') {
  if (fontsRegistered) return;
  try {
    Font.register({
      family: 'Caladea',
      fonts: [
        { src: `${base}/Caladea-Regular.ttf` },
        { src: `${base}/Caladea-Bold.ttf`, fontWeight: 700 },
        { src: `${base}/Caladea-Italic.ttf`, fontStyle: 'italic' },
        { src: `${base}/Caladea-BoldItalic.ttf`, fontWeight: 700, fontStyle: 'italic' },
      ],
    });
    Font.register({
      family: 'Carlito',
      fonts: [
        { src: `${base}/Carlito-Regular.ttf` },
        { src: `${base}/Carlito-Bold.ttf`, fontWeight: 700 },
      ],
    });
    // Pas de césure automatique : l'ancienne version coupait « Verba-tim », « insuff-isance ».
    Font.registerHyphenationCallback((w) => [w]);
    fontsRegistered = true;
  } catch (err) {
    console.warn('[MonographPDF] Font registration fallback:', err);
  }
}

const C = {
  ink: '#1E1A2E',
  violet: '#3F3590',
  wash: '#ECEAF7',
  red: '#B32A3C',
  redWash: '#FBE8EA',
  muted: '#6A667E',
  rule: '#DAD7E8',
};

const PAGE_X = 54;
const RAIL = 64;
const W = 595.28 - 2 * PAGE_X - RAIL;
const T = { fontFamily: 'Caladea', fontSize: 11.5, lineHeight: 1.5, color: C.ink } as const;

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 78, paddingHorizontal: PAGE_X, backgroundColor: '#FFFFFF' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { flexDirection: 'row', alignItems: 'center' },
  brandName: { fontWeight: 700, fontSize: 12.5, marginLeft: 8, lineHeight: 1 },
  topMeta: { fontFamily: 'Carlito', fontSize: 10, color: C.muted, textAlign: 'right', lineHeight: 1.35 },
  title: { fontWeight: 700, fontSize: 42, lineHeight: 1.05, letterSpacing: -0.6, marginTop: 32 },
  lede: { fontFamily: 'Carlito', fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.4, maxWidth: 360 },
  plan: { marginTop: 26, marginBottom: 32, borderTopWidth: 1, borderTopColor: C.rule },
  planLabel: { fontFamily: 'Carlito', fontWeight: 700, fontSize: 10, color: C.muted, marginTop: 10, marginBottom: 4 },
  planRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5.5, borderBottomWidth: 1, borderBottomColor: C.rule },
  planNum: { width: 28, fontWeight: 700, fontSize: 13, lineHeight: 1.3, color: C.violet },
  planText: { flex: 1, fontSize: 12, lineHeight: 1.3 },
  obj: { marginBottom: 28 },
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  num: { width: RAIL, fontWeight: 700, fontSize: 34, lineHeight: 1, color: C.violet },
  h2: { flex: 1, fontWeight: 700, fontSize: 17, lineHeight: 1.2, paddingTop: 3 },
  indent: { marginLeft: RAIL },
  p: { marginBottom: 8 },
  dose: { fontWeight: 700, color: C.violet, backgroundColor: C.wash },
  danger: { fontWeight: 700, color: C.red },
  warn: { backgroundColor: C.redWash, borderLeftWidth: 3, borderLeftColor: C.red, paddingVertical: 8, paddingHorizontal: 12, marginTop: 6, marginBottom: 8 },
  warnLead: { fontWeight: 700, color: C.red },
  cap: { fontFamily: 'Carlito', fontSize: 10, color: C.muted, lineHeight: 1.2 },
  mark: { position: 'absolute', width: 84, alignItems: 'center' },
  markVal: { fontFamily: 'Carlito', fontWeight: 700, fontSize: 14, lineHeight: 1.1 },
  markLabel: { fontFamily: 'Carlito', fontSize: 10, lineHeight: 1.25, textAlign: 'center', marginTop: 2 },
  branches: { flexDirection: 'row', marginTop: 4, marginBottom: 8 },
  branch: { flex: 1, borderTopWidth: 2.5, borderTopColor: C.violet, paddingTop: 8, paddingRight: 8 },
  bTitle: { fontWeight: 700, fontSize: 13, lineHeight: 1.2 },
  bKind: { fontStyle: 'italic', color: C.muted, fontSize: 11, lineHeight: 1.2, marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.redWash, paddingVertical: 4, paddingHorizontal: 8, marginBottom: 8, alignSelf: 'flex-start' },
  chipText: { fontFamily: 'Carlito', fontWeight: 700, fontSize: 10.5, lineHeight: 1.2, color: C.red, marginLeft: 6 },
  bullet: { flexDirection: 'row', marginBottom: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.violet, marginTop: 7, marginRight: 7 },
  bText: { flex: 1, fontSize: 11, lineHeight: 1.4 },
  row: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.rule },
  rowLabel: { width: 116, fontFamily: 'Carlito', fontWeight: 700, fontSize: 10.5, lineHeight: 1.35, color: C.violet, paddingRight: 12, paddingTop: 2 },
  rowText: { flex: 1 },
  gap: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.muted, padding: 12, marginTop: 8, marginBottom: 8 },
  gapTitle: { fontFamily: 'Carlito', fontWeight: 700, fontSize: 11, color: C.red, lineHeight: 1.3 },
  gapText: { fontSize: 11, color: C.muted, lineHeight: 1.4, marginTop: 2 },
  frag: { fontStyle: 'italic', fontSize: 11, color: C.muted, lineHeight: 1.4, marginTop: 6 },
  visa: { marginTop: 8, paddingTop: 18, borderTopWidth: 1.5, borderTopColor: C.violet },
  pass: { flexDirection: 'row', alignItems: 'center', marginTop: 9 },
  passName: { fontWeight: 700, fontSize: 11.5 },
  passGoal: { color: C.muted, fontSize: 11.5 },
  notes: { fontFamily: 'Carlito', fontWeight: 700, fontSize: 10, color: C.muted, marginTop: 20 },
  noteLine: { height: 24, borderBottomWidth: 0.75, borderBottomColor: C.rule },
  owner: { fontFamily: 'Carlito', fontSize: 10, color: C.muted, marginTop: 14 },
  footer: { position: 'absolute', left: PAGE_X, right: PAGE_X, bottom: 28, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.rule, paddingTop: 8 },
  foot: { fontFamily: 'Carlito', fontSize: 9, color: C.muted, lineHeight: 1.2 },
});

// Doses (violet) et « contre-indiqué » (rouge) ressortent pour une relecture rapide.
const MARK = /(\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+(?:[.,]\d+)?)?\s?(?:mg|[µμ]g|g)(?:\/(?:kg|j|mois|3j|dl))?)|(contre-indiqué(?:e|s|es)?)/gi;

function Rich({ text, style }: { text: string; style?: any }) {
  const parts = typo(text).split(MARK);
  return (
    <Text style={[T, style]}>
      {parts.map((p, i) =>
        !p ? null : i % 3 === 1 ? <Text key={i} style={s.dose}>{p}</Text> : i % 3 === 2 ? <Text key={i} style={s.danger}>{p}</Text> : p
      )}
    </Text>
  );
}

function Scale({ b }: { b: Extract<Block, { k: 'scale' }> }) {
  const H = 106, padX = 22, y = 50;
  const vals = b.marks.map((m) => m.value);
  const min = Math.floor(Math.min(...vals)) - 1;
  const max = Math.ceil(Math.max(...vals)) + 1;
  const x = (v: number) => padX + ((v - min) / (max - min)) * (W - 2 * padX);
  const marks = [...b.marks].sort((a, c) => a.value - c.value);
  const lo = x(min);
  return (
    <View wrap={false} style={{ width: W, height: H, marginTop: 6, marginBottom: 8 }}>
      <Text style={[s.cap, { position: 'absolute', left: padX - 4, top: 0 }]}>{b.caption}</Text>
      <Svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Rect x={lo} y={y} width={x(max) - lo} height={8} rx={4} fill={C.wash} />
        <Rect x={lo} y={y} width={x(marks[marks.length - 1].value) - lo} height={8} rx={4} fill={C.redWash} />
        {marks.map((m) => (
          <Line key={m.label} x1={x(m.value)} x2={x(m.value)} y1={y - 10} y2={y + 18} stroke={C.red} strokeWidth={1.6} />
        ))}
      </Svg>
      {marks.map((m) => (
        <View key={m.label} style={[s.mark, { left: x(m.value) - 42, top: 22 }]}>
          <Text style={s.markVal}>{`<\u00A0${m.value}`}</Text>
        </View>
      ))}
      {marks.map((m) => (
        <View key={m.label + 'l'} style={[s.mark, { left: x(m.value) - 42, top: y + 24 }]}>
          <Text style={s.markLabel}>{typo(m.label)}</Text>
        </View>
      ))}
    </View>
  );
}

function Branches({ b }: { b: Extract<Block, { k: 'branches' }> }) {
  return (
    <View style={s.branches} wrap={false}>
      {b.items.map((it, i) => (
        <View key={it.title} style={[s.branch, i === 0 ? { marginRight: 14 } : {}]}>
          <Text style={[T, s.bTitle]}>{it.title}</Text>
          <Text style={[T, s.bKind]}>{it.kind}</Text>
          <View style={s.chip}>
            <Svg width={8} height={8} viewBox="0 0 8 8">
              <Path d={it.dir === 'up' ? 'M4 0 L8 8 L0 8 Z' : 'M0 0 L8 0 L4 8 Z'} fill={C.red} />
            </Svg>
            <Text style={s.chipText}>{it.retic}</Text>
          </View>
          {it.lines.map((l) => (
            <View key={l} style={s.bullet}>
              <View style={s.dot} />
              <Rich text={l} style={s.bText} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function renderBlock(b: Block, i: number) {
  switch (b.k) {
    case 'p':
      return <Rich key={i} text={b.text} style={s.p} />;
    case 'warn': {
      const m = b.text.match(/^(Attention)\b([\s\S]*)$/);
      return (
        <View key={i} style={s.warn} wrap={false}>
          <Text style={[T, { fontSize: 11 }]}>{m ? [<Text key="l" style={s.warnLead}>{m[1]}</Text>, typo(m[2])] : typo(b.text)}</Text>
        </View>
      );
    }
    case 'scale':
      return <Scale key={i} b={b} />;
    case 'branches':
      return <Branches key={i} b={b} />;
    case 'rows':
      return (
        <View key={i}>
          {b.rows.map((r) => (
            <View key={r.label} style={s.row} wrap={false}>
              <Text style={[T, s.rowLabel]}>{typo(r.label)}</Text>
              <Rich text={r.text} style={s.rowText} />
            </View>
          ))}
        </View>
      );
    case 'gap':
      return (
        <View key={i} style={s.gap} wrap={false}>
          <Text style={s.gapTitle}>{b.title}</Text>
          <Text style={[T, s.gapText]}>{typo(b.text)}</Text>
          {(b.fragments ?? []).map((f) => (
            <Text key={f} style={[T, s.frag]}>{typo(f)}</Text>
          ))}
        </View>
      );
  }
}

function ObjectiveView({ o }: { o: Objective }) {
  return (
    <View style={s.obj}>
      <View id={`obj-${o.n}`} style={s.head} minPresenceAhead={90}>
        <Text style={[T, s.num]}>{o.n}</Text>
        <Text style={[T, s.h2]}>{typo(o.title)}</Text>
      </View>
      <View style={s.indent}>{o.blocks.map(renderBlock)}</View>
    </View>
  );
}

export function MonographPDF({ data: d, logo }: { data: Monograph; logo?: string }) {
  registerFonts();

  return (
    <Document title={d.title} author={d.owner} subject={d.discipline} creator="DawJang Press">
      <Page size="A4" style={s.page}>
        <View style={s.top}>
          <View style={s.brand}>
            {logo ? (
              <Image src={logo} style={{ width: 19, height: 24.5 }} />
            ) : (
              <Svg width={18} height={22} viewBox="240 160 510 660">
                <Path
                  d="M 278 268 L 446 268 L 394 344 L 394 378 C 365 424, 326 438, 278 426 Z"
                  fill={C.ink}
                />
                <Path
                  d="M 278 426 C 360 440, 420 380, 460 300 C 580 340, 680 430, 680 540 C 680 680, 540 760, 390 760 L 278 760 Z"
                  fill={C.violet}
                />
              </Svg>
            )}
            <Text style={[T, s.brandName]}>DawJang Press</Text>
          </View>
          <View>
            <Text style={s.topMeta}>{d.discipline}</Text>
            <Text style={s.topMeta}>{d.date}</Text>
          </View>
        </View>

        <Text style={[T, s.title]}>{d.title}</Text>
        <Text style={s.lede}>{`${d.faculty}. ${d.objectives.length} objectifs, environ ${d.readingMinutes} min de lecture.`}</Text>

        <View style={s.plan}>
          <Text style={s.planLabel}>Plan du résumé</Text>
          {d.objectives.map((o) => (
            <View key={o.n} style={s.planRow}>
              <Link src={`#obj-${o.n}`} style={{ textDecoration: 'none' }}><Text style={[T, s.planNum]}>{o.n}</Text></Link>
              <Link src={`#obj-${o.n}`} style={{ textDecoration: 'none', flex: 1 }}><Text style={[T, s.planText]}>{typo(o.title)}</Text></Link>
            </View>
          ))}
        </View>

        {d.objectives.map((o) => <ObjectiveView key={o.n} o={o} />)}

        <View style={s.visa} wrap={false}>
          <Text style={[T, s.h2]}>Visa de révision</Text>
          {d.readingPasses.map((r) => (
            <View key={r.name} style={s.pass}>
              <Svg width={14} height={14} style={{ marginRight: 9 }}>
                <Circle cx={7} cy={7} r={6} stroke={C.violet} strokeWidth={1.2} fill="none" />
              </Svg>
              <Text style={[T, s.passName]}>{r.name}<Text style={s.passGoal}>{`  ${typo(r.goal)}`}</Text></Text>
            </View>
          ))}
          <Text style={s.notes}>Mes notes</Text>
          {[0, 1, 2, 3, 4, 5].map((i) => <View key={i} style={s.noteLine} />)}
          <Text style={s.owner}>{`Titulaire : ${d.owner}`}</Text>
        </View>

        <View fixed style={s.footer}>
          <Text style={s.foot}>{`DawJang Press, réf. ${d.ref}`}</Text>
          <Text style={s.foot} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export default MonographPDF;
