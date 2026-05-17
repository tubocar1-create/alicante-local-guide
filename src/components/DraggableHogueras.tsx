import { useRef, useState, useEffect } from "react";
import hoguerasIcon from "@/assets/hogueras-alicante.png";

type Props = { onOpen: () => void };

// Round, draggable "Hogueras" icon. Positioned absolutely within its
// parent (the cover-image wrapper). Persists position in localStorage.
export function DraggableHogueras({ onOpen }: Props) {
  const SIZE = 64;
  const STORAGE_KEY = "hogueras-icon-pos";
  const ref = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === "number" && typeof p?.y === "number") {
          setPos(p);
          return;
        }
      }
    } catch {}
    // Default: top-right area near the castle.
    const parent = ref.current?.parentElement;
    if (parent) {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      setPos({ x: Math.max(0, w - SIZE - 8), y: Math.max(0, h * 0.12) });
    } else {
      setPos({ x: 240, y: 30 });
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!ref.current || !pos) return;
    ref.current.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || !ref.current) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
    if (!d.moved) return;
    const parent = ref.current.parentElement;
    const maxX = parent ? parent.clientWidth - SIZE : Infinity;
    const maxY = parent ? parent.clientHeight - SIZE : Infinity;
    const nx = Math.min(Math.max(0, d.origX + dx), Math.max(0, maxX));
    const ny = Math.min(Math.max(0, d.origY + dy), Math.max(0, maxY));
    setPos({ x: nx, y: ny });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (ref.current?.hasPointerCapture(e.pointerId)) {
      ref.current.releasePointerCapture(e.pointerId);
    }
    if (d && !d.moved) {
      onOpen();
    } else if (pos) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {}
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-label="Hogueras de Alicante"
      title="Hogueras de Alicante"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        left: pos?.x ?? 0,
        top: pos?.y ?? 0,
        width: SIZE,
        height: SIZE,
        visibility: pos ? "visible" : "hidden",
        touchAction: "none",
      }}
      className="absolute z-20 rounded-full overflow-hidden shadow-[0_6px_20px_-4px_rgba(234,88,12,0.7)] ring-2 ring-amber-300/80 transition active:scale-95 cursor-grab active:cursor-grabbing"
    >
      <img
        src={hoguerasIcon}
        alt=""
        draggable={false}
        className="h-full w-full object-cover select-none pointer-events-none"
      />
    </button>
  );
}
