import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, BookOpen, CookingPot, CreditCard, Headphones, Package, Truck, Wheat } from "lucide-react";
import type { PastryHomeData } from "@/lib/home-data";
import { ProductCard } from "./ProductCard";
import { Img } from "./ui";
import styles from "./MiranoStorefront.module.css";

const categoryGroups = [
  { title: "قالب و ابزار پخت", icon: CookingPot, match: /قالب|ابزار|تجهیز|پخت|قنادی|نازل|ماسوره|کاتر|ظرف/ },
  { title: "مواد اولیه", icon: Wheat, match: /مواد|اولیه|شکر|آرد|شکلات|پودر|خامه|وانیل/ },
  { title: "تزئین و بسته‌بندی", icon: Package, match: /تزئین|تزیین|بسته|جعبه|تاپر|کپسول|کاپ|شمع/ },
];
const pastryProduct = /قالب|ماسوره|نازل|آرد|شکر|شکلات|کاکائو|پودر|خامه|کیک|شیرینی|قنادی|جعبه|بسته.?بندی|کپسول|کاتر|پیمانه|فوندانت|رنگ خوراکی|ژلاتین|وانیل|دسر|ترافل|مارزیپان|شمع|تاپر|بستنی/;

export function MiranoHomeContent({ data }: { data: PastryHomeData }) {
  const categories = categoryGroups.map(group => {
    const category = data.cats.find(item => !item.parent_id && group.match.test(item.name));
    return { ...group, category, href: category ? "/shop?cat=" + category.id : "/shop" };
  });
  const pastryCategoryIds = new Set(data.cats.filter(category =>
    groupMatches(category.name)
  ).flatMap(category => [category.id, ...data.cats.filter(child => child.parent_id === category.id).map(child => child.id)]));
  const products = data.all
    .filter(product => pastryProduct.test(product.nameFa) || (product.categoryId != null && pastryCategoryIds.has(product.categoryId)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const posts = data.latestPosts.filter(post => pastryProduct.test(post.title + " " + (post.excerpt ?? ""))).slice(0, 3);

  return (
    <main className={styles.page}>
      <section className={styles.heroBand}>
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><i />مارکت‌پلیس تخصصی قنادی‌ها</span>
            <h1>هرچه برای شیرینی‌پزی حرفه‌ای لازم داری</h1>
            <p>از قالب و شکلات کوورتور تا ماسوره و جعبه؛ ابزار و مواد اولیهٔ تخصصی با ارسال به سراسر کشور.</p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/shop">شروع خرید <ArrowLeft size={17} /></Link>
              <Link className={styles.secondaryButton} href="/blog">آموزش قنادی</Link>
            </div>
          </div>
          <div className={styles.heroImage}>
            <Image src="/images/mirano-pastry-hero.webp" alt="قناد در حال تزئین کیک با ابزارهای قنادی" fill priority sizes="(max-width: 760px) 100vw, 50vw" />
            <span className={styles.imageCaption}>ابزار خوب، شروع یک شیرینی بی‌نقص</span>
          </div>
        </div>
      </section>

      <div className={styles.container}>
        <section className={styles.categorySection} aria-labelledby="categories-title">
          <div className={styles.sectionHeading}>
            <div><h2 id="categories-title">دسته‌بندی‌های شیرینی‌پزی</h2><p>ابزار و مواد موردنیازتان را سریع پیدا کنید</p></div>
            <Link href="/categories">همه دسته‌ها <ArrowLeft size={16} /></Link>
          </div>
          <div className={styles.categoryGrid}>
            {categories.map(({ title, icon: Icon, category, href }, index) => (
              <Link href={href} key={title} className={styles.categoryCard}>
                <div className={styles.categoryPhoto}>
                  {category?.img ? <Img id={category.img} alt="" sizes="(max-width: 700px) 90vw, 380px" /> : <Icon size={54} strokeWidth={1.15} />}
                  <span className={styles.categoryNumber}>{["۰۱", "۰۲", "۰۳"][index]}</span>
                </div>
                <div className={styles.categoryLabel}><b>{title}</b><span>مشاهده محصولات <ArrowLeft size={14} /></span></div>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.storeBanner}>
          <div className={styles.storeCopy}>
            <span>میرانو در کنار قنادها</span>
            <h2>فروش حضوری هم داریم!</h2>
            <p>برای تهیه ابزار حرفه‌ای و مواد اولیه، حضوری به فروشگاه سر بزنید یا پیش از مراجعه موجودی را از ما بپرسید.</p>
            <Link href="/contact">اطلاعات فروشگاه <ArrowLeft size={16} /></Link>
          </div>
          <div className={styles.storeImage} role="img" aria-label="میز کار قنادی با ابزارهای شیرینی‌پزی" />
        </section>

        <section className={styles.freshSection} aria-labelledby="fresh-title">
          <div className={styles.sectionHeading}>
            <div><h2 id="fresh-title">تازه‌رسیده‌های قنادی</h2><p>ابزار و مواد اولیهٔ تازه برای ایده‌های شیرین شما</p></div>
            <Link href="/shop">مشاهده همه <ArrowLeft size={16} /></Link>
          </div>
          {products.length ? <div className={styles.products}>{products.map(product => <ProductCard key={product.id} p={product} />)}</div>
            : <div className={styles.emptyProducts}><p>محصولات قنادی به‌زودی در این بخش نمایش داده می‌شوند.</p><Link href="/shop">رفتن به فروشگاه <ArrowLeft size={15} /></Link></div>}
        </section>

        <section className={styles.learning}>
          <div className={styles.learningIntro}>
            <span className={styles.learningEyebrow}><BookOpen size={15} />مجلهٔ میرانو</span>
            <h2>تکنیک‌های قیف‌زدن حرفه‌ای</h2>
            <p>ویدیوهای آموزشی رایگان و نکته‌های کاربردی برای نتیجه‌ای زیباتر در هر بار پخت.</p>
            <Link href="/blog">رفتن به آموزش قنادی <ArrowLeft size={16} /></Link>
          </div>
          <div className={styles.postGrid}>
            {posts.length ? posts.map(post => <Link href={"/blog/" + post.slug} key={post.id} className={styles.postCard}>
              <div className={styles.postImage}>{post.coverImageId ? <Img id={post.coverImageId} alt="" sizes="(max-width: 700px) 90vw, 300px" /> : <BookOpen size={36} />}</div>
              <b>{post.title}</b>
              {post.excerpt && <p>{post.excerpt}</p>}
            </Link>) : <Link href="/blog" className={styles.educationCard}>
              <span><BookOpen size={27} /></span><b>از اندازه‌گیری تا تزئین</b><p>راهنمای خرید ابزار و تکنیک‌های شیرینی‌پزی را در بلاگ بخوانید.</p><ArrowLeft size={18} />
            </Link>}
          </div>
        </section>

        <section className={styles.benefits} aria-label="مزیت‌های خرید از میرانو">
          <div><Truck size={25} strokeWidth={1.35} /><span><b>ارسال سریع</b><small>تحویل ۱ تا ۳ روز کاری در سراسر کشور</small></span></div>
          <div><BadgeCheck size={25} strokeWidth={1.35} /><span><b>ضمانت اصالت</b><small>برند و مشخصات شفاف برای انتخاب آگاهانه</small></span></div>
          <div><CreditCard size={25} strokeWidth={1.35} /><span><b>خرید مطمئن</b><small>جزئیات سفارش و هزینه‌ها پیش از پرداخت روشن است</small></span></div>
          <div><Headphones size={25} strokeWidth={1.35} /><span><b>پشتیبانی ۷ روزه</b><small>راهنمایی برای انتخاب ابزار و مواد اولیه</small></span></div>
        </section>
      </div>
    </main>
  );
}

function groupMatches(name: string) {
  return categoryGroups.some(group => group.match.test(name));
}
