import Link from "next/link";
import { searchParticipants } from "@/lib/admin";
import { getAllRounds } from "@/lib/booking";
import { CreateParticipantForm } from "./CreateParticipantForm";

export default async function ParticipantesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const participants = await searchParticipants(q ?? "");
  const rounds = await getAllRounds();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl font-semibold text-ink">Participantes</h1>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, correo o código…"
          className="w-full max-w-sm rounded-md border border-ink/20 px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-ink px-4 py-2 text-sm text-gold-light">Buscar</button>
      </form>

      <CreateParticipantForm rounds={rounds} />

      <div className="overflow-x-auto rounded-lg border border-ink/10">
        <table className="w-full text-sm">
          <thead className="bg-ink/5 text-left text-ink/60">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Rondas</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.id} className="border-t border-ink/5">
                <td className="px-3 py-2 text-ink/60">{p.codigo ?? "—"}</td>
                <td className="px-3 py-2 font-medium text-ink">{p.nombre}</td>
                <td className="px-3 py-2 text-ink/70">{p.email}</td>
                <td className="px-3 py-2 text-ink/60">{p.rondas_clasificado.join(", ") || "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/admin/participantes/${p.id}`} className="text-ink underline">
                    Ver ficha
                  </Link>
                </td>
              </tr>
            ))}
            {participants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-ink/40">
                  No se han encontrado participantes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
