import type { Metadata } from "next";
import { CalendarPlus, CheckCircle2, Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Field, Input, Select } from "@/components/ui/form";
import { ModalForm } from "@/components/ui/modal-form";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAcademicYears, listSemesters } from "@/data-access/master";
import { formatShortDateId } from "@/lib/date";
import { requirePagePermission } from "@/lib/dal";
import {
  activateSemesterAction,
  activateYear,
  deleteYear,
  saveAcademicYear,
  saveSemester,
} from "./actions";

export const metadata: Metadata = { title: "Tahun Ajaran" };
export const dynamic = "force-dynamic";

type YearRow = Awaited<ReturnType<typeof listAcademicYears>>[number];
type SemesterRow = Awaited<ReturnType<typeof listSemesters>>[number];

function YearFields({ year }: { year?: YearRow }) {
  return (
    <>
      {year ? <input type="hidden" name="id" value={year.id} /> : null}
      <Field label="Nama" htmlFor="yearName" name="name" required>
        <Input
          id="yearName"
          name="name"
          placeholder="2026/2027"
          defaultValue={year?.name}
          required
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tanggal Mulai" htmlFor="yearStartDate" name="startDate" required>
          <Input
            id="yearStartDate"
            name="startDate"
            type="date"
            defaultValue={year?.startDate}
            required
          />
        </Field>
        <Field label="Tanggal Selesai" htmlFor="yearEndDate" name="endDate" required>
          <Input
            id="yearEndDate"
            name="endDate"
            type="date"
            defaultValue={year?.endDate}
            required
          />
        </Field>
      </div>
    </>
  );
}

function SemesterFields({
  semester,
  years,
}: {
  semester?: SemesterRow;
  years: YearRow[];
}) {
  return (
    <>
      {semester ? (
        <input type="hidden" name="id" value={semester.id} />
      ) : null}
      {semester ? (
        <>
          <input
            type="hidden"
            name="academicYearId"
            value={semester.academicYearId}
          />
          <Field label="Tahun Ajaran" htmlFor="academicYearDisplay">
            <Input
              id="academicYearDisplay"
              value={semester.academicYearName}
              disabled
            />
          </Field>
        </>
      ) : (
        <Field label="Tahun Ajaran" htmlFor="academicYearId" required>
          <Select
            id="academicYearId"
            name="academicYearId"
            defaultValue={years[0]?.id ?? ""}
            required
          >
            <option value="" disabled>
              Pilih tahun ajaran
            </option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Semester" htmlFor="semesterName" name="name" required>
        <Select
          id="semesterName"
          name="name"
          defaultValue={semester?.name ?? "GANJIL"}
          required
        >
          <option value="GANJIL">Ganjil</option>
          <option value="GENAP">Genap</option>
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tanggal Mulai" htmlFor="semesterStartDate" name="startDate" required>
          <Input
            id="semesterStartDate"
            name="startDate"
            type="date"
            defaultValue={semester?.startDate}
            required
          />
        </Field>
        <Field label="Tanggal Selesai" htmlFor="semesterEndDate" name="endDate" required>
          <Input
            id="semesterEndDate"
            name="endDate"
            type="date"
            defaultValue={semester?.endDate}
            required
          />
        </Field>
      </div>
    </>
  );
}

export default async function AcademicYearPage() {
  await requirePagePermission("manage:master_data");
  const [years, semesters] = await Promise.all([
    listAcademicYears(),
    listSemesters(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tahun Ajaran & Semester"
        description="Hanya satu tahun ajaran dan satu semester yang boleh aktif. Aktifkan semester setelah tahun ajarannya aktif."
        actions={
          <>
            <ModalForm
              action={saveAcademicYear}
              triggerLabel="Tambah Tahun Ajaran"
              triggerIcon={<Plus className="h-4 w-4" />}
              title="Tambah Tahun Ajaran"
              description="Nama tahun ajaran menggunakan format 2026/2027."
              submitLabel="Tambah Tahun Ajaran"
            >
              <YearFields />
            </ModalForm>
            <ModalForm
              action={saveSemester}
              triggerLabel="Tambah Semester"
              triggerIcon={<Plus className="h-4 w-4" />}
              triggerVariant="secondary"
              title="Tambah Semester"
              description="Semester terikat pada tahun ajaran dan hanya satu yang aktif."
              submitLabel="Tambah Semester"
            >
              <SemesterFields years={years} />
            </ModalForm>
          </>
        }
      />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Daftar Tahun Ajaran
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {years.map((year) => (
              <TableRow key={year.id}>
                <TableCell className="font-medium text-slate-900">
                  {year.name}
                </TableCell>
                <TableCell>
                  {formatShortDateId(year.startDate)} –{" "}
                  {formatShortDateId(year.endDate)}
                </TableCell>
                <TableCell>
                  {year.isActive ? (
                    <Badge variant="success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aktif
                    </Badge>
                  ) : (
                    <Badge variant="neutral">Tidak aktif</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    {!year.isActive ? (
                      <form action={activateYear}>
                        <input type="hidden" name="id" value={year.id} />
                        <ConfirmSubmit
                          variant="secondary"
                          size="sm"
                          pendingText="Mengaktifkan..."
                          confirmVariant="primary"
                          confirmLabel="Ya, aktifkan"
                          title="Aktifkan tahun ajaran"
                          message={`Aktifkan tahun ajaran ${year.name}? Tahun ajaran lain akan menjadi tidak aktif.`}
                        >
                          Aktifkan
                        </ConfirmSubmit>
                      </form>
                    ) : null}
                    <ModalForm
                      action={saveAcademicYear}
                      triggerLabel="Ubah"
                      triggerIcon={<Pencil className="h-3.5 w-3.5" />}
                      triggerVariant="ghost"
                      triggerSize="sm"
                      title="Ubah Tahun Ajaran"
                      description="Perbarui nama dan periode tahun ajaran."
                      submitLabel="Simpan Perubahan"
                    >
                      <YearFields year={year} />
                    </ModalForm>
                    {!year.isActive ? (
                      <form action={deleteYear}>
                        <input type="hidden" name="id" value={year.id} />
                        <ConfirmSubmit
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          message={`Hapus tahun ajaran ${year.name}? Data yang sudah terhubung tidak boleh dihapus.`}
                        >
                          Hapus
                        </ConfirmSubmit>
                      </form>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {years.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">
                  Belum ada tahun ajaran.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Daftar Semester
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semester</TableHead>
              <TableHead>Tahun Ajaran</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {semesters.map((semester) => (
              <TableRow key={semester.id}>
                <TableCell className="font-medium text-slate-900">
                  {semester.name === "GANJIL" ? "Ganjil" : "Genap"}
                </TableCell>
                <TableCell>{semester.academicYearName}</TableCell>
                <TableCell>
                  {formatShortDateId(semester.startDate)} –{" "}
                  {formatShortDateId(semester.endDate)}
                </TableCell>
                <TableCell>
                  {semester.isActive ? (
                    <Badge variant="success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aktif
                    </Badge>
                  ) : (
                    <Badge variant="neutral">Tidak aktif</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    {!semester.isActive ? (
                      <form action={activateSemesterAction}>
                        <input type="hidden" name="id" value={semester.id} />
                        <ConfirmSubmit
                          variant="secondary"
                          size="sm"
                          pendingText="Mengaktifkan..."
                          confirmVariant="primary"
                          confirmLabel="Ya, aktifkan"
                          title="Aktifkan semester"
                          message={`Aktifkan semester ${semester.name === "GANJIL" ? "Ganjil" : "Genap"} ${semester.academicYearName}? Semester lain akan menjadi tidak aktif.`}
                        >
                          Aktifkan
                        </ConfirmSubmit>
                      </form>
                    ) : null}
                    <ModalForm
                      action={saveSemester}
                      triggerLabel="Ubah"
                      triggerIcon={<Pencil className="h-3.5 w-3.5" />}
                      triggerVariant="ghost"
                      triggerSize="sm"
                      title="Ubah Semester"
                      description="Perbarui nama dan periode semester."
                      submitLabel="Simpan Perubahan"
                    >
                      <SemesterFields semester={semester} years={years} />
                    </ModalForm>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {semesters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  Belum ada semester.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <p className="flex items-center gap-2 text-xs text-slate-500">
        <CalendarPlus className="h-3.5 w-3.5" />
        Tahun ajaran baru biasanya dibuat sebelum proses naik kelas.
      </p>
    </div>
  );
}
