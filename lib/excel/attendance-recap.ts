import "server-only";

import { Workbook, type Worksheet } from "exceljs";

import type {
  AttendanceAnalyticsCounts,
  AttendanceAnalyticsStudentRow,
  AttendanceRecapAnalytics,
  AttendanceRisk,
} from "@/data-access/journals";
import { formatDateTimeId, formatShortDateId } from "@/lib/date";

export type AttendanceRecapWorkbookMeta = {
  dateFrom: string;
  dateTo: string;
  classFilter: string;
  subjectFilter: string;
  search?: string;
  generatedAt: Date;
};

type CellValue = string | number | null;

type ExportColumn = {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
  align?: "left" | "center" | "right";
};

const COLORS = {
  primary: "FF4338CA",
  primarySoft: "FFEEF2FF",
  title: "FF312E81",
  text: "FF0F172A",
  muted: "FF64748B",
  border: "FFE2E8F0",
  zebra: "FFF8FAFC",
  white: "FFFFFFFF",
};

const RISK_LABELS: Record<AttendanceRisk, string> = {
  TINGGI: "Tinggi",
  SEDANG: "Sedang",
  RENDAH: "Rendah",
  TIDAK_DIHITUNG: "Tidak dihitung",
};

function classLabel(row: {
  gradeLevel: number;
  departmentCode: string;
  section: string;
}) {
  return `${row.gradeLevel} ${row.departmentCode} ${row.section}`.trim();
}

function percent(part: number, whole: number) {
  if (whole <= 0) return null;
  return Math.min(1, Math.max(0, part / whole));
}

function riskFromRate(rate: number | null): AttendanceRisk {
  if (rate === null) return "TIDAK_DIHITUNG";
  if (rate < 0.75) return "TINGGI";
  if (rate < 0.9) return "SEDANG";
  return "RENDAH";
}

function addRateColorScale(
  worksheet: Worksheet,
  column: number,
  lastRow: number,
  mode: "attendance" | "absence",
) {
  if (lastRow < 2) return;
  const letter = worksheet.getColumn(column).letter;
  worksheet.addConditionalFormatting({
    ref: `${letter}2:${letter}${lastRow}`,
    rules: [
      {
        type: "colorScale",
        priority: 1,
        cfvo: [
          { type: "num", value: 0 },
          { type: "num", value: mode === "attendance" ? 0.85 : 0.12 },
          { type: "num", value: mode === "attendance" ? 1 : 0.3 },
        ],
        color:
          mode === "attendance"
            ? [
                { argb: "FFFEE2E2" },
                { argb: "FFFEF3C7" },
                { argb: "FFDCFCE7" },
              ]
            : [
                { argb: "FFDCFCE7" },
                { argb: "FFFEF3C7" },
                { argb: "FFFEE2E2" },
              ],
      },
    ],
  });
}

function addRiskFormatting(
  worksheet: Worksheet,
  column: number,
  lastRow: number,
) {
  if (lastRow < 2) return;
  const letter = worksheet.getColumn(column).letter;
  worksheet.addConditionalFormatting({
    ref: `${letter}2:${letter}${lastRow}`,
    rules: [
      {
        type: "cellIs",
        operator: "equal",
        formulae: ['"Tinggi"'],
        priority: 1,
        style: {
          font: { bold: true, color: { argb: "FF991B1B" } },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEE2E2" },
          },
        },
      },
      {
        type: "cellIs",
        operator: "equal",
        formulae: ['"Sedang"'],
        priority: 2,
        style: {
          font: { color: { argb: "FF92400E" } },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF3C7" },
          },
        },
      },
      {
        type: "cellIs",
        operator: "equal",
        formulae: ['"Rendah"'],
        priority: 3,
        style: {
          font: { color: { argb: "FF166534" } },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDCFCE7" },
          },
        },
      },
    ],
  });
}

function addTableSheet(
  workbook: Workbook,
  name: string,
  columns: ExportColumn[],
  rows: Record<string, CellValue>[],
) {
  const worksheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  worksheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
    style: column.numFmt ? { numFmt: column.numFmt } : undefined,
  }));
  worksheet.addRows(rows);

  const header = worksheet.getRow(1);
  header.height = 32;
  header.font = { bold: true, color: { argb: COLORS.white }, size: 11 };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.primary },
  };
  header.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };

  const lastRow = Math.max(rows.length + 1, 2);
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.height = 22;
    if (rowNumber % 2 === 1) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.zebra },
      };
    }
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: COLORS.border } },
      };
    });
  }

  columns.forEach((column, index) => {
    const target = worksheet.getColumn(index + 1);
    target.alignment = {
      vertical: "middle",
      horizontal: column.align ?? "left",
      wrapText: column.key === "classLabel" || column.key === "studentName",
    };
  });

  const lastColumn = worksheet.getColumn(columns.length).letter;
  worksheet.autoFilter = `A1:${lastColumn}${lastRow}`;

  return { worksheet, lastRow, columns };
}

function buildSummarySheet(
  workbook: Workbook,
  analytics: AttendanceRecapAnalytics,
  meta: AttendanceRecapWorkbookMeta,
) {
  const worksheet = workbook.addWorksheet("Ringkasan", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  worksheet.columns = [
    { width: 30 },
    { width: 20 },
    { width: 3 },
    { width: 24 },
    { width: 14 },
    { width: 20 },
    { width: 22 },
  ];

  worksheet.mergeCells("A1:G1");
  const title = worksheet.getCell("A1");
  title.value = "LAPORAN REKAP ABSENSI";
  title.font = { size: 18, bold: true, color: { argb: COLORS.title } };
  title.alignment = { vertical: "middle" };
  worksheet.getRow(1).height = 32;

  worksheet.mergeCells("A2:G2");
  const subtitle = worksheet.getCell("A2");
  subtitle.value = `Periode ${formatShortDateId(meta.dateFrom)} – ${formatShortDateId(
    meta.dateTo,
  )} • Dibuat ${formatDateTimeId(meta.generatedAt)}`;
  subtitle.font = { size: 10, color: { argb: COLORS.muted } };

  worksheet.mergeCells("A3:G3");
  const filters = worksheet.getCell("A3");
  filters.value = [
    `Kelas: ${meta.classFilter}`,
    `Mapel: ${meta.subjectFilter}`,
    meta.search ? `Pencarian: "${meta.search}"` : "Pencarian: -",
  ].join("   •   ");
  filters.font = { size: 10, italic: true, color: { argb: COLORS.muted } };
  filters.alignment = { wrapText: true };

  const summary = analytics.summary;

  worksheet.mergeCells("A5:B5");
  worksheet.getCell("A5").value = "IKHTISAR UTAMA";
  worksheet.mergeCells("D5:G5");
  worksheet.getCell("D5").value = "RINCIAN KETIDAKHADIRAN";
  for (const address of ["A5", "D5"]) {
    const cell = worksheet.getCell(address);
    cell.font = { bold: true, size: 11, color: { argb: COLORS.title } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.primarySoft },
    };
    cell.alignment = { vertical: "middle" };
  }
  worksheet.getRow(5).height = 26;

  const headerCells = ["A6", "B6", "D6", "E6", "F6", "G6"];
  const headerValues = [
    "Metrik",
    "Nilai",
    "Status",
    "Jumlah",
    "% dari Absensi",
    "% dari Siswa-Sesi",
  ];
  headerCells.forEach((address, index) => {
    const cell = worksheet.getCell(address);
    cell.value = headerValues[index];
    cell.font = { bold: true, color: { argb: COLORS.white } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.primary },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  worksheet.getRow(6).height = 30;

  const metrics: { label: string; value: CellValue; numFmt?: string }[] = [
    { label: "Jumlah kelas", value: summary.classCount, numFmt: "0" },
    { label: "Jumlah mapel", value: summary.subjectCount, numFmt: "0" },
    { label: "Sesi / jurnal", value: summary.sessions, numFmt: "0" },
    { label: "Siswa aktif", value: summary.students, numFmt: "0" },
    { label: "Siswa-sesi potensial", value: summary.expected, numFmt: "0" },
    { label: "Total ketidakhadiran", value: summary.total, numFmt: "0" },
    {
      label: "Tingkat kehadiran",
      value: summary.attendanceRate,
      numFmt: "0.0%",
    },
    {
      label: "Tingkat ketidakhadiran",
      value: summary.absenceRate,
      numFmt: "0.0%",
    },
    {
      label: "Rasio alpa",
      value: percent(summary.alpa, summary.expected),
      numFmt: "0.0%",
    },
  ];

  metrics.forEach((metric, index) => {
    const rowNumber = 7 + index;
    const labelCell = worksheet.getCell(`A${rowNumber}`);
    const valueCell = worksheet.getCell(`B${rowNumber}`);
    labelCell.value = metric.label;
    labelCell.font = { color: { argb: COLORS.text } };
    valueCell.value = metric.value;
    valueCell.font = { bold: true, color: { argb: COLORS.text } };
    valueCell.alignment = { horizontal: "right" };
    if (metric.numFmt) valueCell.numFmt = metric.numFmt;
    if (rowNumber % 2 === 1) {
      labelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.zebra },
      };
      valueCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.zebra },
      };
    }
  });

  const statusRows: {
    label: string;
    counts: AttendanceAnalyticsCounts;
  }[] = [
    { label: "Sakit", counts: { ...summary, total: summary.sakit } },
    { label: "Izin", counts: { ...summary, total: summary.izin } },
    { label: "Alpa", counts: { ...summary, total: summary.alpa } },
    { label: "Dispensasi", counts: { ...summary, total: summary.dispensasi } },
  ];

  statusRows.forEach((row, index) => {
    const rowNumber = 7 + index;
    worksheet.getCell(`D${rowNumber}`).value = row.label;
    worksheet.getCell(`E${rowNumber}`).value = row.counts.total;
    worksheet.getCell(`F${rowNumber}`).value = percent(
      row.counts.total,
      summary.total,
    );
    worksheet.getCell(`G${rowNumber}`).value = percent(
      row.counts.total,
      summary.expected,
    );
    worksheet.getCell(`F${rowNumber}`).numFmt = "0.0%";
    worksheet.getCell(`G${rowNumber}`).numFmt = "0.0%";
    worksheet.getCell(`E${rowNumber}`).alignment = { horizontal: "right" };
    worksheet.getCell(`F${rowNumber}`).alignment = { horizontal: "right" };
    worksheet.getCell(`G${rowNumber}`).alignment = { horizontal: "right" };
  });

  const totalRow = 7 + statusRows.length;
  worksheet.getCell(`D${totalRow}`).value = "Total";
  worksheet.getCell(`E${totalRow}`).value = summary.total;
  worksheet.getCell(`F${totalRow}`).value = summary.total > 0 ? 1 : null;
  worksheet.getCell(`G${totalRow}`).value = summary.absenceRate;
  worksheet.getCell(`F${totalRow}`).numFmt = "0.0%";
  worksheet.getCell(`G${totalRow}`).numFmt = "0.0%";
  for (const address of [`D${totalRow}`, `E${totalRow}`, `F${totalRow}`, `G${totalRow}`]) {
    const cell = worksheet.getCell(address);
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.primarySoft },
    };
    if (address !== `D${totalRow}`) {
      cell.alignment = { horizontal: "right" };
    }
  }

  const metricsEndRow = 7 + metrics.length - 1;
  const sectionClassRow = Math.max(metricsEndRow, totalRow) + 2;
  worksheet.mergeCells(`A${sectionClassRow}:G${sectionClassRow}`);
  const classSectionTitle = worksheet.getCell(`A${sectionClassRow}`);
  classSectionTitle.value = "KELAS DENGAN TINGKAT KEHADIRAN TERENDAH (TOP 5)";
  classSectionTitle.font = {
    bold: true,
    size: 11,
    color: { argb: COLORS.title },
  };
  classSectionTitle.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.primarySoft },
  };

  const classHeaderRow = sectionClassRow + 1;
  const classHeaders = [
    "Kelas",
    "Siswa",
    "Sesi",
    "Total Absen",
    "% Kehadiran",
    "% Alpa",
    "Risiko",
  ];
  classHeaders.forEach((value, index) => {
    const cell = worksheet.getCell(classHeaderRow, index + 1);
    cell.value = value;
    cell.font = { bold: true, color: { argb: COLORS.white } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.primary },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const topClasses = analytics.byClass.slice(0, 5);
  topClasses.forEach((row, index) => {
    const rowNumber = classHeaderRow + 1 + index;
    worksheet.getCell(`A${rowNumber}`).value = classLabel(row);
    worksheet.getCell(`B${rowNumber}`).value = row.students;
    worksheet.getCell(`C${rowNumber}`).value = row.sessions;
    worksheet.getCell(`D${rowNumber}`).value = row.total;
    worksheet.getCell(`E${rowNumber}`).value = row.attendanceRate;
    worksheet.getCell(`F${rowNumber}`).value = percent(row.alpa, row.expected);
    worksheet.getCell(`G${rowNumber}`).value = RISK_LABELS[riskFromRate(row.attendanceRate)];
    for (const column of ["B", "C", "D"]) {
      worksheet.getCell(`${column}${rowNumber}`).numFmt = "0";
    }
    worksheet.getCell(`E${rowNumber}`).numFmt = "0.0%";
    worksheet.getCell(`F${rowNumber}`).numFmt = "0.0%";
    for (let column = 2; column <= 6; column += 1) {
      worksheet.getCell(rowNumber, column).alignment = { horizontal: "right" };
    }
  });

  const studentSectionRow = classHeaderRow + Math.max(topClasses.length, 1) + 2;
  worksheet.mergeCells(`A${studentSectionRow}:G${studentSectionRow}`);
  const studentSectionTitle = worksheet.getCell(`A${studentSectionRow}`);
  studentSectionTitle.value =
    "SISWA DENGAN TINGKAT KEHADIRAN TERENDAH (TOP 10)";
  studentSectionTitle.font = {
    bold: true,
    size: 11,
    color: { argb: COLORS.title },
  };
  studentSectionTitle.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.primarySoft },
  };

  const studentHeaderRow = studentSectionRow + 1;
  const studentHeaders = [
    "Nama Siswa",
    "Kelas",
    "Sesi",
    "Total Absen",
    "% Kehadiran",
    "Alpa",
    "Risiko",
  ];
  studentHeaders.forEach((value, index) => {
    const cell = worksheet.getCell(studentHeaderRow, index + 1);
    cell.value = value;
    cell.font = { bold: true, color: { argb: COLORS.white } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.primary },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const topStudents = [...analytics.byStudent]
    .sort((a, b) => {
      const rateA = a.attendanceRate ?? 2;
      const rateB = b.attendanceRate ?? 2;
      if (rateA !== rateB) return rateA - rateB;
      if (a.total !== b.total) return b.total - a.total;
      return a.studentName.localeCompare(b.studentName);
    })
    .slice(0, 10);

  topStudents.forEach((row, index) => {
    const rowNumber = studentHeaderRow + 1 + index;
    worksheet.getCell(`A${rowNumber}`).value = row.studentName;
    worksheet.getCell(`B${rowNumber}`).value = classLabel(row);
    worksheet.getCell(`C${rowNumber}`).value = row.sessions;
    worksheet.getCell(`D${rowNumber}`).value = row.total;
    worksheet.getCell(`E${rowNumber}`).value = row.attendanceRate;
    worksheet.getCell(`F${rowNumber}`).value = row.alpa;
    worksheet.getCell(`G${rowNumber}`).value = RISK_LABELS[row.risk];
    for (const column of ["C", "D", "F"]) {
      worksheet.getCell(`${column}${rowNumber}`).numFmt = "0";
    }
    worksheet.getCell(`E${rowNumber}`).numFmt = "0.0%";
    for (let column = 3; column <= 6; column += 1) {
      worksheet.getCell(rowNumber, column).alignment = { horizontal: "right" };
    }
  });

  const noteRow = studentHeaderRow + Math.max(topStudents.length, 1) + 2;
  worksheet.mergeCells(`A${noteRow}:G${noteRow}`);
  const note = worksheet.getCell(`A${noteRow}`);
  note.value =
    "Kehadiran dihitung dari sesi jurnal × siswa aktif dikurangi ketidakhadiran. Lihat sheet Metodologi untuk asumsi dan rumus.";
  note.font = { italic: true, size: 9, color: { argb: COLORS.muted } };

  return worksheet;
}

function buildClassSheet(
  workbook: Workbook,
  analytics: AttendanceRecapAnalytics,
) {
  const columns: ExportColumn[] = [
    { header: "Kelas", key: "classLabel", width: 20 },
    { header: "Tingkat", key: "gradeLevel", width: 10, align: "center" },
    { header: "Jurusan", key: "departmentCode", width: 12, align: "center" },
    { header: "Rombel", key: "section", width: 12, align: "center" },
    { header: "Siswa", key: "students", width: 10, numFmt: "0", align: "right" },
    { header: "Sesi", key: "sessions", width: 10, numFmt: "0", align: "right" },
    {
      header: "Siswa-Sesi",
      key: "expected",
      width: 12,
      numFmt: "0",
      align: "right",
    },
    { header: "Hadir", key: "present", width: 10, numFmt: "0", align: "right" },
    { header: "Sakit", key: "sakit", width: 9, numFmt: "0", align: "right" },
    { header: "Izin", key: "izin", width: 9, numFmt: "0", align: "right" },
    { header: "Alpa", key: "alpa", width: 9, numFmt: "0", align: "right" },
    {
      header: "Dispensasi",
      key: "dispensasi",
      width: 12,
      numFmt: "0",
      align: "right",
    },
    {
      header: "Total Absen",
      key: "total",
      width: 12,
      numFmt: "0",
      align: "right",
    },
    {
      header: "% Kehadiran",
      key: "attendanceRate",
      width: 14,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Ketidakhadiran",
      key: "absenceRate",
      width: 16,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Sakit",
      key: "sakitRate",
      width: 10,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Izin",
      key: "izinRate",
      width: 10,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Alpa",
      key: "alpaRate",
      width: 10,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Dispensasi",
      key: "dispensasiRate",
      width: 13,
      numFmt: "0.0%",
      align: "right",
    },
    { header: "Risiko", key: "risk", width: 12, align: "center" },
  ];

  const rows = analytics.byClass.map((row) => ({
    classLabel: classLabel(row),
    gradeLevel: row.gradeLevel,
    departmentCode: row.departmentCode,
    section: row.section,
    students: row.students,
    sessions: row.sessions,
    expected: row.expected,
    present: row.present,
    sakit: row.sakit,
    izin: row.izin,
    alpa: row.alpa,
    dispensasi: row.dispensasi,
    total: row.total,
    attendanceRate: row.attendanceRate,
    absenceRate: row.absenceRate,
    sakitRate: percent(row.sakit, row.expected),
    izinRate: percent(row.izin, row.expected),
    alpaRate: percent(row.alpa, row.expected),
    dispensasiRate: percent(row.dispensasi, row.expected),
    risk: RISK_LABELS[riskFromRate(row.attendanceRate)],
  }));

  const { worksheet, lastRow } = addTableSheet(
    workbook,
    "Rekap per Kelas",
    columns,
    rows,
  );
  const attendanceColumn = columns.findIndex(
    (column) => column.key === "attendanceRate",
  ) + 1;
  addRateColorScale(worksheet, attendanceColumn, lastRow, "attendance");
  const absenceColumn = columns.findIndex(
    (column) => column.key === "absenceRate",
  ) + 1;
  addRateColorScale(worksheet, absenceColumn, lastRow, "absence");
}

function buildSubjectSheet(
  workbook: Workbook,
  analytics: AttendanceRecapAnalytics,
) {
  const columns: ExportColumn[] = [
    { header: "Mata Pelajaran", key: "subjectName", width: 30 },
    { header: "Kelas", key: "classCount", width: 10, numFmt: "0", align: "right" },
    { header: "Sesi", key: "sessions", width: 10, numFmt: "0", align: "right" },
    {
      header: "Siswa-Sesi",
      key: "expected",
      width: 12,
      numFmt: "0",
      align: "right",
    },
    { header: "Hadir", key: "present", width: 10, numFmt: "0", align: "right" },
    { header: "Sakit", key: "sakit", width: 9, numFmt: "0", align: "right" },
    { header: "Izin", key: "izin", width: 9, numFmt: "0", align: "right" },
    { header: "Alpa", key: "alpa", width: 9, numFmt: "0", align: "right" },
    {
      header: "Dispensasi",
      key: "dispensasi",
      width: 12,
      numFmt: "0",
      align: "right",
    },
    {
      header: "Total Absen",
      key: "total",
      width: 12,
      numFmt: "0",
      align: "right",
    },
    {
      header: "% Kehadiran",
      key: "attendanceRate",
      width: 14,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Ketidakhadiran",
      key: "absenceRate",
      width: 16,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Sakit",
      key: "sakitRate",
      width: 10,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Izin",
      key: "izinRate",
      width: 10,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Alpa",
      key: "alpaRate",
      width: 10,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Dispensasi",
      key: "dispensasiRate",
      width: 13,
      numFmt: "0.0%",
      align: "right",
    },
    { header: "Risiko", key: "risk", width: 12, align: "center" },
  ];

  const rows = analytics.bySubject.map((row) => ({
    subjectName: row.subjectName,
    classCount: row.classCount,
    sessions: row.sessions,
    expected: row.expected,
    present: row.present,
    sakit: row.sakit,
    izin: row.izin,
    alpa: row.alpa,
    dispensasi: row.dispensasi,
    total: row.total,
    attendanceRate: row.attendanceRate,
    absenceRate: row.absenceRate,
    sakitRate: percent(row.sakit, row.expected),
    izinRate: percent(row.izin, row.expected),
    alpaRate: percent(row.alpa, row.expected),
    dispensasiRate: percent(row.dispensasi, row.expected),
    risk: RISK_LABELS[riskFromRate(row.attendanceRate)],
  }));

  const { worksheet, lastRow } = addTableSheet(
    workbook,
    "Rekap per Mapel",
    columns,
    rows,
  );
  addRateColorScale(
    worksheet,
    columns.findIndex((column) => column.key === "attendanceRate") + 1,
    lastRow,
    "attendance",
  );
  addRateColorScale(
    worksheet,
    columns.findIndex((column) => column.key === "absenceRate") + 1,
    lastRow,
    "absence",
  );
}

function buildClassSubjectSheet(
  workbook: Workbook,
  analytics: AttendanceRecapAnalytics,
) {
  const columns: ExportColumn[] = [
    { header: "Kelas", key: "classLabel", width: 20 },
    { header: "Mata Pelajaran", key: "subjectName", width: 28 },
    { header: "Siswa", key: "students", width: 10, numFmt: "0", align: "right" },
    { header: "Sesi", key: "sessions", width: 10, numFmt: "0", align: "right" },
    {
      header: "Siswa-Sesi",
      key: "expected",
      width: 12,
      numFmt: "0",
      align: "right",
    },
    { header: "Hadir", key: "present", width: 10, numFmt: "0", align: "right" },
    { header: "Sakit", key: "sakit", width: 9, numFmt: "0", align: "right" },
    { header: "Izin", key: "izin", width: 9, numFmt: "0", align: "right" },
    { header: "Alpa", key: "alpa", width: 9, numFmt: "0", align: "right" },
    {
      header: "Dispensasi",
      key: "dispensasi",
      width: 12,
      numFmt: "0",
      align: "right",
    },
    {
      header: "Total Absen",
      key: "total",
      width: 12,
      numFmt: "0",
      align: "right",
    },
    {
      header: "% Kehadiran",
      key: "attendanceRate",
      width: 14,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Ketidakhadiran",
      key: "absenceRate",
      width: 16,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Alpa",
      key: "alpaRate",
      width: 10,
      numFmt: "0.0%",
      align: "right",
    },
    { header: "Risiko", key: "risk", width: 12, align: "center" },
  ];

  const rows = analytics.byClassSubject.map((row) => ({
    classLabel: classLabel(row),
    subjectName: row.subjectName,
    students: row.students,
    sessions: row.sessions,
    expected: row.expected,
    present: row.present,
    sakit: row.sakit,
    izin: row.izin,
    alpa: row.alpa,
    dispensasi: row.dispensasi,
    total: row.total,
    attendanceRate: row.attendanceRate,
    absenceRate: row.absenceRate,
    alpaRate: percent(row.alpa, row.expected),
    risk: RISK_LABELS[riskFromRate(row.attendanceRate)],
  }));

  const { worksheet, lastRow } = addTableSheet(
    workbook,
    "Rekap Kelas-Mapel",
    columns,
    rows,
  );
  addRateColorScale(
    worksheet,
    columns.findIndex((column) => column.key === "attendanceRate") + 1,
    lastRow,
    "attendance",
  );
  addRateColorScale(
    worksheet,
    columns.findIndex((column) => column.key === "absenceRate") + 1,
    lastRow,
    "absence",
  );
}

function buildStudentSheet(
  workbook: Workbook,
  analytics: AttendanceRecapAnalytics,
) {
  const columns: ExportColumn[] = [
    { header: "Kelas", key: "classLabel", width: 20 },
    { header: "NISN", key: "nisn", width: 18 },
    { header: "Nama Siswa", key: "studentName", width: 32 },
    { header: "Sesi", key: "sessions", width: 10, numFmt: "0", align: "right" },
    { header: "Hadir", key: "present", width: 10, numFmt: "0", align: "right" },
    { header: "Sakit", key: "sakit", width: 9, numFmt: "0", align: "right" },
    { header: "Izin", key: "izin", width: 9, numFmt: "0", align: "right" },
    { header: "Alpa", key: "alpa", width: 9, numFmt: "0", align: "right" },
    {
      header: "Dispensasi",
      key: "dispensasi",
      width: 12,
      numFmt: "0",
      align: "right",
    },
    {
      header: "Total Absen",
      key: "total",
      width: 12,
      numFmt: "0",
      align: "right",
    },
    {
      header: "% Kehadiran",
      key: "attendanceRate",
      width: 14,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Ketidakhadiran",
      key: "absenceRate",
      width: 16,
      numFmt: "0.0%",
      align: "right",
    },
    { header: "Risiko", key: "risk", width: 12, align: "center" },
  ];

  const rows = analytics.byStudent.map((row: AttendanceAnalyticsStudentRow) => ({
    classLabel: classLabel(row),
    nisn: row.nisn,
    studentName: row.studentName,
    sessions: row.sessions,
    present: row.present,
    sakit: row.sakit,
    izin: row.izin,
    alpa: row.alpa,
    dispensasi: row.dispensasi,
    total: row.total,
    attendanceRate: row.attendanceRate,
    absenceRate: row.absenceRate,
    risk: RISK_LABELS[row.risk],
  }));

  const { worksheet, lastRow } = addTableSheet(
    workbook,
    "Detail Siswa",
    columns,
    rows,
  );
  addRateColorScale(
    worksheet,
    columns.findIndex((column) => column.key === "attendanceRate") + 1,
    lastRow,
    "attendance",
  );
  addRateColorScale(
    worksheet,
    columns.findIndex((column) => column.key === "absenceRate") + 1,
    lastRow,
    "absence",
  );

  addRiskFormatting(
    worksheet,
    columns.findIndex((column) => column.key === "risk") + 1,
    lastRow,
  );
}

function buildStudentSubjectSheet(
  workbook: Workbook,
  analytics: AttendanceRecapAnalytics,
) {
  const columns: ExportColumn[] = [
    { header: "Kelas", key: "classLabel", width: 20 },
    { header: "NISN", key: "nisn", width: 18 },
    { header: "Nama Siswa", key: "studentName", width: 30 },
    { header: "Mata Pelajaran", key: "subjectName", width: 28 },
    { header: "Sesi", key: "sessions", width: 10, numFmt: "0", align: "right" },
    { header: "Hadir", key: "present", width: 10, numFmt: "0", align: "right" },
    { header: "Sakit", key: "sakit", width: 9, numFmt: "0", align: "right" },
    { header: "Izin", key: "izin", width: 9, numFmt: "0", align: "right" },
    { header: "Alpa", key: "alpa", width: 9, numFmt: "0", align: "right" },
    {
      header: "Dispensasi",
      key: "dispensasi",
      width: 12,
      numFmt: "0",
      align: "right",
    },
    {
      header: "Total Absen",
      key: "total",
      width: 12,
      numFmt: "0",
      align: "right",
    },
    {
      header: "% Kehadiran",
      key: "attendanceRate",
      width: 14,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Ketidakhadiran",
      key: "absenceRate",
      width: 16,
      numFmt: "0.0%",
      align: "right",
    },
    {
      header: "% Alpa",
      key: "alpaRate",
      width: 10,
      numFmt: "0.0%",
      align: "right",
    },
    { header: "Risiko", key: "risk", width: 12, align: "center" },
  ];

  const rows = analytics.byStudentSubject.map((row) => ({
    classLabel: classLabel(row),
    nisn: row.nisn,
    studentName: row.studentName,
    subjectName: row.subjectName,
    sessions: row.sessions,
    present: row.present,
    sakit: row.sakit,
    izin: row.izin,
    alpa: row.alpa,
    dispensasi: row.dispensasi,
    total: row.total,
    attendanceRate: row.attendanceRate,
    absenceRate: row.absenceRate,
    alpaRate: percent(row.alpa, row.expected),
    risk: RISK_LABELS[row.risk],
  }));

  const { worksheet, lastRow } = addTableSheet(
    workbook,
    "Rekap Siswa-Mapel",
    columns,
    rows,
  );
  addRateColorScale(
    worksheet,
    columns.findIndex((column) => column.key === "attendanceRate") + 1,
    lastRow,
    "attendance",
  );
  addRateColorScale(
    worksheet,
    columns.findIndex((column) => column.key === "absenceRate") + 1,
    lastRow,
    "absence",
  );
  addRiskFormatting(
    worksheet,
    columns.findIndex((column) => column.key === "risk") + 1,
    lastRow,
  );
}

function buildMethodologySheet(
  workbook: Workbook,
  analytics: AttendanceRecapAnalytics,
  meta: AttendanceRecapWorkbookMeta,
) {
  const worksheet = workbook.addWorksheet("Metodologi");
  worksheet.getColumn(1).width = 32;
  worksheet.getColumn(2).width = 110;

  worksheet.mergeCells("A1:B1");
  const title = worksheet.getCell("A1");
  title.value = "METODOLOGI DAN DEFINISI METRIK";
  title.font = { bold: true, size: 14, color: { argb: COLORS.title } };
  worksheet.getRow(1).height = 26;

  const rows: [string, string][] = [
    ["Periode laporan", `${meta.dateFrom} sampai ${meta.dateTo}`],
    ["Sumber data", "Jurnal mengajar (journals) dan catatan ketidakhadiran (attendance_records)"],
    [
      "Kehadiran",
      "Sistem hanya menyimpan status SAKIT, IZIN, ALPA, dan DISPENSASI. Siswa yang tidak memiliki catatan pada sebuah sesi dianggap HADIR.",
    ],
    [
      "Sesi",
      "Satu baris jurnal untuk satu jadwal pada satu tanggal. Sesi dihitung per kelas dan per mata pelajaran.",
    ],
    [
      "Siswa-sesi potensial",
      "Jumlah sesi pada periode dikali jumlah siswa aktif pada kelas tersebut. Nilai ini menjadi penyebut tingkat kehadiran.",
    ],
    [
      "Rekap siswa-mapel",
      "Satu baris per kombinasi siswa dan mata pelajaran pada kelasnya. Siswa yang selalu hadir tetap muncul dengan kehadiran 100%; siswa dengan catatan absensi pada mapel tertentu dapat langsung dibandingkan.",
    ],
    [
      "Tingkat kehadiran",
      "(Siswa-sesi potensial − total ketidakhadiran) ÷ siswa-sesi potensial. Nilai dibatasi 0%–100%.",
    ],
    [
      "Tingkat ketidakhadiran",
      "Total ketidakhadiran ÷ siswa-sesi potensial.",
    ],
    [
      "% per status",
      "Jumlah status (sakit/izin/alpa/dispensasi) ÷ siswa-sesi potensial. Total seluruh persentase status sama dengan tingkat ketidakhadiran.",
    ],
    [
      "% dari absensi",
      "Kontribusi satu status terhadap total ketidakhadiran (sakit + izin + alpa + dispensasi).",
    ],
    [
      "Risiko",
      "Rendah: kehadiran ≥ 90%; Sedang: 75%–89,9%; Tinggi: < 75%. Ambang dapat disesuaikan kebijakan sekolah.",
    ],
    [
      "Filter pencarian",
      "Sheet Detail Siswa mengikuti pencarian nama/NISN. Sheet agregat (ringkasan, per kelas, per mapel) sengaja tidak memakai pencarian agar penyebut tetap utuh.",
    ],
    [
      "Keterbatasan",
      "Jumlah siswa aktif memakai enrollment saat laporan dibuat. Siswa yang pindah/keluar di tengah periode dapat membuat angka sedikit berbeda dari kondisi historis. Nilai negatif karena itu dibatasi menjadi 0%.",
    ],
    [
      "Jumlah data",
      `${analytics.summary.classCount} kelas, ${analytics.summary.subjectCount} mapel, ${analytics.summary.sessions} sesi, ${analytics.summary.students} siswa aktif.`,
    ],
  ];

  rows.forEach(([label, value], index) => {
    const rowNumber = 3 + index;
    const labelCell = worksheet.getCell(`A${rowNumber}`);
    const valueCell = worksheet.getCell(`B${rowNumber}`);
    labelCell.value = label;
    labelCell.font = { bold: true, color: { argb: COLORS.text } };
    labelCell.alignment = { vertical: "top", wrapText: true };
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.primarySoft },
    };
    valueCell.value = value;
    valueCell.alignment = { vertical: "top", wrapText: true };
  });

  worksheet.getColumn(1).alignment = { vertical: "top", wrapText: true };
  worksheet.getColumn(2).alignment = { vertical: "top", wrapText: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  return worksheet;
}

export async function buildAttendanceRecapWorkbook(
  analytics: AttendanceRecapAnalytics,
  meta: AttendanceRecapWorkbookMeta,
) {
  const workbook = new Workbook();
  workbook.creator = "SiJAR";
  workbook.created = meta.generatedAt;
  workbook.modified = meta.generatedAt;
  workbook.properties.date1904 = false;

  buildSummarySheet(workbook, analytics, meta);
  buildClassSheet(workbook, analytics);
  buildSubjectSheet(workbook, analytics);
  buildClassSubjectSheet(workbook, analytics);
  buildStudentSheet(workbook, analytics);
  buildStudentSubjectSheet(workbook, analytics);
  buildMethodologySheet(workbook, analytics, meta);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
