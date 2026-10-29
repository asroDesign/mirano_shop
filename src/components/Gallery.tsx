"use client";
import styles from "./ProductGallery.module.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image, { type ImageLoaderProps } from "next/image";
import { ChevronLeft, ChevronRight, Play, ZoomIn, ZoomOut, Shirt } from "lucide-react";
import { Modal } from "./Modal";

type Slide = { type: "image" | "video"; id: number };
const ZOOM_LEVELS = [1, 1.5, 2, 3, 4];
const mediaLoader = ({ src, width, quality }: ImageLoaderProps) => `${src}?w=${width}&q=${quality ?? 80}`;

export function Gallery({ ids, alt, videoId, badge, actions, promotionSlotId, editorial = false }: { ids: number[]; alt: string; videoId?: number | null; badge?: string; actions?: ReactNode; editorial?: boolean; promotionSlotId?: string }) {
  const slides: Slide[] = [...ids.map((id) => ({ type: "image" as const, id })), ...(videoId ? [{ type: "video" as const, id: videoId }] : [])];
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [hoverZoom, setHoverZoom] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [zoomLevel, setZoomLevel] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const touchStart = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const current = slides[index];
  const scale = ZOOM_LEVELS[zoomLevel];
  const resetZoom = useCallback(() => { setZoomLevel(0); setPan({ x: 0, y: 0 }); }, []);
  const step = useCallback((direction: number) => {
    setIndex((old) => (old + direction + slides.length) % slides.length);
    resetZoom();
  }, [slides.length, resetZoom]);
  const onMainMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setOrigin({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 });
  };
  const onStageDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (scale === 1) return;
    dragging.current = { x: event.clientX - pan.x, y: event.clientY - pan.y };
  };
  const onStageMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setPan({ x: event.clientX - dragging.current.x, y: event.clientY - dragging.current.y });
  };
  const zoomIn = useCallback(() => setZoomLevel((value) => Math.min(value + 1, ZOOM_LEVELS.length - 1)), []);
  const zoomOut = useCallback(() => setZoomLevel((value) => {
    const next = Math.max(value - 1, 0);
    if (next === 0) setPan({ x: 0, y: 0 });
    return next;
  }), []);

  useEffect(() => {
    if (!zoom) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && slides.length > 1) { event.preventDefault(); step(-1); }
      if (event.key === "ArrowRight" && slides.length > 1) { event.preventDefault(); step(1); }
      if (event.key === "+" || event.key === "=") zoomIn();
      if (event.key === "-") zoomOut();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [zoom, slides.length, step, zoomIn, zoomOut]);

  return (
    <div className={editorial ? styles.gallery : "min-w-0 space-y-3"}>
      <div className={editorial ? `${styles.stage} group relative` : "product-gallery-surface group relative block aspect-square w-full min-w-0 overflow-hidden rounded-[2rem] bg-gradient-to-b from-[#f7eeeb] to-white ring-1 ring-rose-900/10"} onMouseEnter={() => setHoverZoom(true)} onMouseLeave={() => setHoverZoom(false)} onMouseMove={onMainMove}>
        {!current ? <div className="grid h-full place-content-center justify-items-center gap-4 text-slate-400"><Shirt size={64} strokeWidth={1}/><span className="text-sm">تصویر محصول به‌زودی</span></div>
          : current.type === "video" ? <video key={current.id} src={`/api/media/${current.id}`} controls playsInline preload="metadata" className="h-full w-full bg-black object-contain" />
          : <><Image loader={mediaLoader} src={`/api/media/${current.id}`} width={960} height={960} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 36vw" alt={alt} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} className="h-full w-full cursor-zoom-in object-contain p-2 transition duration-200" style={hoverZoom ? { transform: "scale(1.65)", transformOrigin: `${origin.x}% ${origin.y}%` } : undefined} onClick={() => setZoom(true)} />
            <span className="pointer-events-none absolute bottom-3 left-14 rounded-full bg-white/90 px-3 py-2 text-[11px] text-slate-700 opacity-0 shadow transition group-hover:opacity-100">برای دیدن جزئیات، تصویر را بزرگ کنید</span>
            <button type="button" onClick={() => setZoom(true)} className="absolute bottom-3 left-3 rounded-full bg-white/95 p-2 text-slate-700 shadow transition hover:bg-white" aria-label="نمایش گالری تصاویر و بزرگ‌نمایی"><ZoomIn className="size-4" /></button></>}
        {promotionSlotId && <div id={promotionSlotId} className={styles.promotionSlot} />}
        {badge && <span className="absolute right-3 top-3 z-10 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow">{badge}</span>}
        {actions && <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">{actions}</div>}
        {slides.length > 1 && <>
          <button type="button" onClick={() => step(-1)} aria-label="تصویر قبلی" className="absolute right-3 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow transition hover:bg-white"><ChevronRight className="size-5" /></button>
          <button type="button" onClick={() => step(1)} aria-label="تصویر بعدی" className="absolute left-3 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow transition hover:bg-white"><ChevronLeft className="size-5" /></button>
        </>}
        {videoId && current?.type !== "video" && <button type="button" onClick={() => setIndex(slides.length - 1)} className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-bold text-white backdrop-blur"><Play className="size-3.5 fill-white" />پخش ویدیو</button>}
      </div>

      {slides.length > 1 && <div className={editorial ? styles.thumbnails : "flex items-center gap-2 overflow-x-auto pb-1"} aria-label="تصاویر محصول">
        {slides.map((slide, i) => <button key={`${slide.type}-${slide.id}`} type="button" aria-label={slide.type === "video" ? "ویدیوی محصول" : `تصویر ${i + 1}`} aria-current={i === index} onClick={() => setIndex(i)} className={`relative size-16 shrink-0 overflow-hidden rounded-xl ring-2 transition ${i === index ? "ring-rose-500" : "opacity-70 ring-transparent hover:opacity-100"}`}>
          {slide.type === "video" ? <span className="grid h-full w-full place-items-center bg-slate-900 text-white"><Play className="size-6 fill-white" /></span>
            : <Image loader={mediaLoader} src={`/api/media/${slide.id}`} width={320} height={320} sizes="64px" alt={`${alt} ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />}
        </button>)}
        <span className="shrink-0 text-xs text-slate-500">{index + 1} از {slides.length}</span>
      </div>}

      {zoom && current && <Modal title={`${alt} · ${index + 1} از ${slides.length}`} onClose={() => { setZoom(false); resetZoom(); }} fullscreen>
        <div ref={stageRef} className={styles.fullStage}
          onWheel={(event) => { if (current.type !== "image") return; event.deltaY < 0 ? zoomIn() : zoomOut(); }}
          onMouseDown={onStageDown} onMouseMove={onStageMove} onMouseUp={() => { dragging.current = null; }} onMouseLeave={() => { dragging.current = null; }}
          onDoubleClick={() => { if (scale === 1) zoomIn(); else resetZoom(); }}
          onTouchStart={(event) => { const touch = event.touches[0]; touchStart.current = touch?.clientX ?? null; if (scale > 1 && touch) dragging.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y }; }}
          onTouchMove={(event) => { const touch = event.touches[0]; if (scale > 1 && dragging.current && touch) setPan({ x: touch.clientX - dragging.current.x, y: touch.clientY - dragging.current.y }); }}
          onTouchEnd={(event) => { const end = event.changedTouches[0]?.clientX; if (scale === 1 && slides.length > 1 && touchStart.current !== null && end !== undefined && Math.abs(end - touchStart.current) > 45) step(end < touchStart.current ? 1 : -1); touchStart.current = null; dragging.current = null; }}>
          {current.type === "image" ? <Image loader={mediaLoader} src={`/api/media/${current.id}`} width={1600} height={1200} sizes="100vw" alt={`${alt}، تصویر ${index + 1}`} draggable={false} className={styles.fullImage} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, cursor: scale > 1 ? "grab" : "zoom-in" }} /> : <video src={`/api/media/${current.id}`} controls playsInline autoPlay className={styles.fullImage} />}
        </div>
        {slides.length > 1 && <div className={styles.fullNavigation}><button type="button" onClick={() => step(-1)} aria-label="تصویر قبلی"><ChevronRight size={24}/></button><button type="button" onClick={() => step(1)} aria-label="تصویر بعدی"><ChevronLeft size={24}/></button></div>}
        <div className={styles.fullControls}>
          <span>{(index + 1).toLocaleString("fa-IR")} / {slides.length.toLocaleString("fa-IR")}</span>
          {current.type === "image" && <>
            <button type="button" onClick={zoomOut} disabled={zoomLevel === 0} aria-label="کوچک‌نمایی"><ZoomOut size={20}/></button>
            <span aria-live="polite">{scale.toLocaleString("fa-IR")}×</span>
            <button type="button" onClick={zoomIn} disabled={zoomLevel === ZOOM_LEVELS.length - 1} aria-label="بزرگ‌نمایی"><ZoomIn size={20}/></button>
            <button type="button" onClick={resetZoom}>بازنشانی</button>
          </>}
        </div>
      </Modal>}
    </div>
  );
}
