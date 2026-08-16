/**
 * Time Black Logo — loaded from public/logo.svg as specified in the canvas.
 * Renders the SVG inline so it inherits currentColor for theming.
 */
import Image from "next/image";

export function Logo({
  size = 32,
  withText = true,
  className = "",
}: {
  size?: number;
  withText?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/logo.svg"
        alt="Time Black"
        width={size}
        height={size}
        priority
        className="shrink-0"
      />
      {withText && (
        <span className="font-academic text-lg font-bold text-gradient-gold">
          Time Black
        </span>
      )}
    </div>
  );
}
