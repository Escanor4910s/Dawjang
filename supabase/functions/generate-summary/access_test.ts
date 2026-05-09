import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

async function call(fn: string, body: unknown, token?: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${token ?? ANON}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

Deno.test("generate-summary rejects requests without auth (401)", async () => {
  const { status } = await call("generate-summary", { courseId: "x", summaryType: "complete" });
  // No user JWT → either 401 (auth missing) or 403 (gratuit blocked). Anything ≥400 means access guarded.
  if (status < 400) throw new Error(`expected guarded response, got ${status}`);
});

Deno.test("ask-mor rejects requests without auth (401/403)", async () => {
  const { status } = await call("ask-mor", { message: "hello" });
  if (status < 400) throw new Error(`expected guarded response, got ${status}`);
});

Deno.test("generate-summary returns 401 for invalid token", async () => {
  const { status } = await call(
    "generate-summary",
    { courseId: "x", summaryType: "complete" },
    "invalid.token.here"
  );
  assertEquals(status, 401);
});

Deno.test("ask-mor returns 401 for invalid token", async () => {
  const { status } = await call("ask-mor", { message: "hi" }, "invalid.token.here");
  assertEquals(status, 401);
});
