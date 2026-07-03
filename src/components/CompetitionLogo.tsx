import Image from "next/image";

export function CompetitionLogo({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center rounded-lg bg-[#faf6ee] px-4 py-2 shadow-sm ${className}`}
    >
      <Image
        src="/logo-concurso.png"
        alt="X Concurso Internacional de Piano Ciudad de Vigo"
        width={240}
        height={143}
        className="h-auto w-40 sm:w-48"
        priority
      />
    </div>
  );
}
