"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Field, Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type StudentOption = {
  id: string;
  nisn: string;
  name: string;
  className: string | null;
  enrollmentStatus: string | null;
};

type ClassOption = { id: string; label: string };
type StatusOption = { value: string; label: string };

export function BulkEnrollmentForm({
  students,
  classes,
  yearId,
  statusOptions,
}: {
  students: StudentOption[];
  classes: ClassOption[];
  yearId: string;
  statusOptions: StatusOption[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(term) ||
        student.nisn.toLowerCase().includes(term),
    );
  }, [students, query]);

  const eligible = useMemo(
    () => filtered.filter((student) => !student.enrollmentStatus),
    [filtered],
  );
  const allEligibleSelected =
    eligible.length > 0 && eligible.every((student) => selected.has(student.id));

  const toggleStudent = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allEligibleSelected) {
        for (const student of eligible) next.delete(student.id);
      } else {
        for (const student of eligible) next.add(student.id);
      }
      return next;
    });
  };

  return (
    <>
      <input type="hidden" name="year" value={yearId} />
      <input type="hidden" name="academicYearId" value={yearId} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="studentIds" value={id} />
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kelas" htmlFor="bulk-classId" required>
          <Select id="bulk-classId" name="classId" defaultValue="" required>
            <option value="" disabled>
              Pilih kelas
            </option>
            {classes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="bulk-status" required>
          <Select id="bulk-status" name="status" defaultValue="ACTIVE">
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="space-y-2">
        <Field label="Cari siswa" htmlFor="bulk-search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="bulk-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nama atau NISN"
              className="pl-9"
            />
          </div>
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-slate-600">
            {selected.size} siswa dipilih · {eligible.length} siswa tersedia
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleAllVisible}
              disabled={eligible.length === 0}
              className="font-medium text-indigo-600 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {allEligibleSelected ? "Batal pilih hasil" : "Pilih semua hasil"}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0}
              className="text-slate-500 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Bersihkan
            </button>
          </div>
        </div>

        <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              Tidak ada siswa yang cocok dengan pencarian.
            </p>
          ) : (
            filtered.map((student) => {
              const isEnrolled = Boolean(student.enrollmentStatus);
              return (
                <label
                  key={student.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm",
                    isEnrolled
                      ? "cursor-not-allowed bg-slate-50 text-slate-400"
                      : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={selected.has(student.id)}
                    disabled={isEnrolled}
                    onChange={() => toggleStudent(student.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-900">
                      {student.name}
                    </span>
                    <span className="block font-mono text-xs">
                      {student.nisn}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      isEnrolled ? "text-slate-400" : "text-emerald-600",
                    )}
                  >
                    {isEnrolled
                      ? `Terdaftar${student.className ? ` · ${student.className}` : ""}`
                      : "Belum terdaftar"}
                  </span>
                </label>
              );
            })
          )}
        </div>
        <p className="text-xs text-slate-500">
          Siswa yang sudah terdaftar pada tahun ajaran ini dilewati.
        </p>
      </div>
    </>
  );
}
