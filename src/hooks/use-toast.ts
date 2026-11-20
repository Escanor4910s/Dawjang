// src/hooks/use-toast.ts
import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";
import {
  type DawJangNotification,
  HUB_DISMISS_EVENT,
  HUB_PUSH_EVENT,
  HUB_UPDATE_EVENT,
  dismissAppNotification,
  emitAppNotification,
  updateAppNotification,
} from "@/lib/notificationHub";

const TOAST_LIMIT = 4;

export interface ToasterToast {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  variant?: ToastProps["variant"];
  notification: DawJangNotification;
  open: boolean;
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function extractPlainText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractPlainText).join(" ");
  if (React.isValidElement(node) && node.props?.children) {
    return extractPlainText(node.props.children);
  }
  return "";
}

interface State {
  toasts: ToasterToast[];
}

let memoryState: State = { toasts: [] };
const listeners = new Set<(state: State) => void>();

function broadcast(next: State) {
  memoryState = next;
  listeners.forEach((l) => l(memoryState));
}

export const pauseToastTimeout = (toastId: string) => {
  const existing = toastTimeouts.get(toastId);
  if (existing) {
    clearTimeout(existing);
    toastTimeouts.delete(toastId);
  }
};

export const resumeToastTimeout = (toastId: string, delayMs = 3200) => {
  pauseToastTimeout(toastId);
  const timer = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dismissToastInternal(toastId);
  }, delayMs);
  toastTimeouts.set(toastId, timer);
};

function dismissToastInternal(toastId?: string) {
  if (toastId) {
    pauseToastTimeout(toastId);
    broadcast({
      toasts: memoryState.toasts.filter((t) => t.id !== toastId),
    });
  } else {
    toastTimeouts.forEach((t) => clearTimeout(t));
    toastTimeouts.clear();
    broadcast({ toasts: [] });
  }
}

let hubListenersInstalled = false;
function ensureHubBridge() {
  if (hubListenersInstalled || typeof window === "undefined") return;
  hubListenersInstalled = true;

  window.addEventListener(HUB_PUSH_EVENT, (e: Event) => {
    const notif = (e as CustomEvent<DawJangNotification>).detail;
    if (!notif) return;

    const entry: ToasterToast = {
      id: notif.id,
      title: notif.title,
      description: notif.message || undefined,
      variant: notif.tone === "error" ? "destructive" : "default",
      notification: notif,
      open: true,
    };

    const existingIdx = memoryState.toasts.findIndex((t) => t.id === notif.id);
    const nextList =
      existingIdx >= 0
        ? memoryState.toasts.map((t) => (t.id === notif.id ? entry : t))
        : [entry, ...memoryState.toasts].slice(0, TOAST_LIMIT);

    broadcast({ toasts: nextList });

    if (notif.durationMs && notif.durationMs > 0) {
      resumeToastTimeout(notif.id, notif.durationMs);
    }
  });

  window.addEventListener(HUB_UPDATE_EVENT, (e: Event) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { id, patch } = (e as CustomEvent<{ id: string; patch: any }>).detail || {};
    if (!id || !patch) return;
    broadcast({
      toasts: memoryState.toasts.map((t) => {
        if (t.id !== id) return t;
        const nextNotif: DawJangNotification = {
          ...t.notification,
          title: patch.title ?? t.notification.title,
          message: patch.description ?? t.notification.message,
          tone: patch.tone ?? t.notification.tone,
          action: patch.action ?? t.notification.action,
        };
        return {
          ...t,
          title: nextNotif.title,
          description: nextNotif.message,
          variant: nextNotif.tone === "error" ? "destructive" : "default",
          notification: nextNotif,
        };
      }),
    });
  });

  window.addEventListener(HUB_DISMISS_EVENT, (e: Event) => {
    const { id } = (e as CustomEvent<{ id?: string }>).detail || {};
    dismissToastInternal(id);
  });
}

type LegacyToastInput = Omit<ToastProps, "id"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  duration?: number;
};

function toast({ title, description, variant, duration, action }: LegacyToastInput) {
  ensureHubBridge();
  const titleStr = extractPlainText(title).trim() || "Notification";
  const descStr = extractPlainText(description).trim();

  const id = emitAppNotification({
    title: titleStr,
    description: descStr,
    tone: variant === "destructive" ? "error" : undefined,
    durationMs: duration,
  });

  // Si un ReactElement `action` personnalisé a été fourni, on l'attache à la carte
  if (action) {
    broadcast({
      toasts: memoryState.toasts.map((t) => (t.id === id ? { ...t, action } : t)),
    });
  }

  return {
    id,
    dismiss: () => dismissAppNotification(id),
    update: (next: Partial<LegacyToastInput>) =>
      updateAppNotification(id, {
        title: next.title ? extractPlainText(next.title) : undefined,
        description: next.description ? extractPlainText(next.description) : undefined,
        tone: next.variant === "destructive" ? "error" : undefined,
      }),
  };
}

function useToast() {
  ensureHubBridge();
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.add(setState);
    setState(memoryState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dismissAppNotification(toastId),
  };
}

export { useToast, toast };
