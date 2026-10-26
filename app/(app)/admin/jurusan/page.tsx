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
import { listDepartmentsPaged } from "@/data-access/master";
import { requirePagePermission } from "@/lib/dal";
import {
  buildListHref,
  parsePage,
  parsePerPage,
  resolveDirection,
  resolveSort,
} from "@/lib/pagination";
import { deleteDepartment, saveDepartment } from "./actions";

export const metadata: Metadata = { title: "Jurusan" };
export const dynamic = "force-dynamic";

type DepartmentRow = Awaited<
  ReturnType<typeof listDepartmentsPaged>
>["rows"][number];

function DepartmentFields({ department }: { department?: DepartmentRow }) {
  return (
    <>
      {department ? (
        <input type="hidden" name="id" value={department.id} />
      ) : null}
      <Field label="Kode" htmlFor="code" required>
        <Input
          id="code"
          name="code"
          placeholder="IPA"
          defaultValue={department?.code}
          required
        />
      </Field>
      <Field label="Nama" htmlFor="name" required>
        <Input
          id="name"
          name="name"
          placeholder="Ilmu Pengetahuan Alam"
          defaultValue={department?.name}
          required
        />
      </Field>
    </>
  );
}

const sortOptions = ["code", "name", "isActive"] as const;
const BASE_PATH = "/admin/jurusan";

export default async function DepartmentPage({
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
  const sort = resolveSort(params.sort, sortOptions, "code");
  const dir = resolveDirection(params.dir, "asc");
  const page = parsePage(params.page);
  const perPage = parsePerPage(params.perPage);
  const returnTo = buildListHref(BASE_PATH, params);

  const result = await listDepartmentsPaged({
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
        title="Jurusan"
        description="Kode jurusan dipakai pada nama kelas, misalnya IPA, IPS, atau TKJ."
        actions={
          <ModalForm
            action={saveDepartment}
            returnTo={returnTo}
            triggerLabel="Tambah Jurusan"
            triggerIcon={<Plus className="h-4 w-4" />}
            title="Tambah Jurusan"
            description="Kode harus unik dan singkat."
            submitLabel="Tambah Jurusan"
          >
            <DepartmentFields />
          </ModalForm>
        }
      />

      <FilterBar
        resetHref={BASE_PATH}
        description="Cari kode/nama dan saring berdasarkan status aktif."
        formClassName="sm:grid-cols-2 lg:grid-cols-4"
      >
        <ListQueryHidden perPage={perPage} sort={sort} dir={dir} />
        <SearchField
          defaultValue={q}
          placeholder="Cari kode atau nama jurusan..."
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
          Daftar Jurusan
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
            {result.rows.map((department) => (
              <TableRow key={department.id}>
                <TableCell className="font-medium text-slate-900">
                  {department.code}
                </TableCell>
                <TableCell>{department.name}</TableCell>
                <TableCell>
                  <Badge variant={department.isActive ? "success" : "neutral"}>
                    {department.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <ModalForm
                      action={saveDepartment}
                      returnTo={returnTo}
                      triggerLabel="Ubah"
                      triggerIcon={<Pencil className="h-3.5 w-3.5" />}
                      triggerVariant="ghost"
                      triggerSize="sm"
                      title="Ubah Jurusan"
                      description="Perbarui kode atau nama jurusan."
                      submitLabel="Simpan Perubahan"
                    >
                      <DepartmentFields department={department} />
                    </ModalForm>
                    <form action={deleteDepartment}>
                      <input type="hidden" name="id" value={department.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <ConfirmSubmit
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        message={`Nonaktifkan jurusan ${department.name}?`}
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
                  Tidak ada jurusan pada filter ini.
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
