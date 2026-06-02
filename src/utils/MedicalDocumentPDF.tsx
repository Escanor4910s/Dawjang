import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// ─── 2. RÈGLES DE DESIGN STRICTES ───
const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 50,
    backgroundColor: '#FFFFFF',
  },
  // L'En-tête de la page (Répété sur chaque page)
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
    marginBottom: 30,
  },
  headerText: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  // Le Titre du Document
  documentTitle: {
    fontFamily: 'Times-Roman',
    fontSize: 24,
    color: '#0F172A',
    marginBottom: 8,
    lineHeight: 1.3,
  },
  documentMeta: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#64748B',
    marginBottom: 30,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Typographie du Contenu
  h1: {
    fontFamily: 'Times-Roman',
    fontSize: 16,
    color: '#0F172A',
    marginTop: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 4,
  },
  h2: {
    fontFamily: 'Times-Roman',
    fontSize: 14,
    color: '#334155',
    marginTop: 15,
    marginBottom: 8,
  },
  paragraph: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#334155',
    lineHeight: 1.6,
    marginBottom: 8,
    textAlign: 'justify',
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },
  // Puces et Listes
  listItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 10,
  },
  bullet: {
    width: 15,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#64748B',
  },
  listText: {
    flex: 1,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#334155',
    lineHeight: 1.6,
  },
  // Le Pied de page (Numérotation)
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  footerText: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#94A3B8',
  }
});

// ─── 3. LE PARSEUR SÉMANTIQUE DE TEXTE ───
// Cette fonction lit ton texte IA et génère de vrais composants PDF vectoriels.
const parseContent = (content: string) => {
  const lines = content.split('\n');
  
  return lines.map((line, index) => {
    const text = line.trim();
    if (!text) return <View key={index} style={{ height: 10 }} />;

    // Gestion du texte en GRAS (**texte**)
    const renderTextWithBold = (rawText: string) => {
      // Découpe le texte par blocs de **
      const parts = rawText.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <Text key={i} style={styles.bold}>{part.slice(2, -2)}</Text>;
        }
        return <Text key={i}>{part}</Text>;
      });
    };

    // Titre de Niveau 1 (=== Titre === ou # Titre)
    if (/^===\s*(.+?)\s*===$/.test(text) || /^#\s+(.+)$/.test(text)) {
      const cleanTitle = text.replace(/^===\s*/, "").replace(/\s*===$/, "").replace(/^#\s+/, "");
      // wrap={false} = NE JAMAIS couper le titre en fin de page (Veuve/Orpheline)
      return <Text key={index} style={styles.h1} wrap={false}>{cleanTitle}</Text>;
    }

    // Titre de Niveau 2 (-- Titre -- ou ## Titre)
    if (/^--\s*(.+?)\s*--$/.test(text) || /^##\s+(.+)$/.test(text)) {
      const cleanTitle = text.replace(/^--\s*/, "").replace(/\s*--$/, "").replace(/^##\s+/, "");
      return <Text key={index} style={styles.h2} wrap={false}>{cleanTitle}</Text>;
    }

    // Puces (- Puce ou * Puce)
    if (/^[\-\*]\s/.test(text)) {
      const cleanList = text.replace(/^[\-\*]\s/, "");
      return (
        <View key={index} style={styles.listItem} wrap={false}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>{renderTextWithBold(cleanList)}</Text>
        </View>
      );
    }

    // Paragraphe classique
    return (
      <Text key={index} style={styles.paragraph}>
        {renderTextWithBold(text)}
      </Text>
    );
  });
};

// ─── 4. LE DOCUMENT PDF FINAL ───
interface MedicalDocumentProps {
  title: string;
  content: string;
  date: string;
  type: string;
}

export const MedicalDocumentPDF = ({ title, content, date, type }: MedicalDocumentProps) => (
  <Document author="Hippocampus" title={title}>
    <Page size="A4" style={styles.page}>
      
      {/* HEADER : Répété sur chaque page (fixed=true) */}
      <View style={styles.header} fixed>
        <Text style={styles.headerText}>HIPPOCAMPUS — ARCHIVE CLINIQUE</Text>
        <Text style={styles.headerText}>{type}</Text>
      </View>

      {/* TITRE DU DOCUMENT */}
      <View>
        <Text style={styles.documentTitle}>{title}</Text>
        <Text style={styles.documentMeta}>GÉNÉRÉ LE {date} • CONFIDENTIEL MÉDICAL</Text>
      </View>

      {/* CONTENU ALGORITHMIQUE */}
      <View>
        {parseContent(content)}
      </View>

      {/* FOOTER : Répété sur chaque page avec numérotation automatique */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>Hippocampus 2026 — Ne pas distribuer sans autorisation.</Text>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => (
          `PAGE ${pageNumber} / ${totalPages}`
        )} />
      </View>

    </Page>
  </Document>
);
