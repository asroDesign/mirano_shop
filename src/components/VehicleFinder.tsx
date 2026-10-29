"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Shirt } from "lucide-react";

/** Boutique finder reuses the product's existing suitability tags for style and occasion filters. */
export function VehicleFinder({ makes }: { makes: { make: string; models: string[] }[] }) {
  const router = useRouter();
  const [style, setStyle] = useState("");
  const [q, setQ] = useState("");
  const quick = ["روزمره", "مهمانی", "رسمی", "چهارفصل", "استایل مینیمال"];
  return (
    <div className="rounded-[2rem] border border-white/40 bg-white/90 p-6 text-slate-800 shadow-2xl shadow-emerald-900/20 backdrop-blur-xl">
      <div className="mb-5 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-rose-300 to-rose-600 text-white shadow-lg"><Shirt className="h-6 w-6" /></span><div><b className="text-lg">پیدا کردن استایل دلخواه</b><div className="text-xs text-slate-500">جست‌وجو بر اساس نام لباس یا موقعیت استفاده</div></div></div>
      <form onSubmit={(e) => { e.preventDefault(); router.push(`/shop?${new URLSearchParams({ ...(q ? { q } : {}), ...(style ? { make: style } : {}) })}`); }} className="space-y-3">
        <div className="relative"><Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام لباس، برند یا دسته‌بندی…" className="input !h-12 !rounded-2xl !pr-10" /></div>
        <select value={style} onChange={(e) => setStyle(e.target.value)} className="input !h-12 !rounded-2xl"><option value="">همهٔ موقعیت‌ها</option>{makes.map((m) => <option key={m.make}>{m.make}</option>)}</select>
        <button className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-rose-700 to-rose-800 font-bold text-white shadow-lg shadow-rose-700/20 transition hover:from-rose-800 hover:to-rose-900"><Search className="h-4 w-4" />جست‌وجوی لباس</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-1.5">{quick.map((t) => <button key={t} type="button" onClick={() => router.push(`/shop?make=${encodeURIComponent(t)}`)} className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-100">{t}</button>)}</div>
    </div>
  );
}
