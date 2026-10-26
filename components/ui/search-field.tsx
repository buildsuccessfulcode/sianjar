import { Search } from "lucide-react";

import { Field, Input } from "@/components/ui/form";

export function SearchField({
  defaultValue,
  placeholder = "Cari nama, kode, atau NISN...",
  label = "Cari",
  id = "q",
  name = "q",
}: {
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  id?: string;
  name?: string;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          id={id}
          name={name}
          type="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
    </Field>
  );
}
