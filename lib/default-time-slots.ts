import type { TimeSlotKind } from "@/db/schema/enums";

export type DefaultTimeSlot = {
  label: string;
  kind: TimeSlotKind;
  periodNumber?: number;
  startTime: string;
  endTime: string;
};

export const DEFAULT_TIME_SLOTS: DefaultTimeSlot[] = [
  { label: "Jam 1", kind: "LESSON", periodNumber: 1, startTime: "07:00", endTime: "07:40" },
  { label: "Jam 2", kind: "LESSON", periodNumber: 2, startTime: "07:40", endTime: "08:20" },
  { label: "Istirahat", kind: "BREAK", startTime: "08:20", endTime: "08:35" },
  { label: "Jam 3", kind: "LESSON", periodNumber: 3, startTime: "08:35", endTime: "09:15" },
  { label: "Jam 4", kind: "LESSON", periodNumber: 4, startTime: "09:15", endTime: "09:55" },
  { label: "Istirahat", kind: "BREAK", startTime: "09:55", endTime: "10:10" },
  { label: "Jam 5", kind: "LESSON", periodNumber: 5, startTime: "10:10", endTime: "10:50" },
  { label: "Jam 6", kind: "LESSON", periodNumber: 6, startTime: "10:50", endTime: "11:30" },
  {
    label: "Sholat Dzuhur & Istirahat",
    kind: "PRAYER",
    startTime: "11:30",
    endTime: "12:45",
  },
  { label: "Jam 7", kind: "LESSON", periodNumber: 7, startTime: "12:45", endTime: "13:25" },
  { label: "Jam 8", kind: "LESSON", periodNumber: 8, startTime: "13:25", endTime: "14:05" },
];
