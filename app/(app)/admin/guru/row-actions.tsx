"use client";

import {
  Ellipsis,
  KeyRound,
  Pencil,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import {
  resetTeacherPassword,
  saveTeacher,
  setTeacherStatus,
} from "./actions";

const menuItemClass =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors";

export function TeacherRowActions({
  teacher,
  returnTo,
  resetPassword,
  children,
}: {
  teacher: { id: string; name: string; isActive: boolean };
  returnTo: string;
  resetPassword: string;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLSpanElement>(null);

  const MENU_WIDTH = 192;
  const MENU_HEIGHT = 136;

  const toggleMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const left = Math.min(
      Math.max(8, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    );
    const openBelow = rect.bottom + MENU_HEIGHT + 8 <= window.innerHeight;

    setMenuPosition({
      top: openBelow ? rect.bottom + 4 : rect.top - MENU_HEIGHT - 4,
      left,
    });
    setMenuOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    function handleViewportChange() {
      setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [menuOpen]);

  return (
    <div className="relative flex justify-end" ref={menuRef}>
      <span ref={buttonRef} className="inline-flex">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Aksi untuk ${teacher.name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={toggleMenu}
        >
          <Ellipsis className="h-5 w-5" />
        </Button>
      </span>

      {menuOpen ? (
        <div
          role="menu"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          className="fixed z-50 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setEditOpen(true);
            }}
            className={cn(menuItemClass, "text-slate-700 hover:bg-slate-100")}
          >
            <Pencil className="h-4 w-4" />
            Ubah
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setResetOpen(true);
            }}
            className={cn(menuItemClass, "text-slate-700 hover:bg-slate-100")}
          >
            <KeyRound className="h-4 w-4" />
            Reset Password
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setStatusOpen(true);
            }}
            className={cn(
              menuItemClass,
              teacher.isActive
                ? "text-red-600 hover:bg-red-50"
                : "text-emerald-600 hover:bg-emerald-50",
            )}
          >
            {teacher.isActive ? (
              <UserX className="h-4 w-4" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
            {teacher.isActive ? "Nonaktifkan" : "Aktifkan"}
          </button>
        </div>
      ) : null}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Ubah Guru"
        description="Perbarui profil, status akun, dan mapping mapel."
      >
        <ActionForm
          action={saveTeacher}
          submitLabel="Simpan Perubahan"
          onCancel={() => setEditOpen(false)}
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          {children}
        </ActionForm>
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset Password"
        description={`Reset password guru ${teacher.name} ke ${resetPassword}? Password lama tidak akan berlaku lagi.`}
        size="sm"
      >
        <form action={resetTeacherPassword} className="space-y-4">
          <input type="hidden" name="id" value={teacher.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setResetOpen(false)}
            >
              Batal
            </Button>
            <SubmitButton pendingText="Mereset...">
              Reset Password
            </SubmitButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title={teacher.isActive ? "Nonaktifkan Guru" : "Aktifkan Guru"}
        description={
          teacher.isActive
            ? `Nonaktifkan akun guru ${teacher.name}? Riwayat jurnal tetap tersimpan.`
            : `Aktifkan kembali akun guru ${teacher.name}?`
        }
        size="sm"
      >
        <form action={setTeacherStatus} className="space-y-4">
          <input type="hidden" name="id" value={teacher.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input
            type="hidden"
            name="isActive"
            value={teacher.isActive ? "false" : "true"}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStatusOpen(false)}
            >
              Batal
            </Button>
            <SubmitButton
              variant={teacher.isActive ? "danger" : "success"}
              pendingText="Memproses..."
            >
              {teacher.isActive ? "Nonaktifkan" : "Aktifkan"}
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
