import "dotenv/config";
import pg from "pg";
import sharp from "sharp";
import path from "node:path";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";

const sourceFile = process.argv.find((arg) => arg.endsWith(".sql"));
const dryRun = process.argv.includes("--dry-run");
if (!sourceFile) throw new Error("Usage: node scripts/import-mahlegha-dump.mjs <mysql-dump.sql> [--dry-run]");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const SOURCE = "mahlegha_boutique_dump";
const SITE_BASE = (process.env.MAHLEGHA_LEGACY_MEDIA_BASE_URL || "https://mahleghaboutique.ir/storage").replace(/\/+$/, "");
const MEDIA_ROOT = path.resolve(process.env.MEDIA_STORAGE_ROOT || path.join(process.cwd(), "storage", "media"));
const IMPORT_MEDIA_ROOT = "legacy-mahlegha";
const sqlText = await readFile(path.resolve(sourceFile), "utf8");

function insertBlocks(table) {
  const marker = `INSERT INTO \`${table}\``;
  const result = [];
  let from = 0;
  while (true) {
    const start = sqlText.indexOf(marker, from);
    if (start < 0) break;
    const valuesAt = sqlText.indexOf(" VALUES", start);
    if (valuesAt < 0) break;
    let quoted = false;
    let escaped = false;
    let end = valuesAt + 7;
    for (; end < sqlText.length; end++) {
      const char = sqlText[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === "'") quoted = false;
      } else if (char === "'") quoted = true;
      else if (char === ";") break;
    }
    const columns = [...sqlText.slice(start + marker.length, valuesAt).matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    result.push({ columns, values: sqlText.slice(valuesAt + 7, end) });
    from = end + 1;
  }
  return result;
}

function parseTuples(input) {
  const rows = [];
  let row = null;
  let token = "";
  let quoted = false;
  let escaped = false;
  const push = () => {
    const value = token.trim();
    row.push(value === "NULL" ? null : value);
    token = "";
  };
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (!row) {
      if (char === "(") row = [];
      continue;
    }
    if (quoted) {
      if (escaped) {
        token += char === "n" ? "\n" : char === "r" ? "\r" : char === "t" ? "\t" : char;
        escaped = false;
      } else if (char === "\\") escaped = true;
      else if (char === "'") quoted = false;
      else token += char;
      continue;
    }
    if (char === "'") quoted = true;
    else if (char === ",") push();
    else if (char === ")") {
      push();
      rows.push(row);
      row = null;
    } else token += char;
  }
  return rows;
}

const sourceRows = (table) => insertBlocks(table).flatMap(({ columns, values }) =>
  parseTuples(values).map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? null]))),
);
const integer = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
};
const money = (value) => Math.max(0, integer(value));
const asDate = (value) => {
  if (!value || value === "0000-00-00 00:00:00") return null;
  const parsed = new Date(`${String(value).replace(" ", "T")}Z`);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
};
const jsonValue = (value, fallback = null) => {
  try { return JSON.parse(value); } catch { return fallback; }
};
const slugify = (value, fallback) => String(value || "").trim().toLowerCase()
  .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
  .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || fallback;
const normalizePhone = (value, id) => {
  let phone = String(value || "").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/\D/g, "");
  if (phone.startsWith("0098")) phone = phone.slice(2);
  if (phone.startsWith("98") && phone.length === 12) phone = `0${phone.slice(2)}`;
  if (phone.startsWith("9") && phone.length === 10) phone = `0${phone}`;
  return /^09\d{9}$/.test(phone) ? phone : `legacy-mahlegha-${id}`;
};
const randomPasswordHash = () => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(randomBytes(32).toString("hex"), salt, 64).toString("hex")}`;
};
const safeFilename = (name, id) => {
  const leaf = path.basename(String(name || "")).replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^\.+/, "");
  return leaf || `legacy-${id}.jpg`;
};

const source = {
  users: sourceRows("users"), addresses: sourceRows("addresses"), categories: sourceRows("product_categories"),
  products: sourceRows("products"), variations: sourceRows("product_variations"), attributes: sourceRows("product_attributes"),
  options: sourceRows("product_attribute_options"), media: sourceRows("media"), orders: sourceRows("orders"),
  orderAddresses: sourceRows("order_addresses"), stocks: sourceRows("stocks"), transactions: sourceRows("transactions"),
};
const productMedia = source.media.filter((row) => row.model_type === "App\\Models\\Product" && row.collection_name === "product" && String(row.mime_type || "").startsWith("image/"));
const productImageBytes = productMedia.reduce((sum, row) => sum + Math.max(0, integer(row.size)), 0);
const variationsByProduct = new Map();
for (const variation of source.variations) {
  const key = String(variation.product_id);
  const list = variationsByProduct.get(key) || [];
  list.push(variation);
  variationsByProduct.set(key, list);
}
const productRowsById = new Map(source.products.map((row) => [String(row.id), row]));
const sourceOrdersById = new Map(source.orders.map((row) => [String(row.id), row]));
const sourceUsersById = new Map(source.users.map((row) => [String(row.id), row]));
const orderAddressesById = new Map();
for (const address of source.orderAddresses) {
  const key = String(address.order_id);
  const current = orderAddressesById.get(key);
  if (!current || String(address.address_type) === "10") orderAddressesById.set(key, address);
}
const stockRowsByOrder = new Map();
for (const row of source.stocks.filter((item) => item.model_type === "App\\Models\\Order")) {
  const key = String(row.model_id);
  const list = stockRowsByOrder.get(key) || [];
  list.push(row);
  stockRowsByOrder.set(key, list);
}
const orderLines = source.stocks.filter((row) => row.model_type === "App\\Models\\Order");
const onlineOrderRows = source.orders.filter((row) => String(row.order_type) === "5");
const posOrderRows = source.orders.filter((row) => String(row.order_type) === "15");
const orderLineTotals = orderLines.reduce((totals, line) => {
  const order = sourceOrdersById.get(String(line.model_id));
  const bucket = !order ? totals.orphan : String(order.order_type) === "15" ? totals.centralPos : totals.online;
  const qty = Math.max(1, Math.abs(integer(line.quantity, 1)));
  bucket.rows++;
  bucket.quantity += qty;
  bucket.total += money(line.total) || money(line.price) * qty;
  return totals;
}, { online: { rows: 0, quantity: 0, total: 0 }, centralPos: { rows: 0, quantity: 0, total: 0 }, orphan: { rows: 0, quantity: 0, total: 0 } });
const defaultProductVariantCounts = source.products.filter((product) => !(variationsByProduct.get(String(product.id)) || []).some((variation) => {
  const parentIds = new Set((variationsByProduct.get(String(product.id)) || []).map((item) => String(item.parent_id)).filter((id) => id !== "null" && id !== ""));
  return !parentIds.has(String(variation.id));
})).length;

if (dryRun) {
  console.log(JSON.stringify({
    database: "mahleghaboutique_next (from project DATABASE_URL)",
    products: source.products.length,
    productCategories: source.categories.length,
    productVariantsSourceRows: source.variations.length,
    productImages: productMedia.length,
    productImageSizeMB: Math.round(productImageBytes / 1024 / 1024),
    users: source.users.length,
    customerAddresses: source.addresses.length,
    ordersOnline: onlineOrderRows.length,
    ordersCentralPos: posOrderRows.length,
    deliveryOrders: onlineOrderRows.length,
    shipmentRecordsSource: 0,
    shipmentRowsToReconstruct: onlineOrderRows.length,
    orderStockLines: orderLines.length,
    orderLineTotals,
    transactions: source.transactions.length,
    posPaymentMethods: Object.fromEntries([...new Set(posOrderRows.map((row) => String(row.pos_payment_method || "نامشخص")))].map((method) => [method, posOrderRows.filter((row) => String(row.pos_payment_method || "نامشخص") === method).length])),
    usersWithInvalidMobileWillBeImportedWithLegacyAlias: source.users.filter((row) => normalizePhone(row.phone, row.id).startsWith("legacy-mahlegha-")).length,
    defaultVariantsExpected: defaultProductVariantCounts,
  }, null, 2));
  process.exit(0);
}

const downloaded = new Map();
let downloadFailures = 0;
let alreadyLocal = 0;
let downloadedCount = 0;
async function downloadOne(row) {
  const id = String(row.id);
  const filename = safeFilename(row.file_name, id);
  const storagePath = `${IMPORT_MEDIA_ROOT}/${id}/${path.parse(filename).name}.webp`;
  const target = path.resolve(MEDIA_ROOT, storagePath);
  if (!target.startsWith(`${MEDIA_ROOT}${path.sep}`)) throw new Error("Unsafe media file path");
  await mkdir(path.dirname(target), { recursive: true });
  try {
    const file = await stat(target);
    if (file.isFile() && file.size > 0) {
      downloaded.set(id, { storagePath, size: file.size, mime: "image/webp", externalUrl: null });
      alreadyLocal++;
      return;
    }
  } catch { /* Download the missing file. */ }

  const sourceUrl = `${SITE_BASE}/${encodeURIComponent(id)}/${String(row.file_name || "").split("/").map(encodeURIComponent).join("/")}`;
  const candidateUrls = [sourceUrl, sourceUrl.replace("https://mahleghaboutique.ir/", "https://www.mahleghaboutique.ir/")];
  let lastError = "source returned no response";
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of candidateUrls) {
      try {
        const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30000), headers: { "user-agent": "MahleghaLocalMediaMigration/1.0" } });
        if (!response.ok) { lastError = `HTTP ${response.status}`; continue; }
        const contentType = (response.headers.get("content-type") || row.mime_type || "").split(";")[0].trim().toLowerCase();
        if (!contentType.startsWith("image/")) { lastError = `unexpected content type ${contentType}`; continue; }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.length || buffer.length > 50 * 1024 * 1024) { lastError = "empty or oversized image"; continue; }
        let optimized = buffer;
        let storedMime = contentType;
        try {
          optimized = await sharp(buffer, { limitInputPixels: 80_000_000 })
            .rotate()
            .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 82, effort: 4 })
            .toBuffer();
          storedMime = "image/webp";
        } catch {
          // Preserve the original image if it cannot be decoded by sharp.
        }
        const temporary = `${target}.download-${process.pid}`;
        await writeFile(temporary, optimized);
        await rename(temporary, target);
        downloaded.set(id, { storagePath, size: optimized.length, mime: storedMime, externalUrl: null });
        downloadedCount++;
        return;
      } catch (error) { lastError = error instanceof Error ? error.message : String(error); }
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  downloadFailures++;
  downloaded.set(id, { storagePath, size: Math.max(0, integer(row.size)), mime: row.mime_type || "image/jpeg", externalUrl: sourceUrl });
  console.warn(`Could not cache source image id ${id}: ${lastError}`);
}

let nextDownload = 0;
await Promise.all(Array.from({ length: Math.min(8, productMedia.length) }, async () => {
  while (true) {
    const index = nextDownload++;
    if (index >= productMedia.length) return;
    await downloadOne(productMedia[index]);
  }
}));
console.log(`Product images: ${downloadedCount} downloaded, ${alreadyLocal} already local, ${downloadFailures} unavailable.`);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
const counts = { users: 0, usersMatchedExisting: 0, customerAddresses: 0, categories: 0, products: 0, productOptionsUpdated: 0, variants: 0, productImages: 0, onlineOrders: 0, centralPosSales: 0, onlineOrderItems: 0, centralPosItems: 0, skippedOrderLines: 0, shipments: 0, payments: 0, importedMedia: 0 };
const phoneToUser = new Map();
const mapGet = async (type) => new Map((await client.query(
  "select legacy_id,target_id from legacy_import_map where source=$1 and entity_type=$2", [SOURCE, type],
)).rows.map((row) => [String(row.legacy_id), Number(row.target_id)]));
const mapPut = async (type, legacyId, targetId) => client.query(
  "insert into legacy_import_map(source,entity_type,legacy_id,target_id) values($1,$2,$3,$4) on conflict(source,entity_type,legacy_id) do update set target_id=excluded.target_id",
  [SOURCE, type, String(legacyId), Number(targetId)],
);

try {
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock(83724910)");

  const staffRow = (await client.query("select id from users where role='super_admin' order by id limit 1")).rows[0];
  if (!staffRow) throw new Error("Target database has no super_admin user; run the normal application seed before importing.");
  const createdBy = Number(staffRow.id);

  const userMap = await mapGet("user");
  const targetUsers = (await client.query("select id,phone from users")).rows;
  for (const user of targetUsers) phoneToUser.set(String(user.phone), Number(user.id));
  for (const user of source.users) {
    const legacyId = String(user.id);
    if (userMap.has(legacyId)) continue;
    const phone = normalizePhone(user.phone, legacyId);
    let targetId = phoneToUser.get(phone);
    if (targetId) counts.usersMatchedExisting++;
    else {
      const passwordHash = /^\$2[aby]\$/.test(String(user.password || "")) ? user.password : randomPasswordHash();
      const inserted = await client.query(
        "insert into users(name,phone,email,password_hash,role,is_active,created_at) values($1,$2,$3,$4,'customer',$5,coalesce($6::timestamptz,now())) returning id",
        [user.name || `کاربر قدیمی ${legacyId}`, phone, user.email || null, passwordHash, String(user.status) === "5", asDate(user.created_at)],
      );
      targetId = Number(inserted.rows[0].id);
      phoneToUser.set(phone, targetId);
      counts.users++;
    }
    await mapPut("user", legacyId, targetId);
    userMap.set(legacyId, targetId);
  }

  const addressMap = await mapGet("customer_address");
  const addressNumber = new Map();
  for (const address of source.addresses) {
    const legacyId = String(address.id);
    if (addressMap.has(legacyId)) continue;
    const userId = userMap.get(String(address.user_id));
    if (!userId) continue;
    const ordinal = (addressNumber.get(String(address.user_id)) || 0) + 1;
    addressNumber.set(String(address.user_id), ordinal);
    const inserted = await client.query(
      "insert into customer_addresses(user_id,title,receiver_name,receiver_phone,province,city,address,postal_code,latitude,longitude,is_default,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,coalesce($12::timestamptz,now()),coalesce($13::timestamptz,now())) returning id",
      [userId, ordinal === 1 ? "خانه" : `نشانی ${ordinal}`, address.full_name || "مشتری", normalizePhone(address.phone, address.id), address.state || null, address.city || "نامشخص", address.address || "نشانی در داده قدیمی ثبت نشده است", address.zip_code || null, address.latitude || null, address.longitude || null, ordinal === 1, asDate(address.created_at), asDate(address.updated_at)],
    );
    const targetId = Number(inserted.rows[0].id);
    await mapPut("customer_address", legacyId, targetId);
    addressMap.set(legacyId, targetId);
    counts.customerAddresses++;
  }

  const categoryMap = await mapGet("product_category");
  const existingCategories = (await client.query("select id,name,slug from categories")).rows;
  for (const category of source.categories) {
    const legacyId = String(category.id);
    if (categoryMap.has(legacyId)) continue;
    const existing = existingCategories.find((item) => item.name === (category.name || ""));
    let targetId;
    if (existing) targetId = Number(existing.id);
    else {
      const base = slugify(category.slug || category.name, `category-${legacyId}`);
      let slug = base;
      if ((await client.query("select id from categories where slug=$1", [slug])).rows.length) slug = `${base}-mahlegha-${legacyId}`;
      const inserted = await client.query(
        "insert into categories(name,slug,description,sort_order) values($1,$2,$3,$4) returning id",
        [category.name || `دسته ${legacyId}`, slug, category.description || null, integer(category.order)],
      );
      targetId = Number(inserted.rows[0].id);
      counts.categories++;
    }
    categoryMap.set(legacyId, targetId);
    await mapPut("product_category", legacyId, targetId);
  }
  for (const category of source.categories) {
    const targetId = categoryMap.get(String(category.id));
    const parentId = categoryMap.get(String(category.parent_id));
    if (targetId && parentId && targetId !== parentId) await client.query("update categories set parent_id=$1 where id=$2", [parentId, targetId]);
  }

  const mediaMap = await mapGet("media");
  const mediaRowsByProduct = new Map();
  for (const row of productMedia.sort((a, b) => integer(a.order_column) - integer(b.order_column) || integer(a.id) - integer(b.id))) {
    const legacyId = String(row.id);
    const cached = downloaded.get(legacyId);
    if (!cached) continue;
    const filename = safeFilename(row.file_name, legacyId);
    const inserted = await client.query(
      `insert into media(filename,alt,mime,size,storage_path,external_url,legacy_source,legacy_id,is_public,created_at,updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,true,coalesce($9::timestamptz,now()),coalesce($10::timestamptz,now()))
       on conflict (legacy_source,legacy_id) where legacy_source is not null and legacy_id is not null
       do update set filename=excluded.filename,alt=excluded.alt,mime=excluded.mime,size=excluded.size,storage_path=excluded.storage_path,external_url=excluded.external_url,is_public=true,updated_at=now()
       returning id`,
      [filename, row.name || null, cached.mime, cached.size, cached.storagePath, cached.externalUrl, SOURCE, integer(row.id), asDate(row.created_at), asDate(row.updated_at)],
    );
    const targetId = Number(inserted.rows[0].id);
    mediaMap.set(legacyId, targetId);
    const productId = String(row.model_id);
    const list = mediaRowsByProduct.get(productId) || [];
    list.push({ sourceId: legacyId, targetId });
    mediaRowsByProduct.set(productId, list);
    await mapPut("media", legacyId, targetId);
    counts.importedMedia++;
  }

  const sourceAttributeName = new Map(source.attributes.map((row) => [String(row.id), String(row.name || "ویژگی")]));
  const sourceOptionName = new Map(source.options.map((row) => [String(row.id), String(row.name || "")]));
  const variationChildren = new Set(source.variations.map((row) => String(row.parent_id)).filter((id) => id !== "null" && id !== ""));
  const variantsByProduct = new Map();
  for (const variation of source.variations) {
    if (variationChildren.has(String(variation.id))) continue;
    const productId = String(variation.product_id);
    const list = variantsByProduct.get(productId) || [];
    list.push(variation);
    variantsByProduct.set(productId, list);
  }

  const currentStockByVariation = new Map();
  const pendingStockByVariation = new Map();
  const currentStockByProduct = new Map();
  const pendingStockByProduct = new Map();
  for (const stock of source.stocks) {
    const quantity = Math.abs(integer(stock.quantity));
    if (!quantity) continue;
    let delta = 0;
    let reserved = 0;
    if (stock.model_type === "App\\Models\\Purchase") delta = quantity;
    else if (stock.model_type === "App\\Models\\Damage") delta = -quantity;
    else if (stock.model_type === "App\\Models\\Order") {
      const order = sourceOrdersById.get(String(stock.model_id));
      if (!order) continue;
      const status = String(order.status);
      if (status === "1" && String(order.payment_status) === "5") reserved = quantity;
      else if (["5", "7", "10"].includes(status) && String(order.payment_status) === "5") delta = -quantity;
      else if (status === "20") delta = quantity;
    }
    if (!delta && !reserved) continue;
    const productId = String(stock.product_id);
    const variationId = stock.item_type === "App\\Models\\ProductVariation" ? String(stock.item_id) : null;
    if (variationId) {
      currentStockByVariation.set(variationId, (currentStockByVariation.get(variationId) || 0) + delta);
      pendingStockByVariation.set(variationId, (pendingStockByVariation.get(variationId) || 0) + reserved);
    }
    currentStockByProduct.set(productId, (currentStockByProduct.get(productId) || 0) + delta);
    pendingStockByProduct.set(productId, (pendingStockByProduct.get(productId) || 0) + reserved);
  }

  const productMap = await mapGet("product");
  const sourceSkuUsed = new Set((await client.query("select sku from products")).rows.map((row) => String(row.sku)));
  const productSourceToTarget = new Map(productMap);
  const productBasePrice = new Map();
  const productSellable = new Map();
  const variantMap = await mapGet("product_variant");
  const sourceVariationToTarget = new Map(variantMap);
  const defaultVariantMap = await mapGet("product_default_variant");
  const sourceVariationMap = new Map(source.variations.map((row) => [String(row.id), row]));
  const variationAttributes = (variation) => {
    const attrs = {};
    let node = variation;
    const seen = new Set();
    while (node && !seen.has(String(node.id))) {
      seen.add(String(node.id));
      const name = sourceAttributeName.get(String(node.product_attribute_id));
      const value = sourceOptionName.get(String(node.product_attribute_option_id));
      if (name && value) attrs[name] = value;
      node = node.parent_id ? sourceVariationMap.get(String(node.parent_id)) : null;
    }
    return attrs;
  };
  const productAttributeData = new Map(source.products.map((product) => {
    const attrsByVariant = (variantsByProduct.get(String(product.id)) || []).map(variationAttributes);
    const options = source.attributes.map((attribute) => {
      const name = String(attribute.name || "ویژگی");
      return { name, values: [...new Set(attrsByVariant.map((attrs) => attrs[name]).filter(Boolean))] };
    }).filter((option) => option.values.length);
    const sizes = [...new Set(options.filter((option) => /سایز|size/i.test(option.name)).flatMap((option) => option.values))];
    const colors = [...new Set(options.filter((option) => /رنگ|color/i.test(option.name)).flatMap((option) => option.values))];
    return [String(product.id), { options, sizes, colors }];
  }));
  const discountPrice = (price, raw) => {
    const data = jsonValue(raw, {});
    const offer = money(data?.offer);
    if (!offer) return { base: price, compare: 0 };
    const percent = /percent|percentage|درصد/i.test(String(data?.unit || ""));
    const amount = percent ? Math.round(price * Math.min(100, offer) / 100) : offer;
    const base = Math.max(0, price - amount);
    return { base, compare: base < price ? price : 0 };
  };

  for (const product of source.products) {
    const legacyId = String(product.id);
    if (productMap.has(legacyId)) continue;
    const categoryId = categoryMap.get(String(product.product_category_id)) ?? null;
    let sku = String(product.sku || `MAHLEGHA-${legacyId}`).trim();
    if (sourceSkuUsed.has(sku)) sku = `${sku}-M${legacyId}`;
    sourceSkuUsed.add(sku);
    const baseSlug = slugify(product.slug || product.name, `product-${legacyId}`);
    let slug = baseSlug;
    if ((await client.query("select id from products where slug=$1", [slug])).rows.length) slug = `${baseSlug}-mahlegha-${legacyId}`;
    const rawPrice = money(product.selling_price || product.variation_price);
    const discounted = discountPrice(rawPrice, product.discount);
    const available = Math.max(0, currentStockByProduct.get(legacyId) || 0);
    const reserved = Math.min(available, Math.max(0, pendingStockByProduct.get(legacyId) || 0));
    const imageRows = mediaRowsByProduct.get(legacyId) || [];
    const mainImageId = imageRows[0]?.targetId ?? null;
    const { options, sizes, colors } = productAttributeData.get(legacyId) || { options: [], sizes: [], colors: [] };
    const inserted = await client.query(
      `insert into products(name_fa,sku,part_number,normalized_pn,brand,category_id,authenticity,color,sizes,options,base_price,compare_at_price,short_desc,description,weight,barcode,seo_title,meta_desc,slug,main_image_id,source,status,on_hand,reserved,low_stock_threshold,allow_backorder,inventory_base_unit,created_at,updated_at)
       values($1,$2,$2,$3,'بوتیک مه‌لقا',$4,'Original',$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'central','active',$18,$19,$20,false,'عدد',coalesce($21::timestamptz,now()),coalesce($22::timestamptz,now())) returning id`,
      [product.name || `محصول قدیمی ${legacyId}`, sku, sku.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || `MAHLEGHA${legacyId}`, categoryId, colors[0] || null, JSON.stringify(sizes), JSON.stringify(options), discounted.base, discounted.compare,
        product.name || null, product.description || product.shipping_and_return || null, money(product.weight) || null, product.sku || null,
        product.name || null, product.description || null, slug, mainImageId, available, reserved, Math.max(0, integer(product.low_stock_quantity_warning, 3)), asDate(product.created_at), asDate(product.updated_at)],
    );
    const targetId = Number(inserted.rows[0].id);
    productMap.set(legacyId, targetId);
    productSourceToTarget.set(legacyId, targetId);
    productBasePrice.set(legacyId, discounted.base);
    productSellable.set(legacyId, String(product.can_purchasable) !== "10");
    await mapPut("product", legacyId, targetId);
    counts.products++;
  }
  for (const product of source.products) {
    const legacyId = String(product.id);
    if (!productBasePrice.has(legacyId)) {
      const row = (await client.query("select base_price from products where id=$1", [productMap.get(legacyId)])).rows[0];
      productBasePrice.set(legacyId, Number(row?.base_price || 0));
      productSellable.set(legacyId, String(product.can_purchasable) !== "10");
    }
    const targetId = productMap.get(legacyId);
    const attributeData = productAttributeData.get(legacyId) || { options: [], sizes: [], colors: [] };
    await client.query("update products set options=$1::jsonb,sizes=$2::jsonb,color=coalesce($3,color) where id=$4", [JSON.stringify(attributeData.options), JSON.stringify(attributeData.sizes), attributeData.colors[0] || null, targetId]);
    counts.productOptionsUpdated++;
    const existingImages = new Set((await client.query("select media_id from product_images where product_id=$1", [targetId])).rows.map((row) => Number(row.media_id)));
    for (const image of mediaRowsByProduct.get(legacyId) || []) {
      if (existingImages.has(image.targetId)) continue;
      await client.query("insert into product_images(product_id,media_id,sort_order) values($1,$2,$3)", [targetId, image.targetId, existingImages.size]);
      existingImages.add(image.targetId);
      counts.productImages++;
    }
  }

  const variantSkuUsed = new Set((await client.query("select sku from product_variants")).rows.map((row) => String(row.sku)));
  const targetVariantsByProduct = new Map();
  for (const product of source.products) {
    const legacyProductId = String(product.id);
    const targetProductId = productMap.get(legacyProductId);
    const sellable = productSellable.get(legacyProductId) ?? true;
    const leaves = variantsByProduct.get(legacyProductId) || [];
    const currentLeaves = leaves.filter((row) => !variantMap.has(String(row.id)));
    for (const variation of currentLeaves) {
      const legacyVariationId = String(variation.id);
      const attrs = variationAttributes(variation);
      const priceInfo = discountPrice(money(variation.price) || productBasePrice.get(legacyProductId) || 0, product.discount);
      let sku = String(variation.sku || `${product.sku || `MAHLEGHA-${legacyProductId}`}-V${legacyVariationId}`).trim();
      if (variantSkuUsed.has(sku)) sku = `${sku}-M${legacyVariationId}`;
      variantSkuUsed.add(sku);
      const current = Math.max(0, currentStockByVariation.get(legacyVariationId) || 0);
      const reserved = Math.min(current, Math.max(0, pendingStockByVariation.get(legacyVariationId) || 0));
      const title = Object.values(attrs).join(" / ") || `تنوع ${legacyVariationId}`;
      const inserted = await client.query(
        "insert into product_variants(product_id,title,attrs,sku,price,compare_at_price,on_hand,reserved,is_active,is_sellable) values($1,$2,$3,$4,$5,$6,$7,$8,true,$9) returning id",
        [targetProductId, title, JSON.stringify(attrs), sku, priceInfo.base, priceInfo.compare, current, reserved, sellable],
      );
      const targetVariantId = Number(inserted.rows[0].id);
      variantMap.set(legacyVariationId, targetVariantId);
      sourceVariationToTarget.set(legacyVariationId, targetVariantId);
      const list = targetVariantsByProduct.get(legacyProductId) || [];
      list.push(targetVariantId);
      targetVariantsByProduct.set(legacyProductId, list);
      await mapPut("product_variant", legacyVariationId, targetVariantId);
      counts.variants++;
    }
  }
  for (const product of source.products) {
    const legacyId = String(product.id);
    const leaves = variantsByProduct.get(legacyId) || [];
    const mappedLeafCount = leaves.filter((row) => variantMap.has(String(row.id))).length;
    if (mappedLeafCount) continue;
    if (defaultVariantMap.has(legacyId)) continue;
    const targetProductId = productMap.get(legacyId);
    const basePrice = productBasePrice.get(legacyId) || 0;
    let sku = `${product.sku || `MAHLEGHA-${legacyId}`}-DEFAULT`;
    if (variantSkuUsed.has(sku)) sku = `${sku}-M${legacyId}`;
    variantSkuUsed.add(sku);
    const inserted = await client.query(
      "insert into product_variants(product_id,title,attrs,sku,price,on_hand,reserved,is_active,is_sellable) values($1,'پیش‌فرض','{}',$2,$3,$4,$5,true,$6) returning id",
      [targetProductId, sku, basePrice, Math.max(0, currentStockByProduct.get(legacyId) || 0), Math.max(0, pendingStockByProduct.get(legacyId) || 0), String(product.can_purchasable) !== "10"],
    );
    const targetId = Number(inserted.rows[0].id);
    defaultVariantMap.set(legacyId, targetId);
    sourceVariationToTarget.set(`product:${legacyId}`, targetId);
    targetVariantsByProduct.set(legacyId, [targetId]);
    await mapPut("product_default_variant", legacyId, targetId);
    counts.variants++;
  }

  const sourceOrdersToTarget = new Map();
  const onlineOrderMap = await mapGet("online_order");
  const posSaleMap = await mapGet("central_pos_sale");
  const shipmentMap = await mapGet("shipment");
  const transactionMap = await mapGet("transaction");
  const numberExists = async (table, value) => (await client.query(`select id from ${table} where number=$1`, [value])).rows.length > 0;
  const appOrderStatus = (order) => {
    const status = String(order.status);
    if (status === "1") return String(order.payment_status) === "5" ? "paid" : "pending_payment";
    return ({ "5": "processing", "7": "shipped", "10": "completed", "15": "cancelled", "20": "returned" })[status] || "processing";
  };
  const shipmentStatus = (order) => ({ "1": "pending", "5": "preparing", "7": "shipped", "10": "delivered", "15": "cancelled", "20": "returned" })[String(order.status)] || "pending";
  const cashbackOrders = new Set(source.transactions.filter((row) => String(row.type).toLowerCase() === "cash_back").map((row) => String(row.order_id)));
  const paymentStatus = (order) => cashbackOrders.has(String(order.id)) ? "refunded" : String(order.payment_status) === "5" ? "paid" : "unpaid";
  const makeOrderAddress = (order) => {
    const legacyUser = sourceUsersById.get(String(order.user_id));
    const address = orderAddressesById.get(String(order.id));
    const fallback = source.addresses.find((item) => String(item.user_id) === String(order.user_id));
    const src = address || fallback;
    return {
      fullName: src?.full_name || legacyUser?.name || "مشتری قدیمی",
      phone: normalizePhone(src?.phone || legacyUser?.phone, order.user_id),
      province: src?.state || null,
      city: src?.city || "نامشخص",
      address: src?.address || "نشانی در داده قدیمی ثبت نشده است",
      postalCode: src?.zip_code || "",
    };
  };
  const orderNumber = async (table, legacy) => {
    let number = String(legacy.order_serial_no || `MAH-${legacy.id}`);
    if (await numberExists(table, number)) number = `${number}-M${legacy.id}`;
    return number;
  };

  for (const order of onlineOrderRows) {
    const legacyId = String(order.id);
    if (onlineOrderMap.has(legacyId)) {
      sourceOrdersToTarget.set(legacyId, Number(onlineOrderMap.get(legacyId)));
      continue;
    }
    const userId = userMap.get(String(order.user_id));
    if (!userId) throw new Error(`No migrated user for source order ${legacyId}`);
    const number = await orderNumber("orders", order);
    const address = makeOrderAddress(order);
    const total = money(order.total);
    const inserted = await client.query(
      `insert into orders(number,customer_id,status,payment_status,items_subtotal,seller_shipping_total,central_shipping,discount,tax,total,address,idempotency_key,created_at,updated_at)
       values($1,$2,$3,$4,$5,0,$6,$7,$8,$9,$10,$11,coalesce($12::timestamptz,now()),coalesce($13::timestamptz,now())) returning id`,
      [number, userId, appOrderStatus(order), paymentStatus(order), money(order.subtotal), money(order.shipping_charge), money(order.discount), money(order.tax), total, JSON.stringify(address), `${SOURCE}:online-order:${legacyId}`, asDate(order.order_datetime || order.created_at), asDate(order.updated_at)],
    );
    const targetId = Number(inserted.rows[0].id);
    onlineOrderMap.set(legacyId, targetId);
    sourceOrdersToTarget.set(legacyId, targetId);
    await mapPut("online_order", legacyId, targetId);
    counts.onlineOrders++;
    await client.query("insert into order_history(order_id,status,note,user_id,created_at) values($1,$2,$3,$4,coalesce($5::timestamptz,now()))", [targetId, appOrderStatus(order), `وضعیت منبع در زمان انتقال: ${order.status}`, createdBy, asDate(order.updated_at)]);
  }

  for (const order of posOrderRows) {
    const legacyId = String(order.id);
    if (posSaleMap.has(legacyId)) {
      sourceOrdersToTarget.set(legacyId, Number(posSaleMap.get(legacyId)));
      continue;
    }
    const sourceUser = sourceUsersById.get(String(order.user_id));
    const customerName = sourceUser?.name || `مشتری حضوری ${legacyId}`;
    const customerPhone = normalizePhone(sourceUser?.phone, order.user_id);
    const number = await orderNumber("central_pos_sales", order);
    const paymentText = String(order.pos_payment_method || "").toLowerCase();
    const paymentMethod = /نقد|cash/.test(paymentText) ? "cash" : /ترکیب|mixed/.test(paymentText) ? "mixed" : "card";
    const total = money(order.total);
    const inserted = await client.query(
      `insert into central_pos_sales(number,idempotency_key,created_by,customer_name,customer_phone,subtotal,discount,total,payment_method,settlement,status,created_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,coalesce($12::timestamptz,now())) returning id`,
      [number, `${SOURCE}:pos:${legacyId}`, createdBy, customerName, customerPhone, money(order.subtotal), money(order.discount), total, paymentMethod,
        JSON.stringify(paymentMethod === "cash" ? { cash: total, card: 0 } : { cash: 0, card: total }), String(order.status) === "20" ? "returned" : String(order.status) === "15" ? "cancelled" : "completed", asDate(order.order_datetime || order.created_at)],
    );
    const targetId = Number(inserted.rows[0].id);
    posSaleMap.set(legacyId, targetId);
    sourceOrdersToTarget.set(legacyId, targetId);
    await mapPut("central_pos_sale", legacyId, targetId);
    counts.centralPosSales++;
  }

  const shipmentsByOrder = new Map();
  for (const order of onlineOrderRows) {
    const legacyId = String(order.id);
    const orderId = onlineOrderMap.get(legacyId);
    if (!orderId) continue;
    let shipmentId = shipmentMap.get(legacyId);
    if (!shipmentId) {
      const inserted = await client.query(
        `insert into seller_shipments(order_id,items_total,shipping_cost,status,package_count,settled,notes,created_at)
         values($1,$2,$3,$4,1,false,$5,coalesce($6::timestamptz,now())) returning id`,
        [orderId, money(order.subtotal), money(order.shipping_charge), shipmentStatus(order), "شماره رهگیری در نسخهٔ پشتیبان ثبت نشده است", asDate(order.order_datetime || order.created_at)],
      );
      shipmentId = Number(inserted.rows[0].id);
      await mapPut("shipment", legacyId, shipmentId);
      shipmentMap.set(legacyId, shipmentId);
      counts.shipments++;
    }
    shipmentsByOrder.set(legacyId, Number(shipmentId));
  }

  const stockRowsByOrderId = new Map([...stockRowsByOrder.entries()]);
  for (const [legacyOrderId, rows] of stockRowsByOrderId) {
    const order = sourceOrdersById.get(legacyOrderId);
    if (!order) { counts.skippedOrderLines += rows.length; continue; }
    const pos = String(order.order_type) === "15";
    const targetId = sourceOrdersToTarget.get(legacyOrderId);
    if (!targetId) continue;
    const groupedItems = new Map();
    for (const item of rows) {
      const sourceProductId = String(item.product_id);
      const productId = productMap.get(sourceProductId);
      if (!productId) { counts.skippedOrderLines++; continue; }
      const sourceVariantId = item.item_type === "App\\Models\\ProductVariation" ? String(item.item_id) : null;
      const variantId = (sourceVariantId && variantMap.get(sourceVariantId)) || defaultVariantMap.get(sourceProductId) || (variantsByProduct.get(sourceProductId) || []).map((row) => variantMap.get(String(row.id))).find(Boolean);
      if (!variantId) { counts.skippedOrderLines++; continue; }
      const qty = Math.max(1, Math.abs(integer(item.quantity, 1)));
      const sourceUnitPrice = money(item.price);
      const lineTotal = money(item.total) || sourceUnitPrice * qty;
      const title = `${productRowsById.get(sourceProductId)?.name || `محصول ${sourceProductId}`}${item.variation_names ? ` · ${item.variation_names}` : ""}`;
      const key = pos ? String(variantId) : `${productId}:${variantId}:${title}`;
      const aggregate = groupedItems.get(key) || { productId, variantId, titleSet: new Set(), qty: 0, total: 0, weightedUnitPrice: 0, unitCost: money(productRowsById.get(sourceProductId)?.buying_price), createdAt: asDate(item.created_at) };
      aggregate.titleSet.add(title);
      aggregate.qty += qty;
      aggregate.total += lineTotal;
      aggregate.weightedUnitPrice += sourceUnitPrice * qty;
      groupedItems.set(key, aggregate);
    }
    for (const aggregate of groupedItems.values()) {
      const title = [...aggregate.titleSet].join(" / ");
      const unitPrice = aggregate.qty ? Math.round(aggregate.weightedUnitPrice / aggregate.qty) : 0;
      if (pos) {
        const existing = await client.query("select id from central_pos_items where sale_id=$1 and variant_id=$2 order by id limit 1", [targetId, aggregate.variantId]);
        if (existing.rows.length) {
          await client.query("update central_pos_items set product_id=$2,title=$3,quantity=$4,unit_price=$5,line_total=$6,unit_cost=$7 where id=$1", [existing.rows[0].id, aggregate.productId, title, aggregate.qty, unitPrice, aggregate.total, aggregate.unitCost]);
        } else {
          await client.query(
            "insert into central_pos_items(sale_id,variant_id,product_id,title,quantity,unit_price,line_total,unit_cost,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9::timestamptz,now()))",
            [targetId, aggregate.variantId, aggregate.productId, title, aggregate.qty, unitPrice, aggregate.total, aggregate.unitCost, aggregate.createdAt],
          );
        }
        counts.centralPosItems++;
      } else {
        const shipmentId = shipmentsByOrder.get(legacyOrderId) || null;
        const existing = await client.query("select id from order_items where order_id=$1 and product_id=$2 and variant_id is not distinct from $3 and title=$4 order by id limit 1", [targetId, aggregate.productId, aggregate.variantId, title]);
        if (existing.rows.length) {
          await client.query("update order_items set shipment_id=$2,unit_price=$3,qty=$4,line_total=$5,unit_cost=$6 where id=$1", [existing.rows[0].id, shipmentId, unitPrice, aggregate.qty, aggregate.total, aggregate.unitCost]);
        } else {
          await client.query(
            "insert into order_items(order_id,product_id,variant_id,shipment_id,title,unit_price,qty,line_total,unit_cost) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            [targetId, aggregate.productId, aggregate.variantId, shipmentId, title, unitPrice, aggregate.qty, aggregate.total, aggregate.unitCost],
          );
        }
        counts.onlineOrderItems++;
      }
    }
  }

  for (const transaction of source.transactions) {
    const legacyId = String(transaction.id);
    if (transactionMap.has(legacyId)) continue;
    const orderId = onlineOrderMap.get(String(transaction.order_id));
    if (!orderId) continue;
    const refunded = String(transaction.type).toLowerCase() === "cash_back" || String(transaction.sign) === "-";
    const inserted = await client.query(
      `insert into payments(order_id,amount,method,status,ref_code,gateway,note,details,idempotency_key,created_at)
       values($1,$2,'gateway',$3,$4,$5,$6,$7,$8,coalesce($9::timestamptz,now())) returning id`,
      [orderId, money(transaction.amount), refunded ? "refunded" : "success", transaction.transaction_no || null, transaction.payment_method || null,
        transaction.type || null, JSON.stringify({ source: SOURCE, sign: transaction.sign || "" }), `${SOURCE}:transaction:${legacyId}`, asDate(transaction.created_at)],
    );
    await mapPut("transaction", legacyId, inserted.rows[0].id);
    transactionMap.set(legacyId, Number(inserted.rows[0].id));
    counts.payments++;
  }

  await client.query("commit");
  console.log(JSON.stringify({ source: SOURCE, targetDatabase: "mahleghaboutique_next", counts, imageFiles: { downloaded: downloadedCount, alreadyLocal, unavailable: downloadFailures, folder: path.join(MEDIA_ROOT, IMPORT_MEDIA_ROOT) } }, null, 2));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
