import styles from "./ProductDetail.module.css";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { cache } from "react";
import { Suspense } from "react";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { FileText, Microscope, ListChecks, MessageSquareText, MessageCircleQuestion, Store, Leaf, Star, Plus, Minus, CheckCircle2, Ruler, Sparkles } from "lucide-react";
import Image from "next/image";
import { db } from "@/db";
import { brands, categories, productAnswers, productImages, productQuestions, products, productVariants, reviews, sellerOffers, sellers, users } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { activeFestivals, activeVariantDiscounts, festivalFor, safeDiscountPercent } from "@/lib/marketing";
import { applicableQuantityTier, quantityTierPrice } from "@/lib/quantity-pricing";
import { getSmartProductRecommendations, listShopProducts } from "@/lib/queries";
import { stripHtml, toSafeHtml } from "@/lib/html";
import { RichContent } from "@/components/RichContent";
import { faNum, jdate, toman } from "@/lib/util";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BuyBox } from "@/components/BuyBox";
import { Gallery } from "@/components/Gallery";
import { ProductViewTracker } from "@/components/ProductViewTracker";
import { ProductPriceHistory } from "@/components/ProductPriceHistory";
import { FavoriteButton } from "@/components/CustomerSelfService";
import { ProductCompareButton } from "@/components/ProductCompareButton";
import { ProductAlerts } from "@/components/ProductAlerts";
import { ProductCard } from "@/components/ProductCard";
import { AnswerForm, QuestionForm, ReviewForm, ReviewImages, RoleBadge, Stars, VoteButtons } from "@/components/Community";
import { seoMetadata, siteBase } from "@/lib/seo";

const load = cache(async (slug: string) => {
  const [row] = await db.select({ p: products, cat: categories }).from(products).leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, decodeURIComponent(slug)), inArray(products.status, ["active", "out_of_stock"])));
  return row;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const row = await load((await params).slug);
  if (!row) return { title: "محصول یافت نشد" };
  const settings = await getSettings();
  return seoMetadata(settings, { title: row.p.seoTitle || row.p.nameFa, description: row.p.metaDesc || stripHtml(row.p.shortDesc) || settings.homeSeoDescription, keywords: row.p.seoKeywords ?? [], path: `/products/${row.p.slug}`, imageId: row.p.seoImageId || row.p.mainImageId });
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ variant?: string }> }) {
  const row = await load((await params).slug);
  if (!row) notFound();
  const p = row.p;
  const queryVariant = (await searchParams).variant ?? "";
  const initialVariantId = /^\d+$/.test(queryVariant) && Number(queryVariant) > 0 ? Number(queryVariant) : undefined;
  const u = await getUser();
  const recommendationIds = [...new Set([...(p.relatedProductIds ?? []), ...(p.crossSellProductIds ?? [])])];
  const [imgs, variants, offers, fests, related, s, revs, qs, brandPage] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, p.id)).orderBy(productImages.sortOrder),
    db.select().from(productVariants).where(and(eq(productVariants.productId, p.id), eq(productVariants.isActive, true), isNull(productVariants.deletedAt))),
    db.select({ o: sellerOffers, s: sellers }).from(sellerOffers).innerJoin(sellers, eq(sellers.id, sellerOffers.sellerId))
      .where(and(eq(sellerOffers.productId, p.id), eq(sellerOffers.status, "approved"), eq(sellers.status, "approved"), eq(sellers.restricted, false))),
    activeFestivals(),
    listShopProducts(recommendationIds.length ? { ids: recommendationIds } : {}, recommendationIds.length || 6),
    getSettings(),
    db.select({ r: reviews, name: users.name }).from(reviews).innerJoin(users, eq(users.id, reviews.userId))
      .where(and(eq(reviews.productId, p.id), u ? or(eq(reviews.status, "approved"), eq(reviews.userId, u.id)) : eq(reviews.status, "approved"))).orderBy(desc(reviews.helpful), desc(reviews.createdAt)),
    db.select({ q: productQuestions, name: users.name }).from(productQuestions).innerJoin(users, eq(users.id, productQuestions.userId))
      .where(and(eq(productQuestions.productId, p.id), u ? or(eq(productQuestions.status, "approved"), eq(productQuestions.userId, u.id)) : eq(productQuestions.status, "approved"))).orderBy(desc(productQuestions.createdAt)),
    db.select({ slug: brands.slug }).from(brands).where(and(eq(brands.isActive, true), sql`lower(regexp_replace(btrim(${brands.name}), '\\s+', ' ', 'g')) = lower(regexp_replace(btrim(${p.brand}), '\\s+', ' ', 'g'))`)).limit(1).then((r) => r[0]),
  ]);
  const answers = qs.length ? await db.select({ a: productAnswers, name: users.name }).from(productAnswers).innerJoin(users, eq(users.id, productAnswers.userId))
    .where(and(inArray(productAnswers.questionId, qs.map((x) => x.q.id)), u ? or(eq(productAnswers.status, "approved"), eq(productAnswers.userId, u.id)) : eq(productAnswers.status, "approved"))).orderBy(productAnswers.createdAt) : [];
  const mv = !!s.multiVendor;
  const fest = festivalFor(fests, p.id, p.categoryId);
  const scheduledDiscounts = await activeVariantDiscounts(db, variants.map((v) => v.id));
  const variantPromotions = Object.fromEntries(variants.map((variant) => {
    const scheduled = p.source === "central" ? scheduledDiscounts.get(variant.id) : undefined;
    const useScheduled = !!scheduled && scheduled.discountPercent >= (fest?.discountPercent ?? 0);
    const requestedPct = useScheduled ? scheduled!.discountPercent : fest?.discountPercent ?? 0;
    const price = Number(variant.price ?? p.basePrice), cost = Number(variant.costPrice ?? p.avgCost);
    const safePct = p.source === "central" ? Math.min(safeDiscountPercent(price, cost, requestedPct), ...(variant.quantityPriceTiers ?? []).map((tier) => safeDiscountPercent(quantityTierPrice(price, tier), cost, requestedPct))) : requestedPct;
    return [variant.id, requestedPct > 0 ? { title: useScheduled ? scheduled!.title : fest!.title, pct: safePct, endsAt: (useScheduled ? scheduled!.endsAt : fest!.endsAt).toISOString(), kind: useScheduled ? "variant" : "festival" } : null];
  }).filter((entry) => entry[1] !== null));
  const baseFestivalPct = fest ? (p.source === "central" ? Math.min(safeDiscountPercent(p.basePrice, p.avgCost, fest.discountPercent), ...(p.quantityPriceTiers ?? []).map((tier) => safeDiscountPercent(quantityTierPrice(p.basePrice, tier), p.avgCost, fest.discountPercent))) : fest.discountPercent) : 0;
  const baseFestival = fest && baseFestivalPct > 0 ? { title: fest.title, pct: baseFestivalPct, color: fest.color, endsAt: fest.endsAt.toISOString() } : null;
  const offerViews = offers.map(({ o, s: sl }) => ({ id: o.id, sellerId: sl.id, shopName: sl.shopName, rating: sl.rating, city: `${(o.shipProvince ?? sl.province) ? `${o.shipProvince ?? sl.province}، ` : ""}${o.shipCity ?? sl.city}`, price: o.salePrice ?? o.price, listPrice: o.price, available: o.stock - o.reserved, shippingCost: o.shippingCost, prepDays: o.prepDays, warranty: o.warranty, isBuyBox: o.isBuyBox, condition: o.condition }))
    .sort((a, b) => Number(b.isBuyBox) - Number(a.isBuyBox) || a.price - b.price)
    .map((o, i) => (mv ? o : { ...o, sellerId: 0, shopName: s.siteName, city: "", rating: 0, id: o.id, isBuyBox: i === 0 }));
  const approved = revs.filter((x) => x.r.status === "approved");
  const avg = approved.length ? approved.reduce((a, x) => a + x.r.rating, 0) / approved.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: approved.filter((x) => x.r.rating === n).length }));
  const recPct = approved.filter((x) => x.r.recommend !== null).length ? Math.round((approved.filter((x) => x.r.recommend).length / approved.filter((x) => x.r.recommend !== null).length) * 100) : null;
  const allPros = approved.flatMap((x) => x.r.pros), allCons = approved.flatMap((x) => x.r.cons);
  const topOf = (arr: string[]) => Object.entries(arr.reduce<Record<string, number>>((m, t) => ({ ...m, [t]: (m[t] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const galleryIds = [...new Set([...(p.mainImageId ? [p.mainImageId] : []), ...imgs.map((image) => image.mediaId)])];
  const byId = (ids: number[]) => ids.map((id) => related.find((x) => x.id === id)).filter((x): x is (typeof related)[number] => !!x);
  const rel = (p.relatedProductIds?.length ? byId(p.relatedProductIds) : related.filter((r) => r.id !== p.id)).filter((r) => r.id !== p.id && r.inStock && !r.inquiryOnly).slice(0, 5);
  const crossSells = byId(p.crossSellProductIds ?? []).filter((r) => r.id !== p.id && r.inStock && !r.inquiryOnly).slice(0, 5);
  const visibleSpecs = [...(p.specs ?? [])].filter((sp) => !sp.hidden).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const specGroups = Array.from(new Set(visibleSpecs.map((sp) => sp.group || "مشخصات اصلی")));
  const productAttributes: [string, string][] = [
    ["برند", p.brand], ...(p.productType ? [["نوع محصول", p.productType] as [string, string]] : []),
    ...(p.material ? [["جنس/متریال", p.material] as [string, string]] : []), ...(p.color ? [["رنگ", p.color] as [string, string]] : []),
    ...((p.sizes ?? []).length ? [["اندازه‌ها", p.sizes.join("، ")] as [string, string]] : []),
    ...((p.options ?? []).map((option) => [`${option.name}`, option.values.join("، ")] as [string, string])),
    ...(p.country ? [["کشور سازنده", p.country] as [string, string]] : []), ...(p.weight ? [["وزن", `${faNum(p.weight)} گرم`] as [string, string]] : []),
    ["کد محصول", p.sku],
  ];
  const optionSizes = (p.options ?? []).filter((option) => /سایز|اندازه|ابعاد|size|dimension/i.test(option.name)).flatMap((option) => option.values);
  const sizeChoices = [...new Set([...(p.sizes ?? []), ...optionSizes])];
  const inquiryProduct = p.inquiryOnly || variants.some((variant) => variant.inquiryOnly);
  const nav: [string, string, typeof FileText][] = [["desc", "معرفی محصول", FileText], ...(p.technicalReview ? [["review", "جزئیات محصول", Microscope] as [string, string, typeof FileText]] : []), ["specs", "مشخصات و راهنمای انتخاب", ListChecks], ["smart-recommendations", "پیشنهاد خرید", Sparkles], ["reviews", `دیدگاه‌ها (${faNum(approved.length)})`, MessageSquareText], ["qa", `پرسش و پاسخ (${faNum(qs.filter((x) => x.q.status === "approved").length)})`, MessageCircleQuestion], ...(mv && offerViews.length && !inquiryProduct ? [["sellers", "فروشندگان", Store] as [string, string, typeof FileText]] : [])];
  const currencyKey = s.currency.trim().toLowerCase();
  const currency = ["تومان", "تومان ایران", "irt"].includes(currencyKey) ? { code: "IRR", multiplier: 10 }
    : ["ریال", "ریال ایران", "irr"].includes(currencyKey) ? { code: "IRR", multiplier: 1 }
      : /^[a-z]{3}$/i.test(s.currency.trim()) ? { code: s.currency.trim().toUpperCase(), multiplier: 1 }
        : null;
  const jsonBase = siteBase(s.siteUrl);
  const productUrl = new URL(`/products/${encodeURIComponent(p.slug)}`, jsonBase).toString();
  const schemaOffers: { price: number; available: boolean; seller?: string }[] = [];
  if (currency && !p.inquiryOnly) {
    if (p.source === "central" && variants.length) {
      for (const variant of variants.filter((item) => item.isSellable && !item.inquiryOnly)) {
        const tier = applicableQuantityTier(variant.quantityPriceTiers ?? [], 1);
        const listPrice = quantityTierPrice(variant.price, tier);
        const discount = variantPromotions[variant.id]?.pct ?? baseFestival?.pct ?? 0;
        const price = listPrice - Math.round(listPrice * discount / 100);
        if (price > 0) schemaOffers.push({ price, available: variant.onHand - variant.reserved > 0 || p.allowBackorder });
      }
    } else if (p.source === "central") {
      const price = p.basePrice - Math.round(p.basePrice * (baseFestival?.pct ?? 0) / 100);
      if (price > 0) schemaOffers.push({ price, available: p.onHand > p.reserved || p.allowBackorder });
    }
    if (!p.inquiryOnly && mv) {
      for (const offer of offerViews) {
        const price = offer.price - Math.round(offer.price * (baseFestival?.pct ?? 0) / 100);
        if (price > 0) schemaOffers.push({ price, available: offer.available > 0, seller: offer.shopName });
      }
    } else if (!schemaOffers.length && !p.inquiryOnly) {
      const offer = offerViews.find((item) => item.price > 0);
      if (offer) {
        const price = offer.price - Math.round(offer.price * (baseFestival?.pct ?? 0) / 100);
        if (price > 0) schemaOffers.push({ price, available: offer.available > 0, seller: offer.shopName });
      }
    }
  }
  const offerData = currency && schemaOffers.length > 1
    ? { "@type": "AggregateOffer", priceCurrency: currency.code, lowPrice: Math.min(...schemaOffers.map((offer) => offer.price)) * currency.multiplier, highPrice: Math.max(...schemaOffers.map((offer) => offer.price)) * currency.multiplier, offerCount: schemaOffers.length, availability: schemaOffers.some((offer) => offer.available) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: productUrl }
    : currency && schemaOffers.length === 1
      ? { "@type": "Offer", priceCurrency: currency.code, price: schemaOffers[0].price * currency.multiplier, availability: schemaOffers[0].available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", itemCondition: "https://schema.org/NewCondition", url: productUrl, ...(schemaOffers[0].seller ? { seller: { "@type": "Organization", name: schemaOffers[0].seller } } : {}) }
      : undefined;
  const jsonLd = offerData || approved.length ? {
    "@context": "https://schema.org", "@type": "Product", name: p.nameFa, sku: p.sku,
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    ...(p.shortDesc ? { description: stripHtml(p.shortDesc) } : {}),
    ...(imgs.length || p.mainImageId ? { image: [...new Set([...(p.mainImageId ? [p.mainImageId] : []), ...imgs.map((image) => image.mediaId)])].map((id) => new URL(`/api/media/${id}`, jsonBase).toString()) } : {}),
    url: productUrl,
    ...(offerData ? { offers: offerData } : {}),
    ...(approved.length ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(avg.toFixed(1)), reviewCount: approved.length } } : {}),
  } : null;
  return (
    <div className={`minimal-storefront ${styles.shell}`}>
      <SiteHeader minimal />
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      {(p.productFaqs ?? []).length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.productFaqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) }).replace(/</g, "\\u003c") }} />}
      <main className={styles.page}>
        <nav aria-label="مسیر صفحه" className={styles.breadcrumb}><Link href="/">خانه</Link> / <Link href="/shop">فروشگاه</Link>{row.cat && <> / <Link href={`/shop?cat=${row.cat.id}`}>{row.cat.name}</Link></>} / <span className="text-emerald-800">{p.nameFa}</span></nav>
        <div className={styles.hero}>
          <div className={styles.gallery}><Gallery editorial promotionSlotId={`product-promotion-${p.id}`} ids={galleryIds} alt={p.nameFa} videoId={p.videoMediaId} actions={<>{(!p.inquiryOnly && !variants.some((v) => v.inquiryOnly)) && <ProductPriceHistory productId={p.id}/>}<FavoriteButton productId={p.id}/><ProductCompareButton productId={p.id}/></>} /></div>
          <div className={styles.summary}>
            <div className={styles.eyebrow}>
              <Link href={brandPage ? `/brands/${brandPage.slug}` : `/shop?brand=${encodeURIComponent(p.brand)}`}>{p.brand}</Link>
              {row.cat && <><span aria-hidden="true" className="text-slate-300">/</span><Link href={`/shop?cat=${row.cat.id}`} className="text-slate-500">{row.cat.name}</Link></>}
            </div>
            <h1 className={styles.title}>{p.nameFa}</h1>
            <ProductViewTracker productId={p.id} showCount={!!s.productLiveViewers} />
            {p.nameEn && <div className="-mt-4 text-sm text-slate-400" dir="ltr">{p.nameEn}</div>}
            <a href="#reviews" className={styles.rating}>
              <Stars value={avg} /><b className="text-amber-600">{approved.length ? faNum(Number(avg.toFixed(1))) : "—"}</b>
              <span className="text-slate-500">{approved.length ? `از ${faNum(approved.length)} دیدگاه` : "هنوز دیدگاهی ثبت نشده"}</span>
              {recPct !== null && <span className="text-xs text-emerald-700">{faNum(recPct)}٪ پیشنهاد خرید</span>}
            </a>
            {p.shortDesc && <p className={styles.intro}>{stripHtml(p.shortDesc, 280)}</p>}
            <div className={styles.quickLinks}><a href="#specs"><Ruler size={16}/>مشخصات و راهنمای انتخاب</a><span>کد محصول: <bdi>{p.sku}</bdi></span></div>
            {p.deliveryEstimateEnabled && <p className="text-sm text-slate-600"><b className="text-slate-800">زمان تحویل:</b><span className="mr-2">حدود {faNum(p.deliveryMinDays)} تا {faNum(p.deliveryMaxDays)} روز کاری پس از ثبت سفارش</span></p>}
            <BuyBox product={{ id: p.id, nameFa: p.nameFa, basePrice: p.inquiryOnly ? 0 : p.basePrice, source: p.source, available: p.onHand - p.reserved, active: p.status === "active" || (p.status === "out_of_stock" && p.allowBackorder), allowBackorder: p.allowBackorder, inquiryOnly: p.inquiryOnly, partNumber: p.partNumber, inventoryUnit: p.inventoryBaseUnit, quantityPriceTiers: p.quantityPriceTiers ?? [] }}
              options={p.options} purchaseOptions={p.purchaseOptions ?? []} variants={variants.map((v) => ({ id: v.id, title: v.title, attrs: v.attrs, price: p.inquiryOnly || v.inquiryOnly ? 0 : v.price, compareAtPrice: p.inquiryOnly || v.inquiryOnly ? 0 : v.compareAtPrice, available: v.onHand - v.reserved, isSellable: v.isSellable, inquiryOnly: p.inquiryOnly || v.inquiryOnly, inventoryUnit: v.inventoryUnit, quantityPriceTiers: p.inquiryOnly ? [] : v.quantityPriceTiers ?? [] }))} offers={p.inquiryOnly ? [] : offerViews}
              festival={baseFestival} variantPromotions={variantPromotions} promotionTargetId={`product-promotion-${p.id}`}
              multiVendor={mv} siteName={s.siteName} returnDays={s.returnDays} prepDays={s.productPrepDays} shippingInfo={s.productShippingInfo} warrantyText={s.productWarrantyText} compareAt={p.compareAtPrice} customer={u ? { name: u.name, phone: u.phone } : null} initialVariantId={initialVariantId} />
            {(!p.inquiryOnly && !variants.some((v) => v.inquiryOnly)) && <details className={styles.alerts}><summary>اطلاع از موجودی و کاهش قیمت</summary><ProductAlerts productId={p.id} productName={p.nameFa} phone={u?.phone} variants={variants.map((v) => ({ id: v.id, title: v.title, available: v.onHand - v.reserved }))}/></details>}
          </div>
        </div>

        <div className={styles.navigation}>
          <div className="flex gap-1">{nav.map(([id, l, I]) => <a key={id} href={`#${id}`} className="flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-4 py-3.5 text-sm font-medium text-slate-600 hover:border-emerald-600 hover:text-emerald-800"><I className="h-4 w-4" />{l}</a>)}</div>
        </div>

        <div className={styles.details}>
          <section id="desc" className="scroll-mt-44 border-t border-slate-200 py-8"><h2 className="mb-4 flex items-center gap-2 text-xl font-black text-emerald-950"><FileText className="h-5 w-5 text-emerald-700" />معرفی محصول</h2><div className="prose-rich"><RichContent content={p.description || p.shortDesc}/></div></section>
          {p.technicalReview && <section id="review" className="scroll-mt-44 border-t border-slate-200 py-8"><h2 className="mb-4 flex items-center gap-2 text-xl font-black text-emerald-950"><Microscope className="h-5 w-5 text-emerald-700" />جزئیات و نکات محصول</h2><div className="prose-rich" dangerouslySetInnerHTML={{ __html: toSafeHtml(p.technicalReview) }} /></section>}
          <section id="specs" className={styles.specifications}>
            <div className="py-2">
              <h2 className="mb-5 text-xl font-black text-emerald-950">مشخصات محصول</h2>
              <div className="space-y-5">
                {specGroups.map((group) => <div key={group}><h3 className="mb-1 border-b border-slate-200 pb-2 text-sm font-bold text-slate-700">{group}</h3><div className="divide-y divide-slate-100">{visibleSpecs.filter((sp) => (sp.group || "مشخصات اصلی") === group).map((sp, i) => <div key={`${group}-${i}`} className="grid grid-cols-[40%_1fr] text-sm"><div className="py-3 text-slate-500">{sp.k}</div><div className="py-3 font-medium text-slate-800">{sp.v}</div></div>)}</div></div>)}
                {productAttributes.map(([label, value]) => <div key={label} className="grid grid-cols-[40%_1fr] border-b border-slate-100 text-sm"><div className="py-3 text-slate-500">{label}</div><div className="py-3 font-medium text-slate-800">{value}</div></div>)}
              </div>
            </div>
            <div className="border-t border-slate-200 py-2 lg:border-r lg:border-t-0 lg:pr-6">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-emerald-950"><Ruler className="h-5 w-5 text-emerald-700" />ابعاد و گزینه‌های سفارش</h2>
              {sizeChoices.length > 0 && <div className="mb-4"><p className="mb-2 text-xs text-slate-500">اندازه‌ها و ابعاد تعریف‌شده برای این محصول</p><div className="flex flex-wrap gap-2">{sizeChoices.map((size) => <span key={size} className="border-b-2 border-emerald-700 px-1.5 py-1 text-sm font-semibold text-slate-800">{size}</span>)}</div></div>}
              {p.sizeGuideMediaId && <Image src={`/api/media/${p.sizeGuideMediaId}`} alt={`راهنمای ابعاد و انتخاب ${p.nameFa}`} width={1200} height={1000} sizes="(max-width: 1024px) 100vw, 50vw" className="mb-4 max-h-[560px] w-full object-contain" />}
              {p.sizeGuideText ? <p className="whitespace-pre-line text-sm leading-8 text-slate-700">{p.sizeGuideText}</p> : !p.sizeGuideMediaId && <p className="text-sm leading-7 text-slate-500">راهنمای ابعاد یا انتخاب این محصول هنوز ثبت نشده است. گزینه‌های قابل سفارش در همین بخش مشخص شده‌اند؛ برای اطلاعات بیشتر با پشتیبانی در تماس باشید.</p>}
            </div>
          </section>

          <section id="reviews" className="scroll-mt-44 border-t border-slate-200 py-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-black text-emerald-950"><MessageSquareText className="h-5 w-5 text-lime-500" />دیدگاه خریداران</h2><ReviewForm productId={p.id} loggedIn={!!u} productName={p.nameFa} /></div>
            <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
              <aside className="space-y-4">
                <div className="border-b border-slate-200 pb-4 text-center"><div className="text-5xl font-black text-emerald-950">{approved.length ? faNum(Number(avg.toFixed(1))) : "—"}</div><div className="my-2"><Stars value={avg} size={20} /></div><div className="text-xs text-slate-500">بر اساس {faNum(approved.length)} دیدگاه</div>
                  <div className="mt-4 space-y-1.5">{dist.map((d) => <div key={d.n} className="flex items-center gap-2 text-xs"><span className="w-3">{faNum(d.n)}</span><Star className="h-3 w-3 fill-amber-400 text-amber-400" /><div className="h-2 flex-1 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-amber-400" style={{ width: `${approved.length ? (d.c / approved.length) * 100 : 0}%` }} /></div><span className="w-6 text-slate-400">{faNum(d.c)}</span></div>)}</div>
                  {recPct !== null && <div className="mt-4 text-xs"><b className="text-emerald-700">{faNum(recPct)}٪</b> از خریداران این محصول را پیشنهاد کرده‌اند</div>}
                </div>
                {(allPros.length > 0 || allCons.length > 0) && (
                  <div className="space-y-3 py-3 text-xs">
                    {topOf(allPros).length > 0 && <div><b className="mb-1 block text-emerald-700">پرتکرارترین نقاط قوت</b>{topOf(allPros).map(([t, c]) => <div key={t} className="flex justify-between py-0.5"><span className="text-emerald-700">+ {t}</span><span className="text-slate-400">{faNum(c)}</span></div>)}</div>}
                    {topOf(allCons).length > 0 && <div><b className="mb-1 block text-rose-600">پرتکرارترین نقاط ضعف</b>{topOf(allCons).map(([t, c]) => <div key={t} className="flex justify-between py-0.5"><span>− {t}</span><span className="text-slate-400">{faNum(c)}</span></div>)}</div>}
                  </div>
                )}
              </aside>
              <div className="space-y-4">
                {revs.length === 0 && <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500"><Star className="mx-auto mb-2 h-10 w-10 text-slate-200" />اولین نفری باشید که درباره این محصول دیدگاه می‌نویسد.</div>}
                {revs.map(({ r, name }) => (
                  <article key={r.id} className={`border-b border-slate-200 py-5 ${r.status !== "approved" ? "bg-amber-50/50 px-3" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-lime-200 to-emerald-300 font-black text-emerald-900">{name.slice(0, 1)}</span><div><b className="text-sm">{name}</b><div className="flex items-center gap-2 text-[11px] text-slate-400">{jdate(r.createdAt)}{r.verifiedPurchase && <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 text-emerald-700"><CheckCircle2 className="h-3 w-3" />خریدار</span>}</div></div></div>
                      <div className="flex items-center gap-2"><Stars value={r.rating} size={14} />{r.status !== "approved" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">{r.status === "pending" ? "در انتظار تأیید" : "تأیید نشد"}</span>}</div>
                    </div>
                    {r.title && <b className="mt-3 block text-emerald-950">{r.title}</b>}
                    <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{r.body}</p>
                    {(r.pros.length > 0 || r.cons.length > 0) && <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">{r.pros.length > 0 && <ul className="space-y-1">{r.pros.map((t, i) => <li key={i} className="flex items-center gap-1.5 text-emerald-700"><Plus className="h-3.5 w-3.5" />{t}</li>)}</ul>}{r.cons.length > 0 && <ul className="space-y-1">{r.cons.map((t, i) => <li key={i} className="flex items-center gap-1.5 text-rose-600"><Minus className="h-3.5 w-3.5" />{t}</li>)}</ul>}</div>}
                    {r.mediaIds.length > 0 && <div className="mt-3"><ReviewImages ids={r.mediaIds} /></div>}
                    {r.recommend !== null && <div className={`mt-3 text-xs font-bold ${r.recommend ? "text-emerald-700" : "text-rose-600"}`}>{r.recommend ? "👍 خرید این محصول را پیشنهاد می‌کنم" : "👎 خرید این محصول را پیشنهاد نمی‌کنم"}</div>}
                    {r.adminReply && <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-xs leading-6"><b className="text-emerald-800">پاسخ {s.siteName}: </b>{r.adminReply}</div>}
                    {r.status === "approved" && <div className="mt-3 border-t border-slate-100 pt-3"><VoteButtons id={r.id} helpful={r.helpful} notHelpful={r.notHelpful} loggedIn={!!u} /></div>}
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="qa" className="scroll-mt-44 border-t border-slate-200 py-8">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-black text-emerald-950"><MessageCircleQuestion className="h-5 w-5 text-lime-500" />پرسش و پاسخ</h2>
            <QuestionForm productId={p.id} loggedIn={!!u} />
            <div className="mt-6 space-y-4">
              {(p.productFaqs ?? []).map((faq, i) => <article key={`faq-${i}`} className="border-b border-slate-200 py-5"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-700 text-sm font-black text-white">؟</span><div className="flex-1"><p className="font-bold leading-7 text-emerald-950">{faq.question}</p><div className="text-[11px] text-slate-400">پرسش پرتکرار خریداران · پاسخ رسمی فروشگاه</div></div></div><div className="mt-3 pr-11 text-sm"><div className="mb-1 flex items-center gap-2 text-[11px]"><RoleBadge role="admin" /><b>{s.siteName}</b></div><p className="whitespace-pre-line leading-7 text-slate-700">{faq.answer}</p></div></article>)}
              {qs.length === 0 && (p.productFaqs ?? []).length === 0 && <p className="text-center text-sm text-slate-500">هنوز پرسشی ثبت نشده است.</p>}
              {qs.map(({ q, name }) => {
                const as = answers.filter((x) => x.a.questionId === q.id);
                return (
                  <div key={q.id} className="border-b border-slate-200 py-5">
                    <div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-black text-white">؟</span><div className="flex-1"><p className="font-bold leading-7 text-emerald-950">{q.body}</p><div className="text-[11px] text-slate-400">{name} · {jdate(q.createdAt)}{q.status !== "approved" && " · در انتظار تأیید"}</div></div></div>
                    <div className="mt-3 space-y-2 pr-11">
                      {as.map(({ a, name: an }) => <div key={a.id} className="border-r-2 border-emerald-100 py-2 pr-3 text-sm"><div className="mb-1 flex items-center gap-2 text-[11px]"><RoleBadge role={a.role} /><b>{an}</b><span className="text-slate-400">{jdate(a.createdAt)}</span>{a.status !== "approved" && <span className="text-amber-600">در انتظار تأیید</span>}</div><p className="leading-7 text-slate-700">{a.body}</p></div>)}
                      {q.status === "approved" && <AnswerForm questionId={q.id} loggedIn={!!u} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {mv && offerViews.length > 0 && !inquiryProduct && (
            <section id="sellers" className="scroll-mt-44 border-t border-slate-200 py-8">
              <h2 className="mb-4 text-xl font-black text-emerald-950">مقایسه فروشندگان</h2>
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
                <thead className="text-xs text-slate-500"><tr><th className="p-2 text-right">فروشنده</th><th className="p-2 text-right">شهر</th><th className="p-2 text-right">آماده‌سازی</th><th className="p-2 text-right">ارسال</th><th className="p-2 text-right">ضمانت</th><th className="p-2 text-right">قیمت</th></tr></thead>
                <tbody className="divide-y">
                  {p.source === "central" && <tr><td className="p-2 font-bold">{s.siteName}</td><td className="p-2">انبار مرکزی</td><td className="p-2">{faNum(s.productPrepDays)} روز کاری</td><td className="p-2">{s.productShippingInfo}</td><td className="p-2">{s.productWarrantyText}</td><td className="p-2 font-bold">{toman(p.basePrice)}</td></tr>}
                  {offerViews.map((o) => <tr key={o.id}><td className="p-2 font-bold">{o.shopName} <span className="text-xs font-normal text-amber-500">★ {faNum(o.rating)}</span></td><td className="p-2">{o.city}</td><td className="p-2">{faNum(o.prepDays)} روز</td><td className="p-2">{toman(o.shippingCost)}</td><td className="p-2 text-xs">{o.warranty ?? "—"}</td><td className="p-2 font-bold">{toman(o.price)}</td></tr>)}
                </tbody>
              </table></div>
            </section>
          )}
        </div>

        <Suspense fallback={<section id="smart-recommendations" className={styles.recommendations} aria-busy="true"><p className="animate-pulse text-sm text-slate-500">در حال آماده‌سازی پیشنهادهای مناسب…</p></section>}>
          <SmartRecommendations id={p.id} categoryId={p.categoryId} brand={p.brand} price={p.basePrice} />
        </Suspense>
        {crossSells.length > 0 && <section><h2 className="mb-5 text-2xl font-black text-emerald-950">شاید این‌ها را هم بخواهید</h2><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{crossSells.map((r) => <ProductCard key={r.id} p={r} />)}</div></section>}
        {rel.length > 0 && (
          <section><h2 className="mb-5 flex items-center gap-2 text-2xl font-black text-emerald-950"><Leaf className="h-6 w-6 text-lime-500" />محصولات مرتبط</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{rel.map((r) => <ProductCard key={r.id} p={r} />)}</div></section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

async function SmartRecommendations({ id, categoryId, brand, price }: { id: number; categoryId: number | null; brand: string; price: number }) {
  const recommendations = await getSmartProductRecommendations({ id, categoryId, brand, price }, 4);
  return <section id="smart-recommendations" className={styles.recommendations}>
    <div className="mb-5 flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-700"><Sparkles className="size-5" /></span><div><h2 className="text-xl font-black text-rose-950">پیشنهاد هوشمند خرید</h2><p className="mt-1 text-sm leading-6 text-slate-500">محصولاتی که می‌توانند در کنار این کالا برای شما کاربردی باشند.</p></div></div>
    {recommendations.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{recommendations.map(({ product, reason }) => <article key={product.id} className="flex min-w-0 flex-col gap-2"><ProductCard p={product} /><p className="rounded-xl bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900">{reason}</p></article>)}</div> : <p className="text-sm text-slate-500">فعلاً پیشنهاد خرید مرتبطی پیدا نشد.</p>}
  </section>;
}
