import type { SitePageBlock, SitePageBlockItem } from "@/db/schema";
import type { SettingsShape } from "./settings";
import { identifyBlocks } from "./page-builder";

export function homeBuilderDefaults(blocks: SitePageBlock[], st: Pick<SettingsShape, "siteName" | "heroTitle" | "heroSubtitle" | "returnDays" | "currency" | "multiVendor" | "allowSellerSignup">): SitePageBlock[] {
  const text: Record<string, [string, string, string?, string?]> = {
    hero: [st.heroTitle, st.heroSubtitle, "شروع خرید", "/shop"], trust: ["", ""], categories: ["دسته‌بندی لوازم قنادی", "ابزار و مواد اولیهٔ قنادی را ببینید"],
    popular: [`محبوب‌ترین‌های ${st.siteName}`, "انتخاب‌های پرطرفدار مشتریان"], fresh: ["تازه‌رسیده‌ها", "تازه‌رسیده‌های قنادی"], deals: ["پیشنهادهای ویژه", ""],
    why: ["شیرینی‌پزی حرفه‌ای، از انتخاب ابزار درست شروع می‌شود", "در میرانو ابزار پخت، مواد اولیه و لوازم تزئین را با مشخصات روشن پیدا می‌کنید.", "درباره میرانو", "/about"],
    guarantee: [`همراه شما در خرید و بازگشت تا ${st.returnDays.toLocaleString("fa-IR")} روز`, "شرایط سفارش و بازگشت را پیش از خرید ببینید؛ پشتیبانی برای پاسخ به پرسش‌های انتخاب و سایز در دسترس شماست.", "راهنمای خرید", "/faq"],
    farms: ["برندها و تأمین‌کنندگان منتخب", "با برندها و تأمین‌کنندگان منتخب لوازم قنادی آشنا شوید"], blog: [`از مجله ${st.siteName}`, "آموزش قنادی، انتخاب ابزار و آشنایی با مواد اولیه"], testimonials: ["نظر مشتریان", `تجربه خرید از ${st.siteName}`],
  };
  const pairs = (a: string[][]): SitePageBlockItem[] => a.map(([title, body]) => ({ title, body }));
  const items: Record<string, SitePageBlockItem[]> = {
    trust: pairs([["ابزار مناسب", "انتخاب دقیق‌تر پیش از سفارش"], ["تنوع محصول", "جزئیات هر گزینه در صفحهٔ محصول"], ["پیگیری سفارش", "مشاهده وضعیت از حساب کاربری"], ["پشتیبانی همراه", "پاسخ‌گویی درباره خرید و محصول"]]),
    why: pairs([["برای روزهای روزمره", "ابزار کاربردی قنادی"], ["برای لحظه‌های خاص", "لوازم تزئین برای ایده‌های شیرین"], ["انتخاب با آگاهی", "بررسی مشخصات و تنوع محصول"], ["پخت حرفه‌ای", "انتخاب مواد و ابزار مناسب پخت"]]),
    promo: [{ title: "انتخاب بعدی شما اینجاست", body: "تازه‌رسیده‌ها و پیشنهادهای میرانو را ببینید.", buttonLabel: "شروع خرید", href: "/shop" }, st.multiVendor && st.allowSellerSignup ? { title: "تأمین‌کننده لوازم قنادی هستید؟", body: "محصولات خود را به مشتریان میرانو معرفی کنید.", buttonLabel: "ثبت‌نام فروشندگان", href: "/login?seller=1" } : { title: "برای انتخاب ابزار قنادی راهنمایی می‌خواهید؟", body: "تیم پشتیبانی دربارهٔ ابزار و مواد اولیه همراه شماست.", buttonLabel: "تماس با ما", href: "/contact" }],
  };
  return identifyBlocks(blocks.map((b) => {
    if (b.type !== "store_section") return b;
    const d = text[b.sectionId || ""];
    return { ...b, title: b.title || d?.[0] || "", body: b.body || d?.[1] || "", buttonLabel: b.buttonLabel || d?.[2] || "", href: b.href || d?.[3] || "", items: b.items?.length ? b.items : items[b.sectionId || ""] || [], options: b.sectionId === "hero" ? { badge: "لوازم قنادی میرانو", secondaryLabel: "مشاهده همه محصولات", secondaryHref: "/shop", ...b.options } : b.options };
  }));
}
