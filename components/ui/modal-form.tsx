"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { ActionForm } from "@/components/ui/action-form";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/validators/common";

export function ModalForm({
  triggerLabel,
  triggerIcon,
  triggerVariant = "primary",
  triggerSize = "md",
  triggerClassName,
  title,
  description,
  submitLabel,
  pendingText,
  action,
  size,
  children,
}: {
  triggerLabel: string;
  triggerIcon?: ReactNode;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  triggerClassName?: string;
  title: string;
  description?: string;
  submitLabel: string;
  pendingText?: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { successTick } = useToast();
  const lastSuccess = useRef(successTick);

  useEffect(() => {
    if (successTick === lastSuccess.current) return;
    lastSuccess.current = successTick;
    setOpen(false);
  }, [successTick]);

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerIcon}
        {triggerLabel}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        size={size}
      >
        <ActionForm
          action={action}
          submitLabel={submitLabel}
          pendingText={pendingText}
          onCancel={() => setOpen(false)}
        >
          {children}
        </ActionForm>
      </Modal>
    </>
  );
}
