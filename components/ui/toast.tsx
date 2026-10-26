"use client";

import {
  CircleAlert,
  CircleCheck,
  Info,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info";

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastItem = Required<Pick<ToastInput, "title" | "variant">> &
  Pick<ToastInput, "description"> & { id: number };

type ToastContextValue = {
  toast: (input: ToastInput) => void;
  successTick: number;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<
  ToastVariant,
  { container: string; icon: string; Icon: typeof CircleCheck }
> = {
  success: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-950",
    icon: "text-emerald-600",
    Icon: CircleCheck,
  },
  error: {
    container: "border-red-200 bg-red-50 text-red-950",
    icon: "text-red-600",
    Icon: CircleAlert,
  },
  info: {
    container: "border-sky-200 bg-sky-50 text-sky-950",
    icon: "text-sky-600",
    Icon: Info,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [successTick, setSuccessTick] = useState(0);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "info" }: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, title, description, variant }]);
      if (variant === "success") {
        setSuccessTick((tick) => tick + 1);
      }
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, successTick }), [toast, successTick]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:items-end"
      >
        {toasts.map((item) => {
          const style = variantStyles[item.variant];
          const Icon = style.Icon;
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-3 shadow-lg",
                style.container,
              )}
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", style.icon)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-sm opacity-90">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Tutup notifikasi"
                className="rounded p-1 text-slate-500 transition hover:bg-black/5 hover:text-slate-800"
                onClick={() => dismiss(item.id)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast harus dipakai di dalam ToastProvider.");
  }
  return context;
}
