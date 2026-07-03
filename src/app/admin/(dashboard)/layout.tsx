import Link from "next/link";
import { verifyAdminSession } from "@/lib/dal";
import { CompetitionLogo } from "@/components/CompetitionLogo";
import { PianoKeysDivider } from "@/components/PianoKeysDivider";
import { LogoutButton } from "@/components/LogoutButton";

const NAV = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/aulas", label: "Aulas" },
  { href: "/admin/participantes", label: "Participantes" },
  { href: "/admin/rondas", label: "Rondas" },
  { href: "/admin/asignacion", label: "Asignación automática" },
  { href: "/admin/informes", label: "Informes" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await verifyAdminSession();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="print:hidden">
        <div className="bg-ink">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CompetitionLogo />
              <span className="font-serif text-lg font-semibold text-gold-light">
                Administración
              </span>
            </div>
            <LogoutButton className="text-sm text-white/70 hover:text-gold-light" />
          </div>
          <nav className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 pb-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-gold-light"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <PianoKeysDivider />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
