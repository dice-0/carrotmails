import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  withWordmark?: boolean;
  size?: number;
  /** when true, the second word ("mails") uses currentColor instead of dark ink */
  invertWord?: boolean;
};

/**
 * Carrot Mails logo. Inline SVG so it stays crisp at every size,
 * inherits theme, and never depends on a remote asset.
 */
export function CarrotMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* speed lines */}
      <rect x="2" y="34" width="10" height="4" rx="2" fill="var(--carrot)" />
      <rect x="6" y="26" width="14" height="4" rx="2" fill="var(--carrot)" />
      <rect x="4" y="42" width="12" height="4" rx="2" fill="var(--carrot)" />
      {/* carrot body shaped like a mail envelope tail */}
      <path
        d="M18 22 L52 18 C58 17.5 60 22 56 28 L40 50 C36 56 30 56 26 50 L18 38 C14 32 14 22.5 18 22 Z"
        fill="var(--carrot)"
      />
      {/* envelope crease */}
      <path
        d="M22 24 L38 38 L54 22"
        stroke="var(--carrot-fold)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* leaves */}
      <path d="M48 14 C45 8 50 4 55 6 C56 11 53 15 48 14 Z" fill="var(--carrot-leaf)" />
      <path d="M52 12 C53 6 59 6 60 11 C60 15 56 17 52 12 Z" fill="var(--carrot-leaf)" />
    </svg>
  );
}

export function CarrotLogo({ className, withWordmark = true, size = 28, invertWord = false }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <CarrotMark size={size} />
      {withWordmark && (
        <span className="font-semibold tracking-tight leading-none">
          <span style={{ color: "var(--carrot)" }}>carrot</span>{" "}
          <span className={invertWord ? "text-current" : "text-foreground"}>mails</span>
        </span>
      )}
    </span>
  );
}

export default CarrotLogo;
