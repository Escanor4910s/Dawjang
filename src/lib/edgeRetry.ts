import { supabase } from "@/integrations/supabase/client";
import { callGeminiAcademicEngine } from "@/lib/syncEngine";
import {
  buildDynamicSynthesisPrompt,
  postProcessSynthesisOutput,
  DEFAULT_SYNTHESIS_CONFIG,
  type SynthesisConfig,
  type SynthesisDoctrine,
  type SynthesisDensityMode,
} from "@/lib/synthesisEngineV3";
import { extractObjectivesFromCourseText } from "@/lib/summaryEngine";

export interface InvokeWithRetryOptions {
  body: Record<string, unknown>;
  retries?: number;
  baseDelayMs?: number;
  retryOnStatuses?: number[];
  onRetry?: (attempt: number, lastStatus: number | undefined) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface InvokeResult<T = any> {
  data: T | null;
  error: { message: string; status?: number } | null;
}

function resolveDoctrine(body: Record<string, unknown>): SynthesisDoctrine {
  const raw = String(
    body.doctrine ||
      (body.synthesisConfig as Record<string, unknown> | undefined)?.doctrine ||
      body.template ||
      body.type ||
      "objectives_verbatim"
  ).toLowerCase();

  if (raw === "harvard_method" || raw === "harvard" || raw === "structured") {
    return "harvard_method";
  }
  if (raw === "arva" || raw === "arva_blocks") {
    return "arva";
  }
  if (raw === "world_number_one" || raw === "amboss" || raw === "concise" || raw === "flash") {
    return "world_number_one";
  }
  return "objectives_verbatim";
}

/**
 * Générateur académique haute fidélité pour les synthèses.
 * Déclenché dès que l'Edge Function distante 'generate-summary' renvoie une erreur (non-2xx).
 * Respecte 100 % des paramètres définis par l'utilisateur (Doctrine, Volume, Verbatim, Tableaux, Marqueurs, Connecteurs, Pièges QCM).
 */
async function generateSummaryFallback(body: Record<string, unknown>): Promise<string | null> {
  const title = String(body.title || body.courseTitle || "Synthèse de cours");
  const rawContent = String(
    body.content || body.courseContent || body.text || ""
  ).trim();

  if (!rawContent || rawContent.length < 20) {
    return null;
  }

  const nestedConfig = (body.synthesisConfig || {}) as Partial<SynthesisConfig>;
  const doctrine = resolveDoctrine(body);

  let objectives: string[] = Array.isArray(body.objectives)
    ? (body.objectives as string[]).filter((o) => typeof o === "string" && o.trim().length > 0)
    : Array.isArray(nestedConfig.objectives)
    ? nestedConfig.objectives.filter((o) => typeof o === "string" && o.trim().length > 0)
    : [];

  if (objectives.length === 0) {
    objectives = extractObjectivesFromCourseText(rawContent);
  }

  const targetWordCount =
    body.targetWordCount !== undefined
      ? Number(body.targetWordCount)
      : nestedConfig.targetWordCount !== undefined
      ? Number(nestedConfig.targetWordCount)
      : 0;

  const densityMode: SynthesisDensityMode =
    (body.densityMode as SynthesisDensityMode) ||
    nestedConfig.densityMode ||
    (targetWordCount > 0 ? "custom" : "unlimited");

  const config: SynthesisConfig = {
    ...DEFAULT_SYNTHESIS_CONFIG,
    ...nestedConfig,
    doctrine,
    densityMode,
    targetWordCount,
    objectives,
    verbatimProfessorSyntax:
      typeof body.verbatimProfessorSyntax === "boolean"
        ? body.verbatimProfessorSyntax
        : typeof nestedConfig.verbatimProfessorSyntax === "boolean"
        ? nestedConfig.verbatimProfessorSyntax
        : true,
    autoRichFormatting:
      typeof body.autoRichFormatting === "boolean"
        ? body.autoRichFormatting
        : typeof nestedConfig.autoRichFormatting === "boolean"
        ? nestedConfig.autoRichFormatting
        : true,
    preserveCourseTables:
      typeof body.preserveCourseTables === "boolean"
        ? body.preserveCourseTables
        : typeof nestedConfig.preserveCourseTables === "boolean"
        ? nestedConfig.preserveCourseTables
        : true,
    useLogicalConnectors:
      typeof body.useLogicalConnectors === "boolean"
        ? body.useLogicalConnectors
        : typeof nestedConfig.useLogicalConnectors === "boolean"
        ? nestedConfig.useLogicalConnectors
        : true,
    strictObjectivesFilter:
      typeof body.strictObjectivesFilter === "boolean"
        ? body.strictObjectivesFilter
        : typeof nestedConfig.strictObjectivesFilter === "boolean"
        ? nestedConfig.strictObjectivesFilter
        : true,
    includeClinicalPearls:
      typeof body.includeClinicalPearls === "boolean"
        ? body.includeClinicalPearls
        : typeof nestedConfig.includeClinicalPearls === "boolean"
        ? nestedConfig.includeClinicalPearls
        : true,
    customInstructions:
      typeof body.customInstructions === "string"
        ? body.customInstructions
        : nestedConfig.customInstructions || "",
  };

  const systemInstruction = buildDynamicSynthesisPrompt(config);

  const extraStrictPrompt =
    typeof body.strictPrompt === "string" && body.strictPrompt.trim().length > 0
      ? `\n\n=== RAPPEL DES DIRECTIVES DE SYNTHÈSE ===\n${body.strictPrompt.trim()}\n`
      : "";

  const userPrompt = `TITRE DU COURS : ${title}
DOCTRINE SÉLECTIONNÉE : ${doctrine}
${extraStrictPrompt}
=== TEXTE INTÉGRAL DU COURS À SYNTHÉTISER ===
${rawContent.slice(0, 135000)}`;

  try {
    const generated = await callGeminiAcademicEngine(systemInstruction, userPrompt, 0.15);
    if (generated && generated.trim().length > 50) {
      const processed = postProcessSynthesisOutput(generated, config);
      return processed.cleanedMarkdown;
    }
  } catch (err) {
    console.error("[generateSummaryFallback] Erreur lors de l'appel au moteur académique:", err);
  }

  return null;
}

/**
 * Invoke a Supabase Edge Function with exponential-backoff retry on transient errors.
 * Defaults: retry on 502/503/504, 2 retries, 800ms base delay.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function invokeWithRetry<T = any>(
  fn: string,
  opts: InvokeWithRetryOptions
): Promise<InvokeResult<T>> {
  const retries = opts.retries ?? 2;
  const baseDelay = opts.baseDelayMs ?? 800;
  const retryStatuses = opts.retryOnStatuses ?? [502, 503, 504];

  let lastErrorMsg = "Erreur inconnue";
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: opts.body });

      if (!error && data) {
        if (data.error && typeof data.error === "string") {
          lastErrorMsg = data.error;
          lastStatus = 500;
        } else {
          return { data: data as T, error: null };
        }
      } else if (error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx: any = (error as any).context;
        lastStatus = ctx?.status;
        lastErrorMsg = error.message || lastErrorMsg;
        try {
          if (ctx?.body) {
            const parsed = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
            if (parsed?.error) lastErrorMsg = parsed.error;
            else if (parsed?.message) lastErrorMsg = parsed.message;
          }
        } catch {
          /* ignore */
        }
      }
    } catch (invokeErr: any) {
      lastErrorMsg = invokeErr?.message || lastErrorMsg;
    }

    const shouldRetry =
      attempt < retries && (lastStatus === undefined || retryStatuses.includes(lastStatus));
    if (!shouldRetry) break;

    opts.onRetry?.(attempt + 1, lastStatus);
    await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
  }

  // ==========================================================================
  // RELAIS DE SECOURS TRANSPARENT (MOR-CHAT / GEMINI 2.5 FLASH) POUR "generate-summary"
  // ==========================================================================
  if (fn === "generate-summary") {
    console.warn(
      `[invokeWithRetry] L'Edge Function "generate-summary" a renvoyé (${lastStatus || 500}: ${lastErrorMsg}). Bascule transparente sur le moteur académique (mor-chat / Gemini)...`
    );

    try {
      const fallbackResult = await generateSummaryFallback(opts.body);
      if (fallbackResult) {
        return {
          data: {
            summary: fallbackResult,
            content: fallbackResult,
            text: fallbackResult,
            quality: {
              ok: true,
              metrics: { words: fallbackResult.split(/\s+/).filter(Boolean).length },
            },
          } as unknown as T,
          error: null,
        };
      }
    } catch (fallbackErr) {
      console.error("[invokeWithRetry] Échec du relais de synthèse:", fallbackErr);
    }
  }

  if (
    !lastErrorMsg ||
    lastErrorMsg.includes("Failed to send a request to the Edge Function") ||
    lastErrorMsg.includes("FunctionsFetchError")
  ) {
    lastErrorMsg =
      "Le service cloud est temporairement inaccessible. Les données locales et le moteur autonome prennent le relais.";
  }

  return { data: null, error: { message: lastErrorMsg, status: lastStatus } };
}
