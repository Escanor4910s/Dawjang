import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  JUMELAGE_OPTIONS,
  validateExamDraft,
  validateReviewedExamBlock,
  type ReviewedExamBlock,
} from "../supabase/functions/_shared/exam-validation";
import { buildExamDesign, buildLesson, computeCorpusAnalysis, generateExamBlanc, getObservedLessonFrequency, loadInfiniteMemoryLedgerSync, parseUniversalExamAnnale } from "../src/lib/examenBlancEngine";
import { handleGenerateExamenBlancBlock, sanitizeExamDraft, type ExamenBlancPipelineDeps } from "../supabase/functions/_shared/examen-blanc-ai";

import { apportionExamCounts, createExamDesign, examDisciplineDirectives, type ObservedExamQuestion } from "../supabase/functions/_shared/exam-design";
import { VERIFIED_SCANNED_EXAMS_CORPUS } from "../src/lib/ucadExamCorpus";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), get: vi.fn(), set: vi.fn(), getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mocks.invoke }, auth: { getSession: mocks.getSession } },
}));
vi.mock("idb-keyval", () => ({ get: mocks.get, set: mocks.set }));

const course = "La somme des angles d’un triangle euclidien est égale à 180 degrés. Deux droites parallèles du plan ne se coupent pas. Le carré possède quatre côtés de même longueur.";
const spec = { kind: "STANDALONE", formats: ["ELECTION"], optionCounts: [5] };

function validBlock(): ReviewedExamBlock {
  return {
    kind: "STANDALONE",
    header: "Géométrie",
    items: [{
      format: "ELECTION",
      stem: "Dans le plan euclidien, combien vaut la somme des angles intérieurs d’un triangle ?",
      options: [
        { letter: "A", text: "180 degrés" },
        { letter: "B", text: "90 degrés" },
        { letter: "C", text: "360 degrés" },
        { letter: "D", text: "270 degrés" },
        { letter: "E", text: "120 degrés" },
      ],
      correct: ["A"],
      explanation: "La somme est de 180 degrés, les autres valeurs ne conviennent pas.",
    }],
    validation: {
      version: 1,
      status: "passed",
      differentModel: false,
      items: [{
        index: 0,
        answerable: true,
        unambiguous: true,
        correct: ["A"],
        explanation: "La somme est de 180 degrés dans le plan euclidien.",
        optionVerdicts: ["A", "B", "C", "D", "E"].map((letter) => ({
          letter,
          isTrue: letter === "A",
          reason: letter === "A" ? "Valeur donnée dans le cours." : "Valeur différente des 180 degrés du cours.",
          sourceQuote: "La somme des angles d’un triangle euclidien est égale à 180 degrés.",
        })),
      }],
    },
  };
}

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubGlobal("localStorage", { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() });
  mocks.get.mockImplementation(async (key) => key === "dawjang_eb_infinite_ghost_ledger_v1" ? { globalGenerationCounter: 0, perLesson: {} } : undefined);
  mocks.set.mockResolvedValue(undefined);
  mocks.invoke.mockReset();
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: "test-user-token" } }, error: null });
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    const result = await mocks.invoke("generate-quiz", { body: JSON.parse(init.body) });
    return new Response(JSON.stringify(result.error ? { error: result.error.message } : result.data), { status: result.error ? 503 : 200 });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("Contrat de validation des examens", () => {
  test("accepte un bloc de mathématiques étayé et relu", () => {
    expect(validateReviewedExamBlock(validBlock(), spec, course)).toEqual([]);
  });

  test("ne confond pas une seconde passe et un second modèle", () => {
    const block = validBlock();
    expect(block.validation.differentModel).toBe(false);
    expect(validateReviewedExamBlock(block, spec, course)).toEqual([]);
  });

  test.each([
    ["absence de preuve", (b: any) => { delete b.validation; }],
    ["preuve falsifiée par un booléen", (b: any) => { delete b.validation; b.reviewedBySecondModel = true; }],
    ["relecture partielle", (b: any) => { b.validation.items = []; }],
    ["ambiguïté", (b: any) => { b.validation.items[0].unambiguous = false; }],
    ["source insuffisante", (b: any) => { b.validation.items[0].answerable = false; }],
    ["citation inventée", (b: any) => { b.validation.items[0].optionVerdicts[0].sourceQuote = "Citation absente des documents"; }],
    ["option non vérifiée", (b: any) => { b.validation.items[0].optionVerdicts.pop(); }],
    ["désaccord de corrigé", (b: any) => { b.validation.items[0].correct = ["B"]; }],
    ["deux réponses vraies en élection", (b: any) => { b.validation.items[0].optionVerdicts[1].isTrue = true; }],
    ["clé absente", (b: any) => { b.items[0].correct = []; }],
    ["clé inexistante", (b: any) => { b.items[0].correct = ["Z"]; }],
    ["lettres dupliquées", (b: any) => { b.items[0].options[1].letter = "A"; }],
    ["options dupliquées", (b: any) => { b.items[0].options[1].text = "180 degrés"; }],
    ["quota incomplet", (b: any) => { b.items = []; }],
    ["format modifié", (b: any) => { b.items[0].format = "CENSURE"; }],
  ])("rejette : %s", (_, mutate) => {
    const block = validBlock();
    mutate(block);
    expect(validateReviewedExamBlock(block, spec, course).length).toBeGreaterThan(0);
  });

  test("accepte des options numériques courtes sans les remplacer", () => {
    const block = validBlock();
    block.items[0].options.forEach((option, i) => { option.text = String(i); });
    expect(validateExamDraft(block, spec)).toEqual([]);
  });

  test("la censure sélectionne la seule proposition fausse", () => {
    const block = validBlock();
    block.items[0].format = "CENSURE";
    block.validation.items[0].optionVerdicts.forEach((v) => { v.isTrue = v.letter !== "A"; });
    expect(validateReviewedExamBlock(block, { ...spec, formats: ["CENSURE"] }, course)).toEqual([]);
  });

  test("préserve le sous-format d’une question dans un dossier", () => {
    const block = validBlock();
    block.kind = "CAS_CLINIQUE";
    block.vignette = "Un géomètre étudie une parcelle triangulaire dans le plan.";
    expect(validateReviewedExamBlock(block, { ...spec, kind: "CAS_CLINIQUE" }, course)).toEqual([]);
    delete block.vignette;
    expect(validateReviewedExamBlock(block, { ...spec, kind: "CAS_CLINIQUE" }, course)).not.toEqual([]);
  });

  test("rejette une association sans colonnes et un jumelage sans assertions", () => {
    for (const format of ["ASSOCIATION", "JUMELAGE"] as const) {
      const block = validBlock();
      block.items[0].format = format;
      expect(validateReviewedExamBlock(block, { ...spec, formats: [format] }, course)).not.toEqual([]);
    }
  });

  test("vérifie la causalité et le code canonique du jumelage", () => {
    const block = validBlock();
    const item = block.items[0];
    item.format = "JUMELAGE";
    item.statements = ["Première assertion", "Seconde assertion"];
    item.options = JUMELAGE_OPTIONS.map((text, index) => ({ letter: "ABCDE"[index], text }));
    block.validation.items[0].statementTruth = [true, true];
    block.validation.items[0].causalLink = true;
    const jumelageSpec = { ...spec, formats: ["JUMELAGE"] };
    expect(validateReviewedExamBlock(block, jumelageSpec, course)).toEqual([]);
    block.validation.items[0].causalLink = false;
    expect(validateReviewedExamBlock(block, jumelageSpec, course).join(" ")).toContain("assertions du jumelage");
    item.options.reverse();
    expect(validateExamDraft(block, jumelageSpec).join(" ")).toContain("code canonique");
  });

  test("vérifie mathématiquement le code d’un groupage personnalisé", () => {
    const block = validBlock();
    const item = block.items[0];
    item.format = "GROUPAGE";
    item.statements = ["Première assertion", "Deuxième assertion", "Troisième assertion", "Quatrième assertion"];
    item.options = [
      { letter: "A", text: "1 + 3" }, { letter: "B", text: "1 + 2 + 3" },
      { letter: "C", text: "2 + 4" }, { letter: "D", text: "4 seulement" }, { letter: "E", text: "Autre choix" },
    ];
    item.groupageCodeHint = "A=1+3 ; B=1+2+3 ; C=2+4 ; D=4 ; E=autre choix";
    block.validation.items[0].statementTruth = [true, false, true, false];
    const groupSpec = { ...spec, formats: ["GROUPAGE"] };
    expect(validateReviewedExamBlock(block, groupSpec, course)).toEqual([]);
    block.validation.items[0].statementTruth = [false, true, false, true];
    expect(validateReviewedExamBlock(block, groupSpec, course).join(" ")).toContain("assertions du groupage");
    item.groupageCodeHint = "A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autre choix";
    expect(validateReviewedExamBlock(block, groupSpec, course).join(" ")).toContain("code de groupage");
  });
});

describe("Publication atomique de l’examen", () => {
  const lesson = buildLesson("math", "Géométrie", course, course.length, "Mathématiques");
  const annale = { id: "annale-math", title: "Géométrie", year: "2026", wordCount: 40, sizeLabel: "1 Ko",
    rawText: "QCM 1. ELECTION - Quelle est la somme des angles d’un triangle euclidien ?\nA. 180 degrés\nB. 90 degrés\nC. 360 degrés\nD. 270 degrés\nE. 120 degrés" };
  const analysis = computeCorpusAnalysis("Mathématiques", [lesson], [annale]);
  const params = { ueName: "Sciences", subjectName: "Mathématiques", selected: [lesson], analysis, sessionSeed: 1 };

  test("conserve les clés, les citations et la preuve sans mutation post-relecture", async () => {
    const block = validBlock();
    mocks.invoke.mockResolvedValue({ data: { block }, error: null });
    const result = await generateExamBlanc(params);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].reviewedBySecondModel).toBe(false);
    expect(result.blocks[0].items[0].options).toEqual(block.items[0].options);
    expect(result.blocks[0].items[0].correct).toEqual(["A"]);
    expect(result.blocks[0].items[0].sourceQuotes).toHaveLength(1);
    const requestOptions = vi.mocked(fetch).mock.calls[0]?.[1] ?? mocks.invoke.mock.calls[0]?.[1];
    expect(requestOptions.headers).toMatchObject({ Authorization: "Bearer test-user-token" });
    expect(mocks.set).toHaveBeenCalledTimes(1);
  });

  test("n'envoie aucun document sans session utilisateur", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(generateExamBlanc(params)).rejects.toThrow("Veuillez vous connecter");
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  test("ne fabrique pas de questions lors d’une panne IA", async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { message: "Service indisponible" } });
    await expect(generateExamBlanc(params)).rejects.toThrow("Service indisponible");
    expect(mocks.set).not.toHaveBeenCalled();
  });

  test("rejette un serveur ancien qui ne fournit pas de preuve", async () => {
    const block = validBlock();
    delete (block as any).validation;
    mocks.invoke.mockResolvedValue({ data: { block }, error: null });
    await expect(generateExamBlanc(params)).rejects.toThrow("serveur de génération doit être mis à jour");
    expect(mocks.set).not.toHaveBeenCalled();
  });

  test("ne conserve pas le premier chapitre si le second échoue", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { block: validBlock() }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Relecture refusée" } });
    await expect(generateExamBlanc({ ...params, selected: [lesson, { ...lesson, id: "math2", cleanTitle: "Angles" }] })).rejects.toThrow("Relecture refusée");
    expect(mocks.set).not.toHaveBeenCalled();
    expect(loadInfiniteMemoryLedgerSync()).toEqual({ globalGenerationCounter: 0, perLesson: {} });
  });

  test("refuse de convertir silencieusement des questions rédactionnelles", async () => {
    const openAnalysis = computeCorpusAnalysis("Mathématiques", [lesson], [{ ...annale, rawText: "QNS 1. Démontrer le théorème de Pythagore.\nQNS 2. Démontrer la somme des angles du triangle." }]);
    await expect(generateExamBlanc({ ...params, analysis: openAnalysis })).rejects.toThrow("Aucune structure de QCM exploitable");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  test("ne persiste pas une génération annulée pendant l’appel", async () => {
    let cancelled = false;
    mocks.invoke.mockImplementation(async () => { cancelled = true; return { data: { block: validBlock() }, error: null }; });
    const result = await generateExamBlanc({ ...params, isCancelled: () => cancelled });
    expect(result.blocks).toEqual([]);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  test("injecte des références de style localisées et produit un bilan comparatif", async () => {
    mocks.invoke.mockResolvedValue({ data: { block: validBlock() }, error: null });
    const result = await generateExamBlanc(params);
    const payload = mocks.invoke.mock.calls[0][1].body;
    expect(payload.styleReferences.length).toBeGreaterThan(0);
    expect(payload.styleReferences[0].source).toMatchObject({ title: "Géométrie", questionNumber: 1 });
    expect(payload.styleReferences[0].source.lineStart).toBeGreaterThanOrEqual(1);
    expect(payload.professorStyle).not.toHaveProperty("typicalStemPatterns");
    expect(payload).not.toHaveProperty("referenceExample");
    expect(result.styleReport?.referenceCount).toBeGreaterThan(0);
    expect(result.styleReport?.rows[0].format).toBe("ELECTION");
    expect(result.styleReport?.rows[0].reference).not.toBeNull();
  });

  test("refuse un bloc recopié d’une annale et n’enregistre rien", async () => {
    const block = validBlock();
    block.items[0].stem = "Quelle est la somme des angles d’un triangle euclidien ?";
    mocks.invoke.mockResolvedValue({ data: { block }, error: null });
    await expect(generateExamBlanc(params)).rejects.toThrow("recopiée");
    expect(mocks.set).not.toHaveBeenCalled();
  });

  test("bascule automatiquement sur le relais déployé mor-chat lorsque generate-quiz échoue en Failed to fetch (cas OSTEOMALACIE)", async () => {
    const osteoCourse =
      "L'ostéomalacie est une ostéopathie métabolique généralisée caractérisée par un défaut de minéralisation de la matrice protéique osseuse. Les stries de Looser-Milkman sont des pseudo-fractures symétriques pathognomoniques à la radiographie. La biologie montre une hypocalcémie, une hypophosphatémie et une élévation des phosphatases alcalines.";
    const osteoLesson = buildLesson("osteo", "OSTEOMALACIE", osteoCourse, osteoCourse.length, "Rhumatologie");
    const osteoAnnale = {
      id: "annale-tor-2025",
      title: "Examen TOR 2025.pdf",
      year: "2025",
      wordCount: 55,
      sizeLabel: "2 Ko",
      rawText:
        "EC3 : Epreuve de Rhumatologie\nCompléments multiples\n30) L'ostéomalacie est caractérisée par :\n• Une douleur osseuse mécanique\n• Des stries de Looser-Milkman\n• Une hypercalcémie constante\n• Une hypophosphatémie\n• Une diminution des phosphatases alcalines",
    };
    const osteoAnalysis = computeCorpusAnalysis("Rhumatologie", [osteoLesson], [osteoAnnale]);

    mocks.invoke.mockImplementation(async (fnName: string) => {
      if (fnName === "mor-chat") {
        return {
          data: {
            reply: JSON.stringify({
              kind: "STANDALONE",
              header: "OSTEOMALACIE",
              items: [
                {
                  format: "COMPLEMENT_MULTIPLE",
                  stem: "Quelles anomalies paracliniques caractérisent l'ostéomalacie carentielle selon le cours ?",
                  options: [
                    { letter: "A", text: "Des stries de Looser-Milkman symétriques à la radiographie" },
                    { letter: "B", text: "Une hypocalcémie associée à une hypophosphatémie" },
                    { letter: "C", text: "Une élévation des phosphatases alcalines sériques" },
                    { letter: "D", text: "Une hypercalcémie maligne réfractaire" },
                    { letter: "E", text: "Une ostéocondensation corticale diffuse sans pseudo-fracture" },
                  ],
                  correct: ["A", "B", "C"],
                  explanation:
                    "Les stries de Looser-Milkman, l'hypocalcémie, l'hypophosphatémie et l'élévation des phosphatases alcalines caractérisent l'ostéomalacie.",
                },
              ],
            }),
          },
          error: null,
        };
      }
      return { data: null, error: new TypeError("Failed to fetch") };
    });

    const result = await generateExamBlanc({
      ueName: "TOR",
      subjectName: "Rhumatologie",
      selected: [osteoLesson],
      analysis: osteoAnalysis,
      sessionSeed: 7,
    });

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].items).toHaveLength(1);
    expect(result.blocks[0].items[0].format).toBe("COMPLEMENT_MULTIPLE");
    expect(result.blocks[0].items[0].correct).toEqual(["A", "B", "C"]);
    expect(result.blocks[0].items[0].sourceQuotes.length).toBeGreaterThan(0);
    expect(osteoCourse).toContain(result.blocks[0].items[0].sourceQuotes[0]);
  });

  test("bascule automatiquement sur mor-chat lorsque generate-quiz renvoie HTTP 500 OpenAI billing_not_active", async () => {
    const osteoCourse =
      "L'ostéomalacie est caractérisée par un défaut de minéralisation osseuse de la trame ostéoïde, des stries de Looser-Milkman et une hypovitaminose D sévère.";
    const osteoLesson = buildLesson("osteo2", "OSTEOMALACIE", osteoCourse, osteoCourse.length, "Rhumatologie");
    const osteoAnnale = {
      id: "annale-tor-2025-b",
      title: "Examen TOR 2025.pdf",
      year: "2025",
      wordCount: 55,
      sizeLabel: "2 Ko",
      rawText:
        "EC3 : Epreuve de Rhumatologie\nCompléments multiples\n30) L'ostéomalacie se manifeste par :\n• Des douleurs osseuses diffuses\n• Des stries de Looser-Milkman\n• Une hypovitaminose D\n• Une ostéomalacie axiale\n• Une hypophosphatémie",
    };
    const osteoAnalysis = computeCorpusAnalysis("Rhumatologie", [osteoLesson], [osteoAnnale]);

    mocks.invoke.mockImplementation(async (fnName: string, opts?: any) => {
      if (fnName === "mor-chat") {
        const msgs = opts?.body?.messages || [];
        expect(msgs[0]?.role).toBe("system");
        expect(msgs[0]?.content).toContain("PLAN STRICT QUESTION PAR QUESTION");
        expect(msgs[msgs.length - 1]?.content).toContain("IMPÉRATIF FINAL");
        return {
          data: {
            reply:
              "Voici le QCM demandé :\n```json\n" +
              JSON.stringify({
                kind: "STANDALONE",
                header: "OSTEOMALACIE",
                items: [
                  {
                    format: "COMPLEMENT_MULTIPLE",
                    stem: "Concernant l'ostéomalacie, quelles propositions sont conformes au cours ?",
                    options: [
                      { letter: "A", text: "Un défaut de minéralisation osseuse de la trame ostéoïde" },
                      { letter: "B", text: "La présence de stries de Looser-Milkman à la radiographie" },
                      { letter: "C", text: "Une hypovitaminose D sévère associée" },
                      { letter: "D", text: "Une hyperminéralisation corticale diffuse constante" },
                      { letter: "E", text: "Une guérison spontanée constante sans vitaminothérapie" },
                    ],
                    correct: ["A", "B", "C"],
                    explanation: "Défaut de minéralisation, stries de Looser-Milkman et hypovitaminose D selon le cours.",
                  },
                ],
              }) +
              "\n```",
          },
          error: null,
        };
      }
      return {
        data: null,
        error: {
          status: 500,
          message: "OpenAI API error: Too Many Requests - billing_not_active",
        },
      };
    });

    const result = await generateExamBlanc({
      ueName: "TOR",
      subjectName: "Rhumatologie",
      selected: [osteoLesson],
      analysis: osteoAnalysis,
      sessionSeed: 9,
    });

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].items[0].correct).toEqual(["A", "B", "C"]);
  });

  test("verrouille mor-chat pour les sous-lots suivants après un échec generate-quiz et relance une réponse hors JSON", async () => {
    const osteoCourse =
      "L'ostéomalacie est caractérisée par un défaut de minéralisation osseuse de la trame ostéoïde, des douleurs osseuses diffuses mécaniques, une démarche dandinante, des stries de Looser-Milkman et une hypocalcémie avec hypophosphatémie et élévation des phosphatases alcalines.";
    const osteoLesson = buildLesson("osteo3", "OSTEOMALACIE", osteoCourse, osteoCourse.length, "Rhumatologie");
    const osteoAnnale = {
      id: "annale-tor-multi",
      title: "Examen TOR 2025.pdf",
      year: "2025",
      wordCount: 95,
      sizeLabel: "3 Ko",
      rawText: [
        "EC3 : Epreuve de Rhumatologie",
        "Compléments multiples",
        "30) Signes cliniques de l'ostéomalacie :\n• Douleurs osseuses diffuses\n• Démarche dandinante\n• Myopathie proximale\n• Hypercalcémie\n• Fièvre isolée",
        "31) Signes radiologiques de l'ostéomalacie :\n• Stries de Looser-Milkman\n• Hypertransparence diffuse\n• Bassin en cœur de carte à jouer\n• Condensation diffuse\n• Géodes sous-chondrales",
        "32) Signes biologiques de l'ostéomalacie :\n• Hypocalcémie\n• Hypophosphatémie\n• Phosphatases alcalines élevées\n• Hypercalciurie\n• Hypervitaminose D",
      ].join("\n"),
    };
    const osteoAnalysis = computeCorpusAnalysis("Rhumatologie", [osteoLesson], [osteoAnnale]);
    let generateQuizCalls = 0;
    let morChatCalls = 0;

    mocks.invoke.mockImplementation(async (fnName: string) => {
      if (fnName === "generate-quiz") {
        generateQuizCalls++;
        return {
          data: null,
          error: { status: 500, message: "OpenAI API error: billing_not_active" },
        };
      }
      if (fnName === "mor-chat") {
        morChatCalls++;
        if (morChatCalls === 1) {
          // Simule une réponse en prose hors JSON au premier essai : doit être récupérée automatiquement
          return { data: { reply: "Voici deux questions en texte libre sans JSON." }, error: null };
        }
        if (morChatCalls === 2) {
          return {
            data: {
              reply: JSON.stringify({
                kind: "STANDALONE",
                header: "OSTEOMALACIE",
                items: [
                  {
                    format: "COMPLEMENT_MULTIPLE",
                    stem: "Quelles anomalies cliniques orientent vers une ostéomalacie ?",
                    options: [
                      { letter: "A", text: "Des douleurs osseuses diffuses mécaniques" },
                      { letter: "B", text: "Une démarche dandinante par faiblesse proximale" },
                      { letter: "C", text: "Une hypercalcémie symptomatique constante" },
                      { letter: "D", text: "Une monoarthrite aiguë fébrile" },
                      { letter: "E", text: "Des tophi goutteux sous-cutanés" },
                    ],
                    correct: ["A", "B"],
                    explanation: "Douleurs osseuses diffuses mécaniques et démarche dandinante.",
                  },
                  {
                    format: "COMPLEMENT_MULTIPLE",
                    stem: "Quels éléments biologiques caractérisent l'ostéomalacie carentielle ?",
                    options: [
                      { letter: "A", text: "Une hypocalcémie" },
                      { letter: "B", text: "Une hypophosphatémie" },
                      { letter: "C", text: "Une élévation des phosphatases alcalines" },
                      { letter: "D", text: "Une hypercalcémie maligne" },
                      { letter: "E", text: "Une diminution des phosphatases alcalines" },
                    ],
                    correct: ["A", "B", "C"],
                    explanation: "Hypocalcémie, hypophosphatémie et élévation des phosphatases alcalines.",
                  },
                ],
              }),
            },
            error: null,
          };
        }
        return {
          data: {
            reply: JSON.stringify({
              kind: "STANDALONE",
              header: "OSTEOMALACIE",
              items: [
                {
                  format: "COMPLEMENT_MULTIPLE",
                  stem: "Concernant la minéralisation et l'imagerie de l'ostéomalacie, quelles propositions sont exactes ?",
                  options: [
                    { letter: "A", text: "Un défaut de minéralisation osseuse de la trame ostéoïde" },
                    { letter: "B", text: "Des stries de Looser-Milkman visibles à la radiographie" },
                    { letter: "C", text: "Une ostéocondensation diffuse constante" },
                    { letter: "D", text: "Un bilan phosphocalcique strictement normal" },
                    { letter: "E", text: "Une hyperminéralisation corticale isolée" },
                  ],
                  correct: ["A", "B"],
                  explanation: "Défaut de minéralisation et stries de Looser-Milkman.",
                },
              ],
            }),
          },
          error: null,
        };
      }
      return { data: null, error: { message: "Endpoint inattendu" } };
    });

    const result = await generateExamBlanc({
      ueName: "TOR",
      subjectName: "Rhumatologie",
      selected: [osteoLesson],
      analysis: osteoAnalysis,
      sessionSeed: 11,
    });

    expect(generateQuizCalls).toBe(1); // Plus jamais rappelé pour le 2e sous-lot !
    expect(morChatCalls).toBe(3); // 1 prose + 1 retry JSON sur sous-lot 1 + 1 appel direct sur sous-lot 2
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].items).toHaveLength(3);
  });
});

describe("Résolution serveur finale sans corrigé", () => {
  test.each(["valide", "citation inventée", "désaccord", "ambiguïté", "relecture absente"])('%s après réparation', async (scenario) => {
    const block = validBlock();
    const review = structuredClone(block.validation);
    if (scenario === "citation inventée") review.items[0].optionVerdicts[0].sourceQuote = "La somme des angles d’un triangle euclidien vaut 200 degrés.";
    if (scenario === "désaccord") review.items[0].correct = ["B"];
    if (scenario === "ambiguïté") review.items[0].unambiguous = false;
    if (scenario === "relecture absente") review.items = [];

    const sonnet = vi.fn(async (params: { userPrompt: string }) => {
      if (params.userPrompt.includes("QUESTIONS SANS CORRIGÉ")) {
        const questions = JSON.parse(params.userPrompt.split("QUESTIONS SANS CORRIGÉ :\n")[1]);
        expect(questions.items[0]).not.toHaveProperty("correct");
        expect(questions.items[0]).not.toHaveProperty("explanation");
        expect(questions).not.toHaveProperty("validation");
        return { data: review, provider: "anthropic", model: "claude-sonnet-4-6", slotIndex: 1, totalSlots: 1 };
      }
      return { data: block, provider: "anthropic", model: "claude-sonnet-4-6", slotIndex: 1, totalSlots: 1 };
    });
    const gemini = vi.fn(async () => ({
      data: { repairedDraft: block, items: block.validation.items },
      provider: "gemini", model: "gemini-2.5-flash", slotIndex: 1, totalSlots: 1,
    }));
    const result = await handleGenerateExamenBlancBlock({
      lessonTitle: "Géométrie", subjectName: "Mathématiques", lessonContent: course, blueprintSpec: spec,
    }, {
      callSonnetJson: sonnet as ExamenBlancPipelineDeps["callSonnetJson"],
      callGeminiJson: gemini as ExamenBlancPipelineDeps["callGeminiJson"],
      getPoolSummary: () => ({ sonnetKeysCount: 1, geminiKeysCount: 1, hasOpenAiFallback: false }),
    });
    expect(sonnet).toHaveBeenCalledTimes(3);
    expect(gemini).toHaveBeenCalledTimes(1);
    if (scenario === "valide") {
      expect(result.error).toBeUndefined();
      expect(result.block?.validation.differentModel).toBe(true);
      expect(result.block?.validation.items).toEqual(review.items);
      expect(result.block?.items[0].options).toEqual(block.items[0].options);
    } else {
      expect(result.status).toBe(422);
      expect(result.block).toBeUndefined();
    }
  });

  const annaleStyleReferences = [{
    format: "ELECTION",
    stem: "Quelle est la somme des angles d’un triangle euclidien ?",
    optionTexts: ["180 degrés", "90 degrés", "360 degrés", "270 degrés", "120 degrés"],
    source: { title: "Géométrie", questionNumber: 1, lineStart: 1, lineEnd: 1, quote: "Quelle est la somme des angles d’un triangle euclidien ?" },
  }];

  test("injecte les mesures de style et les exemples localisés dans le prompt de rédaction", async () => {
    const block = validBlock();
    const sonnet = vi.fn(async (params: { userPrompt: string }) => ({
      data: params.userPrompt.includes("QUESTIONS") ? block.validation : block,
      provider: "anthropic", model: "claude-sonnet-4-6", slotIndex: 1, totalSlots: 1,
    }));
    const gemini = vi.fn(async () => ({
      data: { repairedDraft: block, items: block.validation.items },
      provider: "gemini", model: "gemini-2.5-flash", slotIndex: 1, totalSlots: 1,
    }));
    const result = await handleGenerateExamenBlancBlock({
      lessonTitle: "Géométrie", subjectName: "Mathématiques", lessonContent: course, blueprintSpec: spec,
      styleReferences: annaleStyleReferences,
    }, {
      callSonnetJson: sonnet as ExamenBlancPipelineDeps["callSonnetJson"],
      callGeminiJson: gemini as ExamenBlancPipelineDeps["callGeminiJson"],
      getPoolSummary: () => ({ sonnetKeysCount: 1, geminiKeysCount: 1, hasOpenAiFallback: false }),
    });
    expect(result.error).toBeUndefined();
    const draftPrompt = (sonnet.mock.calls[0][0] as { systemPrompt: string }).systemPrompt;
    expect(draftPrompt).toContain("STYLE MESURÉ SUR LES ANNALES");
    expect(draftPrompt).toContain("ligne 1");
    expect(draftPrompt).toContain("ne recopie aucune question d’annale");
  });

  test("rejette côté serveur un brouillon recopié d’une annale (422)", async () => {
    const block = validBlock();
    block.items[0].stem = "Quelle est la somme des angles d’un triangle euclidien ?";
    const sonnet = vi.fn(async (params: { userPrompt: string }) => ({
      data: params.userPrompt.includes("QUESTIONS") ? block.validation : block,
      provider: "anthropic", model: "claude-sonnet-4-6", slotIndex: 1, totalSlots: 1,
    }));
    const gemini = vi.fn(async () => ({
      data: { repairedDraft: block, items: block.validation.items },
      provider: "gemini", model: "gemini-2.5-flash", slotIndex: 1, totalSlots: 1,
    }));
    const result = await handleGenerateExamenBlancBlock({
      lessonTitle: "Géométrie", subjectName: "Mathématiques", lessonContent: course, blueprintSpec: spec,
      styleReferences: annaleStyleReferences,
    }, {
      callSonnetJson: sonnet as ExamenBlancPipelineDeps["callSonnetJson"],
      callGeminiJson: gemini as ExamenBlancPipelineDeps["callGeminiJson"],
      getPoolSummary: () => ({ sonnetKeysCount: 1, geminiKeysCount: 1, hasOpenAiFallback: false }),
    });
    expect(result.status).toBe(422);
    expect(result.block).toBeUndefined();
    expect((result.issues || []).join(" ")).toContain("recopiée");
  });

  test("atteste une passe séparée mais pas un autre modèle si un seul est disponible", async () => {
    const block = validBlock();
    const sonnet = vi.fn(async (params: { userPrompt: string }) => ({
      data: params.userPrompt.includes("QUESTIONS") ? block.validation : block,
      provider: "anthropic", model: "claude-sonnet-4-6", slotIndex: 1, totalSlots: 1,
    }));
    const result = await handleGenerateExamenBlancBlock({
      lessonTitle: "Géométrie", subjectName: "Mathématiques", lessonContent: course, blueprintSpec: spec,
    }, {
      callSonnetJson: sonnet as ExamenBlancPipelineDeps["callSonnetJson"],
      getPoolSummary: () => ({ sonnetKeysCount: 1, geminiKeysCount: 0, hasOpenAiFallback: false }),
    });
    expect(result.error).toBeUndefined();
    expect(result.block?.validation.differentModel).toBe(false);
    expect(sonnet.mock.calls.at(-1)?.[0].userPrompt).not.toContain('"correct":');
  });
});

describe("Fréquences observées", () => {
  test("aucune probabilité n’est inventée en l’absence d’annales", () => {
    expect(getObservedLessonFrequency({ examsAppeared: 0, totalExams: 0 })).toBeNull();
    const lesson = buildLesson("droit", "Droit", "Le contrat est un accord de volontés. ".repeat(500), 1000, "Droit");
    expect(computeCorpusAnalysis("Droit", [lesson], []).lessonStats[0].percent).toBeNull();
  });
  test("la fréquence est le rapport d’épreuves, sans pondération cachée", () => {
    expect(getObservedLessonFrequency({ examsAppeared: 2, totalExams: 5 })).toBe(40);
    expect(getObservedLessonFrequency({ examsAppeared: 5, totalExams: 5 })).toBe(100);
    expect(getObservedLessonFrequency({ examsAppeared: 0, totalExams: 5 })).toBe(0);
  });
});

const parseFixture = (text: string, subject = "Mathématiques") => parseUniversalExamAnnale(text, [], subject, new Map());
const fixtureQuestion = (number: number, format = "ELECTION", count = 4, stem = "Quel résultat est exact selon le document ?") =>
  `QCM ${number}. ${format} - ${stem}\n${Array.from({ length: count }, (_, index) => `${"ABCDEFGHIJ"[index]}. Proposition ${index + 1}`).join("\n")}`;
const observed = (overrides: Partial<ObservedExamQuestion> = {}): ObservedExamQuestion => ({
  number: 1, format: "ELECTION", optionCount: 4, inCase: false, stem: "Quel résultat est exact selon le cours ?", sourceTitle: "Annale", ...overrides,
});

describe("Parseur multidisciplinaire et annales réelles", () => {
  test.each([
    ["Mathématiques", "MATIERE : MATHEMATIQUES", "Dossier 1 : Un géomètre étudie une parcelle triangulaire de dimensions connues dans le plan euclidien."],
    ["Droit civil", "I - DROIT CIVIL", "Cas pratique 1 : Un acquéreur et un vendeur signent un contrat contenant plusieurs clauses discutées."],
    ["Histoire", "PARTIE : HISTOIRE", "Dossier documentaire 1 : Un historien compare deux documents présentant des dates et des interprétations différentes."],
    ["Cardiologie", "EC 1 : CARDIOLOGIE", "Cas clinique 1 : Un patient consulte pour une douleur thoracique dont les caractéristiques sont précisées."],
  ])("sépare dossiers et QCM indépendants en %s", (subject, heading, dossier) => {
    const parsed = parseFixture(`${heading}\n${dossier}\n${fixtureQuestion(1)}\n${fixtureQuestion(2, "CENSURE", 6, "Quelle proposition de ce dossier est fausse ?")}\nQUESTIONS ISOLEES\n${fixtureQuestion(3, "COMPLEMENT_MULTIPLE", 3)}`, subject);
    expect(parsed.observedQuestions.map((q) => [q.format, q.optionCount, q.inCase])).toEqual([
      ["ELECTION", 4, true], ["CENSURE", 6, true], ["COMPLEMENT_MULTIPLE", 3, false],
    ]);
    expect(parsed.caseCount).toBe(1);
    const design = createExamDesign({ lessonIds: ["chapitre"], questions: parsed.observedQuestions, referenceQuestionCount: 3, hasAnnales: true });
    expect(design.caseQuestions).toBe(2);
    expect(design.formatCounts).toEqual({ ELECTION: 1, CENSURE: 1, COMPLEMENT_MULTIPLE: 1 });
    expect(design.optionCounts).toEqual({ 3: 1, 4: 1, 6: 1 });
  });

  test("conserve le premier token des propositions (nombres et texte) pour les mesures de style", () => {
    const parsed = parseFixture(
      "QCM 1. ELECTION - Quelle est la somme des angles d'un triangle euclidien ?\nA. 180 degrés\nB. 90 degrés\nC. 360 degrés\nD. 270 degrés\nE. 120 degrés\n\nQCM 2. ELECTION - Quel nombre est premier ?\nA. 15\nB. 21\nC. 17\nD. 27\nE. 33\n\nQCM 3. ELECTION - Quelle proposition est exacte ?\n(A) Facteurs rhumatoïdes positifs\n(B) Atteinte exclusive des interphalangiennes distales\n(C) Absence de raideur matinale\n(D) Guérison en deux jours"
    );
    expect(parsed.observedQuestions[0].optionTexts).toEqual(["180 degrés", "90 degrés", "360 degrés", "270 degrés", "120 degrés"]);
    expect(parsed.observedQuestions[1].optionTexts).toEqual(["15", "21", "17", "27", "33"]);
    expect(parsed.observedQuestions[2].optionTexts).toEqual(["Facteurs rhumatoïdes positifs", "Atteinte exclusive des interphalangiennes distales", "Absence de raideur matinale", "Guérison en deux jours"]);
  });

  test("isole le droit civil sans absorber le droit pénal ni prendre les cas pour des matières", () => {
    const text = `PARTIE : DROIT CIVIL\nCas pratique 1 : Un vendeur et un acquéreur ont signé un contrat dont une clause est contestée.\n${fixtureQuestion(1)}\nII - DROIT PENAL\n${fixtureQuestion(2)}`;
    expect(parseFixture(text, "Droit civil").observedQuestions.map((q) => q.number)).toEqual([1]);
    expect(parseFixture(text, "Droit pénal").observedQuestions.map((q) => q.number)).toEqual([2]);
    expect(parseFixture(text, "Géographie").isOtherSubjectOnly).toBe(true);
  });

  test("préserve les étiquettes explicites et les choix numérotés", () => {
    const parsed = parseFixture("QCM 1. COMPLEMENT_MULTIPLE - Quelles propriétés sont exactes ?\n1. Valeur positive\n2. Valeur entière\n3. Valeur réelle\n4. Valeur complexe\n5. Valeur nulle\nQCM 2. JUMELAGE - Deux assertions PARCE QUE une relation causale est proposée.");
    expect(parsed.observedQuestions.map((q) => [q.format, q.optionCount])).toEqual([["COMPLEMENT_MULTIPLE", 5], ["JUMELAGE", 5]]);
    expect(parsed.observedQuestions[0].stem).toBe("Quelles propriétés sont exactes ?");
  });

  test.each([
    ["exam_2018_hemato", "Hématologie clinique", [[1, 9], [17, 20]]],
    ["eval_2022_hemato_ms", "Hématologie clinique", [[1, 5], [6, 10]]],
    ["exam_2022_ms", "Maladies de système", [[6, 10], [11, 15], [16, 22]]],
    ["eval_2022_hemato_ms", "Maladies de système", [[6, 10], [11, 15], [16, 22]]],
  ])("délimite les dossiers de %s pour %s", (key, subject, expected) => {
    const parsed = parseFixture(VERIFIED_SCANNED_EXAMS_CORPUS[key], subject);
    const cases = new Map<string, number[]>();
    for (const question of parsed.observedQuestions) if (question.caseKey) cases.set(question.caseKey, [...(cases.get(question.caseKey) || []), question.number]);
    expect([...cases.values()].map((numbers) => [numbers[0], numbers.at(-1)])).toEqual(expected);
  });

  test("ne transforme pas une légende de code personnalisée en options de la question précédente", () => {
    const parsed = parseFixture(VERIFIED_SCANNED_EXAMS_CORPUS.eval_2019_hemato_ms, "Hématologie clinique");
    expect(parsed.detectedGroupageCode).toContain("B : 2+4");
    expect(parsed.observedQuestions.filter((q) => q.format === "GROUPAGE").every((q) => q.optionCount === 5)).toBe(true);
    expect(parsed.observedQuestions.find((q) => q.number === 13)?.optionCount).toBe(5);
  });

  test("signale les formats lisibles sans choix et les numéros sans structure", () => {
    const parsed = parseFixture("QCM 1. GROUPAGE - Quelles assertions sont exactes ?\nQCM 2. Énoncé tronqué sans réponse lisible.");
    expect(parsed.observedQuestions[0].optionCount).toBe(0);
    expect(parsed.skippedNumbers).toEqual([2]);
    expect(parsed.questionCount).toBe(1);
  });
});

describe("Plan d’épreuve mesuré, sans extrapolation cachée", () => {
  test("répartit par plus grands restes sans dépasser le total", () => {
    expect(apportionExamCounts([1, 1, 1], 2)).toEqual([1, 1, 0]);
    expect(apportionExamCounts([1, 99], 45)).toEqual([0, 45]);
  });

  test.each([1, 2, 7, 20, 45])("conserve le total, les sous-formats et chaque chapitre (%i chapitres)", (chapterCount) => {
    const questions = Array.from({ length: 20 }, (_, index) => observed({ number: index + 1, inCase: index < 12, caseKey: index < 12 ? `dossier_${Math.floor(index / 4)}` : undefined, format: index % 2 ? "CENSURE" : "ELECTION", optionCount: index % 2 ? 6 : 4 }));
    const design = createExamDesign({ lessonIds: Array.from({ length: chapterCount }, (_, index) => `c${index}`), questions, referenceQuestionCount: 20, hasAnnales: true });
    expect(design.blocks.reduce((sum, block) => sum + block.formats.length, 0)).toBe(design.totalQuestions);
    expect(new Set(design.blocks.flatMap((block) => block.lessonIds)).size).toBe(chapterCount);
    for (const block of design.blocks) {
      expect(block.lessonIds).toHaveLength(1);
      expect(block.formats.length).toBe(block.optionCounts.length);
      expect(block.formats.length).toBe(block.targetItemCount);
    }
    expect(Object.values(design.formatCounts).reduce((sum, count) => sum + count, 0)).toBe(design.totalQuestions);
  });

  test("annonce les formats trop rares au lieu de les majorer", () => {
    const questions = [observed({ format: "JUMELAGE", optionCount: 5 }), ...Array.from({ length: 99 }, () => observed())];
    const design = createExamDesign({ lessonIds: ["c1"], questions, referenceQuestionCount: 45, hasAnnales: true });
    expect(design.formatCounts.JUMELAGE).toBeUndefined();
    expect(design.warnings.join(" ")).toContain("trop rares");
  });

  test("exclut les QNS et les structures illisibles sans les convertir", () => {
    const design = createExamDesign({ lessonIds: ["c1"], questions: [observed(), observed({ format: "QNS", optionCount: 0 }), observed({ format: "GROUPAGE", optionCount: 0 })], referenceQuestionCount: 3, hasAnnales: true });
    expect(design.formatCounts).toEqual({ ELECTION: 3 });
    expect(design.warnings.join(" ")).toContain("rédactionnelle");
    expect(design.warnings.join(" ")).toContain("Choix illisibles");
    const training = createExamDesign({ lessonIds: ["c1"], questions: [], referenceQuestionCount: 0, hasAnnales: false });
    expect(training.caseQuestions).toBe(0);
    expect(training.mode).toBe("training");
    expect(training.totalQuestions).toBe(12);
  });

  test("bloque une estimation IA sans extraction complète et une analyse ancienne", () => {
    const lesson = buildLesson("c1", "Géométrie", course, 50, "Mathématiques");
    const annale = { id: "a1", title: "Géométrie", year: "2026", rawText: fixtureQuestion(1), wordCount: 40, sizeLabel: "1 Ko" };
    const analysis = computeCorpusAnalysis("Mathématiques", [lesson], [annale], { a1: { questionCount: 20, caseCount: 0, formatCounts: { ELECTION: 20 } } });
    expect(analysis.exams[0].structureComplete).toBe(false);
    expect(analysis.formatDistribution).toEqual({});
    expect(() => buildExamDesign(analysis, [lesson.id])).toThrow("Aucune structure");
    delete analysis.exams[0].observedQuestions;
    expect(() => buildExamDesign(analysis, [lesson.id])).toThrow("version antérieure");
  });
});

describe("Contrat serveur multidisciplinaire", () => {
  test.each([undefined, [], [1], [11], [3.5], [4, 5]])("rejette les nombres de choix invalides : %j", async (optionCounts) => {
    const call = vi.fn();
    const result = await handleGenerateExamenBlancBlock({ lessonContent: course, blueprintSpec: { ...spec, optionCounts } }, { callSonnetJson: call as any, getPoolSummary: () => ({ sonnetKeysCount: 1, geminiKeysCount: 0, hasOpenAiFallback: false }) });
    expect(result.status).toBe(400);
    expect(call).not.toHaveBeenCalled();
  });

  test("ne fabrique ni code de groupage ni options manquantes", async () => {
    const groupSpec = { kind: "STANDALONE", formats: ["GROUPAGE"], optionCounts: [5] };
    const result = await handleGenerateExamenBlancBlock({ lessonContent: course, blueprintSpec: groupSpec }, { callSonnetJson: vi.fn() as any, getPoolSummary: () => ({ sonnetKeysCount: 1, geminiKeysCount: 0, hasOpenAiFallback: false }) });
    expect(result.status).toBe(400);
    const block = validBlock();
    block.items[0].format = "GROUPAGE";
    block.items[0].options = [];
    expect(sanitizeExamDraft(block, groupSpec, "")?.items[0].options).toEqual([]);
  });

  test("préserve les petites valeurs numériques et les erreurs de format pour la validation", () => {
    const block = validBlock();
    block.items[0].options.forEach((option, index) => { option.text = String(index); });
    const cleaned = sanitizeExamDraft(block, spec, "")!;
    expect(cleaned.items[0].options.map((option) => option.text)).toEqual(["0", "1", "2", "3", "4"]);
    block.items[0].format = "CENSURE";
    expect(validateExamDraft(sanitizeExamDraft(block, spec, ""), spec).join(" ")).toContain("format non conforme");
  });

  test.each([
    ["Mathématiques", "Recalcule les résultats", 3],
    ["Droit civil", "N’invente aucun article", 6],
    ["Histoire", "Distingue les faits", 4],
    ["Cardiologie", "respecte les critères", 5],
  ])("propage les consignes et le nombre exact de choix en %s", async (subject, directive, count) => {
    const block = validBlock();
    block.items[0].options = Array.from({ length: count }, (_, index) => ({ letter: "ABCDEFGHIJ"[index], text: `${index * 30} degrés` }));
    block.validation.items[0].optionVerdicts = block.items[0].options.map((option) => ({ letter: option.letter, isTrue: option.letter === "A", reason: "Verdict simulé pour le contrat.", sourceQuote: course.slice(0, 75) }));
    const sonnet = vi.fn(async (params: any) => ({ data: params.userPrompt.includes("QUESTIONS SANS CORRIGÉ") ? block.validation : block, provider: "anthropic", model: "draft", slotIndex: 1, totalSlots: 1 }));
    const gemini = vi.fn(async () => ({ data: { repairedDraft: block, items: block.validation.items }, provider: "gemini", model: "review", slotIndex: 1, totalSlots: 1 }));
    const result = await handleGenerateExamenBlancBlock({ subjectName: subject, lessonContent: course, blueprintSpec: { ...spec, optionCounts: [count] } }, { callSonnetJson: sonnet as any, callGeminiJson: gemini as any, getPoolSummary: () => ({ sonnetKeysCount: 1, geminiKeysCount: 1, hasOpenAiFallback: false }) });
    expect(result.error).toBeUndefined();
    expect(result.block?.items[0].options).toHaveLength(count);
    expect(examDisciplineDirectives(subject)).toContain(directive);
    expect(sonnet.mock.calls[0][0].systemPrompt).toContain(directive);
    expect(sonnet.mock.calls[1][0].systemPrompt).toContain(`${count} choix`);
    expect(sonnet.mock.calls.at(-1)![0].userPrompt).not.toContain('"correct":');
  });

  test("accepte un groupage sans Autres choix mais refuse un code différent des annales", () => {
    const block = validBlock();
    const item = block.items[0];
    item.format = "GROUPAGE";
    item.statements = ["Assertion un", "Assertion deux", "Assertion trois", "Assertion quatre", "Assertion cinq"];
    item.options = ["1+2+3", "2+4", "3", "1+5", "1+4"].map((text, index) => ({ letter: "ABCDE"[index], text }));
    item.groupageCodeHint = "A : 1+2+3 B : 2+4 C : 3 D : 1+5 E : 1+4";
    const groupSpec = { ...spec, formats: ["GROUPAGE"], groupageCode: item.groupageCodeHint };
    expect(validateExamDraft(block, groupSpec)).toEqual([]);
    groupSpec.groupageCode = "A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix";
    expect(validateExamDraft(block, groupSpec).join(" ")).toContain("celui des annales");
  });
});
