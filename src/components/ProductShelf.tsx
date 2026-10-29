import Link from "next/link";
import { ArrowLeft, Shirt } from "lucide-react";
import type { SitePageBlock } from "@/db/schema";
import type { HomeData } from "@/lib/home-data";
import { ProductCard } from "./ProductCard";
import styles from "./MinimalHome.module.css";

/** A reusable, independently filtered product row for page-builder layouts. */
export function ProductShelf({ block, data }: { block: SitePageBlock; data: HomeData }) {
  const categoryId = block.options?.categoryId;
  const categoryIds = new Set([categoryId, ...data.cats.filter(category => category.parent_id === categoryId).map(category => category.id)]);
  const selected = block.options?.productIds;
  const pool = selected?.length
    ? selected.flatMap(id => data.all.find(product => product.id === id) ?? [])
    : data.all.filter(product => !categoryId || categoryIds.has(product.categoryId ?? undefined));
  const products = (selected?.length ? pool : [...pool].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    .slice(0, block.options?.limit ?? 8);
  const href = categoryId ? `/shop?cat=${categoryId}` : "/shop";

  return <section aria-label={block.title || "منتخب محصولات"}>
    <div className={styles.heading}>
      <div><h2>{block.title || "منتخب محصولات"}</h2>{block.body && <p>{block.body}</p>}</div>
      <Link href={href}>مشاهده همه <ArrowLeft size={16} /></Link>
    </div>
    {products.length
      ? <div className={styles.products}>{products.map(product => <ProductCard key={product.id} p={product} />)}</div>
      : <div className={styles.empty}><Shirt size={30} strokeWidth={1} /><p>محصولی برای این بخش پیدا نشد.</p><Link href={href}>مشاهده فروشگاه <ArrowLeft size={16} /></Link></div>}
  </section>;
}
