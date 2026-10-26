export type SeedDepartment = {
  code: string;
  name: string;
};

export type SeedSubject = {
  code: string;
  name: string;
};

export type SeedTeacher = {
  key: string;
  name: string;
  email: string;
  subjects: string[];
};

export type SeedClass = {
  key: string;
  gradeLevel: number;
  departmentCode: string;
  section: string;
  homeroomTeacherKey: string | null;
};

export type SeedTimeSlot = {
  label: string;
  kind: "LESSON" | "BREAK" | "PRAYER";
  periodNumber: number | null;
  startTime: string;
  endTime: string;
};

export type SeedSchedule = {
  classKey: string;
  subjectCode: string;
  teacherKey: string;
  dayOfWeek: number;
  periodStart: number;
  periodEnd: number;
};

export const ACADEMIC_YEAR = {
  name: "2026/2027",
  startDate: "2026-07-13",
  endDate: "2027-06-30",
} as const;

export const SEMESTER = {
  name: "GANJIL",
  startDate: "2026-07-13",
  endDate: "2026-12-31",
} as const;

export const DEPARTMENTS: SeedDepartment[] = [
  { code: "TSM", name: "Teknik Sepeda Motor" },
  { code: "TKJ", name: "Teknik Komputer dan Jaringan" },
  { code: "LPB", name: "Layanan Perbankan" },
];

export const SUBJECTS: SeedSubject[] = [
  { code: "ADPJ", name: "ADM PAJAK" },
  { code: "BIN", name: "BHS INDONESIA" },
  { code: "BIG", name: "BHS INGGRIS" },
  { code: "BJW", name: "BHS JAWA" },
  { code: "BK", name: "BK" },
  { code: "CODING", name: "CODING" },
  { code: "DDPK", name: "DDPK" },
  { code: "HYBRID", name: "HYBRID" },
  { code: "INF", name: "INFORMATIKA" },
  { code: "IPAS", name: "IPAS" },
  { code: "LISTRIK", name: "LISTRIK" },
  { code: "LLPKM", name: "LLPKM" },
  { code: "MAPIL", name: "MAPIL" },
  { code: "MTK", name: "MATEMATIKA" },
  { code: "MESIN", name: "MESIN" },
  { code: "PABP", name: "PABP" },
  { code: "PENGKAS", name: "PENG. KAS" },
  { code: "PJOK", name: "PJOK" },
  { code: "PKK", name: "PKK" },
  { code: "PKN", name: "PKN" },
  { code: "PKPJ", name: "PKPJ" },
  { code: "PPJ", name: "PPJ" },
  { code: "SASIS", name: "SASIS" },
  { code: "SEJ", name: "SEJARAH" },
  { code: "SENI", name: "SENI" },
  { code: "TJKN", name: "TJKN" },
];

export const TEACHERS: SeedTeacher[] = [
  { key: "AAN", name: "AAN", email: "aan@sekolah.sch.id", subjects: ["PKK", "SENI"] },
  { key: "ALFI", name: "ALFI", email: "alfi@sekolah.sch.id", subjects: ["INF", "MAPIL", "TJKN"] },
  { key: "ANGGA", name: "ANGGA", email: "angga@sekolah.sch.id", subjects: ["BIG", "CODING", "DDPK"] },
  { key: "ARIF", name: "ARIF", email: "arif@sekolah.sch.id", subjects: ["DDPK", "MAPIL", "PPJ"] },
  { key: "DODO", name: "DODO", email: "dodo@sekolah.sch.id", subjects: ["PKN"] },
  { key: "EDI", name: "EDI", email: "edi@sekolah.sch.id", subjects: ["DDPK", "SEJ"] },
  { key: "GANANG", name: "GANANG", email: "ganang@sekolah.sch.id", subjects: ["PABP"] },
  { key: "HAMIDIN", name: "HAMIDIN", email: "hamidin@sekolah.sch.id", subjects: ["PJOK", "SEJ"] },
  { key: "HERI", name: "HERI", email: "heri@sekolah.sch.id", subjects: ["MTK"] },
  { key: "INDRA", name: "INDRA", email: "indra@sekolah.sch.id", subjects: ["DDPK", "PKPJ"] },
  { key: "MOMON", name: "MOMON", email: "momon@sekolah.sch.id", subjects: ["BK"] },
  { key: "MUHTAR", name: "MUHTAR", email: "muhtar@sekolah.sch.id", subjects: ["BJW"] },
  { key: "NANA", name: "NANA", email: "nana@sekolah.sch.id", subjects: ["DDPK", "LLPKM"] },
  { key: "RIFAI", name: "RIFAI", email: "rifai@sekolah.sch.id", subjects: ["BIN", "DDPK"] },
  { key: "ROFIK", name: "ROFIK", email: "rofik@sekolah.sch.id", subjects: ["HYBRID", "LISTRIK", "MAPIL", "MESIN", "SASIS"] },
  { key: "SJULFA", name: "SJULFA", email: "sjulfa@sekolah.sch.id", subjects: ["IPAS", "PKK"] },
  { key: "TRIANI", name: "TRIANI", email: "triani@sekolah.sch.id", subjects: ["ADPJ", "PENGKAS"] },
  { key: "ZALFA", name: "ZALFA", email: "zalfa@sekolah.sch.id", subjects: ["BIG"] },
];

export const HOMEROOM_STAFF: SeedTeacher[] = [
  { key: "PURWANA", name: "PURWANA", email: "purwana@sekolah.sch.id", subjects: [] },
];

export const CLASSES: SeedClass[] = [
  { key: "10 TSM", gradeLevel: 10, departmentCode: "TSM", section: "", homeroomTeacherKey: "PURWANA" },
  { key: "10 TKJ", gradeLevel: 10, departmentCode: "TKJ", section: "", homeroomTeacherKey: "SJULFA" },
  { key: "10 LPB", gradeLevel: 10, departmentCode: "LPB", section: "", homeroomTeacherKey: "RIFAI" },
  { key: "11 TSM", gradeLevel: 11, departmentCode: "TSM", section: "", homeroomTeacherKey: "HERI" },
  { key: "11 TKJ", gradeLevel: 11, departmentCode: "TKJ", section: "", homeroomTeacherKey: "SJULFA" },
  { key: "11 LPB", gradeLevel: 11, departmentCode: "LPB", section: "", homeroomTeacherKey: "ZALFA" },
];

export const TIME_SLOTS: SeedTimeSlot[] = [
  { label: "Jam 1", kind: "LESSON", periodNumber: 1, startTime: "07:00", endTime: "07:40" },
  { label: "Jam 2", kind: "LESSON", periodNumber: 2, startTime: "07:40", endTime: "08:20" },
  { label: "Jam 3", kind: "LESSON", periodNumber: 3, startTime: "08:20", endTime: "09:00" },
  { label: "Jam 4", kind: "LESSON", periodNumber: 4, startTime: "09:00", endTime: "09:40" },
  { label: "Istirahat", kind: "BREAK", periodNumber: null, startTime: "09:40", endTime: "09:55" },
  { label: "Jam 5", kind: "LESSON", periodNumber: 5, startTime: "09:55", endTime: "10:30" },
  { label: "Jam 6", kind: "LESSON", periodNumber: 6, startTime: "10:30", endTime: "11:05" },
  { label: "Jam 7", kind: "LESSON", periodNumber: 7, startTime: "11:05", endTime: "11:40" },
  { label: "Jam 8", kind: "LESSON", periodNumber: 8, startTime: "11:40", endTime: "12:15" },
  { label: "Istirahat", kind: "BREAK", periodNumber: null, startTime: "12:15", endTime: "12:45" },
  { label: "Jam 9", kind: "LESSON", periodNumber: 9, startTime: "12:45", endTime: "13:20" },
  { label: "Jam 10", kind: "LESSON", periodNumber: 10, startTime: "13:20", endTime: "13:55" },
  { label: "Jam 11", kind: "LESSON", periodNumber: 11, startTime: "13:55", endTime: "14:30" },
];

export const SCHEDULES: SeedSchedule[] = [
  { classKey: "10 TSM", subjectCode: "DDPK", teacherKey: "EDI", dayOfWeek: 1, periodStart: 1, periodEnd: 4 },
  { classKey: "10 TSM", subjectCode: "BJW", teacherKey: "MUHTAR", dayOfWeek: 1, periodStart: 5, periodEnd: 6 },
  { classKey: "10 TSM", subjectCode: "IPAS", teacherKey: "SJULFA", dayOfWeek: 1, periodStart: 7, periodEnd: 10 },
  { classKey: "10 TSM", subjectCode: "BK", teacherKey: "MOMON", dayOfWeek: 1, periodStart: 11, periodEnd: 11 },
  { classKey: "10 TKJ", subjectCode: "DDPK", teacherKey: "INDRA", dayOfWeek: 1, periodStart: 1, periodEnd: 3 },
  { classKey: "10 TKJ", subjectCode: "SENI", teacherKey: "AAN", dayOfWeek: 1, periodStart: 4, periodEnd: 5 },
  { classKey: "10 TKJ", subjectCode: "SEJ", teacherKey: "EDI", dayOfWeek: 1, periodStart: 6, periodEnd: 7 },
  { classKey: "10 TKJ", subjectCode: "BJW", teacherKey: "MUHTAR", dayOfWeek: 1, periodStart: 8, periodEnd: 9 },
  { classKey: "10 TKJ", subjectCode: "CODING", teacherKey: "ANGGA", dayOfWeek: 1, periodStart: 10, periodEnd: 11 },
  { classKey: "10 LPB", subjectCode: "PJOK", teacherKey: "HAMIDIN", dayOfWeek: 1, periodStart: 1, periodEnd: 3 },
  { classKey: "10 LPB", subjectCode: "MTK", teacherKey: "HERI", dayOfWeek: 1, periodStart: 4, periodEnd: 7 },
  { classKey: "10 LPB", subjectCode: "BIG", teacherKey: "ANGGA", dayOfWeek: 1, periodStart: 8, periodEnd: 9 },
  { classKey: "10 LPB", subjectCode: "BJW", teacherKey: "MUHTAR", dayOfWeek: 1, periodStart: 10, periodEnd: 11 },
  { classKey: "11 TSM", subjectCode: "MTK", teacherKey: "HERI", dayOfWeek: 1, periodStart: 1, periodEnd: 3 },
  { classKey: "11 TSM", subjectCode: "PKK", teacherKey: "SJULFA", dayOfWeek: 1, periodStart: 4, periodEnd: 6 },
  { classKey: "11 TSM", subjectCode: "SEJ", teacherKey: "HAMIDIN", dayOfWeek: 1, periodStart: 7, periodEnd: 8 },
  { classKey: "11 TSM", subjectCode: "BIN", teacherKey: "RIFAI", dayOfWeek: 1, periodStart: 9, periodEnd: 11 },
  { classKey: "11 TKJ", subjectCode: "TJKN", teacherKey: "ALFI", dayOfWeek: 1, periodStart: 1, periodEnd: 4 },
  { classKey: "11 TKJ", subjectCode: "BIN", teacherKey: "RIFAI", dayOfWeek: 1, periodStart: 5, periodEnd: 7 },
  { classKey: "11 TKJ", subjectCode: "PKPJ", teacherKey: "INDRA", dayOfWeek: 1, periodStart: 8, periodEnd: 11 },
  { classKey: "11 LPB", subjectCode: "BIG", teacherKey: "ZALFA", dayOfWeek: 1, periodStart: 1, periodEnd: 4 },
  { classKey: "11 LPB", subjectCode: "SEJ", teacherKey: "HAMIDIN", dayOfWeek: 1, periodStart: 5, periodEnd: 6 },
  { classKey: "11 LPB", subjectCode: "ADPJ", teacherKey: "TRIANI", dayOfWeek: 1, periodStart: 7, periodEnd: 9 },
  { classKey: "11 LPB", subjectCode: "LLPKM", teacherKey: "NANA", dayOfWeek: 1, periodStart: 10, periodEnd: 11 },
  { classKey: "10 TSM", subjectCode: "BIN", teacherKey: "RIFAI", dayOfWeek: 2, periodStart: 1, periodEnd: 4 },
  { classKey: "10 TSM", subjectCode: "MTK", teacherKey: "HERI", dayOfWeek: 2, periodStart: 5, periodEnd: 8 },
  { classKey: "10 TSM", subjectCode: "PABP", teacherKey: "GANANG", dayOfWeek: 2, periodStart: 9, periodEnd: 11 },
  { classKey: "10 TKJ", subjectCode: "PJOK", teacherKey: "HAMIDIN", dayOfWeek: 2, periodStart: 1, periodEnd: 3 },
  { classKey: "10 TKJ", subjectCode: "INF", teacherKey: "ALFI", dayOfWeek: 2, periodStart: 4, periodEnd: 5 },
  { classKey: "10 TKJ", subjectCode: "BK", teacherKey: "MOMON", dayOfWeek: 2, periodStart: 6, periodEnd: 6 },
  { classKey: "10 TKJ", subjectCode: "PKN", teacherKey: "DODO", dayOfWeek: 2, periodStart: 7, periodEnd: 8 },
  { classKey: "10 TKJ", subjectCode: "DDPK", teacherKey: "ARIF", dayOfWeek: 2, periodStart: 9, periodEnd: 11 },
  { classKey: "10 LPB", subjectCode: "DDPK", teacherKey: "NANA", dayOfWeek: 2, periodStart: 1, periodEnd: 4 },
  { classKey: "10 LPB", subjectCode: "PABP", teacherKey: "GANANG", dayOfWeek: 2, periodStart: 5, periodEnd: 7 },
  { classKey: "10 LPB", subjectCode: "BIN", teacherKey: "RIFAI", dayOfWeek: 2, periodStart: 8, periodEnd: 11 },
  { classKey: "11 TSM", subjectCode: "MAPIL", teacherKey: "ROFIK", dayOfWeek: 2, periodStart: 1, periodEnd: 4 },
  { classKey: "11 TSM", subjectCode: "LISTRIK", teacherKey: "ROFIK", dayOfWeek: 2, periodStart: 5, periodEnd: 7 },
  { classKey: "11 TSM", subjectCode: "BJW", teacherKey: "MUHTAR", dayOfWeek: 2, periodStart: 8, periodEnd: 9 },
  { classKey: "11 TSM", subjectCode: "PKN", teacherKey: "DODO", dayOfWeek: 2, periodStart: 10, periodEnd: 11 },
  { classKey: "11 TKJ", subjectCode: "MTK", teacherKey: "HERI", dayOfWeek: 2, periodStart: 1, periodEnd: 3 },
  { classKey: "11 TKJ", subjectCode: "PPJ", teacherKey: "ARIF", dayOfWeek: 2, periodStart: 4, periodEnd: 7 },
  { classKey: "11 TKJ", subjectCode: "PKPJ", teacherKey: "INDRA", dayOfWeek: 2, periodStart: 8, periodEnd: 9 },
  { classKey: "11 TKJ", subjectCode: "TJKN", teacherKey: "ALFI", dayOfWeek: 2, periodStart: 10, periodEnd: 11 },
  { classKey: "11 LPB", subjectCode: "PABP", teacherKey: "GANANG", dayOfWeek: 2, periodStart: 1, periodEnd: 3 },
  { classKey: "11 LPB", subjectCode: "BK", teacherKey: "MOMON", dayOfWeek: 2, periodStart: 4, periodEnd: 4 },
  { classKey: "11 LPB", subjectCode: "LLPKM", teacherKey: "NANA", dayOfWeek: 2, periodStart: 5, periodEnd: 8 },
  { classKey: "11 LPB", subjectCode: "PKK", teacherKey: "AAN", dayOfWeek: 2, periodStart: 9, periodEnd: 11 },
  { classKey: "10 TSM", subjectCode: "DDPK", teacherKey: "RIFAI", dayOfWeek: 3, periodStart: 1, periodEnd: 3 },
  { classKey: "10 TSM", subjectCode: "SENI", teacherKey: "AAN", dayOfWeek: 3, periodStart: 4, periodEnd: 5 },
  { classKey: "10 TSM", subjectCode: "PKN", teacherKey: "DODO", dayOfWeek: 3, periodStart: 6, periodEnd: 7 },
  { classKey: "10 TSM", subjectCode: "CODING", teacherKey: "ANGGA", dayOfWeek: 3, periodStart: 8, periodEnd: 9 },
  { classKey: "10 TSM", subjectCode: "IPAS", teacherKey: "SJULFA", dayOfWeek: 3, periodStart: 10, periodEnd: 11 },
  { classKey: "10 TKJ", subjectCode: "MTK", teacherKey: "HERI", dayOfWeek: 3, periodStart: 1, periodEnd: 4 },
  { classKey: "10 TKJ", subjectCode: "DDPK", teacherKey: "ANGGA", dayOfWeek: 3, periodStart: 5, periodEnd: 7 },
  { classKey: "10 TKJ", subjectCode: "BIN", teacherKey: "RIFAI", dayOfWeek: 3, periodStart: 8, periodEnd: 11 },
  { classKey: "10 LPB", subjectCode: "DDPK", teacherKey: "NANA", dayOfWeek: 3, periodStart: 1, periodEnd: 4 },
  { classKey: "10 LPB", subjectCode: "IPAS", teacherKey: "SJULFA", dayOfWeek: 3, periodStart: 5, periodEnd: 7 },
  { classKey: "10 LPB", subjectCode: "INF", teacherKey: "ALFI", dayOfWeek: 3, periodStart: 8, periodEnd: 9 },
  { classKey: "10 LPB", subjectCode: "BIG", teacherKey: "ANGGA", dayOfWeek: 3, periodStart: 10, periodEnd: 11 },
  { classKey: "11 TSM", subjectCode: "PKK", teacherKey: "SJULFA", dayOfWeek: 3, periodStart: 1, periodEnd: 2 },
  { classKey: "11 TSM", subjectCode: "BK", teacherKey: "MOMON", dayOfWeek: 3, periodStart: 3, periodEnd: 3 },
  { classKey: "11 TSM", subjectCode: "MESIN", teacherKey: "ROFIK", dayOfWeek: 3, periodStart: 4, periodEnd: 7 },
  { classKey: "11 TSM", subjectCode: "SASIS", teacherKey: "ROFIK", dayOfWeek: 3, periodStart: 8, periodEnd: 11 },
  { classKey: "11 TKJ", subjectCode: "BJW", teacherKey: "MUHTAR", dayOfWeek: 3, periodStart: 1, periodEnd: 2 },
  { classKey: "11 TKJ", subjectCode: "PJOK", teacherKey: "HAMIDIN", dayOfWeek: 3, periodStart: 3, periodEnd: 4 },
  { classKey: "11 TKJ", subjectCode: "BIG", teacherKey: "ZALFA", dayOfWeek: 3, periodStart: 5, periodEnd: 7 },
  { classKey: "11 TKJ", subjectCode: "PKK", teacherKey: "SJULFA", dayOfWeek: 3, periodStart: 8, periodEnd: 9 },
  { classKey: "11 TKJ", subjectCode: "PPJ", teacherKey: "ARIF", dayOfWeek: 3, periodStart: 10, periodEnd: 11 },
  { classKey: "11 LPB", subjectCode: "PJOK", teacherKey: "HAMIDIN", dayOfWeek: 3, periodStart: 1, periodEnd: 2 },
  { classKey: "11 LPB", subjectCode: "MAPIL", teacherKey: "ALFI", dayOfWeek: 3, periodStart: 3, periodEnd: 6 },
  { classKey: "11 LPB", subjectCode: "BJW", teacherKey: "MUHTAR", dayOfWeek: 3, periodStart: 7, periodEnd: 8 },
  { classKey: "11 LPB", subjectCode: "PENGKAS", teacherKey: "TRIANI", dayOfWeek: 3, periodStart: 9, periodEnd: 11 },
  { classKey: "10 TSM", subjectCode: "PJOK", teacherKey: "HAMIDIN", dayOfWeek: 4, periodStart: 1, periodEnd: 3 },
  { classKey: "10 TSM", subjectCode: "INF", teacherKey: "ALFI", dayOfWeek: 4, periodStart: 4, periodEnd: 5 },
  { classKey: "10 TSM", subjectCode: "DDPK", teacherKey: "EDI", dayOfWeek: 4, periodStart: 6, periodEnd: 7 },
  { classKey: "10 TSM", subjectCode: "BIG", teacherKey: "ANGGA", dayOfWeek: 4, periodStart: 8, periodEnd: 11 },
  { classKey: "10 TKJ", subjectCode: "BIG", teacherKey: "ANGGA", dayOfWeek: 4, periodStart: 1, periodEnd: 4 },
  { classKey: "10 TKJ", subjectCode: "PABP", teacherKey: "GANANG", dayOfWeek: 4, periodStart: 5, periodEnd: 7 },
  { classKey: "10 TKJ", subjectCode: "IPAS", teacherKey: "SJULFA", dayOfWeek: 4, periodStart: 8, periodEnd: 11 },
  { classKey: "10 LPB", subjectCode: "IPAS", teacherKey: "SJULFA", dayOfWeek: 4, periodStart: 1, periodEnd: 3 },
  { classKey: "10 LPB", subjectCode: "SEJ", teacherKey: "EDI", dayOfWeek: 4, periodStart: 4, periodEnd: 5 },
  { classKey: "10 LPB", subjectCode: "SENI", teacherKey: "AAN", dayOfWeek: 4, periodStart: 6, periodEnd: 7 },
  { classKey: "10 LPB", subjectCode: "DDPK", teacherKey: "NANA", dayOfWeek: 4, periodStart: 8, periodEnd: 11 },
  { classKey: "11 TSM", subjectCode: "BIG", teacherKey: "ZALFA", dayOfWeek: 4, periodStart: 1, periodEnd: 4 },
  { classKey: "11 TSM", subjectCode: "MESIN", teacherKey: "ROFIK", dayOfWeek: 4, periodStart: 5, periodEnd: 6 },
  { classKey: "11 TSM", subjectCode: "LISTRIK", teacherKey: "ROFIK", dayOfWeek: 4, periodStart: 7, periodEnd: 9 },
  { classKey: "11 TSM", subjectCode: "HYBRID", teacherKey: "ROFIK", dayOfWeek: 4, periodStart: 10, periodEnd: 11 },
  { classKey: "11 TKJ", subjectCode: "PABP", teacherKey: "GANANG", dayOfWeek: 4, periodStart: 1, periodEnd: 3 },
  { classKey: "11 TKJ", subjectCode: "PKK", teacherKey: "SJULFA", dayOfWeek: 4, periodStart: 4, periodEnd: 5 },
  { classKey: "11 TKJ", subjectCode: "SEJ", teacherKey: "HAMIDIN", dayOfWeek: 4, periodStart: 6, periodEnd: 7 },
  { classKey: "11 TKJ", subjectCode: "BIG", teacherKey: "ZALFA", dayOfWeek: 4, periodStart: 8, periodEnd: 9 },
  { classKey: "11 TKJ", subjectCode: "PKN", teacherKey: "DODO", dayOfWeek: 4, periodStart: 10, periodEnd: 11 },
  { classKey: "11 LPB", subjectCode: "MTK", teacherKey: "HERI", dayOfWeek: 4, periodStart: 1, periodEnd: 3 },
  { classKey: "11 LPB", subjectCode: "PKK", teacherKey: "AAN", dayOfWeek: 4, periodStart: 4, periodEnd: 5 },
  { classKey: "11 LPB", subjectCode: "ADPJ", teacherKey: "TRIANI", dayOfWeek: 4, periodStart: 6, periodEnd: 8 },
  { classKey: "11 LPB", subjectCode: "BIN", teacherKey: "RIFAI", dayOfWeek: 4, periodStart: 9, periodEnd: 11 },
  { classKey: "10 TSM", subjectCode: "SEJ", teacherKey: "EDI", dayOfWeek: 5, periodStart: 1, periodEnd: 2 },
  { classKey: "10 TSM", subjectCode: "DDPK", teacherKey: "RIFAI", dayOfWeek: 5, periodStart: 3, periodEnd: 5 },
  { classKey: "10 TKJ", subjectCode: "DDPK", teacherKey: "ANGGA", dayOfWeek: 5, periodStart: 1, periodEnd: 3 },
  { classKey: "10 TKJ", subjectCode: "IPAS", teacherKey: "SJULFA", dayOfWeek: 5, periodStart: 4, periodEnd: 5 },
  { classKey: "10 LPB", subjectCode: "PKN", teacherKey: "DODO", dayOfWeek: 5, periodStart: 1, periodEnd: 2 },
  { classKey: "10 LPB", subjectCode: "BK", teacherKey: "MOMON", dayOfWeek: 5, periodStart: 3, periodEnd: 3 },
  { classKey: "10 LPB", subjectCode: "CODING", teacherKey: "ANGGA", dayOfWeek: 5, periodStart: 4, periodEnd: 5 },
  { classKey: "11 TSM", subjectCode: "PJOK", teacherKey: "HAMIDIN", dayOfWeek: 5, periodStart: 1, periodEnd: 2 },
  { classKey: "11 TSM", subjectCode: "PABP", teacherKey: "GANANG", dayOfWeek: 5, periodStart: 3, periodEnd: 5 },
  { classKey: "11 TKJ", subjectCode: "MAPIL", teacherKey: "ARIF", dayOfWeek: 5, periodStart: 1, periodEnd: 4 },
  { classKey: "11 TKJ", subjectCode: "BK", teacherKey: "MOMON", dayOfWeek: 5, periodStart: 5, periodEnd: 5 },
  { classKey: "11 LPB", subjectCode: "PENGKAS", teacherKey: "TRIANI", dayOfWeek: 5, periodStart: 1, periodEnd: 3 },
  { classKey: "11 LPB", subjectCode: "PKN", teacherKey: "DODO", dayOfWeek: 5, periodStart: 4, periodEnd: 5 },
];
