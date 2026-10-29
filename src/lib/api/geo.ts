import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/util";
import { body, type Route } from "./router";
import { IRAN } from "@/lib/iran";

function normalizeGeo(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "فهرست استان‌ها و شهرها نامعتبر است");
  const result: Record<string, string[]> = {};
  for (const [rawProvince, rawCities] of Object.entries(value as Record<string, unknown>)) {
    const province = rawProvince.trim();
    if (!province || province.length > 80 || !Array.isArray(rawCities) || rawCities.length > 500) throw new HttpError(400, "نام استان یا فهرست شهرها نامعتبر است");
    const valid = rawCities.filter((city): city is string => typeof city === "string");
    const cities = [...new Set(valid.map((city) => city.trim()).filter((city) => city.length > 0 && city.length <= 100))];
    if (valid.length !== rawCities.length || cities.length !== rawCities.filter((city) => typeof city === "string" && city.trim()).length) throw new HttpError(400, "نام یکی از شهرها نامعتبر است");
    result[province] = cities;
  }
  if (Object.keys(result).length === 0 || Object.keys(result).length > 100) throw new HttpError(400, "حداقل یک استان و حداکثر ۱۰۰ استان لازم است");
  return result;
}

export const geoRoutes: Route[] = [
  { method: "GET", pattern: "geo", handler: async () => {
    const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, "geo")).limit(1);
    return row ? normalizeGeo(row.value) : IRAN;
  } },
  { method: "PUT", pattern: "geo", handler: async (request, _params, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), geo = normalizeGeo(await body(request));
    const [previous] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, "geo")).limit(1);
    await db.insert(settings).values({ key: "geo", value: geo }).onConflictDoUpdate({ target: settings.key, set: { value: geo } });
    await audit(db, { userId: user.id, ...meta }, "settings.geo_update", "settings", "geo", previous?.value ?? null, { provinceCount: Object.keys(geo).length, cityCount: Object.values(geo).reduce((total, cities) => total + cities.length, 0) });
    return geo;
  } },
];
