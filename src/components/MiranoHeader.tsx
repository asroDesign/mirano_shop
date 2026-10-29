import Link from "next/link";
import { ArrowLeft, ChevronDown, Menu, ShoppingCart, Store, User } from "lucide-react";
import { getUser } from "@/lib/auth";
import { categoriesWithCounts } from "@/lib/queries";
import { CartCount } from "./client";
import { LiveSearch } from "./LiveSearch";
import styles from "./MiranoStorefront.module.css";

const pastryCategoryName = /قالب|ابزار|تجهیز|پخت|قنادی|نازل|ماسوره|مواد|اولیه|شکر|آرد|شکلات|پودر|تزئین|تزیین|بسته|جعبه|کاپ|ظرف|کاتر|فوندانت|خامه|وانیل/;

export async function MiranoHeader({ minimal = false }: { minimal?: boolean } = {}) {
  const [user, categories] = await Promise.all([getUser(), categoriesWithCounts()]);
  const roots = categories.filter(category => !category.parent_id && pastryCategoryName.test(category.name));
  const panel = user ? (user.sellerId ? "/seller" : user.staff ? "/admin" : "/customer") : "/login";
  const fallbackCategories = ["قالب و ابزار پخت", "مواد اولیه", "تزئین و بسته‌بندی"];

  return (
    <header className={`${styles.header} mirano-header`}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brand} aria-label="میرانو، صفحهٔ اصلی">
          <span className={styles.brandMark}><Store size={21} strokeWidth={1.8} /></span>
          <span>میرانو</span>
        </Link>
        {!minimal && <nav className={styles.desktopNav} aria-label="منوی اصلی">
          <details className={styles.categoryMenu}>
            <summary>دسته‌بندی‌ها <ChevronDown size={15} /></summary>
            <div className={styles.categoryDropdown}>
              {roots.length ? roots.map(category => <Link key={category.id} href={"/shop?cat=" + category.id}>{category.name}<ArrowLeft size={14} /></Link>)
                : fallbackCategories.map(category => <Link key={category} href="/shop">{category}<ArrowLeft size={14} /></Link>)}
              <Link href="/categories" className={styles.allCategories}>همه دسته‌ها</Link>
            </div>
          </details>
          <Link href="/shop">فروشگاه</Link>
          <Link href="/blog">بلاگ</Link>
          <Link href="/about">درباره ما</Link>
        </nav>}
        <div className={styles.search}>
          <LiveSearch popular={["قالب کیک", "ماسوره", "شکلات تخته‌ای"]} className={styles.searchWidget} />
        </div>
        <div className={styles.headerActions}>
          <Link href="/cart" className={styles.cart} aria-label="سبد خرید"><ShoppingCart size={21} /><CartCount /></Link>
          <Link href={panel} className={styles.login}><User size={16} /><span>{user ? user.name.split(" ")[0] : "ورود | ثبت‌نام"}</span></Link>
        </div>
        {!minimal && <details className={styles.mobileMenu}>
          <summary aria-label="باز کردن منو"><Menu size={21} /></summary>
          <div>
            <Link href="/categories">دسته‌بندی‌ها</Link>
            <Link href="/shop">فروشگاه</Link>
            <Link href="/blog">بلاگ</Link>
            <Link href="/about">درباره ما</Link>
            <Link href={panel}>{user ? "حساب کاربری" : "ورود | ثبت‌نام"}</Link>
          </div>
        </details>}
      </div>
      <div className={styles.mobileSearch}>
        <LiveSearch popular={["قالب کیک", "ماسوره", "شکلات تخته‌ای"]} compact className={styles.searchWidget} />
      </div>
    </header>
  );
}
