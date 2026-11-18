import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useFileReader } from "@/hooks/useFileReader";
import { createTesseractWorker } from "@/lib/ocrEngine";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const mocks = vi.hoisted(() => ({
  getEdgeAccessToken: vi.fn(),
  invoke: vi.fn(),
  fetch: vi.fn(),
  createWorker: vi.fn(),
  render: vi.fn(),
  recognize: vi.fn(),
  terminate: vi.fn(),
  numPages: 1,
  nativeText: "",
  mixedText: false,
}));

vi.mock("react", () => ({
  useState: (value: unknown) => [value, vi.fn()],
  useCallback: (callback: unknown) => callback,
}));
vi.mock("@/lib/edgeAuth", () => ({ getEdgeAccessToken: mocks.getEdgeAccessToken }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("tesseract.js", () => ({ createWorker: mocks.createWorker, OEM: { LSTM_ONLY: 1 } }));
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "/pdf-worker.js" },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: mocks.numPages,
      getPage: async (pageNumber: number) => ({
        getTextContent: async () => ({ items: mocks.nativeText && (!mocks.mixedText || pageNumber === 1) ? [{ str: mocks.nativeText, transform: [1, 0, 0, 1, 0, 0] }] : [] }),
        getViewport: () => ({ width: 1080, height: 1400 }),
        render: mocks.render,
      }),
    }),
  }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.numPages = 1;
  mocks.nativeText = "";
  mocks.mixedText = false;
  mocks.render.mockReturnValue({ promise: Promise.resolve() });
  mocks.getEdgeAccessToken.mockResolvedValue(null);
  mocks.recognize.mockImplementation(async () => ({ data: { text: `Question ${mocks.recognize.mock.calls.length} : texte médical reconnu localement.` } }));
  mocks.terminate.mockResolvedValue(undefined);
  mocks.createWorker.mockResolvedValue({ recognize: mocks.recognize, terminate: mocks.terminate });
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ error: "Premium requis" }), { status: 403 }));
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("window", { location: { origin: "http://localhost:8080" } });
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 1080,
      height: 1400,
      getContext: () => ({
        fillRect: vi.fn(),
        getImageData: () => ({ data: new Uint8ClampedArray(1000) }),
      }),
      toDataURL: () => "data:image/jpeg;base64,aW1hZ2U=",
    }),
  });
});

afterEach(() => vi.unstubAllGlobals());

const scannedFile = () => new File([new Uint8Array(20)], "Evals TOR 2023.pdf", { type: "application/pdf" });

describe("OCR local des PDF scannés", () => {
  test("utilise des ressources locales et aucun worker Blob bloqué par la CSP", async () => {
    await createTesseractWorker();
    expect(mocks.createWorker).toHaveBeenCalledWith("fra", 1, expect.objectContaining({
      workerPath: "http://localhost:8080/ocr/worker.min.js",
      corePath: "http://localhost:8080/ocr/core/",
      langPath: "http://localhost:8080/ocr/lang/",
      workerBlobURL: false,
    }));
  });

  test("rejette une erreur de chargement de langue au lieu de rester bloqué", async () => {
    mocks.createWorker.mockImplementation((_language, _engine, options) => {
      options.errorHandler("Ressource française introuvable (404)");
      return new Promise(() => {});
    });
    await expect(createTesseractWorker()).rejects.toThrow("Ressource française introuvable (404)");
  });

  test("les fichiers distribués contiennent le worker, les trois moteurs et une langue gzip valide", () => {
    for (const name of ["worker.min.js", "core/tesseract-core-lstm.wasm.js", "core/tesseract-core-simd-lstm.wasm.js", "core/tesseract-core-relaxedsimd-lstm.wasm.js"]) {
      expect(existsSync(resolve("public/ocr", name))).toBe(true);
    }
    expect(gunzipSync(readFileSync(resolve("public/ocr/lang/fra.traineddata.gz"))).length).toBeGreaterThan(100_000);
  });

  test("extrait un scan sans session ni appel cloud et libère le worker", async () => {
    const result = await useFileReader().readFile(scannedFile(), { mode: "annales" });
    expect(result).toMatchObject({ success: true, usedVision: false, usedLocalOcr: true, pageCount: 1 });
    expect(result.content).toContain("texte médical reconnu localement");
    expect(mocks.render).toHaveBeenCalledWith(expect.objectContaining({ intent: "print" }));
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.terminate).toHaveBeenCalledOnce();
  });

  test("lit toutes les pages, y compris au-delà des anciennes limites de six et vingt-cinq", async () => {
    mocks.numPages = 27;
    const result = await useFileReader().readFile(scannedFile(), { mode: "annales", forceFullExtraction: true });
    expect(result.success).toBe(true);
    expect(mocks.recognize).toHaveBeenCalledTimes(27);
    expect(result.content).toContain("--- PAGE 27 ---");
    expect(mocks.createWorker).toHaveBeenCalledOnce();
  });

  test("complète localement les pages manquantes après un succès Vision partiel", async () => {
    mocks.numPages = 4;
    mocks.getEdgeAccessToken.mockResolvedValue("test-token");
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ text: "--- PAGE 1 ---\nTexte Vision des premières pages" })));
    mocks.invoke.mockResolvedValueOnce({ data: { text: "--- PAGE 1 ---\nTexte Vision des premières pages" }, error: null });
    mocks.invoke.mockResolvedValue({ data: null, error: { message: "Premium requis", context: { status: 403 } } });
    const result = await useFileReader().readFile(scannedFile(), { mode: "annales" });
    expect(result).toMatchObject({ success: true, usedVision: true, usedLocalOcr: true });
    expect(result.content).toContain("--- PAGE 4 ---");
    expect(mocks.recognize).toHaveBeenCalledOnce();
  });

  test("ne répète pas les appels Vision lorsque l'accès est refusé", async () => {
    mocks.numPages = 3;
    mocks.getEdgeAccessToken.mockResolvedValue("test-token");
    mocks.invoke.mockResolvedValue({ data: null, error: { message: "Session expirée", context: { status: 401 } } });
    const result = await useFileReader().readFile(scannedFile(), { mode: "annales" });
    expect(result.success).toBe(true);
    expect(mocks.invoke.mock.calls.length + mocks.fetch.mock.calls.length).toBe(1);
    expect(mocks.recognize).toHaveBeenCalledTimes(3);
  });

  test("conserve la cause d'un échec local dans le résultat", async () => {
    mocks.createWorker.mockRejectedValue(new Error("Worker OCR indisponible"));
    const result = await useFileReader().readFile(scannedFile(), { mode: "annales" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Worker OCR indisponible");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  test("une page sans texte ne produit pas de faux succès", async () => {
    mocks.recognize.mockResolvedValue({ data: { text: "" } });
    const result = await useFileReader().readFile(scannedFile(), { mode: "annales" });
    expect(result.success).toBe(false);
    expect(result.content).toBe("");
    expect(result.error).toContain("aucun texte lisible");
    expect(mocks.terminate).toHaveBeenCalledOnce();
  });

  test("une erreur sur une page n'empêche pas la lecture des suivantes", async () => {
    mocks.numPages = 2;
    mocks.recognize.mockRejectedValueOnce(new Error("Page illisible"));
    const result = await useFileReader().readFile(scannedFile(), { mode: "annales" });
    expect(result.success).toBe(true);
    expect(result.content).toContain("--- PAGE 2 ---");
    expect(mocks.recognize).toHaveBeenCalledTimes(2);
    expect(mocks.terminate).toHaveBeenCalledOnce();
  });

  test("le mode intégral lit aussi les pages scannées d'un PDF mixte", async () => {
    mocks.numPages = 2;
    mocks.mixedText = true;
    mocks.nativeText = "Cours médical contenant une couche de texte native exploitable. ".repeat(4);
    const result = await useFileReader().readFile(scannedFile(), { forceFullExtraction: true });
    expect(result.success).toBe(true);
    expect(result.content).toContain("--- PAGE 2 ---");
    expect(mocks.recognize).toHaveBeenCalledOnce();
  });

  test("préserve la lecture vectorielle sans initialiser Tesseract", async () => {
    mocks.nativeText = "Cours médical avec une couche de texte vectorielle exploitable. ".repeat(4);
    const result = await useFileReader().readFile(scannedFile());
    expect(result).toMatchObject({ success: true, usedVision: false });
    expect(result.content).toContain(mocks.nativeText.trim());
    expect(mocks.createWorker).not.toHaveBeenCalled();
  });
});
