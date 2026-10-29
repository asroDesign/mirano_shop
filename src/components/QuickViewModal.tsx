"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, CakeSlice, Loader2, X } from "lucide-react";
import { BuyBox, type OfferView, type VariantView } from "./BuyBox";
import { Gallery } from "./Gallery";
import { Stars } from "./Community";

type Data = {
  product: {
    id: number; slug: string; nameFa: string; nameEn: string | null; sku: string; partNumber: string; brand: string; country: string | null; authenticity: string; category: string | null;
    shortDesc: string | null; specs: { k: string; v: string }[]; basePrice: number; source: string; available: number; status: string; allowBackorder: boolean; inquiryOnly: boolean; options: { name: string; values: string[] }[];
    purchaseOptions: { name: string; type: "text" | "select" | "checkbox" | "radio"; required: boolean; values: { label: string; price: number; priceType: "fixed" | "percent" }[] }[]; videoMediaId: number | null; compareAtPrice: number;
  };
  festival: { title: string; pct: number; color: string; endsAt: string } | null;
  images: number[]; variants: VariantView[]; offers: OfferView[];
  rating: { avg: number; n: number }; store: { multiVendor: boolean; siteName: string; returnDays: number; prepDays: number; shippingInfo: string; warrantyText: string };
};
const fa = (n: number) => n.toLocaleString("fa-IR");

export default function QuickViewModal({ id, onClose }: { id: number; onClose: () => void }) {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const controller = new AbortController();
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    fetch(`/api/products/${id}/quick`, { signal: controller.signal })
      .then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error); setData(json); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setErr(error instanceof Error ? error.message : "خطا در دریافت اطلاعات"); });
    return () => { controller.abort(); document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKey); };
  }, [id, onClose]);
  if (!mounted) return null;
  const p = data?.product;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto overscroll-contain bg-emerald-950/60 p-2 backdrop-blur-sm sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} dir="rtl">
      <div className="qv-in relative mx-auto my-1 w-full max-w-5xl max-h-[calc(100dvh-0.5rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl bg-[#faf7ef] shadow-2xl ring-1 ring-emerald-900/10 sm:my-2 sm:max-h-[calc(100dvh-1rem)] sm:rounded-[2rem]" role="dialog" aria-modal="true" aria-label={p ? `نمایش سریع ${p.nameFa}` : "نمایش سریع محصول"}>
        <button onClick={onClose} aria-label="بستن" className="fixed left-4 top-4 z-[95] grid size-10 place-items-center rounded-full bg-white text-slate-500 shadow ring-1 ring-emerald-900/10 transition hover:rotate-90 hover:text-emerald-700 sm:left-8 sm:top-8"><X className="size-5" /></button>
        {!data || !p ? (
          <div className="grid min-h-[68dvh] place-items-center">{err ? <div role="alert" className="px-6 text-center text-sm text-rose-600">{err}</div> : <Loader2 className="size-9 animate-spin text-emerald-600" />}</div>
        ) : (
          <div className="grid gap-4 p-3 pt-14 sm:gap-6 sm:p-6 sm:pt-16 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
            <div className="mx-auto w-full max-w-[440px] md:max-w-none"><Gallery ids={data.images} alt={p.nameFa} videoId={p.videoMediaId} /></div>
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {p.category && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-800 ring-1 ring-amber-200">{p.category}</span>}
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-900 ring-1 ring-amber-200"><CakeSlice size={13} aria-hidden="true" />{p.brand}</span>
              </div>
              <h2 className="text-lg font-black leading-8 text-emerald-950 sm:text-xl sm:leading-9">{p.nameFa}</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs"><Stars value={data.rating.avg} size={14} /><span className="text-slate-500">{data.rating.n ? `${fa(data.rating.avg)} از ${fa(data.rating.n)} دیدگاه` : "بدون دیدگاه"}</span></div>
              {p.shortDesc && <p className="text-sm leading-7 text-slate-600">{p.shortDesc.replace(/<[^>]+>/g, " ").slice(0, 260)}</p>}
              {p.specs.length > 0 && <ul className="space-y-1 text-xs">{p.specs.slice(0, 4).map((spec) => <li key={spec.k} className="flex justify-between gap-3 border-b border-dashed border-emerald-900/10 py-1"><span className="text-slate-500">{spec.k}</span><b className="text-left text-slate-700">{spec.v}</b></li>)}</ul>}
              <Link href={`/products/${p.slug}`} onClick={onClose} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 transition-all hover:gap-2">مشاهده جزئیات کامل، دیدگاه‌ها و پرسش‌ها<ArrowLeft className="size-4" /></Link>
            </div>
            <div className="min-w-0 md:col-span-2 lg:col-span-1">
              <BuyBox compact onAdded={onClose} product={{ id: p.id, nameFa: p.nameFa, basePrice: p.basePrice, source: p.source, available: p.available, active: p.status === "active" || (p.status === "out_of_stock" && p.allowBackorder), allowBackorder: p.allowBackorder, inquiryOnly: p.inquiryOnly, partNumber: p.partNumber }}
                options={p.options} purchaseOptions={p.purchaseOptions ?? []} variants={data.variants} offers={data.offers} festival={data.festival} compareAt={p.compareAtPrice}
                multiVendor={data.store.multiVendor} siteName={data.store.siteName} returnDays={data.store.returnDays} prepDays={data.store.prepDays} shippingInfo={data.store.shippingInfo} warrantyText={data.store.warrantyText} />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
