import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { validateReviewedExamBlock, type ReviewedExamBlock } from "../supabase/functions/_shared/exam-validation";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
  },
}));
vi.mock("idb-keyval", () => ({ get: vi.fn(), set: vi.fn() }));

import {
  buildExamDesign,
  buildLesson,
  computeCorpusAnalysis,
  parseUniversalExamAnnale,
} from "../src/lib/examenBlancEngine";
import {
  cleanOptionPrefix,
  extractCleanCourseBody,
  handleAuditExamAnnale,
  handleGenerateExamenBlancBlock,
  handleVisionOcrExtract,
} from "../supabase/functions/_shared/examen-blanc-ai";
import {
  callGemini25Json,
  callSonnet46Json,
  getAiPoolSummary,
  resetPoolCursorsForTest,
  resolveGeminiRepairKeyPool,
  resolveSonnetKeyPool,
  splitEnvKeys,
} from "../supabase/functions/_shared/sonnet-pool";

const ENV_KEYS_TO_CLEAR = [
  "SONNET_API_KEY",
  "SONNET_API_KEYS",
  "SONNET_API_KEY_1",
  "SONNET_API_KEY_2",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_API_KEYS",
  "ANTHROPIC_API_KEY_1",
  "ANTHROPIC_API_KEY_2",
  "ANTHROPIC_API_KEY_3",
  "CLAUDE_API_KEY",
  "CLAUDE_API_KEYS",
  "OPENROUTER_SONNET_API_KEY",
  "OPENROUTER_SONNET_API_KEYS",
  "OPENROUTER_API_KEY",
  "OPENROUTER_API_KEYS",
  "GEMINI_API_KEY",
  "GEMINI_API_KEYS",
  "GEMINI_API_KEY_1",
  "GEMINI_API_KEY_2",
  "GOOGLE_API_KEY",
  "OPENROUTER_GEMINI_API_KEY",
  "LOVABLE_API_KEY",
];

function clearAiEnv() {
  for (const name of ENV_KEYS_TO_CLEAR) {
    delete process.env[name];
  }
}

beforeEach(() => {
  clearAiEnv();
  resetPoolCursorsForTest();
});

afterEach(() => {
  clearAiEnv();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Pool multi-clés Sonnet 4.6 & Gemini 2.5", () => {
  test("splitEnvKeys découpe virgules, retours à la ligne, points-virgules et déduplique les clés", () => {
    const keys = splitEnvKeys("sk-ant-key-111111, sk-ant-key-222222;\nsk-or-v1-333333|short");
    expect(keys).toEqual(["sk-ant-key-111111", "sk-ant-key-222222", "sk-or-v1-333333"]);
  });

  test("agrège 5 clés Sonnet 4.6 hétérogènes (Anthropic directes + OpenRouter + numérotées)", () => {
    process.env.ANTHROPIC_API_KEYS = "sk-ant-api03-slot-one-aaaa, sk-ant-api03-slot-two-bbbb";
    process.env.SONNET_API_KEY_1 = "sk-or-v1-slot-three-ccccc";
    process.env.CLAUDE_API_KEY = "sk-ant-api03-slot-four-dddd";
    process.env.OPENROUTER_SONNET_API_KEY = "sk-or-v1-slot-five-eeeee";
    // Doublon volontaire à ignorer
    process.env.ANTHROPIC_API_KEY_1 = "sk-ant-api03-slot-one-aaaa";

    const pool = resolveSonnetKeyPool();
    expect(pool).toHaveLength(5);
    expect(pool.map((p) => p.provider)).toEqual([
      "openrouter",
      "anthropic",
      "anthropic",
      "anthropic",
      "openrouter",
    ]);
    expect(pool.map((p) => p.slotIndex)).toEqual([1, 2, 3, 4, 5]);
    expect(getAiPoolSummary().sonnetKeysCount).toBe(5);
  });

  test("bascule automatiquement entre les 5 clés Sonnet 4.6 sur 429/503 et assure la rotation", async () => {
    process.env.SONNET_API_KEYS = [
      "sk-ant-api03-slot-1-aaaaaa",
      "sk-ant-api03-slot-2-bbbbbb",
      "sk-or-v1-slot-3-ccccccccc",
      "sk-ant-api03-slot-4-dddddd",
      "sk-ant-api03-slot-5-eeeeee",
    ].join(",");

    const calledSlots: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const usedKey = headers["x-api-key"] || String(headers["Authorization"] || "").replace("Bearer ", "");
      calledSlots.push(`${url.includes("openrouter") ? "openrouter" : "anthropic"}:${usedKey}`);

      if (usedKey.includes("slot-1")) {
        return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
      }
      if (usedKey.includes("slot-2")) {
        return new Response(JSON.stringify({ error: "overloaded" }), { status: 503 });
      }
      const payload = url.includes("openrouter")
        ? { choices: [{ message: { content: JSON.stringify({ ok: true, from: usedKey }) } }] }
        : { content: [{ type: "text", text: JSON.stringify({ ok: true, from: usedKey }) }] };
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await callSonnet46Json<{ ok: boolean; from: string }>({
      systemPrompt: "sys",
      userPrompt: "usr",
    });
    expect(first?.data.ok).toBe(true);
    expect(first?.data.from).toContain("slot-3");
    expect(first?.model).toBe("anthropic/claude-sonnet-4.6");
    expect(first?.totalSlots).toBe(5);
    expect(calledSlots).toHaveLength(3);

    // Second appel écarte automatiquement les slots 1 et 2 en cooldown (429/503) et utilise un slot sain (slot-3)
    fetchMock.mockImplementationOnce(async (_url, init) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const usedKey = headers["x-api-key"] || String(headers["Authorization"] || "").replace("Bearer ", "");
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ok: true, rotatedTo: usedKey }) } }] }),
        { status: 200 }
      );
    });
    const second = await callSonnet46Json<{ ok: boolean; rotatedTo: string }>({
      systemPrompt: "sys",
      userPrompt: "usr",
    });
    expect(second?.data.rotatedTo).toContain("slot-3");
  });

  test("résout les clés Gemini 2.5 dédiées à la correction anti-dégâts", async () => {
    process.env.GEMINI_API_KEYS = "AIzaSyGeminiKeyOne123456,AIzaSyGeminiKeyTwo123456";
    const pool = resolveGeminiRepairKeyPool();
    expect(pool).toHaveLength(2);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const headers = (init?.headers || {}) as Record<string, string>;
        const keyHeader = headers["x-goog-api-key"] || "";
        if (String(url).includes("One") || keyHeader.includes("One")) {
          return new Response("quota exceeded", { status: 429 });
        }
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ repaired: true }) }] } }],
          }),
          { status: 200 }
        );
      })
    );

    const res = await callGemini25Json<{ repaired: boolean }>({
      systemPrompt: "repair",
      userPrompt: "draft",
    });
    expect(res?.data.repaired).toBe(true);
    expect(res?.slotIndex).toBe(2);
  });
});

describe("Utilitaires de nettoyage & préservation médicale", () => {
  test("cleanOptionPrefix retire les marqueurs explicites mais préserve les termes cliniques (A jeun, E. coli, C-réactive)", () => {
    expect(cleanOptionPrefix("A. Poumon droit")).toBe("Poumon droit");
    expect(cleanOptionPrefix("B) Hypertension artérielle")).toBe("Hypertension artérielle");
    expect(cleanOptionPrefix("E. coli est le germe le plus fréquent")).toBe("E. coli est le germe le plus fréquent");
    expect(cleanOptionPrefix("A jeun, la glycémie dépasse 1,26 g/L")).toBe("A jeun, la glycémie dépasse 1,26 g/L");
    expect(cleanOptionPrefix("C-réactive protéine supérieure à 10 mg/L")).toBe("C-réactive protéine supérieure à 10 mg/L");
  });

  test("extractCleanCourseBody écarte les marqueurs synthétiques de fenêtre tournante", () => {
    const wrapped = `=== SECTIONS & FAITS VIERGES À INTERROGER EN PRIORITÉ ABSOLUE POUR CETTE SESSION N°1 ===
1. [Sémio] La lépre tuberculoïde touche les nerfs périphériques.

=== CONTENU DU COURS (FENÊTRE TOURNANTE N°1) ===
La lèpre est due à Mycobacterium leprae, bacille acido-alcoolo-résistant intracellulaire obligatoire.

=== SECTION SUIVANTE DU COURS ===

La réaction de Mitsuda est positive dans la forme tuberculoïde.`;

    const clean = extractCleanCourseBody(wrapped);
    expect(clean).not.toContain("SECTIONS & FAITS VIERGES");
    expect(clean).not.toContain("SECTION SUIVANTE DU COURS");
    expect(clean).toContain("Mycobacterium leprae");
    expect(clean).toContain("réaction de Mitsuda");
  });
});

describe("Pipeline strict Sonnet 4.6 -> Auto-correction Sonnet -> Correction Anti-Dégâts Gemini 2.5", () => {
  const courseText =
    "Le bacille de Hansen ou Mycobacterium leprae est un bacille acido-alcoolo-résistant à tropisme cutané et nerveux périphérique. " +
    "La forme tuberculoïde est paucibacillaire avec intradermoréaction de Mitsuda positive. " +
    "La forme lépromateuse est multibacillaire avec intradermoréaction de Mitsuda négative. " +
    "La rifampicine est bactéricide majeure sur Mycobacterium leprae.";

  const spec = { kind: "STANDALONE", formats: ["ELECTION"], optionCounts: [5] };

  test("exécute Sonnet Draft -> Sonnet Self-Correction -> Gemini 2.5 Repair qui corrige une erreur résiduelle de Sonnet", async () => {
    const callOrder: string[] = [];
    let reviewForBlindPass: ReviewedExamBlock["validation"]["items"] = [];

    const callSonnetMock = vi.fn(async (params: any) => {
      if (params.userPrompt.includes("QUESTIONS SANS CORRIGÉ")) {
        callOrder.push("sonnet_blind_review");
        expect(params.userPrompt).not.toContain('"correct":');
        expect(params.userPrompt).not.toContain('"explanation":');
        return {
          data: { items: reviewForBlindPass },
          provider: "sonnet-anthropic",
          model: "claude-sonnet-4-6",
          slotIndex: 3,
          totalSlots: 5,
        };
      }
      if (params.userPrompt.includes("TON BROUILLON INITIAL")) {
        callOrder.push("sonnet_self_correction");
        // Sonnet auto-corrige partiellement l'énoncé mais laisse une erreur de clé ("B" au lieu de "A")
        return {
          data: {
            kind: "STANDALONE",
            header: "Maladie de Hansen",
            items: [
              {
                format: "ELECTION",
                stem: "Quelle affirmation caractérise la lèpre tuberculoïde selon le cours ?",
                options: [
                  { letter: "A", text: "Elle est paucibacillaire avec intradermoréaction de Mitsuda positive" },
                  { letter: "B", text: "Elle est toujours multibacillaire avec Mitsuda négative" },
                  { letter: "C", text: "Elle épargne constamment les nerfs périphériques" },
                  { letter: "D", text: "Elle résiste systématiquement à la rifampicine" },
                  { letter: "E", text: "Elle est due à une mycobactérie extracellulaire stricte" },
                ],
                correct: ["B"], // Erreur volontaire laissée par Sonnet que Gemini 2.5 doit corriger
                explanation: "Correction initiale imparfaite.",
              },
            ],
          },
          provider: "sonnet-anthropic",
          model: "claude-sonnet-4-6",
          slotIndex: 2,
          totalSlots: 5,
        };
      }

      callOrder.push("sonnet_draft");
      return {
        data: {
          kind: "STANDALONE",
          header: "Maladie de Hansen",
          items: [
            {
              format: "ELECTION",
              stem: "Quelle affirmation caractérise la lèpre tuberculoïde ?",
              options: [
                { letter: "A", text: "Elle est paucibacillaire avec intradermoréaction de Mitsuda positive" },
                { letter: "B", text: "Elle est toujours multibacillaire avec Mitsuda négative" },
                { letter: "C", text: "Elle épargne constamment les nerfs périphériques" },
                { letter: "D", text: "Elle résiste systématiquement à la rifampicine" },
                { letter: "E", text: "Elle est due à une mycobactérie extracellulaire stricte" },
              ],
              correct: ["B"],
              explanation: "Brouillon initial.",
            },
          ],
        },
        provider: "sonnet-anthropic",
        model: "claude-sonnet-4-6",
        slotIndex: 1,
        totalSlots: 5,
      };
    });

    const callGeminiMock = vi.fn(async () => {
      callOrder.push("gemini_repair_and_verify");
      const response = {
        data: {
          repairedDraft: {
            kind: "STANDALONE",
            header: "Maladie de Hansen",
            items: [
              {
                format: "ELECTION",
                stem: "Quelle affirmation caractérise la lèpre tuberculoïde selon le cours ?",
                options: [
                  { letter: "A", text: "Elle est paucibacillaire avec intradermoréaction de Mitsuda positive" },
                  { letter: "B", text: "Elle est toujours multibacillaire avec Mitsuda négative" },
                  { letter: "C", text: "Elle épargne constamment les nerfs périphériques" },
                  { letter: "D", text: "Elle résiste systématiquement à la rifampicine" },
                  { letter: "E", text: "Elle est due à une mycobactérie extracellulaire stricte" },
                ],
                correct: ["A"], // Réparé par Gemini 2.5 !
                explanation: "La forme tuberculoïde est paucibacillaire avec réaction de Mitsuda positive.",
              },
            ],
          },
          repairsApplied: [
            {
              index: 0,
              issueDetected: "Sonnet avait coché B (forme lépromateuse) au lieu de A (forme tuberculoïde).",
              fixApplied: "Clé basculée sur A avec justification sourcée dans le cours.",
            },
          ],
          items: [
            {
              index: 0,
              answerable: true,
              unambiguous: true,
              correct: ["A"],
              explanation:
                "A est exacte : la forme tuberculoïde est paucibacillaire avec intradermoréaction de Mitsuda positive ; B décrit la forme lépromateuse ; C, D et E contredisent le cours.",
              optionVerdicts: [
                {
                  letter: "A",
                  isTrue: true,
                  reason: "Conforme au cours sur la forme tuberculoïde.",
                  sourceQuote: "La forme tuberculoïde est paucibacillaire avec intradermoréaction de Mitsuda positive.",
                },
                {
                  letter: "B",
                  isTrue: false,
                  reason: "Concerne la forme lépromateuse, non tuberculoïde.",
                  sourceQuote: "La forme lépromateuse est multibacillaire avec intradermoréaction de Mitsuda négative.",
                },
                {
                  letter: "C",
                  isTrue: false,
                  reason: "Le bacille a un tropisme nerveux périphérique.",
                  sourceQuote: "tropisme cutané et nerveux périphérique.",
                },
                {
                  letter: "D",
                  isTrue: false,
                  reason: "La rifampicine est au contraire bactéricide majeure.",
                  sourceQuote: "La rifampicine est bactéricide majeure sur Mycobacterium leprae.",
                },
                {
                  letter: "E",
                  isTrue: false,
                  reason: "Mycobacterium leprae est un bacille acido-alcoolo-résistant selon le cours.",
                  sourceQuote: "Mycobacterium leprae est un bacille acido-alcoolo-résistant",
                },
              ],
            },
          ],
        },
        provider: "gemini-gemini",
        model: "gemini-2.5-flash",
        slotIndex: 1,
        totalSlots: 1,
      };
      reviewForBlindPass = response.data.items;
      return response;
    });

    const result = await handleGenerateExamenBlancBlock(
      {
        action: "generate_examen_blanc_block",
        subjectName: "Infectiologie",
        lessonTitle: "La Lèpre",
        lessonContent: courseText,
        blueprintSpec: spec,
        sessionSeed: 1,
      },
      {
        callSonnetJson: callSonnetMock as any,
        callGeminiJson: callGeminiMock as any,
        getPoolSummary: () => ({ sonnetKeysCount: 5, geminiKeysCount: 1, hasOpenAiFallback: false }),
      }
    );

    expect(callOrder).toEqual(["sonnet_draft", "sonnet_self_correction", "gemini_repair_and_verify", "sonnet_blind_review"]);
    expect(result.error).toBeUndefined();
    expect(result.pipeline?.primaryModel).toBe("claude-sonnet-4-6");
    expect(result.pipeline?.sonnetSelfCorrected).toBe(true);
    expect(result.pipeline?.geminiRepaired).toBe(true);
    expect(result.pipeline?.geminiModel).toBe("gemini-2.5-flash");
    expect(result.pipeline?.repairsApplied).toHaveLength(1);

    const block = result.block as ReviewedExamBlock;
    expect(block.items[0].correct).toEqual(["A"]);
    expect(block.validation.differentModel).toBe(true);
    expect(validateReviewedExamBlock(block, spec, courseText)).toEqual([]);
  });

  test("handleAuditExamAnnale utilise Sonnet 4.6 en priorité et Gemini 2.5 pour réparer un audit incomplet", async () => {
    const sonnetAuditMock = vi.fn(async () => ({
      data: { questionCount: 10, caseCount: 2, ignoredReason: null, formatCounts: {} },
      provider: "sonnet-anthropic",
      model: "claude-sonnet-4-6",
      slotIndex: 1,
      totalSlots: 5,
    }));
    const geminiRepairMock = vi.fn(async () => ({
      data: {
        questionCount: 10,
        caseCount: 2,
        ignoredReason: null,
        formatCounts: { ELECTION: 6, GROUPAGE: 4 },
        lessonQcmCounts: { l1: { blocks: 2, qcm: 10, summary: "Cas complets" } },
      },
      provider: "gemini-gemini",
      model: "gemini-2.5-flash",
      slotIndex: 1,
      totalSlots: 1,
    }));

    const out = await handleAuditExamAnnale(
      {
        examTitle: "Annale UCAD",
        subjectName: "Orthopédie",
        examText: "Question 1... Question 2... Cas clinique détaillé sur les fractures de jambe...",
        lessons: [{ id: "l1", title: "Fractures" }],
      },
      {
        callSonnetJson: sonnetAuditMock as any,
        callGeminiJson: geminiRepairMock as any,
        getPoolSummary: () => ({ sonnetKeysCount: 5, geminiKeysCount: 1, hasOpenAiFallback: false }),
      }
    );

    expect(sonnetAuditMock).toHaveBeenCalledTimes(1);
    expect(geminiRepairMock).toHaveBeenCalledTimes(1);
    expect(out.formatCounts).toEqual({ ELECTION: 6, GROUPAGE: 4 });
    expect(out.audit.lessonQcmCounts.l1.qcm).toBe(10);
  });

  test("handleVisionOcrExtract tente Sonnet 4.6 Vision en premier puis bascule vers Gemini 2.5 Vision", async () => {
    const sonnetVisMock = vi.fn(async () => null);
    const geminiVisMock = vi.fn(async () => ({
      extractedText: "--- PAGE 1 ---\nQCM 1. Quel signe...",
      provider: "gemini-gemini",
      model: "gemini-2.5-flash",
    }));

    const res = await handleVisionOcrExtract(
      { mode: "annales", images: [{ pageNumber: 1, data: "ZmFrZQ==" }] },
      {
        callSonnetVision: sonnetVisMock as any,
        callGeminiVision: geminiVisMock as any,
        getPoolSummary: () => ({ sonnetKeysCount: 5, geminiKeysCount: 1, hasOpenAiFallback: false }),
      }
    );

    expect(sonnetVisMock).toHaveBeenCalledTimes(1);
    expect(geminiVisMock).toHaveBeenCalledTimes(1);
    expect(res.extractedText).toContain("QCM 1.");
  });
});

describe("Robustesse d’extraction des annales TOR / PDF réelles", () => {
  test("extrait les formats A/, (A), multi-colonnes (>8 espaces) et assertions 1-..4- et ignore les pics numériques hors séquence (49 avant 40)", () => {
    const messyExam = `SECTION : RHUMATOLOGIE
A=1+2+3 ; B=1+3 ; C=2+4 ; D=4 ; E=autres choix
1. Quelle affirmation concerne la polyarthrite rhumatoïde ?
A/ Destruction cartilagineuse            B/ Atteinte IPD prédominante
C/ Absence d'érosion osseuse             D/ Guérison spontanée constante
E/ Normocalcémie constante

2. Concernant la goutte aiguë (format entre parenthèses) :
(A) Microcristaux d'urate de sodium
(B) Cristaux de pyrophosphate carrés
(C) Atteinte préférentielle du poignet
(D) VS toujours normale
(E) Antibiothérapie systématique

3. Spondylarthrite ankylosante :
1- Sacro-iliite bilatérale
2- Enésite calcanéenne fréquente
3- Association fréquente à HLA-B27
4- Fracture pathologique d'emblée

35. Suivi biologique inflammatoire :
A. Élévation de la CRP
B. Syndrome inflammatoire biologique
49 / mn de fréquence respiratoire mesurée chez ce patient
C. Anémie inflammatoire possible
D. Ferritinémie abaissée constamment
E. Thrombopénie constante

40. Traitement de fond de la polyarthrite rhumatoïde :
- Méthotrexate en première intention
- Surveillance hépatique régulière
- Supplémentation en acide folique
- Corticothérapie prolongée forte dose seule`;

    const parsed = parseUniversalExamAnnale(messyExam, [], "Rhumatologie", new Map(), "evals TOR 2022.pdf");
    expect(parsed.skippedNumbers).toEqual([]);
    expect(parsed.questionCount).toBe(5);
    expect(parsed.observedQuestions.map((q) => q.format)).toEqual([
      "ELECTION",
      "ELECTION",
      "GROUPAGE",
      "ELECTION",
      "ELECTION",
    ]);
  });

  test("exclut l’annale du plan quand des questions du scan restent illisibles, sans tolérance de majorité", () => {
    const rheumaLesson = buildLesson(
      "pr",
      "Polyarthrite rhumatoïde",
      "La polyarthrite rhumatoïde est un rhumatisme inflammatoire chronique touchant les petites articulations des mains avec présence de facteurs rhumatoïdes et d'anticorps anti-CCP.".repeat(
        10
      ),
      1500,
      "Rhumatologie"
    );

    const validItems = Array.from({ length: 8 }, (_, idx) => {
      const n = idx + 1;
      return `QCM ${n}. Polyarthrite rhumatoïde : quelle proposition est exacte ?
A. Facteurs rhumatoïdes souvent positifs
B. Atteinte exclusive des articulations interphalangiennes distales
C. Absence constante de raideur matinale
D. Toujours guérie en deux jours
E. Aucune érosion visible radiologiquement`;
    }).join("\n\n");

    const partialScanText = `RHUMATOLOGIE\n${validItems}\n\nQCM 9. Enonce partiel illisible scan coupe...\n\nQCM 10. Fin de page scan illisible...`;
    const annale = {
      id: "tor-2023",
      title: "Evals TOR 2023.pdf",
      year: "2023",
      rawText: partialScanText,
      wordCount: 400,
      sizeLabel: "2 Ko",
    };

    const analysis = computeCorpusAnalysis("Rhumatologie", [rheumaLesson], [annale]);
    expect(analysis.exams[0].structureComplete).toBe(false);
    expect(analysis.formatDistribution.ELECTION || 0).toBe(0);
    expect(analysis.warnings.join(" ")).toContain("annale exclue du plan");
    expect(() => buildExamDesign(analysis, [rheumaLesson.id])).toThrow("Aucune structure de QCM exploitable");
  });

  test("récupère la structure via l’audit seulement si chaque énoncé est retrouvé mot pour mot (requestObservedQuestions)", async () => {
    const rheumaLesson = buildLesson(
      "spa",
      "Spondylarthrite ankylosante",
      "La spondylarthrite ankylosante touche le rachis et les articulations sacro-iliaques avec association fréquente au gène HLA-B27.".repeat(
        10
      ),
      1200,
      "Rhumatologie"
    );

    const weirdText = [
      "QCM 1. Quel élément caractérise la spondylarthrite ?",
      "A. Sacro-iliite bilatérale",
      "B. Microcristaux d'urate",
      ...Array.from({ length: 6 }, (_, i) => `Question ${i + 2}. Texte OCR en tableau sans préfixes A-E détectables localement sur la spondylarthrite ankylosante.`),
    ].join("\n\n");

    const sonnetMock = vi.fn(async (params: any) => {
      expect(params.systemPrompt).toContain("observedQuestions");
      return {
        data: {
          questionCount: 6,
          caseCount: 1,
          ignoredReason: null,
          formatCounts: { ELECTION: 4, GROUPAGE: 2 },
          lessonQcmCounts: { spa: { blocks: 2, qcm: 6, summary: "Spondylarthrite" } },
          observedQuestions: Array.from({ length: 6 }, (_, idx) => ({
            number: idx + 1,
            format: idx < 4 ? "ELECTION" : "GROUPAGE",
            optionCount: 5,
            inCase: idx < 2,
            caseKey: idx < 2 ? "dossier_1" : null,
            stem: idx === 0
              ? "Quel élément caractérise la spondylarthrite ?"
              : "Texte OCR en tableau sans préfixes A-E détectables localement sur la spondylarthrite ankylosante.",
            lessonId: "spa",
          })),
        },
        provider: "sonnet-anthropic",
        model: "claude-sonnet-4-6",
        slotIndex: 1,
        totalSlots: 5,
      };
    });

    const auditOut = await handleAuditExamAnnale(
      {
        examTitle: "Examen TOR 2025_extracted_04071605.pdf",
        subjectName: "Rhumatologie",
        examText: weirdText,
        requestObservedQuestions: true,
        lessons: [{ id: "spa", title: "Spondylarthrite ankylosante" }],
      },
      {
        callSonnetJson: sonnetMock as any,
        callGeminiJson: vi.fn() as any,
        getPoolSummary: () => ({ sonnetKeysCount: 5, geminiKeysCount: 1, hasOpenAiFallback: false }),
      }
    );

    const analysis = computeCorpusAnalysis(
      "Rhumatologie",
      [rheumaLesson],
      [
        {
          id: "tor-2025",
          title: "Examen TOR 2025_extracted_04071605.pdf",
          year: "2025",
          rawText: weirdText,
          wordCount: 300,
          sizeLabel: "2 Ko",
        },
      ],
      { "tor-2025": auditOut }
    );

    expect(analysis.exams[0].structureComplete).toBe(true);
    expect(analysis.exams[0].questionCount).toBe(6);
    expect(analysis.exams[0].aiRecovered).toBe(true);
    expect(analysis.exams[0].observedQuestions!.every((q) => q.aiRecovered && q.source)).toBe(true);
    expect(analysis.warnings.join(" ")).toContain("vérifiée mot pour mot");
    expect(analysis.formatDistribution).toEqual({ ELECTION: 4, GROUPAGE: 2 });
    const design = buildExamDesign(analysis, [rheumaLesson.id]);
    expect(design.totalQuestions).toBe(6);
  });

  test("refuse la récupération par audit quand les énoncés inventés ne sont pas retrouvés mot pour mot", async () => {
    const rheumaLesson = buildLesson(
      "spa",
      "Spondylarthrite ankylosante",
      "La spondylarthrite ankylosante touche le rachis et les articulations sacro-iliaques avec association fréquente au gène HLA-B27.".repeat(10),
      1200,
      "Rhumatologie"
    );
    const weirdText = [
      "QCM 1. Quel élément caractérise la spondylarthrite ?",
      "A. Sacro-iliite bilatérale",
      "B. Microcristaux d'urate",
      ...Array.from({ length: 6 }, (_, i) => `Question ${i + 2}. Texte OCR en tableau sans préfixes A-E détectables localement sur la spondylarthrite ankylosante.`),
    ].join("\n\n");

    const sonnetMock = vi.fn(async () => ({
      data: {
        questionCount: 6,
        caseCount: 1,
        ignoredReason: null,
        formatCounts: { ELECTION: 4, GROUPAGE: 2 },
        lessonQcmCounts: { spa: { blocks: 2, qcm: 6, summary: "Spondylarthrite" } },
        observedQuestions: Array.from({ length: 6 }, (_, idx) => ({
          number: idx + 1,
          format: "ELECTION",
          optionCount: 5,
          inCase: false,
          caseKey: null,
          stem: `Question inventée par le modèle ${idx + 1}`,
          lessonId: "spa",
        })),
      },
      provider: "sonnet-anthropic",
      model: "claude-sonnet-4-6",
      slotIndex: 1,
      totalSlots: 5,
    }));

    const auditOut = await handleAuditExamAnnale(
      {
        examTitle: "Examen TOR 2025_extracted_04071605.pdf",
        subjectName: "Rhumatologie",
        examText: weirdText,
        requestObservedQuestions: true,
        lessons: [{ id: "spa", title: "Spondylarthrite ankylosante" }],
      },
      {
        callSonnetJson: sonnetMock as any,
        callGeminiJson: vi.fn() as any,
        getPoolSummary: () => ({ sonnetKeysCount: 5, geminiKeysCount: 1, hasOpenAiFallback: false }),
      }
    );

    const analysis = computeCorpusAnalysis(
      "Rhumatologie",
      [rheumaLesson],
      [{ id: "tor-2025", title: "Examen TOR 2025_extracted_04071605.pdf", year: "2025", rawText: weirdText, wordCount: 300, sizeLabel: "2 Ko" }],
      { "tor-2025": auditOut }
    );

    expect(analysis.exams[0].structureComplete).toBe(false);
    expect(analysis.exams[0].aiRecovered).toBeFalsy();
    expect(analysis.warnings.join(" ")).toContain("récupération par audit refusée");
    expect(analysis.warnings.join(" ")).toContain("non retrouvées mot pour mot");
    expect(() => buildExamDesign(analysis, [rheumaLesson.id])).toThrow("Aucune structure de QCM exploitable");
  });

  test("reconnaît la numérotation 12/ et calcule les moyennes par épreuve (~7 élections, ~4 censures) en intégrant les cas rares (2024)", () => {
    const orthoLesson = buildLesson(
      "col-femur",
      "Fractures du col du fémur",
      "La fracture du col fémoral est classée selon Garden et Pauwels. Le risque majeur est la nécrose de la tête fémorale et la pseudarthrose du col.".repeat(
        10
      ),
      1400,
      "Orthopédie"
    );

    const makeExam = (year: string, sessionLabel: string, includeRare2024: boolean) => {
      const elections = Array.from({ length: 7 }, (_, i) => {
        const n = i + 1;
        return `${n}/ Fracture du col fémoral (${sessionLabel} Q${n}) : quelle proposition est exacte ?
A. La classification de Garden comporte quatre stades
B. Le déplacement est absent dans le stade IV
C. Le risque de nécrose céphalique est nul
D. L'ostéosynthèse est contre-indiquée chez le sujet jeune
E. La pseudarthrose n'existe jamais`;
      });
      const censures = Array.from({ length: 4 }, (_, i) => {
        const n = 8 + i;
        return `${n}/ Concernant la classification de Pauwels (${sessionLabel} Q${n}), indiquez la proposition fausse :
A. Elle mesure l'angle du trait de fracture avec l'horizontale
B. Un angle supérieur à 50 degrés expose à la pseudarthrose
C. Les forces de cisaillement augmentent avec la verticalité du trait
D. Elle évalue les lésions vasculaires artérielles fémorales superficielles
E. Elle guide l'indication biomécanique d'ostéosynthèse`;
      });
      const rare = includeRare2024
        ? [
            `12/ Quelles sont les deux complications évolutives classiques des fractures cervicales vraies du fémur (${sessionLabel}) ?
A. Nécrose ischémique de la tête fémorale
B. Pseudarthrose du col fémoral
C. Luxation antéro-interne de l'épaule
D. Syndrome du canal carpien
E. Rupture du tendon calcanéen`,
          ]
        : [];
      return `SECTION : ORTHOPEDIE\n${[...elections, ...censures, ...rare].join("\n\n")}`;
    };

    const annales = [
      { id: "a2022", title: "Eval Orthopédie 2022.pdf", year: "2022", rawText: makeExam("2022", "premiere session normale", false), wordCount: 500, sizeLabel: "3 Ko" },
      { id: "a2023", title: "Eval Orthopédie 2023.pdf", year: "2023", rawText: makeExam("2023", "deuxieme session rattrapage", false), wordCount: 500, sizeLabel: "3 Ko" },
      { id: "a2024", title: "Eval Orthopédie 2024.pdf", year: "2024", rawText: makeExam("2024", "troisieme session controle", true), wordCount: 550, sizeLabel: "3 Ko" },
    ];

    const analysis = computeCorpusAnalysis("Orthopédie", [orthoLesson], annales);
    expect(analysis.avgQcmPerExam).toBe(11);
    const electionStat = analysis.formatStatsPerExam?.find((s) => s.format === "ELECTION");
    const censureStat = analysis.formatStatsPerExam?.find((s) => s.format === "CENSURE");
    const rareStat = analysis.formatStatsPerExam?.find((s) => s.format === "COMPLEMENT_MULTIPLE");
    expect(electionStat?.avgPerExamRounded).toBe(7);
    expect(censureStat?.avgPerExamRounded).toBe(4);
    expect(rareStat?.isRare).toBe(true);
    expect(rareStat?.totalCount).toBe(1);
    expect(rareStat?.examOccurrences[0].year).toBe("2024");

    const design = buildExamDesign(analysis, [orthoLesson.id]);
    // Calibre d'épreuve basé sur l'épreuve où le nombre de QCM est le plus élevé (12 QCM en 2024)
    expect(design.totalQuestions).toBe(12);
    expect(design.formatCounts.COMPLEMENT_MULTIPLE).toBe(1);
    expect(design.formatCounts.CENSURE).toBe(4);
    expect(design.formatCounts.ELECTION).toBe(7);
  });

  test("convertit les puces (•) en A..E, isole la Rhumatologie dans les annales TOR multi-matières, applique la dominance des Compléments multiples et respecte le quota exact des formats rares (ex: 2 Jumelages)", () => {
    const rheumaLesson = buildLesson(
      "rheuma-1",
      "Goutte, Ostéoporose, Spondylarthrite ankylosante (SPA) et Ostéomalacie",
      "La goutte est une arthropathie microcristalline traitée par colchicine et allopurinol. L'ostéoporose donne des fractures vertébrales. La spondylarthrite ankylosante (SPA) présente une sacro-iliite et l'antigène HLA-B27. L'ostéomalacie montre des stries de Looser-Milkman.".repeat(
        8
      ),
      1600,
      "Rhumatologie"
    );

    // Simulation fidèle de Examen TOR 2025 (puces • à la place de A, B, C, D, E et PHYSIOLOGIOE en fin de document)
    const examTor2025 = `
Unité d'Enseignement : Traumatologie-Orthopédie-Rhumatologie (TOR)
DEVOIR : Epreuves / QCM
EC 1: Epreuve de Traumatologie
Élection
Q1. Parmi ces luxations du coude, quelle est celle où l'on observe une fracture de l'olécrane :
• La luxation postéro-externe ;
• La luxation médiale pure ;
• La luxation latérale pure ;
• La luxation postéro-interne ;
• La luxation antérieure.

EC 2: Epreuve d'Orthopédie
Complément Correct
Q21. Le signe du journal de Froment témoigne d'une atteinte du :
• Nerf médian
• Nerf interosseux antérieur
• Nerf radial
• Nerf ulnaire
• Nerf interosseux postérieur

EC3 : Epreuve de Rhumatologie et Sciences de Base
RHUMATOLOGIE
Compléments Multiples
Indiquer la (les) lettre(s) correspondante(s) à la (aux) réponse(s) exacte(s)
Q30. Les ostéomalacies pseudo-carentielles de type I sont caractérisées par
• Une résistance à la vitamine D
• Un défaut de la synthèse du calcitriol
• Une anomalie du récepteur du calcitriol
• Un taux normal de la 25- hydroxyvitamine D
• Un récepteur du calcitriol fonctionnel
Q31. Les ostéomalacies pseudo-carentielles de type II sont caractérisées par
• Une résistance à la vitamine D
• Un défaut de la synthèse du calcitriol
• Une anomalie du récepteur du calcitriol
• Un taux normal du calcitriol
• Un récepteur du calcitriol fonctionnel
Q32. L'ostéomalacie par carence en calcium est caractérisée par
• Une hypercalciurie précoce
• Une hypocalciurie précoce
• Une diminution du taux de PTH intacte
• Une élévation du taux de PTH intacte
• Une élévation des phosphatases alcalines sériques
Q33. Les stries de Looser-Milkman sont des fissures osseuses
• D'origine ostéoporotique
• D'origine ostéomalacique
• Parallèles à l'os cortical
• Perpendiculaires à l'os cortical
• Bordées d'un liseré de condensation
Q34. Les fractures majeures au cours de l'ostéoporose concernent :
• Le poignet
• L'extrémité supérieure du fémur
• L'extrémité inférieure du fémur
• L'extrémité inférieure du l'humérus
• L'extrémité supérieure de l'humérus

PHYSIOLOGIOE
Compléments Multiples
Q42. La douleur nociplastique
A. Est une douleur par stimulation excessive des nocicepteurs
B. Peut être due à un traumatisme
C. N'a pas de cause évidente
D. Est liée à une lésion du système nerveux central
E. Peut être due à une inflammation
`;

    // Simulation fidèle de Examen TOR 2021 (EC3 sur plusieurs lignes, Groupage, et 2 Jumelages rares avec "Cause pour laquelle" et "Parce que")
    const examTor2021 = `
Module : Traumatologie - Orthopédie - Rhumatologie
Médecine M1S1 - Examen 2021
EC1
Traumatologie
Election
Q1. Dans les ruptures du tendon calcanéen :
A. L'appui sur la pointe du pied est possible
B. L'équin physiologique est conservé
C. Le signe de Thompson est positif
D. La dépression est palpable
E. L'échographie fait parfois de faux diagnostics

EC3
Rhumatologie &
Sciences de base
Election
Q31. La spondylarthrite ankylosante :
A. Est une maladie dégénérative
B. Est caractérisée par une atteinte axiale prédominante
C. Débute au niveau du rachis cervical
D. Prédomine aux membres supérieurs
E. Est associée à HLA-B51
Censure
Q34. Indiquer la lettre correspondante à la réponse inexacte :
A. La crise de goutte survient de façon brutale
B. L'atteinte métatarso-phalangienne du gros orteil est la moins fréquente au cours de la goutte aiguë
C. La crise de goutte se manifeste par des signes inflammatoires intenses
D. Sous traitement par la colchicine, on note une résolution de la douleur
E. Le Furosémide est hyperuricémiant
Groupage
Choisir votre réponse selon le code suivant :
A= 1+2+3 B=1+3 C=2+4 D=4 E= autre choix
Q37. La goutte chronique est caractérisée par :
1. Une atteinte polyarticulaire
2. La présence de tophi
3. Une atteinte rénale tubulo-interstitielle
4. Une polyarthrite symétrique prédominant aux membres supérieurs
Jumelage
Choisir votre réponse selon le code suivant :
A= Vrai - Vrai avec relation de cause à effet
B= Vrai - Vrai sans relation de cause à effet
C= Vrai - Faux D= Faux - Vrai E= Faux - Faux
40.
1. Les AJI restent un diagnostic d'élimination
Cause pour laquelle
2. Pour retenir leur diagnostic, il n'est pas nécessaire d'écarter d'autres maladies inflammatoires.
41.
1. L'imagerie par résonnance magnétique (IRM) est souvent utilisée pour le diagnostic de la sacro-iléite à la phase de début de la SPA
Parce que
2. La radiographie standard et le scanner des sacro-iliaques sont souvent normaux dans la SPA débutante.
Physiologie
Jumelage
Q43. A propos de la transmission de la douleur :
1. La lésion de la voie spinothalamique fait perdre toute sensation douloureuse
Parce que
2. Les neurones véhiculant la douleur projettent dans le cortex somesthésique
Anatomie
Pathologique
Election
Q44. La synovite tuberculeuse est responsable d'un granulome avec nécrose :
A. Fibrinoïde
B. Caséeuse
C. Gommeuse
D. Suppurée
`;

    // Simulation fidèle de Examen TOR 2023 (EC3 :Epreuve deRhumatologie collé sans espace + Compléments groupés + Compléments multiples)
    const examTor2023 = `
Unité d'Enseignement : Traumatologie-Orthopédie-Rhumatologie (TOR)
EC 1:Epreuve deTraumatologie
1) Concernant la fracture du col fémoral en coxa valga
A- Rotation interne
B- Adduction
C- Raccourcissement
D- Rotation externe
E- Flexion

EC3 :Epreuve deRhumatologie et Sciences de Base
Complément correct
26) Les fractures vertébrales ostéoporotiques majeures sont :
A- Fracture pouteau-colles
B- Fracture de métatarse
C- Fracture claviculaire
D- Fracture d'une côte
E- Fracture du bassin
Complément incorr
27) L'ostéoporose est
A- Une maladie généralisée du squelette
B- Un défaut de minéralisation du tissu osseux
C- Une ostéopathie fragilisante
D- Une maladie dégénérative
E- Une pathologie asymptomatique
Compléments groupés
30) La raideur rachidienne est caractérisée au cours de la spondylarthrite ankylosante par
1. Un indice de Schöber >= 10 + 5 cm
2. Une ampliation thoracique diminuée
3. Une distance occiput-mur nulle
4. Une distance main-sol non nulle
31) La spondylarthrite ankylosante est caractérisée au plan biologique par
1. Un syndrome inflammatoire constant
2. Une CRP souvent inférieure à 60 mg/l
3. Une vitesse de sédimentation souvent supérieure à 50 mm
4. Un antigène HLA-B27 toujours positif
Compléments multiples
Indiquer la (les) lettre(s) correspondante(s) à la (aux) réponse(s) exacte(s)
34) Les arthrites microcristallines sont :
A. La goutte
B. La chondrocalcinose
C. Le rhumatisme à hydroxyapatite
D. La gonarthrose congestive
E. Le rhumatisme psoriasique
35) La crise de goutte :
A. Est sensible à la prise de colchicine
B. Est sensible à la prise d'AINS
C. Est sensible à la prise de corticoïdes
D. Est sensible à la prise d'un anti-interleukine 1
E. Est sensible à la prise d'allopurinol
36) La chondrocalcinose articulaire :
A. Est due aux dépôts de pyrophosphate de calcium
B. Est due aux dépôts d'urate de sodium
C. Est due aux dépôts d'hydroxyapatite
D. Atteint avec prédilection le gros orteil
E. Atteint avec prédilection les genoux
37) La goutte chronique est caractérisée par :
A. Une polyarthrite chronique
B. Une néphropathie
C. La présence de tophi
D. La positivité des facteurs rhumatoïdes
E. La présence d'une hyperuricémie
Physiologie
Cause à effet
41) La nociception ne s'accompagne pas de discrimination
Par ce que
Les nocicepteurs ne sont pas représentés dans l'aire somesthésique primaire
`;

    const annales = [
      { id: "tor2025", title: "Examen TOR 2025_extracted.pdf", year: "2025", rawText: examTor2025, wordCount: 600, sizeLabel: "4 Ko" },
      { id: "tor2021", title: "Examen TOR 2021.pdf", year: "2021", rawText: examTor2021, wordCount: 600, sizeLabel: "4 Ko" },
      { id: "tor2023", title: "Examen TOR 2023.pdf", year: "2023", rawText: examTor2023, wordCount: 700, sizeLabel: "4 Ko" },
    ];

    const analysis = computeCorpusAnalysis("Rhumatologie", [rheumaLesson], annales);
    // Vérifie qu'aucune question n'est illisible (0 skippedNumbers) et que Traumatologie/Orthopédie/Physiologie/Anatomie Pathologique sont exclues
    for (const ex of analysis.exams) {
      expect(ex.structureComplete).toBe(true);
    }
    expect(analysis.exams[0].questionCount).toBe(5); // Q30..Q34 en 2025 (5 Compléments multiples à puces • converties en A..E)
    expect(analysis.exams[0].formatCounts.COMPLEMENT_MULTIPLE).toBe(5);
    expect(analysis.exams[0].observedQuestions?.[0].optionCount).toBe(5);
    expect(analysis.exams[0].observedQuestions?.[0].optionTexts).toHaveLength(5);

    expect(analysis.exams[1].questionCount).toBe(5); // Q31, Q34, Q37, Q40, Q41 en 2021 (hors Physiologie Q43 et Anapath Q44)
    expect(analysis.exams[1].formatCounts.JUMELAGE).toBe(2);

    expect(analysis.exams[2].questionCount).toBe(8); // Q26, Q27, Q30, Q31, Q34, Q35, Q36, Q37 en 2023 (hors Physiologie Q41)
    expect(analysis.exams[2].formatCounts.COMPLEMENT_MULTIPLE).toBe(4);
    expect(analysis.exams[2].formatCounts.GROUPAGE).toBe(2);

    // Calibre d'épreuve = Maximum observé (8 QCM dans Examen TOR 2023)
    expect(analysis.maxQcm).toBe(8);
    expect(analysis.plannedExamTotalQcm).toBe(8);
    // Dominance des Compléments multiples en Rhumatologie
    expect(analysis.formatStatsPerExam?.[0].format).toBe("COMPLEMENT_MULTIPLE");
    expect(analysis.formatStatsPerExam?.[0].isDominant).toBe(true);
    // Le format rare Jumelage (apparu uniquement en 2021 avec 2 QCM) conserve son quota de 2 QCM dans l'examen blanc
    const jumelageStat = analysis.formatStatsPerExam?.find((s) => s.format === "JUMELAGE");
    expect(jumelageStat?.isRare).toBe(true);
    expect(jumelageStat?.maxInSingleExam).toBe(2);
    const design = buildExamDesign(analysis, [rheumaLesson.id]);
    expect(design.totalQuestions).toBe(8);
    expect(design.formatCounts.JUMELAGE).toBe(2);
  });
});
