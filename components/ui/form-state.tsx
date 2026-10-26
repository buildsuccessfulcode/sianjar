"use client";

import { createContext, useContext } from "react";

export const FormStateContext = createContext<{
  fieldErrors?: Record<string, string[] | undefined>;
}>({});

export function useFormStateContext() {
  return useContext(FormStateContext);
}
