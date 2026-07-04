import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Cliente de servidor con la service_role key: se usa desde Server Actions,
// Route Handlers y Server Components solamente. Nunca importar en 'use client'.
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno'
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

// PostgREST (y por tanto Supabase) devuelve como mucho 1000 filas por
// consulta salvo que se pida explícitamente un rango mayor. Con ~98
// participantes × 4h × 3 días una ronda puede superar sin problema esas
// 1000 reservas, así que cualquier consulta sin filtrar por participante
// debe paginar con esta función en vez de un .select(...) directo.
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE_SIZE = 1000
  let offset = 0
  let all: T[] = []

  while (true) {
    const { data, error } = await build(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}
