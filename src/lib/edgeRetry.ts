import { supabase } from "@/integrations/supabase/client";

export interface InvokeWithRetryOptions {
  body: Record<string, unknown>;
  retries?: number;
  baseDelayMs?: number;
  retryOnStatuses?: number[];
  onRetry?: (attempt: number, lastStatus: number | undefined) => void;
}

export interface InvokeResult<T = any> {
  data: T | null;
  error: { message: string; status?: number } | null;
}

/**
 * Invoke a Supabase Edge Function with exponential-backoff retry on transient errors.
 * Defaults: retry on 502/503/504, 2 retries, 800ms base delay.
 */
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
    const { data, error } = await supabase.functions.invoke(fn, { body: opts.body });

    if (!error) {
      return { data: data as T, error: null };
    }

    // Try to read status + message from FunctionsHttpError
    const ctx: any = (error as any).context;
    lastStatus = ctx?.status;
    lastErrorMsg = error.message || lastErrorMsg;
    try {
      if (ctx?.body) {
        const parsed = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
        if (parsed?.error) lastErrorMsg = parsed.error;
        else if (parsed?.message) lastErrorMsg = parsed.message;
      }
    } catch { /* ignore */ }

    const shouldRetry = attempt < retries && (lastStatus === undefined || retryStatuses.includes(lastStatus));
    if (!shouldRetry) break;

    opts.onRetry?.(attempt + 1, lastStatus);
    await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
  }

  return { data: null, error: { message: lastErrorMsg, status: lastStatus } };
}
