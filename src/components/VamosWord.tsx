import { cn } from "@/lib/utils";

/**
 * Word "VAMOS" stylized to imitate the brand logo typography.
 * Uses Quicksand Bold, uppercase, primary orange color.
 */
export function VamosWord({
  className,
  withExclamations,
}: {
  className?: string;
  withExclamations?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-bold uppercase tracking-tight text-primary",
        className,
      )}
      style={{ fontFamily: "'Quicksand', sans-serif" }}
    >
      {withExclamations ? "¡VAMOS!" : "VAMOS"}
    </span>
  );
}
