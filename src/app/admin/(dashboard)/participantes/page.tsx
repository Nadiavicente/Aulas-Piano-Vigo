import Link from "next/link";
import { searchParticipants } from "@/lib/admin";
import { getAllRounds } from "@/lib/booking";
import { esRondaJunior } from "@/lib/competition";
import { CreateParticipantForm } from "./CreateParticipantForm";
import { DeleteParticipantInline } from "./DeleteParticipantInline";

export default async function ParticipantesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; comp?: string }>;
}) {
  const { q, comp } = await searchParams;
  const allParticipants = await searchParticipants(q ?? "");
  const rounds = await getAllRounds();

  const filtro = comp === "junior" ? "junior" : comp === "principal" ? "principal" : "todos";
  const participants = allParticipants.filter((p) => {
    if (filtro === "todos") return true;
    const tieneJunior = p.rondas_clasificado.some(esRondaJunior);
    if (filtro === "junior") return tieneJunior;
    return !tieneJunior; // "principal": sin ninguna ronda junior (incluye a quien no tiene rondas asignadas todavía)
  });

  const tabs: { valor: string; etiqueta: string }[] = [
    { valor: "todos", etiqueta: "Todos" },
    { valor: "principal", etiqueta: "Concurso principal" },
    { valor: "junior", etiqueta: "Concurso Junior" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl font-semibold text-ink">Participantes</h1>

      <form className="flex gap-2">
        <input type="hidden" name="comp" value={filtro} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, correo o código…"
          className="w-full max-w-sm rounded-md border border-ink/20 px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-ink px-4 py-2 text-sm text-gold-light">Buscar</button>
      </form>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.valor}
            href={`/admin/participantes?comp=${t.valor}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              filtro === t.valor ? "bg-ink text-gold-light" : "bg-ink/5 text-ink/70 hover:bg-ink/10"
            }`}
          >
            {t.etiqueta}
          </Link>
        ))}
      </div>

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
                  <div className="flex justify-end gap-3">
                    <Link href={`/admin/participantes/${p.id}`} className="text-ink underline">
                      Ver ficha
                    </Link>
                    <DeleteParticipantInline participantId={p.id} nombre={p.nombre} />
                  </div>
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
