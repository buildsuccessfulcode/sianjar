"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function ConfirmSubmit({
  message,
  title = "Konfirmasi tindakan",
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  confirmVariant = "danger",
  children,
  pendingText = "Memproses...",
  ...props
}: ButtonProps & {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonProps["variant"];
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        {...props}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {pendingText}
          </>
        ) : (
          children
        )}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={message}
        size="sm"
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            variant={confirmVariant}
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              const form = event.currentTarget.form;
              setOpen(false);
              form?.requestSubmit();
            }}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </Modal>
    </>
  );
}
