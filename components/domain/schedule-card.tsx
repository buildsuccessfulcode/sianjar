import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, Clock, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ScheduleCard({
  scheduleId,
  date,
  subjectName,
  className,
  periodStart,
  periodEnd,
  room,
  journalId,
}: {
  scheduleId: string;
  date: string;
  subjectName: string;
  className: string;
  periodStart: number;
  periodEnd: number;
  room?: string | null;
  journalId: string | null;
}) {
  const filled = Boolean(journalId);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
            <Clock className="h-4 w-4 text-slate-400" />
            Jam {periodStart}–{periodEnd}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            {subjectName}
          </h3>
          <p className="text-sm text-slate-500">{className}</p>
          {room ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {room}
            </p>
          ) : null}
        </div>
        <Badge variant={filled ? "success" : "danger"}>
          {filled ? (
            <CircleCheck className="h-3.5 w-3.5" />
          ) : (
            <CircleAlert className="h-3.5 w-3.5" />
          )}
          {filled ? "Sudah diisi" : "Belum diisi"}
        </Badge>
      </div>

      <div className="mt-4">
        {filled && journalId ? (
          <Link
            href={`/jurnal/${journalId}`}
            className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
          >
            Lihat Jurnal
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            href={`/jurnal/isi/${scheduleId}?date=${date}`}
            className={cn(buttonVariants({ variant: "primary" }), "w-full")}
          >
            Isi Jurnal
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </article>
  );
}
