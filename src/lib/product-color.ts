const colorNames: Record<string, string> = {
  "سفید": "#ffffff", "مشکی": "#171717", "طوسی": "#9ca3af", "خاکستری": "#9ca3af", "ذغالی": "#42464f",
  "سرمه ای": "#1e2a5a", "سرمه‌ای": "#1e2a5a", "آبی": "#2563eb", "آبی روشن": "#60a5fa", "سبز": "#27845b",
  "قهوه ای": "#795548", "قهوه‌ای": "#795548", "کرم": "#e8d8bd", "اِکرو": "#e8ddc7", "اکرو": "#e8ddc7",
  "بژ": "#d6c2a1", "ویزون": "#92847b", "ایندیگو": "#4f46e5", "قرمز": "#d33b45", "زرشکی": "#8f2538",
  "صورتی": "#e88ea7", "گلبهی": "#f3aa91", "زرد": "#e8c547", "نارنجی": "#e9823e", "بنفش": "#8b5cf6",
  "زیتونی": "#737b45", "کله غازی": "#287d79", "طلایی": "#c9a64b", "نقره ای": "#c4c8cf", "نقره‌ای": "#c4c8cf",
  "لیمویی": "#c8d84a", "رنگین کمانی": "#8b5cf6",
};

export function isColorOptionName(name: string) {
  return /رنگ|colou?r/i.test(name);
}

export function defaultColorHex(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ").replace(/ي/g, "ی").replace(/ك/g, "ک").toLowerCase();
  return colorNames[normalized] ?? "#e5e7eb";
}

export function colorHexFor(value: string, explicit?: string) {
  return explicit && /^#[0-9a-f]{6}$/i.test(explicit) ? explicit : defaultColorHex(value);
}
