"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Eye } from "lucide-react";

const QuickViewModal = dynamic(() => import("./QuickViewModal"), { ssr: false });

export function QuickViewButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-white/95 py-2 text-xs font-bold text-emerald-800 shadow-lg ring-1 ring-emerald-900/10 backdrop-blur transition hover:bg-emerald-600 hover:text-white"><Eye className="h-4 w-4" />نمایش سریع</button>
      {open && <QuickViewModal id={id} onClose={() => setOpen(false)} />}
    </>
  );
}
