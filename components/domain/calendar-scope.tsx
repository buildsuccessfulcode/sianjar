"use client";

import { useRouter } from "next/navigation";

import { Select } from "@/components/ui/form";

export type CalendarScopeOption = { id: string; label: string };

export function CalendarScope({
  classes,
  teachers,
  selectedClassId,
  selectedTeacherId,
}: {
  classes: CalendarScopeOption[];
  teachers: CalendarScopeOption[];
  selectedClassId?: string;
  selectedTeacherId?: string;
}) {
  const router = useRouter();
  const value = selectedTeacherId
    ? `teacher:${selectedTeacherId}`
    : `class:${selectedClassId ?? classes[0]?.id ?? ""}`;

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
      <span className="whitespace-nowrap">Kalender untuk</span>
      <Select
        className="h-9 w-44 py-1.5 text-xs"
        value={value}
        onChange={(event) => {
          const [type, id] = event.target.value.split(":");
          if (!type || !id) return;
          const params = new URLSearchParams(window.location.search);
          params.delete("classId");
          params.delete("teacherId");
          params.delete("page");
          if (type === "teacher") {
            params.set("teacherId", id);
          } else {
            params.set("classId", id);
          }
          router.push(`/jadwal?${params.toString()}`);
        }}
      >
        {classes.length > 0 ? (
          <optgroup label="Kelas">
            {classes.map((row) => (
              <option key={row.id} value={`class:${row.id}`}>
                {row.label}
              </option>
            ))}
          </optgroup>
        ) : null}
        {teachers.length > 0 ? (
          <optgroup label="Guru">
            {teachers.map((row) => (
              <option key={row.id} value={`teacher:${row.id}`}>
                {row.label}
              </option>
            ))}
          </optgroup>
        ) : null}
      </Select>
    </label>
  );
}
