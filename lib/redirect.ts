export function resolveReturnTo(formData: FormData, fallback: string) {
  const raw = String(formData.get("returnTo") ?? "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback;
  }
  try {
    const url = new URL(raw, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

export function redirectWithFlash(
  formData: FormData,
  fallback: string,
  key: "success" | "error",
  message: string,
) {
  const url = new URL(resolveReturnTo(formData, fallback), "http://localhost");
  url.searchParams.delete("success");
  url.searchParams.delete("error");
  url.searchParams.set(key, message);
  return `${url.pathname}${url.search}`;
}
