"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  History,
  KeyRound,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  NotebookPen,
  School,
  Shuffle,
  UserCog,
  Users,
  X,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { Role } from "@/db/schema/enums";
import { hasPermission } from "@/lib/permissions";
import { cn, initials } from "@/lib/utils";
import { logout } from "@/app/(app)/actions";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  show: (roles: Role[]) => boolean;
};

type NavSection = {
  title: string;
  collapsible?: boolean;
  items: NavItem[];
};

const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  GURU: "Guru",
  WAKA_KURIKULUM: "Waka Kurikulum",
};

const sections: NavSection[] = [
  {
    title: "Menu",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: <LayoutDashboard className="h-5 w-5" />,
        show: () => true,
      },
      {
        href: "/jadwal",
        label: "Jadwal Mengajar",
        icon: <CalendarDays className="h-5 w-5" />,
        show: (roles) => hasPermission(roles, "read:jadwal_own"),
      },
      {
        href: "/jurnal",
        label: "Jurnal",
        icon: <NotebookPen className="h-5 w-5" />,
        show: () => true,
      },
      {
        href: "/rekap/absensi",
        label: "Rekap Absensi",
        icon: <ClipboardList className="h-5 w-5" />,
        show: () => true,
      },
    ],
  },
  {
    title: "Kurikulum",
    collapsible: true,
    items: [
      {
        href: "/guru-mapel",
        label: "Mapping Guru–Mapel",
        icon: <Link2 className="h-5 w-5" />,
        show: (roles) => hasPermission(roles, "manage:mapping_guru_mapel"),
      },
      {
        href: "/promosi",
        label: "Naik Kelas",
        icon: <Shuffle className="h-5 w-5" />,
        show: (roles) => hasPermission(roles, "manage:promotion_rules"),
      },
      {
        href: "/audit",
        label: "Audit Log",
        icon: <History className="h-5 w-5" />,
        show: (roles) => hasPermission(roles, "read:audit_log"),
      },
    ],
  },
  {
    title: "Data Master",
    collapsible: true,
    items: [
      {
        href: "/admin/tahun-ajaran",
        label: "Tahun Ajaran",
        icon: <GraduationCap className="h-5 w-5" />,
        show: (roles) => hasPermission(roles, "manage:master_data"),
      },
      {
        href: "/admin/jurusan",
        label: "Jurusan",
        icon: <School className="h-5 w-5" />,
        show: (roles) => hasPermission(roles, "manage:master_data"),
      },
      {
        href: "/admin/kelas",
        label: "Kelas",
        icon: <BookOpen className="h-5 w-5" />,
        show: (roles) => hasPermission(roles, "manage:master_data"),
      },
      {
        href: "/admin/mapel",
        label: "Mapel",
        icon: <BookOpenCheck className="h-5 w-5" />,
        show: (roles) => hasPermission(roles, "manage:master_data"),
      },
      {
        href: "/admin/guru",
        label: "Guru",
        icon: <UserCog className="h-5 w-5" />,
        show: (roles) => hasPermission(roles, "manage:master_data"),
      },
      {
        href: "/admin/siswa",
        label: "Siswa",
        icon: <Users className="h-5 w-5" />,
        show: (roles) => hasPermission(roles, "manage:master_data"),
      },
      {
        href: "/admin/enrollment",
        label: "Enrollment",
        icon: <ClipboardList className="h-5 w-5" />,
        show: (roles) => hasPermission(roles, "manage:master_data"),
      },
    ],
  },
];

const pageTitles: Record<string, string> = {
  "/jadwal/jam": "Susunan Jam",
  "/akun/password": "Ubah Password",
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center",
        collapsed ? "justify-center" : "gap-3",
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
        <BookOpenCheck className="h-5 w-5" />
      </div>
      {collapsed ? null : (
        <div className="min-w-0">
          <p className="text-xl font-bold tracking-tight text-slate-900">
            SiJAR
          </p>
          <p className="text-[11px] font-medium text-slate-400">
            Jurnal &amp; Absensi
          </p>
        </div>
      )}
    </div>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: { name?: string | null; email?: string | null; roles: Role[] };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.show(user.roles)),
    }))
    .filter((section) => section.items.length > 0);

  const activeItem = visibleSections
    .flatMap((section) => section.items)
    .find((item) => isActive(pathname, item.href));

  const displayName = user.name ?? user.email ?? "Pengguna";
  const label = user.roles.map((role) => roleLabels[role]).join(" · ");
  const pageTitle = pageTitles[pathname] ?? activeItem?.label ?? "Dashboard";

  useEffect(() => {
    if (!userMenuOpen) return;

    function handlePointer(event: MouseEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setUserMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [userMenuOpen]);

  const isSectionOpen = (section: NavSection) =>
    section.collapsible ? openSections[section.title] !== false : true;

  const toggleSection = (title: string) => {
    setOpenSections((current) => ({
      ...current,
      [title]: !(current[title] !== false),
    }));
  };

  const renderNav = (compact: boolean) => (
    <nav className="flex-1 overflow-y-auto px-4 py-5">
      {visibleSections.map((section) => {
        const sectionOpen = compact ? true : isSectionOpen(section);

        return (
          <div key={section.title} className="mb-6 last:mb-0">
            {compact ? null : section.collapsible ? (
              <button
                type="button"
                onClick={() => toggleSection(section.title)}
                aria-expanded={sectionOpen}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-600"
              >
                {section.title}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    sectionOpen ? "rotate-0" : "-rotate-90",
                  )}
                />
              </button>
            ) : (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
            )}

            {sectionOpen ? (
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        aria-label={compact ? item.label : undefined}
                        title={compact ? item.label : undefined}
                        className={cn(
                          "group flex items-center rounded-lg text-sm font-medium transition-colors",
                          compact
                            ? "h-11 justify-center px-0"
                            : "min-h-11 gap-3 px-3",
                          active
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                        )}
                      >
                        <span
                          className={cn(
                            "shrink-0 transition-colors",
                            active
                              ? "text-indigo-600"
                              : "text-slate-400 group-hover:text-slate-600",
                          )}
                        >
                          {item.icon}
                        </span>
                        {compact ? null : (
                          <span className="truncate">{item.label}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Lewati ke konten
      </a>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-200 bg-white transition-[width] duration-300 lg:flex",
          collapsed ? "w-20" : "w-72",
        )}
      >
        <div
          className={cn(
            "flex h-[72px] shrink-0 items-center border-b border-slate-200",
            collapsed ? "justify-center px-0" : "px-6",
          )}
        >
          <Brand collapsed={collapsed} />
        </div>
        {renderNav(collapsed)}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 px-5">
              <Brand />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Tutup menu"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {renderNav(false)}
            <div className="border-t border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                  {initials(displayName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-slate-500">{label}</p>
                </div>
              </div>
              <Link
                href="/akun/password"
                onClick={() => setOpen(false)}
                className={cn(
                  buttonVariants({ variant: "secondary" }),
                  "mt-3 w-full justify-center",
                )}
              >
                <KeyRound className="h-4 w-4" />
                Ubah Password
              </Link>
              <form action={logout} className="mt-2">
                <Button
                  type="submit"
                  variant="secondary"
                  className="w-full justify-center text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar
                </Button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}

      <div
        className={cn(
          "transition-[padding] duration-300",
          collapsed ? "lg:pl-20" : "lg:pl-72",
        )}
      >
        <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Buka menu"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 lg:inline-flex"
            aria-label={collapsed ? "Perluas menu" : "Ringkas menu"}
            onClick={() => setCollapsed((value) => !value)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              SiJAR
            </p>
            <p className="truncate text-sm font-semibold text-slate-800">
              {pageTitle}
            </p>
          </div>

          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((value) => !value)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-slate-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                {initials(displayName)}
              </div>
              <div className="hidden text-left sm:block">
                <p className="max-w-[150px] truncate text-sm font-semibold text-slate-800">
                  {displayName}
                </p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
              <ChevronDown
                className={cn(
                  "hidden h-4 w-4 text-slate-400 transition-transform sm:block",
                  userMenuOpen ? "rotate-180" : "rotate-0",
                )}
              />
            </button>

            {userMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
              >
                <div className="border-b border-slate-100 px-3 py-2.5 sm:hidden">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-slate-500">{label}</p>
                </div>
                <Link
                  href="/akun/password"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <KeyRound className="h-4 w-4" />
                  Ubah Password
                </Link>
                <form action={logout}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Keluar
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </header>

        <main
          id="main-content"
          className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
