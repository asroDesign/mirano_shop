import type { Metadata } from "next";
import { SitePageRenderer, type SitePageData } from "@/components/SitePageRenderer";
import { getPublishedSitePage } from "@/lib/public-content-cache";
import { getSettings } from "@/lib/settings";
import { seoMetadata } from "@/lib/seo";
import { DEFAULT_PRODUCT_SHIPPING_INFO } from "@/lib/shipping-policy";

const fallback: SitePageData = {
  title: "راهنمای ارسال و تحویل", slug: "shipping-delivery", template: "editorial", summary: "روش‌ها، هزینه‌ها و پیگیری ارسال سفارش‌های میرانو", metaTitle: null, metaDescription: null, status: "published",
  blocks: [
    { type: "hero", title: "ارسال و تحویل سفارش", body: "روش ارسال را در سبد خرید، متناسب با نشانی خود انتخاب کنید. مبلغ و شرایط نهایی پیش از ثبت سفارش نمایش داده می‌شود.", options: { badge: "راهنمای خرید" } },
    { type: "text", title: "هزینه ارسال", body: DEFAULT_PRODUCT_SHIPPING_INFO },
    { type: "text", title: "انتخاب شرکت پستی", body: "روش ارسال و شرکت حمل را در سبد خرید انتخاب کنید. هزینهٔ نهایی با توجه به تعرفهٔ شرکت، وزن مرسوله و نشانی مقصد محاسبه می‌شود؛ روش ارسال بدون انتخاب مشتری ثبت نمی‌شود." },
    { type: "text", title: "پس‌کرایه", body: "اگر شرکت انتخاب‌شده امکان ارسال پس‌کرایه داشته باشد، هزینه حمل در مبلغ پرداختی فروشگاه صفر منظور می‌شود و هزینه ارسال را هنگام تحویل به شرکت پستی می‌پردازید." },
    { type: "text", title: "پیگیری مرسوله", body: "پس از ثبت کد رهگیری، اطلاعات مرسوله در جزئیات سفارش و بخش پیگیری سفارش‌های حساب کاربری در دسترس خواهد بود." },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([getPublishedSitePage("shipping-delivery"), getSettings()]);
  return seoMetadata(settings, { title: page?.metaTitle || page?.title || fallback.title, description: page?.metaDescription || page?.summary || settings.homeSeoDescription, path: "/shipping-delivery" });
}

export default async function ShippingDeliveryPage() {
  const [page, settings] = await Promise.all([getPublishedSitePage("shipping-delivery"), getSettings()]);
  const shippingPage = page ?? {
    ...fallback,
    blocks: fallback.blocks.map((block) => block.type === "text" && block.title === "هزینه ارسال" ? { ...block, body: settings.productShippingInfo } : block),
  };
  return <SitePageRenderer page={shippingPage as SitePageData} settings={settings} />;
}
