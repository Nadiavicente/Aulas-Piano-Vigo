import { CompetitionLogo } from "@/components/CompetitionLogo";
import { PianoKeysDivider } from "@/components/PianoKeysDivider";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col bg-ink">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        <CompetitionLogo />
        <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
          <h1 className="mb-1 text-center font-serif text-2xl font-semibold text-ink">
            Acceso participantes
          </h1>
          <p className="mb-6 text-center text-sm text-ink/60">
            X Concurso Internacional de Piano Ciudad de Vigo
          </p>
          <LoginForm defaultEmail={email} />
        </div>
        <a
          href="/admin/login"
          className="text-sm text-white/50 underline-offset-4 hover:text-gold-light hover:underline"
        >
          Acceso administración
        </a>
      </div>
      <PianoKeysDivider />
    </div>
  );
}
