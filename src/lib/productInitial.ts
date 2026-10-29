import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { productImages, products, productVariants } from "@/db/schema";
import type { ProductInitial } from "@/components/ProductForm";

export async function loadProductInitial(id: number): Promise<(ProductInitial & { ownerSellerId: number | null; status: string }) | null> {
  const [p] = await db.select().from(products).where(eq(products.id, id));
  if (!p || p.status === "deleted") return null;
  const imgs = await db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(productImages.sortOrder);
  const vars = await db.select().from(productVariants).where(and(eq(productVariants.productId, id), isNull(productVariants.deletedAt)));
  return {
    ...p, imageIds: imgs.map((i) => i.mediaId),
    variants: vars.map((v) => ({ id: v.id, title: v.title, attrs: v.attrs, sku: v.sku, price: v.discountType !== "none" && v.compareAtPrice ? v.compareAtPrice : v.price, compareAtPrice: v.compareAtPrice ?? 0, costPrice: v.costPrice ?? p.avgCost, profitPercent: v.profitPercent, discountType: v.discountType as "none" | "percent" | "fixed", discountValue: v.discountValue, rewardPoints: v.rewardPoints, quantityPriceTiers: v.quantityPriceTiers ?? [], onHand: v.onHand, inventoryUnit: v.inventoryUnit, baseUnitAmount: v.baseUnitAmount, isActive: v.isActive, isSellable: v.isSellable, inquiryOnly: v.inquiryOnly })),
  };
}
