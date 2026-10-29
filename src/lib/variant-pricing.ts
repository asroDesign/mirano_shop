export type VariantDiscountType = "none" | "percent" | "fixed";

export function calculateVariantPrice(input: {
  cost: number;
  manualPrice: number;
  profitPercent: number;
  discountType: VariantDiscountType;
  discountValue: number;
  clampDiscount?: boolean;
}) {
  const { cost, manualPrice, profitPercent, discountType, discountValue } = input;
  const calculatedRegularPrice = profitPercent > 0 && cost > 0
    ? Math.round(cost * (100 + profitPercent) / 100)
    : manualPrice;
  // An inventory cost change must not make receipt posting fail just because
  // an older manual price is now below cost. In that case move the reference
  // price up to cost before applying any remaining safe discount.
  const regularPrice = input.clampDiscount ? Math.max(calculatedRegularPrice, cost) : calculatedRegularPrice;
  const requestedDiscount = discountType === "percent"
    ? Math.round(regularPrice * discountValue / 100)
    : discountType === "fixed" ? discountValue : 0;
  const discount = input.clampDiscount ? Math.min(requestedDiscount, Math.max(0, regularPrice - cost)) : requestedDiscount;
  let effectiveDiscountValue = discountValue;
  if (input.clampDiscount && discountType === "fixed") effectiveDiscountValue = discount;
  if (input.clampDiscount && discountType === "percent") {
    const maxDiscount = Math.max(0, regularPrice - cost);
    effectiveDiscountValue = Math.min(effectiveDiscountValue, regularPrice ? Math.floor(maxDiscount * 100 / regularPrice) : 0);
    while (effectiveDiscountValue > 0 && Math.round(regularPrice * effectiveDiscountValue / 100) > maxDiscount) effectiveDiscountValue -= 1;
  }
  const price = regularPrice - discount;
  if (regularPrice < 1 || price < 1) throw new Error("قیمت پس از تخفیف باید مثبت باشد");
  if (price < cost) throw new Error(`تخفیف از حاشیه سود بیشتر است؛ قیمت نهایی نباید از بهای خرید انبار (${cost.toLocaleString("fa-IR")} تومان) کمتر شود`);
  return { regularPrice, price, compareAtPrice: discount > 0 ? regularPrice : 0, discountValue: effectiveDiscountValue };
}
