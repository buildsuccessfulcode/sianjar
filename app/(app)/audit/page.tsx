import type { Metadata } from "next";
import { History } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAuditLogs } from "@/data-access/audit";
import { formatDateTimeId } from "@/lib/date";
import { requirePagePermission } from "@/lib/dal";

export const metadata: Metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requirePagePermission("read:audit_log");
  const logs = await listAuditLogs();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Catatan aksi kritis: jadwal, promosi, dan aktivasi tahun ajaran/semester. Maksimal 100 entri terbaru."
      />

      {logs.length === 0 ? (
        <EmptyState
          title="Belum ada audit log"
          description="Aksi kritis akan tercatat otomatis di sini."
          icon={<History className="h-8 w-8" />}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Aktor</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Entitas</TableHead>
              <TableHead>Payload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-xs text-slate-500">
                  {formatDateTimeId(log.createdAt)}
                </TableCell>
                <TableCell className="font-medium text-slate-900">
                  {log.actorName}
                </TableCell>
                <TableCell className="font-mono text-xs">{log.action}</TableCell>
                <TableCell className="text-xs">
                  {log.entityType}
                  {log.entityId ? (
                    <span className="block truncate font-mono text-[11px] text-slate-400">
                      {log.entityId}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-md">
                  <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-[11px] text-slate-600">
                    {log.payload ? JSON.stringify(log.payload, null, 2) : "—"}
                  </pre>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
