import type { Metadata } from "next";
import { Link2, Plus, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { FilterBar } from "@/components/ui/filter-bar";
import { Checkbox, Field, Select } from "@/components/ui/form";
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
  listSubjects,
  listTeacherOptions,
  listTeacherSubjectsPaged,
  listTeachers,
} from "@/data-access/master";
import { requirePagePermission } from "@/lib/dal";
import {
  buildListHref,
  parsePage,
  parsePerPage,
  resolveDirection,
  resolveSort,
} from "@/lib/pagination";
import { addMapping, addMappingsBulk, removeMapping } from "./actions";

export const metadata: Metadata = { title: "Mapping Guru–Mapel" };
export const dynamic = "force-dynamic";

type TeacherOption = Awaited<ReturnType<typeof listTeacherOptions>>[number];
type SubjectRow = Awaited<ReturnType<typeof listSubjects>>[number];

function MappingFields({
  teacherOptions,
  subjects,
}: {
  teacherOptions: TeacherOption[];
  subjects: SubjectRow[];
}) {
  return (
    <>
      <Field label="Guru" htmlFor="teacherId" required>
        <Select id="teacherId" name="teacherId" defaultValue="" required>
          <option value="" disabled>
            Pilih guru
          </option>
          {teacherOptions.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Mapel" htmlFor="subjectId" required>
        <Select id="subjectId" name="subjectId" defaultValue="" required>
          <option value="" disabled>
            Pilih mapel
          </option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.code} — {subject.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

function BulkMappingFields({
  teacherOptions,
  subjects,
}: {
  teacherOptions: TeacherOption[];
  subjects: SubjectRow[];
}) {
  return (
    <>
      <Field label="Guru" htmlFor="bulkTeacherId" required>
        <Select id="bulkTeacherId" name="teacherId" defaultValue="" required>
          <option value="" disabled>
            Pilih guru
          </option>
          {teacherOptions.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name}
              {teacher.nip ? ` · ${teacher.nip}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">
          Mapel yang diampu <span className="text-red-600">*</span>
        </legend>
        <div className="grid max-h-72 gap-1 overflow-y-auto rounded-md border border-slate-200 p-2 sm:grid-cols-2">
          {subjects.map((subject) => (
            <Checkbox
              key={subject.id}
              id={`bulk-subject-${subject.id}`}
              name="subjectIds"
              value={subject.id}
              label={`${subject.code} — ${subject.name}`}
            />
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Mapping yang sudah ada otomatis dilewati.
        </p>
      </fieldset>
    </>
  );
}

const sortOptions = ["teacher", "subject"] as const;
const BASE_PATH = "/guru-mapel";

export default async function TeacherSubjectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("manage:mapping_guru_mapel");
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : undefined;
  const teacherId =
    typeof params.teacher === "string" ? params.teacher : undefined;
  const subjectId =
    typeof params.subject === "string" ? params.subject : undefined;
  const sort = resolveSort(params.sort, sortOptions, "teacher");
  const dir = resolveDirection(params.dir, "asc");
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);
  const returnTo = buildListHref(BASE_PATH, params);

  const [teachers, teacherOptions, subjects, result] = await Promise.all([
    listTeachers(),
    listTeacherOptions(),
    listSubjects(),
    listTeacherSubjectsPaged({
      q,
      teacherId,
      subjectId,
      sort,
      dir,
      page,
      perPage,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mapping Guru–Mapel"
        description="Jadwal hanya dapat dibuat jika guru sudah dipetakan ke mapel yang dipilih."
        actions={
          <>
            <ModalForm
              action={addMappingsBulk}
              returnTo={returnTo}
              triggerLabel="Mapping Massal"
              triggerIcon={<Users className="h-4 w-4" />}
              title="Mapping Massal"
              description="Pilih satu guru dan centang beberapa mapel sekaligus."
              submitLabel="Simpan Mapping"
              pendingText="Menyimpan..."
              size="lg"
            >
              <BulkMappingFields
                teacherOptions={teacherOptions}
                subjects={subjects}
              />
            </ModalForm>
            <ModalForm
              action={addMapping}
              returnTo={returnTo}
              triggerLabel="Tambah Mapping"
              triggerIcon={<Plus className="h-4 w-4" />}
              triggerVariant="secondary"
              title="Tambah Mapping"
              description="Satu guru boleh mengampu beberapa mapel."
              submitLabel="Tambah Mapping"
            >
              <MappingFields
                teacherOptions={teacherOptions}
                subjects={subjects}
              />
            </ModalForm>
          </>
        }
      />

      <FilterBar
        resetHref={BASE_PATH}
        description="Cari guru/mapel atau saring berdasarkan guru dan mapel tertentu."
        formClassName="sm:grid-cols-2 lg:grid-cols-4"
      >
        <ListQueryHidden perPage={perPage} sort={sort} dir={dir} />
        <SearchField
          defaultValue={q}
          placeholder="Cari guru, kode, atau nama mapel..."
        />
        <Field label="Guru" htmlFor="teacher">
          <Select id="teacher" name="teacher" defaultValue={teacherId ?? ""}>
            <option value="">Semua guru</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mapel" htmlFor="subject">
          <Select id="subject" name="subject" defaultValue={subjectId ?? ""}>
            <option value="">Semua mapel</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} — {subject.name}
              </option>
            ))}
          </Select>
        </Field>
      </FilterBar>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <Link2 className="h-4 w-4" />
          Daftar Mapping
          <Badge variant="neutral">{result.total} data</Badge>
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="Guru"
                column="teacher"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <SortableHead
                label="Mapel"
                column="subject"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((mapping) => (
              <TableRow key={`${mapping.teacherId}-${mapping.subjectId}`}>
                <TableCell className="font-medium text-slate-900">
                  {mapping.teacherName}
                </TableCell>
                <TableCell>
                  <Badge variant="primary">{mapping.subjectCode}</Badge>{" "}
                  {mapping.subjectName}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <form action={removeMapping}>
                      <input
                        type="hidden"
                        name="returnTo"
                        value={returnTo}
                      />
                      <input
                        type="hidden"
                        name="teacherId"
                        value={mapping.teacherId}
                      />
                      <input
                        type="hidden"
                        name="subjectId"
                        value={mapping.subjectId}
                      />
                      <ConfirmSubmit
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        message="Hapus mapping ini? Jadwal yang sudah ada tidak berubah."
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </ConfirmSubmit>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-slate-500">
                  Tidak ada mapping pada filter ini.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <Pagination
          basePath={BASE_PATH}
          searchParams={params}
          page={result.page}
          perPage={result.perPage}
          total={result.total}
          totalPages={result.totalPages}
          from={result.from}
          to={result.to}
        />
      </div>
    </div>
  );
}
