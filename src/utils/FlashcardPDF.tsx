import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  PDF_THEMES,
  PdfFontMode,
  PdfThemeKey,
  sanitizePdfText,
} from "./MedicalDocumentPDF";

export interface FlashcardData {
  question: string;
  answer: string;
  courseName?: string;
}

export const FlashcardPDF = ({
  cards,
  title = "Carnet de Mémorisation Active",
  theme = "dawjang",
  fontMode = "serif",
}: {
  cards: FlashcardData[];
  title?: string;
  theme?: PdfThemeKey;
  fontMode?: PdfFontMode;
}) => {
  const palette = PDF_THEMES[theme] || PDF_THEMES.dawjang;
  const bodyFont = fontMode === "serif" ? "Times-Roman" : "Helvetica";
  const bodyBold = fontMode === "serif" ? "Times-Bold" : "Helvetica-Bold";
  const cleanTitle = sanitizePdfText(title);

  const formattedDate = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const styles = StyleSheet.create({
    page: {
      paddingTop: 38,
      paddingBottom: 38,
      paddingHorizontal: 36,
      backgroundColor: "#FFFFFF",
      fontFamily: bodyFont,
      color: palette.textMain,
    },
    runningHeader: {
      position: "absolute",
      top: 14,
      left: 36,
      right: 36,
      paddingBottom: 4,
      borderBottomWidth: 0.8,
      borderBottomColor: palette.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    runningBrand: {
      fontFamily: "Helvetica-Bold",
      fontSize: 7.5,
      color: palette.primary,
      letterSpacing: 1.3,
      textTransform: "uppercase",
    },
    runningRight: {
      fontFamily: "Courier-Bold",
      fontSize: 7.5,
      color: palette.accent,
    },
    masthead: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      borderRadius: 4,
      marginBottom: 14,
      overflow: "hidden",
    },
    topRule: {
      height: 4,
      backgroundColor: palette.primary,
    },
    accentRule: {
      height: 2,
      backgroundColor: palette.accent,
    },
    mastheadInner: {
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    mastheadRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 5,
    },
    pill: {
      backgroundColor: palette.accent,
      paddingVertical: 2,
      paddingHorizontal: 7,
      borderRadius: 2,
    },
    pillText: {
      fontFamily: "Helvetica-Bold",
      fontSize: 7,
      color: "#FFFFFF",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    dateText: {
      fontFamily: "Courier-Bold",
      fontSize: 7.5,
      color: palette.primary,
    },
    docTitle: {
      fontFamily: "Times-Bold",
      fontSize: 19,
      color: palette.primary,
      lineHeight: 1.2,
    },
    cardRow: {
      flexDirection: "row",
      borderWidth: 0.75,
      borderColor: palette.border,
      borderRadius: 3,
      marginBottom: 5.5,
    },
    leftCol: {
      width: "38%",
      backgroundColor: palette.surface,
      paddingVertical: 6,
      paddingHorizontal: 9,
      borderRightWidth: 1,
      borderRightColor: palette.border,
    },
    rightCol: {
      width: "62%",
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderLeftWidth: 2.5,
      borderLeftColor: palette.accent,
    },
    cardIndex: {
      fontFamily: "Courier-Bold",
      fontSize: 7.5,
      color: palette.accent,
      marginBottom: 3,
    },
    questionText: {
      fontFamily: bodyBold,
      fontSize: 10,
      color: palette.primary,
      lineHeight: 1.38,
    },
    courseTag: {
      fontFamily: "Helvetica",
      fontSize: 7.5,
      color: palette.textMuted,
      marginTop: 4,
    },
    answerLabel: {
      fontFamily: "Helvetica-Bold",
      fontSize: 6.5,
      color: palette.textMuted,
      letterSpacing: 0.9,
      textTransform: "uppercase",
      marginBottom: 2,
    },
    answerText: {
      fontFamily: bodyFont,
      fontSize: 9.8,
      color: palette.textMain,
      lineHeight: 1.48,
    },
    runningFooter: {
      position: "absolute",
      bottom: 14,
      left: 36,
      right: 36,
      borderTopWidth: 0.8,
      borderTopColor: palette.border,
      paddingTop: 4,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    footerLeft: {
      fontFamily: "Helvetica",
      fontSize: 7.5,
      color: palette.textMuted,
    },
    folioPill: {
      backgroundColor: palette.primary,
      paddingVertical: 2,
      paddingHorizontal: 7,
      borderRadius: 2,
    },
    folioText: {
      fontFamily: "Courier-Bold",
      fontSize: 7.5,
      color: "#FFFFFF",
    },
  });

  return (
    <Document
      author="DawJang Studio"
      title={cleanTitle}
      creator="DawJang Studio — Mémorisation Active"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.runningHeader} fixed>
          <Text style={styles.runningBrand}>
            DAWJANG PRESS • CARNET DE MÉMORISATION ACTIVE (FSRS)
          </Text>
          <Text style={styles.runningRight}>{cards.length} FICHES</Text>
        </View>

        <View style={styles.masthead}>
          <View style={styles.topRule} />
          <View style={styles.accentRule} />
          <View style={styles.mastheadInner}>
            <View style={styles.mastheadRow}>
              <View style={styles.pill}>
                <Text style={styles.pillText}>
                  RÉVISION ACTIVE RECTO / VERSO • {cards.length} CARTES
                </Text>
              </View>
              <Text style={styles.dateText}>{formattedDate.toUpperCase()}</Text>
            </View>
            <Text style={styles.docTitle}>{cleanTitle}</Text>
          </View>
        </View>

        {cards.map((card, index) => (
          <View key={index} style={styles.cardRow} wrap minPresenceAhead={36}>
            <View style={styles.leftCol}>
              <Text style={styles.cardIndex}>
                FICHE #{String(index + 1).padStart(2, "0")} • QUESTION
              </Text>
              <Text style={styles.questionText}>
                {sanitizePdfText(card.question)}
              </Text>
              {card.courseName && (
                <Text style={styles.courseTag}>
                  {sanitizePdfText(card.courseName)}
                </Text>
              )}
            </View>
            <View style={styles.rightCol}>
              <Text style={styles.answerLabel}>RÉPONSE CERTIFIÉE DU COURS</Text>
              <Text style={styles.answerText}>
                {sanitizePdfText(card.answer)}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.runningFooter} fixed>
          <Text style={styles.footerLeft}>
            DawJang Studio • Polycopié de Mémorisation Active ({cleanTitle})
          </Text>
          <View style={styles.folioPill}>
            <Text
              style={styles.folioText}
              render={({ pageNumber, totalPages }) =>
                `FOLIO ${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`
              }
            />
          </View>
        </View>
      </Page>
    </Document>
  );
};
