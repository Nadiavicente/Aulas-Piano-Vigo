"use client";

import { logout } from "@/lib/actions";

export function LogoutButton({ className = "" }: { className?: string }) {
  return (
    <button onClick={() => logout()} className={`underline-offset-4 hover:underline ${className}`}>
      Cerrar sesión
    </button>
  );
}
