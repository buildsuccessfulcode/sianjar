export class ForbiddenError extends Error {
  constructor(message = "Anda tidak memiliki akses untuk aksi ini.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Data tidak ditemukan.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function pgErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === "23505";
}

export function isForeignKeyViolation(error: unknown): boolean {
  return pgErrorCode(error) === "23503";
}

export function errorMessage(error: unknown): string {
  if (
    error instanceof ForbiddenError ||
    error instanceof NotFoundError ||
    error instanceof ConflictError ||
    error instanceof ValidationError
  ) {
    return error.message;
  }

  if (isUniqueViolation(error)) {
    return "Data sudah ada. Periksa kembali nilai unik yang dimasukkan.";
  }

  if (isForeignKeyViolation(error)) {
    return "Data masih terhubung dengan data lain sehingga tidak dapat diproses.";
  }

  if (
    error instanceof Error &&
    error.message.startsWith("DATABASE_URL belum diset")
  ) {
    return error.message;
  }

  console.error("Unhandled application error", error);
  return "Terjadi kesalahan. Periksa data lalu coba lagi.";
}
