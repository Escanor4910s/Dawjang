// scripts/inject-quiz-sessions-ui.mjs
import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('src/pages/Quiz.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const normalize = (str) => str.replace(/\r\n/g, '\n');
const denormalize = (str, isCrlf) => isCrlf ? str.replace(/\n/g, '\r\n') : str;
const isCrlf = content.includes('\r\n');
let norm = normalize(content);

// 1. Add filteredSessions calculation near filteredDecks
const targetFilteredDecks = `  const filteredDecks = decks.filter(
    (d) =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );`;

const replacementFilteredDecks = `  const filteredDecks = decks.filter(
    (d) =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const completedSessions = sessionsHistory.filter((s) => s.status === "completed");
  const filteredSessions = completedSessions.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.subject.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    const pct = s.totalQuestions > 0 ? (s.score / s.totalQuestions) * 100 : 0;
    if (scoreFilter === "success") return pct >= 70;
    if (scoreFilter === "review") return pct < 70;
    return true;
  });`;

if (norm.includes(normalize(targetFilteredDecks))) {
  norm = norm.replace(normalize(targetFilteredDecks), normalize(replacementFilteredDecks));
  console.log('✓ filteredSessions added successfully');
}

// 2. Add player header toolbar items (Timer, Save, Unique Badge)
const targetPlayerHeaderBtns = `                  <div className="flex items-center gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleOpenQuizPdfStudio(playingDeck, e)}
                      className="h-8 gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5 text-primary" />
                      <span>Exporter PDF</span>
                    </Button>
                    <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
                      Question {playingIndex + 1} / {playingDeck.questions.length}
                    </span>
                  </div>`;

const replacementPlayerHeaderBtns = `                  <div className="flex items-center gap-2.5">
                    {activeSession?.isDiversified && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] hidden sm:inline-flex">
                        <Sparkles className="h-3 w-3 mr-1 inline" />
                        Session unique
                      </Badge>
                    )}
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg">
                      <Clock className="h-3 w-3 text-primary" />
                      {Math.floor(sessionElapsedTime / 60)}:
                      {sessionElapsedTime % 60 < 10 ? "0" : ""}
                      {sessionElapsedTime % 60}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleManualSaveSession}
                      className="h-8 gap-1.5"
                      title="Enregistrer la session en cours"
                    >
                      <Save className="h-3.5 w-3.5 text-primary" />
                      <span className="hidden sm:inline">Sauvegarder</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleOpenQuizPdfStudio(playingDeck, e)}
                      className="h-8 gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5 text-primary" />
                      <span>Exporter PDF</span>
                    </Button>
                    <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
                      Question {playingIndex + 1} / {playingDeck.questions.length}
                    </span>
                  </div>`;

if (norm.includes(normalize(targetPlayerHeaderBtns))) {
  norm = norm.replace(normalize(targetPlayerHeaderBtns), normalize(replacementPlayerHeaderBtns));
  console.log('✓ Player header toolbar updated with Timer & Save');
}

// 3. Add QcmSessionReviewModal right before final </div>\n  );\n}
const targetModalEnd = `      {/* STUDIO D'ÉDITION & D'EXPORT PDF HAUTE-COUTURE (QCM) */}
      <PdfExportStudioModal`;

const reviewModalCode = `      {/* MODAL DE RÉVISION DÉTAILLÉE D'UNE SESSION QCM */}
      <QcmSessionReviewModal
        open={Boolean(reviewSession)}
        onOpenChange={(open) => {
          if (!open) setReviewSession(null);
        }}
        session={reviewSession}
        onReplay={(s) => {
          const deck = decks.find((d) => d.id === s.deckId) || {
            id: s.deckId,
            title: s.title,
            subject: s.subject,
            createdAt: "Session réitérée",
            questions: s.questions,
          };
          startQuiz(deck, false);
        }}
      />

      {/* STUDIO D'ÉDITION & D'EXPORT PDF HAUTE-COUTURE (QCM) */}
      <PdfExportStudioModal`;

if (norm.includes(normalize(targetModalEnd))) {
  norm = norm.replace(normalize(targetModalEnd), normalize(reviewModalCode));
  console.log('✓ QcmSessionReviewModal added successfully');
}

fs.writeFileSync(filePath, denormalize(norm, isCrlf), 'utf8');
console.log('Done script UI injection.');
