import Link from "next/link";
import { notFound } from "next/navigation";
import { ne } from "drizzle-orm";
import { ProductForm } from "@/components/ProductForm";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { categoryOptions } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { loadProductInitial } from "@/lib/productInitial";

export default async function ProductVariantsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage({ perm: "PRODUCTS_EDIT" });
  const id = Number((await params).id);
  const product = Number.isInteger(id) ? await loadProductInitial(id) : null;
  if (!product) notFound();
  const [categories, choices, settings] = await Promise.all([
    categoryOptions(),
    db.select({ id: products.id, name: products.nameFa }).from(products).where(ne(products.status, "deleted")).orderBy(products.nameFa),
    getSettings(),
  ]);

  return <>
    <PageHeader title={`تنوع قیمت: ${product.nameFa}`} subtitle="رنگ، سایز و سایر گزینه‌ها را ترکیب کنید و برای هر تنوع قیمت و شناسهٔ جداگانه ثبت کنید" actions={<Link href={`/admin/products/${id}`} className="btn-ghost">جزئیات محصول</Link>} />
    <ProductForm initial={product} categories={categories} productChoices={choices.filter((choice) => choice.id !== id)} productTypes={settings.productTypes} mode="admin" backTo={`/admin/products/${id}`} initialTab="price" />
  </>;
}
