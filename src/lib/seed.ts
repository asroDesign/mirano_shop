import { readFileSync, existsSync } from "fs";
import path from "path";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  accounts, affiliateProfiles, categories, media, productImages, products, productVariants, sellerOffers, sellers, settings, smsTemplates,
  supplyQuotes, supplyRequests, ticketMessages, tickets, users, wallets, sellerShipments, ticketDepartments, detailAccounts, carriers, carrierRates, discountCodes, festivals,
} from "@/db/schema";
import { CHART, postJournal } from "./accounting";
import { DEFAULT_SETTINGS } from "./settings";
import { SMS_EVENTS } from "./sms";
import { normalizePn } from "./util";
import { newMediaPath, writeMediaFile } from "./media-storage";

let seeding: Promise<void> | null = null;

export function ensureSeeded() {
  if (!seeding) seeding = run().then(ensureExtras).catch((e) => { seeding = null; console.error("seed failed", e); });
  return seeding;
}

async function run() {
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(users);
  if (Number(c) > 0) return;
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(99123)");
    const again = await db.select({ c: sql<number>`count(*)::int` }).from(users);
    if (Number(again[0].c) > 0) return;
    await seed();
  } finally {
    await client.query("select pg_advisory_unlock(99123)");
    client.release();
  }
}

async function seed() {
  const { hashPassword } = await import("./auth");
  const svcOrders = await import("./services/orders");
  const svcCatalog = await import("./services/catalog");
  const svcWallet = await import("./services/wallet");
  const svcSupply = await import("./services/supply");

  await db.insert(settings).values(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })));
  const codeToId = new Map<string, number>();
  for (const a of CHART) {
    const [row] = await db.insert(accounts).values({ code: a.code, name: a.name, level: a.level, type: a.type, parentId: a.parent ? codeToId.get(a.parent) : null }).returning();
    codeToId.set(a.code, row.id);
  }
  await db.insert(smsTemplates).values(Object.entries(SMS_EVENTS).map(([event, v], i) => ({ event, title: v.title, body: v.body, variables: v.vars, patternId: String(100100 + i) })));

  const pw = hashPassword("Demo@1234");
  const mk = async (name: string, phone: string, role: string) => (await db.insert(users).values({ name, phone, role, passwordHash: pw, email: `${phone}@example.test` }).returning())[0];
  const admin = await mk("مدیر کل سامانه", "09143132742", "super_admin");
  await mk("سارا کریمی", "09120000002", "marketplace_manager");
  const proc = await mk("حمید نوری", "09120000003", "procurement_manager");
  const wh = await mk("رضا صادقی", "09120000004", "warehouse_manager");
  await mk("نرگس فرهادی", "09120000005", "accountant");
  const sup = await mk("امیر حسینی", "09120000006", "support");
  await mk("لیلا مرادی", "09120000007", "catalog_manager");
  const c1 = await mk("علی رضایی", "09121111111", "customer");
  const c2 = await mk("مریم احمدی", "09122222222", "customer");

  const sellerDefs = [
    { name: "محمد پارسا", phone: "09123333331", shop: "مزون پارسا", city: "تهران", province: "تهران", status: "approved", rate: 8, rating: 4.9 },
    { name: "کامران تهرانی", phone: "09123333332", shop: "بوتیک کاملیا", city: "اردبیل", province: "اردبیل", status: "approved", rate: 7, rating: 4.7 },
    { name: "جواد شرقی", phone: "09123333333", shop: "پوشاک شرقی", city: "مشهد", province: "خراسان رضوی", status: "approved", rate: 9, rating: 4.5 },
    { name: "بهرام نوروزی", phone: "09123333334", shop: "مزون نوروزی", city: "اصفهان", province: "اصفهان", status: "pending", rate: 8, rating: 0 },
  ];
  const sellerRows: (typeof sellers.$inferSelect)[] = [];
  for (const d of sellerDefs) {
    const u = await mk(d.name, d.phone, "seller");
    const [s] = await db.insert(sellers).values({
      userId: u.id, shopName: d.shop, city: d.city, province: d.province, status: d.status, contractStatus: d.status === "approved" ? "signed" : "pending",
      commissionRate: d.rate, rating: d.rating, iban: "IR820540102680020817909002", nationalId: "0012345678", legalDocs: "جواز کسب، کارت بازرگانی",
    }).returning();
    await db.insert(wallets).values({ sellerId: s.id });
    sellerRows.push(s);
  }
  const [s1, s2, s3] = sellerRows;

  await postJournal(db, "سرمایه اولیه", [{ code: "1101", debit: 800_000_000 }, { code: "3101", credit: 800_000_000 }], undefined, admin.id);

  const cats = ["مانتو و رویه", "شومیز و بلوز", "شلوار زنانه", "دامن", "پیراهن و سارافون", "کیف و اکسسوری"];
  const catRows = await db.insert(categories).values(cats.map((name, i) => ({ name, slug: `cat-${i + 1}` }))).returning();

  const img: Record<string, number | null> = {};
  const editorialPath = path.join(process.cwd(), "public", "images", "boutique-editorial.svg");
  if (existsSync(editorialPath)) {
    const data = readFileSync(editorialPath);
    const storagePath = newMediaPath("boutique-editorial.svg");
    await writeMediaFile(storagePath, data);
    const [m] = await db.insert(media).values({ filename: "boutique-editorial.svg", mime: "image/svg+xml", size: data.length, storagePath, uploadedBy: admin.id }).returning();
    img.boutique = m.id;
  } else img.boutique = null;

  type P = { fa: string; en: string; sku: string; pn: string; oem: string; x: string[]; brand: string; country: string; cat: number; auth: string; price: number; cmp: number; img: string; src: "central" | "marketplace"; stock: number; cost: number; compat: [string, string, string][]; specs: [string, string][] };
  const defs: P[] = [
    { fa: "مانتو کتی زنانه مدل آوین", en: "Avin Women Blazer Coat", sku: "BOUT-COAT-101", pn: "MH-101", oem: "MH-101", x: ["مانتو کتی آوین", "Avin Coat"], brand: "بوتیک مه‌لقا", country: "ترکیه", cat: 0, auth: "Original", price: 2850000, cmp: 3200000, img: "boutique", src: "central", stock: 40, cost: 1950000, compat: [["روزمره", "", ""], ["رسمی", "", ""]], specs: [["جنس پارچه", "لینن ترکیبی"], ["فرم", "آزاد"], ["قد لباس", "۸۵ سانتی‌متر"], ["مناسب فصل", "بهار و پاییز"]] },
    { fa: "شومیز لینن زنانه مدل آوا", en: "Ava Linen Blouse", sku: "BOUT-BLOUSE-102", pn: "MH-102", oem: "MH-102", x: ["شومیز آوا", "Ava Blouse"], brand: "کاملیا", country: "ترکیه", cat: 1, auth: "Original", price: 1250000, cmp: 1450000, img: "boutique", src: "marketplace", stock: 0, cost: 0, compat: [["روزمره", "", ""], ["بهار و تابستان", "", ""]], specs: [["جنس پارچه", "لینن"], ["فرم", "آزاد"], ["مدل یقه", "مردانه"], ["نوع آستین", "بلند"]] },
    { fa: "شلوار جین مام‌فیت مدل کیانا", en: "Kiana Mom Fit Jeans", sku: "BOUT-JEANS-103", pn: "MH-103", oem: "MH-103", x: ["شلوار جین کیانا", "Kiana Jeans"], brand: "بوتیک مه‌لقا", country: "ترکیه", cat: 2, auth: "Original", price: 1890000, cmp: 2150000, img: "boutique", src: "central", stock: 120, cost: 1180000, compat: [["روزمره", "", ""], ["استایل کژوال", "", ""]], specs: [["جنس", "دنیم"], ["فاق", "متوسط"], ["فرم", "مام‌فیت"], ["نوع بسته‌شدن", "زیپ و دکمه"]] },
    { fa: "دامن میدی پلیسه زنانه", en: "Women Pleated Midi Skirt", sku: "BOUT-SKIRT-104", pn: "MH-104", oem: "MH-104", x: ["دامن پلیسه", "Pleated Skirt"], brand: "پوشاک شرقی", country: "ایران", cat: 3, auth: "Original", price: 1450000, cmp: 0, img: "boutique", src: "marketplace", stock: 0, cost: 0, compat: [["مهمانی", "", ""], ["روزمره", "", ""]], specs: [["جنس پارچه", "کرپ"], ["قد", "میدی"], ["فرم", "کلوش"], ["مناسب فصل", "چهارفصل"]] },
    { fa: "پیراهن زنانه مدل رها", en: "Raha Women Dress", sku: "BOUT-DRESS-105", pn: "MH-105", oem: "MH-105", x: ["پیراهن رها", "Raha Dress"], brand: "بوتیک مه‌لقا", country: "ترکیه", cat: 4, auth: "Original", price: 2390000, cmp: 2690000, img: "boutique", src: "central", stock: 60, cost: 1680000, compat: [["مهمانی", "", ""], ["روزمره", "", ""]], specs: [["جنس پارچه", "کتان"], ["فرم", "راسته"], ["قد", "بلند"], ["آستین", "سه‌ربع"]] },
    { fa: "بلوز بافت زنانه مدل نیکا", en: "Nika Knit Top", sku: "BOUT-KNIT-106", pn: "MH-106", oem: "MH-106", x: ["بلوز بافت نیکا", "Nika Knit"], brand: "کاملیا", country: "ترکیه", cat: 1, auth: "Original", price: 1690000, cmp: 0, img: "boutique", src: "marketplace", stock: 0, cost: 0, compat: [["روزمره", "", ""], ["پاییز و زمستان", "", ""]], specs: [["جنس", "بافت نرم"], ["فرم", "آزاد"], ["یقه", "گرد"], ["آستین", "بلند"]] },
    { fa: "کیف دستی زنانه مدل آیلین", en: "Aylin Handbag", sku: "BOUT-BAG-107", pn: "MH-107", oem: "MH-107", x: ["کیف آیلین", "Aylin Bag"], brand: "بوتیک مه‌لقا", country: "ترکیه", cat: 5, auth: "Original", price: 1950000, cmp: 0, img: "boutique", src: "central", stock: 18, cost: 1250000, compat: [["روزمره", "", ""], ["مهمانی", "", ""]], specs: [["جنس", "چرم مصنوعی"], ["نحوه حمل", "دستی"], ["ابعاد", "۲۴ × ۱۸ سانتی‌متر"], ["بند", "قابل تنظیم"]] },
    { fa: "پالتو زنانه مدل باران", en: "Baran Women Coat", sku: "BOUT-COAT-108", pn: "MH-108", oem: "MH-108", x: ["پالتو باران", "Baran Coat"], brand: "پوشاک شرقی", country: "ترکیه", cat: 0, auth: "Original", price: 3250000, cmp: 3650000, img: "boutique", src: "marketplace", stock: 0, cost: 0, compat: [["رسمی", "", ""], ["پاییز و زمستان", "", ""]], specs: [["جنس پارچه", "فوتر"], ["فرم", "آزاد"], ["قد", "۱۱۰ سانتی‌متر"], ["آستر", "دارد"]] },
    { fa: "کیف دوشی زنانه مدل مهتاب", en: "Mahtab Shoulder Bag", sku: "BOUT-BAG-109", pn: "MH-109", oem: "MH-109", x: ["کیف دوشی مهتاب", "Mahtab Bag"], brand: "بوتیک مه‌لقا", country: "ترکیه", cat: 5, auth: "Original", price: 1580000, cmp: 0, img: "boutique", src: "central", stock: 2, cost: 980000, compat: [["روزمره", "", ""]], specs: [["جنس", "چرم مصنوعی"], ["نحوه حمل", "دوشی"], ["ابعاد", "۲۲ × ۱۶ سانتی‌متر"], ["بند", "قابل تنظیم"]] },
    { fa: "کت تک زنانه مدل یلدا", en: "Yalda Women Blazer", sku: "BOUT-BLAZER-110", pn: "MH-110", oem: "MH-110", x: ["کت یلدا", "Yalda Blazer"], brand: "مزون نوروزی", country: "ایران", cat: 0, auth: "Original", price: 2450000, cmp: 0, img: "boutique", src: "central", stock: 12, cost: 1580000, compat: [["رسمی", "", ""], ["مهمانی", "", ""]], specs: [["جنس پارچه", "کرپ مازراتی"], ["فرم", "نیمه‌آزاد"], ["قد", "۷۵ سانتی‌متر"], ["آستر", "دارد"]] },
  ];

  const pids: number[] = [];
  const ctx = { userId: admin.id, ip: "seed", ua: "seed" };
  for (const d of defs) {
    const [p] = await db.insert(products).values({
      nameFa: d.fa, nameEn: d.en, sku: d.sku, partNumber: d.pn, normalizedPn: normalizePn(d.pn), oemNumber: d.oem, crossRefs: d.x, brand: d.brand,
      manufacturer: d.brand, country: d.country, categoryId: catRows[d.cat].id, authenticity: d.auth, basePrice: d.price, compareAtPrice: d.cmp,
      shortDesc: `${d.fa}؛ مناسب برای ${d.compat.map((c) => c[0]).join(" و ")}، با امکان بررسی سایز و مشخصات در صفحه محصول.`,
      description: `${d.fa} از برند ${d.brand} و تولید ${d.country} است. برای انتخاب سایز، راهنمای درج‌شده در صفحه را ببینید. جزئیات پارچه، فرم و شرایط شست‌وشو در مشخصات محصول آمده است.`,
      technicalReview: `برای ست‌کردن ${d.fa} می‌توانید از رنگ‌های خنثی و اکسسوری‌های ساده استفاده کنید. پیش از سفارش، سایزبندی و اندازه‌های ثبت‌شده را با لباس مناسب خود مقایسه کنید.`,
      specs: d.specs.map(([k, v]) => ({ k, v })), compatibility: d.compat.map(([make, model, years]) => ({ make, model, years })), organicInfo: { suitableFor: d.compat.map((c) => c[0]) },
      weight: 700, barcode: `626${Math.floor(Math.random() * 1e10)}`, seoTitle: `خرید ${d.fa} | بوتیک مه‌لقا`, metaDesc: `مشاهده رنگ، سایز و مشخصات ${d.fa} از بوتیک مه‌لقا.`,
      slug: d.en.toLowerCase().replace(/[^a-z0-9]+/g, "-"), mainImageId: img[d.img], source: d.src, createdBy: admin.id,
      ownerSellerId: d.src === "marketplace" ? s1.id : null, status: "active", lowStockThreshold: 3,
    }).returning();
    if (img[d.img]) await db.insert(productImages).values({ productId: p.id, mediaId: img[d.img]!, sortOrder: 0 });
    if (d.src === "central" && d.stock > 0) await svcCatalog.receiveStock(ctx, p.id, d.stock, d.cost, 2_000_000, d.auth === "Original" ? 1_500_000 : 0, "موجودی اولیه");
    pids.push(p.id);
  }
  // Color × size variants for the seeded boutique dress.
  const color = "رنگ", size = "سایز";
  await db.insert(productVariants).values([
    { productId: pids[4], title: "کرم / ۳۸", attrs: { [color]: "کرم", [size]: "۳۸" }, sku: "BOUT-DRESS-105-CR-38", price: 2390000, onHand: 8 },
    { productId: pids[4], title: "کرم / ۴۰", attrs: { [color]: "کرم", [size]: "۴۰" }, sku: "BOUT-DRESS-105-CR-40", price: 2390000, onHand: 10 },
    { productId: pids[4], title: "کرم / ۴۲", attrs: { [color]: "کرم", [size]: "۴۲" }, sku: "BOUT-DRESS-105-CR-42", price: 2390000, onHand: 6 },
    { productId: pids[4], title: "زرشکی / ۳۸", attrs: { [color]: "زرشکی", [size]: "۳۸" }, sku: "BOUT-DRESS-105-BG-38", price: 2390000, onHand: 4 },
    { productId: pids[4], title: "زرشکی / ۴۰", attrs: { [color]: "زرشکی", [size]: "۴۰" }, sku: "BOUT-DRESS-105-BG-40", price: 2390000, onHand: 5 },
    { productId: pids[4], title: "زرشکی / ۴۲", attrs: { [color]: "زرشکی", [size]: "۴۲" }, sku: "BOUT-DRESS-105-BG-42", price: 2390000, onHand: 4 },
  ]);
  await db.update(products).set({ onHand: sql`${products.onHand} + 37`, options: [{ name: color, values: ["کرم", "زرشکی"], colorCodes: { "کرم": "#e8dcc7", "زرشکی": "#7a243f" } }, { name: size, values: ["۳۸", "۴۰", "۴۲"] }] }).where(eq(products.id, pids[4]));

  const offer = async (pi: number, s: typeof s1, price: number, stock: number, ship: number, prep: number, buy = false, status = "approved", sale: number | null = null) =>
    (await db.insert(sellerOffers).values({ productId: pids[pi], sellerId: s.id, price, costPrice: Math.round((sale ?? price) * 0.75), salePrice: sale, stock, shippingCost: ship, prepDays: prep, shipCity: s.city, shipProvince: s.province, warranty: "مطابق شرایط بازگشت فروشگاه", status, isBuyBox: buy }).returning())[0];
  const o1 = await offer(0, s1, 1390000, 25, 60000, 1, true);
  await offer(0, s2, 1420000, 10, 45000, 2);
  const o3 = await offer(1, s1, 6750000, 8, 80000, 1, true);
  await offer(1, s3, 6490000, 4, 120000, 3);
  const o5 = await offer(2, s2, 175000, 60, 45000, 1);
  await offer(3, s1, 510000, 30, 60000, 1, true);
  await offer(3, s2, 495000, 12, 45000, 2, false, "approved", 480000);
  await offer(5, s1, 415000, 40, 60000, 1, true);
  await offer(5, s3, 399000, 25, 120000, 2);
  const o10 = await offer(7, s2, 4850000, 6, 90000, 2, true);
  await offer(7, s3, 4700000, 3, 120000, 4, false, "pending");
  await offer(9, s3, 230000, 20, 120000, 2, true);

  // A pending seller product awaiting approval
  await db.insert(products).values({
    nameFa: "مانتو لینن زنانه مدل آناهیتا", nameEn: "Anahita Linen Coat", sku: "BOUT-COAT-111", partNumber: "MH-111", normalizedPn: "MH111", brand: "بوتیک کاملیا", country: "ترکیه",
    categoryId: catRows[0].id, authenticity: "Original", basePrice: 2780000, slug: "anahita-linen-coat", source: "marketplace", ownerSellerId: s2.id, status: "pending",
    shortDesc: "مانتو لینن زنانه با فرم آزاد؛ رنگ و سایز پس از تأیید تکمیل می‌شود.", compatibility: [{ make: "روزمره", model: "", years: "" }],
  });

  // Orders through real flows
  const addr = (u: typeof c1) => ({ fullName: u.name, phone: u.phone, province: "تهران", city: "تهران", address: "تهران، خیابان ولیعصر، کوچه نسترن، پلاک ۸", postalCode: "1968913111" });
  const cctx = (u: typeof c1) => ({ userId: u.id, ip: "seed", ua: "seed" });
  const ord1 = await svcOrders.placeOrder(cctx(c1), [{ productId: pids[2], qty: 2 }, { productId: pids[0], offerId: o1.id, qty: 1 }, { productId: pids[7], offerId: o10.id, qty: 1 }], addr(c1), "seed-o1");
  await svcOrders.payOrder(cctx(c1), ord1.id, "seed-p1");
  const shs1 = await db.select().from(sellerShipments).where(eq(sellerShipments.orderId, ord1.id));
  for (const sh of shs1) {
    const scope = { sellerId: sh.sellerId, staff: true };
    const wctx = { userId: wh.id };
    await svcOrders.updateShipment(wctx, sh.id, { status: "preparing" }, scope);
    await svcOrders.updateShipment(wctx, sh.id, { status: "ready", packageCount: 1 }, scope);
    await svcOrders.updateShipment(wctx, sh.id, { status: "shipped", carrier: "پست پیشتاز", trackingNumber: `2${Math.floor(Math.random() * 1e11)}` }, scope);
  }
  await svcOrders.confirmReceipt(cctx(c1), ord1.id);

  const ord2 = await svcOrders.placeOrder(cctx(c2), [{ productId: pids[1], offerId: o3.id, qty: 1 }, { productId: pids[2], offerId: o5.id, qty: 3 }, { productId: pids[6], qty: 1 }], addr(c2), "seed-o2");
  await svcOrders.payOrder(cctx(c2), ord2.id, "seed-p2");
  const shs2 = await db.select().from(sellerShipments).where(eq(sellerShipments.orderId, ord2.id));
  const shS1 = shs2.find((s) => s.sellerId === s1.id)!;
  await svcOrders.updateShipment({ userId: admin.id }, shS1.id, { status: "preparing" }, { sellerId: s1.id, staff: false });
  await svcOrders.updateShipment({ userId: admin.id }, shS1.id, { status: "ready", packageCount: 1 }, { sellerId: s1.id, staff: false });
  await svcOrders.updateShipment({ userId: admin.id }, shS1.id, { status: "shipped", carrier: "تیپاکس", trackingNumber: "TPX-88213094" }, { sellerId: s1.id, staff: false });

  await svcOrders.placeOrder(cctx(c1), [{ productId: pids[4], qty: 2 }, { productId: pids[4], variantId: undefined, qty: 1 }], addr(c1), "seed-o3").catch(() => null);
  const ord4 = await svcOrders.placeOrder(cctx(c2), [{ productId: pids[8], qty: 1 }], addr(c2), "seed-o4");
  await svcOrders.cancelOrder(cctx(c2), ord4.id, { staff: false }, "انصراف مشتری");

  // Wallet withdrawal
  await svcWallet.requestWithdrawal({ userId: s1.userId }, s1.id, 500000, "IR820540102680020817909002", "seed-w1").catch(() => null);

  // Supply requests
  const mkReq = async (u: typeof c1, v: Partial<typeof supplyRequests.$inferInsert>, n: string) =>
    (await db.insert(supplyRequests).values({ customerId: u.id, number: n, ...v, normalizedPn: normalizePn(v.partNumber ?? "") }).returning())[0];
  await mkReq(c1, { method: "part_number", partNumber: "", partName: "مانتو لینن زنانه رنگ کرم سایز ۴۰", carMake: "بوتیک مه‌لقا", carModel: "رنگ کرم", carYear: "سایز ۴۰", qty: 2, priority: "high", description: "دوخت تمیز و اندازه مطابق راهنمای سایز باشد" }, "RQ-1001");
  const r2 = await mkReq(c2, { method: "vin", partNumber: "", partName: "کیف دوشی زنانه مدل مینیمال", carMake: "مه‌لقا", carModel: "رنگ مشکی", carYear: "ابعاد متوسط", vin: "MH-112", qty: 3 }, "RQ-1002");
  await svcSupply.staffSupplyAction({ userId: proc.id }, r2.id, { action: "review" });
  await svcSupply.staffSupplyAction({ userId: proc.id }, r2.id, { action: "search" });
  await svcSupply.staffSupplyAction({ userId: proc.id }, r2.id, { action: "rfq" });
  const qs = await db.select().from(supplyQuotes).where(eq(supplyQuotes.requestId, r2.id));
  await svcSupply.sellerQuote({ userId: s1.userId }, s1.id, qs[0].id, { price: 7400000, stock: 2, leadDays: 3, brand: "برند اروپایی", note: "رنگ و مشخصات مطابق درخواست" });
  const r3 = await mkReq(c1, { method: "part_number", partNumber: "MH-113", partName: "شلوار جین زنانه راسته", carMake: "برند ترک", carModel: "رنگ آبی", carYear: "سایز ۳۸ تا ۴۴", qty: 4 }, "RQ-1003");
  await svcSupply.staffSupplyAction({ userId: proc.id }, r3.id, { action: "review" });
  await svcSupply.staffSupplyAction({ userId: proc.id }, r3.id, { action: "search" });
  await svcSupply.staffSupplyAction({ userId: proc.id }, r3.id, { action: "calculate", margin: 15 });
  await svcSupply.staffSupplyAction({ userId: proc.id }, r3.id, { action: "send_quotation" });

  // Tickets
  const [t1] = await db.insert(tickets).values({ number: "TK-5001", customerId: c1.id, subject: "زمان ارسال سفارش", department: "orders", priority: "normal", status: "pending_staff", orderId: ord1.id }).returning();
  await db.insert(ticketMessages).values([
    { ticketId: t1.id, userId: c1.id, body: "سلام، سفارش من چه زمانی ارسال می‌شود؟" },
    { ticketId: t1.id, userId: sup.id, body: "مشتری پیگیر است؛ با انبار هماهنگ شود.", isInternal: true },
  ]);
  await db.insert(tickets).values({ number: "TK-5002", customerId: c2.id, subject: "راهنمای انتخاب سایز پیراهن", department: "technical", priority: "high", status: "open" });
}

/** Idempotent upgrades for data added in later versions. Safe to run on every boot. */
export async function ensureExtras() {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(99124)");
    const deps = await db.select().from(ticketDepartments);
    if (!deps.length) {
      await db.insert(ticketDepartments).values([
        { key: "support", name: "پشتیبانی عمومی", sortOrder: 1 }, { key: "orders", name: "سفارش‌ها و ارسال", sortOrder: 2 },
        { key: "technical", name: "راهنمای انتخاب لباس و محصولات", sortOrder: 3 }, { key: "finance", name: "مالی و پرداخت", sortOrder: 4 },
        { key: "sellers", name: "امور فروشندگان", sortOrder: 5 },
      ]);
    }
    let det = await db.select().from(detailAccounts);
    if (!det.length) {
      const [p] = await db.insert(detailAccounts).values({ code: "1", name: "اشخاص", level: 1 }).returning();
      await db.insert(detailAccounts).values([{ code: "2", name: "مراکز هزینه", level: 1 }, { code: "3", name: "پروژه‌ها", level: 1 }]);
      const [cc] = await db.select().from(detailAccounts).where(eq(detailAccounts.code, "2"));
      await db.insert(detailAccounts).values([
        { code: "S", name: "فروشندگان مارکت‌پلیس", level: 2, parentId: p.id }, { code: "C", name: "مشتریان", level: 2, parentId: p.id },
        { code: "V", name: "تأمین‌کنندگان انبار مرکزی", level: 2, parentId: p.id },
        { code: "201", name: "انبار مرکزی", level: 2, parentId: cc.id }, { code: "202", name: "واحد فروش", level: 2, parentId: cc.id },
      ]);
      det = await db.select().from(detailAccounts);
    }
    const sParent = det.find((d) => d.code === "S");
    let affiliateParent = det.find((d) => d.code === "A");
    if (!affiliateParent) {
      const personRoot = det.find((d) => d.code === "1");
      [affiliateParent] = await db.insert(detailAccounts).values({ code: "A", name: "همکاران فروش", level: 2, parentId: personRoot?.id ?? null }).returning();
    }
    const allSellers = await db.select().from(sellers);
    for (const sl of allSellers) {
      if (!det.some((d) => d.code === `S-${sl.id}`)) await db.insert(detailAccounts).values({ code: `S-${sl.id}`, name: sl.shopName, level: 3, parentId: sParent?.id ?? null });
    }
    const affiliateRows = await db.select({ userId: affiliateProfiles.userId }).from(affiliateProfiles);
    for (const profile of affiliateRows) {
      if (!det.some((d) => d.code === `A-${profile.userId}`)) {
        const [owner] = await db.select({ name: users.name }).from(users).where(eq(users.id, profile.userId));
        await db.insert(detailAccounts).values({ code: `A-${profile.userId}`, name: owner?.name || `همکار ${profile.userId}`, level: 3, parentId: affiliateParent.id });
      }
    }
    await db.execute(sql`update journal_lines l set detail1_id = d.id from detail_accounts d where l.detail1_id is null and l.detail1 like 'seller:%' and d.code = 'S-' || substring(l.detail1 from 8)`);
    // SMS: an extra alternative pattern for shipping (multiple templates per event)
    const extra = await db.select().from(smsTemplates).where(eq(smsTemplates.event, "order_shipped"));
    if (extra.length === 1) {
      await db.update(smsTemplates).set({ isSystem: true }).where(sql`true`);
      await db.insert(smsTemplates).values({ event: "order_shipped", title: "ارسال سفارش - همراه لینک رهگیری", body: "مشتری گرامی، مرسوله سفارش {order} تحویل پست شد. رهگیری: https://tracking.post.ir/?id={tracking}", variables: ["order", "tracking"], isActive: false, patternId: "200201" });
    }
    await ensureMarketing();
    const [birthdayTpl] = await db.select().from(smsTemplates).where(eq(smsTemplates.event, "birthday"));
    if (!birthdayTpl) await db.insert(smsTemplates).values({ event: "birthday", title: SMS_EVENTS.birthday.title, body: SMS_EVENTS.birthday.body, variables: ["name"], patternId: "", isActive: true, isSystem: true });
    const [otpTpl] = await db.select().from(smsTemplates).where(eq(smsTemplates.event, "otp_login"));
    if (!otpTpl) await db.insert(smsTemplates).values({ event: "otp_login", title: "کد ورود یک‌بارمصرف (OTP)", body: SMS_EVENTS.otp_login.body, variables: ["code"], patternId: "100099", isSystem: true });
    for (const event of ["cart_reminder", "cart_discount", "review_request"] as const) {
      const [tpl] = await db.select({ id: smsTemplates.id }).from(smsTemplates).where(eq(smsTemplates.event, event)).limit(1);
      if (!tpl) {
        const def = SMS_EVENTS[event];
        await db.insert(smsTemplates).values({ event, title: def.title, body: def.body, variables: def.vars, patternId: "", isActive: true, isSystem: true });
      }
    }
  } finally {
    await client.query("select pg_advisory_unlock(99124)");
    client.release();
  }
}

async function ensureMarketing() {
  const [acc] = await db.select().from(accounts).where(eq(accounts.code, "5301"));
  if (!acc) {
    const [grp] = await db.select().from(accounts).where(eq(accounts.code, "5"));
    await db.insert(accounts).values({ code: "5301", name: "هزینه تخفیفات و جشنواره‌ها", level: "subsidiary", type: "expense", parentId: grp?.id ?? null });
  }
  for (const [code, name, parentCode, type] of [
    ["2105", "پورسانت همکاران فروش پرداختنی", "21", "liability"],
    ["5302", "هزینه پورسانت همکاری در فروش", "5", "expense"],
  ] as const) {
    const [existing] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, code));
    if (!existing) {
      const [parent] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, parentCode));
      await db.insert(accounts).values({ code, name, level: "subsidiary", type, parentId: parent?.id ?? null });
    }
  }
  const cs = await db.select().from(carriers);
  if (!cs.length) {
    const [post] = await db.insert(carriers).values({ name: "پست پیشتاز", code: "post", trackingUrl: "https://tracking.post.ir/?id={code}", baseCost: 65000, perKgCost: 18000, minDays: 2, maxDays: 5, sortOrder: 1 }).returning();
    const [tpx] = await db.insert(carriers).values({ name: "تیپاکس", code: "tipax", trackingUrl: "https://tipaxco.com/tracking?code={code}", baseCost: 95000, perKgCost: 25000, minDays: 1, maxDays: 3, sortOrder: 2 }).returning();
    await db.insert(carriers).values({ name: "چاپار", code: "chapar", trackingUrl: "https://chaparnet.com/track/{code}", baseCost: 85000, perKgCost: 22000, minDays: 1, maxDays: 4, sortOrder: 3 });
    const [peyk] = await db.insert(carriers).values({ name: "پیک موتوری (فقط تهران)", code: "peyk", baseCost: 999000, perKgCost: 0, minDays: 0, maxDays: 1, sortOrder: 4 }).returning();
    await db.insert(carrierRates).values([
      { carrierId: post.id, province: "تهران", city: "تهران", minWeight: 0, maxWeight: 2000, cost: 55000 }, { carrierId: post.id, province: "تهران", city: "تهران", minWeight: 2001, maxWeight: 10000, cost: 90000 },
      { carrierId: post.id, city: null, minWeight: 0, maxWeight: 2000, cost: 75000 }, { carrierId: post.id, city: null, minWeight: 2001, maxWeight: 10000, cost: 130000 },
      { carrierId: tpx.id, province: "تهران", city: "تهران", minWeight: 0, maxWeight: 5000, cost: 80000 }, { carrierId: tpx.id, province: "خراسان رضوی", city: "مشهد", minWeight: 0, maxWeight: 5000, cost: 140000 },
      { carrierId: peyk.id, province: "تهران", city: "تهران", minWeight: 0, maxWeight: 20000, cost: 120000 },
    ]);
  }
  const ds = await db.select().from(discountCodes);
  if (!ds.length) {
    const [ali] = await db.select().from(users).where(eq(users.phone, "09121111111"));
    const cats = await db.select().from(categories);
    const apparel = cats.find((c) => c.name === "مانتو و رویه");
    const [featured] = await db.select().from(products).where(eq(products.sku, "BOUT-DRESS-105"));
    const in30 = new Date(Date.now() + 30 * 864e5);
    await db.insert(discountCodes).values([
      { code: "WELCOME10", title: "۱۰٪ خوش‌آمدگویی", type: "percent", value: 10, maxDiscount: 300000, minOrder: 500000, perUserLimit: 1, endsAt: in30 },
      { code: "ALI-VIP", title: "هدیه ویژه آقای رضایی", type: "fixed", value: 200000, customerId: ali?.id ?? null, perUserLimit: 3, usageLimit: 3 },
      { code: "BOUTIQUE15", title: "۱۵٪ تخفیف پوشاک زنانه", type: "percent", value: 15, categoryIds: apparel ? [apparel.id] : [], perUserLimit: 2 },
      { code: "STYLE50", title: "۵۰ هزار تومان تخفیف پیراهن منتخب", type: "fixed", value: 50000, productIds: featured ? [featured.id] : [], perUserLimit: 1 },
    ]);
  }
  const fs = await db.select().from(festivals);
  if (!fs.length) {
    const cats = await db.select().from(categories);
    const ids = cats.filter((c) => ["مانتو و رویه", "شومیز و بلوز"].includes(c.name)).map((c) => c.id);
    await db.insert(festivals).values({ title: "جشنواره پاییزی پوشاک", slug: "autumn-style", description: "پیشنهادهای فصل برای استایل پاییزی", color: "#9f1239", discountPercent: 12, startsAt: new Date(Date.now() - 864e5), endsAt: new Date(Date.now() + 12 * 864e5), categoryIds: ids });
  }
}
