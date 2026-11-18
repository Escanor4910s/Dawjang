// src/hooks/use-toast.ts
import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";
import { pushAppNotification } from "@/hooks/useNotifications";

const TOAST_LIMIT = 4;
const TOAST_REMOVE_DELAY = 4800;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  createdAt?: string;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string, customDelay = TOAST_REMOVE_DELAY) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, customDelay);

  toastTimeouts.set(toastId, timeout);
};

export const pauseToastTimeout = (toastId: string) => {
  const existing = toastTimeouts.get(toastId);
  if (existing) {
    clearTimeout(existing);
    toastTimeouts.delete(toastId);
  }
};

export const resumeToastTimeout = (toastId: string, delayMs = 3000) => {
  addToRemoveQueue(toastId, delayMs);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      if (toastId) {
        pauseToastTimeout(toastId);
        addToRemoveQueue(toastId, 300);
      } else {
        state.toasts.forEach((toast) => {
          pauseToastTimeout(toast.id);
          addToRemoveQueue(toast.id, 300);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();
  const nowStr = new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  // Synchronise automatiquement la notification dans la cloche du Centre de Notifications DawJang
  if (typeof props.title === "string" && props.title.trim()) {
    const tLower = props.title.toLowerCase();
    const inferredType =
      tLower.includes("lv.") || tLower.includes("palier")
        ? "level_up"
        : tLower.includes("badge") || tLower.includes("médaille")
        ? "badge"
        : tLower.includes("cours") || tLower.includes("fichier")
        ? "course"
        : tLower.includes("qcm") || tLower.includes("examen")
        ? "quiz"
        : "system";

    pushAppNotification(
      {
        type: inferredType,
        title: props.title,
        message:
          typeof props.description === "string" ? props.description : "",
      },
      true // silent = true pour éviter une boucle infinie
    );
  }

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      createdAt: nowStr,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  // Planifie la fermeture automatique (un peu plus longue pour les alertes destructives ou longues)
  const descLen = typeof props.description === "string" ? props.description.length : 0;
  const initialDelay =
    props.variant === "destructive" || descLen > 110 ? 6500 : TOAST_REMOVE_DELAY;
  addToRemoveQueue(id, initialDelay);

  return {
    id: id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast, toast };
