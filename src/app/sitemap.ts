import type { MetadataRoute } from "next";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogTags, brands, categories, contentPages, products } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { siteBase } from "@/lib/seo";
import { slugify } from "@/lib/util";
import { getPublishedBlogIndex } from "@/lib/public-content-cache";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [s, productRows, categoryRows, postRows, pageRows, brandRows] = await Promise.all([
    getSettings(),
    db.select({ slug: products.slug, updatedAt: products.updatedAt }).from(products).where(and(sql`${products.status} in ('active','out_of_stock')`, isNull(products.deletedAt))),
    db.select({ id: categories.id, canonicalUrl: categories.canonicalUrl }).from(categories),
    getPublishedBlogIndex().then(({ posts }) => posts.map(({ slug, tags, updatedAt, canonicalUrl }) => ({ slug, tags, updatedAt, canonicalUrl }))),
    db.select({ slug: contentPages.slug, updatedAt: contentPages.updatedAt }).from(contentPages).where(and(eq(contentPages.status, "published"), isNull(contentPages.deletedAt))),
    db.select({ slug: brands.slug, updatedAt: brands.updatedAt, canonicalUrl: brands.canonicalUrl }).from(brands).where(and(eq(brands.isActive, true), isNull(brands.deletedAt))),
  ]);
  const usedTagNames = Array.from(new Set(postRows.flatMap((post) => post.tags)));
  const savedTagRows = usedTagNames.length ? await db.select({ name: blogTags.name, slug: blogTags.slug, canonicalUrl: blogTags.canonicalUrl, updatedAt: blogTags.updatedAt }).from(blogTags).where(inArray(blogTags.name, usedTagNames)) : [];
  const savedTagNames = new Set(savedTagRows.map((tag) => tag.name));
  const fallbackTagRows = usedTagNames.filter((name) => !savedTagNames.has(name)).map((name) => ({
    name, slug: slugify(name), canonicalUrl: null,
    updatedAt: postRows.filter((post) => post.tags.includes(name)).reduce<Date | null>((latest, post) => !latest || post.updatedAt > latest ? post.updatedAt : latest, null) ?? new Date(),
  }));
  const tagRows = [...savedTagRows, ...fallbackTagRows];
  const base = siteBase(s.siteUrl, undefined, true);
  const item = (path: string, changeFrequency: "daily" | "weekly" | "monthly", priority: number, lastModified?: Date) => ({ url: new URL(path, base).toString(), changeFrequency, priority, ...(lastModified ? { lastModified } : {}) });
  const canonicalPath = (raw: string | null, fallback: string) => {
    if (!raw?.trim()) return fallback;
    try { const url = new URL(raw, base); return url.origin === base.origin ? `${url.pathname}${url.search}` : null; } catch { return null; }
  };
  const entries = [
    item("/", "daily", 1), item("/shop", "daily", 0.95), item("/blog", "daily", 0.85), item("/brands", "weekly", 0.75), item("/categories", "weekly", 0.8), item("/about", "monthly", 0.5), item("/contact", "monthly", 0.4), item("/faq", "monthly", 0.4), item("/shipping-delivery", "monthly", 0.5), item("/terms-conditions", "monthly", 0.4),
    ...categoryRows.flatMap((c) => { const path = canonicalPath(c.canonicalUrl, `/shop?cat=${c.id}`); return path ? [item(path, "weekly", 0.8)] : []; }),
    ...productRows.map((p) => item(`/products/${p.slug}`, "weekly", 0.85, p.updatedAt)),
    ...postRows.flatMap((p) => { const path = canonicalPath(p.canonicalUrl, `/blog/${p.slug}`); return path ? [item(path, "weekly", 0.75, p.updatedAt)] : []; }),
    ...tagRows.flatMap((tag) => { const path = canonicalPath(tag.canonicalUrl, `/blog/tag/${tag.slug}`); return path ? [item(path, "weekly", 0.6, tag.updatedAt)] : []; }),
    ...brandRows.flatMap((b) => { const path = canonicalPath(b.canonicalUrl, `/brands/${b.slug}`); return path ? [item(path, "weekly", 0.7, b.updatedAt)] : []; }),
    ...pageRows.filter((p) => !["about", "contact", "terms", "shipping-delivery", "terms-conditions"].includes(p.slug)).map((p) => item(`/pages/${p.slug}`, "monthly", 0.55, p.updatedAt)),
  ];
  return [...new Map(entries.map((entry) => [entry.url, entry])).values()];
}
