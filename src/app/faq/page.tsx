import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSettings } from "@/lib/settings";
import { siteBrandText } from "@/lib/brand";

export const metadata = { title: "سؤالات متداول" };
const FAQ: [string, string][] = [
  ["چطور محصول مناسب را انتخاب کنم؟", "مشخصات و توضیحات هر کالا را در صفحهٔ محصول ببینید. برای انتخاب قالب، ابزار یا مواد اولیهٔ مناسب، پیش از سفارش با پشتیبانی تماس بگیرید."],
  ["تنوع یا اندازهٔ بسته‌بندی را از کجا ببینم؟", "اگر محصول چند تنوع یا اندازهٔ بسته‌بندی داشته باشد، گزینه‌های قابل سفارش و قیمت هرکدام در صفحهٔ محصول نمایش داده می‌شود."],
  ["اگر محصول موردنظرم موجود نباشد چه کنم؟", "در صورت فعال بودن گزینهٔ اطلاع‌رسانی، برای همان محصول درخواست ثبت کنید تا هنگام تغییر موجودی باخبر شوید."],
  ["هزینهٔ ارسال چطور محاسبه می‌شود؟", "نشانی و روش ارسال را در سبد خرید انتخاب کنید؛ هزینه بر اساس تعرفهٔ شرکت حمل و مقصد محاسبه می‌شود و پیش از ثبت سفارش نمایش داده خواهد شد."],
  ["چطور سفارش خود را پیگیری کنم؟", "پس از ورود به حساب کاربری، از بخش سفارش‌های من وضعیت سفارش و اطلاعات مرسوله را ببینید."],
  ["آیا می‌توانم بعد از ثبت سفارش آن را تغییر دهم؟", "برای بررسی امکان تغییر، هرچه زودتر شمارهٔ سفارش را از طریق پشتیبانی برای ما بفرستید. انجام تغییر به وضعیت آماده‌سازی سفارش بستگی دارد."],
  ["شرایط بازگشت کالا را از کجا ببینم؟", "مهلت و شرایط بازگشت در صفحهٔ شرایط استفاده درج شده است. لطفاً پیش از ثبت درخواست، همان صفحه و جزئیات سفارش را بررسی کنید."],
];

export default async function Faq() {
  const settings = await getSettings();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <h1 className="text-2xl font-black">سؤالات متداول</h1>
        {FAQ.map(([q, a]) => <details key={q} className="group rounded-2xl border bg-white p-5 open:shadow-sm"><summary className="cursor-pointer list-none font-bold marker:hidden">{q}<span className="float-left text-emerald-600 group-open:rotate-45">+</span></summary><p className="mt-3 text-sm leading-8 text-slate-600">{siteBrandText(a, settings.siteName)}</p></details>)}
        <p className="text-sm text-slate-500">پاسخ خود را پیدا نکردید؟ <Link className="text-emerald-700" href="/customer/tickets">تیکت ثبت کنید</Link>.</p>
      </main>
      <SiteFooter />
    </>
  );
}
