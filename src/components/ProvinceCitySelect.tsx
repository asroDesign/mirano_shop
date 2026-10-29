"use client";

import { useEffect, useRef, useState } from "react";
import { IRAN } from "@/lib/iran";

let geoCache: Record<string, string[]> | null = null;

export default function ProvinceCitySelect({ province, city, onProvince, onCity, className = "", provinceName, cityName, provinceLabel = "استان", cityLabel = "شهر", required = false }: {
  province: string; city: string; onProvince?: (value: string) => void; onCity?: (value: string) => void; className?: string;
  provinceName?: string; cityName?: string; provinceLabel?: string; cityLabel?: string; required?: boolean;
}) {
  const [geo, setGeo] = useState<Record<string, string[]>>(geoCache ?? IRAN);
  const [localProvince, setLocalProvince] = useState(province);
  const [localCity, setLocalCity] = useState(city);
  const provinceSelect = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (geoCache) return;
    let active = true;
    fetch("/api/geo", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data: unknown) => {
      if (!active || !data || typeof data !== "object" || Array.isArray(data)) return;
      const map = Object.fromEntries(Object.entries(data as Record<string, unknown>).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((city) => typeof city === "string")));
      if (Object.keys(map).length) { geoCache = map; setGeo(map); }
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const form = provinceSelect.current?.form;
    if (!form) return;
    const reset = () => window.setTimeout(() => { setLocalProvince(province); setLocalCity(city); }, 0);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [province, city]);
  const currentProvince = onProvince ? province : localProvince;
  const currentCity = onCity ? city : localCity;
  const provinces = currentProvince && !geo[currentProvince] ? [currentProvince, ...Object.keys(geo)] : Object.keys(geo);
  const availableCities = currentProvince ? geo[currentProvince] ?? [] : [];
  const cities = currentCity && !availableCities.includes(currentCity) ? [currentCity, ...availableCities] : availableCities;
  return <div className={`grid grid-cols-2 gap-2 ${className}`}>
    <select ref={provinceSelect} aria-label={provinceLabel} name={provinceName} value={currentProvince} required={required} onChange={(event) => { setLocalProvince(event.target.value); setLocalCity(""); onProvince?.(event.target.value); onCity?.(""); }} className="input min-w-0"><option value="">انتخاب استان</option>{provinces.map((name) => <option key={name} value={name}>{name}</option>)}</select>
    <select aria-label={cityLabel} name={cityName} value={currentCity} required={required} onChange={(event) => { setLocalCity(event.target.value); onCity?.(event.target.value); }} className="input min-w-0" disabled={!currentProvince}><option value="">{currentProvince ? "انتخاب شهر" : "ابتدا استان را انتخاب کنید"}</option>{cities.map((name) => <option key={name} value={name}>{name}</option>)}</select>
  </div>;
}

export function resetProvinceCityCache() {
  geoCache = null;
}
