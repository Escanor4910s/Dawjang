// src/lib/sonnerAdapter.ts
import {
  type NotificationTone,
  dismissAppNotification,
  emitAppNotification,
  updateAppNotification,
} from "@/lib/notificationHub";

interface SonnerLikeOptions {
  id?: string | number;
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
  icon?: unknown;
  className?: string;
  [key: string]: unknown;
}

function dispatchSonner(
  tone: NotificationTone | undefined,
  message: unknown,
  opts?: SonnerLikeOptions
): string {
  const title = typeof message === "string" ? message : String(message ?? "Notification");
  return emitAppNotification({
    id: opts?.id ? String(opts.id) : undefined,
    title,
    description: typeof opts?.description === "string" ? opts.description : undefined,
    tone,
    durationMs: opts?.duration,
    skipCenter: tone === "loading",
    action: opts?.action
      ? { label: opts.action.label, onClick: opts.action.onClick }
      : undefined,
    source: "sonner",
  });
}

type SonnerToastFn = ((message: unknown, opts?: SonnerLikeOptions) => string) & {
  success: (message: unknown, opts?: SonnerLikeOptions) => string;
  error: (message: unknown, opts?: SonnerLikeOptions) => string;
  info: (message: unknown, opts?: SonnerLikeOptions) => string;
  warning: (message: unknown, opts?: SonnerLikeOptions) => string;
  message: (message: unknown, opts?: SonnerLikeOptions) => string;
  loading: (message: unknown, opts?: SonnerLikeOptions) => string;
  dismiss: (id?: string | number) => void;
  promise: <T>(
    promise: Promise<T> | (() => Promise<T>),
    msgs: { loading?: string; success?: string | ((data: T) => string); error?: string | ((err: unknown) => string) }
  ) => Promise<T>;
};

export const toast: SonnerToastFn = Object.assign(
  (message: unknown, opts?: SonnerLikeOptions) => dispatchSonner(undefined, message, opts),
  {
    success: (message: unknown, opts?: SonnerLikeOptions) => dispatchSonner("success", message, opts),
    error: (message: unknown, opts?: SonnerLikeOptions) => dispatchSonner("error", message, opts),
    info: (message: unknown, opts?: SonnerLikeOptions) => dispatchSonner("info", message, opts),
    warning: (message: unknown, opts?: SonnerLikeOptions) => dispatchSonner("warning", message, opts),
    message: (message: unknown, opts?: SonnerLikeOptions) => dispatchSonner("info", message, opts),
    loading: (message: unknown, opts?: SonnerLikeOptions) => dispatchSonner("loading", message, opts),
    dismiss: (id?: string | number) => dismissAppNotification(id ? String(id) : undefined),
    promise: async <T,>(
      promiseOrFn: Promise<T> | (() => Promise<T>),
      msgs: { loading?: string; success?: string | ((data: T) => string); error?: string | ((err: unknown) => string) }
    ): Promise<T> => {
      const id = dispatchSonner("loading", msgs.loading || "Traitement en cours…");
      try {
        const result = typeof promiseOrFn === "function" ? await promiseOrFn() : await promiseOrFn;
        const okTitle = typeof msgs.success === "function" ? msgs.success(result) : msgs.success || "Terminé";
        updateAppNotification(id, { title: okTitle, tone: "success" });
        setTimeout(() => dismissAppNotification(id), 3600);
        return result;
      } catch (err) {
        const errTitle = typeof msgs.error === "function" ? msgs.error(err) : msgs.error || "Une erreur est survenue";
        updateAppNotification(id, { title: errTitle, tone: "error" });
        setTimeout(() => dismissAppNotification(id), 5500);
        throw err;
      }
    },
  }
);

// Composant neutre (le rendu unifié est assuré par <Toaster /> de toaster.tsx)
export const Toaster = (_props?: Record<string, unknown>) => null;
