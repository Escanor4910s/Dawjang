import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { getUserPlanInfo } from "../supabase/functions/_shared/plan-utils";

const mocks = vi.hoisted(() => ({
  serve: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  profile: { plan: "premium", plan_expires_at: null as string | null },
  role: null as { role: string } | null,
  vision: vi.fn(),
  block: vi.fn(),
  audit: vi.fn(),
  preprocess: vi.fn(),
}));

vi.mock("https://deno.land/std@0.192.0/http/server.ts", () => ({ serve: mocks.serve }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.56.1", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: async () => ({ data: mocks.role, error: null }),
      single: async () => ({ data: mocks.profile, error: null }),
    }),
  }),
}));
vi.mock("../supabase/functions/_shared/examen-blanc-ai.ts", () => ({
  handleVisionOcrExtract: mocks.vision,
  handleGenerateExamenBlancBlock: mocks.block,
  handleAuditExamAnnale: mocks.audit,
  preprocessLongCourseWithSonnet: mocks.preprocess,
  cleanOptionPrefix: (value: string) => value,
  shuffleArray: (value: unknown[]) => value,
  LETTERS: ["A", "B", "C", "D", "E"],
  DYNAMIC_STEM_ANGLES: ["angle"],
}));
vi.mock("../supabase/functions/_shared/llm.ts", () => ({ hasAiKey: () => false, aiEndpoint: "unused" }));
vi.mock("../supabase/functions/_shared/sonnet-pool.ts", () => ({
  callGemini25Json: vi.fn(),
  callSonnet46Json: vi.fn(),
  getAiPoolSummary: () => ({ sonnetKeysCount: 1, geminiKeysCount: 0 }),
}));

type Handler = (req: Request) => Promise<Response>;
const handlers: Record<string, Handler> = {};
const lessonContent = "Contenu pédagogique suffisamment long pour générer une question médicale.";
const blockBody = {
  action: "generate_examen_blanc_block",
  lessonContent,
  blueprintSpec: { kind: "STANDALONE", formats: ["ELECTION"], optionCounts: [5] },
};

function request(body: unknown, authenticated = true): Request {
  return new Request("http://localhost/function", {
    method: "POST",
    headers: authenticated ? { Authorization: "Bearer test-user-token" } : {},
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await import("../supabase/functions/generate-quiz/index");
  handlers["generate-quiz"] = mocks.serve.mock.calls[0][0];
  await import("../supabase/functions/dawjang-exam-ai/index");
  handlers["dawjang-exam-ai"] = mocks.serve.mock.calls[1][0];
});

beforeEach(() => {
  vi.stubGlobal("Deno", { env: { get: () => "test-placeholder" } });
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
  mocks.rpc.mockReset().mockResolvedValue({ data: { allowed: true, remaining: 4 }, error: null });
  mocks.profile = { plan: "premium", plan_expires_at: null };
  mocks.role = null;
  mocks.vision.mockReset().mockResolvedValue({ text: "Texte extrait" });
  mocks.block.mockReset().mockResolvedValue({ block: { items: [] } });
  mocks.audit.mockReset().mockResolvedValue({ audit: { questionCount: 1 } });
  mocks.preprocess.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe.each(["generate-quiz", "dawjang-exam-ai"])("Protection de %s", (endpoint) => {
  const handle = (req: Request) => handlers[endpoint](req);

  test("laisse passer le preflight CORS sans appeler l'IA", async () => {
    const res = await handle(new Request("http://localhost/function", { method: "OPTIONS" }));
    expect(res.status).toBe(200);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.vision).not.toHaveBeenCalled();
  });

  test("refuse les méthodes autres que POST", async () => {
    expect((await handle(new Request("http://localhost/function"))).status).toBe(405);
  });

  test.each(["pool_status", "vision_ocr_extract", "generate_examen_blanc_block", "audit_exam_annale"])(
    "refuse l'action anonyme %s avant tout appel IA", async (action) => {
      const res = await handle(request({ ...blockBody, action }, false));
      expect(res.status).toBe(401);
      expect(mocks.getUser).not.toHaveBeenCalled();
      expect(mocks.block).not.toHaveBeenCalled();
      expect(mocks.vision).not.toHaveBeenCalled();
      expect(mocks.audit).not.toHaveBeenCalled();
    },
  );

  test("refuse un jeton invalide", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid token") });
    expect((await handle(request(blockBody))).status).toBe(401);
    expect(mocks.block).not.toHaveBeenCalled();
  });

  test.each([null, [], "texte"])("refuse un corps JSON non objet : %j", async (body) => {
    expect((await handle(request(body))).status).toBe(400);
  });

  test("refuse un JSON malformé", async () => {
    const req = new Request("http://localhost/function", {
      method: "POST", headers: { Authorization: "Bearer test-user-token" }, body: "{",
    });
    expect((await handle(req)).status).toBe(400);
  });

  test.each(["vision_ocr_extract", "audit_exam_annale"])("refuse %s pour un abonnement expiré", async (action) => {
    mocks.profile.plan_expires_at = new Date(Date.now() - 60_000).toISOString();
    expect((await handle(request({ action, images: [{ data: "image" }], examText: lessonContent }))).status).toBe(403);
    expect(mocks.vision).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  test("limite le nombre d'images OCR", async () => {
    const res = await handle(request({ action: "vision_ocr_extract", images: Array.from({ length: 5 }, () => ({ data: "image" })) }));
    expect(res.status).toBe(400);
    expect(mocks.vision).not.toHaveBeenCalled();
  });

  test("permet l'OCR avec un abonnement actif", async () => {
    const res = await handle(request({ action: "vision_ocr_extract", images: [{ data: "image" }] }));
    expect(res.status).toBe(200);
    expect(mocks.vision).toHaveBeenCalledOnce();
    expect(mocks.getUser).toHaveBeenCalledWith("test-user-token");
  });

  test("compte les questions d'un bloc dans le quota gratuit", async () => {
    mocks.profile.plan = "gratuit";
    const res = await handle(request(blockBody));
    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("consume_daily_quota", {
      p_user_id: "test-user", p_feature: "qcm", p_amount: 1, p_limit: 5,
    });
    expect(mocks.block).toHaveBeenCalledOnce();
  });

  test("refuse la génération lorsque le quota est épuisé", async () => {
    mocks.profile.plan = "gratuit";
    mocks.rpc.mockResolvedValue({ data: { allowed: false, remaining: 0 }, error: null });
    expect((await handle(request(blockBody))).status).toBe(429);
    expect(mocks.block).not.toHaveBeenCalled();
  });

  test("ne génère rien si la vérification du quota échoue", async () => {
    mocks.profile.plan = "gratuit";
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("database") });
    expect((await handle(request(blockBody))).status).toBe(500);
    expect(mocks.block).not.toHaveBeenCalled();
  });

  test("refuse les blocs trop volumineux avant de consommer le quota", async () => {
    const res = await handle(request({ ...blockBody, lessonContent: "x".repeat(120_001) }));
    expect(res.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.block).not.toHaveBeenCalled();
  });
});

describe("Quota du chemin QCM classique", () => {
  test("ne prétraite pas le cours lorsque le quota est épuisé", async () => {
    mocks.profile.plan = "gratuit";
    mocks.rpc.mockResolvedValue({ data: { allowed: false, remaining: 0 }, error: null });
    const res = await handlers["generate-quiz"](request({ courseContent: lessonContent, questionCount: 3 }));
    expect(res.status).toBe(429);
    expect(mocks.rpc).toHaveBeenCalledWith("consume_daily_quota", {
      p_user_id: "test-user", p_feature: "qcm", p_amount: 3, p_limit: 5,
    });
    expect(mocks.preprocess).not.toHaveBeenCalled();
  });

  test("refuse un nombre de questions non numérique", async () => {
    expect((await handlers["generate-quiz"](request({ courseContent: lessonContent, questionCount: "invalid" }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

test("un plan de profil ne remplace pas le rôle administrateur", async () => {
  mocks.profile.plan = "admin";
  expect(await getUserPlanInfo(request({}))).toEqual({ userId: "test-user", plan: "gratuit", isAdmin: false });
});

test("seul un rôle administrateur serveur donne les droits admin", async () => {
  mocks.profile.plan = "gratuit";
  mocks.role = { role: "admin" };
  expect(await getUserPlanInfo(request({}))).toEqual({ userId: "test-user", plan: "admin", isAdmin: true });
});
