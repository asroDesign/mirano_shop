import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BoutiqueProductGallery } from "@/components/BoutiqueProductGallery";
import { listShopProducts } from "@/lib/queries";

export const metadata = { title: "گالری محصولات", description: "گالری ابزار، مواد اولیه و لوازم قنادی میرانو." };

export default async function GalleryPage() {
  const products = await listShopProducts({ pastry: true, sort: "new" }, 36);
  return <div className="minimal-storefront"><SiteHeader minimal />
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="مسیر صفحه" className="mb-6 text-xs text-slate-500"><Link href="/">خانه</Link> / گالری محصولات</nav>
      <h1 className="sr-only">گالری محصولات قنادی میرانو</h1>
      <BoutiqueProductGallery products={products}/>
    </main><SiteFooter/></div>;
}
