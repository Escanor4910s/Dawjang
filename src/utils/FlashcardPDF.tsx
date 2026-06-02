import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 50,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
    marginBottom: 20,
  },
  headerText: {
    fontSize: 10,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 10,
    color: '#111111',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Times-Roman',
    color: '#111111',
    marginBottom: 30,
    textAlign: 'center',
  },
  conceptContainer: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
  },
  conceptTitleBox: {
    width: '35%',
    paddingRight: 10,
  },
  conceptDefBox: {
    width: '65%',
    borderLeftWidth: 2,
    borderLeftColor: '#5B21B6',
    paddingLeft: 10,
  },
  conceptTitleText: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
  },
  conceptCourse: {
    fontSize: 8,
    color: '#888888',
    marginTop: 2,
  },
  conceptDefText: {
    fontSize: 11,
    color: '#374151',
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },
  pageNumber: {
    fontSize: 9,
    color: '#9CA3AF',
  },
});

interface FlashcardData {
  question: string;
  answer: string;
  courseName?: string;
}

export const FlashcardPDF = ({ cards, title = "Fiches de Révision" }: { cards: FlashcardData[], title?: string }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.headerTitle}>HIPPOCAMPUS</Text>
            <Text style={styles.headerText}>Outil de Mémorisation Active</Text>
          </View>
          <Text style={styles.headerText}>Polycopié de Fiches</Text>
        </View>

        <Text style={styles.title}>{title.toUpperCase()}</Text>

        {cards.map((card, index) => (
          <View key={index} style={styles.conceptContainer} wrap={false}>
            <View style={styles.conceptTitleBox}>
              <Text style={styles.conceptTitleText}>{card.question}</Text>
              {card.courseName && (
                <Text style={styles.conceptCourse}>{card.courseName}</Text>
              )}
            </View>
            <View style={styles.conceptDefBox}>
              <Text style={styles.conceptDefText}>{card.answer}</Text>
            </View>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text style={styles.pageNumber}>
            Hippocampus - AI Medical Learning
          </Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
            `Page ${pageNumber} / ${totalPages}`
          )} />
        </View>
      </Page>
    </Document>
  );
};
