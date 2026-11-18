import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  DEFAULT_STUDENT_PROFILE,
  formatFullStudyLevel,
  getSavedStudentProfile,
  saveStudentProfile,
  STUDENT_AVATAR_STORAGE_KEY,
  STUDENT_PROFILE_STORAGE_KEY,
} from "../src/lib/studentProfile";

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

beforeEach(() => {
  vi.stubGlobal("localStorage", createLocalStorageStub());
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("le profil par défaut ne contient aucune identité personnelle codée en dur", () => {
  const profile = getSavedStudentProfile();

  expect(profile).toEqual({ ...DEFAULT_STUDENT_PROFILE, avatarUrl: undefined });
  expect(profile.email).toBe("");
  expect(profile.phone).toBe("");
});

test("les niveaux abrégés sont normalisés", () => {
  expect(formatFullStudyLevel("m1")).toBe("Master 1");
  expect(formatFullStudyLevel("DFASM 2")).toBe("Licence 3");
  expect(formatFullStudyLevel("Interne")).toBe("Interne des Hôpitaux");
});

test("un profil local est lu, normalisé et sauvegardé", () => {
  saveStudentProfile({
    ...DEFAULT_STUDENT_PROFILE,
    fullName: "Test Étudiante",
    studyLevel: "m2",
    avatarUrl: "https://example.test/avatar.png",
  });

  expect(localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY)).toContain('"studyLevel":"Master 2"');
  expect(localStorage.getItem(STUDENT_AVATAR_STORAGE_KEY)).toBe("https://example.test/avatar.png");

  const profile = getSavedStudentProfile();
  expect(profile.fullName).toBe("Test Étudiante");
  expect(profile.studyLevel).toBe("Master 2");
  expect(profile.avatarUrl).toBe("https://example.test/avatar.png");
});
