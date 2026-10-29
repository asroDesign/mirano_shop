import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { contentPages } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { SitePageRenderer, type SitePageData } from "@/components/SitePageRenderer";
import { seoMetadata } from "@/lib/seo";

const fallback: SitePageData = {
  title: "تماس با ما", slug: "contact", template: "contact", summary: "راه‌های ارتباط با پشتیبانی", metaTitle: null, metaDescription: null, status: "published",
  blocks: [
    { type: "hero", title: "تماس با میرانو", body: "برای پرسش دربارهٔ ابزار قنادی، مواد اولیه، موجودی یا پیگیری سفارش با پشتیبانی میرانو در تماس باشید." },
    { type: "cta", title: "راهنمای خرید", body: "پاسخ پرسش‌های رایج دربارهٔ ثبت سفارش، پرداخت و ارسال را در راهنمای خرید ببینید.", buttonLabel: "مشاهده سؤالات متداول", href: "/faq" },
  ],
};

export async function generateMetadata() {
  const [page] = await db.select().from(contentPages).where(and(eq(contentPages.slug, "contact"), eq(contentPages.status, "published"), isNull(contentPages.deletedAt)));
  const settings = await getSettings();
  return seoMetadata(settings, { title: page?.metaTitle || page?.title || fallback.title, description: page?.metaDescription || page?.summary || settings.homeSeoDescription, path: "/contact" });
}

export default async function Contact() {
  const [row] = await db.select().from(contentPages).where(and(eq(contentPages.slug, "contact"), eq(contentPages.status, "published"), isNull(contentPages.deletedAt)));
  const settings = await getSettings();
  return <SitePageRenderer page={(row ?? fallback) as SitePageData} settings={settings} />;
}
