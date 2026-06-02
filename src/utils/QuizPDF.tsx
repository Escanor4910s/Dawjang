import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

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
  logo: {
    width: 60,
    height: 15,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Times-Roman',
    color: '#111111',
    marginBottom: 30,
    textAlign: 'center',
  },
  questionContainer: {
    marginBottom: 25,
    paddingBottom: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  questionText: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    marginBottom: 10,
  },
  optionsList: {
    marginLeft: 10,
    marginBottom: 10,
  },
  optionItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  optionLetter: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#4B5563',
    width: 25,
  },
  optionText: {
    fontSize: 11,
    color: '#374151',
    flex: 1,
  },
  correctOption: {
    color: '#059669', // Green
    fontFamily: 'Helvetica-Bold',
  },
  explanationBox: {
    backgroundColor: '#F3E8FF', // Light purple
    padding: 10,
    borderRadius: 4,
    marginTop: 5,
  },
  explanationLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#5B21B6',
    marginBottom: 3,
  },
  explanationText: {
    fontSize: 10,
    color: '#4C1D95',
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

interface QuizData {
  title: string;
  questions: Array<{
    question: string;
    choices?: string[]; // Note: sometimes called choices, sometimes options
    options?: string[];
    correct: string[];
    explanation?: string;
  }>;
}

export const QuizPDF = ({ data }: { data: QuizData | QuizData[] }) => {
  const isList = Array.isArray(data);
  const quizzes = isList ? data : [data];

  return (
    <Document>
      {quizzes.map((quiz, quizIndex) => (
        <Page key={quizIndex} size="A4" style={styles.page}>
          <View style={styles.header} fixed>
            <View>
              <Text style={styles.headerTitle}>HIPPOCAMPUS</Text>
              <Text style={styles.headerText}>Évaluation Médicale</Text>
            </View>
            <Text style={styles.headerText}>Document Officiel</Text>
          </View>

          <Text style={styles.title}>{quiz.title.toUpperCase()}</Text>

          {quiz.questions.map((q, qIndex) => {
            const options = q.choices || q.options || [];
            return (
              <View key={qIndex} style={styles.questionContainer} wrap={false}>
                <Text style={styles.questionText}>
                  Question {qIndex + 1} : {q.question}
                </Text>

                <View style={styles.optionsList}>
                  {options.map((opt, optIndex) => {
                    const isCorrect = q.correct.includes(opt);
                    return (
                      <View key={optIndex} style={styles.optionItem}>
                        <Text style={styles.optionLetter}>
                          {String.fromCharCode(65 + optIndex)}.
                        </Text>
                        <Text style={[styles.optionText, isCorrect && styles.correctOption]}>
                          {opt}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {q.explanation && (
                  <View style={styles.explanationBox}>
                    <Text style={styles.explanationLabel}>Explication :</Text>
                    <Text style={styles.explanationText}>{q.explanation}</Text>
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.footer} fixed>
            <Text style={styles.pageNumber}>
              Hippocampus - AI Medical Learning
            </Text>
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
              `Page ${pageNumber} / ${totalPages}`
            )} />
          </View>
        </Page>
      ))}
    </Document>
  );
};
