import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function classLabel(input: {
  gradeLevel: number;
  section: string;
  departmentCode?: string | null;
  departmentName?: string | null;
}) {
  const department = input.departmentCode ?? input.departmentName ?? "";
  return [input.gradeLevel, department, input.section]
    .filter(Boolean)
    .join(" ");
}

export function semesterLabel(name: "GANJIL" | "GENAP", year?: string | null) {
  const semester = name === "GANJIL" ? "Ganjil" : "Genap";
  return year ? `${semester} ${year}` : semester;
}
