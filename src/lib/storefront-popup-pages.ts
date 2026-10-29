export const POPUP_PAGE_OPTIONS = [
  { value: "*", label: "همهٔ صفحات عمومی فروشگاه" },
  { value: "/", label: "صفحهٔ اصلی" },
  { value: "/shop", label: "فروشگاه" },
  { value: "/categories", label: "دسته‌بندی‌ها" },
  { value: "/brands", label: "برندها" },
  { value: "/brands/*", label: "صفحهٔ هر برند" },
  { value: "/products/*", label: "جزئیات محصولات" },
  { value: "/blog", label: "مجله و وبلاگ" },
  { value: "/blog/*", label: "صفحهٔ مقاله‌ها" },
  { value: "/blog/tag/*", label: "موضوع‌های وبلاگ" },
  { value: "/pages/*", label: "صفحات محتوایی" },
  { value: "/forms/*", label: "فرم‌های عمومی" },
  { value: "/about", label: "دربارهٔ ما" },
  { value: "/contact", label: "تماس با ما" },
  { value: "/faq", label: "پرسش‌های متداول" },
  { value: "/shipping-delivery", label: "ارسال و تحویل" },
  { value: "/terms", label: "قوانین و شرایط" },
  { value: "/terms-conditions", label: "شرایط و قوانین فروشگاه" },
  { value: "/cart", label: "سبد خرید" },
] as const;

const popupPageValues = new Set<string>(POPUP_PAGE_OPTIONS.map((option) => option.value));

export function normalizePopupPages(value: unknown): string[] {
  if (!Array.isArray(value)) return ["*"];
  const pages = [...new Set(value.filter((page): page is string => typeof page === "string" && popupPageValues.has(page)))];
  return pages.includes("*") ? ["*"] : pages;
}

export function popupTargetsPath(pages: string[] | undefined, pathname: string) {
  const targets = pages ?? ["*"];
  return targets.some((target) => target === "*" || (target.endsWith("/*") ? pathname.startsWith(target.slice(0, -1)) : pathname === target));
}
