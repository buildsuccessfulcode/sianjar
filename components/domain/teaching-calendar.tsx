"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Coffee,
  MapPin,
  Moon,
  UserRound,
} from "lucide-react";

import type { TimeSlotKind } from "@/db/schema/enums";
import { cn } from "@/lib/utils";

const DAY_NAMES = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
] as const;

export type CalendarTimeSlot = {
  id: string;
  label: string;
  kind: TimeSlotKind;
  periodNumber: number | null;
  startTime: string;
  endTime: string;
};

export type CalendarSchedule = {
  id: string;
  dayOfWeek: number;
  periodStart: number;
  periodEnd: number;
  subjectName: string;
  className: string;
  teacherName: string;
  room: string | null;
};

const DAY_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const BLOCK_COLORS = [
  "border-indigo-300 bg-indigo-50 text-indigo-900",
  "border-emerald-300 bg-emerald-50 text-emerald-900",
  "border-amber-300 bg-amber-50 text-amber-900",
  "border-sky-300 bg-sky-50 text-sky-900",
  "border-rose-300 bg-rose-50 text-rose-900",
  "border-violet-300 bg-violet-50 text-violet-900",
];

function colorFor(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % BLOCK_COLORS.length;
  }
  return BLOCK_COLORS[hash];
}

function parseTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function shortTime(value: string) {
  return value.slice(0, 5);
}

function periodText(start: number, end: number) {
  return start === end ? `Jam ${start}` : `Jam ${start}–${end}`;
}

export function TeachingCalendar({
  slots,
  schedules,
  viewer,
  todayDay,
  filterDay,
}: {
  slots: CalendarTimeSlot[];
  schedules: CalendarSchedule[];
  viewer: "teacher" | "manager";
  todayDay: number;
  filterDay?: number;
}) {
  const scheduleDays = useMemo(
    () => new Set(schedules.map((row) => row.dayOfWeek)),
    [schedules],
  );
  const days = useMemo(() => {
    const base = [1, 2, 3, 4, 5, 6];
    return scheduleDays.has(7) ? [...base, 7] : base;
  }, [scheduleDays]);

  const firstDayWithSchedules = days.find((day) => scheduleDays.has(day));
  const initialDay =
    filterDay && days.includes(filterDay)
      ? filterDay
      : scheduleDays.has(todayDay)
        ? todayDay
        : (firstDayWithSchedules ?? days[0] ?? 1);
  const [selectedDay, setSelectedDay] = useState(initialDay);

  const sortedSlots = useMemo(
    () =>
      [...slots].sort(
        (a, b) =>
          parseTime(a.startTime) - parseTime(b.startTime) ||
          (a.periodNumber ?? 0) - (b.periodNumber ?? 0),
      ),
    [slots],
  );

  const lessonSlots = useMemo(
    () =>
      sortedSlots.filter(
        (slot) => slot.kind === "LESSON" && slot.periodNumber !== null,
      ),
    [sortedSlots],
  );

  const canRender = sortedSlots.length > 0 && lessonSlots.length > 0;

  if (!canRender) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Susunan jam pelajaran belum diatur, jadi kalender belum bisa
            menampilkan waktu. Atur jam pelajaran terlebih dahulu untuk
            menampilkan istirahat dan waktu sholat.
          </p>
        </div>
        <ScheduleFallback days={days} schedules={schedules} viewer={viewer} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {days.map((day) => {
          const count = schedules.filter((row) => row.dayOfWeek === day).length;
          const active = selectedDay === day;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={cn(
                "flex min-h-11 min-w-16 shrink-0 flex-col items-center justify-center rounded-xl border px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700",
              )}
              aria-pressed={active}
            >
              <span>{DAY_SHORT[day - 1]}</span>
              <span
                className={cn(
                  "text-[10px]",
                  active ? "text-indigo-100" : "text-slate-400",
                )}
              >
                {count} jadwal
              </span>
            </button>
          );
        })}
      </div>

      <div className="lg:hidden">
        <CalendarGrid
          days={[selectedDay]}
          schedules={schedules}
          sortedSlots={sortedSlots}
          lessonSlots={lessonSlots}
          viewer={viewer}
        />
      </div>

      <div className="hidden lg:block">
        <CalendarGrid
          days={days}
          schedules={schedules}
          sortedSlots={sortedSlots}
          lessonSlots={lessonSlots}
          viewer={viewer}
        />
      </div>
    </div>
  );
}

function CalendarGrid({
  days,
  schedules,
  sortedSlots,
  lessonSlots,
  viewer,
}: {
  days: number[];
  schedules: CalendarSchedule[];
  sortedSlots: CalendarTimeSlot[];
  lessonSlots: CalendarTimeSlot[];
  viewer: "teacher" | "manager";
}) {
  const startMinute =
    Math.min(...sortedSlots.map((slot) => parseTime(slot.startTime))) - 5;
  const endMinute =
    Math.max(...sortedSlots.map((slot) => parseTime(slot.endTime))) + 5;
  const scale = 1.2;
  const height = Math.max(360, (endMinute - startMinute) * scale);
  const lessonByPeriod = new Map(
    lessonSlots.map((slot) => [slot.periodNumber as number, slot]),
  );
  const columns = `repeat(${days.length}, minmax(0, 1fr))`;

  function position(schedule: CalendarSchedule) {
    const startSlot =
      lessonByPeriod.get(schedule.periodStart) ??
      [...lessonSlots].reverse().find(
        (slot) => (slot.periodNumber as number) <= schedule.periodStart,
      ) ??
      lessonSlots[0];
    const endSlot =
      lessonByPeriod.get(schedule.periodEnd) ??
      lessonSlots.find(
        (slot) => (slot.periodNumber as number) >= schedule.periodEnd,
      ) ??
      startSlot ??
      null;
    if (!startSlot) return null;
    const top = (parseTime(startSlot.startTime) - startMinute) * scale;
    const bottom = (parseTime(endSlot?.endTime ?? startSlot.endTime) - startMinute) * scale;
    return {
      top,
      height: Math.max(bottom - top - 4, 34),
      timeLabel: `${shortTime(startSlot.startTime)}–${shortTime(
        endSlot?.endTime ?? startSlot.endTime,
      )}`,
    };
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
      <div className={cn(days.length > 1 && "min-w-[640px]")}>
        <div className="flex border-b border-slate-200 bg-slate-50/80">
          <div className="flex h-12 w-16 shrink-0 items-center justify-center border-r border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Jam
          </div>
          <div className="grid flex-1" style={{ gridTemplateColumns: columns }}>
            {days.map((day) => {
              const count = schedules.filter(
                (row) => row.dayOfWeek === day,
              ).length;
              return (
                <div
                  key={day}
                  className="flex h-12 flex-col items-center justify-center border-l border-slate-200 first:border-l-0"
                >
                  <p className="text-xs font-semibold text-slate-700">
                    {DAY_NAMES[day - 1]}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {count} jadwal
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex" style={{ height }}>
          <div className="relative w-16 shrink-0 border-r border-slate-200 bg-white">
            {sortedSlots.map((slot) => (
              <div
                key={slot.id}
                className="absolute inset-x-0 -translate-y-1/2 px-1.5"
                style={{
                  top: (parseTime(slot.startTime) - startMinute) * scale,
                }}
              >
                {slot.kind === "LESSON" ? (
                  <>
                    <p className="text-[10px] font-semibold leading-tight text-slate-600">
                      {shortTime(slot.startTime)}
                    </p>
                    <p className="truncate text-[9px] leading-tight text-slate-400">
                      {slot.label}
                    </p>
                  </>
                ) : (
                  <p
                    className={cn(
                      "truncate text-[9px] font-medium leading-tight",
                      slot.kind === "BREAK" && "text-amber-700",
                      slot.kind === "PRAYER" && "text-sky-700",
                    )}
                  >
                    {shortTime(slot.startTime)} · {slot.label}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="relative flex-1">
            {sortedSlots.map((slot) => (
              <div
                key={`line-${slot.id}`}
                className="absolute inset-x-0 border-t border-slate-100"
                style={{
                  top: (parseTime(slot.startTime) - startMinute) * scale,
                }}
              />
            ))}

            {sortedSlots
              .filter((slot) => slot.kind !== "LESSON")
              .map((slot) => {
                const top = (parseTime(slot.startTime) - startMinute) * scale;
                const bandHeight = Math.max(
                  (parseTime(slot.endTime) - parseTime(slot.startTime)) * scale,
                  18,
                );
                return (
                  <div
                    key={`band-${slot.id}`}
                    className={cn(
                      "pointer-events-none absolute inset-x-0 z-0 flex items-center justify-center border-y",
                      slot.kind === "BREAK" &&
                        "border-amber-100 bg-amber-50/70",
                      slot.kind === "PRAYER" &&
                        "border-sky-100 bg-sky-50/70",
                    )}
                    style={{ top, height: bandHeight }}
                  >
                    <span
                      className={cn(
                        "hidden items-center gap-1 text-[10px] font-medium sm:flex",
                        slot.kind === "BREAK" && "text-amber-700",
                        slot.kind === "PRAYER" && "text-sky-700",
                      )}
                    >
                      {slot.kind === "BREAK" ? (
                        <Coffee className="h-3 w-3" />
                      ) : (
                        <Moon className="h-3 w-3" />
                      )}
                      {slot.label}
                    </span>
                  </div>
                );
              })}

            <div
              className="relative z-10 grid h-full"
              style={{ gridTemplateColumns: columns }}
            >
              {days.map((day) => {
                const daySchedules = schedules.filter(
                  (row) => row.dayOfWeek === day,
                );
                return (
                  <div
                    key={day}
                    className="relative h-full border-l border-slate-100 first:border-l-0"
                  >
                    {daySchedules.map((schedule) => {
                      const geometry = position(schedule);
                      if (!geometry) return null;
                      return (
                        <article
                          key={schedule.id}
                          title={`${schedule.subjectName} · ${schedule.className} · ${schedule.teacherName} · ${geometry.timeLabel}`}
                          className={cn(
                            "absolute inset-x-1 z-10 overflow-hidden rounded-lg border-l-4 p-1.5 shadow-sm ring-1 ring-black/5",
                            colorFor(schedule.subjectName),
                          )}
                          style={{
                            top: geometry.top,
                            height: geometry.height,
                          }}
                        >
                          <p className="truncate text-[11px] font-semibold leading-tight sm:text-xs">
                            {schedule.subjectName}
                          </p>
                          <p className="truncate text-[10px] leading-tight opacity-90">
                            {schedule.className}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[9px] leading-tight opacity-75">
                            {viewer === "manager" ? (
                              <UserRound className="h-2.5 w-2.5 shrink-0" />
                            ) : (
                              <CalendarDays className="h-2.5 w-2.5 shrink-0" />
                            )}
                            <span className="truncate">
                              {viewer === "manager"
                                ? schedule.teacherName
                                : periodText(
                                    schedule.periodStart,
                                    schedule.periodEnd,
                                  )}
                            </span>
                          </p>
                          {schedule.room ? (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-[9px] leading-tight opacity-75">
                              <MapPin className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{schedule.room}</span>
                            </p>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleFallback({
  days,
  schedules,
  viewer,
}: {
  days: number[];
  schedules: CalendarSchedule[];
  viewer: "teacher" | "manager";
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {days.map((day) => {
        const rows = schedules
          .filter((row) => row.dayOfWeek === day)
          .sort((a, b) => a.periodStart - b.periodStart);
        return (
          <div
            key={day}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">
                {DAY_NAMES[day - 1]}
              </h3>
              <span className="text-xs text-slate-400">
                {rows.length} jadwal
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="text-xs text-slate-400">Tidak ada jadwal.</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className={cn(
                      "rounded-lg border-l-4 px-2.5 py-2 text-xs",
                      colorFor(row.subjectName),
                    )}
                  >
                    <p className="font-semibold">{row.subjectName}</p>
                    <p className="opacity-90">{row.className}</p>
                    <p className="opacity-75">
                      {periodText(row.periodStart, row.periodEnd)}
                      {viewer === "manager" ? ` · ${row.teacherName}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
