// scripts/inject-library-sessions-ui.mjs
import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('src/pages/Quiz.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const normalize = (str) => str.replace(/\r\n/g, '\n');
const denormalize = (str, isCrlf) => isCrlf ? str.replace(/\n/g, '\r\n') : str;
const isCrlf = content.includes('\r\n');
let norm = normalize(content);

// 1. Insert sub-tabs selector right after search/layout row
const searchRowEnd = `              <Button onClick={() => setActiveTab("ai")}>
                <Sparkles className="h-4 w-4" />
                <span>Générer par IA</span>
              </Button>
            </div>
          </div>`;

const subTabsSelectorCode = `              <Button onClick={() => setActiveTab("ai")}>
                <Sparkles className="h-4 w-4" />
                <span>Générer par IA</span>
              </Button>
            </div>
          </div>

          {/* SÉLECTEUR DE SOUS-ONGLET : TOUS / QUESTIONNAIRES / SESSIONS TERMINÉES */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setLibrarySubTab("all")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                  librarySubTab === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                Tous ({decks.length + completedSessions.length})
              </button>
              <button
                type="button"
                onClick={() => setLibrarySubTab("decks")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                  librarySubTab === "decks"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Questionnaires ({decks.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setLibrarySubTab("sessions")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                  librarySubTab === "sessions"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <History className="w-3.5 h-3.5" />
                <span>Sessions terminées ({completedSessions.length})</span>
              </button>
            </div>

            {(librarySubTab === "sessions" || librarySubTab === "all") && completedSessions.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Score :</span>
                <button
                  type="button"
                  onClick={() => setScoreFilter("all")}
                  className={cn(
                    "px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer",
                    scoreFilter === "all"
                      ? "bg-secondary text-foreground font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Tous
                </button>
                <button
                  type="button"
                  onClick={() => setScoreFilter("success")}
                  className={cn(
                    "px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer",
                    scoreFilter === "success"
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  ≥ 70%
                </button>
                <button
                  type="button"
                  onClick={() => setScoreFilter("review")}
                  className={cn(
                    "px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer",
                    scoreFilter === "review"
                      ? "bg-destructive/20 text-destructive font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  &lt; 70%
                </button>
              </div>
            )}
          </div>`;

if (norm.includes(normalize(searchRowEnd))) {
  norm = norm.replace(normalize(searchRowEnd), normalize(subTabsSelectorCode));
  console.log('✓ Sub-tabs selector injected');
}

// 2. Wrap decks in condition `librarySubTab !== "sessions"`
const deckSectionCondition = `{librarySubTab !== "sessions" && (
            <>
              {filteredDecks.length === 0 ? (
                <Card className="p-12 text-center space-y-3">
                  <p className="text-[15px] font-semibold text-foreground">
                    Aucun QCM trouvé dans votre banque
                  </p>
                  <p className="text-[13px] text-muted-foreground max-w-md mx-auto">
                    Utilisez le Générateur IA pour construire vos QCM personnalisés.
                  </p>
                  <Button onClick={() => setActiveTab("ai")}>
                    <Sparkles className="h-4 w-4" />
                    <span>Ouvrir le Générateur IA</span>
                  </Button>
                </Card>
              ) : layoutMode === "mosaic" ? (`;

const oldDeckStart = `{filteredDecks.length === 0 ? (
            <Card className="p-12 text-center space-y-3">
              <p className="text-[15px] font-semibold text-foreground">
                Aucun QCM dans votre banque
              </p>
              <p className="text-[13px] text-muted-foreground max-w-md mx-auto">
                Utilisez le Générateur IA pour construire vos QCM (Classique, Censure, Groupage, Jumelage ou Association).
              </p>
              <Button onClick={() => setActiveTab("ai")}>
                <Sparkles className="h-4 w-4" />
                <span>Ouvrir le Générateur IA</span>
              </Button>
            </Card>
          ) : layoutMode === "mosaic" ? (`;

if (norm.includes(normalize(oldDeckStart))) {
  norm = norm.replace(normalize(oldDeckStart), normalize(deckSectionCondition));
  console.log('✓ Deck start condition updated');
}

// 3. Close decks condition and append completed sessions section
const oldDeckEnd = `                  </div>
                </div>
              ))}
            </div>
          )}`;

const newDeckEndAndSessions = `                  </div>
                </div>
              ))}
            </div>
          )}
            </>
          )}

          {/* SECTION : HISTORIQUE DES SESSIONS TERMINÉES */}
          {(librarySubTab === "all" || librarySubTab === "sessions") && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">
                    Sessions d'entraînement mémorisées ({filteredSessions.length})
                  </h3>
                </div>
                {completedSessions.length > 0 && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {completedSessions.length} session{completedSessions.length > 1 ? "s" : ""} au total
                  </span>
                )}
              </div>

              {filteredSessions.length === 0 ? (
                <Card className="p-8 text-center space-y-2 border-dashed">
                  <p className="text-sm font-semibold text-foreground">
                    Aucune session enregistrée correspondant à vos critères
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Lancez un entraînement sur l'un de vos QCM pour mémoriser automatiquement vos résultats.
                  </p>
                </Card>
              ) : layoutMode === "mosaic" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSessions.map((session) => {
                    const pct =
                      session.totalQuestions > 0
                        ? Math.round((session.score / session.totalQuestions) * 100)
                        : 0;
                    const isSuccess = pct >= 70;
                    const isAvg = pct >= 50 && pct < 70;
                    const mins = Math.floor(session.timeElapsed / 60);
                    const secs = session.timeElapsed % 60;
                    const formattedDuration = \`\${mins}m \${secs < 10 ? "0" : ""}\${secs}s\`;
                    const dateStr = new Date(session.startedAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <Card
                        key={session.id}
                        className="flex flex-col justify-between border-border bg-card hover:border-primary/40 transition-all shadow-2xs"
                      >
                        <CardHeader className="pb-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline">{session.subject}</Badge>
                              {session.isDiversified && (
                                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                                  <Sparkles className="w-2.5 h-2.5 mr-1 inline" />
                                  Diversifiée
                                </Badge>
                              )}
                            </div>
                            <Badge
                              className={cn(
                                "font-mono text-xs px-2 py-0.5",
                                isSuccess
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : isAvg
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                  : "bg-destructive/15 text-destructive border-destructive/30"
                              )}
                            >
                              <Trophy className="w-3 h-3 mr-1 inline" />
                              {session.score} / {session.totalQuestions} ({pct}%)
                            </Badge>
                          </div>

                          <CardTitle className="text-[15px] font-bold line-clamp-2">
                            {session.title}
                          </CardTitle>

                          <CardDescription className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formattedDuration}
                            </span>
                            <span>• {dateStr}</span>
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setReviewSession(session)}
                              className="h-7 text-xs px-2 gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Détails</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const deck = decks.find((d) => d.id === session.deckId) || {
                                  id: session.deckId,
                                  title: session.title,
                                  subject: session.subject,
                                  createdAt: "Session réitérée",
                                  questions: session.questions,
                                };
                                startQuiz(deck, false);
                              }}
                              className="h-7 text-xs px-2 gap-1 text-primary hover:bg-primary/10"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Rejouer</span>
                            </Button>
                          </div>

                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await deleteQcmSession(session.id);
                              setSessionsHistory(getSavedSessions());
                              toast({ title: "Session retirée de l'historique" });
                            }}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            title="Supprimer cette session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSessions.map((session) => {
                    const pct =
                      session.totalQuestions > 0
                        ? Math.round((session.score / session.totalQuestions) * 100)
                        : 0;
                    const isSuccess = pct >= 70;
                    const isAvg = pct >= 50 && pct < 70;
                    const mins = Math.floor(session.timeElapsed / 60);
                    const secs = session.timeElapsed % 60;
                    const formattedDuration = \`\${mins}m \${secs < 10 ? "0" : ""}\${secs}s\`;
                    const dateStr = new Date(session.startedAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 transition-all gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline">{session.subject}</Badge>
                            {session.isDiversified && (
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                                <Sparkles className="w-2.5 h-2.5 mr-1 inline" />
                                Diversifiée
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground font-mono">{dateStr}</span>
                          </div>
                          <h4 className="font-bold text-sm text-foreground truncate">{session.title}</h4>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <Badge
                            className={cn(
                              "font-mono text-xs px-2.5 py-1",
                              isSuccess
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                : isAvg
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                : "bg-destructive/15 text-destructive border-destructive/30"
                            )}
                          >
                            {session.score} / {session.totalQuestions} ({pct}%)
                          </Badge>

                          <span className="font-mono text-xs text-muted-foreground hidden sm:inline">
                            {formattedDuration}
                          </span>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setReviewSession(session)}
                            className="h-8 text-xs gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Détails</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const deck = decks.find((d) => d.id === session.deckId) || {
                                id: session.deckId,
                                title: session.title,
                                subject: session.subject,
                                createdAt: "Session réitérée",
                                questions: session.questions,
                              };
                              startQuiz(deck, false);
                            }}
                            className="h-8 text-xs gap-1 text-primary hover:bg-primary/10"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Rejouer</span>
                          </Button>

                          <button
                            type="button"
                            onClick={async () => {
                              await deleteQcmSession(session.id);
                              setSessionsHistory(getSavedSessions());
                              toast({ title: "Session retirée de l'historique" });
                            }}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            title="Supprimer cette session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}`;

if (norm.includes(normalize(oldDeckEnd))) {
  norm = norm.replace(normalize(oldDeckEnd), normalize(newDeckEndAndSessions));
  console.log('✓ Sessions UI rendering injected');
}

fs.writeFileSync(filePath, denormalize(norm, isCrlf), 'utf8');
console.log('Finished updating library view.');
