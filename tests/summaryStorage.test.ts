import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DOCTRINE_LABELS } from "../src/config/doctrineConfig";
import {
  getLocalSummaries,
  LEGACY_SUMMARIES_KEY,
  LOCAL_SUMMARIES_KEY,
  saveLocalSummaries,
} from "../src/lib/summaryStorage";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/untypedDb", () => ({ untypedTable: vi.fn() }));

const TOMBSTONE_STORAGE_KEY = "dawjang_deleted_tombstones_v1";

function createLocalStorageStub() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

let dispatchEvent: ReturnType<typeof vi.fn>;

beforeEach(() => {
  dispatchEvent = vi.fn();
  vi.stubGlobal("localStorage", createLocalStorageStub());
  vi.stubGlobal("window", { dispatchEvent });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("les synthèses sont fusionnées sans doublon, la clé principale étant prioritaire", () => {
  localStorage.setItem(
    LOCAL_SUMMARIES_KEY,
    JSON.stringify([{ id: "sum-1", title: "Version récente", htmlContent: "<p>Récent</p>" }])
  );
  localStorage.setItem(
    LEGACY_SUMMARIES_KEY,
    JSON.stringify([
      { id: "sum-1", title: "Version ancienne", htmlContent: "<p>Ancien</p>" },
      { id: "sum-2", discipline: "Hématologie", content: "<p>Anémies</p>" },
    ])
  );

  expect(getLocalSummaries()).toEqual([
    {
      id: "sum-1",
      title: "Version récente",
      subject: "Médecine",
      updatedAt: "Aujourd'hui",
      wordCount: 100,
      doctrineLabel: DOCTRINE_LABELS.objectives_verbatim,
      htmlContent: "<p>Récent</p>",
    },
    {
      id: "sum-2",
      title: "Synthèse sans titre",
      subject: "Hématologie",
      updatedAt: "Aujourd'hui",
      wordCount: 100,
      doctrineLabel: DOCTRINE_LABELS.objectives_verbatim,
      htmlContent: "<p>Anémies</p>",
    },
  ]);
});

test("les synthèses supprimées (par identifiant ou par titre) restent masquées", () => {
  localStorage.setItem(
    LOCAL_SUMMARIES_KEY,
    JSON.stringify([
      { id: "sum-1", title: "Gardée" },
      { id: "sum-2", title: "Supprimée" },
      { id: "sum-3", title: "Ancienne fiche" },
    ])
  );
  localStorage.setItem(
    TOMBSTONE_STORAGE_KEY,
    JSON.stringify({ summary: ["sum-2", "title:ancienne fiche"] })
  );

  expect(getLocalSummaries().map((item) => item.id)).toEqual(["sum-1"]);
});

test("un registre illisible est ignoré sans masquer les autres registres", () => {
  localStorage.setItem(LOCAL_SUMMARIES_KEY, "{corrompu");
  localStorage.setItem(LEGACY_SUMMARIES_KEY, JSON.stringify([{ id: "sum-4", title: "Intacte" }]));

  expect(getLocalSummaries().map((item) => item.id)).toEqual(["sum-4"]);
});

test("l'enregistrement écrit tous les registres, lève la suppression et notifie l'interface", () => {
  localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify({ summary: ["sum-9"] }));
  const item = {
    id: "sum-9",
    title: "Recréée",
    subject: "Cardiologie",
    updatedAt: "À l'instant",
    wordCount: 42,
    doctrineLabel: DOCTRINE_LABELS.objectives_verbatim,
    htmlContent: "<p>Insuffisance cardiaque</p>",
  };

  saveLocalSummaries([item]);

  const serialized = JSON.stringify([item]);
  for (const key of [
    LOCAL_SUMMARIES_KEY,
    LEGACY_SUMMARIES_KEY,
    "hippocampus_local_summaries_v2",
    "hippocampus_clean_summaries_v4",
  ]) {
    expect(localStorage.getItem(key)).toBe(serialized);
  }
  expect(JSON.parse(localStorage.getItem(TOMBSTONE_STORAGE_KEY) || "{}").summary).toEqual([]);
  expect(dispatchEvent).toHaveBeenCalledTimes(1);
  expect(dispatchEvent.mock.calls[0][0].type).toBe("dawjang_summaries_updated");
  expect(getLocalSummaries()).toEqual([item]);
});
