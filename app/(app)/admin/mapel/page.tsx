import type { Metadata } from "next";
import { Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { FilterBar } from "@/components/ui/filter-bar";
import { Field, Input, Select } from "@/components/ui/form";
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
import { listSubjectsPaged } from "@/data-access/master";
import { requirePagePermission } from "@/lib/dal";
import {
  buildListHref,
  parsePage,
  parsePerPage,
  resolveDirection,
  resolveSort,
} from "@/lib/pagination";
import { deleteSubject, saveSubject } from "./actions";

export const metadata: Metadata = { title: "Mapel" };
export const dynamic = "force-dynamic";

type SubjectRow = Awaited<ReturnType<typeof listSubjectsPaged>>["rows"][number];

function SubjectFields({ subject }: { subject?: SubjectRow }) {
  return (
    <>
      {subject ? <input type="hidden" name="id" value={subject.id} /> : null}
      <Field label="Kode" htmlFor="code" required>
        <Input
          id="code"
          name="code"
          placeholder="MTK"
          defaultValue={subject?.code}
          required
        />
      </Field>
      <Field label="Nama" htmlFor="name" required>
        <Input
          id="name"
          name="name"
          placeholder="Matematika"
          defaultValue={subject?.name}
          required
        />
      </Field>
    </>
  );
}

const sortOptions = ["code", "name", "isActive"] as const;
const BASE_PATH = "/admin/mapel";

export default async function SubjectPage({
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
  const sort = resolveSort(params.sort, sortOptions, "name");
  const dir = resolveDirection(params.dir, "asc");
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);
  const returnTo = buildListHref(BASE_PATH, params);

  const result = await listSubjectsPaged({
    q,
    status,
    sort,
    dir,
    page,
    perPage,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mata Pelajaran"
        description="Mapel dipakai pada jadwal dan dipetakan ke guru pengampu."
        actions={
          <ModalForm
            action={saveSubject}
            returnTo={returnTo}
            triggerLabel="Tambah Mapel"
            triggerIcon={<Plus className="h-4 w-4" />}
            title="Tambah Mapel"
            description="Kode mapel harus unik."
            submitLabel="Tambah Mapel"
          >
            <SubjectFields />
          </ModalForm>
        }
      />

      <FilterBar
        resetHref={BASE_PATH}
        description="Cari kode/nama mapel dan saring status aktif."
        formClassName="sm:grid-cols-2 lg:grid-cols-4"
      >
        <ListQueryHidden perPage={perPage} sort={sort} dir={dir} />
        <SearchField
          defaultValue={q}
          placeholder="Cari kode atau nama mapel..."
        />
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </Select>
        </Field>
      </FilterBar>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Daftar Mapel
          <Badge variant="neutral">{result.total} data</Badge>
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="Kode"
                column="code"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
              <SortableHead
                label="Nama"
                column="name"
                currentSort={sort}
                currentDir={dir}
                basePath={BASE_PATH}
                searchParams={params}
              />
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
            {result.rows.map((subject) => (
              <TableRow key={subject.id}>
                <TableCell className="font-medium text-slate-900">
                  {subject.code}
                </TableCell>
                <TableCell>{subject.name}</TableCell>
                <TableCell>
                  <Badge variant={subject.isActive ? "success" : "neutral"}>
                    {subject.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <ModalForm
                      action={saveSubject}
                      returnTo={returnTo}
                      triggerLabel="Ubah"
                      triggerIcon={<Pencil className="h-3.5 w-3.5" />}
                      triggerVariant="ghost"
                      triggerSize="sm"
                      title="Ubah Mapel"
                      description="Perbarui kode atau nama mapel."
                      submitLabel="Simpan Perubahan"
                    >
                      <SubjectFields subject={subject} />
                    </ModalForm>
                    <form action={deleteSubject}>
                      <input type="hidden" name="id" value={subject.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <ConfirmSubmit
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        message={`Nonaktifkan mapel ${subject.name}?`}
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
                <TableCell colSpan={4} className="text-center text-slate-500">
                  Tidak ada mapel pada filter ini.
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
