"use client";

import {
  cloneElement,
  isValidElement,
  useState,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Eye, EyeOff } from "lucide-react";

import { useFormStateContext } from "@/components/ui/form-state";
import { cn } from "@/lib/utils";

const controlClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export function Label({
  className,
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium text-slate-700", className)}
      {...props}
    >
      {children}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  name,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  name?: string;
  hint?: string;
  error?: string | string[];
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const context = useFormStateContext();
  const resolvedError = error ?? context.fieldErrors?.[name ?? htmlFor];
  const errorText = Array.isArray(resolvedError)
    ? resolvedError[0]
    : resolvedError;
  const describedBy = errorText
    ? `${htmlFor}-error`
    : hint
      ? `${htmlFor}-hint`
      : undefined;

  const control = isValidElement(children)
    ? cloneElement(
        children as ReactElement<{
          "aria-describedby"?: string;
          "aria-invalid"?: boolean;
        }>,
        {
          "aria-describedby": describedBy,
          "aria-invalid": errorText ? true : undefined,
        },
      )
    : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </Label>
      {control}
      {hint && !errorText ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {errorText ? (
        <p id={`${htmlFor}-error`} className="text-xs text-red-600">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        controlClass,
        invalid && "border-red-400 focus:border-red-500 focus:ring-red-200",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function PasswordInput({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        invalid={invalid}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        controlClass,
        "min-h-24",
        invalid && "border-red-400 focus:border-red-500 focus:ring-red-200",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cn(
        controlClass,
        invalid && "border-red-400 focus:border-red-500 focus:ring-red-200",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  className,
  label,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700"
    >
      <input
        id={id}
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500",
          className,
        )}
        {...props}
      />
      {label}
    </label>
  );
}

