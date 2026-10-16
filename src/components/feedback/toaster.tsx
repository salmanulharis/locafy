"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; tone: ToastTone; message: string };

const ToastContext = createContext<(t: { tone?: ToastTone; message: string }) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: { tone?: ToastTone; message: string }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, tone: t.tone ?? "info", message: t.message }]);
  }, []);
  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, toast.tone === "error" ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [onDone, toast.tone]);
  const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? XCircle : Info;
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-surface p-3.5 text-sm shadow-lg",
      )}
    >
      <Icon
        className={cn("mt-0.5 size-5 shrink-0", toast.tone === "success" && "text-success", toast.tone === "error" && "text-danger", toast.tone === "info" && "text-info")}
        aria-hidden
      />
      <p className="flex-1 leading-relaxed">{toast.message}</p>
      <button type="button" onClick={onDone} className="-m-1 rounded p-1 text-muted hover:text-fg" aria-label="Dismiss notification">
        <X className="size-4" />
      </button>
    </div>
  );
}
