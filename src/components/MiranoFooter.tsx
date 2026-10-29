import Link from "next/link";
import { Mail, MapPin, Phone, Store } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { FooterScripts } from "./FooterScripts";
import styles from "./MiranoStorefront.module.css";

export async function MiranoFooter() {
  const settings = await getSettings();
  return (
    <footer id="site-footer" className={`${styles.footer} mirano-footer`}>
      <div className={styles.footerGrid}>
        <div className={styles.footerBrand}>
          <Link href="/" className={styles.footerLogo}><span><Store size={18} /></span><b>میرانو</b></Link>
          <p>فروشگاه لوازم قنادی و شیرینی‌پزی؛ مرجع تخصصی ابزار، مواد اولیه و آموزش برای قنادهای ایران.</p>
        </div>
        <div>
          <b className={styles.footerHeading}>دسته‌بندی‌ها</b>
          <ul>
            <li><Link href="/shop">قالب و ابزار پخت</Link></li>
            <li><Link href="/shop">مواد اولیه</Link></li>
            <li><Link href="/shop">تزئین و بسته‌بندی</Link></li>
            <li><Link href="/shop">همه محصولات</Link></li>
          </ul>
        </div>
        <div>
          <b className={styles.footerHeading}>دسترسی سریع</b>
          <ul>
            <li><Link href="/blog">مجلهٔ قنادی میرانو</Link></li>
            <li><Link href="/cart">سبد خرید</Link></li>
            <li><Link href="/about">درباره میرانو</Link></li>
            <li><Link href="/customer/tracking">پیگیری سفارش</Link></li>
          </ul>
        </div>
        <div className={styles.contact}>
          <b className={styles.footerHeading}>راهنمای خرید</b>
          <ul>
            <li><Link href="/faq">سؤالات متداول</Link></li>
            <li><Link href="/shipping-delivery">ارسال و تحویل</Link></li>
            <li><Link href="/terms-conditions">شرایط و قوانین</Link></li>
          </ul>
        </div>
        <div className={styles.contact}>
          <b className={styles.footerHeading}>تماس با ما</b>
          {settings.supportPhone && <a href={"tel:" + settings.supportPhone}><Phone size={15} /><span dir="ltr">{settings.supportPhone}</span></a>}
          {settings.supportEmail && <a href={"mailto:" + settings.supportEmail}><Mail size={15} />{settings.supportEmail}</a>}
          {settings.senderAddress && <p><MapPin size={15} />{settings.senderAddress}</p>}
        </div>
      </div>
      <div className={styles.footerBottom}>© {new Date().getFullYear().toLocaleString("fa-IR")} میرانو — تمامی حقوق محفوظ است.</div>
      <FooterScripts code={settings.footerScripts} />
    </footer>
  );
}
