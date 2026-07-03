export function PianoKeysDivider() {
  const whiteKeys = 28;

  return (
    <div className="flex h-3 w-full overflow-hidden" aria-hidden>
      {Array.from({ length: whiteKeys }).map((_, i) => (
        <div key={i} className="relative flex-1 border-r border-ink/10 bg-white">
          {i % 7 !== 2 && i % 7 !== 6 && (
            <div className="absolute right-0 top-0 h-2 w-[55%] translate-x-1/2 bg-ink" />
          )}
        </div>
      ))}
    </div>
  );
}
