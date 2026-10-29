import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SitePageRenderer, type SitePageData } from "@/components/SitePageRenderer";
import { getPublishedSitePage } from "@/lib/public-content-cache";
import { getSettings } from "@/lib/settings";
import { seoMetadata } from "@/lib/seo";

const fallback: SitePageData = {
  title: "شرایط استفاده", slug: "terms", template: "editorial", summary: "شرایط ثبت سفارش، پرداخت، ارسال و استفاده از خدمات فروشگاه", metaTitle: null, metaDescription: null, status: "published",
  blocks: [
    { type: "hero", title: "شرایط استفاده از وب‌سایت", body: "این صفحه شیوه استفاده از خدمات فروشگاه، ثبت و پیگیری سفارش را توضیح می‌دهد.", options: { badge: "راهنمای مشتریان" } },
    { type: "text", title: "ثبت سفارش و قیمت", body: "قیمت و گزینه‌های هر محصول پیش از افزودن به سبد نمایش داده می‌شود. مبلغ نهایی، تخفیف‌ها و هزینه ارسال پیش از تأیید سفارش در سبد خرید قابل مشاهده است. سفارش پس از تأیید پرداخت یا ثبت روش پرداخت مورد قبول فروشگاه نهایی می‌شود." },
    { type: "text", title: "ارسال و تحویل", body: "روش ارسال و هزینه آن بر اساس شرکت انتخاب‌شده و نشانی تحویل محاسبه می‌شود. جزئیات سیاست ارسال در صفحه راهنمای ارسال و تحویل آمده است." },
    { type: "text", title: "حساب کاربری و اطلاعات مشتری", body: "مشتری مسئول واردکردن اطلاعات دقیق تماس و نشانی است. این اطلاعات برای پردازش سفارش، ارسال کالا و پشتیبانی استفاده می‌شوند." },
    { type: "text", title: "پشتیبانی و مرجوعی", body: "پیگیری سفارش و ثبت درخواست مرجوعی از پنل کاربری انجام می‌شود. درخواست‌ها مطابق وضعیت سفارش و ضوابط اعلام‌شده توسط فروشگاه بررسی خواهند شد." },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([getPublishedSitePage("terms"), getSettings()]);
  return seoMetadata(settings, { title: page?.metaTitle || page?.title || fallback.title, description: page?.metaDescription || page?.summary || settings.homeSeoDescription, path: "/terms-conditions" });
}

export default async function TermsConditionsPage() {
  const [page, settings] = await Promise.all([getPublishedSitePage("terms"), getSettings()]);
  return <SitePageRenderer page={(page ?? fallback) as SitePageData} settings={settings} />;
}
