// scripts/update-quiz-sessions.mjs
import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('src/pages/Quiz.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Tab Trigger count
content = content.replace(
  '<TabsTrigger value="library">Mes QCM ({decks.length})</TabsTrigger>',
  '<TabsTrigger value="library">Mes QCM ({decks.length + sessionsHistory.filter((s) => s.status === "completed").length})</TabsTrigger>'
);

// 2. In validateOrNextQuestion: add progressive save and finalize
const targetValidateBlock = `    if (!isValidated) {
      if (isExact) setScore((s) => s + 1);
      setIsValidated(true);
      grantDawJangXP(
        DAWJANG_XP_REWARDS.QCM_QUESTION_ANSWERED,
        "Question QCM traitée",
        "qcm"
      );
    } else {
      if (playingIndex + 1 < playingDeck.questions.length) {
        setPlayingIndex((i) => i + 1);
        setSelectedOptionIds([]);
        setIsValidated(false);
      } else {
        setQuizFinished(true);
        grantDawJangXP(
          DAWJANG_XP_REWARDS.QCM_SESSION_COMPLETED,
          "Session QCM terminée",
          "qcm"
        );
      }
    }`;

const replacementValidateBlock = `    if (!isValidated) {
      if (isExact) setScore((s) => s + 1);
      setIsValidated(true);
      grantDawJangXP(
        DAWJANG_XP_REWARDS.QCM_QUESTION_ANSWERED,
        "Question QCM traitée",
        "qcm"
      );

      // Mémorisation progressive des réponses de la session
      if (activeSession) {
        const elapsed = Math.round((Date.now() - sessionStartTime) / 1000);
        recordSessionAnswer(activeSession.id, currentQ.id, selectedOptionIds, elapsed);
      }
    } else {
      if (playingIndex + 1 < playingDeck.questions.length) {
        setPlayingIndex((i) => i + 1);
        setSelectedOptionIds([]);
        setIsValidated(false);
      } else {
        setQuizFinished(true);
        grantDawJangXP(
          DAWJANG_XP_REWARDS.QCM_SESSION_COMPLETED,
          "Session QCM terminée",
          "qcm"
        );

        // Clôture et finalisation automatique de la session
        if (activeSession) {
          const finalScore = isExact ? score + 1 : score;
          const finalAnswers = {
            ...activeSession.userAnswers,
            [currentQ.id]: selectedOptionIds,
          };
          const elapsed = Math.round((Date.now() - sessionStartTime) / 1000);
          finalizeSession(activeSession.id, finalScore, finalAnswers, elapsed).then((saved) => {
            const updated = getSavedSessions();
            setSessionsHistory(updated);
            if (saved) {
              toast({
                title: "Session QCM enregistrée avec succès !",
                description: \`Score final : \${finalScore}/\${playingDeck.questions.length} • Mémorisée dans vos QCM.\`,
              });
            }
          });
        }
      }
    }`;

// Normalize line breaks before replace
const normalize = (str) => str.replace(/\r\n/g, '\n');
const denormalize = (str, isCrlf) => isCrlf ? str.replace(/\n/g, '\r\n') : str;

const isCrlf = content.includes('\r\n');
let normContent = normalize(content);

if (normContent.includes(normalize(targetValidateBlock))) {
  normContent = normContent.replace(normalize(targetValidateBlock), normalize(replacementValidateBlock));
  console.log('✓ validateOrNextQuestion updated successfully');
} else {
  console.log('✗ validateOrNextQuestion target not found directly, checking partial');
}

// 3. Add handleManualSaveSession if not present
if (!normContent.includes('const handleManualSaveSession =')) {
  const insertBefore = '  const filteredDecks = decks.filter(';
  const manualSaveCode = `  const handleManualSaveSession = async () => {
    if (!activeSession || !playingDeck) return;
    const elapsed = Math.round((Date.now() - sessionStartTime) / 1000);
    const currentAnswers =
      playingDeck.qcmFormat === "mixte"
        ? sheetSelections
        : {
            ...activeSession.userAnswers,
            ...(selectedOptionIds.length > 0
              ? { [playingDeck.questions[playingIndex].id]: selectedOptionIds }
              : {}),
          };
    const saved = await saveSessionManually(activeSession.id, currentAnswers, score, elapsed);
    if (saved) {
      setSessionsHistory(getSavedSessions());
      toast({
        title: "Session sauvegardée !",
        description: "Vos réponses et le chronomètre ont été mémorisés avec succès.",
      });
    }
  };

`;
  normContent = normContent.replace(insertBefore, manualSaveCode + insertBefore);
  console.log('✓ handleManualSaveSession added successfully');
}

// 4. Update sheetAllValidated in sheet mode
const targetSheetVal = `                        setScore(totalScore);
                        setSheetValidatedMap(allMap);
                        setSheetAllValidated(true);
                        grantDawJangXP(
                          DAWJANG_XP_REWARDS.QCM_SESSION_COMPLETED,
                          "Feuille QCM Panachée terminée",
                          "qcm"
                        );
                        window.scrollTo({ top: 0, behavior: "smooth" });`;

const replacementSheetVal = `                        setScore(totalScore);
                        setSheetValidatedMap(allMap);
                        setSheetAllValidated(true);
                        grantDawJangXP(
                          DAWJANG_XP_REWARDS.QCM_SESSION_COMPLETED,
                          "Feuille QCM Panachée terminée",
                          "qcm"
                        );
                        if (activeSession) {
                          const elapsed = Math.round((Date.now() - sessionStartTime) / 1000);
                          finalizeSession(activeSession.id, totalScore, sheetSelections, elapsed).then((saved) => {
                            setSessionsHistory(getSavedSessions());
                            if (saved) {
                              toast({
                                title: "Feuille QCM mémorisée avec succès !",
                                description: \`Score final : \${totalScore}/\${playingDeck.questions.length} • Mémorisée dans vos QCM.\`,
                              });
                            }
                          });
                        }
                        window.scrollTo({ top: 0, behavior: "smooth" });`;

if (normContent.includes(normalize(targetSheetVal))) {
  normContent = normContent.replace(normalize(targetSheetVal), normalize(replacementSheetVal));
  console.log('✓ sheetAllValidated finalized updated successfully');
}

fs.writeFileSync(filePath, denormalize(normContent, isCrlf), 'utf8');
console.log('Done script.');
