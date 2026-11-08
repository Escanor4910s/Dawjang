import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

/**
 * Normalize Gemini / OpenAI-compatible chat-completion content.
 * Handles: string | { type, text } | parts[] | nested
 */
export function parseAIContent(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (Array.isArray(raw)) {
    return raw
      .map((p: any) => (typeof p === "string" ? p : parseAIContent(p?.text ?? p?.content ?? "")))
      .join("");
  }
  if (typeof raw === "object") {
    const obj = raw as any;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.content === "string") return obj.content;
    if (Array.isArray(obj.parts)) return parseAIContent(obj.parts);
    if (Array.isArray(obj.content)) return parseAIContent(obj.content);
    if (typeof obj.text === "object") return parseAIContent(obj.text);
  }
  return "";
}

/**
 * Extract the assistant message from a Lovable AI Gateway / OpenAI completion response.
 */
export function extractCompletionText(data: any): string {
  return parseAIContent(data?.choices?.[0]?.message?.content);
}

/**
 * Best-effort diagnostic logger — never throws, light-weight (avoids DB quota bloat).
 */
export async function logDiagnostic(entry: {
  function_name: string;
  user_id?: string | null;
  status?: number | null;
  request_payload?: unknown;
  response_payload?: unknown;
  error?: string | null;
  duration_ms?: number | null;
}): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;

    // Ne journaliser en base que si une erreur survient pour préserver le quota gratuit de 500 Mo
    if (!entry.error && entry.status && entry.status < 400) {
      return;
    }

    const supabase = createClient(url, key);

    // Tronquer les payloads pour ne jamais dépasser quelques centaines d'octets
    const sanitizePayload = (payload: unknown) => {
      if (!payload) return null;
      try {
        const str = JSON.stringify(payload);
        return str.length > 500 ? { summary: str.substring(0, 500) + "... [tronqué pour économie de quota]" } : payload;
      } catch {
        return null;
      }
    };

    await supabase.from("edge_diagnostics").insert({
      function_name: entry.function_name,
      user_id: entry.user_id ?? null,
      status: entry.status ?? null,
      request_payload: sanitizePayload(entry.request_payload),
      response_payload: sanitizePayload(entry.response_payload),
      error: entry.error ? String(entry.error).substring(0, 1000) : null,
      duration_ms: entry.duration_ms ?? null,
    });
  } catch (e) {
    console.error("[logDiagnostic] failed:", e);
  }
}
