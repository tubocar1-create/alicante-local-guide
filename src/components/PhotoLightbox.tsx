import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

type Props = {
  photos: string[];
  index: number;
  alt?: string;
  onClose: () => void;
  onIndexChange: (i: number) => void;
};

export default function PhotoLightbox({
  photos,
  index,
  alt = "Foto",
  onClose,
  onIndexChange,
}: Props) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    setZoomed(false);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndexChange((index + 1) % photos.length);
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, photos.length, onClose, onIndexChange]);

  if (photos.length === 0) return null;
  const src = photos[index];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-3 text-white">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium tabular-nums backdrop-blur">
          {index + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomed((z) => !z);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
            aria-label={zoomed ? "Reducir" : "Ampliar"}
          >
            {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div
        className={`relative max-h-[88vh] max-w-[94vw] ${zoomed ? "overflow-auto" : "overflow-hidden"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          onClick={() => setZoomed((z) => !z)}
          className={`block select-none transition-transform duration-300 ease-out ${
            zoomed
              ? "max-w-none cursor-zoom-out scale-[2] origin-center"
              : "max-h-[88vh] max-w-[94vw] cursor-zoom-in object-contain"
          }`}
          draggable={false}
        />
      </div>

      {/* Nav arrows */}
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((index - 1 + photos.length) % photos.length);
            }}
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((index + 1) % photos.length);
            }}
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div
          className="absolute bottom-3 left-1/2 flex max-w-[94vw] -translate-x-1/2 gap-1.5 overflow-x-auto rounded-full bg-white/5 p-1.5 backdrop-blur"
          onClick={(e) => e.stopPropagation()}
        >
          {photos.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => onIndexChange(i)}
              className={`h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 transition-all ${
                i === index ? "border-white scale-110" : "border-transparent opacity-60"
              }`}
              aria-label={`Ir a foto ${i + 1}`}
            >
              <img src={p} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
