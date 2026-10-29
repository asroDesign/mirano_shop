import Link from "next/link";
import { ArrowLeft, CakeSlice } from "lucide-react";
import type { ShopProduct } from "@/lib/queries";
import { Img } from "./ui";

export function BoutiqueProductGallery({ products }: { products: ShopProduct[] }) {
  return (
    <section id="product-gallery" className="boutique-gallery" aria-labelledby="boutique-gallery-title">
      <div className="boutique-section-title">
        <div>
          <span className="boutique-eyebrow">MIRANO PASTRY EDIT</span>
          <h2 id="boutique-gallery-title">گالری محصولات</h2>
          <p>برای دیدن جزئیات هر محصول، تصویر آن را انتخاب کنید.</p>
        </div>
        <div className="boutique-gallery-legend" aria-label="راهنمای وضعیت موجودی">
          <span><i className="boutique-stock-dot" />موجود</span>
          <span><i className="boutique-stock-dot is-out" />ناموجود</span>
        </div>
      </div>

      {products.length ? (
        <div className="boutique-gallery-grid">
          {products.map((product) => (
            <Link
              href={`/products/${product.slug}`}
              key={product.id}
              className={`boutique-gallery-card ${product.inStock ? "" : "is-out"}`}
              aria-label={`${product.nameFa}؛ ${product.inStock ? "موجود" : "ناموجود"}`}
            >
              <div className="boutique-gallery-image">
                {product.imageId ? (
                  <Img id={product.imageId} alt={product.nameFa} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
                ) : (
                  <div className="boutique-gallery-placeholder"><CakeSlice size={46} strokeWidth={1} /><span>تصویر محصول</span></div>
                )}
                <span className="boutique-gallery-cta" aria-hidden="true">مشاهده و خرید <ArrowLeft size={16} /></span>
                {!product.inStock && <span className="boutique-gallery-status">ناموجود</span>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="boutique-gallery-empty">
          <CakeSlice size={34} strokeWidth={1} />
          <p>هنوز محصولی برای نمایش در گالری ثبت نشده است.</p>
        </div>
      )}
    </section>
  );
}
