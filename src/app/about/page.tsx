import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { contentPages } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { SitePageRenderer, type SitePageData } from "@/components/SitePageRenderer";
import { seoMetadata } from "@/lib/seo";

const fallback: SitePageData = {
  title: "درباره ما", slug: "about", template: "nature", summary: null, metaTitle: null, metaDescription: null, status: "published",
  blocks: [
    { type: "hero", title: "درباره میرانو", body: "میرانو فروشگاه تخصصی لوازم قنادی و شیرینی‌پزی است؛ از ابزار و قالب‌های پخت تا مواد اولیه، تزئین و بسته‌بندی." },
    { type: "features", title: "همراه شما در شیرینی‌پزی", items: [
      { title: "ابزار تخصصی", body: "قالب، ماسوره، نازل و ابزارهای کاربردی قنادی." },
      { title: "مواد اولیه", body: "مواد موردنیاز برای پخت و تزئین انواع کیک و شیرینی." },
      { title: "بسته‌بندی", body: "جعبه و لوازم ارائهٔ شیرینی برای خانه و کسب‌وکار." },
      { title: "راهنمای خرید", body: "برای انتخاب محصول مناسب با پشتیبانی میرانو در ارتباط باشید." },
    ] },
  ],
};

export async function generateMetadata() {
  const [page] = await db.select().from(contentPages).where(and(eq(contentPages.slug, "about"), eq(contentPages.status, "published"), isNull(contentPages.deletedAt)));
  const settings = await getSettings();
  return seoMetadata(settings, { title: page?.metaTitle || page?.title || fallback.title, description: page?.metaDescription || page?.summary || settings.homeSeoDescription, path: "/about" });
}

export default async function About() {
  const [row] = await db.select().from(contentPages).where(and(eq(contentPages.slug, "about"), eq(contentPages.status, "published"), isNull(contentPages.deletedAt)));
  const settings = await getSettings();
  return <SitePageRenderer page={(row ?? fallback) as SitePageData} settings={settings} />;
}
