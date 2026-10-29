type VariantShippingWeight = {
  title?: string | null;
  attrs?: Record<string, string> | null;
  baseUnitAmount?: number | null;
};

const normalizeDigits = (value: string) => value
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  .replace(/٫/g, ".");

function explicitWeightGrams(value: string): number | null {
  const text = normalizeDigits(value.toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک"));
  const match = text.match(/(\d+(?:\.\d+)?)\s*(کیلوگرم|کیلو|کیلوئی|کیلویی|kg|گرم|gr|g)/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * (/^(?:کیلوگرم|کیلو|کیلوئی|کیلویی|kg)$/i.test(match[2]) ? 1000 : 1));
}

export function variantShippingWeightGrams(
  productWeight: number | null | undefined,
  productBaseUnit: string | null | undefined,
  variant?: VariantShippingWeight | null,
  snapshotTitle?: string | null,
): number {
  const candidates = [...(variant?.attrs ? Object.values(variant.attrs) : []), variant?.title ?? "", snapshotTitle ?? ""];
  for (const candidate of candidates) {
    const parsed = explicitWeightGrams(candidate);
    if (parsed) return parsed;
  }

  const baseUnit = (productBaseUnit ?? "").toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").trim();
  const baseAmount = Number(variant?.baseUnitAmount ?? 0);
  if (baseAmount > 0 && ["گرم", "g", "gr", "کیلوگرم", "کیلو", "kg"].includes(baseUnit)) {
    return Math.round(baseAmount * (["کیلوگرم", "کیلو", "kg"].includes(baseUnit) ? 1000 : 1));
  }
  return productWeight && productWeight > 0 ? productWeight : 500;
}
