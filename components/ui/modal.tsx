"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type SyntheticEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ModalSize = "sm" | "md" | "lg";

const sizes: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: ModalSize;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();

    return () => {
      document.body.style.overflow = "";
      if (dialog.open) dialog.close();
      previousFocus.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  const handleBackdrop = (event: SyntheticEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={handleBackdrop}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm",
        sizes[size],
      )}
    >
      <div className="flex max-h-[calc(100vh-2rem)] flex-col">
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Tutup dialog"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </dialog>
  );
}
