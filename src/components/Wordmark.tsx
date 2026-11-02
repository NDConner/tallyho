import { cn } from "@/lib/utils";

/** Five-stroke tally glyph (four bars + a diagonal) — the counting motif. */
function TallyMarks({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      className={cn("h-[0.78em] w-auto", className)}
      aria-hidden="true"
    >
      <line x1="5" y1="3.5" x2="5" y2="20.5" />
      <line x1="10.5" y1="3.5" x2="10.5" y2="20.5" />
      <line x1="16" y1="3.5" x2="16" y2="20.5" />
      <line x1="21.5" y1="3.5" x2="21.5" y2="20.5" />
      <line x1="2.5" y1="20.5" x2="24" y2="3.5" />
    </svg>
  );
}

/** The Tallyho wordmark — tally marks + "Tally" + a magenta "ho!" speech bubble. */
export function Wordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const scale =
    size === "lg"
      ? "text-5xl sm:text-7xl"
      : size === "xs"
        ? "text-base"
        : size === "sm"
          ? "text-xl"
          : "text-3xl sm:text-4xl";

  return (
    <span
      className={cn(
        "inline-flex items-center font-display font-black tracking-tight select-none leading-none",
        scale,
        className,
      )}
    >
      <TallyMarks className="mr-2 text-cyan" />
      <span className="text-cream">Tally</span>
      <span className="relative ml-1.5 inline-flex items-center rounded-2xl bg-magenta px-3 pb-1 pt-1.5 text-white shadow-[0_10px_30px_-8px_rgba(255,46,136,0.7)]">
        ho<span className="text-gold">!</span>
        {/* speech-bubble tail */}
        <span className="absolute -bottom-1.5 left-5 h-0 w-0 border-l-8 border-t-8 border-l-transparent border-t-magenta" />
      </span>
    </span>
  );
}
