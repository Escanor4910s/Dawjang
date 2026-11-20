// supabase/functions/_shared/sonnet-pool.ts
// Pool multi-clés et rotation automatique pour Claude Sonnet 4.6 (rédacteur principal)
// et Gemini 2.5 Flash (superviseur anti-dégâts, audit d'annales & OCR Vision).

declare const Deno:
  | {
      env: {
        get(key: string): string | undefined;
      };
    }
  | undefined;

declare const process:
  | {
      env: Record<string, string | undefined>;
    }
  | undefined;

export type SonnetProviderKind = "anthropic" | "openrouter";
export type GeminiProviderKind = "gemini" | "openrouter" | "lovable";

export interface PoolKeyEntry<P extends string> {
  key: string;
  provider: P;
  slotIndex: number;
}

export interface PoolCallResult<T> {
  data: T;
  provider: string;
  model: string;
  slotIndex: number;
  totalSlots: number;
}

const DEFAULT_SONNET_MODEL = "claude-sonnet-4-6";
const DEFAULT_OPENROUTER_SONNET_MODEL = "anthropic/claude-sonnet-4.6";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENROUTER_GEMINI_MODEL = "google/gemini-2.5-flash";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

let sonnetCursor = 0;
let geminiCursor = 0;
// Clé de cooldown scopée par provider + modèle + clé API pour éviter qu'un échec Sonnet
// ne mette la même clé OpenRouter en cooldown pour Gemini.
const keyCooldownUntil = new Map<string, number>();
let lastPoolError = "";

export function resetPoolCursorsForTest(): void {
  sonnetCursor = 0;
  geminiCursor = 0;
  keyCooldownUntil.clear();
  lastPoolError = "";
}

export function getLastPoolError(): string {
  return lastPoolError;
}

function cooldownKey(provider: string, model: string, key: string): string {
  return `${provider}::${model}::${key}`;
}

function markKeyFailure(provider: string, model: string, key: string, status?: number, detail = ""): void {
  const isPermanentOrAuth = status === 401 || status === 403 || status === 402;
  const cooldownMs = isPermanentOrAuth ? 180_000 : 30_000;
  keyCooldownUntil.set(cooldownKey(provider, model, key), Date.now() + cooldownMs);
  lastPoolError = `[${provider}/${model}] HTTP ${status || "NET"} ${detail.slice(0, 220)}`.trim();
}

function markKeySuccess(provider: string, model: string, key: string): void {
  keyCooldownUntil.delete(cooldownKey(provider, model, key));
}

function readEnv(name: string): string {
  try {
    if (typeof Deno !== "undefined" && typeof Deno?.env?.get === "function") {
      const val = Deno.env.get(name);
      if (val) return val.trim();
    }
  } catch {
    // ignore Deno read error
  }
  try {
    if (typeof process !== "undefined" && process?.env) {
      const val = process.env[name];
      if (val) return String(val).trim();
    }
  } catch {
    // ignore process.env read error
  }
  return "";
}

export function splitEnvKeys(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\r\n,;|]+/)
    .map((k) => k.trim())
    .filter((k) => k.length >= 12);
}

function collectNumberedEnv(prefixes: string[], maxIndex = 20): string[] {
  const out: string[] = [];
  for (const prefix of prefixes) {
    const direct = readEnv(prefix);
    if (direct) out.push(...splitEnvKeys(direct));
    const plural = readEnv(`${prefix}S`);
    if (plural) out.push(...splitEnvKeys(plural));
    for (let i = 1; i <= maxIndex; i++) {
      const numbered = readEnv(`${prefix}_${i}`);
      if (numbered) out.push(...splitEnvKeys(numbered));
    }
  }
  return out;
}

function dedupeEntries<P extends string>(entries: Array<{ key: string; provider: P }>): PoolKeyEntry<P>[] {
  const seen = new Set<string>();
  const unique: PoolKeyEntry<P>[] = [];
  for (const entry of entries) {
    if (!entry.key || seen.has(entry.key)) continue;
    seen.add(entry.key);
    unique.push({
      key: entry.key,
      provider: entry.provider,
      slotIndex: unique.length + 1,
    });
  }
  return unique;
}

function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": readEnv("APP_PUBLIC_URL") || readEnv("SITE_URL") || "https://obsmed.space",
    "X-Title": "DawJang Examen Blanc",
  };
}

export function resolveSonnetKeyPool(): PoolKeyEntry<SonnetProviderKind>[] {
  const collected: Array<{ key: string; provider: SonnetProviderKind }> = [];

  for (const k of collectNumberedEnv(["SONNET_API_KEY", "ANTHROPIC_API_KEY", "CLAUDE_API_KEY"])) {
    collected.push({
      key: k,
      provider: k.startsWith("sk-or-") ? "openrouter" : "anthropic",
    });
  }

  for (const k of collectNumberedEnv(["OPENROUTER_SONNET_API_KEY", "OPENROUTER_API_KEY"])) {
    collected.push({
      key: k,
      provider: k.startsWith("sk-ant-") ? "anthropic" : "openrouter",
    });
  }

  return dedupeEntries(collected);
}

export function resolveGeminiRepairKeyPool(): PoolKeyEntry<GeminiProviderKind>[] {
  const collected: Array<{ key: string; provider: GeminiProviderKind }> = [];

  for (const k of collectNumberedEnv(["GEMINI_API_KEY", "GOOGLE_API_KEY"])) {
    collected.push({ key: k, provider: "gemini" });
  }
  for (const k of collectNumberedEnv(["OPENROUTER_GEMINI_API_KEY", "OPENROUTER_API_KEY"])) {
    if (!k.startsWith("sk-ant-")) {
      collected.push({ key: k, provider: "openrouter" });
    }
  }
  const lovable = readEnv("LOVABLE_API_KEY");
  if (lovable) {
    collected.push({ key: lovable, provider: "lovable" });
  }

  return dedupeEntries(collected);
}

export function getAiPoolSummary() {
  return {
    sonnetKeysCount: resolveSonnetKeyPool().length,
    geminiKeysCount: resolveGeminiRepairKeyPool().length,
    hasOpenAiFallback: Boolean(readEnv("OPENAI_API_KEY")),
    sonnetModel: readEnv("SONNET_OPENROUTER_MODEL") || DEFAULT_OPENROUTER_SONNET_MODEL,
    geminiModel: readEnv("GEMINI_REPAIR_OPENROUTER_MODEL") || DEFAULT_OPENROUTER_GEMINI_MODEL,
  };
}

function rotateOrder<T extends { key: string; provider: string }>(
  items: T[],
  cursor: number,
  modelResolver: (item: T) => string
): T[] {
  if (items.length <= 1) return items;
  const start = ((cursor % items.length) + items.length) % items.length;
  const rotated = [...items.slice(start), ...items.slice(0, start)];
  const now = Date.now();
  const healthy = rotated.filter(
    (item) => (keyCooldownUntil.get(cooldownKey(item.provider, modelResolver(item), item.key)) || 0) <= now
  );
  const cooling = rotated.filter(
    (item) => (keyCooldownUntil.get(cooldownKey(item.provider, modelResolver(item), item.key)) || 0) > now
  );
  return healthy.length > 0 ? [...healthy, ...cooling] : rotated;
}

export function safeParseJsonObject(rawText: string): any | null {
  const stripped = String(rawText || "")
    .replace(/^[\s\S]*?```(?:json)?\s*/i, "")
    .replace(/\s*```[\s\S]*$/i, "")
    .trim();
  if (!stripped) return null;

  const tryParse = (candidate: string): any | null => {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
      } catch {
        return null;
      }
    }
  };

  const direct = tryParse(stripped);
  if (direct !== null) return direct;

  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  if (first !== -1 && last > first) {
    return tryParse(stripped.slice(first, last + 1));
  }
  return null;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function invokeSingleSonnetKey(params: {
  entry: PoolKeyEntry<SonnetProviderKind>;
  systemPrompt: string;
  userContent: string | any[];
  cachedCoursePrefix?: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}): Promise<{ text: string; model: string } | null> {
  const { entry, systemPrompt, userContent, cachedCoursePrefix, temperature, maxTokens, timeoutMs } = params;
  const anthropicModel = readEnv("SONNET_MODEL") || DEFAULT_SONNET_MODEL;
  const openrouterModel = readEnv("SONNET_OPENROUTER_MODEL") || DEFAULT_OPENROUTER_SONNET_MODEL;
  const activeModel = entry.provider === "anthropic" ? anthropicModel : openrouterModel;

  try {
    if (entry.provider === "anthropic") {
      const headers: Record<string, string> = {
        "x-api-key": entry.key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      };
      const useCache =
        Boolean(cachedCoursePrefix) &&
        typeof cachedCoursePrefix === "string" &&
        cachedCoursePrefix.length >= 4500 &&
        typeof userContent === "string";
      if (useCache) {
        headers["anthropic-beta"] = "prompt-caching-2024-07-31";
      }

      const nonCachedContent =
        !useCache && cachedCoursePrefix && typeof userContent === "string"
          ? `${cachedCoursePrefix}\n\n${userContent}`
          : userContent;

      const bodyPayload = useCache
        ? {
            model: anthropicModel,
            max_tokens: maxTokens,
            temperature,
            system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: cachedCoursePrefix, cache_control: { type: "ephemeral" } },
                  { type: "text", text: userContent },
                ],
              },
            ],
          }
        : {
            model: anthropicModel,
            max_tokens: maxTokens,
            temperature,
            system: systemPrompt,
            messages: [{ role: "user", content: nonCachedContent }],
          };

      const resp = await fetchWithTimeout(
        ANTHROPIC_URL,
        {
          method: "POST",
          headers,
          body: JSON.stringify(bodyPayload),
        },
        timeoutMs
      );
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        markKeyFailure("anthropic", anthropicModel, entry.key, resp.status, errBody);
        console.warn(`[sonnet-pool:anthropic#slot-${entry.slotIndex}] HTTP ${resp.status}: ${errBody.slice(0, 220)}`);
        return null;
      }
      markKeySuccess("anthropic", anthropicModel, entry.key);
      const data = await resp.json();
      const text = (Array.isArray(data?.content) ? data.content : [])
        .map((c: any) => c?.text || "")
        .join("\n")
        .trim();
      return text ? { text, model: anthropicModel } : null;
    }

    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    const fullUserContent =
      cachedCoursePrefix && typeof userContent === "string"
        ? `${cachedCoursePrefix}\n\n${userContent}`
        : userContent;
    messages.push({ role: "user", content: fullUserContent });

    const resp = await fetchWithTimeout(
      OPENROUTER_URL,
      {
        method: "POST",
        headers: openRouterHeaders(entry.key),
        body: JSON.stringify({
          model: openrouterModel,
          temperature,
          max_tokens: maxTokens,
          messages,
        }),
      },
      timeoutMs
    );
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      markKeyFailure("openrouter", openrouterModel, entry.key, resp.status, errBody);
      console.warn(`[sonnet-pool:openrouter#slot-${entry.slotIndex}] HTTP ${resp.status}: ${errBody.slice(0, 220)}`);
      return null;
    }
    markKeySuccess("openrouter", openrouterModel, entry.key);
    const data = await resp.json();
    const text = String(data?.choices?.[0]?.message?.content || "").trim();
    return text ? { text, model: openrouterModel } : null;
  } catch (err: any) {
    markKeyFailure(entry.provider, activeModel, entry.key, 0, String(err?.message || err));
    console.warn(`[sonnet-pool:${entry.provider}#slot-${entry.slotIndex}]`, err?.message || err);
    return null;
  }
}

async function invokeSingleGeminiKey(params: {
  entry: PoolKeyEntry<GeminiProviderKind>;
  systemPrompt: string;
  userContent: string | any[];
  temperature: number;
  maxTokens: number;
  expectJson: boolean;
  timeoutMs: number;
}): Promise<{ text: string; model: string } | null> {
  const { entry, systemPrompt, userContent, temperature, maxTokens, expectJson, timeoutMs } = params;
  const geminiModel = readEnv("GEMINI_REPAIR_MODEL") || DEFAULT_GEMINI_MODEL;
  const openrouterModel = readEnv("GEMINI_REPAIR_OPENROUTER_MODEL") || DEFAULT_OPENROUTER_GEMINI_MODEL;
  const activeModel = entry.provider === "gemini" ? geminiModel : openrouterModel;

  try {
    if (entry.provider === "gemini") {
      const parts = Array.isArray(userContent) ? userContent : [{ text: String(userContent || "") }];
      const bodyPayload: Record<string, unknown> = {
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(expectJson ? { responseMimeType: "application/json" } : {}),
        },
      };
      if (systemPrompt) {
        bodyPayload.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      const resp = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": entry.key,
          },
          body: JSON.stringify(bodyPayload),
        },
        timeoutMs
      );
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        markKeyFailure("gemini", geminiModel, entry.key, resp.status, errBody);
        console.warn(`[gemini-pool:direct#slot-${entry.slotIndex}] HTTP ${resp.status}: ${errBody.slice(0, 220)}`);
        return null;
      }
      markKeySuccess("gemini", geminiModel, entry.key);
      const data = await resp.json();
      const text = (data?.candidates?.[0]?.content?.parts || [])
        .map((p: any) => p?.text || "")
        .join("\n")
        .trim();
      return text ? { text, model: geminiModel } : null;
    }

    const url = entry.provider === "openrouter" ? OPENROUTER_URL : LOVABLE_URL;
    const headers =
      entry.provider === "openrouter"
        ? openRouterHeaders(entry.key)
        : { "Content-Type": "application/json", Authorization: `Bearer ${entry.key}` };

    const resp = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: openrouterModel,
          temperature,
          max_tokens: maxTokens,
          ...(expectJson ? { response_format: { type: "json_object" } } : {}),
          messages: [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            { role: "user", content: userContent },
          ],
        }),
      },
      timeoutMs
    );
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      markKeyFailure(entry.provider, openrouterModel, entry.key, resp.status, errBody);
      console.warn(`[gemini-pool:${entry.provider}#slot-${entry.slotIndex}] HTTP ${resp.status}: ${errBody.slice(0, 220)}`);
      return null;
    }
    markKeySuccess(entry.provider, openrouterModel, entry.key);
    const data = await resp.json();
    const text = String(data?.choices?.[0]?.message?.content || "").trim();
    return text ? { text, model: openrouterModel } : null;
  } catch (err: any) {
    markKeyFailure(entry.provider, activeModel, entry.key, 0, String(err?.message || err));
    console.warn(`[gemini-pool:${entry.provider}#slot-${entry.slotIndex}]`, err?.message || err);
    return null;
  }
}

export async function callSonnet46Json<T = any>(params: {
  systemPrompt: string;
  userPrompt: string;
  cachedCoursePrefix?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  validate?: (parsed: any) => boolean;
}): Promise<PoolCallResult<T> | null> {
  const pool = resolveSonnetKeyPool();
  if (pool.length === 0) return null;

  const anthropicModel = readEnv("SONNET_MODEL") || DEFAULT_SONNET_MODEL;
  const openrouterModel = readEnv("SONNET_OPENROUTER_MODEL") || DEFAULT_OPENROUTER_SONNET_MODEL;
  const ordered = rotateOrder(pool, sonnetCursor, (e) => (e.provider === "anthropic" ? anthropicModel : openrouterModel));
  sonnetCursor = (sonnetCursor + 1) % pool.length;

  for (const entry of ordered) {
    const raw = await invokeSingleSonnetKey({
      entry,
      systemPrompt: params.systemPrompt,
      userContent: params.userPrompt,
      cachedCoursePrefix: params.cachedCoursePrefix,
      temperature: params.temperature ?? 0.35,
      maxTokens: Math.min(6144, Math.max(1024, params.maxTokens ?? 4096)),
      timeoutMs: params.timeoutMs ?? 32000,
    });
    if (!raw?.text) continue;
    const parsed = safeParseJsonObject(raw.text);
    if (!parsed) {
      console.warn(`[sonnet-pool] JSON non parsable (extrait): ${raw.text.slice(0, 180)}`);
      continue;
    }
    if (params.validate && !params.validate(parsed)) {
      console.warn(`[sonnet-pool] JSON rejeté par validate()`);
      continue;
    }
    return {
      data: parsed as T,
      provider: `sonnet-${entry.provider}`,
      model: raw.model,
      slotIndex: entry.slotIndex,
      totalSlots: pool.length,
    };
  }
  return null;
}

export async function callGemini25Json<T = any>(params: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  validate?: (parsed: any) => boolean;
}): Promise<PoolCallResult<T> | null> {
  const pool = resolveGeminiRepairKeyPool();
  if (pool.length === 0) return null;

  const geminiModel = readEnv("GEMINI_REPAIR_MODEL") || DEFAULT_GEMINI_MODEL;
  const openrouterModel = readEnv("GEMINI_REPAIR_OPENROUTER_MODEL") || DEFAULT_OPENROUTER_GEMINI_MODEL;
  const ordered = rotateOrder(pool, geminiCursor, (e) => (e.provider === "gemini" ? geminiModel : openrouterModel));
  geminiCursor = (geminiCursor + 1) % pool.length;

  for (const entry of ordered) {
    const raw = await invokeSingleGeminiKey({
      entry,
      systemPrompt: params.systemPrompt,
      userContent: params.userPrompt,
      temperature: params.temperature ?? 0.1,
      maxTokens: Math.min(8192, Math.max(1024, params.maxTokens ?? 4096)),
      expectJson: true,
      timeoutMs: params.timeoutMs ?? 24000,
    });
    if (!raw?.text) continue;
    const parsed = safeParseJsonObject(raw.text);
    if (!parsed) {
      console.warn(`[gemini-pool] JSON non parsable (extrait): ${raw.text.slice(0, 180)}`);
      continue;
    }
    if (params.validate && !params.validate(parsed)) {
      console.warn(`[gemini-pool] JSON rejeté par validate()`);
      continue;
    }
    return {
      data: parsed as T,
      provider: `gemini-${entry.provider}`,
      model: raw.model,
      slotIndex: entry.slotIndex,
      totalSlots: pool.length,
    };
  }
  return null;
}

export async function callSonnet46Vision(params: {
  images: Array<{ pageNumber?: number; mimeType?: string; data: string }>;
  promptText: string;
  timeoutMs?: number;
}): Promise<{ extractedText: string; provider: string; model: string } | null> {
  const pool = resolveSonnetKeyPool();
  if (pool.length === 0) return null;

  const anthropicModel = readEnv("SONNET_MODEL") || DEFAULT_SONNET_MODEL;
  const openrouterModel = readEnv("SONNET_OPENROUTER_MODEL") || DEFAULT_OPENROUTER_SONNET_MODEL;
  const ordered = rotateOrder(pool, sonnetCursor, (e) => (e.provider === "anthropic" ? anthropicModel : openrouterModel));
  sonnetCursor = (sonnetCursor + 1) % pool.length;

  for (const entry of ordered) {
    const content: any[] = [];
    for (let i = 0; i < params.images.length; i++) {
      const img = params.images[i];
      const base64 = String(img.data || "").includes(",") ? String(img.data).split(",")[1] : String(img.data || "");
      if (!base64) continue;
      const mimeType = img.mimeType || "image/jpeg";
      content.push({ type: "text", text: `--- PAGE ${img.pageNumber || i + 1} ---` });
      if (entry.provider === "anthropic") {
        content.push({
          type: "image",
          source: { type: "base64", media_type: mimeType, data: base64 },
        });
      } else {
        content.push({
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64}` },
        });
      }
    }
    if (content.length === 0) return null;
    content.push({ type: "text", text: params.promptText });

    const raw = await invokeSingleSonnetKey({
      entry,
      systemPrompt: "",
      userContent: content,
      temperature: 0.05,
      maxTokens: 4096,
      timeoutMs: params.timeoutMs ?? 24000,
    });
    if (raw?.text && raw.text.length > 20) {
      return {
        extractedText: raw.text,
        provider: `sonnet-${entry.provider}`,
        model: raw.model,
      };
    }
  }
  return null;
}

export async function callGemini25Vision(params: {
  images: Array<{ pageNumber?: number; mimeType?: string; data: string }>;
  promptText: string;
  timeoutMs?: number;
}): Promise<{ extractedText: string; provider: string; model: string } | null> {
  const pool = resolveGeminiRepairKeyPool();
  if (pool.length === 0) return null;

  const geminiModel = readEnv("GEMINI_REPAIR_MODEL") || DEFAULT_GEMINI_MODEL;
  const openrouterModel = readEnv("GEMINI_REPAIR_OPENROUTER_MODEL") || DEFAULT_OPENROUTER_GEMINI_MODEL;
  const ordered = rotateOrder(pool, geminiCursor, (e) => (e.provider === "gemini" ? geminiModel : openrouterModel));
  geminiCursor = (geminiCursor + 1) % pool.length;

  for (const entry of ordered) {
    const content: any[] = [];
    for (let i = 0; i < params.images.length; i++) {
      const img = params.images[i];
      const base64 = String(img.data || "").includes(",") ? String(img.data).split(",")[1] : String(img.data || "");
      if (!base64) continue;
      const mimeType = img.mimeType || "image/jpeg";
      if (entry.provider === "gemini") {
        content.push({ text: `--- PAGE ${img.pageNumber || i + 1} ---` });
        content.push({ inlineData: { mimeType, data: base64 } });
      } else {
        content.push({ type: "text", text: `--- PAGE ${img.pageNumber || i + 1} ---` });
        content.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } });
      }
    }
    if (content.length === 0) return null;
    content.push(entry.provider === "gemini" ? { text: params.promptText } : { type: "text", text: params.promptText });

    const raw = await invokeSingleGeminiKey({
      entry,
      systemPrompt: "",
      userContent: content,
      temperature: 0.05,
      maxTokens: 6144,
      expectJson: false,
      timeoutMs: params.timeoutMs ?? 22000,
    });
    if (raw?.text && raw.text.length > 20) {
      return {
        extractedText: raw.text,
        provider: `gemini-${entry.provider}`,
        model: raw.model,
      };
    }
  }
  return null;
}
