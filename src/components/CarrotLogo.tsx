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
    <img
      src="/favicon.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function CarrotLogo({ className, withWordmark = true, size = 28, invertWord = false }: Props) {
  // Wordmark scales with the mark for a more confident, prominent brand presence.
  const wordSize = Math.round(size * 0.72);
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <CarrotMark size={size} />
      {withWordmark && (
        <span
          className="font-semibold tracking-tight leading-none"
          style={{ fontSize: `${wordSize}px` }}
        >
          <span style={{ color: "var(--carrot)" }}>carrot</span>{" "}
          <span className={invertWord ? "text-current" : "text-foreground"}>mails</span>
        </span>
      )}
    </span>
  );
}

export default CarrotLogo;
