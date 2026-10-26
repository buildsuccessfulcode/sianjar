import type { Metadata } from "next";
import { Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { FilterBar } from "@/components/ui/filter-bar";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
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
  listTeacherSubjectsByTeacherIds,
  listTeachersPaged,
} from "@/data-access/master";
import { requirePagePermission } from "@/lib/dal";
import {
  buildListHref,
  parsePage,
  parsePerPage,
  resolveDirection,
  resolveSort,
} from "@/lib/pagination";
import { deleteTeacher, saveTeacher } from "./actions";

export const metadata: Metadata = { title: "Guru" };
export const dynamic = "force-dynamic";

type TeacherRow = Awaited<ReturnType<typeof listTeachersPaged>>["rows"][number];
type SubjectRow = Awaited<ReturnType<typeof listSubjects>>[number];

function TeacherFields({
  teacher,
  subjects,
  subjectIds,
}: {
  teacher?: TeacherRow;
  subjects: SubjectRow[];
  subjectIds: Set<string>;
}) {
  return (
    <>
      {teacher ? <input type="hidden" name="id" value={teacher.id} /> : null}
      <Field label="Nama Lengkap" htmlFor="name" required>
        <Input
          id="name"
          name="name"
          placeholder="Sari Wulandari"
          defaultValue={teacher?.name}
          required
        />
      </Field>
      <Field label="Email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="sari@sekolah.sch.id"
          defaultValue={teacher?.email}
          required
        />
      </Field>
      {!teacher ? (
        <Field
          label="Password Awal"
          htmlFor="password"
          hint="Minimal 8 karakter."
          required
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
      ) : null}
      <Field label="NIP" htmlFor="nip" hint="Opsional.">
        <Input
          id="nip"
          name="nip"
          placeholder="1987654321"
          defaultValue={teacher?.nip ?? ""}
        />
      </Field>
      <Field label="Catatan Keahlian" htmlFor="expertiseNote">
        <Textarea
          id="expertiseNote"
          name="expertiseNote"
          defaultValue={teacher?.expertiseNote ?? ""}
          placeholder="Opsional"
        />
      </Field>
      {teacher ? (
        <Checkbox
          id="isActive"
          name="isActive"
          label="Akun aktif"
          defaultChecked={teacher.isActive}
        />
      ) : null}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">
          Mapel yang Diampu
        </legend>
        <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-slate-200 p-2 sm:grid-cols-2">
          {subjects.map((subject) => (
            <Checkbox
              key={subject.id}
              id={`subject-${subject.id}`}
              name="subjectIds"
              value={subject.id}
              label={`${subject.code} — ${subject.name}`}
              defaultChecked={subjectIds.has(subject.id)}
            />
          ))}
        </div>
      </fieldset>
    </>
  );
}

const sortOptions = ["name", "email", "nip", "isActive"] as const;
const BASE_PATH = "/admin/guru";

export default async function TeacherPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("manage:master_data");
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : undefined;
  const status: "active" | "inactive" | undefined =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : undefined;
  const subjectId =
    typeof params.subject === "string" ? params.subject : undefined;
  const sort = resolveSort(params.sort, sortOptions, "name");
  const dir = resolveDirection(params.dir, "asc");
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);
  const returnTo = buildListHref(BASE_PATH, params);

  const [result, subjects] = await Promise.all([
    listTeachersPaged({ q, status, subjectId, sort, dir, page, perPage }),
    listSubjects(),
  ]);
  const mappings = await listTeacherSubjectsByTeacherIds(
    result.rows.map((teacher) => teacher.id),
  );

  const subjectsByTeacher = new Map<string, string[]>();
  const subjectIdsByTeacher = new Map<string, Set<string>>();
  for (const mapping of mappings) {
    const list = subjectsByTeacher.get(mapping.teacherId) ?? [];
    list.push(mapping.subjectCode);
    subjectsByTeacher.set(mapping.teacherId, list);

    const ids = subjectIdsByTeacher.get(mapping.teacherId) ?? new Set<string>();
    ids.add(mapping.subjectId);
    subjectIdsByTeacher.set(mapping.teacherId, ids);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guru"
        description="Akun guru dibuat bersama profil kepegawaian dan mapping mapel."
        actions={
          <ModalForm
            action={saveTeacher}
            returnTo={returnTo}
            triggerLabel="Tambah Guru"
            triggerIcon={<Plus className="h-4 w-4" />}
            title="Tambah Guru"
            description="Mapping mapel dipakai saat membuat jadwal."
            submitLabel="Tambah Guru"
          >
            <TeacherFields subjects={subjects} subjectIds={new Set()} />
          </ModalForm>
        }
      />

      <FilterBar
        resetHref={BASE_PATH}
        description="Cari guru berdasarkan nama/email/NIP, status akun, atau mapel yang diampu."
        formClassName="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <ListQueryHidden perPage={perPage} sort={sort} dir={dir} />
        <SearchField
          defaultValue={q}
          placeholder="Cari nama, email, atau NIP..."
        />
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
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
          Daftar Guru
          <Badge variant="neutral">{result.total} data</Badge>
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="Nama"
                column="name"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <SortableHead
                label="Email / NIP"
                column="email"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <TableHead>Mapel</TableHead>
              <SortableHead
                label="Status"
                column="isActive"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((teacher) => (
              <TableRow key={teacher.id}>
                <TableCell className="font-medium text-slate-900">
                  {teacher.name}
                </TableCell>
                <TableCell>
                  <p>{teacher.email}</p>
                  <p className="text-xs text-slate-500">
                    {teacher.nip ?? "NIP belum diisi"}
                  </p>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(subjectsByTeacher.get(teacher.id) ?? []).map((code) => (
                      <Badge key={code} variant="primary">
                        {code}
                      </Badge>
                    ))}
                    {(subjectsByTeacher.get(teacher.id) ?? []).length === 0 ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={teacher.isActive ? "success" : "neutral"}>
                    {teacher.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <ModalForm
                      action={saveTeacher}
                      returnTo={returnTo}
                      triggerLabel="Ubah"
                      triggerIcon={<Pencil className="h-3.5 w-3.5" />}
                      triggerVariant="ghost"
                      triggerSize="sm"
                      title="Ubah Guru"
                      description="Perbarui profil, status akun, dan mapping mapel."
                      submitLabel="Simpan Perubahan"
                    >
                      <TeacherFields
                        teacher={teacher}
                        subjects={subjects}
                        subjectIds={
                          subjectIdsByTeacher.get(teacher.id) ?? new Set()
                        }
                      />
                    </ModalForm>
                    <form action={deleteTeacher}>
                      <input type="hidden" name="id" value={teacher.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <ConfirmSubmit
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        message={`Nonaktifkan akun guru ${teacher.name}? Riwayat jurnal tetap tersimpan.`}
                      >
                        Nonaktifkan
                      </ConfirmSubmit>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  Tidak ada guru pada filter ini.
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
