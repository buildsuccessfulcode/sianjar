"use client";

import { useActionState, useEffect, useRef } from "react";
import { LogIn } from "lucide-react";

import { Field, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { initialActionState, type ActionState } from "@/lib/validators/common";
import { login } from "./actions";

export function LoginForm() {
  const [state, formAction] = useActionState(login, initialActionState);
  const { toast } = useToast();
  const shownState = useRef<ActionState | null>(null);

  useEffect(() => {
    if (!state.message || shownState.current === state) return;
    shownState.current = state;
    toast({
      title: "Gagal masuk",
      description: state.message,
      variant: "error",
    });
  }, [state, toast]);

  return (
    <form action={formAction} className="space-y-5">

      <Field
        label="Email"
        htmlFor="email"
        error={state.fieldErrors?.email}
        required
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nama@sekolah.sch.id"
          invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={
            state.fieldErrors?.email ? "email-error" : undefined
          }
          required
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={state.fieldErrors?.password}
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
          required
        />
      </Field>

      <SubmitButton className="w-full" size="lg" pendingText="Masuk...">
        <LogIn className="h-4 w-4" />
        Masuk
      </SubmitButton>
    </form>
  );
}
