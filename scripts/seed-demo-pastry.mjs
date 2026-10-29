import "dotenv/config";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const projectRoot = process.cwd();
const mediaRoot = path.resolve(process.env.MEDIA_STORAGE_ROOT || path.join(projectRoot, "storage", "media"));
const mediaDirectory = path.join(mediaRoot, "uploads", "demo-pastry-products");
const assetDirectory = path.join(projectRoot, "public", "images", "demo-pastry-products");
const adminPhone = "09143132742";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
});

const categories = [
  { name: "قالب و ابزار پخت", slug: "pastry-baking-tools", description: "قالب‌ها و ابزارهای کاربردی برای پخت کیک و شیرینی" },
  { name: "قیف و ماسوره", slug: "pastry-piping", description: "قیف، ماسوره و ابزار تزئین شیرینی" },
  { name: "ابزار قنادی", slug: "pastry-utensils", description: "ابزار آماده‌سازی و شیرینی‌پزی" },
  { name: "تزیین کیک", slug: "pastry-cake-decor", description: "فوندانت، مروارید خوراکی و لوازم تزیین کیک" },
];

const assets = [
  { file: "pastry-cake-pans.webp", alt: "ست قالب‌های گرد کیک با روکش نچسب" },
  { file: "pastry-piping-nozzles.webp", alt: "ست ماسوره‌های فلزی و قیف شیرینی‌پزی" },
  { file: "pastry-silicone-tools.webp", alt: "ست ابزار سیلیکونی قنادی در رنگ سبز روشن" },
  { file: "pastry-fondant-decor.webp", alt: "خمیر فوندانت رنگی و ترافل‌های تزیینی خوراکی" },
];

const products = [
  { fa: "ست قالب کمربندی کیک ۳ عددی", en: "Three Piece Springform Cake Pan Set", sku: "DEMO-CAKE-PAN-001", slug: "three-piece-springform-cake-pan-set", category: 0, image: 0, price: 690000, compare: 820000, stock: 18, cost: 390000, weight: 1250, desc: "سه قالب کمربندی در اندازه‌های کاربردی برای پخت کیک‌های خانگی و لایه‌ای.", specs: [{ k: "تعداد", v: "۳ عدد" }, { k: "جنس", v: "فلز با روکش نچسب" }, { k: "کاربرد", v: "کیک و دسرهای قالبی" }] },
  { fa: "قالب مافین نچسب ۱۲ خانه", en: "12 Cup Nonstick Muffin Pan", sku: "DEMO-MUFFIN-002", slug: "12-cup-nonstick-muffin-pan", category: 0, image: 0, price: 420000, compare: 495000, stock: 24, cost: 235000, weight: 650, desc: "قالب ۱۲ خانه برای پخت مافین، کاپ‌کیک و شیرینی‌های تک‌نفره با جداشدن آسان.", specs: [{ k: "تعداد خانه", v: "۱۲" }, { k: "جنس", v: "فلز نچسب" }, { k: "کاربرد", v: "مافین و کاپ‌کیک" }] },
  { fa: "ست ماسوره استیل قنادی ۱۲ عددی", en: "12 Piece Stainless Piping Tip Set", sku: "DEMO-PIPING-003", slug: "12-piece-stainless-piping-tip-set", category: 1, image: 1, price: 365000, compare: 430000, stock: 30, cost: 190000, weight: 280, desc: "۱۲ ماسوره استیل در طرح‌های متنوع برای خامه‌کشی، گل‌زنی و تزیین شیرینی.", specs: [{ k: "تعداد", v: "۱۲ ماسوره" }, { k: "جنس", v: "استیل ضدزنگ" }, { k: "شست‌وشو", v: "قابل شست‌وشوی دستی" }] },
  { fa: "ست ابزار قنادی سیلیکونی ۵ تکه", en: "5 Piece Silicone Baking Utensil Set", sku: "DEMO-SILICONE-004", slug: "5-piece-silicone-baking-utensil-set", category: 2, image: 2, price: 520000, compare: 610000, stock: 20, cost: 290000, weight: 420, desc: "مجموعه‌ای سبک و مقاوم برای هم‌زدن، جمع‌کردن مواد و اندازه‌گیری در پخت روزانه.", specs: [{ k: "تعداد", v: "۵ تکه" }, { k: "جنس", v: "سیلیکون و دسته مقاوم" }, { k: "کاربرد", v: "هم‌زدن و آماده‌سازی" }] },
  { fa: "خمیر فوندانت رنگی بسته ۸ عددی", en: "8 Color Fondant Modeling Set", sku: "DEMO-FONDANT-005", slug: "8-color-fondant-modeling-set", category: 3, image: 3, price: 395000, compare: 465000, stock: 32, cost: 210000, weight: 800, desc: "خمیر فوندانت نرم در هشت رنگ برای روکش کیک و ساخت تزیینات خوراکی.", specs: [{ k: "تعداد رنگ", v: "۸ رنگ" }, { k: "کاربرد", v: "روکش و گل‌سازی کیک" }, { k: "نگهداری", v: "در جای خشک و خنک" }] },
  { fa: "مروارید و ترافل خوراکی تزیین کیک", en: "Edible Pearls and Cake Sprinkles Set", sku: "DEMO-SPRINKLES-006", slug: "edible-pearls-and-cake-sprinkles-set", category: 3, image: 3, price: 285000, compare: 340000, stock: 28, cost: 145000, weight: 350, desc: "ترکیب مرواریدهای خوراکی و ترافل رنگی برای تزیین کاپ‌کیک، کیک و دسر.", specs: [{ k: "محتویات", v: "مروارید خوراکی و ترافل" }, { k: "کاربرد", v: "تزیین کیک و دسر" }, { k: "بسته‌بندی", v: "ظرف درب‌دار" }] },
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL تنظیم نشده است");
  await mkdir(mediaDirectory, { recursive: true });
  for (const asset of assets) {
    const source = path.join(assetDirectory, asset.file);
    await stat(source);
    await copyFile(source, path.join(mediaDirectory, asset.file));
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(99125)");
    const adminResult = await client.query("select id from users where role = 'super_admin' order by id limit 1 for update");
    const admin = adminResult.rows[0];
    if (!admin) throw new Error("حساب مدیر کل در پایگاه‌داده پیدا نشد");
    const conflict = await client.query("select id from users where phone = $1 and id <> $2 limit 1", [adminPhone, admin.id]);
    if (conflict.rowCount) throw new Error("این شماره قبلاً به حساب دیگری متصل شده است");
    await client.query("update users set phone = $1 where id = $2", [adminPhone, admin.id]);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "";
    for (const [key, value] of [
      ["siteName", "میرانو"],
      ["siteTagline", "فروشگاه تخصصی لوازم قنادی و شیرینی‌پزی"],
      ["siteUrl", siteUrl],
    ]) {
      await client.query(
        "insert into settings (key, value) values ($1, $2::jsonb) on conflict (key) do update set value=excluded.value",
        [key, JSON.stringify(value)],
      );
    }
    const retired = await client.query(
      "update products set status='draft', updated_at=now() where status not in ('draft','deleted') and (sku like 'BOUT-%' or name_fa ~* '(عسل|شهد|گرده گل|ژل رویال)' or coalesce(name_en,'') ~* '(honey|bee pollen|royal jelly)' or coalesce(brand,'') ~* 'بوتیک|mahlegha') returning id",
    );

    const categoryIds = [];
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const result = await client.query(
        `insert into categories (name, slug, description, sort_order)
         values ($1, $2, $3, $4)
         on conflict (slug) do update set name = excluded.name, description = excluded.description
         returning id`,
        [category.name, category.slug, category.description, 20 + i],
      );
      categoryIds.push(Number(result.rows[0].id));
    }

    const mediaIds = [];
    for (const asset of assets) {
      const storagePath = `uploads/demo-pastry-products/${asset.file}`;
      const size = (await stat(path.join(mediaDirectory, asset.file))).size;
      const existing = await client.query("select id from media where storage_path = $1 limit 1", [storagePath]);
      if (existing.rowCount) {
        const result = await client.query(
          "update media set filename=$1, alt=$2, mime='image/webp', size=$3, uploaded_by=$4, is_public=true, updated_at=now() where id=$5 returning id",
          [asset.file, asset.alt, size, admin.id, existing.rows[0].id],
        );
        mediaIds.push(Number(result.rows[0].id));
      } else {
        const result = await client.query(
          "insert into media (filename, alt, mime, size, storage_path, uploaded_by, is_public) values ($1, $2, 'image/webp', $3, $4, $5, true) returning id",
          [asset.file, asset.alt, size, storagePath, admin.id],
        );
        mediaIds.push(Number(result.rows[0].id));
      }
    }

    for (const [index, product] of products.entries()) {
      const productValues = [
        product.fa, product.en, product.sku, product.sku, product.sku.replace(/[^A-Za-z0-9]/g, ""), JSON.stringify([product.fa, product.en]),
        "میرانو", "میرانو", "ایران", categoryIds[product.category], product.price, product.compare, product.desc,
        `${product.desc} این محصول به‌صورت دمو برای فروشگاه لوازم قنادی میرانو ثبت شده است.`,
        `برای استفاده از ${product.fa}، پیش از شروع پخت اندازه‌ها و دمای مناسب فر را بررسی کنید. پس از استفاده ابزار را مطابق مشخصات آن تمیز و خشک نگه دارید.`,
        JSON.stringify(product.specs), product.weight, `62690000000${String(index + 1).padStart(2, "0")}`,
        `خرید ${product.fa} | لوازم قنادی میرانو`, `مشخصات و قیمت ${product.fa} را در فروشگاه لوازم قنادی میرانو ببینید.`,
        JSON.stringify(["لوازم قنادی", "شیرینی پزی", product.fa]), product.slug, mediaIds[product.image], admin.id,
        product.stock, product.cost,
      ];
      const existing = await client.query("select id from products where sku = $1 or slug = $2 order by id limit 1", [product.sku, product.slug]);
      let productId;
      if (existing.rowCount) {
        productId = Number(existing.rows[0].id);
        await client.query(
          `update products set name_fa=$1,name_en=$2,sku=$3,part_number=$4,normalized_pn=$5,cross_refs=$6::jsonb,brand=$7,manufacturer=$8,country=$9,category_id=$10,authenticity='Original',base_price=$11,compare_at_price=$12,short_desc=$13,description=$14,technical_review=$15,specs=$16::jsonb,compatibility='[]'::jsonb,weight=$17,barcode=$18,seo_title=$19,meta_desc=$20,seo_keywords=$21::jsonb,slug=$22,main_image_id=$23,source='central',created_by=$24,status='active',on_hand=$25,reserved=0,avg_cost=$26,updated_at=now(),deleted_at=null,deleted_by=null,deleted_from_status=null where id=$27`,
          [...productValues, productId],
        );
      } else {
        const result = await client.query(
          `insert into products (name_fa,name_en,sku,part_number,normalized_pn,cross_refs,brand,manufacturer,country,category_id,authenticity,base_price,compare_at_price,short_desc,description,technical_review,specs,compatibility,weight,barcode,seo_title,meta_desc,seo_keywords,slug,main_image_id,source,created_by,status,on_hand,avg_cost)
           values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,'Original',$11,$12,$13,$14,$15,$16::jsonb,'[]'::jsonb,$17,$18,$19,$20,$21::jsonb,$22,$23,'central',$24,'active',$25,$26)
           returning id`,
          productValues,
        );
        productId = Number(result.rows[0].id);
      }
      await client.query("delete from product_images where product_id = $1", [productId]);
      await client.query("insert into product_images (product_id, media_id, sort_order) values ($1, $2, 0)", [productId, mediaIds[product.image]]);
    }

    await client.query("commit");
    console.log(JSON.stringify({ adminPhone, products: products.length, categories: categoryIds.length, images: mediaIds.length, retiredBoutiqueProducts: retired.rowCount, mediaDirectory }, null, 2));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => pool.end());
