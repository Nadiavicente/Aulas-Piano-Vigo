import { CompetitionLogo } from "./CompetitionLogo";
import { PianoKeysDivider } from "./PianoKeysDivider";

export function SiteHeader({
  title,
  right,
}: {
  title?: string;
  right?: React.ReactNode;
}) {
  return (
    <header>
      <div className="bg-ink">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:justify-between">
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <CompetitionLogo />
            {title && (
              <h1 className="font-serif text-xl font-semibold text-gold-light sm:text-2xl">
                {title}
              </h1>
            )}
          </div>
          {right && <div className="text-sm text-white/80">{right}</div>}
        </div>
      </div>
      <PianoKeysDivider />
    </header>
  );
}
