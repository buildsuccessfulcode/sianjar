import type { Metadata } from "next";
import { CalendarPlus, CheckCircle2, Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { FilterBar } from "@/components/ui/filter-bar";
import { Field, Input, Select } from "@/components/ui/form";
import { HiddenParams } from "@/components/ui/hidden-params";
import { ListQueryHidden } from "@/components/ui/list-query-hidden";
import { ModalForm } from "@/components/ui/modal-form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchField } from "@/components/ui/search-field";
import { SortableHead } from "@/components/ui/sortable-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listAcademicYears,
  listAcademicYearsPaged,
  listSemestersPaged,
} from "@/data-access/master";
import { formatShortDateId } from "@/lib/date";
import { requirePagePermission } from "@/lib/dal";
import {
  buildListHref,
  parsePage,
  parsePerPage,
  resolveDirection,
  resolveSort,
} from "@/lib/pagination";
import {
  activateSemesterAction,
  activateYear,
  deleteYear,
  saveAcademicYear,
  saveSemester,
} from "./actions";

export const metadata: Metadata = { title: "Tahun Ajaran" };
export const dynamic = "force-dynamic";

type YearRow = Awaited<
  ReturnType<typeof listAcademicYearsPaged>
>["rows"][number];
type SemesterRow = Awaited<
  ReturnType<typeof listSemestersPaged>
>["rows"][number];

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
  years: Awaited<ReturnType<typeof listAcademicYears>>;
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

const yearSorts = ["name", "startDate", "isActive"] as const;
const semesterSorts = ["name", "academicYear", "startDate", "isActive"] as const;
const BASE_PATH = "/admin/tahun-ajaran";

export default async function AcademicYearPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("manage:master_data");
  const params = await searchParams;

  const yearQ = typeof params.yq === "string" ? params.yq : undefined;
  const yearStatus: "active" | "inactive" | undefined =
    params.ystatus === "active" || params.ystatus === "inactive"
      ? params.ystatus
      : undefined;
  const yearSort = resolveSort(params.ysort, yearSorts, "startDate");
  const yearDir = resolveDirection(params.ydir, "desc");
  const yearPage = parsePage(params.ypage);
  const yearPerPage = parsePerPage(params.yperPage);

  const semesterQ = typeof params.sq === "string" ? params.sq : undefined;
  const semesterStatus: "active" | "inactive" | undefined =
    params.sstatus === "active" || params.sstatus === "inactive"
      ? params.sstatus
      : undefined;
  const semesterYearId =
    typeof params.syear === "string" ? params.syear : undefined;
  const semesterSort = resolveSort(params.ssort, semesterSorts, "academicYear");
  const semesterDir = resolveDirection(params.sdir, "desc");
  const semesterPage = parsePage(params.spage);
  const semesterPerPage = parsePerPage(params.sperPage);
  const returnTo = buildListHref(BASE_PATH, params);

  const [yearResult, yearsAll, semesterResult] = await Promise.all([
    listAcademicYearsPaged({
      q: yearQ,
      status: yearStatus,
      sort: yearSort,
      dir: yearDir,
      page: yearPage,
      perPage: yearPerPage,
    }),
    listAcademicYears(),
    listSemestersPaged({
      q: semesterQ,
      academicYearId: semesterYearId,
      status: semesterStatus,
      sort: semesterSort,
      dir: semesterDir,
      page: semesterPage,
      perPage: semesterPerPage,
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tahun Ajaran & Semester"
        description="Hanya satu tahun ajaran dan satu semester yang boleh aktif. Aktifkan semester setelah tahun ajarannya aktif."
        actions={
          <>
            <ModalForm
              action={saveAcademicYear}
              returnTo={returnTo}
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
              returnTo={returnTo}
              triggerLabel="Tambah Semester"
              triggerIcon={<Plus className="h-4 w-4" />}
              triggerVariant="secondary"
              title="Tambah Semester"
              description="Semester terikat pada tahun ajaran dan hanya satu yang aktif."
              submitLabel="Tambah Semester"
            >
              <SemesterFields years={yearsAll} />
            </ModalForm>
          </>
        }
      />

      <FilterBar
        title="Filter Tahun Ajaran"
        resetHref={BASE_PATH}
        description="Cari tahun ajaran dan saring status aktif."
        formClassName="sm:grid-cols-2 lg:grid-cols-4"
      >
        <ListQueryHidden
          perPage={yearPerPage}
          sort={yearSort}
          dir={yearDir}
          perPageKey="yperPage"
          sortKey="ysort"
          dirKey="ydir"
        />
        <HiddenParams
          params={{
            sq: semesterQ,
            syear: semesterYearId,
            sstatus: semesterStatus,
            ssort: semesterSort,
            sdir: semesterDir,
            spage: semesterPage,
            sperPage: semesterPerPage,
          }}
        />
        <SearchField
          id="yq"
          name="yq"
          defaultValue={yearQ}
          placeholder="Cari tahun ajaran..."
        />
        <Field label="Status" htmlFor="ystatus">
          <Select id="ystatus" name="ystatus" defaultValue={yearStatus ?? ""}>
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Tidak aktif</option>
          </Select>
        </Field>
      </FilterBar>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Daftar Tahun Ajaran
          <Badge variant="neutral">{yearResult.total} data</Badge>
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="Nama"
                column="name"
                currentSort={yearSort}
                currentDir={yearDir}
                basePath={BASE_PATH}
                searchParams={params}
                sortKey="ysort"
                dirKey="ydir"
                pageKey="ypage"
              />
              <SortableHead
                label="Periode"
                column="startDate"
                currentSort={yearSort}
                currentDir={yearDir}
                basePath={BASE_PATH}
                searchParams={params}
                sortKey="ysort"
                dirKey="ydir"
                pageKey="ypage"
              />
              <SortableHead
                label="Status"
                column="isActive"
                currentSort={yearSort}
                currentDir={yearDir}
                basePath={BASE_PATH}
                searchParams={params}
                sortKey="ysort"
                dirKey="ydir"
                pageKey="ypage"
              />
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {yearResult.rows.map((year) => (
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
                        <input type="hidden" name="returnTo" value={returnTo} />
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
                      returnTo={returnTo}
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
                        <input type="hidden" name="returnTo" value={returnTo} />
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
            {yearResult.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">
                  Tidak ada tahun ajaran pada filter ini.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <Pagination
          basePath={BASE_PATH}
          searchParams={params}
          page={yearResult.page}
          perPage={yearResult.perPage}
          total={yearResult.total}
          totalPages={yearResult.totalPages}
          from={yearResult.from}
          to={yearResult.to}
          pageKey="ypage"
          perPageKey="yperPage"
        />
      </div>

      <FilterBar
        title="Filter Semester"
        resetHref={buildListHref(BASE_PATH, params, {
          sq: undefined,
          syear: undefined,
          sstatus: undefined,
          ssort: undefined,
          sdir: undefined,
          spage: undefined,
          sperPage: undefined,
        })}
        description="Cari semester, pilih tahun ajaran, dan saring status aktif."
        formClassName="sm:grid-cols-2 lg:grid-cols-4"
      >
        <ListQueryHidden
          perPage={semesterPerPage}
          sort={semesterSort}
          dir={semesterDir}
          perPageKey="sperPage"
          sortKey="ssort"
          dirKey="sdir"
        />
        <HiddenParams
          params={{
            yq: yearQ,
            ystatus: yearStatus,
            ysort: yearSort,
            ydir: yearDir,
            ypage: yearPage,
            yperPage: yearPerPage,
          }}
        />
        <SearchField
          id="sq"
          name="sq"
          defaultValue={semesterQ}
          placeholder="Cari semester atau tahun ajaran..."
        />
        <Field label="Tahun Ajaran" htmlFor="syear">
          <Select id="syear" name="syear" defaultValue={semesterYearId ?? ""}>
            <option value="">Semua tahun ajaran</option>
            {yearsAll.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="sstatus">
          <Select id="sstatus" name="sstatus" defaultValue={semesterStatus ?? ""}>
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Tidak aktif</option>
          </Select>
        </Field>
      </FilterBar>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Daftar Semester
          <Badge variant="neutral">{semesterResult.total} data</Badge>
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="Semester"
                column="name"
                currentSort={semesterSort}
                currentDir={semesterDir}
                basePath={BASE_PATH}
                searchParams={params}
                sortKey="ssort"
                dirKey="sdir"
                pageKey="spage"
              />
              <SortableHead
                label="Tahun Ajaran"
                column="academicYear"
                currentSort={semesterSort}
                currentDir={semesterDir}
                basePath={BASE_PATH}
                searchParams={params}
                sortKey="ssort"
                dirKey="sdir"
                pageKey="spage"
              />
              <SortableHead
                label="Periode"
                column="startDate"
                currentSort={semesterSort}
                currentDir={semesterDir}
                basePath={BASE_PATH}
                searchParams={params}
                sortKey="ssort"
                dirKey="sdir"
                pageKey="spage"
              />
              <SortableHead
                label="Status"
                column="isActive"
                currentSort={semesterSort}
                currentDir={semesterDir}
                basePath={BASE_PATH}
                searchParams={params}
                sortKey="ssort"
                dirKey="sdir"
                pageKey="spage"
              />
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {semesterResult.rows.map((semester) => (
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
                        <input type="hidden" name="returnTo" value={returnTo} />
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
                      returnTo={returnTo}
                      triggerLabel="Ubah"
                      triggerIcon={<Pencil className="h-3.5 w-3.5" />}
                      triggerVariant="ghost"
                      triggerSize="sm"
                      title="Ubah Semester"
                      description="Perbarui nama dan periode semester."
                      submitLabel="Simpan Perubahan"
                    >
                      <SemesterFields semester={semester} years={yearsAll} />
                    </ModalForm>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {semesterResult.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  Tidak ada semester pada filter ini.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <Pagination
          basePath={BASE_PATH}
          searchParams={params}
          page={semesterResult.page}
          perPage={semesterResult.perPage}
          total={semesterResult.total}
          totalPages={semesterResult.totalPages}
          from={semesterResult.from}
          to={semesterResult.to}
          pageKey="spage"
          perPageKey="sperPage"
        />
      </div>

      <p className="flex items-center gap-2 text-xs text-slate-500">
        <CalendarPlus className="h-3.5 w-3.5" />
        Tahun ajaran baru biasanya dibuat sebelum proses naik kelas.
      </p>
    </div>
  );
}
