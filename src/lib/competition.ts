import type { RoundId } from "./types";

// Las rondas "junior_*" pertenecen a un concurso aparte (mismo sistema,
// aulas y fechas propias) que convive con el concurso principal. En vez de
// añadir una tabla de "competiciones", nos basta con el prefijo del id de
// ronda: es la única señal que necesitamos para decidir qué nombre usar en
// los correos y si una ronda es la primera participación de alguien en su
// concurso (y por tanto no lleva felicitación por "avanzar de fase").
const NOMBRE_CONCURSO_PRINCIPAL = "X Concurso Internacional de Piano Ciudad de Vigo";
const NOMBRE_CONCURSO_JUNIOR = "Concurso Internacional de Piano Vigo Junior";

export function esRondaJunior(roundId: RoundId): boolean {
  return roundId.startsWith("junior_");
}

export function nombreCompeticion(roundId: RoundId): string {
  return esRondaJunior(roundId) ? NOMBRE_CONCURSO_JUNIOR : NOMBRE_CONCURSO_PRINCIPAL;
}

// Ronda por la que empieza cada concurso: la primera vez que alguien
// aparece ahí no es un "avance de fase", es su primera participación.
const RONDAS_INICIALES: RoundId[] = ["primera", "junior_semifinal"];

export function esRondaInicial(roundId: RoundId): boolean {
  return RONDAS_INICIALES.includes(roundId);
}
