"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { api, toast } from "./client";

type AlertKind = "restock" | "price_drop";

function faNum(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

export function ProductAlertAction({ productId, kind, disabled = false }: { productId: number; kind: AlertKind; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isRestock = kind === "restock";
  const label = isRestock ? "اطلاع موجودی" : "اطلاع تخفیف";

  const notify = async () => {
    setBusy(true);
    try {
      const result = await api<{ queued: number; subscribed: number }>(`/api/admin/products/${productId}/notify`, "POST", { kind });
      if (!result.subscribed) {
        toast(isRestock ? "مشتری‌ای برای اعلان موجودی این محصول ثبت‌نام نکرده است" : "مشتری‌ای برای اعلان تخفیف این محصول ثبت‌نام نکرده است", false);
      } else {
        toast(`پیامک ${isRestock ? "موجودی" : "تخفیف"} برای ${faNum(result.queued)} اشتراک در صف ارسال قرار گرفت`);
        router.refresh();
      }
    } catch (error) {
      toast((error as Error).message, false);
    } finally {
      setBusy(false);
    }
  };

  return <button type="button" disabled={busy || disabled} title={disabled ? (isRestock ? "برای ارسال اعلان، محصول باید موجود باشد" : "ابتدا قیمت را با قیمت قبل از تخفیف مقایسه کنید") : label} onClick={() => void notify()} className={`${isRestock ? "text-amber-700 hover:bg-amber-50" : "text-pink-700 hover:bg-pink-50"} btn-sm disabled:cursor-not-allowed disabled:opacity-40`}>
    {busy && <LoaderCircle className="size-3.5 animate-spin" />}{label}
  </button>;
}
