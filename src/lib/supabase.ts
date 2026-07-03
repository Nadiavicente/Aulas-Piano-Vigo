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
