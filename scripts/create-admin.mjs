import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error("Uso: npm run create-admin -- <email> <contraseña>");
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (revisa .env.local).");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const password_hash = await bcrypt.hash(password, 10);

const { error } = await supabase.from("admins").insert({ email: email.toLowerCase(), password_hash });

if (error) {
  console.error("Error al crear el admin:", error.message);
  process.exit(1);
}

console.log(`Cuenta de administración creada: ${email}`);
