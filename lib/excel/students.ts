import "server-only";

import { Workbook, type Cell, type DataValidation } from "exceljs";
import type { z } from "zod";

import { ValidationError } from "@/lib/errors";
import { studentImportRowSchema } from "@/lib/validators/master";

export const MAX_STUDENT_IMPORT_ROWS = 5000;
export const MAX_STUDENT_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

export type StudentImportRow = z.infer<typeof studentImportRowSchema>;

export type StudentImportParseResult = {
  rows: StudentImportRow[];
  errors: { rowNumber: number; message: string }[];
};

export type StudentImportParseOptions = {
  classLabels?: string[];
};

type ColumnKey = "nisn" | "name" | "gender" | "birthDate" | "classLabel";

const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  nisn: [
    "nisn",
    "nis",
    "nomorinduk",
    "nomorindukpsiswa",
    "nomorindukpsiswadanasional",
  ],
  name: ["nama", "namalengkap", "namasiswa"],
  gender: ["jeniskelamin", "jk", "gender", "lp"],
  birthDate: ["tanggallahir", "tgllahir", "birthdate", "birthday"],
  classLabel: ["kelas", "class", "rombel", "namakelas"],
};

const TEMPLATE_HEADERS = [
  "NISN",
  "Nama Lengkap",
  "Jenis Kelamin",
  "Tanggal Lahir",
  "Kelas",
];

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeClassLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatDate(date: Date) {
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

function cellText(cell: Cell): string {
  const value = cell.value;
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => part.text)
        .join("")
        .trim();
    }
    if ("result" in value && value.result != null) {
      return String(value.result).trim();
    }
  }
  return String(cell.text ?? "").trim();
}

function normalizeGender(value: string): "L" | "P" | undefined {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  if (["l", "lakilaki", "pria", "male", "m"].includes(normalized)) return "L";
  if (["p", "perempuan", "wanita", "female", "f"].includes(normalized)) {
    return "P";
  }
  return undefined;
}

function isValidDate(year: number, month: number, day: number) {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseDateText(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;

  const iso = normalized.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!isValidDate(year, month, day)) return undefined;
    return formatDate(new Date(Date.UTC(year, month - 1, day)));
  }

  const local = normalized.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (local) {
    const day = Number(local[1]);
    const month = Number(local[2]);
    const year = Number(local[3].length === 2 ? `20${local[3]}` : local[3]);
    if (!isValidDate(year, month, day)) return undefined;
    return formatDate(new Date(Date.UTC(year, month - 1, day)));
  }

  return undefined;
}

function parseBirthDate(cell: Cell): {
  value?: string;
  error?: string;
} {
  const value = cell.value;
  if (value == null || cellText(cell) === "") return {};

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return { error: "Tanggal lahir tidak valid." };
    }
    return { value: formatDate(value) };
  }

  if (typeof value === "number") {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    const parsed = formatDate(date);
    if (!isValidDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())) {
      return { error: "Tanggal lahir tidak valid." };
    }
    return { value: parsed };
  }

  const parsed = parseDateText(cellText(cell));
  if (!parsed) {
    return {
      error: "Tanggal lahir tidak valid. Gunakan format YYYY-MM-DD.",
    };
  }
  return { value: parsed };
}

export async function parseStudentWorkbook(
  buffer: Buffer,
  options: StudentImportParseOptions = {},
): Promise<StudentImportParseResult> {
  if (buffer.byteLength > MAX_STUDENT_IMPORT_FILE_SIZE) {
    throw new ValidationError("Ukuran file maksimal 5 MB.");
  }

  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch {
    throw new ValidationError(
      "File Excel tidak dapat dibaca. Gunakan file .xlsx dari template.",
    );
  }

  const worksheet =
    workbook.getWorksheet("Siswa") ?? workbook.worksheets[0] ?? null;
  if (!worksheet) {
    throw new ValidationError("File Excel tidak memiliki sheet data.");
  }

  const headerCells = new Map<ColumnKey, number>();
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
    const header = normalizeHeader(cellText(cell));
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES) as [
      ColumnKey,
      string[],
    ][]) {
      if (!headerCells.has(key) && aliases.includes(header)) {
        headerCells.set(key, column);
      }
    }
  });

  if (
    !headerCells.has("nisn") ||
    !headerCells.has("name") ||
    !headerCells.has("gender")
  ) {
    throw new ValidationError(
      "Header file tidak sesuai. Gunakan template import siswa.",
    );
  }

  const lastRow = worksheet.actualRowCount;
  if (lastRow - 1 > MAX_STUDENT_IMPORT_ROWS) {
    throw new ValidationError(
      `Maksimal ${MAX_STUDENT_IMPORT_ROWS} siswa per import.`,
    );
  }

  const rows: StudentImportRow[] = [];
  const errors: StudentImportParseResult["errors"] = [];
  const seenNisn = new Map<string, number>();
  const allowedClasses = options.classLabels
    ? new Set(options.classLabels.map(normalizeClassLabel))
    : null;

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const nisn = headerCells.has("nisn")
      ? cellText(row.getCell(headerCells.get("nisn")!))
      : "";
    const name = headerCells.has("name")
      ? cellText(row.getCell(headerCells.get("name")!))
      : "";
    const genderText = headerCells.has("gender")
      ? cellText(row.getCell(headerCells.get("gender")!))
      : "";
    const birthDateCell = headerCells.has("birthDate")
      ? row.getCell(headerCells.get("birthDate")!)
      : null;
    const classCell = headerCells.has("classLabel")
      ? row.getCell(headerCells.get("classLabel")!)
      : null;
    const classLabel = classCell ? cellText(classCell) : "";

    if (
      !nisn &&
      !name &&
      !genderText &&
      !classLabel &&
      (!birthDateCell || cellText(birthDateCell) === "")
    ) {
      continue;
    }

    const gender = normalizeGender(genderText);
    if (!gender) {
      errors.push({
        rowNumber,
        message: "Jenis kelamin harus L/P (Laki-laki/Perempuan).",
      });
      continue;
    }

    const birthDate = birthDateCell
      ? parseBirthDate(birthDateCell)
      : { value: undefined };
    if (birthDate.error) {
      errors.push({ rowNumber, message: birthDate.error });
      continue;
    }

    if (
      classLabel &&
      allowedClasses &&
      !allowedClasses.has(normalizeClassLabel(classLabel))
    ) {
      errors.push({
        rowNumber,
        message: `Kelas "${classLabel}" tidak ditemukan pada tahun ajaran ini.`,
      });
      continue;
    }

    const parsed = studentImportRowSchema.safeParse({
      rowNumber,
      nisn,
      name,
      gender,
      birthDate: birthDate.value,
      classLabel: classLabel || undefined,
    });
    if (!parsed.success) {
      errors.push({
        rowNumber,
        message: parsed.error.issues[0]?.message ?? "Data siswa tidak valid.",
      });
      continue;
    }

    const duplicateRow = seenNisn.get(parsed.data.nisn);
    if (duplicateRow) {
      errors.push({
        rowNumber,
        message: `NISN ${parsed.data.nisn} duplikat dengan baris ${duplicateRow}.`,
      });
      continue;
    }

    seenNisn.set(parsed.data.nisn, rowNumber);
    rows.push(parsed.data);
  }

  return { rows, errors };
}

export async function buildStudentImportTemplate(
  classes: { label: string }[] = [],
) {
  const workbook = new Workbook();
  workbook.creator = "SiJAR";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Siswa", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  worksheet.columns = [
    { header: TEMPLATE_HEADERS[0], key: "nisn", width: 20 },
    { header: TEMPLATE_HEADERS[1], key: "name", width: 34 },
    { header: TEMPLATE_HEADERS[2], key: "gender", width: 20 },
    { header: TEMPLATE_HEADERS[3], key: "birthDate", width: 20 },
    { header: TEMPLATE_HEADERS[4], key: "classLabel", width: 24 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F46E5" },
  };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 24;

  worksheet.getColumn("nisn").numFmt = "@";
  worksheet.getColumn("birthDate").numFmt = "yyyy-mm-dd";
  worksheet.getColumn("gender").numFmt = "@";
  worksheet.getColumn("classLabel").numFmt = "@";
  worksheet.autoFilter = "A1:E1";
  const validations = worksheet as unknown as {
    dataValidations: {
      add(range: string, validation: DataValidation): void;
    };
  };
  validations.dataValidations.add("C2:C5001", {
    type: "list",
    allowBlank: false,
    formulae: ['"L,P"'],
    showErrorMessage: true,
    errorTitle: "Jenis kelamin tidak valid",
    error: "Gunakan L untuk Laki-laki atau P untuk Perempuan.",
  });

  if (classes.length > 0) {
    const classSheet = workbook.addWorksheet("Kelas");
    classSheet.getColumn(1).width = 30;
    classSheet.addRow(["Nama Kelas"]);
    classSheet.getRow(1).font = { bold: true };
    classSheet.addRows(classes.map((row) => [row.label]));
    validations.dataValidations.add("E2:E5001", {
      type: "list",
      allowBlank: true,
      formulae: [
        `'Kelas'!$A$2:$A$${Math.max(classes.length + 1, 2)}`,
      ],
      showErrorMessage: true,
      errorTitle: "Kelas tidak valid",
      error: "Pilih nama kelas yang tersedia pada sheet Kelas.",
    });
  }

  const guide = workbook.addWorksheet("Petunjuk");
  guide.getColumn(1).width = 100;
  guide.addRows([
    ["PETUNJUK IMPORT SISWA SIJAR"],
    [""],
    ["1. Isi data pada sheet Siswa mulai baris ke-2. Jangan mengubah nama header."],
    ["2. NISN wajib diisi, unik, maksimal 20 karakter. Simpan kolom NISN sebagai teks."],
    ["3. Nama Lengkap wajib diisi, maksimal 255 karakter."],
    ["4. Jenis Kelamin: L (Laki-laki) atau P (Perempuan)."],
    ["5. Tanggal Lahir opsional, format YYYY-MM-DD (contoh 2010-08-17)."],
    [
      classes.length > 0
        ? "6. Kelas opsional. Isi persis dengan nama kelas pada sheet Kelas agar siswa langsung terdaftar pada tahun ajaran yang dipilih."
        : "6. Kelas opsional. Belum ada kelas pada tahun ajaran aktif; kosongkan atau atur kelas melalui menu Enrollment setelah import.",
    ],
    ["7. Baris dengan NISN yang sudah terdaftar tidak dibuat ulang."],
    ["8. Maksimal 5000 siswa dan ukuran file maksimal 5 MB per import."],
  ]);
  guide.getRow(1).font = { bold: true, size: 14 };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
