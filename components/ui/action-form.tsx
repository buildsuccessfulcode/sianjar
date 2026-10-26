"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, type ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { FormStateContext } from "@/components/ui/form-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { initialActionState, type ActionState } from "@/lib/validators/common";
import { cn } from "@/lib/utils";

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingText,
  cancelHref,
  onCancel,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel: string;
  pendingText?: string;
  cancelHref?: string;
  onCancel?: () => void;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const { toast } = useToast();
  const shownState = useRef<ActionState | null>(null);

  useEffect(() => {
    if (!state.message || shownState.current === state) return;
    shownState.current = state;
    toast({
      title: state.status === "success" ? "Berhasil" : "Gagal",
      description: state.message,
      variant: state.status === "success" ? "success" : "error",
    });
  }, [state, toast]);

  return (
    <FormStateContext.Provider value={{ fieldErrors: state.fieldErrors }}>
      <form action={formAction} className={cn("space-y-4", className)}>
        {children}
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton pendingText={pendingText ?? "Menyimpan..."}>
            {submitLabel}
          </SubmitButton>
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Batal
            </Button>
          ) : cancelHref ? (
            <Link
              href={cancelHref}
              className={buttonVariants({ variant: "ghost" })}
            >
              Batal
            </Link>
          ) : null}
        </div>
      </form>
    </FormStateContext.Provider>
  );
}
