import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CookingPot, Package, Truck, Headphones, CreditCard, Wheat, Ruler } from "lucide-react";
import type { SitePageBlock } from "@/db/schema";
import type { HomeData } from "@/lib/home-data";
import { PageBlockFrame } from "./PageBlockFrame";
import { PublicSiteBlockContent } from "./PublicSiteBlockContent";
import { StoreSection } from "./HomeContent";
import { ProductCard } from "./ProductCard";
import { ProductShelf } from "./ProductShelf";
import { Img } from "./ui";
import styles from "./MinimalHome.module.css";

/** Keep the catalog first while retaining explicitly authored page-builder content. */
export function HomePublicContent({ blocks, data, children }: { blocks: SitePageBlock[]; data: HomeData; children?: ReactNode }) {
  const pastryCategoryPattern = /قالب|ابزار|تجهیز|پخت|قنادی|نازل|ماسوره|مواد|اولیه|شکر|آرد|شکلات|پودر|تزئین|تزیین|بسته|جعبه|کاپ|ظرف|کاتر|فوندانت|خامه|وانیل/i;
  const roots = new Set(data.cats.filter(category => !category.parent_id && pastryCategoryPattern.test(category.name)).map(category => category.id));
  const categories = data.cats.filter(category => pastryCategoryPattern.test(category.name) || (category.parent_id != null && roots.has(category.parent_id)));
  const categoryBlock = blocks.find(block => block.type === "store_section" && block.sectionId === "categories");
  const trustBlock = blocks.find(block => block.type === "store_section" && block.sectionId === "trust");
  const freshBlock = blocks.find(block => block.type === "store_section" && block.sectionId === "fresh") ?? { type: "store_section" as const, sectionId: "fresh", title: "", body: "", items: [] };
  const selectedIds = freshBlock.options?.productIds;
  const categoryId = freshBlock.options?.categoryId;
  const categoryIds = new Set([categoryId, ...data.cats.filter(category => category.parent_id === categoryId).map(category => category.id)]);
  const pool = selectedIds?.length
    ? selectedIds.flatMap(id => data.all.find(product => product.id === id) ?? [])
    : data.all.filter(product => !categoryId || categoryIds.has(product.categoryId ?? undefined));
  const newest = (selectedIds?.length ? pool : [...pool].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    .slice(0, freshBlock?.options?.limit ?? 8);
  const additional = blocks.filter(block => block.enabled !== false && (block.type !== "store_section" || (
    !["categories", "fresh", "trust"].includes(block.sectionId || "") &&
    Boolean(block.title || block.body || block.mediaId || block.items?.length || block.options?.productIds?.length)
  )));

  return (
    <main className={`boutique-home ${styles.home}`}>
      <PageBlockFrame block={categoryBlock ?? { type: "store_section", sectionId: "categories" }}>
        <section className={styles.categorySection} aria-labelledby="home-categories-title">
          <div className={styles.heading}>
            <div><h1 id="home-categories-title">{categoryBlock?.title || "دسته‌بندی‌ها"}</h1><p>{categoryBlock?.body || "ابزار و مواد اولیهٔ موردنیازتان را پیدا کنید."}</p></div>
            <Link href="/categories">همه دسته‌بندی‌ها <ArrowLeft size={16} /></Link>
          </div>
          {categories.length ? <div className={styles.categories}>
            {categories.map(category => { const Icon = /مواد|آرد|شکلات/.test(category.name) ? Wheat : /بسته|جعبه|تزئین/.test(category.name) ? Package : CookingPot; return <Link key={category.id} href={`/shop?cat=${category.id}`} className={styles.category}>
              <span className={styles.categoryImage}>
                {category.img ? <Img id={category.img} alt="" sizes="(max-width: 640px) 28vw, 160px" /> : <Icon size={46} strokeWidth={1} aria-hidden="true" />}
              </span>
              <span>{category.name}</span>
            </Link>; })}
          </div> : <p className={styles.empty}>دسته‌بندی‌های فروشگاه به‌زودی در این بخش نمایش داده می‌شوند.</p>}
        </section>
      </PageBlockFrame>

      {children}

      {freshBlock.enabled !== false && <PageBlockFrame block={freshBlock}>
        <section aria-labelledby="home-newest-title">
          <div className={styles.heading}>
            <div><h2 id="home-newest-title">{freshBlock.title || "جدیدترین محصولات"}</h2>{freshBlock.body && <p>{freshBlock.body}</p>}</div>
            <Link href="/shop?sort=new">مشاهده همه <ArrowLeft size={16} /></Link>
          </div>
          {newest.length ? <div className={styles.products}>{newest.map(product => <ProductCard key={product.id} p={product} />)}</div>
            : <div className={styles.empty}><CookingPot size={32} strokeWidth={1} /><p>محصولات جدید به‌زودی به فروشگاه اضافه می‌شوند.</p><Link href="/shop">مشاهده فروشگاه <ArrowLeft size={16} /></Link></div>}
        </section>
      </PageBlockFrame>}


      {additional.map((block, index) => block.type === "store_section"
        ? <PageBlockFrame key={block.id || index} block={block}><StoreSection block={block} data={data} /></PageBlockFrame>
        : block.type === "product_shelf"
          ? <PageBlockFrame key={block.id || index} block={block}><ProductShelf block={block} data={data} /></PageBlockFrame>
          : <PageBlockFrame key={block.id || index} block={block}><PublicSiteBlockContent block={block} primary={false} /></PageBlockFrame>)}
      {trustBlock && <PageBlockFrame block={trustBlock}>
        <section aria-label="خدمات فروشگاه">
          {(trustBlock.title || trustBlock.body) && <div className={styles.heading}><div>{trustBlock.title && <h2>{trustBlock.title}</h2>}{trustBlock.body && <p>{trustBlock.body}</p>}</div></div>}
          <div className={styles.benefits}>
            {(trustBlock.items?.length
              ? trustBlock.items.slice(0, 4).map((item, index) => ({ Icon: [Truck, Ruler, CreditCard, Headphones][index], title: item.title, text: item.body, href: item.href || ["/shipping-delivery", "/faq", "/cart", "/contact"][index] }))
              : [{ Icon: Truck, title: "ارسال سفارش", text: "راهنمای ارسال و تحویل", href: "/shipping-delivery" },
                { Icon: Ruler, title: "انتخاب محصول", text: "راهنمای خرید و مشخصات", href: "/faq" },
                { Icon: CreditCard, title: "خرید آسان", text: "مشاهده سبد خرید", href: "/cart" },
                { Icon: Headphones, title: "کنار شما هستیم", text: "ارتباط با پشتیبانی", href: "/contact" }]
            ).map(({ Icon, title, text, href }) =>
              <Link href={href} key={href}><Icon size={25} strokeWidth={1.25} /><div><b>{title}</b><span>{text}</span></div></Link>)}
          </div>
        </section>
      </PageBlockFrame>}
    </main>
  );
}
