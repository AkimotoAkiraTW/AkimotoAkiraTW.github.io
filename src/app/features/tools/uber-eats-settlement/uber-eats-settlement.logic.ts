/** 從 Uber Eats 品項 subtitle 加總 ($x.xx) 加料金額 */
export function sumCustomizationFromSubtitle(subtitle: string): number {
  let total = 0;
  const matches = subtitle.match(/\(\$(\d+\.?\d*)\)/g);
  if (matches) {
    for (const m of matches) {
      total += parseFloat(m.replace(/[^\d.]/g, '')) || 0;
    }
  }
  return total;
}

export interface ItemDiscountResult {
  finalPayablePrice: number;
  explicitDiscount: number;
}

/**
 * 解析 itemDiscount.formattedAmount。
 * - 語意 A：折後應付總額（如 $80 品項顯示 $67）
 * - 語意 B：折抵金額（如買一送一 $110 折 $60）
 */
export function resolveItemDiscount(
  originalPrice: number,
  quantity: number,
  discountVal: number,
  totalCustomizationPrice: number,
): ItemDiscountResult {
  if (discountVal <= 0 || originalPrice <= 0) {
    return { finalPayablePrice: originalPrice, explicitDiscount: 0 };
  }

  const payableAsFinal = discountVal;
  const explicitAsFinal = originalPrice - payableAsFinal;
  const payableAsOff = originalPrice - discountVal;
  const explicitAsOff = discountVal;

  const totalBase = originalPrice - totalCustomizationPrice;
  const unitBase = quantity > 0 ? totalBase / quantity : totalBase;

  const finalLooksLikePrice =
    discountVal >= originalPrice * 0.5 &&
    payableAsFinal <= originalPrice + 0.01 &&
    payableAsFinal >= totalCustomizationPrice - 0.01;

  const offLooksLikeBogo =
    quantity >= 2 &&
    discountVal < originalPrice * 0.55 &&
    payableAsOff >= unitBase * 0.35 &&
    payableAsOff < originalPrice;

  if (finalLooksLikePrice && !offLooksLikeBogo) {
    return { finalPayablePrice: payableAsFinal, explicitDiscount: explicitAsFinal };
  }

  if (offLooksLikeBogo || payableAsOff >= totalCustomizationPrice) {
    if (payableAsOff < totalCustomizationPrice - 0.01 && finalLooksLikePrice) {
      return { finalPayablePrice: payableAsFinal, explicitDiscount: explicitAsFinal };
    }
    return { finalPayablePrice: payableAsOff, explicitDiscount: explicitAsOff };
  }

  return { finalPayablePrice: payableAsFinal, explicitDiscount: explicitAsFinal };
}

export interface ParsedLineItem {
  storeName: string;
  buyer: string;
  itemName: string;
  quantity: number;
  price: number;
  customizationPrice: number;
  explicitDiscount: number;
  finalPayable: number;
  originalPayable: number;
  unitBasePrice: number;
}

export interface ProductSetting {
  isBogo: boolean;
  isGift: boolean;
  bogoLimit: number | null;
}

interface TitleGroupStats {
  totalQty: number;
  hasDiscountRow: boolean;
  maxDiscountRatio: number;
  maxQty: number;
  maxPrice: number;
  customizationPrice: number;
  hasGiftKeyword: boolean;
  minImpliedPayable: number;
}

/** 依品項名稱自動推斷買一送一 / 滿額贈（僅在無手動設定時） */
export function detectProductSettings(
  items: Array<{
    itemName: string;
    quantity: number;
    price: number;
    customizationPrice: number;
    explicitDiscount: number;
  }>,
  existing: Record<string, ProductSetting> = {},
): Record<string, ProductSetting> {
  const titleGroups: Record<string, TitleGroupStats> = {};

  for (const item of items) {
    const title = item.itemName;
    const isGiftKeyword = /送|贈|gift|free/i.test(title);

    if (!titleGroups[title]) {
      titleGroups[title] = {
        totalQty: 0,
        hasDiscountRow: false,
        maxDiscountRatio: 0,
        maxQty: 0,
        maxPrice: 0,
        customizationPrice: 0,
        hasGiftKeyword: isGiftKeyword,
        minImpliedPayable: 999999,
      };
    }

    const group = titleGroups[title];
    group.totalQty += item.quantity;
    if (item.quantity > group.maxQty) {
      group.maxQty = item.quantity;
    }
    if (item.price > group.maxPrice) {
      group.maxPrice = item.price;
      group.customizationPrice = item.customizationPrice;
    }
    if (item.explicitDiscount > 0) {
      group.hasDiscountRow = true;
      const ratio = item.explicitDiscount / item.price;
      if (ratio > group.maxDiscountRatio) {
        group.maxDiscountRatio = ratio;
      }
    }

    const impliedPayable = item.price - item.explicitDiscount;
    if (impliedPayable < group.minImpliedPayable) {
      group.minImpliedPayable = impliedPayable;
    }
  }

  const settings: Record<string, ProductSetting> = { ...existing };

  for (const title of Object.keys(titleGroups)) {
    if (settings[title]) continue;

    const g = titleGroups[title];
    let isGift = false;
    let isBogo = false;

    const isAddonOnlyPayable =
      g.maxQty === 1 &&
      g.hasDiscountRow &&
      Math.abs(g.minImpliedPayable - g.customizationPrice) < 0.01;

    if (g.hasGiftKeyword || isAddonOnlyPayable) {
      isGift = true;
    }

    if (!isGift && g.totalQty >= 2 && g.hasDiscountRow && g.maxDiscountRatio >= 0.4) {
      isBogo = true;
    }

    settings[title] = { isBogo, isGift, bogoLimit: null };
  }

  return settings;
}

export function parseOrderLineItem(
  item: Record<string, unknown>,
  storeName: string,
  buyer: string,
): ParsedLineItem {
  const rawPriceStr = (item['price'] as string) || '$0';
  const originalPrice = parseFloat(rawPriceStr.replace(/[^\d.]/g, '')) || 0;

  const subtitle = (item['subtitle'] as string) || '';
  const unitCustomization = sumCustomizationFromSubtitle(subtitle);

  const quantity = (item['quantity'] as number) || 1;
  const totalCustomizationPrice = unitCustomization * quantity;
  const totalBasePrice = originalPrice - totalCustomizationPrice;
  const unitBasePrice = quantity > 0 ? totalBasePrice / quantity : 0;

  let finalPayablePrice = originalPrice;
  let explicitDiscount = 0;

  const discountObj = item['itemDiscount'] as Record<string, unknown> | undefined;
  if (discountObj) {
    const discountVal =
      parseFloat(((discountObj['formattedAmount'] as string) || '0').replace(/[^\d.]/g, '')) || 0;
    const resolved = resolveItemDiscount(
      originalPrice,
      quantity,
      discountVal,
      totalCustomizationPrice,
    );
    finalPayablePrice = resolved.finalPayablePrice;
    explicitDiscount = resolved.explicitDiscount;
  }

  return {
    storeName,
    buyer,
    itemName: (item['title'] as string) || '未名品項',
    quantity,
    price: originalPrice,
    customizationPrice: totalCustomizationPrice,
    explicitDiscount,
    finalPayable: finalPayablePrice,
    originalPayable: finalPayablePrice,
    unitBasePrice,
  };
}
