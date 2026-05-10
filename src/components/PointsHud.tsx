import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { usePoints } from "@/hooks/usePoints";
import { getLevel, getLevelProgress } from "@/lib/afp";

export function PointsHud({ compact = false }: { compact?: boolean }) {
  const { points } = usePoints();
  const level = getLevel(points);
  const { pctToNext, next } = getLevelProgress(points);

  return (
    <Link
      to="/perfil"
      className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-2.5 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur transition active:scale-95 hover:bg-accent/40"
      aria-label={`Tienes ${points} AFP, nivel ${level.name}`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full gradient-warm text-primary-foreground">
        <Sparkles className="h-3 w-3" />
      </span>
      <span className="tabular-nums font-semibold">{points}</span>
      <span className="text-muted-foreground">AFP</span>
      {!compact && (
        <span className="ml-1 hidden items-center gap-1 sm:inline-flex">
          <span aria-hidden>•</span>
          <span>{level.emoji} {level.name}</span>
        </span>
      )}
      {next && (
        <span className="ml-1 hidden h-1 w-10 overflow-hidden rounded-full bg-muted sm:inline-block">
          <span
            className="block h-full gradient-warm transition-all"
            style={{ width: `${pctToNext}%` }}
          />
        </span>
      )}
    </Link>
  );
}
