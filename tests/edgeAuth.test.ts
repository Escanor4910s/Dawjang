import { beforeEach, describe, expect, test, vi } from "vitest";
import { getEdgeAccessToken } from "@/lib/edgeAuth";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: mocks } }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Jeton des appels Edge", () => {
  test("ne renvoie aucun jeton sans session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await getEdgeAccessToken()).toBeNull();
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  test("ne masque pas un échec de lecture de session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: new Error("session") });
    expect(await getEdgeAccessToken()).toBeNull();
  });

  test("utilise le jeton utilisateur encore valide", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "user-token", expires_at: Date.now() / 1000 + 300 } },
      error: null,
    });
    expect(await getEdgeAccessToken()).toBe("user-token");
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  test("rafraîchit un jeton qui expire bientôt", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "old-token", expires_at: Date.now() / 1000 + 10 } },
      error: null,
    });
    mocks.refreshSession.mockResolvedValue({ data: { session: { access_token: "new-token" } }, error: null });
    expect(await getEdgeAccessToken()).toBe("new-token");
    expect(mocks.refreshSession).toHaveBeenCalledOnce();
  });

  test("ne réutilise pas un jeton expiré si le rafraîchissement échoue", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "expired-token", expires_at: Date.now() / 1000 - 10 } },
      error: null,
    });
    mocks.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error("expired") });
    expect(await getEdgeAccessToken()).toBeNull();
  });
});
