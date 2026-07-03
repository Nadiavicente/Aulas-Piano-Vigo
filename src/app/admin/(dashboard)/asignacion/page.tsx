import { getAllRounds } from "@/lib/booking";
import { searchParticipants } from "@/lib/admin";
import { AsignacionClient } from "./AsignacionClient";

export default async function AsignacionPage() {
  const rounds = await getAllRounds();
  const participants = await searchParticipants("");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl font-semibold text-ink">Asignación automática</h1>
      <p className="max-w-2xl text-sm text-ink/60">
        Sube el PDF con el orden de actuación. El sistema intentará detectar el correo, el día
        y la hora de actuación de cada participante en cada línea. Revisa y corrige la tabla
        antes de ejecutar: el formato de cada PDF puede variar.
      </p>
      <AsignacionClient rounds={rounds} participants={participants} />
    </div>
  );
}
